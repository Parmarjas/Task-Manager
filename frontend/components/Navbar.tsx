'use client';

import React from 'react';
import Link from 'next/link';
import { UserProfile } from '../lib/types';
import { signOutUser } from '../lib/supabase';
import { LogOut, CheckSquare } from 'lucide-react';

interface NavbarProps {
  user: UserProfile | null;
  onLogout?: () => void;
}

export default function Navbar({ user, onLogout }: NavbarProps) {
  const handleLogout = async () => {
    try {
      await signOutUser();
      if (onLogout) onLogout();
      window.location.href = '/login';
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  const initials = user?.full_name
    ? user.full_name
        .split(' ')
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : user?.email?.[0]?.toUpperCase() || 'U';

  return (
    <nav className="navbar">
      <div className="nav-container">
        <Link href="/" className="nav-logo">
          <div className="logo-badge">
            <CheckSquare size={18} />
          </div>
          <span>TaskFlow</span>
        </Link>

        <div className="nav-actions">
          {user ? (
            <>
              <div className="user-profile-badge">
                {user.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={user.avatar_url}
                    alt={user.full_name || user.email}
                    className="user-avatar"
                  />
                ) : (
                  <div className="user-avatar">{initials}</div>
                )}
                <div>
                  <div style={{ fontWeight: 600 }}>{user.full_name || user.email}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{user.email}</div>
                </div>
              </div>

              <button
                onClick={handleLogout}
                className="btn btn-secondary"
                style={{ padding: '8px 14px' }}
                title="Sign Out"
              >
                <LogOut size={16} />
                <span>Logout</span>
              </button>
            </>
          ) : (
            <Link href="/login" className="btn btn-primary">
              Sign In
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
