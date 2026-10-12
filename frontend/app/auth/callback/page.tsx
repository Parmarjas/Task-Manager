'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabase';

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    // Process Supabase OAuth session from URL hash / exchange code
    const handleAuth = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;

        if (data.session) {
          router.replace('/');
        } else {
          // If no session found yet, wait for onAuthStateChange
          const { data: authListener } = supabase.auth.onAuthStateChange(
            (event, session) => {
              if (session) {
                authListener.subscription.unsubscribe();
                router.replace('/');
              }
            }
          );
        }
      } catch (err) {
        console.error('OAuth callback error:', err);
        router.replace('/login');
      }
    };

    handleAuth();
  }, [router]);

  return (
    <div
      style={{
        minHeight: '80vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '16px',
        color: 'var(--text-secondary)',
      }}
    >
      <div
        style={{
          width: '40px',
          height: '40px',
          border: '3px solid rgba(99, 102, 241, 0.2)',
          borderTopColor: 'var(--brand-primary)',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }}
      />
      <p style={{ fontWeight: 600 }}>Authenticating with Google...</p>
      <style jsx>{`
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}
