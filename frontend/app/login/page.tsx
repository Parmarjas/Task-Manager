'use client';

import React, { useState } from 'react';
import { signInWithGoogle, isSupabaseConfigured } from '../../lib/supabase';
import { CheckSquare, Check, ShieldCheck, Mail, Users, AlertCircle } from 'lucide-react';

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      setError('');
      await signInWithGoogle();
      // Browser will redirect to Google's OAuth consent screen
    } catch (err: unknown) {
      console.error('Google OAuth error:', err);
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to initiate Google sign-in. Check Supabase credentials.'
      );
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '64px',
            height: '64px',
            borderRadius: '18px',
            background: 'var(--brand-gradient)',
            boxShadow: 'var(--brand-glow)',
            marginBottom: '20px',
            color: 'white',
          }}
        >
          <CheckSquare size={32} />
        </div>

        <h1 style={{ fontSize: '1.85rem', fontWeight: 800, marginBottom: '8px' }}>
          Welcome to TaskFlow
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
          Collaborative Task Management with Automated Gmail Notifications
        </p>

        {!isSupabaseConfigured && (
          <div
            style={{
              padding: '16px',
              borderRadius: '12px',
              backgroundColor: 'rgba(245, 158, 11, 0.12)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              color: '#fef3c7',
              fontSize: '0.85rem',
              marginTop: '20px',
              textAlign: 'left',
              lineHeight: 1.5,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#f59e0b', fontWeight: 700, marginBottom: '6px' }}>
              <AlertCircle size={18} />
              <span>Supabase Setup Required</span>
            </div>
            <p style={{ color: '#d1d5db', marginBottom: '8px' }}>
              To enable Google Sign-In, enter your Supabase project credentials in <strong>frontend/.env.local</strong>:
            </p>
            <div style={{ background: 'rgba(0,0,0,0.4)', padding: '10px', borderRadius: '6px', fontFamily: 'monospace', fontSize: '0.8rem', color: '#a5b4fc', wordBreak: 'break-all' }}>
              NEXT_PUBLIC_SUPABASE_URL=https://&lt;your-project-id&gt;.supabase.co<br />
              NEXT_PUBLIC_SUPABASE_ANON_KEY=&lt;your-anon-key&gt;
            </div>
          </div>
        )}

        {error && (
          <div
            style={{
              padding: '12px',
              borderRadius: '8px',
              backgroundColor: 'rgba(244, 63, 94, 0.15)',
              border: '1px solid rgba(244, 63, 94, 0.3)',
              color: '#fda4af',
              fontSize: '0.875rem',
              marginTop: '20px',
              textAlign: 'left',
            }}
          >
            {error}
          </div>
        )}

        <div className="login-feature-list">
          <div className="login-feature-item">
            <span className="feature-check">
              <Check size={12} />
            </span>
            <span>Single-sign-on with Google OAuth 2.0</span>
          </div>
          <div className="login-feature-item">
            <span className="feature-check">
              <Users size={12} />
            </span>
            <span>Assign tasks to teammates in real-time</span>
          </div>
          <div className="login-feature-item">
            <span className="feature-check">
              <Mail size={12} />
            </span>
            <span>Automated Gmail notifications on create & complete</span>
          </div>
          <div className="login-feature-item">
            <span className="feature-check">
              <ShieldCheck size={12} />
            </span>
            <span>Secure Supabase PostgreSQL Database with RLS</span>
          </div>
        </div>

        <button
          onClick={handleGoogleLogin}
          className="btn btn-google"
          style={{ width: '100%', marginTop: '8px' }}
          disabled={loading}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" style={{ marginRight: '8px' }}>
            <path
              fill="#4285F4"
              d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.65v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.14z"
            />
            <path
              fill="#34A853"
              d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.34 24 12 24z"
            />
            <path
              fill="#FBBC05"
              d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.98 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
            />
            <path
              fill="#EA4335"
              d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
            />
          </svg>
          <span>{loading ? 'Connecting to Google...' : 'Continue with Google'}</span>
        </button>

        <p style={{ marginTop: '24px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          By signing in, you agree to access your Task Management workspace.
        </p>
      </div>
    </div>
  );
}
