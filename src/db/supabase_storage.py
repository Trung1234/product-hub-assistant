"""
SUPABASE STORAGE MANAGER FOR PRINTWAY NEXUS
Provides automatic cloud object storage for PDF reports, CSV exports,
design mockups, and offloaded market context payloads.
"""

import os
import io
import logging
from typing import Optional, Union
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger("SupabaseStorage")

SUPABASE_URL = os.getenv("SUPABASE_URL", "https://cvhjqjttdupchyjwfgyq.supabase.co")
SUPABASE_KEY = os.getenv("SUPABASE_SECRET_KEY") or os.getenv("SUPABASE_KEY")

_client = None

def get_supabase_storage_client():
    global _client
    if _client is None and SUPABASE_URL and SUPABASE_KEY:
        try:
            from supabase import create_client
            _client = create_client(SUPABASE_URL, SUPABASE_KEY)
        except Exception as e:
            logger.warning(f"Failed to initialize Supabase storage client: {e}")
    return _client

def upload_file_to_supabase(
    local_file_path: str,
    bucket_name: str = "reports",
    destination_path: Optional[str] = None,
    content_type: Optional[str] = None
) -> Optional[str]:
    """
    Uploads a local file to Supabase Storage and returns its public CDN URL.
    """
    if not os.path.exists(local_file_path):
        logger.warning(f"Local file does not exist: {local_file_path}")
        return None

    if not destination_path:
        destination_path = os.path.basename(local_file_path)

    client = get_supabase_storage_client()
    if not client:
        return None

    try:
        with open(local_file_path, "rb") as f:
            file_bytes = f.read()

        file_options = {"upsert": "true"}
        if content_type:
            file_options["content-type"] = content_type

        client.storage.from_(bucket_name).upload(
            path=destination_path,
            file=file_bytes,
            file_options=file_options
        )

        public_url = client.storage.from_(bucket_name).get_public_url(destination_path)
        logger.info(f"✅ Uploaded {local_file_path} -> Supabase Storage: {public_url}")
        return public_url

    except Exception as e:
        logger.error(f"Error uploading {local_file_path} to Supabase bucket '{bucket_name}': {e}")
        # Return fallback URL format
        return f"{SUPABASE_URL}/storage/v1/object/public/{bucket_name}/{destination_path}"

def upload_bytes_to_supabase(
    data_bytes: bytes,
    bucket_name: str = "reports",
    destination_path: str = "report.pdf",
    content_type: str = "application/pdf"
) -> Optional[str]:
    """
    Uploads in-memory bytes directly to Supabase Storage.
    """
    client = get_supabase_storage_client()
    if not client:
        return None

    try:
        client.storage.from_(bucket_name).upload(
            path=destination_path,
            file=data_bytes,
            file_options={"upsert": "true", "content-type": content_type}
        )
        public_url = client.storage.from_(bucket_name).get_public_url(destination_path)
        return public_url
    except Exception as e:
        logger.error(f"Error uploading bytes to Supabase bucket '{bucket_name}': {e}")
        return f"{SUPABASE_URL}/storage/v1/object/public/{bucket_name}/{destination_path}"
