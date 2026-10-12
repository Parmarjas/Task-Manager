"""
Flask Application Entry Point
-----------------------------
Bootstraps the Flask server, registers REST blueprints, configures CORS,
and provides health check endpoints.

TECHNICAL INTERVIEW EXPLANATION:
- Application Factory / Modular Structure: Routes are partitioned into Blueprints
  (`auth_bp` and `task_bp`), maintaining clean separation of concerns.
- CORS (Cross-Origin Resource Sharing): Configured via `flask-cors` to allow requests
  from Next.js (default http://localhost:3000) with credentials and Authorization headers.
"""

import logging
from flask import Flask, jsonify
from flask_cors import CORS
from config import Config
from routes.auth_routes import auth_bp
from routes.task_routes import task_bp

# Set up logging format
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("task_manager_app")


def create_app():
    """Application factory pattern."""
    app = Flask(__name__)
    app.config.from_object(Config)

    # Configure allowed CORS origins (handles comma-separated domains and strips trailing slashes)
    frontend_origins = [url.strip().rstrip("/") for url in Config.FRONTEND_URL.split(",") if url.strip()]
    for default_origin in ["http://localhost:3000", "http://127.0.0.1:3000"]:
        if default_origin not in frontend_origins:
            frontend_origins.append(default_origin)

    # Enable CORS for Next.js frontend
    CORS(
        app,
        resources={r"/api/*": {"origins": frontend_origins}},
        supports_credentials=True,
        allow_headers=["Content-Type", "Authorization"],
        methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    )

    # Register Blueprints
    app.register_blueprint(auth_bp)
    app.register_blueprint(task_bp)

    # Health Check Endpoint
    @app.route("/api/health", methods=["GET"])
    def health_check():
        return jsonify({
            "status": "healthy",
            "service": "Task Management API",
            "environment": Config.FLASK_ENV,
        }), 200

    # Global 404 Handler
    @app.errorhandler(404)
    def not_found_handler(e):
        return jsonify({"error": "Endpoint not found"}), 404

    # Global 500 Handler
    @app.errorhandler(500)
    def internal_error_handler(e):
        logger.error(f"Internal server error: {e}")
        return jsonify({"error": "Internal server error"}), 500

    return app


app = create_app()

if __name__ == "__main__":
    logger.info(f"Starting Flask server on port {Config.PORT}...")
    app.run(host="0.0.0.0", port=Config.PORT, debug=Config.DEBUG)
