# app/services/tools.py
from langchain_core.tools import tool
from langchain_aws import BedrockEmbeddings
from langchain_qdrant import QdrantVectorStore
from qdrant_client import QdrantClient
from qdrant_client.models import Filter, FieldCondition, MatchValue

# Shared local Qdrant client
qdrant_client = QdrantClient(path="qdrant_local_db")

# AWS Bedrock Embedding model
embeddings = BedrockEmbeddings(
    model_id="amazon.titan-embed-text-v2:0", 
    region_name="us-east-1"
)
    
@tool
def search_policy_documents(query: str) -> str:
    """
    Search active uploaded documents in the Qdrant database and answer accordingly.
    Use this when the user asks about company rules, benefits, or policies.
    """
    try:
        # Check if collection exists first to prevent errors on an empty Qdrant instance
        if not qdrant_client.collection_exists("rag_documents"):
            return "I could not find any relevant information in the currently active documents."

        vector_store = QdrantVectorStore(  
            client=qdrant_client, 
            collection_name="rag_documents", 
            embedding=embeddings           
        )

        # Qdrant native vector filter: retrieve only vectors where metadata.is_active == True
        active_filter = Filter(
            must=[
                FieldCondition(
                    key="metadata.is_active",
                    match=MatchValue(value=True)
                )
            ]
        )
        print(f"\n--- DEBUG: Starting Vector Search ---")
        print(f"DEBUG: Query = {query}")

        # Perform similarity search filtering out inactive documents
        results = vector_store.similarity_search(query, k=3, filter=active_filter)

        
        print(f"DEBUG: Found {len(results)} matching chunks.")
        if not results:
            return "I could not find any relevant information in the currently active documents."
            
        context = "\n\n---\n\n".join([doc.page_content for doc in results])
        
        return f"Found the following information in the active uploaded documents:\n{context}"
        
    except Exception as e:
        return f"Error retrieving documents from the database: {str(e)}"

@tool
def get_employee_leave_balance(employee_id: str) -> str:
    """
    Check the personal leave balance and time-off records for a specific employee.
    Use this when an employee asks about how many leaves they have left.
    """
    return f"Employee {employee_id} has 12 casual leaves and 8 sick leaves remaining."

def get_hrms_tools():
    return [search_policy_documents, get_employee_leave_balance]