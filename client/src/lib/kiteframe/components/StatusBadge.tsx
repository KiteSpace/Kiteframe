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
    <button
      className={`kf-status-badge kf-${status ?? 'todo'} ${disabled ? 'kf-disabled' : ''}`}
      onClick={(e) => {
        e.stopPropagation();
        if (!disabled && onClick) onClick();
      }}
      disabled={disabled}
      type="button"
      data-testid="status-badge"
      style={{
        border: 'none',
        background: 'transparent',
        padding: '2px 8px',
        cursor: disabled ? 'default' : 'pointer',
      }}
    >
      <span className="dot" /> {label}
    </button>
  );
}
