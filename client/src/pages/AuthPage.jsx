import { ArrowLeft, ArrowRight, Check, LockKeyhole, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import { BrandMark } from '../components/BrandMark.jsx';
import { ThemeToggle } from '../components/ThemeToggle.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Field } from '../components/ui/Field.jsx';
import { useAuth } from '../context/authContext.js';

const initialForm = { name: '', email: '', password: '', confirmPassword: '' };

function mapServerErrors(error) {
  const details = error.details;
  if (!Array.isArray(details)) return {};

  return details.reduce((fields, detail) => {
    fields[detail.field] = detail.message;
    return fields;
  }, {});
}

export function AuthPage({ mode }) {
  const isRegister = mode === 'register';
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login, register } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: undefined }));
    setSubmitError('');
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const nextErrors = {};

    if (isRegister && form.name.trim().length < 2) {
      nextErrors.name = 'Enter at least 2 characters.';
    }
    if (!form.email.trim()) nextErrors.email = 'Email is required.';
    if (form.password.length < (isRegister ? 10 : 1)) {
      nextErrors.password = isRegister
        ? 'Password must contain at least 10 characters.'
        : 'Password is required.';
    }
    if (isRegister && form.password !== form.confirmPassword) {
      nextErrors.confirmPassword = 'Passwords do not match.';
    }

    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }

    setIsSubmitting(true);
    setSubmitError('');

    try {
      if (isRegister) {
        await register({
          name: form.name.trim(),
          email: form.email.trim(),
          password: form.password,
        });
      } else {
        await login({ email: form.email.trim(), password: form.password });
      }

      const destination = location.state?.from?.startsWith('/')
        ? location.state.from
        : '/dashboard';
      navigate(destination, { replace: true });
    } catch (error) {
      setErrors(mapServerErrors(error));
      setSubmitError(error.message || 'Authentication could not be completed.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-story" aria-label="NutriLens authentication overview">
        <div className="auth-story-topbar">
          <BrandMark tone="dark" />
          <ThemeToggle />
        </div>
        <div className="auth-story-copy">
          <p className="eyebrow">Your nutrition, kept personal</p>
          <h1>
            {isRegister ? 'A clearer food story starts here.' : 'Welcome back to your daily lens.'}
          </h1>
          <p>
            Every meal, daily total, and historical entry belongs only to your authenticated
            account.
          </p>
          <ul>
            <li>
              <Check size={16} aria-hidden="true" /> Passwords are securely hashed
            </li>
            <li>
              <Check size={16} aria-hidden="true" /> Session tokens stay out of browser storage
            </li>
            <li>
              <Check size={16} aria-hidden="true" /> Every food query is scoped to your identity
            </li>
          </ul>
        </div>
        <p className="auth-story-note">
          <ShieldCheck size={17} aria-hidden="true" /> Protected by a short-lived, secure session.
        </p>
      </section>

      <section className="auth-form-panel">
        <div className="auth-form-shell">
          <Link className="auth-back-link" to="/">
            <ArrowLeft size={16} aria-hidden="true" /> Back to NutriLens
          </Link>
          <div className="auth-form-heading">
            <span className="auth-lock">
              <LockKeyhole size={20} aria-hidden="true" />
            </span>
            <h2>{isRegister ? 'Create your account' : 'Log in to NutriLens'}</h2>
            <p>
              {isRegister
                ? 'Begin with a secure account for your personal food history.'
                : 'Continue tracking your meals and daily progress.'}
            </p>
          </div>

          <form className="auth-form" onSubmit={handleSubmit} noValidate>
            {isRegister && (
              <Field
                name="name"
                label="Name"
                autoComplete="name"
                value={form.name}
                onChange={updateField}
                error={errors.name}
                placeholder="Your name"
              />
            )}
            <Field
              name="email"
              type="email"
              label="Email address"
              autoComplete="email"
              value={form.email}
              onChange={updateField}
              error={errors.email}
              placeholder="you@example.com"
            />
            <Field
              name="password"
              type="password"
              label="Password"
              autoComplete={isRegister ? 'new-password' : 'current-password'}
              value={form.password}
              onChange={updateField}
              error={errors.password}
              hint={isRegister ? 'Use at least 10 characters.' : undefined}
              placeholder="Enter your password"
            />
            {isRegister && (
              <Field
                name="confirmPassword"
                type="password"
                label="Confirm password"
                autoComplete="new-password"
                value={form.confirmPassword}
                onChange={updateField}
                error={errors.confirmPassword}
                placeholder="Repeat your password"
              />
            )}

            {submitError && (
              <div className="auth-error" role="alert">
                {submitError}
              </div>
            )}

            <Button className="auth-submit" type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Please wait…' : isRegister ? 'Create secure account' : 'Log in'}
              {!isSubmitting && <ArrowRight size={17} aria-hidden="true" />}
            </Button>
          </form>

          <p className="auth-switch">
            {isRegister ? 'Already have an account?' : 'New to NutriLens?'}{' '}
            <Link to={isRegister ? '/login' : '/register'}>
              {isRegister ? 'Log in' : 'Create an account'}
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
