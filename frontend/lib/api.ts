import { supabase } from './supabase';
import { Task, TaskFormData, UserProfile } from './types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

/**
 * Retrieves the current active JWT token from Supabase Auth session.
 */
async function getAuthHeader(): Promise<HeadersInit> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return headers;
}

/**
 * Fetches all tasks for the logged in user (created by or assigned to).
 */
export async function getTasks(status?: string, priority?: string): Promise<Task[]> {
  const headers = await getAuthHeader();
  const query = new URLSearchParams();
  if (status) query.append('status', status);
  if (priority) query.append('priority', priority);

  const res = await fetch(`${API_BASE_URL}/tasks?${query.toString()}`, {
    method: 'GET',
    headers,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to fetch tasks (HTTP ${res.status})`);
  }

  const data = await res.json();
  return data.tasks || [];
}

/**
 * Creates a new task. Flask backend will trigger an email notification
 * if an assignee is provided.
 */
export async function createTask(taskData: TaskFormData): Promise<Task> {
  const headers = await getAuthHeader();

  const res = await fetch(`${API_BASE_URL}/tasks`, {
    method: 'POST',
    headers,
    body: JSON.stringify(taskData),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to create task (HTTP ${res.status})`);
  }

  const data = await res.json();
  return data.task;
}

/**
 * Updates a task. If status is set to 'completed', Flask backend triggers
 * an email notification to creator and assignee.
 */
export async function updateTask(taskId: string, updates: Partial<Task>): Promise<Task> {
  const headers = await getAuthHeader();

  const res = await fetch(`${API_BASE_URL}/tasks/${taskId}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(updates),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to update task (HTTP ${res.status})`);
  }

  const data = await res.json();
  return data.task;
}

/**
 * Deletes a task by ID.
 */
export async function deleteTask(taskId: string): Promise<void> {
  const headers = await getAuthHeader();

  const res = await fetch(`${API_BASE_URL}/tasks/${taskId}`, {
    method: 'DELETE',
    headers,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to delete task (HTTP ${res.status})`);
  }
}

/**
 * Fetches all registered users to populate task assignee selection dropdown.
 */
export async function getAllUsers(): Promise<UserProfile[]> {
  const headers = await getAuthHeader();

  const res = await fetch(`${API_BASE_URL}/users`, {
    method: 'GET',
    headers,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to fetch users (HTTP ${res.status})`);
  }

  const data = await res.json();
  return data.users || [];
}
