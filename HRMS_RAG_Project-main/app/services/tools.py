from llama_index.core.tools import FunctionTool
from llama_index.embeddings.huggingface import HuggingFaceEmbedding
from qdrant_client import QdrantClient
import psycopg2
import os

# Initialize Qdrant Client pointing to your local storage directory
qdrant_client = QdrantClient(path="./qdrant_storage")

# Initialize your HuggingFace embedding model (matching your stack)
embed_model = HuggingFaceEmbedding(model_name="BAAI/bge-small-en-v1.5")


def search_policy_documents(query: str, user_role: str) -> str:
    """Searches company policy PDFs, handbooks, and compliance rules in Qdrant.
    Use this for policy, procedure, or leave guideline questions.
    """
    try:
        # Generate embedding vector for the user query
        query_vector = embed_model.get_text_embedding(query)
        
        # Native Qdrant search with dynamic RBAC metadata filter
        search_filter = {
            "must": [
                {"key": "allowed_roles", "match": {"value": user_role}},
                {"key": "is_active", "match": {"value": True}}
            ]
        }
        
        results = qdrant_client.search(
            collection_name="hrms_docs",
            query_vector=query_vector,
            query_filter=search_filter,
            limit=3
        )
        
        if not results:
            return "No policy documents found matching your permission level."
            
        formatted_chunks = [res.payload.get("text", "") for res in results]
        return "\n\n".join(formatted_chunks)
        
    except Exception as e:
        return f"Error searching policy documents: {str(e)}"


def get_employee_leave_balance(employee_id: str) -> str:
    """Queries PostgreSQL for the employee's live leave balances (casual, sick, earned).
    Use this when the user asks for their specific remaining leaves or balance.
    """
    try:
        # Connect to PostgreSQL database
        conn = psycopg2.connect(
            dbname=os.getenv("DB_NAME", "hrms_db"),
            user=os.getenv("DB_USER", "postgres"),
            password=os.getenv("DB_PASSWORD", "password"),
            host=os.getenv("DB_HOST", "localhost"),
            port=os.getenv("DB_PORT", "5432")
        )
        cursor = conn.cursor()
        
        cursor.execute(
            "SELECT casual_leave, sick_leave, earned_leave FROM employee_leaves WHERE emp_id = %s", 
            (employee_id,)
        )
        row = cursor.fetchone()
        cursor.close()
        conn.close()
        
        if not row:
            return "Employee record not found in the database."
            
        return f"Casual Leave Balance: {row[0]}, Sick Leave Balance: {row[1]}, Earned Leave Balance: {row[2]}"
        
    except Exception as e:
        return f"Error retrieving leave balance from database: {str(e)}"


def get_hrms_tools(user_role: str, employee_id: str):
    """Wraps core functions into LlamaIndex FunctionTools with bound context parameters."""
    
    policy_tool = FunctionTool.from_defaults(
        fn=lambda q: search_policy_documents(query=q, user_role=user_role),
        name="search_policy_documents",
        description="Search company policies, maternity rules, and leave guidelines stored in the vector database."
    )
    
    leave_tool = FunctionTool.from_defaults(
        fn=lambda: get_employee_leave_balance(employee_id=employee_id),
        name="get_employee_leave_balance",
        description="Fetch exact personal leave balances (casual, sick, earned) from the PostgreSQL database."
    )
    
    return [policy_tool, leave_tool]