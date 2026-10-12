# 🚀 Task Management Web Application

A full-stack, enterprise-grade Task Management application built with **Next.js (TypeScript)**, **Flask (Python)**, **Supabase (PostgreSQL)**, **Google OAuth 2.0**, and **Gmail SMTP Notifications**.

---

## 🌟 Key Features

1. **Google OAuth 2.0 Authentication**: Seamless single-sign-on using Gmail accounts.
2. **Task Creation & Management**: Create, view, edit, filter, search, and delete tasks.
3. **Task Assignment**: Assign tasks to any registered teammate in the workspace.
4. **Automated Gmail Notifications**:
   - **Task Assigned Notification**: Sent to the assignee when a new task is created and assigned to them.
   - **Task Completed Notification**: Sent to the creator and assignee when a task is marked completed.
5. **Database Security with Row Level Security (RLS)**: Enforces row-level isolation directly inside Supabase PostgreSQL.
6. **Asynchronous Non-Blocking Emails**: Python multithreading delivers emails in the background without slowing down HTTP API responses (<50ms).

---

## 📂 Project Structure

```
d:/assugnment/
├── INTERVIEW_GUIDE.md             # In-depth architectural breakdown & 25 technical Q&As
├── README.md                      # Quickstart documentation
│
├── supabase/
│   └── schema.sql                 # PostgreSQL tables, triggers, indexes, and RLS policies
│
├── backend/                       # Flask REST API
│   ├── app.py                     # App factory & route registration
│   ├── config.py                  # Environment config
│   ├── requirements.txt           # Python dependencies
│   ├── .env.example               # Template for environment variables
│   ├── routes/
│   │   ├── auth_routes.py         # /api/auth/me & /api/users
│   │   └── task_routes.py         # /api/tasks CRUD endpoints
│   └── services/
│       ├── auth_service.py        # JWT verification decorator (@require_auth)
│       ├── supabase_service.py    # Database queries & profiles sync
│       └── email_service.py       # Async Gmail SMTP email delivery
│
└── frontend/                      # Next.js 14+ (App Router + TypeScript)
    ├── package.json
    ├── .env.local.example
    ├── app/
    │   ├── globals.css            # Vanilla CSS design system (Dark mode + Glassmorphism)
    │   ├── layout.tsx             # Root layout with SEO metadata
    │   ├── page.tsx               # Main dashboard with task filtering & statistics
    │   ├── login/page.tsx         # Google OAuth login screen
    │   └── auth/callback/page.tsx # OAuth token exchange handler
    ├── components/
    │   ├── Navbar.tsx             # Navigation header with avatar & sign out
    │   ├── TaskCard.tsx           # Task card with status toggle & badges
    │   └── TaskModal.tsx          # Create/Edit modal with assignee dropdown
    └── lib/
        ├── types.ts               # Strict TypeScript definitions
        ├── supabase.ts            # Supabase client & Google OAuth triggers
        └── api.ts                 # HTTP client with Bearer token injection
```

---

## ⚡ Quick Start Guide

### 1. Database Setup (Supabase)
1. Create a free project at [supabase.com](https://supabase.com).
2. Go to **SQL Editor** -> **New Query**.
3. Copy the contents of `supabase/schema.sql` and click **Run**.
4. In **Authentication** -> **Providers**, enable **Google** (provide your Google Client ID and Secret).
5. From **Project Settings** -> **API**, grab your Project URL, anon key, service_role key, and JWT Secret.

### 2. Gmail App Password Setup
1. Open your Google Account -> **Security**.
2. Ensure **2-Step Verification** is ON.
3. Search for **App passwords**, create one named "Task Management", and copy the 16-character code.

### 3. Backend Setup (Flask)
```bash
cd backend
python -m venv venv
# Activate virtual environment:
# Windows:
.\venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate

pip install -r requirements.txt
cp .env.example .env
# Edit .env with your Supabase credentials and Gmail App Password
python app.py
```
*API runs at `http://localhost:5000`.*

### 4. Frontend Setup (Next.js)
```bash
cd frontend
npm install
cp .env.local.example .env.local
# Edit .env.local with your NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
npm run dev
```
*Web app runs at `http://localhost:3000`.*

---

## 🎓 Preparing for Your Technical Interview

Make sure to read **[INTERVIEW_GUIDE.md](file:///d:/assugnment/INTERVIEW_GUIDE.md)**! It provides:
- Exact data flow diagrams and OAuth 2.0 handshake explanations
- Database design decisions (`ON DELETE CASCADE` vs `SET NULL`, B-Tree indexes, RLS)
- Why Flask uses Blueprints and asynchronous Python `threading` for SMTP
- 25 anticipated interview questions with detailed, high-scoring model answers
