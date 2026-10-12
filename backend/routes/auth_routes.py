"""
Authentication & User Profiles Routes
--------------------------------------
Endpoints for user session inspection and user discovery (for task assignment).
"""

from flask import Blueprint, jsonify, g
from services.auth_service import require_auth
from services.supabase_service import list_all_profiles, get_profile_by_id
import logging

logger = logging.getLogger(__name__)

auth_bp = Blueprint("auth_bp", __name__)


@auth_bp.route("/api/auth/me", methods=["GET"])
@require_auth
def get_current_user():
    """
    Returns the authenticated user's profile details.
    """
    user_id = g.current_user["id"]
    profile = get_profile_by_id(user_id)
    if not profile:
        # Fall back to payload info
        return jsonify({"user": g.current_user}), 200

    return jsonify({"user": profile}), 200


@auth_bp.route("/api/users", methods=["GET"])
@require_auth
def get_all_users():
    """
    Returns a list of all registered users in the system.
    This enables selecting teammates in the task assignment dropdown.
    """
    try:
        users = list_all_profiles()
        return jsonify({"users": users or []}), 200
    except Exception as e:
        logger.error(f"Failed to fetch users: {e}")
        return jsonify({"error": "Failed to retrieve user list"}), 500
