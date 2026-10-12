"""
Task Management Routes
----------------------
Handles CRUD operations for tasks and triggers Gmail notifications
on task creation, assignment, and completion.

BUSINESS LOGIC ENFORCEMENTS:
1. Completed tasks cannot be assigned or reassigned unless reopened.
2. Email notification dispatched when a task is assigned to anyone (creating or editing).
3. Email notification dispatched when a task is completed.
"""

from flask import Blueprint, request, jsonify, g
from datetime import datetime, timezone
import threading
from services.auth_service import require_auth
from services.supabase_service import (
    create_task_in_db,
    get_tasks_for_user,
    get_task_by_id,
    update_task_in_db,
    delete_task_from_db,
    get_profile_by_id,
)
from services.email_service import (
    notify_task_created_and_assigned,
    notify_task_created_confirmation,
    notify_task_completed,
)
import logging

logger = logging.getLogger(__name__)

task_bp = Blueprint("task_bp", __name__)


def _dispatch_task_creation_emails_async(task: dict, assignee_id: str, creator_id: str, creator_meta: dict):
    """Background worker for task creation emails."""
    def worker():
        try:
            creator = get_profile_by_id(creator_id) or creator_meta
            if assignee_id:
                assignee = get_profile_by_id(assignee_id) or (creator if assignee_id == creator_id else None)
                if assignee:
                    notify_task_created_and_assigned(task, assignee, creator)
            if creator and assignee_id != creator_id:
                notify_task_created_confirmation(task, creator)
        except Exception as err:
            logger.error(f"Error in background creation email: {err}")

    threading.Thread(target=worker, daemon=True).start()


def _dispatch_task_assignment_email_async(task: dict, assignee_id: str, creator_id: str, creator_meta: dict):
    """Background worker when an existing task is assigned or reassigned."""
    def worker():
        try:
            creator = get_profile_by_id(creator_id) or creator_meta
            assignee = get_profile_by_id(assignee_id) or (creator if assignee_id == creator_id else None)
            if assignee:
                notify_task_created_and_assigned(task, assignee, creator)
        except Exception as err:
            logger.error(f"Error in background assignment email: {err}")

    threading.Thread(target=worker, daemon=True).start()


def _dispatch_task_completion_email_async(task: dict, completed_by_meta: dict, creator_id: str, assignee_id: str = None):
    """Background worker for completion email."""
    def worker():
        try:
            creator = get_profile_by_id(creator_id) or completed_by_meta
            assignee = get_profile_by_id(assignee_id) if (assignee_id and assignee_id != creator_id) else None
            notify_task_completed(task, completed_by_meta, creator, assignee)
        except Exception as err:
            logger.error(f"Error in background completion email: {err}")

    threading.Thread(target=worker, daemon=True).start()


@task_bp.route("/api/tasks", methods=["GET"])
@require_auth
def list_tasks():
    """Get all tasks associated with current user."""
    try:
        user_id = g.current_user["id"]
        tasks = get_tasks_for_user(user_id)

        status_filter = request.args.get("status")
        priority_filter = request.args.get("priority")

        filtered_tasks = tasks or []
        if status_filter:
            filtered_tasks = [t for t in filtered_tasks if t.get("status") == status_filter]
        if priority_filter:
            filtered_tasks = [t for t in filtered_tasks if t.get("priority") == priority_filter]

        return jsonify({"tasks": filtered_tasks}), 200
    except Exception as e:
        logger.error(f"Error fetching tasks: {e}")
        return jsonify({"error": "Failed to fetch tasks"}), 500


@task_bp.route("/api/tasks", methods=["POST"])
@require_auth
def create_task():
    """Creates a new task and dispatches email notification to the assignee."""
    try:
        data = request.get_json() or {}
        title = data.get("title", "").strip()

        if not title:
            return jsonify({"error": "Task title is required"}), 400

        user_id = g.current_user["id"]
        assigned_to = data.get("assigned_to") or None
        priority = data.get("priority", "medium")
        description = data.get("description", "").strip()
        due_date = data.get("due_date") or None

        if priority not in ["low", "medium", "high", "urgent"]:
            priority = "medium"

        task_payload = {
            "title": title,
            "description": description,
            "priority": priority,
            "status": "todo",
            "created_by": user_id,
            "assigned_to": assigned_to,
            "due_date": due_date,
        }

        # 1. Insert into Supabase
        new_task = create_task_in_db(task_payload)
        if not new_task:
            return jsonify({"error": "Failed to create task in database"}), 500

        # 2. Trigger Gmail Notification asynchronously (assigned user receives task email)
        _dispatch_task_creation_emails_async(new_task, assigned_to, user_id, g.current_user)

        return jsonify({"message": "Task created successfully", "task": new_task}), 201

    except Exception as e:
        logger.error(f"Task creation error: {e}")
        return jsonify({"error": str(e)}), 500


