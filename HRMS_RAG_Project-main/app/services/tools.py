# app/services/tools.py
from langchain_core.tools import tool
from langchain_aws import BedrockEmbeddings
from langchain_qdrant import QdrantVectorStore
from qdrant_client import QdrantClient

# Initialize your Qdrant client (Defaults to local Docker instance)
qdrant_client = QdrantClient(path="qdrant_local_db")

# Initialize your AWS embedding model (Update region/model_id if needed)
embeddings = BedrockEmbeddings(
    model_id="amazon.titan-embed-text-v2:0", 
    region_name="us-east-1"
)
    
@tool
def search_policy_documents(query: str) -> str:
    """
    Search general Uploaded documents in the Qdrant database and answer accordingly.
    Use this when the user asks about company rules, benefits, or policies.
    """
    try:
        # Changed collection_name to match main.py
        vector_store = QdrantVectorStore(  
            client=qdrant_client, 
            collection_name="rag_documents", 
            embedding=embeddings           
        )

        # Perform similarity search (fetch the top 3 most relevant chunks)
        results = vector_store.similarity_search(query, k=3)
        
        if not results:
            return "I could not find any relevant information in the uploaded documents."
            
        # Combine the retrieved text chunks into a single readable context string
        context = "\n\n---\n\n".join([doc.page_content for doc in results])
        
        return f"Found the following information in the uploaded documents:\n{context}"
        
    except Exception as e:
        return f"Error retrieving documents from the database: {str(e)}"

@tool
def get_employee_leave_balance(employee_id: str) -> str:
    """
    Check the personal leave balance and time-off records for a specific employee.
    Use this when an employee asks about how many leaves they have left.
    """
    # Your PostgreSQL database lookup logic goes here
    return f"Employee {employee_id} has 12 casual leaves and 8 sick leaves remaining."

# Central list of tools — to add a new tool later, just write it above and add it here!
def get_hrms_tools():
    return [search_policy_documents, get_employee_leave_balance]