# 1. Load AWS credentials BEFORE importing any other modules
from dotenv import load_dotenv
load_dotenv()  

# 2. Safe to import all other modules now
import hashlib
import os
import uuid
from fastapi import FastAPI, Depends, Request, UploadFile, File, Form, HTTPException
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
import pymupdf  # PyMuPDF

# --- APPLICATION SERVICES & DB UTILS ---
from app.services.chat_services import process_chat_message
from app.services.tools import qdrant_client, embeddings
from app.database.postgres import init_db, get_db_connection

# --- QDRANT & LANGCHAIN IMPORTS ---
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.documents import Document
from langchain_qdrant import QdrantVectorStore
from qdrant_client.models import Distance, VectorParams, Filter, FieldCondition, MatchValue

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize database schema on startup
init_db()

class ChatPayload(BaseModel):
    message: str
    active_documents: list = []

# --- Strict Validation Model for Status Toggles ---
class StatusUpdatePayload(BaseModel):
    is_active: bool

async def extract_user_context(request: Request):
    return {
        "role": "employee", 
        "emp_id": "104",    
        "session_id": request.headers.get("X-Session-ID", str(uuid.uuid4()))
    }

@app.post("/api/chat")
async def chat_handler(
    payload: ChatPayload, 
    request: Request, 
    user_context: dict = Depends(extract_user_context)
):
    session_id = request.headers.get("X-Session-ID", user_context.get("session_id"))
    
    reply_text = await process_chat_message(
        message=payload.message,
        session_id=session_id,
        active_documents=payload.active_documents
    )
    
    return {"reply": reply_text, "sources": []}

@app.post("/api/upload")
async def upload_document(
    file: UploadFile = File(...),
    category: str = Form("General"),
    user_context: dict = Depends(extract_user_context)
):
    contents = await file.read()
    file_hash = hashlib.sha256(contents).hexdigest()

    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("SELECT filename FROM documents WHERE file_hash = %s;", (file_hash,))
        existing_doc = cur.fetchone()
        
        if existing_doc:
            cur.close()
            conn.close()
            raise HTTPException(
                status_code=409, 
                detail=f"This document has already been uploaded as '{existing_doc[0]}'."
            )
    except HTTPException:
        raise
    except Exception as e:
        print(f"⚠️ DB duplicate check error: {e}")

    doc = pymupdf.open(stream=contents, filetype="pdf")
    extracted_text = "".join([page.get_text() for page in doc])
        
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=1000, 
        chunk_overlap=200
    )
    chunks = text_splitter.split_text(extracted_text)
    
    documents = [
        Document(
            page_content=chunk, 
            metadata={
                "source": file.filename, 
                "file_hash": file_hash,
                "category": category,
                "is_active": True
            }
        ) 
        for chunk in chunks
    ]
    
    collection_name = "rag_documents"

    if not qdrant_client.collection_exists(collection_name):
        sample_embedding = embeddings.embed_query("test dimension size")
        qdrant_client.create_collection(
            collection_name=collection_name,
            vectors_config=VectorParams(
                size=len(sample_embedding), 
                distance=Distance.COSINE
            ),
        )

    vector_store = QdrantVectorStore(
        client=qdrant_client,
        collection_name=collection_name, 
        embedding=embeddings
    )
    vector_store.add_documents(documents)

    # Record document entry in PostgreSQL (Ignore PG's is_active field entirely)
    try:
        cur.execute(
            """
            INSERT INTO documents (file_hash, filename, category, uploaded_by)
            VALUES (%s, %s, %s, %s);
            """,
            (file_hash, file.filename, category, user_context.get("role", "HR_Admin"))
        )
        conn.commit()
        cur.close()
        conn.close()
    except Exception as e:
        print(f"⚠️ PostgreSQL record insertion error: {e}")

    return {
        "filename": file.filename,
        "file_hash": file_hash,
        "category": category,
        "status": "success",
        "characters_extracted": len(extracted_text),
        "chunks_added": len(documents)
    }

@app.get("/api/documents")
async def get_documents():
    """
    Fetches base document data from PostgreSQL, but strictly reads the TRUE is_active status 
    live directly from Qdrant Vector metadata.
    """
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute(
            """
            SELECT id, file_hash, filename, category, uploaded_by, uploaded_at 
            FROM documents 
            ORDER BY uploaded_at DESC;
            """
        )
        rows = cur.fetchall()
        cur.close()
        conn.close()
        
        documents_list = []
        collection_name = "rag_documents"
        collection_exists = qdrant_client.collection_exists(collection_name)

        for r in rows:
            file_hash = r[1]
            is_active_in_qdrant = True 
            
            # Ask Qdrant as the sole source of truth for status
            if collection_exists:
                records, _ = qdrant_client.scroll(
                    collection_name=collection_name,
                    scroll_filter=Filter(
                        must=[FieldCondition(key="metadata.file_hash", match=MatchValue(value=file_hash))]
                    ),
                    limit=1,
                    with_payload=True
                )
                if records:
                    is_active_in_qdrant = records[0].payload.get("metadata", {}).get("is_active", True)

            documents_list.append({
                "id": r[0],
                "hash": r[1],
                "name": r[2],
                "category": r[3],
                "uploaded_by": r[4],
                "uploaded_at": r[5].isoformat() if r[5] else None,
                "is_active": is_active_in_qdrant # <-- Qdrant defines UI state
            })
            
        return documents_list

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.patch("/api/documents/{file_hash}/status")
async def update_document_status(file_hash: str, payload: StatusUpdatePayload):
    """
    Qdrant ONLY toggle: This endpoint no longer touches PostgreSQL. 
    It strictly updates the active state in Qdrant's vector metadata.
    """
    new_status = payload.is_active
    
    try:
        collection_name = "rag_documents"
        if not qdrant_client.collection_exists(collection_name):
            raise HTTPException(status_code=404, detail="Qdrant collection not found.")

        next_offset = None
        chunks_found = False
        
        while True:
            records, next_offset = qdrant_client.scroll(
                collection_name=collection_name,
                scroll_filter=Filter(
                    must=[
                        FieldCondition(
                            key="metadata.file_hash",
                            match=MatchValue(value=file_hash)
                        )
                    ]
                ),
                limit=1000,
                offset=next_offset,
                with_payload=True
            )

            if records:
                chunks_found = True

            for record in records:
                updated_payload = record.payload or {}
                if "metadata" not in updated_payload:
                    updated_payload["metadata"] = {}
                
                updated_payload["metadata"]["is_active"] = new_status
                
                qdrant_client.set_payload(
                    collection_name=collection_name,
                    payload=updated_payload,
                    points=[record.id]
                )
                
            if next_offset is None:
                break
                
        # If Qdrant has zero chunks matching this hash, reject the request
        if not chunks_found:
             raise HTTPException(status_code=404, detail="Document hash not found in Qdrant.")
                
    except HTTPException:
        raise
    except Exception as e:
        print(f"⚠️ Qdrant payload update error: {e}")
        raise HTTPException(status_code=500, detail="Vector database sync failed.")

    return {"file_hash": file_hash, "is_active": new_status, "status": "updated in Qdrant"}