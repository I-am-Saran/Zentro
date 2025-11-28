// src/hooks/useAuth.js
import { useEffect, useState, createContext, useContext } from "react";
import { supabase } from "../supabaseClient";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Check Supabase Session (SSO)
    const initAuth = async () => {
      const { data: { session: sbSession } } = await supabase.auth.getSession();
      
      if (sbSession) {
        setSession(sbSession);
        setUser(sbSession.user);
      } else {
        // 2. Check Local Storage (Custom Auth)
        const localToken = localStorage.getItem("auth_token");
        const localUser = localStorage.getItem("auth_user");
        if (localToken && localUser) {
          try {
            setSession({ access_token: localToken, token_type: "bearer" });
            setUser(JSON.parse(localUser));
          } catch (e) {
            console.error("Failed to parse local user", e);
            localStorage.removeItem("auth_token");
            localStorage.removeItem("auth_user");
          }
        }
      }
      setLoading(false);
    };

    initAuth();

    // Listen for Supabase Auth changes
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setSession(session);
        setUser(session.user);
        // Clear local auth if Supabase takes over
        localStorage.removeItem("auth_token");
        localStorage.removeItem("auth_user");
      } else {
         // Only clear state if we don't have a local token fallback
         // But usually onAuthStateChange(SIGNED_OUT) means we should clear everything
         if (_event === "SIGNED_OUT") {
             setSession(null);
             setUser(null);
             localStorage.removeItem("auth_token");
             localStorage.removeItem("auth_user");
         }
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const loginCustom = (token, userData) => {
    localStorage.setItem("auth_token", token);
    localStorage.setItem("auth_user", JSON.stringify(userData));
    setSession({ access_token: token, token_type: "bearer" });
    setUser(userData);
  };

  const logout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem("auth_token");
    localStorage.removeItem("auth_user");
    setSession(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ session, user, loading, loginCustom, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
