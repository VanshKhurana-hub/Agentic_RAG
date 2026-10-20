from query_engine import app_graph
from langchain_core.messages import HumanMessage

async def process_chat_message(message: str, session_id: str, active_documents: list = None):
    """
    Passes the user's message into the LangGraph state machine workflow with PostgreSQL thread memory.
    """
    initial_state = {"messages": [HumanMessage(content=message)]}
    
    # Required by PostgresSaver to identify the conversation thread
    config = {"configurable": {"thread_id": session_id}}
    
    result = app_graph.invoke(initial_state, config=config)
    
    # Extract the final message response text
    final_message = result["messages"][-1]
    content = final_message.content
    
    if isinstance(content, list):
        text_content = "".join([item.get("text", "") for item in content if isinstance(item, dict)])
    elif isinstance(content, dict):
        text_content = content.get("text", str(content))
    else:
        text_content = str(content)
        
    return text_content