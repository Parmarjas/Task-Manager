# 🎯 Task Management System - Technical Architecture & Interview Preparation Guide

This guide is designed to help you **master, explain, and defend every line of code** in this application during your technical interview. It covers system design, OAuth 2.0 security, Supabase schema design, Flask REST architecture, Gmail SMTP integration, and answers to common technical interview questions.

---

## 📑 Table of Contents
1. [System Architecture Overview](#1-system-architecture-overview)
2. [Google OAuth 2.0 - How Authentication Works Under the Hood](#2-google-oauth-20---how-authentication-works-under-the-hood)
3. [Database Design with Supabase (PostgreSQL)](#3-database-design-with-supabase-postgresql)
4. [Backend Architecture with Flask](#4-backend-architecture-with-flask)
5. [Gmail Integration (SMTP Protocol & Async Threading)](#5-gmail-integration-smtp-protocol--async-threading)
6. [Frontend Architecture (Next.js 14+ & TypeScript)](#6-frontend-architecture-nextjs-14--typescript)
7. [Step-by-Step Setup Guide](#7-step-by-step-setup-guide)
8. [25 Anticipated Technical Interview Questions & Model Answers](#8-25-anticipated-technical-interview-questions--model-answers)

---

## 1. System Architecture Overview

```
 ┌───────────────────────────┐
 │   Next.js 14+ Frontend    │
 │ (App Router + TypeScript) │
 └─────────────┬─────────────┘
               │
               │ 1. Initiate Google OAuth
               ▼
 ┌───────────────────────────┐         2. Google Consent & Token Return
 │     Google Accounts       │ ─────────────────────────────────────────┐
 │   (OAuth 2.0 Provider)    │                                          │
 └───────────────────────────┘                                          │
               ▲                                                        ▼
               │                                            ┌─────────────────────────┐
               │                                            │  Supabase Auth & DB     │
               │                                            │ (PostgreSQL + RLS)      │
               │                                            └───────────▲─────────────┘
               │                                                        │
               │ 3. API Requests with Bearer JWT                        │ 4. SQL Queries &
               │    (Authorization: Bearer <jwt>)                       │    User Profile Sync
               ▼                                                        ▼
 ┌─────────────────────────────────────────────────────────────────────────────┐
 │                         Flask REST API (Python)                             │
 │  - auth_service: Token Decryption & Validation                              │
 │  - task_routes: Task CRUD + Assignment Logic                                │
 │  - email_service: Async Background SMTP Delivery                            │
 └──────────────────────────────────────┬──────────────────────────────────────┘
                                        │
                                        │ 5. STARTTLS SMTP (port 587)
                                        ▼
                         ┌─────────────────────────────┐
                         │      Gmail SMTP Server      │
                         │      (smtp.gmail.com)       │
                         └──────────────┬──────────────┘
                                        │
                                        │ 6. Email Notifications
                                        ▼
                         ┌─────────────────────────────┐
                         │  Assignee / Creator Inboxes │
                         │ (Task Created / Completed)  │
                         └─────────────────────────────┘
```

---

## 2. Google OAuth 2.0 - How Authentication Works Under the Hood

### The 4-Party OAuth 2.0 Roles:
1. **Resource Owner**: The End User (who owns the Google account).
2. **Client**: Your Next.js Application.
3. **Authorization Server**: Google (`accounts.google.com`).
4. **Resource Server / Protected API**: Your Flask Backend & Supabase Database.

### Step-by-Step Handshake:
1. **Initiation**: The user clicks **"Sign in with Google"** on Next.js.
2. **Consent Screen**: The browser redirects to Google's OAuth consent screen with parameters:
   - `client_id`: Public identifier registered in Google Cloud Console.
   - `redirect_uri`: Whitelisted callback URL (`http://localhost:3000/auth/callback` or Supabase Auth URL).
   - `response_type=code`: Requesting an Authorization Code.
   - `scope`: `openid email profile` (least-privilege permissions requested).
3. **User Grants Consent**: The user confirms their Gmail identity. Google generates an ephemeral **Authorization Code** and redirects the user back to the client callback.
4. **Code Exchange**: The application exchanges the single-use Authorization Code along with `client_secret` (kept confidential) for an **ID Token (JWT)**, an **Access Token**, and optionally a **Refresh Token**.
5. **Session Established**: Supabase Auth securely stores the session, creates/updates the user record in `auth.users`, and returns a signed session JWT to the Next.js client.
6. **Backend Consumption**: Next.js sends this JWT in the `Authorization: Bearer <token>` header to the Flask backend. Flask verifies the signature and extracts the user's `id` and `email`.

---

## 3. Database Design with Supabase (PostgreSQL)

### Schema Overview:
1. **`public.profiles`**:
   - `id`: UUID (Foreign key referencing `auth.users(id)` ON DELETE CASCADE).
   - `email`: TEXT UNIQUE NOT NULL.
   - `full_name`: TEXT.
   - `avatar_url`: TEXT.
   - `created_at` / `updated_at`: TIMESTAMPTZ.
2. **`public.tasks`**:
   - `id`: UUID DEFAULT `gen_random_uuid()`.
   - `title`: TEXT NOT NULL.
   - `description`: TEXT DEFAULT ''.
   - `status`: TEXT NOT NULL DEFAULT `'todo'` CHECK (`status IN ('todo', 'in_progress', 'completed')`).
   - `priority`: TEXT NOT NULL DEFAULT `'medium'` CHECK (`priority IN ('low', 'medium', 'high', 'urgent')`).
   - `created_by`: UUID NOT NULL REFERENCES `public.profiles(id)` ON DELETE CASCADE.
   - `assigned_to`: UUID REFERENCES `public.profiles(id)` ON DELETE SET NULL.
   - `due_date`: TIMESTAMPTZ.
   - `completed_at`: TIMESTAMPTZ.

### Key Database Concepts to Highlight in the Interview:
- **Foreign Key Constraints (`ON DELETE CASCADE` vs `SET NULL`)**:
  - When a user is deleted, their created tasks cascade delete (`CASCADE`).
  - If an assigned user is deleted, tasks they were assigned to are not deleted; instead, `assigned_to` is safely set to `NULL` (`SET NULL`).
- **PostgreSQL Triggers**:
  - `handle_updated_at`: Automatically stamps `updated_at = now()` on row modifications.
  - `handle_new_user`: Automatically listens to `auth.users` insert events and synchronizes the user's profile and avatar into `public.profiles`.
- **Row Level Security (RLS)**:
  - Ensures data isolation at the database layer. Even if an attacker guessed an API endpoint, Supabase enforces that users can only select and update tasks where `auth.uid() = created_by OR auth.uid() = assigned_to`.

---

## 4. Backend Architecture with Flask

### Design Patterns Used:
- **Application Factory Pattern (`create_app`)**: Allows creating fresh application instances with isolated configurations, ideal for unit testing.
- **Blueprint Modularization**: Separates routes into domain modules:
  - `auth_routes.py` (`/api/auth/*` and `/api/users`)
  - `task_routes.py` (`/api/tasks/*`)
- **Service Layer Pattern**: Decouples business logic from HTTP transport:
  - `services/auth_service.py`: Token verification and user context injection.
  - `services/supabase_service.py`: Database query abstraction.
  - `services/email_service.py`: SMTP notification dispatch.
- **Custom Route Decorator (`@require_auth`)**:
  - Intercepts requests, parses `Authorization: Bearer <token>`, validates the cryptographic signature, and injects `g.current_user` before the route executes.

---

## 5. Gmail Integration (SMTP Protocol & Async Threading)

### How It Works:
1. **Protocol**: Uses Python's native `smtplib` and `email.mime` connecting to `smtp.gmail.com:587`.
2. **Security**: Uses `STARTTLS` (opportunistic TLS) to upgrade the plaintext connection to an encrypted channel before credentials and email contents are sent.
3. **App Passwords**: Uses Google-generated 16-character **App Passwords**. Why? Google disabled "Less Secure Apps" in 2022. App Passwords allow 2FA-secured accounts to safely authenticate automated server processes without exposing master account passwords.
4. **Asynchronous Non-Blocking Execution**:
   - Sending an email over SMTP typically takes **800ms - 2000ms** due to TCP handshake, TLS negotiation, and SMTP command responses (`HELO`, `AUTH LOGIN`, `MAIL FROM`, `RCPT TO`, `DATA`).
   - If executed synchronously, the user would experience a 2-second lag when clicking "Create Task".
   - **Solution**: We dispatch email sending inside `threading.Thread(target=..., daemon=True).start()`. The Flask API returns in under **50ms**, while the email sends in the background.

---

## 6. Frontend Architecture (Next.js 14+ & TypeScript)

### Core Highlights:
- **TypeScript Strict Typing**: Custom interfaces for `Task`, `UserProfile`, and `TaskFormData`.
- **Client Components (`"use client"`)**: Used for interactive task filtering, modal dialogs, and real-time state management.
- **Centralized API Client (`lib/api.ts`)**: Automatically attaches the current session's Bearer token to all outgoing fetch/axios requests.
- **Responsive & Accessible UI**: Clean CSS variables, accessible form inputs, and micro-animations for status updates.

---

## 7. Step-by-Step Setup Guide

### Prerequisites:
- Python 3.10+
- Node.js 18+
- Supabase Free Account ([supabase.com](https://supabase.com))
- Gmail Account with 2-Step Verification

### Step 1: Supabase Setup
1. Create a new project in [Supabase](https://app.supabase.com).
2. Go to **SQL Editor** -> Click **New Query**.
3. Copy the entire contents of `supabase/schema.sql` and click **Run**.
4. Go to **Authentication** -> **Providers** -> Enable **Google**.
   - Input your Google OAuth Client ID and Secret (from Google Cloud Console).
   - Set Authorized Redirect URI in Google Cloud Console to the URL provided by Supabase.
5. In Supabase Dashboard, go to **Project Settings** -> **API**:
   - Copy `Project URL` -> `SUPABASE_URL`
   - Copy `service_role` secret -> `SUPABASE_SERVICE_ROLE_KEY`
   - Copy `anon` public key -> `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - Copy `JWT Secret` -> `SUPABASE_JWT_SECRET`

### Step 2: Gmail App Password Setup
1. Log into your Google Account -> Go to **Security**.
2. Enable **2-Step Verification** (if not already enabled).
3. Search for **App passwords** in the search bar.
4. Create an App password (Name: "Task Manager").
5. Copy the 16-character password (e.g. `abcd efgh ijkl mnop`).

### Step 3: Backend Setup
```bash
cd backend
# Create virtual environment
python -m venv venv
# Activate virtual environment:
# Windows:
.\venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Create .env from template
cp .env.example .env
# Fill in your SUPABASE and GMAIL credentials in .env

# Run the Flask server
python app.py
```
Backend will run at: `http://localhost:5000`

### Step 4: Frontend Setup
```bash
cd frontend
# Install dependencies
npm install

# Create .env.local from example
# Fill in NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY

# Run the Next.js dev server
npm run dev
```
Frontend will run at: `http://localhost:3000`

---

## 8. 25 Anticipated Technical Interview Questions & Model Answers

### Question 1: Can you walk us through the high-level architecture of your application?
> **Model Answer:**
> "The application follows a modern decoupled architecture. The frontend is built with Next.js 14 and TypeScript, utilizing the App Router for fast rendering and stateful client components. Authentication is handled via Google OAuth 2.0 facilitated by Supabase Auth. The client communicates with a Flask REST API backend using Bearer JWT tokens. The Flask backend verifies the token, applies business logic, and coordinates with Supabase's PostgreSQL database for persistence. When tasks are created or completed, an asynchronous Python email service delivers branded HTML notifications via Gmail's SMTP server without blocking API response times."

### Question 2: Why did you use Flask instead of Django or FastAPI?
> **Model Answer:**
> "Flask is lightweight and unopinionated, making it ideal for microservices and targeted REST APIs where you want full transparency over the request lifecycle. Django comes with a heavy ORM and built-in template engine which would be redundant since we are using Supabase as our database and Next.js as our frontend. While FastAPI is also a great option for async tasks, Flask 3.x combined with Python's `threading` gives us explicit, easily readable code that satisfies all requirements with minimal boilerplate."

### Question 3: How does Google OAuth 2.0 prevent CSRF and replay attacks?
> **Model Answer:**
> "OAuth 2.0 mitigates Cross-Site Request Forgery (CSRF) using a cryptographic `state` parameter generated by the client prior to redirecting to Google. When Google redirects back to the callback URL, it echoes this `state` token. The application compares it with the cached local session; if they don't match, the request is rejected. Additionally, the Authorization Code is single-use and short-lived (usually expiring in 60 seconds), preventing replay attacks if an authorization URL is intercepted."

### Question 4: What is the difference between an ID Token, an Access Token, and a Refresh Token in OAuth 2.0?
> **Model Answer:**
> - **ID Token**: A signed JWT conforming to OpenID Connect (OIDC) containing user identity claims (email, name, picture). It is meant for the client application to know who the user is.
> - **Access Token**: An authorization credential used to access protected resources on an API/Resource Server on behalf of the user. It is typically short-lived (e.g., 1 hour).
> - **Refresh Token**: A long-lived credential stored securely that is exchanged with the authorization server to generate new access tokens without requiring the user to re-enter their credentials.

### Question 5: Why did you choose Supabase, and how does it differ from a raw PostgreSQL database?
> **Model Answer:**
> "Supabase is built directly on top of open-source PostgreSQL. Unlike raw Postgres which requires configuring connection pooling (like PgBouncer), setting up custom auth tables, and building realtime webhooks from scratch, Supabase provides built-in OAuth providers, Row Level Security (RLS) integration, automated PostgREST APIs, and instantaneous dashboard management while preserving 100% Postgres SQL compatibility."

### Question 6: What is Row Level Security (RLS) and why is it important?
> **Model Answer:**
> "Row Level Security is an enterprise PostgreSQL security feature that restricts which database rows a query can return or mutate based on the identity of the executing user (`auth.uid()`). Instead of relying solely on backend application code filters (e.g., `WHERE created_by = current_user`), RLS enforces data security at the database engine level. This guarantees that even if an application endpoint had a vulnerability or logic bug, users could never access or alter rows belonging to other users."

### Question 7: How do you verify JWT tokens in the Flask backend?
> **Model Answer:**
> "We implement a custom `@require_auth` decorator. When an HTTP request arrives, the decorator extracts the Bearer token from the `Authorization` header. We verify the token using two layers:
> 1. We invoke Supabase's auth verification API (`client.auth.get_user(token)`) to validate token state and expiration against the auth server.
> 2. Alternatively, we cryptographically decode the JWT locally using PyJWT with the project's secret key (`SUPABASE_JWT_SECRET`) validating the `HS256` signature and `exp` claim.
> Once verified, user information is injected into Flask's `g.current_user` context for the duration of the request."

### Question 8: How did you implement email notifications without slowing down the task creation endpoint?
> **Model Answer:**
> "Connecting to Gmail's SMTP server, performing TLS handshakes, authenticating, and transferring MIME data takes approximately 1 to 2 seconds. If done synchronously inside the HTTP handler, the user would experience substantial latency. To solve this, our `email_service` executes the SMTP delivery in a background daemon thread (`threading.Thread`). The HTTP handler inserts the task in the database, triggers the background thread, and immediately returns a 201 Created response in under 50ms."

### Question 9: What are Gmail App Passwords, and why don't we use your standard Google account password?
> **Model Answer:**
> "Google deprecated 'Less Secure Apps' and plain password access to improve account security. If an application stored a standard Google password, any compromise of that application would expose the user's entire Google account. An App Password is a dedicated 16-character alphanumeric key restricted exclusively to mail protocols that bypasses 2FA for authorized automated processes, and it can be revoked instantly at any time from Google Account Security without altering the primary credentials."

### Question 10: What would you use in a production enterprise environment instead of SMTP App Passwords?
> **Model Answer:**
> "For a large-scale enterprise system, we would migrate to:
> 1. **Transactional Email Service Providers**: SendGrid, AWS SES, Resend, or Postmark via their REST APIs, which offer 99.9% inbox deliverability, DKIM/SPF alignment, and bounce rate tracking.
> 2. **Distributed Message Queues**: Celery with Redis or RabbitMQ to manage email delivery with retry mechanisms, exponential backoff, and dead-letter queues."

### Question 11: How do you handle database relationships between tasks and users?
> **Model Answer:**
> "In `supabase/schema.sql`, the `tasks` table includes two foreign keys referencing `public.profiles(id)`:
> - `created_by`: Foreign key with `ON DELETE CASCADE`. If the author's account is permanently deleted, their authored tasks are purged.
> - `assigned_to`: Foreign key with `ON DELETE SET NULL`. If an assigned colleague leaves or deletes their account, the task remains intact in the system with `assigned_to` set to `NULL`, ready to be reassigned.
> We also index both foreign keys (`idx_tasks_created_by`, `idx_tasks_assigned_to`) to keep join operations at O(log N) lookup time."

### Question 12: How are new Google OAuth users synchronized into your custom database tables?
> **Model Answer:**
> "When a user logs in via Google OAuth for the first time, Supabase creates a record in its internal `auth.users` table. We created a PostgreSQL trigger function (`handle_new_user()`) that listens to `AFTER INSERT ON auth.users`. The trigger automatically extracts the user's email, name, and profile photo from `raw_user_meta_data` and inserts it into `public.profiles`. As a fallback, our backend `auth_service` also performs an `upsert` during token validation to ensure consistency."

### Question 13: How do you prevent CORS issues between Next.js (port 3000) and Flask (port 5000)?
> **Model Answer:**
> "Browsers enforce the Same-Origin Policy, blocking cross-origin AJAX requests unless the server sends appropriate CORS headers. In Flask, we use `flask-cors` to configure `CORS(app, resources={r"/api/*": {"origins": ["http://localhost:3000"]}}, supports_credentials=True, allow_headers=["Content-Type", "Authorization"])`. When the browser sends an `OPTIONS` preflight request, Flask responds with `Access-Control-Allow-Origin` and `Access-Control-Allow-Methods`, allowing the subsequent `POST` or `GET` request to proceed."

### Question 14: What HTTP status codes does your REST API return, and why?
> **Model Answer:**
> - `200 OK`: Successful fetch or update (`GET`, `PUT`).
> - `201 Created`: Successful creation of a new task (`POST`).
> - `400 Bad Request`: Validation failure (e.g., missing task title).
> - `401 Unauthorized`: Missing, invalid, or expired JWT token.
> - `403 Forbidden`: User attempts to edit or delete a task they neither created nor were assigned to.
> - `404 Not Found`: Task or user ID does not exist.
> - `500 Internal Server Error`: Unhandled server-side or database exception.

### Question 15: How does the frontend maintain user authentication across page reloads?
> **Model Answer:**
> "Supabase Auth automatically persists the user's active session and JWT in the browser's `localStorage` or secure cookies. On page load, `supabase.auth.getSession()` retrieves the active session without redirecting the user. If the access token has expired, Supabase automatically utilizes the stored refresh token to silently obtain a fresh JWT before executing API calls."

### Question 16: What is optimistic UI update, and could it be applied here?
> **Model Answer:**
> "An optimistic UI update is a frontend pattern where the client updates the UI immediately upon user action (e.g., marking a task checkbox complete) before receiving the server's HTTP confirmation response. If the server responds with an error, the UI rolls back to the previous state and displays a notification. This provides a perceived instantaneous response time for users."

### Question 17: How did you design the database indexing strategy?
> **Model Answer:**
> "We placed B-Tree indexes on the most frequently filtered and joined columns:
> - `idx_tasks_created_by` and `idx_tasks_assigned_to` for fast user-specific task lookups.
> - `idx_tasks_status` to optimize filtering by task state (`todo`, `in_progress`, `completed`).
> Without these indexes, queries with `WHERE created_by = ...` would trigger sequential full-table scans, degrading performance as task volume scales."

### Question 18: What is the purpose of TypeScript interfaces in the frontend?
> **Model Answer:**
> "TypeScript provides compile-time type safety. By defining strict interfaces for `Task` and `UserProfile`, we catch schema mismatches, undefined properties, and spelling errors before code reaches production. It also improves developer productivity through IDE autocompletion and eliminates an entire class of runtime `TypeError: undefined is not a function` errors."

### Question 19: Why is the Next.js App Router advantageous over the legacy Pages Router?
> **Model Answer:**
> "The App Router is built around React Server Components (RSC) by default. It reduces the JavaScript bundle sent to the client, supports nested layouts without re-rendering outer layouts, provides built-in streaming with Suspense, and standardizes error and loading states via special files like `loading.tsx` and `error.tsx`."

### Question 20: How do you protect your backend against SQL Injection attacks?
> **Model Answer:**
> "We never concatenate user inputs directly into raw SQL strings. The Supabase Python client and PostgREST API use parameterized queries under the hood. Input values are transmitted separately from the SQL statement structure, ensuring that any user input is strictly treated as data rather than executable SQL code."

### Question 21: How do you prevent sensitive configuration from leaking into version control?
> **Model Answer:**
> "All API keys, secrets, and database credentials are stored in environment variables loaded via `.env` files. Both `.env` and `.env.local` are explicitly listed in `.gitignore`. We provide sanitized `.env.example` templates with empty placeholders for other developers to set up their environments safely."

### Question 22: What happens if an email fails to send? Does the task creation roll back?
> **Model Answer:**
> "No, the task creation does not roll back. Task creation is the primary business event and database transaction, whereas email delivery is a secondary notification side effect. In `email_service.py`, failures are caught in a `try...except` block and logged without raising an unhandled exception. This ensures that transient network issues or invalid email credentials never block user workflows."

### Question 23: How would you implement real-time task updates across multiple users?
> **Model Answer:**
> "Since we use Supabase, we can subscribe to PostgreSQL Changes using Supabase Realtime via WebSockets:
> ```typescript
> supabase.channel('tasks-channel')
>   .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, (payload) => {
>     // Update local state dynamically
>   })
>   .subscribe();
> ```
> This allows any task assignment or status change made by User A to instantaneously appear on User B's screen without refreshing."

### Question 24: How would you scale the backend from 100 users to 100,000 active users?
> **Model Answer:**
> "1. **Stateless API horizontal scaling**: Run multiple containerized Flask instances (Docker/Kubernetes) behind an Application Load Balancer (ALB).
> 2. **Database connection pooling**: Enable Supabase's transaction pooler (PgBouncer) to handle thousands of concurrent queries.
> 3. **Caching**: Place a Redis cache in front of frequently accessed read endpoints (e.g. user profiles).
> 4. **Asynchronous Task Queue**: Transition email sending and heavy background tasks to Celery with Redis or AWS SQS workers."

### Question 25: If you had more time, what features would you add next?
> **Model Answer:**
> "1. Real-time in-app notifications and WebSocket activity feeds.
> 2. File attachments for tasks (e.g. uploading images or documents to Supabase Storage).
> 3. Task comments and activity audit logs (tracking who updated a task and when).
> 4. Kanban drag-and-drop board interface for intuitive status transitions.
> 5. Automated recurring tasks and calendar integration (Google Calendar API)."
