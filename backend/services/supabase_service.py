"""
Supabase Database Service Layer
-------------------------------
Encapsulates all direct database queries to Supabase.
Features caching on profiles to prevent repetitive heavy lookups.
"""

from supabase import create_client, Client
from config import Config
import logging
import time

logger = logging.getLogger(__name__)

# Initialize client if configuration is present
supabase_client: Client = None
if Config.SUPABASE_URL and (Config.SUPABASE_SERVICE_ROLE_KEY or Config.SUPABASE_ANON_KEY):
    key = Config.SUPABASE_SERVICE_ROLE_KEY or Config.SUPABASE_ANON_KEY
    supabase_client = create_client(Config.SUPABASE_URL, key)
else:
    logger.warning("Supabase credentials not fully configured.")


def get_client() -> Client:
    """Return initialized Supabase client or raise configuration error."""
    global supabase_client
    if not supabase_client and Config.SUPABASE_URL and (Config.SUPABASE_SERVICE_ROLE_KEY or Config.SUPABASE_ANON_KEY):
        key = Config.SUPABASE_SERVICE_ROLE_KEY or Config.SUPABASE_ANON_KEY
        supabase_client = create_client(Config.SUPABASE_URL, key)

    if not supabase_client:
        raise ValueError("Supabase client is not initialized. Please verify .env")
    return supabase_client


# -----------------------------------------------------------------------------
# PROFILE OPERATIONS & CACHE
# -----------------------------------------------------------------------------
_PROFILES_CACHE = None
_PROFILES_CACHE_TIMESTAMP = 0


def get_profile_by_id(user_id: str):
    """Retrieve profile by user ID."""
    try:
        client = get_client()
        res = client.table("profiles").select("*").eq("id", user_id).execute()
        return res.data[0] if res.data else None
    except Exception as e:
        logger.warning(f"Error fetching profile by id: {e}")
        return None


def get_profile_by_email(email: str):
    """Retrieve profile by email address."""
    try:
        client = get_client()
        res = client.table("profiles").select("*").eq("email", email).execute()
        return res.data[0] if res.data else None
    except Exception as e:
        logger.warning(f"Error fetching profile by email: {e}")
        return None


def list_all_profiles():
    """Retrieve all users in the system (cached for 60 seconds)."""
    global _PROFILES_CACHE, _PROFILES_CACHE_TIMESTAMP
    now = time.time()
    if _PROFILES_CACHE is not None and (now - _PROFILES_CACHE_TIMESTAMP < 60):
        return _PROFILES_CACHE

    try:
        client = get_client()
        res = client.table("profiles").select("id, email, full_name, avatar_url").order("full_name").execute()
        _PROFILES_CACHE = res.data or []
        _PROFILES_CACHE_TIMESTAMP = now
        return _PROFILES_CACHE
    except Exception as e:
        logger.error(f"Error fetching profiles list: {e}")
        return _PROFILES_CACHE or []


def upsert_profile(profile_data: dict):
    """Sync or update user profile after OAuth authentication."""
    try:
        client = get_client()
        res = client.table("profiles").upsert(profile_data).execute()
        # Invalidate cache so new user appears
        global _PROFILES_CACHE_TIMESTAMP
        _PROFILES_CACHE_TIMESTAMP = 0
        return res.data[0] if res.data else None
    except Exception as e:
        logger.warning(f"Profile upsert note: {e}")
        return None


# -----------------------------------------------------------------------------
# TASK OPERATIONS
# -----------------------------------------------------------------------------

def create_task_in_db(task_data: dict):
    """Insert a new task into the database."""
    client = get_client()
    res = client.table("tasks").insert(task_data).execute()
    return res.data[0] if res.data else None


def get_tasks_for_user(user_id: str):
    """
    Fetch all tasks where the user is either the creator or the assignee.
    Joins creator and assignee profile information for frontend display.
    """
    client = get_client()
    res = (
        client.table("tasks")
        .select(
            """
            id,
            title,
            description,
            status,
            priority,
            created_by,
            assigned_to,
            due_date,
            completed_at,
            created_at,
            updated_at,
            creator:created_by (id, email, full_name, avatar_url),
            assignee:assigned_to (id, email, full_name, avatar_url)
            """
        )
        .or_(f"created_by.eq.{user_id},assigned_to.eq.{user_id}")
        .order("created_at", desc=True)
        .execute()
    )
    return res.data or []


def get_task_by_id(task_id: str):
    """Fetch a single task by ID."""
    client = get_client()
    res = (
        client.table("tasks")
        .select(
            """
            id,
            title,
            description,
            status,
            priority,
            created_by,
            assigned_to,
            due_date,
            completed_at,
            created_at,
            updated_at,
            creator:created_by (id, email, full_name, avatar_url),
            assignee:assigned_to (id, email, full_name, avatar_url)
            """
        )
        .eq("id", task_id)
        .execute()
    )
    return res.data[0] if res.data else None


def update_task_in_db(task_id: str, updates: dict):
    """Update fields of an existing task."""
    client = get_client()
    res = client.table("tasks").update(updates).eq("id", task_id).execute()
    return res.data[0] if res.data else None


def delete_task_from_db(task_id: str):
    """Delete a task by ID safely (idempotent)."""
    try:
        client = get_client()
        res = client.table("tasks").delete().eq("id", task_id).execute()
        return res.data or []
    except Exception as e:
        logger.warning(f"delete_task_from_db warning: {e}")
        return []
