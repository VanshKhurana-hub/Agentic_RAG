import os
from llama_index.core.agent import ReActAgent
from llama_index.llms.bedrock import Bedrock
from app.services.tools import get_hrms_tools

# The system prompt is now generalized for an independent HRMS assistant
AGENT_SYSTEM_PROMPT = """You are an intelligent HRMS AI assistant.
You have access to tools for searching HR policy documents and checking employee database records.

Follow these strict rules:
1. If the user asks about general policies, rules, or guidelines, use the 'search_policy_documents' tool.
2. If the user asks about their personal leave balance, use the 'get_employee_leave_balance' tool.
3. If the user greets you (e.g., "hello", "hi"), respond directly without using any tools.
4. If a tool returns no data or an error, tell the user the information is unavailable. DO NOT make up data.
"""

def build_hrms_agent(user_role: str, employee_id: str, memory=None):
    """
    Constructs the ReAct Agent orchestrator using Bedrock Nova Micro.
    Binds the user's secure context (role and ID) directly into the tool executions.
    """
    
    # Initialize Amazon Bedrock Nova Micro
    # Temperature 0.0 is critical for reliable JSON tool-calling
    llm = Bedrock(
        model="amazon.nova-micro-v1:0",
        temperature=0.0,
        region_name=os.getenv("AWS_REGION", "us-east-1"),
    )
    
    # Fetch the dynamically bound tools from your new tools.py file
    tools = get_hrms_tools(user_role=user_role, employee_id=employee_id)
    
    # Instantiate the ReAct Agent
    agent = ReActAgent.from_tools(
        tools=tools,
        llm=llm,
        verbose=True,           # Keep this True for local dev to watch the agent "think" in the terminal
        system_prompt=AGENT_SYSTEM_PROMPT,
        max_iterations=4,       # Safety guardrail to prevent infinite tool-calling loops
        memory=memory           # Hooks into Upstash Redis via chat_services.py
    )
    
    return agent