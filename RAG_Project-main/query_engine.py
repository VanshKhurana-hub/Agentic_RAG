import os
from typing import TypedDict, Annotated, Sequence
from langchain_core.messages import BaseMessage
from langgraph.graph import StateGraph, END
from langgraph.prebuilt import ToolNode, tools_condition
from langchain_aws import ChatBedrock
from app.services.tools import get_hrms_tools

# 1. Import PostgresSaver, ConnectionPool, and dotenv
from langgraph.checkpoint.postgres import PostgresSaver
from psycopg_pool import ConnectionPool
from dotenv import load_dotenv

load_dotenv()  # Loads environment variables from your .env file

class AgentState(TypedDict):
    messages: Annotated[Sequence[BaseMessage], lambda a, b: a + b]

llm = ChatBedrock(
    model_id="amazon.nova-micro-v1:0",
    region_name="us-east-1",
    model_kwargs={"temperature": 0.3}
)

tools = get_hrms_tools()
llm_with_tools = llm.bind_tools(tools)

def call_model(state: AgentState):
    messages = state["messages"]
    response = llm_with_tools.invoke(messages)
    return {"messages": [response]}

workflow = StateGraph(AgentState)
workflow.add_node("agent", call_model)
workflow.add_node("tools", ToolNode(tools))

workflow.set_entry_point("agent")
workflow.add_conditional_edges("agent", tools_condition)
workflow.add_edge("tools", "agent")

# 2. Setup PostgreSQL connection pool safely with autocommit enabled
DB_URI = os.getenv(
    "DATABASE_URL", 
    "postgresql://postgres:password@localhost:5432/hrms_db"
)

try:
    connection_pool = ConnectionPool(
        conninfo=DB_URI, 
        max_size=10, 
        kwargs={"autocommit": True}
    )
    memory = PostgresSaver(connection_pool)
    memory.setup()  # Auto-creates tables and concurrent indices cleanly
    app_graph = workflow.compile(checkpointer=memory)
    print("✅ Successfully connected to PostgreSQL checkpointing!")

except Exception as e:
    print(f"❌ PostgreSQL Connection Failed: {e}")
    print("🔄 Falling back to standard in-memory saver...")
    from langgraph.checkpoint.memory import MemorySaver
    memory = MemorySaver()
    app_graph = workflow.compile(checkpointer=memory)