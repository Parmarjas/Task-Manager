'use client';

import React, { useState, useEffect } from 'react';
import { TaskFormData, TaskPriority, TaskStatus, UserProfile } from '../lib/types';
import { X, AlertCircle, Lock } from 'lucide-react';

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: TaskFormData) => Promise<void>;
  users: UserProfile[];
  initialData?: Partial<TaskFormData>;
}

export default function TaskModal({
  isOpen,
  onClose,
  onSubmit,
  users,
  initialData,
}: TaskModalProps) {
  const [formData, setFormData] = useState<TaskFormData>({
    title: '',
    description: '',
    priority: 'medium',
    status: 'todo',
    assigned_to: '',
    due_date: '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (initialData) {
      setFormData({
        title: initialData.title || '',
        description: initialData.description || '',
        priority: initialData.priority || 'medium',
        status: initialData.status || 'todo',
        assigned_to: initialData.assigned_to || '',
        due_date: initialData.due_date ? initialData.due_date.split('T')[0] : '',
      });
    } else {
      setFormData({
        title: '',
        description: '',
        priority: 'medium',
        status: 'todo',
        assigned_to: '',
        due_date: '',
      });
    }
    setError('');
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const isCompleted = formData.status === 'completed';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      setError('Task title is required');
      return;
    }

    try {
      setLoading(true);
      setError('');
      await onSubmit(formData);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred while saving the task');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">
            {initialData ? 'Edit Task' : 'Create New Task'}
          </h2>
          <button
            onClick={onClose}
            className="btn btn-secondary"
            style={{ padding: '6px', borderRadius: '50%' }}
          >
            <X size={18} />
          </button>
        </div>

        {error && (
          <div
            style={{
              padding: '12px',
              borderRadius: '8px',
              backgroundColor: 'rgba(244, 63, 94, 0.15)',
              border: '1px solid rgba(244, 63, 94, 0.3)',
              color: '#fda4af',
              fontSize: '0.875rem',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="task-title">
              Task Title *
            </label>
            <input
              id="task-title"
              type="text"
              className="form-input"
              placeholder="e.g. Design database schema for user profiles"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="task-desc">
              Description
            </label>
            <textarea
              id="task-desc"
              rows={3}
              className="form-textarea"
              placeholder="Add key context, requirements, or links..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: initialData ? '1fr 1fr' : '1fr', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label" htmlFor="task-priority">
                Priority
              </label>
              <select
                id="task-priority"
                className="form-select"
                value={formData.priority}
                onChange={(e) =>
                  setFormData({ ...formData, priority: e.target.value as TaskPriority })
                }
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>

            {initialData && (
              <div className="form-group">
                <label className="form-label" htmlFor="task-status">
                  Status
                </label>
                <select
                  id="task-status"
                  className="form-select"
                  value={formData.status}
                  onChange={(e) =>
                    setFormData({ ...formData, status: e.target.value as TaskStatus })
                  }
                >
                  <option value="todo">To-Do</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
            )}
          </div>

          <div className="form-group">
            <label
              className="form-label"
              htmlFor="task-assignee"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
            >
              <span>Assign To (Sends Gmail notification)</span>
              {isCompleted && (
                <span style={{ color: '#fda4af', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Lock size={12} />
                  Completed (assignment locked)
                </span>
              )}
            </label>
            <select
              id="task-assignee"
              className="form-select"
              value={formData.assigned_to || ''}
              disabled={isCompleted}
              style={{
                opacity: isCompleted ? 0.6 : 1,
                cursor: isCompleted ? 'not-allowed' : 'pointer',
              }}
              onChange={(e) => setFormData({ ...formData, assigned_to: e.target.value })}
            >
              <option value="">Unassigned</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name ? `${u.full_name} (${u.email})` : u.email}
                </option>
              ))}
            </select>
            {isCompleted && (
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                Completed tasks cannot be assigned. Change status back to To-Do or In Progress to reassign.
              </p>
            )}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="task-due-date">
              Due Date
            </label>
            <input
              id="task-due-date"
              type="date"
              className="form-input"
              value={formData.due_date || ''}
              onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
            />
          </div>

          <div className="modal-footer">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
              disabled={loading}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Saving...' : initialData ? 'Update Task' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
