# 1. Load AWS credentials BEFORE importing any other modules
from dotenv import load_dotenv
load_dotenv()  

# 2. Safe to import all other modules now
from fastapi import FastAPI, Depends, Request, UploadFile, File, Form
from pydantic import BaseModel
import uuid
from fastapi.middleware.cors import CORSMiddleware
from app.services.chat_services import process_chat_message
import fitz  # PyMuPDF

# --- NEW IMPORTS FOR QDRANT UPLOAD ---
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.documents import Document
from app.services.tools import qdrant_client, embeddings
from langchain_qdrant import QdrantVectorStore
from qdrant_client.models import Distance, VectorParams

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
async def chat_handler(payload: ChatPayload, request: Request, user_context: dict = Depends(extract_user_context)):
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
    category: str = Form("General")
):
    """
    Handles file uploads, extracts text, chunks it, and saves to Qdrant.
    """
    contents = await file.read()
    
    doc = fitz.open(stream=contents, filetype="pdf")
    extracted_text = ""
    for page in doc:
        extracted_text += page.get_text()
        
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=1000, 
        chunk_overlap=200
    )
    chunks = text_splitter.split_text(extracted_text)
    
    documents = [
        Document(
            page_content=chunk, 
            metadata={"source": file.filename, "category": category}
        ) 
        for chunk in chunks
    ]
    
    collection_name = "rag_documents"

    # Check if collection exists; if not, auto-create it
    if not qdrant_client.collection_exists(collection_name):
        sample_embedding = embeddings.embed_query("test dimension size")
        qdrant_client.create_collection(
            collection_name=collection_name,
            vectors_config=VectorParams(
                size=len(sample_embedding), 
                distance=Distance.COSINE
            ),
        )

    # Reuse the global client to insert documents
    vector_store = QdrantVectorStore(
        client=qdrant_client,
        collection_name=collection_name, 
        embedding=embeddings
    )
    vector_store.add_documents(documents)
    return {
        "filename": file.filename,
        "category": category,
        "status": "success",
        "characters_extracted": len(extracted_text),
        "chunks_added": len(documents)
    }