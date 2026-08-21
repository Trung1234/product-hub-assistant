from langchain_openai import ChatOpenAI
from deepagents import create_deep_agent

from src.config import OPENAI_API_KEY, OPENAI_API_BASE, MODEL_NAME
from src.tools.market_tools import (
    fetch_etsy_market_data,
    fetch_amazon_market_data
)
from src.tools.scoring_tools import evaluate_5d_opportunity_score
from src.tools.dataset_tools import (
    record_product_opportunity_matrix,
    retrieve_offloaded_product_context,
    extract_ai_insights_from_opportunity_matrix
)
from src.tools.skill_tools import (
    consult_ecommerce_skill,
    list_available_ecommerce_skills
)
from src.tools.human_tools import ask_user_clarification
from src.subagents.subagents_config import SUBAGENTS_CONFIG
from src.prompts import ORCHESTRATOR_SYSTEM_PROMPT

# Configure LLM using Vilao AI API parameters
llm = ChatOpenAI(
    model=MODEL_NAME,
    openai_api_key=OPENAI_API_KEY,
    openai_api_base=OPENAI_API_BASE,
    temperature=0.1
)

# Granular Specialized Tools with Human-in-the-loop Capability
orchestrator_tools = [
    ask_user_clarification,
    fetch_etsy_market_data,
    fetch_amazon_market_data,
    evaluate_5d_opportunity_score,
    record_product_opportunity_matrix,
    retrieve_offloaded_product_context,
    extract_ai_insights_from_opportunity_matrix,
    consult_ecommerce_skill,
    list_available_ecommerce_skills
]

# Instantiate DeepAgent with Human-in-the-Loop interrupts (https://docs.langchain.com/oss/python/deepagents/human-in-the-loop)
graph = create_deep_agent(
    model=llm,
    tools=orchestrator_tools,
    subagents=SUBAGENTS_CONFIG,
    system_prompt=ORCHESTRATOR_SYSTEM_PROMPT,
    interrupt_on={
        "record_product_opportunity_matrix": {
            "allowed_decisions": ["approve", "edit", "reject"],
            "description": "Please review the calculated 23-column Product Opportunity Matrix row and strategic parameters before officially committing to the Printway R&D CSV database."
        }
    }
)

if __name__ == "__main__":
    print(f"Printway Product Opportunity Hub Graph with Human-in-the-Loop ({len(orchestrator_tools)} Tools) initialized!")
