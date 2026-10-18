from fastapi import FastAPI, Depends, Request
from pydantic import BaseModel
import uuid

# Import the new Agentic chat service
from app.services.chat_services import process_chat_message

app = FastAPI()

class ChatPayload(BaseModel):
    message: str

# Mock JWT Dependency (Replace with your actual ASP.NET JWT interception)
async def extract_user_context(request: Request):
    """
    Extracts role and ID from the intercepted ASP.NET JWT token.
    For local dev, we are mocking the payload.
    """
    # In production: parse request.headers.get("Authorization")
    return {
        "role": "employee", 
        "emp_id": "104",    # Example employee ID to test Postgres lookup
        "session_id": request.headers.get("X-Session-ID", str(uuid.uuid4()))
    }

@app.post("/api/chat")
async def chat_handler(payload: ChatPayload, user_context: dict = Depends(extract_user_context)):
    """
    The main endpoint called by your React frontend.
    """
    user_role = user_context.get("role")
    employee_id = user_context.get("emp_id")
    session_id = user_context.get("session_id")
    
    # Run the query through the Agentic RAG pipeline
    reply_text = await process_chat_message(
        user_message=payload.message,
        user_role=user_role,
        employee_id=employee_id,
        session_id=session_id
    )
    
    return {"reply": reply_text}