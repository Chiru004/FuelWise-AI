
import { useState } from 'react';
import { supabase } from './lib/supabaseClient';
import './Auth.css';

export default function Auth() {
  const [isSignup, setIsSignup] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      if (isSignup) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: name },
          },
        });

        if (error) throw error;

        if (data.session) {
          setMessage('Account created successfully!');
        } else {
          setMessage('Account created! Check your email to verify your account.');
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;
      }
    } catch (error) {
      setMessage(error.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="auth-logo">FW</div>
        <p className="auth-eyebrow">SMARTER DRIVING STARTS HERE</p>
        <h1>{isSignup ? 'Create your account' : 'Welcome back'}</h1>
        <p className="auth-subtitle">
          {isSignup
            ? 'Start tracking your fuel expenses with FuelWise AI.'
            : 'Sign in to continue to your FuelWise dashboard.'}
        </p>

        <form onSubmit={handleSubmit}>
          {isSignup && (
            <label>
              Full name
              <input
                type="text"
                placeholder="Your full name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoComplete="name"
              />
            </label>
          )}

          <label>
            Email address
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </label>

          <label>
            Password
            <input
              type="password"
              placeholder="At least 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete={isSignup ? 'new-password' : 'current-password'}
            />
          </label>

          <button type="submit" disabled={loading}>
            {loading
              ? 'Please wait...'
              : isSignup
                ? 'Create account'
                : 'Sign in'}
          </button>
        </form>

        {message && (
          <p className="auth-message" role="status">{message}</p>
        )}

        <p className="auth-switch">
          {isSignup ? 'Already have an account?' : "Don't have an account?"}
          {' '}
          <button
            type="button"
            className="auth-link"
            onClick={() => {
              setIsSignup(!isSignup);
              setMessage('');
            }}
          >
            {isSignup ? 'Sign in' : 'Sign up'}
          </button>
        </p>
      </section>
    </main>
  );
}
