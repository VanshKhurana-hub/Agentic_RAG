import os
import redis
from llama_index.core.memory import ChatMemoryBuffer
from query_engine import build_hrms_agent

# Assuming you have a helper for Presidio (e.g., presidio_analyzer and presidio_anonymizer)
# If your presidio logic is in another file, import it here.
from services.presidio_helper import mask_pii, unmask_pii 

# Initialize Upstash Redis client
# (Ensure your REDIS_URL is in your .env file)
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
USE_CACHE = os.getenv("USE_CACHE", "False").lower() == "true"

try:
    redis_client = redis.Redis.from_url(REDIS_URL)
except Exception as e:
    print(f"Redis connection warning: {e}")
    redis_client = None


async def process_chat_message(user_message: str, user_role: str, employee_id: str, session_id: str) -> str:
    """
    Coordinates the 6-layer architecture: PII Masking -> Memory -> Agent -> Guardrail -> Unmasking
    """
    
    # LAYER 2: Offline PII Masking (Presidio)
    # Mask sensitive data before it ever hits Bedrock or the Agent
    masked_input, pii_mapping = mask_pii(user_message)
    
    # LAYER 4/5: Session Memory (Upstash Redis)
    memory = None
    if USE_CACHE and redis_client:
        memory = ChatMemoryBuffer.from_defaults(
            token_limit=1500,
            chat_store=redis_client,
            chat_store_key=f"session_{session_id}"
        )
    else:
        # Fallback to local memory if cache is toggled OFF
        memory = ChatMemoryBuffer.from_defaults(token_limit=1500)

    # LAYER 3: Orchestration (Initialize ReAct Agent)
    agent = build_hrms_agent(
        user_role=user_role, 
        employee_id=employee_id, 
        memory=memory
    )
    
    # Execute the ReAct Agent asynchronously
    try:
        agent_response = await agent.achat(masked_input)
        reply_text = str(agent_response.response).strip()
    except Exception as e:
        print(f"Agent Execution Error: {e}")
        reply_text = ""

    # LAYER 6: Fallback Guardrail for empty strings
    # Catches Bedrock Nova Micro empty responses or agent crashes
    if not reply_text:
        reply_text = "I apologize, but I could not process your request with the available information."

    # Final Step: Unmask PII before sending back to the user
    # (Restores names/IDs that were masked in Layer 2)
    final_output = unmask_pii(reply_text, pii_mapping)
    
    return final_output