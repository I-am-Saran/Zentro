import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

export const useSupabaseSession = () => {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 🔹 1. Get existing session
    const loadSession = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (error) console.error("Session error:", error);
      setSession(data?.session ?? null);
      setLoading(false);
    };
    loadSession();

    // 🔹 2. Listen for changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  return { session, loading };
};
