# query_engine.py
from typing import TypedDict, Annotated, Sequence
from langchain_core.messages import BaseMessage
from langgraph.graph import StateGraph, END
from langgraph.prebuilt import ToolNode, tools_condition
from langchain_aws import ChatBedrock

from app.services.tools import get_hrms_tools

import os
from dotenv import load_dotenv

load_dotenv()

# 1. Define the Agent State
class AgentState(TypedDict):
    messages: Annotated[Sequence[BaseMessage], lambda a, b: a + b]

# 2. Setup Bedrock LLM via LangChain
llm = ChatBedrock(
    model_id="amazon.nova-micro-v1:0",
    region_name="us-east-1",
    model_kwargs={"temperature": 0.0}
)

# 3. Load tools dynamically from your service registry
tools = get_hrms_tools()
llm_with_tools = llm.bind_tools(tools)

# 4. Define the Node Logic
def call_model(state: AgentState):
    messages = state["messages"]
    response = llm_with_tools.invoke(messages)
    return {"messages": [response]}

# 5. Setup the Graph Workflow
workflow = StateGraph(AgentState)
workflow.add_node("agent", call_model)
workflow.add_node("tools", ToolNode(tools))

workflow.set_entry_point("agent")
workflow.add_conditional_edges("agent", tools_condition)
workflow.add_edge("tools", "agent")

# Compile the graph application
app_graph = workflow.compile()