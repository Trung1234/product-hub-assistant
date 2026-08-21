"""
SUPABASE POSTGRESQL NATIVE CHECKPOINTER FOR LANGGRAPH / DEEP AGENTS
Enables persistent state, thread checkpointing, and subagent state recovery
directly in Supabase Cloud PostgreSQL database.
"""

import os
import logging
from typing import Optional
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger("SupabaseCheckpointer")

def get_supabase_postgres_checkpointer():
    """
    Returns a configured PostgresSaver or AsyncPostgresSaver connecting directly
    to Supabase Cloud PostgreSQL for persistent LangGraph thread storage.
    """
    # Connection string format: postgresql://postgres:[password]@db.[project-id].supabase.co:5432/postgres
    db_url = os.getenv("SUPABASE_DB_URL") or os.getenv("DATABASE_URL")
    
    if not db_url:
        logger.info("[Checkpointer] No SUPABASE_DB_URL configured. Using InMemory checkpointer fallback.")
        from langgraph.checkpoint.memory import MemorySaver
        return MemorySaver()

    try:
        from langgraph.checkpoint.postgres import PostgresSaver
        from psycopg_pool import ConnectionPool
        
        # Connect to Supabase PostgreSQL Pool
        pool = ConnectionPool(conninfo=db_url, max_size=10, timeout=30)
        checkpointer = PostgresSaver(pool)
        
        # Setup tables in Supabase (creates checkpoints, checkpoint_blobs, checkpoint_writes)
        checkpointer.setup()
        logger.info("[Checkpointer] Connected successfully to Supabase PostgreSQL Checkpointer!")
        return checkpointer

    except Exception as e:
        logger.warning(f"[Checkpointer] Failed to initialize Supabase Postgres checkpointer: {e}. Falling back to MemorySaver.")
        from langgraph.checkpoint.memory import MemorySaver
        return MemorySaver()
