import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://bclbyuizdcwiorhgjtjf.supabase.co/rest/v1/'; // Tu URL de Supabase
const supabaseAnonKey = 'sb_publisible_ubkRU8qafntbWXbPBQcR6g_mzOE8r7O';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false
  }
});