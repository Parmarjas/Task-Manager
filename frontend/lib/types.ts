export type TaskStatus = 'todo' | 'in_progress' | 'completed';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  avatar_url?: string;
  created_at?: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  created_by: string;
  assigned_to?: string | null;
  due_date?: string | null;
  completed_at?: string | null;
  created_at: string;
  updated_at: string;
  creator?: UserProfile;
  assignee?: UserProfile | null;
}

export interface TaskFormData {
  title: string;
  description: string;
  priority: TaskPriority;
  status?: TaskStatus;
  assigned_to?: string;
  due_date?: string;
}

export type TaskFilter = 'all' | 'created_by_me' | 'assigned_to_me' | 'completed';
