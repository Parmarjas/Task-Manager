"""
Gmail Notification Service
---------------------------
Handles automated email delivery via Gmail SMTP.
Notifications are sent for:
1. New Task Created & Assigned to a user.
2. Task Creation confirmation to task creator.
3. Task Completed notification sent to creator & assignee.
"""

import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
import threading
import logging
from config import Config

logger = logging.getLogger(__name__)


def _send_email_smtp(recipient_email: str, subject: str, html_content: str, text_content: str = ""):
    """
    Synchronous internal function that establishes connection with Gmail SMTP server.
    Executed in a background thread to prevent blocking the Flask request loop.
    """
    if not Config.GMAIL_USER or not Config.GMAIL_APP_PASSWORD:
        logger.warning(
            f"[GMAIL NOT CONFIGURED] Simulated email delivery to: {recipient_email}\n"
            f"Subject: {subject}\n"
            f"Configure GMAIL_USER and GMAIL_APP_PASSWORD in .env to enable real delivery."
        )
        return False

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"TaskFlow <{Config.GMAIL_USER}>"
        msg["To"] = recipient_email

        if text_content:
            msg.attach(MIMEText(text_content, "plain"))
        msg.attach(MIMEText(html_content, "html"))

        # Connect to Gmail SMTP server with STARTTLS (IPv4 forced globally)
        with smtplib.SMTP(Config.SMTP_HOST, Config.SMTP_PORT, timeout=12) as server:
            server.ehlo()
            server.starttls()
            server.ehlo()
            server.login(Config.GMAIL_USER, Config.GMAIL_APP_PASSWORD)
            server.sendmail(Config.GMAIL_USER, [recipient_email], msg.as_string())

        logger.info(f"Email successfully sent to {recipient_email}: '{subject}'")
        return True

    except Exception as e:
        logger.error(f"Failed to send email to {recipient_email}: {str(e)}")
        return False


def send_email_async(recipient_email: str, subject: str, html_content: str, text_content: str = ""):
    """
    Dispatches email sending to a background daemon thread.
    Returns immediately so API responses are instantaneous.
    """
    thread = threading.Thread(
        target=_send_email_smtp,
        args=(recipient_email, subject, html_content, text_content),
        daemon=True,
    )
    thread.start()


# -----------------------------------------------------------------------------
# HIGH LEVEL NOTIFICATION TRIGGERS
# -----------------------------------------------------------------------------

