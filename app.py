"""
Root WSGI Entry Point for Cloud Deployments (Render / Railway / Heroku)
------------------------------------------------------------------------
Delegates to backend/app.py while ensuring the backend directory
is on sys.path, allowing root-level 'gunicorn app:app' to work seamlessly.
"""
import importlib.util
import os
import sys

# Ensure backend directory is in sys.path for relative imports (config, routes, services)
backend_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "backend")
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

# Load backend/app.py directly to avoid circular import with root app.py
backend_app_path = os.path.join(backend_dir, "app.py")
spec = importlib.util.spec_from_file_location("backend_main_app", backend_app_path)
backend_module = importlib.util.module_from_spec(spec)
sys.modules["backend_main_app"] = backend_module
spec.loader.exec_module(backend_module)

app = backend_module.app
create_app = backend_module.create_app

if __name__ == "__main__":
    from config import Config
    app.run(host="0.0.0.0", port=Config.PORT, debug=Config.DEBUG)
