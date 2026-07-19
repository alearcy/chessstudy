import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/database.types";

function requireBrowserEnv(name: string, value: string | undefined): string {
  if (!value?.trim()) {
    throw new Error(`Configurazione mancante: ${name}.`);
  }
  return value;
}

const supabaseUrl = requireBrowserEnv(
  "VITE_SUPABASE_URL",
  import.meta.env.VITE_SUPABASE_URL,
);
const supabasePublishableKey = requireBrowserEnv(
  "VITE_SUPABASE_PUBLISHABLE_KEY",
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
);

export const supabase = createClient<Database>(supabaseUrl, supabasePublishableKey, {
  auth: {
    autoRefreshToken: true,
    detectSessionInUrl: true,
    persistSession: true,
  },
});
