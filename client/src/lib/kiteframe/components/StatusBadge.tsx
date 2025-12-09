import '../styles/StatusBadge.css';
import type { NodeStatus } from '../types';

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

  return (
    <div
      className={`kf-status-badge kf-${status ?? 'todo'} ${disabled ? 'kf-disabled' : ''}`}
      onClick={disabled ? undefined : onClick}
      data-testid="status-badge"
    >
      <span className="dot" /> {label}
    </div>
  );
}
