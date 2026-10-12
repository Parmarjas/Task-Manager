'use client';

import React from 'react';
import { Task, TaskStatus, UserProfile } from '../lib/types';
import {
  CheckCircle2,
  Circle,
  Clock,
  Trash2,
  Edit2,
  Calendar,
  UserCheck,
} from 'lucide-react';

interface TaskCardProps {
  task: Task;
  currentUser: UserProfile | null;
  onStatusChange: (taskId: string, newStatus: TaskStatus) => void;
  onEdit: (task: Task) => void;
  onDelete: (taskId: string) => void;
}

export default function TaskCard({
  task,
  currentUser,
  onStatusChange,
  onEdit,
  onDelete,
}: TaskCardProps) {
  const isCompleted = task.status === 'completed';
  const isCreator = currentUser?.id === task.created_by;

  const handleToggleStatus = () => {
    let nextStatus: TaskStatus = 'todo';
    if (task.status === 'todo') nextStatus = 'in_progress';
    else if (task.status === 'in_progress') nextStatus = 'completed';
    else nextStatus = 'todo';

    onStatusChange(task.id, nextStatus);
  };

  const formattedDueDate = task.due_date
    ? new Date(task.due_date).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      })
    : null;

  return (
    <div className={`task-card priority-${task.priority}`}>
      <div>
        <div className="task-card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={handleToggleStatus}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: isCompleted ? 'var(--accent-emerald)' : 'var(--text-muted)',
                padding: '2px',
                display: 'flex',
                alignItems: 'center',
              }}
              title={`Status: ${task.status} (Click to advance)`}
            >
              {isCompleted ? (
                <CheckCircle2 size={22} />
              ) : task.status === 'in_progress' ? (
                <Clock size={22} color="var(--brand-primary)" />
              ) : (
                <Circle size={22} />
              )}
            </button>
            <span className={`badge badge-${task.status}`}>{task.status.replace('_', ' ')}</span>
          </div>

          <span className={`badge badge-${task.priority}`}>{task.priority}</span>
        </div>

        <h3 className={`task-card-title ${isCompleted ? 'completed' : ''}`}>
          {task.title}
        </h3>

        {task.description && <p className="task-card-desc">{task.description}</p>}
      </div>

      <div>
        <div className="task-card-meta">
          <div className="meta-user-info">
            {task.assignee ? (
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  color: 'var(--text-secondary)',
                }}
                title={`Assigned to: ${task.assignee.email}`}
              >
                <UserCheck size={14} color="var(--brand-primary)" />
                <span>{task.assignee.full_name || task.assignee.email.split('@')[0]}</span>
              </span>
            ) : (
              <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
                Unassigned
              </span>
            )}
          </div>

          {formattedDueDate && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                color: 'var(--text-muted)',
              }}
            >
              <Calendar size={13} />
              <span>{formattedDueDate}</span>
            </div>
          )}
        </div>

        <div className="task-actions">
          <button
            onClick={() => onEdit(task)}
            className="btn btn-secondary"
            style={{ padding: '6px 12px', fontSize: '0.8rem', flex: 1 }}
          >
            <Edit2 size={13} />
            <span>Edit</span>
          </button>

          {isCreator && (
            <button
              onClick={() => onDelete(task.id)}
              className="btn btn-danger"
              style={{ padding: '6px 10px', fontSize: '0.8rem' }}
              title="Delete task"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
