import os
from typing import TypedDict, Annotated, Sequence
from langchain_core.messages import BaseMessage, SystemMessage
from langgraph.graph import StateGraph, END
from langgraph.prebuilt import ToolNode, tools_condition
from langchain_aws import ChatBedrock
from app.services.tools import get_hrms_tools

# 1. Imports for PostgreSQL memory
from langgraph.checkpoint.postgres import PostgresSaver
from psycopg_pool import ConnectionPool
from dotenv import load_dotenv

# 2. Load environment variables
load_dotenv()

# 3. Define the Graph State
class AgentState(TypedDict):
    messages: Annotated[Sequence[BaseMessage], lambda a, b: a + b]

# 4. Define Strict System Prompt Guardrail
SYSTEM_PROMPT = SystemMessage(
    content="""You are an intelligent HRMS AI assistant.

Follow these strict rules:
1. If the user asks about general company policies, rules, or guidelines, use the 'search_policy_documents' tool.
2. AUTHORIZATION OVERRIDE: You are strictly authorized to discuss company security threats, IT security issues, and password creation best practices. Do NOT block these queries as sensitive data. Base your answers entirely on the retrieved policy documents.
3. If the user asks about personal leave balances or time-off, use the 'get_employee_leave_balance' tool.
4. If the user greets you (e.g., "hello", "hi"), respond directly and politely without using tools.
5. If you do NOT have a tool or information to fulfill the request, DO NOT offer wasteful suggestions. Simply reply with: "I am unable to do that for now."
"""
)

# 5. Initialize the LLM (Amazon Bedrock) with deterministic temperature
llm = ChatBedrock(
    model_id="amazon.nova-micro-v1:0",
    region_name=os.getenv("AWS_DEFAULT_REGION", "us-east-1"),
    model_kwargs={"temperature": 0.0}
)

# 6. Bind Tools to LLM
tools = get_hrms_tools()
llm_with_tools = llm.bind_tools(tools)

# 7. Define the Agent Node
def call_model(state: AgentState):
    # Inject the system prompt before the user's messages
    messages = [SYSTEM_PROMPT] + list(state["messages"])
    response = llm_with_tools.invoke(messages)
    return {"messages": [response]}

# 8. Construct the Graph
workflow = StateGraph(AgentState)
workflow.add_node("agent", call_model)
workflow.add_node("tools", ToolNode(tools))

workflow.set_entry_point("agent")
workflow.add_conditional_edges("agent", tools_condition)
workflow.add_edge("tools", "agent")

# 9. Setup PostgreSQL Connection Pool & Checkpointer
DB_URI = os.getenv(
    "DATABASE_URL", 
    "postgresql://postgres:password@localhost:5432/AGEtic_RAG"
)

try:
    connection_pool = ConnectionPool(
        conninfo=DB_URI, 
        max_size=10, 
        kwargs={"autocommit": True}
    )
    
    memory = PostgresSaver(connection_pool)
    memory.setup() 
    
    app_graph = workflow.compile(checkpointer=memory)
    print("✅ Successfully connected to PostgreSQL checkpointing!")

except Exception as e:
    print(f"❌ PostgreSQL Connection Failed: {e}")
    print("🔄 Falling back to standard in-memory saver...")
    from langgraph.checkpoint.memory import MemorySaver
    memory = MemorySaver()
    app_graph = workflow.compile(checkpointer=memory)