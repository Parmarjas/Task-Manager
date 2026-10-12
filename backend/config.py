import os
import socket
from dotenv import load_dotenv

# Force IPv4 socket resolution globally to eliminate Windows IPv6 42-second timeout on Cloudflare/Supabase
_orig_getaddrinfo = socket.getaddrinfo

def _ipv4_getaddrinfo(host, port, family=0, type=0, proto=0, flags=0):
    if family == 0 or family == socket.AF_UNSPEC:
        family = socket.AF_INET
    return _orig_getaddrinfo(host, port, family, type, proto, flags)

socket.getaddrinfo = _ipv4_getaddrinfo

# Load environment variables from .env file
load_dotenv()

def _clean(val: str) -> str:
    """Ignore template placeholder strings."""
    if not val or "your-" in val or "placeholder" in val:
        return ""
    return val.strip()

class Config:
    """
    Centralized application configuration.
    Extracts environment variables with sensible defaults for local development.
    """
    PORT = int(os.getenv("PORT", 5000))
    FLASK_ENV = os.getenv("FLASK_ENV", "development")
    DEBUG = FLASK_ENV == "development"
    FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")

    # Supabase credentials (cleaned of placeholders)
    SUPABASE_URL = _clean(os.getenv("SUPABASE_URL", ""))
    SUPABASE_SERVICE_ROLE_KEY = _clean(os.getenv("SUPABASE_SERVICE_ROLE_KEY", ""))
    SUPABASE_ANON_KEY = _clean(os.getenv("SUPABASE_ANON_KEY", ""))
    SUPABASE_JWT_SECRET = _clean(os.getenv("SUPABASE_JWT_SECRET", ""))

    # Gmail SMTP credentials
    GMAIL_USER = _clean(os.getenv("GMAIL_USER", ""))
    GMAIL_APP_PASSWORD = _clean(os.getenv("GMAIL_APP_PASSWORD", "")).replace(" ", "")
    SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
    SMTP_PORT = int(os.getenv("SMTP_PORT", 587))
