import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key';

export const isSupabaseConfigured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder') &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.includes('placeholder')
);

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Initiates Google OAuth login flow with Supabase Auth.
 * Redirects the user to Google's consent screen.
 */
export async function signInWithGoogle() {
  if (!isSupabaseConfigured) {
    throw new Error(
      'Supabase credentials are not configured yet! Please create frontend/.env.local and set your NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.'
    );
  }

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${origin}/auth/callback`,
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
    },
  });

  if (error) {
    throw error;
  }
  return data;
}

/**
 * Signs out the current user and clears browser session storage.
 */
export async function signOutUser() {
  const { error } = await supabase.auth.signOut();
  if (error) {
    throw error;
  }
}
