import { Typography } from "@material-tailwind/react";
import {
  Bug,
  ListTodo,
  Users,
  Settings,
  ShieldCheck,
  LogOut,
  ChevronRight,
  Key,
} from "lucide-react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";

export default function TopNav({ open, onClose }) {
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      // Attempt local and global sign-out to clear any residual sessions
      await supabase.auth.signOut({ scope: "local" }).catch(() => {});
      await supabase.auth.signOut({ scope: "global" }).catch(() => {});
    } finally {
      // Clear persisted auth and app state regardless of API result
      try {
        Object.keys(localStorage)
          .filter((k) => k.startsWith("sb-"))
          .forEach((k) => localStorage.removeItem(k));
      } catch {}
      try { localStorage.clear(); } catch {}
      try { sessionStorage.clear(); } catch {}

      // Navigate and force reload to guarantee a clean slate
      navigate("/login", { replace: true });
      setTimeout(() => {
        try { window.location.replace("/login"); } catch {}
      }, 50);
    }
  };

  const navItems = [
    { to: "/bugs", icon: Bug, label: "Bugs" },
    { to: "/tasks", icon: ListTodo, label: "Tasks" },
    { to: "/transtracker", icon: ListTodo, label: "Transtracker" },
    { to: "/users", icon: Users, label: "Users" },
    { to: "/permissions", icon: Key, label: "Permissions" },
    { to: "/settings", icon: Settings, label: "Settings" },
  ];

  return (
    <aside
      className={`fixed inset-y-0 left-0 w-64 bg-gradient-to-b from-primary via-primary to-primaryDark text-white shadow-2xl transform transition-transform duration-300 z-30 flex flex-col justify-between ${
        open ? "translate-x-0" : "-translate-x-full sm:translate-x-0"
      }`}
    >
      {/* Top section */}
      <div>
        {/* Header with logo */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/10 bg-gradient-to-r from-primary to-primaryLight">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-accent to-accentLight flex items-center justify-center shadow-lg">
              <span className="text-lg font-bold text-white">⚗️</span>
            </div>
            <Typography variant="h6" className="font-bold text-white">
              Alchemy
            </Typography>
          </Link>
          <button
            aria-label="Close sidebar"
            className="md:hidden px-2 py-1 rounded-lg border border-white/20 hover:bg-white/10 transition-colors text-xs font-medium"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        {/* Navigation items */}
        <nav className="mt-6 px-3 space-y-2">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center justify-between gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-all duration-200 ${
                  isActive 
                    ? "bg-gradient-to-r from-accent/30 to-accent/20 text-white shadow-lg shadow-accent/20 border-l-4 border-accent" 
                    : "text-white/80 hover:text-white hover:bg-white/10"
                }`
              }
              onClick={onClose}
            >
              <div className="flex items-center gap-3">
                <Icon className="h-5 w-5" />
                <span>{label}</span>
              </div>
              <ChevronRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
            </NavLink>
          ))}
        </nav>

        {/* Stats summary */}
        <div className="mt-8 mx-3 p-4 rounded-lg bg-white/5 border border-white/10">
          <Typography className="text-xs font-semibold text-white/70 uppercase tracking-wide mb-3">
            Quick Stats
          </Typography>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-white/70">Active Tasks</span>
              <span className="font-bold text-accent">5</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-white/70">Bugs</span>
              <span className="font-bold text-accent">12</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-white/70">Users</span>
              <span className="font-bold text-accent">8</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom logout section */}
      <div className="border-t border-white/10 px-3 py-4 bg-gradient-to-t from-primaryDark/50 to-transparent">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-4 py-3 rounded-lg bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white text-sm font-semibold transition-all duration-200 shadow-lg hover:shadow-xl hover:shadow-red-600/30 active:scale-95"
        >
          <LogOut className="h-5 w-5" />
          <span>Logout</span>
        </button>
        <Typography className="text-xs text-white/50 mt-3 text-center">
          v1.0 • Alchemy GRC
        </Typography>
      </div>
    </aside>
  );
}