def notify_task_created_and_assigned(task: dict, assignee: dict, creator: dict):
    """
    Triggered when a new task is created and assigned to another user.
    """
    if not assignee or not assignee.get("email"):
        return

    recipient = assignee["email"]
    subject = f"📌 New Task Assigned: {task.get('title')}"

    creator_name = creator.get("full_name") or creator.get("email", "A teammate")
    task_title = task.get("title", "Untitled Task")
    task_desc = task.get("description", "No description provided.")
    priority = task.get("priority", "medium").upper()
    due_date = task.get("due_date", "No deadline set")

    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f6f8; margin: 0; padding: 24px; }}
            .container {{ max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.06); }}
            .header {{ background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); padding: 32px 24px; color: #ffffff; text-align: center; }}
            .header h1 {{ margin: 0; font-size: 24px; font-weight: 700; }}
            .content {{ padding: 32px 24px; color: #334155; line-height: 1.6; }}
            .task-card {{ background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 20px 0; }}
            .badge {{ display: inline-block; padding: 4px 10px; font-size: 12px; font-weight: 600; border-radius: 20px; background-color: #e0e7ff; color: #4338ca; text-transform: uppercase; }}
            .meta-row {{ margin: 8px 0; font-size: 14px; color: #64748b; }}
            .footer {{ background: #f8fafc; padding: 16px 24px; font-size: 12px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>Task Assigned To You</h1>
            </div>
            <div class="content">
                <p>Hello <strong>{assignee.get('full_name', 'there')}</strong>,</p>
                <p><strong>{creator_name}</strong> has assigned a new task to you:</p>
                
                <div class="task-card">
                    <h2 style="margin: 0 0 12px 0; color: #0f172a; font-size: 18px;">{task_title}</h2>
                    <p style="margin: 0 0 16px 0; color: #475569;">{task_desc}</p>
                    <div class="meta-row"><strong>Priority:</strong> <span class="badge">{priority}</span></div>
                    <div class="meta-row"><strong>Due Date:</strong> {due_date}</div>
                </div>

                <p>Log in to your TaskFlow dashboard to track and update the status of this task.</p>
            </div>
            <div class="footer">
                Automated notification from TaskFlow Application.
            </div>
        </div>
    </body>
    </html>
    """

    text_content = f"""
    New Task Assigned: {task_title}
    Assigned by: {creator_name}
    Priority: {priority}
    Due Date: {due_date}
    Description: {task_desc}
    """

    send_email_async(recipient, subject, html_content, text_content)


def notify_task_created_confirmation(task: dict, creator: dict):
    """
    Triggered when a user creates a new task (sent to the creator as confirmation).
    """
    if not creator or not creator.get("email"):
        return

    recipient = creator["email"]
    task_title = task.get("title", "Untitled Task")
    task_desc = task.get("description", "No description provided.")
    priority = task.get("priority", "medium").upper()
    due_date = task.get("due_date", "No deadline set")

    subject = f"📝 Task Created: {task_title}"

    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f6f8; margin: 0; padding: 24px; }}
            .container {{ max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.06); }}
            .header {{ background: linear-gradient(135deg, #3b82f6 0%, #6366f1 100%); padding: 32px 24px; color: #ffffff; text-align: center; }}
            .header h1 {{ margin: 0; font-size: 24px; font-weight: 700; }}
            .content {{ padding: 32px 24px; color: #334155; line-height: 1.6; }}
            .task-card {{ background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 20px 0; }}
            .badge {{ display: inline-block; padding: 4px 10px; font-size: 12px; font-weight: 600; border-radius: 20px; background-color: #e0e7ff; color: #4338ca; text-transform: uppercase; }}
            .footer {{ background: #f8fafc; padding: 16px 24px; font-size: 12px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>Task Created Successfully</h1>
            </div>
            <div class="content">
                <p>Hello <strong>{creator.get('full_name', 'there')}</strong>,</p>
                <p>You have created a new task in your TaskFlow workspace:</p>
                
                <div class="task-card">
                    <h2 style="margin: 0 0 12px 0; color: #0f172a; font-size: 18px;">{task_title}</h2>
                    <p style="margin: 0 0 16px 0; color: #475569;">{task_desc}</p>
                    <div style="margin: 8px 0; font-size: 14px; color: #64748b;"><strong>Priority:</strong> <span class="badge">{priority}</span></div>
                    <div style="margin: 8px 0; font-size: 14px; color: #64748b;"><strong>Due Date:</strong> {due_date}</div>
                </div>

                <p>You can manage and update this task at any time on your dashboard.</p>
            </div>
            <div class="footer">
                Automated notification from TaskFlow Application.
            </div>
        </div>
    </body>
    </html>
    """

    text_content = f"""
    Task Created: {task_title}
    Priority: {priority}
    Due Date: {due_date}
    Description: {task_desc}
    """

    send_email_async(recipient, subject, html_content, text_content)


def notify_task_completed(task: dict, completed_by: dict, creator: dict, assignee: dict):
    """
    Triggered when a task is marked as completed.
    Sends notifications to both creator and assignee.
    """
    recipients = set()
    if creator and creator.get("email"):
        recipients.add(creator["email"])
    if assignee and assignee.get("email"):
        recipients.add(assignee["email"])

    completed_by_name = completed_by.get("full_name") or completed_by.get("email", "A teammate")
    task_title = task.get("title", "Untitled Task")

    for recipient in recipients:
        subject = f"✅ Task Completed: {task_title}"

        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <style>
                body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f6f8; margin: 0; padding: 24px; }}
                .container {{ max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.06); }}
                .header {{ background: linear-gradient(135deg, #059669 0%, #10b981 100%); padding: 32px 24px; color: #ffffff; text-align: center; }}
                .header h1 {{ margin: 0; font-size: 24px; font-weight: 700; }}
                .content {{ padding: 32px 24px; color: #334155; line-height: 1.6; }}
                .task-card {{ background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; padding: 20px; margin: 20px 0; }}
                .footer {{ background: #f8fafc; padding: 16px 24px; font-size: 12px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>Task Marked as Completed!</h1>
                </div>
                <div class="content">
                    <p>Good news!</p>
                    <p>The following task has been marked as <strong>Completed</strong> by <strong>{completed_by_name}</strong>:</p>
                    
                    <div class="task-card">
                        <h2 style="margin: 0 0 8px 0; color: #065f46; font-size: 18px;">{task_title}</h2>
                        <p style="margin: 0; color: #047857; font-size: 14px;">Status: COMPLETED</p>
                    </div>

                    <p>Great teamwork! You can review the finished task on your dashboard.</p>
                </div>
                <div class="footer">
                    Automated notification from TaskFlow Application.
                </div>
            </div>
        </body>
        </html>
        """

        text_content = f"""
        Task Completed: {task_title}
        Completed by: {completed_by_name}
        Status: COMPLETED
        """

        send_email_async(recipient, subject, html_content, text_content)
