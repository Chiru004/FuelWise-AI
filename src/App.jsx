
import { useEffect, useState } from 'react';
import { supabase } from './lib/supabaseClient';
import Auth from './Auth';
import Dashboard from './Dashboard';

export default function App() {
  const [session, setSession] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    let mounted = true;

    async function loadSession() {
      const { data, error } = await supabase.auth.getSession();

      if (!mounted) return;

      if (error) {
        setAuthError(error.message);
      } else {
        setSession(data.session);
      }

      setCheckingSession(false);
    }

    loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (mounted) {
        setSession(newSession);
        setAuthError('');
        setCheckingSession(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function handleLogout() {
    setLoggingOut(true);
    setAuthError('');

    const { error } = await supabase.auth.signOut();

    if (error) {
      setAuthError(error.message);
    }

    setLoggingOut(false);
  }

  if (checkingSession) {
    return (
      <div className="auth-loading">
        <p>Loading FuelWise AI...</p>
      </div>
    );
  }

  if (!session) {
    return <Auth />;
  }

  return (
    <>
      <div className="session-toolbar">
        <span>
          Signed in as <strong>{session.user.email}</strong>
        </span>
        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
        >
          {loggingOut ? 'Signing out...' : 'Logout'}
        </button>
      </div>

      {authError && (
        <p className="session-error" role="alert">
          {authError}
        </p>
      )}

      <Dashboard />
    </>
  );
}
