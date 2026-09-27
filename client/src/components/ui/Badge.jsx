export function Badge({ children, tone = 'green', className = '' }) {
  return <span className={`badge badge-${tone} ${className}`.trim()}>{children}</span>;
}
