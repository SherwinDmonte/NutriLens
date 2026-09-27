import { useId } from 'react';

export function Field({ label, hint, error, id: providedId, className = '', ...inputProps }) {
  const generatedId = useId();
  const inputId = providedId || generatedId;
  const messageId = `${inputId}-message`;

  return (
    <label className={`field ${className}`.trim()} htmlFor={inputId}>
      <span className="field-label">{label}</span>
      <input
        id={inputId}
        className="field-input"
        aria-describedby={hint || error ? messageId : undefined}
        aria-invalid={Boolean(error)}
        {...inputProps}
      />
      {(error || hint) && (
        <span className={`field-message ${error ? 'field-error' : ''}`} id={messageId}>
          {error || hint}
        </span>
      )}
    </label>
  );
}
