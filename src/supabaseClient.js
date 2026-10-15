import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://bclbyuizdcwiorhgjtjf.supabase.co';
const supabaseAnonKey = 'sb_publisible_ubkRU8qafntbWXbPBQcR6g_mzOE8r7O';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false
  }
});