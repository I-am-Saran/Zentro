import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

export default function ProtectedRoute({ children }) {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center text-gray-600">
        Checking session...
      </div>
    );
  }

  if (!session) return <Navigate to="/login" replace />;

  return children;
}