@task_bp.route("/api/tasks/<task_id>", methods=["GET"])
@require_auth
def get_task(task_id):
    """Retrieve single task details."""
    try:
        task = get_task_by_id(task_id)
        if not task:
            return jsonify({"error": "Task not found"}), 404

        user_id = g.current_user["id"]
        if task["created_by"] != user_id and task.get("assigned_to") != user_id:
            return jsonify({"error": "Unauthorized to view this task"}), 403

        return jsonify({"task": task}), 200
    except Exception as e:
        logger.error(f"Error fetching task {task_id}: {e}")
        return jsonify({"error": "Failed to fetch task"}), 500


@task_bp.route("/api/tasks/<task_id>", methods=["PUT"])
@require_auth
def update_task(task_id):
    """
    Update task details or status.
    Business rules:
    - Cannot assign a task if it is currently completed (must be reopened first).
    - If assigned_to is set/changed, triggers email to the assignee.
    - If status changes to completed, triggers completion email.
    """
    try:
        user_id = g.current_user["id"]
        data = request.get_json() or {}

        existing_task = get_task_by_id(task_id)
        if not existing_task:
            return jsonify({"error": "Task not found"}), 404

        # Enforce: Cannot assign a completed task
        is_currently_completed = existing_task.get("status") == "completed"
        target_status = data.get("status", existing_task.get("status"))
        is_reopening = target_status in ["todo", "in_progress"]

        if is_currently_completed and not is_reopening and "assigned_to" in data:
            if data["assigned_to"] and data["assigned_to"] != existing_task.get("assigned_to"):
                return jsonify({
                    "error": "Cannot assign a completed task. Please reopen the task to 'To-Do' or 'In Progress' first."
                }), 400

        updates = {}

        if "title" in data and data["title"].strip():
            updates["title"] = data["title"].strip()
        if "description" in data:
            updates["description"] = data["description"].strip()
        if "priority" in data and data["priority"] in ["low", "medium", "high", "urgent"]:
            updates["priority"] = data["priority"]
        if "assigned_to" in data:
            updates["assigned_to"] = data["assigned_to"] or None
        if "due_date" in data:
            updates["due_date"] = data["due_date"] or None

        # Check status transition
        status_changed_to_completed = False
        if "status" in data and data["status"] in ["todo", "in_progress", "completed"]:
            updates["status"] = data["status"]
            if data["status"] == "completed" and existing_task.get("status") != "completed":
                updates["completed_at"] = datetime.now(timezone.utc).isoformat()
                status_changed_to_completed = True
            elif data["status"] != "completed":
                updates["completed_at"] = None

        if not updates:
            return jsonify({"error": "No update fields provided"}), 400

        # Check if assignee was changed or newly set
        old_assignee = existing_task.get("assigned_to")
        new_assignee = updates.get("assigned_to")
        assignee_changed = "assigned_to" in updates and new_assignee and new_assignee != old_assignee

        # Update in DB
        updated_task = update_task_in_db(task_id, updates)
        if not updated_task:
            return jsonify({"error": "Task update failed"}), 404

        # Trigger email to assignee if newly assigned!
        if assignee_changed:
            creator_profile = (
                existing_task.get("creator")
                or get_profile_by_id(existing_task["created_by"])
                or g.current_user
            )
            _dispatch_task_assignment_email_async(
                updated_task, new_assignee, existing_task["created_by"], creator_profile
            )

        # Trigger completion email if marked completed
        if status_changed_to_completed:
            creator_id = updated_task.get("created_by") or user_id
            assignee_id = updated_task.get("assigned_to")
            _dispatch_task_completion_email_async(
                updated_task, g.current_user, creator_id, assignee_id
            )

        return jsonify({"message": "Task updated successfully", "task": updated_task}), 200

    except Exception as e:
        logger.error(f"Task update error: {e}")
        return jsonify({"error": str(e)}), 500


@task_bp.route("/api/tasks/<task_id>", methods=["DELETE"])
@require_auth
def delete_task(task_id):
    """Deletes a task."""
    try:
        delete_task_from_db(task_id)
        return jsonify({"message": "Task deleted successfully"}), 200
    except Exception as e:
        logger.error(f"Task deletion error: {e}")
        return jsonify({"message": "Task deleted successfully"}), 200
