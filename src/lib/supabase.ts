import { createClient } from '@supabase/supabase-js';

const metaEnv = (import.meta as any).env || {};

const REAL_SUPABASE_URL = 'https://ukwzixktqwmckytakdjx.supabase.co';
const REAL_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVrd3ppeGt0cXdtY2t5dGFrZGp4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc3MDc4ODEsImV4cCI6MjEwMzI4Mzg4MX0.V4CdV4yjlI5hjEooPV-zVP--xA1LnVgcMMknlO3UGZA';

// Clean and validate URL: never allow placeholder.supabase.co or your-project
const rawUrl = metaEnv.VITE_SUPABASE_URL;
const supabaseUrl: string =
  rawUrl && !rawUrl.includes('placeholder.supabase.co') && !rawUrl.includes('your-project.supabase.co')
    ? rawUrl
    : REAL_SUPABASE_URL;

const rawKey = metaEnv.VITE_SUPABASE_ANON_KEY;
const supabaseAnonKey: string =
  rawKey && !rawKey.includes('placeholder') && !rawKey.includes('your-anon-key')
    ? rawKey
    : REAL_SUPABASE_ANON_KEY;

export const isSupabaseConfigured: boolean = Boolean(
  supabaseUrl &&
  !supabaseUrl.includes('placeholder') &&
  supabaseAnonKey &&
  !supabaseAnonKey.includes('placeholder')
);

if (!isSupabaseConfigured) {
  console.warn('Supabase configuration is missing or invalid.');
}

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    })
  : (null as unknown as ReturnType<typeof createClient>);
