import { CircleCheck, LoaderCircle } from 'lucide-react';

export function Toast({ children }) {
  return (
    <div className="toast" role="status">
      <CircleCheck size={18} aria-hidden="true" />
      {children}
    </div>
  );
}

export function LoadingSpinner({ label = 'Loading' }) {
  return (
    <span className="loading-spinner" role="status">
      <LoaderCircle size={18} aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </span>
  );
}

export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="empty-state">
      {Icon && <Icon size={26} aria-hidden="true" />}
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
