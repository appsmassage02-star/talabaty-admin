import { createClient } from '@supabase/supabase-js';

const metaEnv = (import.meta as any).env || {};

const REAL_SUPABASE_URL = 'https://itbfqpjwgjvvybffunkm.supabase.co';
const REAL_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml0YmZxcGp3Z2p2dnliZmZ1bmttIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA0NjE0NDEsImV4cCI6MjEwNjAzNzQ0MX0.pG3oqZURTwIqHD1SGv8eUMLZ3CgPpG2xOjO5vNDL6V4';

// Clean and validate URL: never allow placeholder.supabase.co or your-project
const rawUrl = metaEnv.VITE_SUPABASE_URL;
export const supabaseUrl: string =
  rawUrl && !rawUrl.includes('placeholder.supabase.co') && !rawUrl.includes('your-project.supabase.co')
    ? rawUrl
    : REAL_SUPABASE_URL;

const rawKey = metaEnv.VITE_SUPABASE_ANON_KEY;
export const supabaseAnonKey: string =
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
