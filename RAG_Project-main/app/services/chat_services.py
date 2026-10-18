from query_engine import app_graph
from langchain_core.messages import HumanMessage

async def process_chat_message(message: str, session_id: str, active_documents: list = None):
    initial_state = {"messages": [HumanMessage(content=message)]}
    result = app_graph.invoke(initial_state)
    
    final_message = result["messages"][-1]
    
    # Safely extract text content regardless of whether it's a string or object/dict
    content = final_message.content
    if isinstance(content, list):
        # Handle cases where content is structured as a list of blocks
        text_content = "".join([item.get("text", "") for item in content if isinstance(item, dict)])
    elif isinstance(content, dict):
        text_content = content.get("text", str(content))
    else:
        text_content = str(content)
        
    return {"reply": text_content, "sources": []}