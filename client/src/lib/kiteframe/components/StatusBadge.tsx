import '../styles/StatusBadge.css';
import type { NodeStatus } from '../types';
import { CheckCircle2, Clock, ListTodo } from 'lucide-react';

interface StatusBadgeProps {
  status?: NodeStatus;
  onClick?: () => void;
  disabled?: boolean;
}

export function StatusBadge({ status, onClick, disabled }: StatusBadgeProps) {
  const label =
    status === 'inprogress'
      ? 'In Progress'
      : status === 'done'
      ? 'Done'
      : 'To Do';

  const icon =
    status === 'inprogress'
      ? <Clock size={16} />
      : status === 'done'
      ? <CheckCircle2 size={16} />
      : <ListTodo size={16} />;

  return (
    <button
      className={`kf-status-badge kf-${status ?? 'todo'} ${disabled ? 'kf-disabled' : ''}`}
      onClick={(e) => {
        e.stopPropagation();
        if (!disabled && onClick) onClick();
      }}
      disabled={disabled}
      type="button"
      data-testid="status-badge"
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
