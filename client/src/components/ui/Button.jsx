import { Link } from 'react-router-dom';

export function Button({ children, variant = 'primary', className = '', ...props }) {
  return (
    <button className={`button button-${variant} ${className}`.trim()} {...props}>
      {children}
    </button>
  );
}

export function ButtonLink({ children, variant = 'primary', className = '', ...props }) {
  return (
    <Link className={`button button-${variant} ${className}`.trim()} {...props}>
      {children}
    </Link>
  );
}
