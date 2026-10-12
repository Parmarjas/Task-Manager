'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Navbar from '../components/Navbar';
import TaskCard from '../components/TaskCard';
import TaskModal from '../components/TaskModal';
import { Task, TaskFilter, TaskFormData, TaskStatus, UserProfile } from '../lib/types';
import { supabase } from '../lib/supabase';
import { getTasks, createTask, updateTask, deleteTask, getAllUsers } from '../lib/api';
import {
  Plus,
  CheckCircle2,
  Clock,
  ListTodo,
  AlertTriangle,
  Search,
  X,
} from 'lucide-react';
import Link from 'next/link';

const CACHE_KEY_TASKS = 'taskflow_cached_tasks';
const CACHE_KEY_USERS = 'taskflow_cached_users';

export default function DashboardPage() {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<TaskFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Helper to persist cached tasks in browser storage for instant reloads
  const saveTasksToCache = (newTasks: Task[]) => {
    try {
      localStorage.setItem(CACHE_KEY_TASKS, JSON.stringify(newTasks));
    } catch {}
  };

  // 1. Initial Load: Stale-While-Revalidate (Instant display from cache on refresh)
  useEffect(() => {
    try {
      const cachedTasksRaw = localStorage.getItem(CACHE_KEY_TASKS);
      if (cachedTasksRaw) {
        const parsed = JSON.parse(cachedTasksRaw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setTasks(parsed);
          setLoading(false); // Instantly show cached tasks without blank flicker
        }
      }

      const cachedUsersRaw = localStorage.getItem(CACHE_KEY_USERS);
      if (cachedUsersRaw) {
        const parsedUsers = JSON.parse(cachedUsersRaw);
        if (Array.isArray(parsedUsers)) {
          setUsers(parsedUsers);
        }
      }
    } catch {}
  }, []);

  // 2. Auth Session Check & Background Synchronization
  useEffect(() => {
    const initAuth = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (data.session?.user) {
          const u = data.session.user;
          const userObj: UserProfile = {
            id: u.id,
            email: u.email || '',
            full_name:
              u.user_metadata?.full_name ||
              u.user_metadata?.name ||
              u.email?.split('@')[0] ||
              'User',
            avatar_url: u.user_metadata?.avatar_url || u.user_metadata?.picture || '',
          };
          setCurrentUser(userObj);
        } else {
          setLoading(false);
        }
      } catch (err) {
        console.warn('Auth session check:', err);
        setLoading(false);
      }
    };

    initAuth();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        const u = session.user;
        setCurrentUser({
          id: u.id,
          email: u.email || '',
          full_name:
            u.user_metadata?.full_name ||
            u.user_metadata?.name ||
            u.email?.split('@')[0] ||
            'User',
          avatar_url: u.user_metadata?.avatar_url || u.user_metadata?.picture || '',
        });
      } else {
        setCurrentUser(null);
        setTasks([]);
        try {
          localStorage.removeItem(CACHE_KEY_TASKS);
        } catch {}
      }
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  // 3. Fast Data Fetching: Tasks are fetched first to display immediately
  const loadData = useCallback(async () => {
    if (!currentUser) return;
    try {
      // Fetch tasks independently for fastest possible render
      const fetchedTasks = await getTasks().catch(() => []);
      setTasks(fetchedTasks);
      saveTasksToCache(fetchedTasks);
      setLoading(false);

      // Fetch users list in background for assignment dropdown
      getAllUsers()
        .then((u) => {
          setUsers(u);
          try {
            localStorage.setItem(CACHE_KEY_USERS, JSON.stringify(u));
          } catch {}
        })
        .catch(() => {});
    } catch (err) {
      console.warn('Backend fetch note:', err);
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    if (currentUser) {
      loadData();
    }
  }, [currentUser, loadData]);

  // 4. Handle task creation or update with instant UI feedback
  const handleSaveTask = async (formData: TaskFormData) => {
    if (!currentUser) return;

    if (editingTask) {
      // Optimistic update for edit
      const updated = await updateTask(editingTask.id, formData);
      const assigneeObj = users.find((u) => u.id === updated.assigned_to) || null;
      const fullUpdated = { ...updated, assignee: assigneeObj };

      setTasks((prev) => {
        const next = prev.map((t) => (t.id === fullUpdated.id ? fullUpdated : t));
        saveTasksToCache(next);
        return next;
      });
      setNotice('Task updated successfully.');
    } else {
      // Create task
      const created = await createTask(formData);
      const assigneeObj = users.find((u) => u.id === created.assigned_to) || null;
      const fullCreated = { ...created, assignee: assigneeObj };

      setTasks((prev) => {
        const next = [fullCreated, ...prev];
        saveTasksToCache(next);
        return next;
      });
      setNotice(
        formData.assigned_to
          ? 'Task created! Gmail notification dispatched to assignee.'
          : 'Task created successfully.'
      );
    }
    setEditingTask(null);
    setTimeout(() => setNotice(null), 5000);
  };

  // 5. Status toggle (todo -> in_progress -> completed) with instant optimistic update
  const handleStatusChange = async (taskId: string, newStatus: TaskStatus) => {
    // 0ms instant UI update
    setTasks((prev) => {
      const next = prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t));
      saveTasksToCache(next);
      return next;
    });

    try {
      const updated = await updateTask(taskId, { status: newStatus });
      setTasks((prev) => {
        const next = prev.map((t) => (t.id === taskId ? { ...t, ...updated } : t));
        saveTasksToCache(next);
        return next;
      });

      if (newStatus === 'completed') {
        setNotice('Task marked as completed! Gmail notification sent.');
        setTimeout(() => setNotice(null), 5000);
      }
    } catch (err) {
      console.error('Failed to change task status:', err);
      loadData();
    }
  };

  // 6. Instant Optimistic Task Deletion (Zero lag, no double-click error)
  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('Are you sure you want to delete this task?')) return;

    // Immediately remove from UI (0ms latency!)
    setTasks((prev) => {
      const next = prev.filter((t) => t.id !== taskId);
      saveTasksToCache(next);
      return next;
    });
    setNotice('Task deleted.');
    setTimeout(() => setNotice(null), 3000);

    // Call backend in the background
    try {
      await deleteTask(taskId);
    } catch (err) {
      console.warn('Background delete note:', err);
    }
  };

  // Filter tasks based on active tab and search
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (filter === 'completed' && t.status !== 'completed') return false;
      if (filter === 'created_by_me' && t.created_by !== currentUser?.id) return false;
      if (filter === 'assigned_to_me' && t.assigned_to !== currentUser?.id) return false;

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const titleMatch = t.title.toLowerCase().includes(query);
        const descMatch = t.description?.toLowerCase().includes(query);
        return titleMatch || descMatch;
      }
      return true;
    });
  }, [tasks, filter, searchQuery, currentUser]);

  // Metric counts
  const stats = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter((t) => t.status === 'completed').length;
    const inProgress = tasks.filter((t) => t.status === 'in_progress').length;
    const pending = tasks.filter((t) => t.status === 'todo').length;
    return { total, completed, inProgress, pending };
  }, [tasks]);

  return (
    <>
      <Navbar user={currentUser} onLogout={() => setCurrentUser(null)} />

      <main className="main-container">
        {/* Floating Toast Notification (Zero layout shift) */}
        {notice && (
          <div className="toast-container">
            <div style={{ color: '#34d399', display: 'flex', alignItems: 'center' }}>
              <CheckCircle2 size={18} />
            </div>
            <span style={{ flex: 1 }}>{notice}</span>
            <button
              onClick={() => setNotice(null)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
              }}
              title="Dismiss"
            >
              <X size={15} />
            </button>
          </div>
        )}

        {!currentUser && !loading ? (
          <div className="login-card" style={{ margin: '60px auto' }}>
            <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '12px' }}>
              Task Management Workspace
            </h1>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '28px' }}>
              Sign in with your Google account to create tasks, assign teammates, and receive
              automated Gmail notifications.
            </p>
            <Link href="/login" className="btn btn-google" style={{ display: 'inline-flex' }}>
              Sign in with Google OAuth
            </Link>
          </div>
        ) : (
          <>
            {/* Hero Header */}
            <header className="hero-header">
              <div className="hero-title-row">
                <div>
                  <h1 className="hero-title">
                    Welcome, {currentUser?.full_name || 'Team Member'}
                  </h1>
                  <p className="hero-subtitle">
                    Manage your workflow, track assignments, and collaborate in real-time.
                  </p>
                </div>
                <button
                  onClick={() => {
                    setEditingTask(null);
                    setIsModalOpen(true);
                  }}
                  className="btn btn-primary"
                >
                  <Plus size={18} />
                  <span>Create Task</span>
                </button>
              </div>
            </header>

            {/* Metrics Grid */}
            <section className="stats-grid">
              <div className="stat-card">
                <div
                  className="stat-icon-wrapper"
                  style={{ background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8' }}
                >
                  <ListTodo size={22} />
                </div>
                <div>
                  <div className="stat-val">{stats.total}</div>
                  <div className="stat-lbl">Total Tasks</div>
                </div>
              </div>

              <div className="stat-card">
                <div
                  className="stat-icon-wrapper"
                  style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24' }}
                >
                  <Clock size={22} />
                </div>
                <div>
                  <div className="stat-val">{stats.inProgress}</div>
                  <div className="stat-lbl">In Progress</div>
                </div>
              </div>

              <div className="stat-card">
                <div
                  className="stat-icon-wrapper"
                  style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399' }}
                >
                  <CheckCircle2 size={22} />
                </div>
                <div>
                  <div className="stat-val">{stats.completed}</div>
                  <div className="stat-lbl">Completed</div>
                </div>
              </div>

              <div className="stat-card">
                <div
                  className="stat-icon-wrapper"
                  style={{ background: 'rgba(148, 163, 184, 0.15)', color: '#94a3b8' }}
                >
                  <AlertTriangle size={22} />
                </div>
                <div>
                  <div className="stat-val">{stats.pending}</div>
                  <div className="stat-lbl">To-Do</div>
                </div>
              </div>
            </section>

            {/* Controls Bar */}
            <div className="controls-bar">
              <div className="filter-tabs">
                <button
                  onClick={() => setFilter('all')}
                  className={`filter-tab ${filter === 'all' ? 'active' : ''}`}
                >
                  All ({tasks.length})
                </button>
                <button
                  onClick={() => setFilter('assigned_to_me')}
                  className={`filter-tab ${filter === 'assigned_to_me' ? 'active' : ''}`}
                >
                  Assigned to Me
                </button>
                <button
                  onClick={() => setFilter('created_by_me')}
                  className={`filter-tab ${filter === 'created_by_me' ? 'active' : ''}`}
                >
                  Created by Me
                </button>
                <button
                  onClick={() => setFilter('completed')}
                  className={`filter-tab ${filter === 'completed' ? 'active' : ''}`}
                >
                  Completed ({stats.completed})
                </button>
              </div>

              <div style={{ position: 'relative', minWidth: '240px' }}>
                <Search
                  size={16}
                  style={{
                    position: 'absolute',
                    left: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--text-muted)',
                  }}
                />
                <input
                  type="text"
                  placeholder="Search tasks..."
                  className="form-input"
                  style={{ paddingLeft: '36px', height: '38px', fontSize: '0.875rem' }}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            {/* Tasks Grid */}
            {loading && tasks.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
                Loading your tasks...
              </div>
            ) : filteredTasks.length === 0 ? (
              <div className="empty-state">
                <h3 className="empty-state-title">No tasks found</h3>
                <p className="empty-state-desc">
                  {searchQuery
                    ? 'No tasks match your search query.'
                    : filter === 'all'
                    ? 'Get started by creating your first task.'
                    : 'No tasks match this filter criteria.'}
                </p>
                <button
                  onClick={() => {
                    setEditingTask(null);
                    setIsModalOpen(true);
                  }}
                  className="btn btn-primary"
                >
                  <Plus size={16} />
                  <span>Create Task</span>
                </button>
              </div>
            ) : (
              <section className="tasks-grid">
                {filteredTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    currentUser={currentUser}
                    onStatusChange={handleStatusChange}
                    onEdit={(t) => {
                      setEditingTask(t);
                      setIsModalOpen(true);
                    }}
                    onDelete={handleDeleteTask}
                  />
                ))}
              </section>
            )}

            {/* Task Creation & Edit Modal */}
            <TaskModal
              isOpen={isModalOpen}
              onClose={() => {
                setIsModalOpen(false);
                setEditingTask(null);
              }}
              onSubmit={handleSaveTask}
              users={users}
              initialData={
                editingTask
                  ? {
                      title: editingTask.title,
                      description: editingTask.description,
                      priority: editingTask.priority,
                      status: editingTask.status,
                      assigned_to: editingTask.assigned_to || '',
                      due_date: editingTask.due_date || '',
                    }
                  : undefined
              }
            />
          </>
        )}
      </main>
    </>
  );
}
