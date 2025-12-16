import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

export default function ProtectedRoute({ children, moduleName }) {
  const { session, loading, role, allowedModules } = useAuth();

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center text-gray-600">
        Checking session...
      </div>
    );
  }

  if (!session) return <Navigate to="/login" replace />;

  if (moduleName) {
    const label = String(moduleName);
    const isAdmin = String(role || "").toLowerCase() === "admin";
    const baseAllowed = new Set(["Dashboard"]);
    const allowed = isAdmin || baseAllowed.has(label) || (Array.isArray(allowedModules) && allowedModules.includes(label));
    if (!allowed) return <Navigate to="/" replace />;
  }

  return children;
}
