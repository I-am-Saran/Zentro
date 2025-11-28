// src/supabaseClient.js
// Vite-friendly Supabase client with defensive checks.
// - Does NOT hardcode keys.
// - Tries multiple VITE_ prefixed env names (VITE_, VITE_API_, VITE_PUBLIC_).
// - If envs missing, exports a proxy that throws helpful errors when used.
//
// Remove / silence the console logs in production.

import { createClient } from "@supabase/supabase-js";

/**
 * Helper: read env keys from several possible prefixes to be tolerant to repo differences.
 * Vite exposes only env vars starting with the configured envPrefix (default 'VITE_').
 */
const readEnv = (name) =>
  import.meta.env[name] ??
  import.meta.env[`VITE_API_${name.replace(/^VITE_/, "")}`] ??
  import.meta.env[`VITE_PUBLIC_${name.replace(/^VITE_/, "")}`] ??
  undefined;

// primary names we expect (standard Vite)
const SUPABASE_URL =
  readEnv("VITE_SUPABASE_URL") ||
  readEnv("VITE_SUPABASE_URL".replace("VITE_", "VITE_API_")) ||
  readEnv("VITE_SUPABASE_URL".replace("VITE_", "VITE_PUBLIC_")) ||
  "";

// primary anon/public key name
const SUPABASE_ANON_KEY =
  readEnv("VITE_SUPABASE_ANON_KEY") ||
  readEnv("VITE_SUPABASE_ANON_KEY".replace("VITE_", "VITE_API_")) ||
  readEnv("VITE_SUPABASE_ANON_KEY".replace("VITE_", "VITE_PUBLIC_")) ||
  "";

/* Debug logs (remove in production)
   We mask the anon key when logging so secrets don't leak in console spam.
*/
console.log("import.meta.env keys:", Object.keys(import.meta.env));
console.log("Supabase URL present:", !!SUPABASE_URL, SUPABASE_URL ? SUPABASE_URL : "—");
console.log("Supabase ANON key present:", !!SUPABASE_ANON_KEY);

/**
 * If both url + key present -> create a real Supabase client.
 * Otherwise export a proxy that throws a clear message when used.
 */
let supabaseClient = null;

if (SUPABASE_URL && SUPABASE_ANON_KEY) {
  supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} else {
  // Provide a proxy so any attempt to call supabase.* surfaces a helpful error.
  const missingMsg = [
    "Supabase client NOT created: missing environment variables.",
    "Make sure your .env / .env.local contains:",
    "  VITE_SUPABASE_URL=https://your-project.supabase.co",
    "  VITE_SUPABASE_ANON_KEY=your_anon_key_here",
    "Then restart the dev server (Vite reads env at startup).",
  ].join(" ");

  // A Proxy that throws when any property is accessed or function called.
  supabaseClient = new Proxy(
    {},
    {
      get(_, prop) {
        throw new Error(
          `${missingMsg}\nAttempted to access supabase.${String(prop)} but the client hasn't been initialized.`
        );
      },
      apply() {
        throw new Error(missingMsg);
      },
    }
  );
}

// Export named export `supabase` (keep same API as before)
export const supabase = supabaseClient;

