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
import fitz  # PyMuPDF

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
    """
    Reads binary content, calculates a SHA-256 hash to prevent duplicate uploads,
    chunks text, indexes into Qdrant with metadata, and records in PostgreSQL.
    """
    contents = await file.read()
    
    # 1. Compute SHA-256 hash for document deduplication
    file_hash = hashlib.sha256(contents).hexdigest()

    # 2. Check for existing duplicate upload in PostgreSQL
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

    # 3. Extract text from PDF
    doc = fitz.open(stream=contents, filetype="pdf")
    extracted_text = "".join([page.get_text() for page in doc])
        
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=1000, 
        chunk_overlap=200
    )
    chunks = text_splitter.split_text(extracted_text)
    
    # 4. Attach unique file_hash and initial is_active status to chunk metadata
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

    # 5. Check if Qdrant collection exists; auto-create if missing
    if not qdrant_client.collection_exists(collection_name):
        sample_embedding = embeddings.embed_query("test dimension size")
        qdrant_client.create_collection(
            collection_name=collection_name,
            vectors_config=VectorParams(
                size=len(sample_embedding), 
                distance=Distance.COSINE
            ),
        )

    # 6. Save document vectors to Qdrant
    vector_store = QdrantVectorStore(
        client=qdrant_client,
        collection_name=collection_name, 
        embedding=embeddings
    )
    vector_store.add_documents(documents)

    # 7. Record document entry in PostgreSQL
    try:
        cur.execute(
            """
            INSERT INTO documents (file_hash, filename, category, uploaded_by, is_active)
            VALUES (%s, %s, %s, %s, TRUE);
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
    Returns list of all uploaded documents and their current active status.
    """
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute(
            """
            SELECT id, file_hash, filename, category, uploaded_by, uploaded_at, is_active 
            FROM documents 
            ORDER BY uploaded_at DESC;
            """
        )
        rows = cur.fetchall()
        cur.close()
        conn.close()
        
        return [
            {
                "id": r[0],
                "hash": r[1],
                "name": r[2],
                "category": r[3],
                "uploaded_by": r[4],
                "uploaded_at": r[5].isoformat() if r[5] else None,
                "is_active": r[6]
            }
            for r in rows
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.patch("/api/documents/{file_hash}/status")
async def update_document_status(file_hash: str, payload: dict):
    """
    Toggles document active status in PostgreSQL and synchronizes Qdrant vector payload.
    """
    new_status = payload.get("is_active", True)
    
    # 1. Update status in PostgreSQL
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("UPDATE documents SET is_active = %s WHERE file_hash = %s;", (new_status, file_hash))
        conn.commit()
        cur.close()
        conn.close()
    except Exception as e:
        print(f"⚠️ Postgres status update error: {e}")

    # 2. Update status in Qdrant metadata payload using file_hash filter
    try:
        qdrant_client.set_payload(
            collection_name="rag_documents",
            payload={"metadata": {"is_active": new_status}},
            points=Filter(
                must=[
                    FieldCondition(
                        key="metadata.file_hash",
                        match=MatchValue(value=file_hash)
                    )
                ]
            )
        )
    except Exception as e:
        print(f"⚠️ Qdrant payload update error: {e}")

    return {"file_hash": file_hash, "is_active": new_status, "status": "updated"}