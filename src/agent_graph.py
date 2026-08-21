from langchain_openai import ChatOpenAI
from langgraph.prebuilt import create_react_agent

from src.config import OPENAI_API_KEY, OPENAI_API_BASE, MODEL_NAME
from src.tools.market_tools import (
    fetch_etsy_market_data,
    fetch_amazon_market_data,
    fetch_google_trends_data,
    fetch_pinterest_trend_signals,
    fetch_trending_product_design_samples
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
from src.prompts import ORCHESTRATOR_SYSTEM_PROMPT

# Configure LLM using Printway 9router API parameters
llm = ChatOpenAI(
    model=MODEL_NAME,
    openai_api_key=OPENAI_API_KEY,
    openai_api_base=OPENAI_API_BASE,
    temperature=0.1
)

# Granular Specialized Tools with 5-Source Market Data, Visual Gallery & Skills
orchestrator_tools = [
    ask_user_clarification,
    fetch_etsy_market_data,
    fetch_amazon_market_data,
    fetch_google_trends_data,
    fetch_pinterest_trend_signals,
    fetch_trending_product_design_samples,
    evaluate_5d_opportunity_score,
    record_product_opportunity_matrix,
    retrieve_offloaded_product_context,
    extract_ai_insights_from_opportunity_matrix,
    consult_ecommerce_skill,
    list_available_ecommerce_skills
]

# Instantiate PRINTWAY NEXUS Agent with strict R&D System Prompt & Domain Tools
graph = create_react_agent(
    model=llm,
    tools=orchestrator_tools,
    prompt=ORCHESTRATOR_SYSTEM_PROMPT
)

if __name__ == "__main__":
    print(f"PRINTWAY NEXUS — Chief R&D & Market Opportunity Strategist Graph ({len(orchestrator_tools)} Tools) initialized!")
