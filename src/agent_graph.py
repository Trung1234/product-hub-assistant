from langchain_openai import ChatOpenAI
from langgraph.prebuilt import create_react_agent

from src.config import (
    OPENAI_API_KEY,
    OPENAI_API_BASE,
    MODEL_NAME,
    FALLBACK_OPENAI_API_KEY,
    FALLBACK_OPENAI_API_BASE,
    FALLBACK_MODEL_NAME
)
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
from src.tools.report_tools import generate_product_opportunity_pdf_report
from src.tools.human_tools import ask_user_clarification
from src.tools.email_tools import (
    send_market_report_to_email,
    schedule_prompt_research_to_email
)
from src.prompts import ORCHESTRATOR_SYSTEM_PROMPT

# Primary LLM (e.g. 9Router cx/gpt-5.5)
primary_llm = ChatOpenAI(
    model=MODEL_NAME,
    openai_api_key=OPENAI_API_KEY,
    openai_api_base=OPENAI_API_BASE,
    temperature=0.0
)

# Secondary Ultra-Fast Fallback (9Router cx/gpt-5.4-mini - uses same verified credentials)
secondary_llm = ChatOpenAI(
    model="cx/gpt-5.4-mini",
    openai_api_key=OPENAI_API_KEY,
    openai_api_base=OPENAI_API_BASE,
    temperature=0.0
)

fallbacks = [secondary_llm]

# Tertiary Fallback LLM (Vilao AI occ/claude-sonnet-4-6 if distinct API key configured)
if FALLBACK_OPENAI_API_KEY and FALLBACK_OPENAI_API_KEY != OPENAI_API_KEY:
    vilao_llm = ChatOpenAI(
        model=FALLBACK_MODEL_NAME,
        openai_api_key=FALLBACK_OPENAI_API_KEY,
        openai_api_base=FALLBACK_OPENAI_API_BASE,
        temperature=0.0
    )
    fallbacks.append(vilao_llm)

# Active LLM with multi-tier automatic failover
llm = primary_llm.with_fallbacks(fallbacks)

# Granular Specialized Tools with 5-Source Market Data, Skills, PDF & Resend Email Delivery
orchestrator_tools = [
    ask_user_clarification,
    fetch_etsy_market_data,
    fetch_amazon_market_data,
    fetch_google_trends_data,
    fetch_pinterest_trend_signals,
    fetch_trending_product_design_samples,
    evaluate_5d_opportunity_score,
    record_product_opportunity_matrix,
    generate_product_opportunity_pdf_report,
    send_market_report_to_email,
    schedule_prompt_research_to_email,
    retrieve_offloaded_product_context,
    extract_ai_insights_from_opportunity_matrix,
    consult_ecommerce_skill,
    list_available_ecommerce_skills
]

from src.db.supabase_checkpointer import get_supabase_postgres_checkpointer

# Instantiate PRINTWAY NEXUS Agent with strict R&D System Prompt & Domain Tools
# Note: LangGraph API server natively provides persistence and thread state management.
graph = create_react_agent(
    model=llm,
    tools=orchestrator_tools,
    prompt=ORCHESTRATOR_SYSTEM_PROMPT
)

if __name__ == "__main__":
    print(f"PRINTWAY NEXUS — Chief R&D & Market Opportunity Strategist Graph ({len(orchestrator_tools)} Tools) initialized!")
