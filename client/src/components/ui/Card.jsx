export function Card({ children, className = '', as: Element = 'article' }) {
  return <Element className={`card ${className}`.trim()}>{children}</Element>;
}
