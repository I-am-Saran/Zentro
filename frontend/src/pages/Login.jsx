import React, { useState } from "react";
import { supabase } from "../supabaseClient";
import { ShieldCheck, Mail, Lock, Loader2 } from "lucide-react";
import { post } from "../services/api";
import { useAuth } from "../hooks/useAuth";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [activeTab, setActiveTab] = useState("sso"); // 'sso' or 'email'
  const { loginCustom } = useAuth();
  const navigate = useNavigate();

  const handleMicrosoftLogin = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "azure",
      options: {
        scopes: "email",
        redirectTo: window.location.origin,
      },
    });

    if (error) {
        alert("Login failed: " + error.message);
        setLoading(false);
    }
    // If successful, Supabase redirects away, so no need to setLoading(false)
  };

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await post("/api/login", { email, password });
      if (response && response.access_token) {
        loginCustom(response.access_token, response.user);
        navigate("/");
      } else {
        alert("Login failed: Invalid response from server");
      }
    } catch (error) {
      alert(error.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#e9f0ec] via-[#e4ede7] to-[#dfe8e2]">
      {/* Glass / neumorphic card */}
      <div className="w-[90%] max-w-md bg-[#f9faf9]/90 backdrop-blur-md border border-[#d3ddd6] rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.05)] p-8 text-center">
        {/* Icon section */}
        <div className="flex justify-center mb-5">
          <div className="p-4 bg-gradient-to-br from-green-600 to-emerald-700 rounded-full shadow-md">
            <ShieldCheck className="text-white w-10 h-10" />
          </div>
        </div>

        {/* Heading */}
        <h1 className="text-2xl font-semibold text-[#1a2e22] mb-1">
          Welcome to
        </h1>
        <h2 className="text-2xl font-bold text-[#1c3a28] mb-6">
          Alchemy Dashboard
        </h2>

        {/* Tabs */}
        <div className="flex justify-center gap-4 mb-6 border-b border-gray-200 pb-2">
            <button
                onClick={() => setActiveTab("sso")}
                className={`pb-2 px-4 text-sm font-medium transition-colors ${
                    activeTab === "sso"
                        ? "text-green-700 border-b-2 border-green-700"
                        : "text-gray-500 hover:text-gray-700"
                }`}
            >
                SSO Login
            </button>
            <button
                onClick={() => setActiveTab("email")}
                className={`pb-2 px-4 text-sm font-medium transition-colors ${
                    activeTab === "email"
                        ? "text-green-700 border-b-2 border-green-700"
                        : "text-gray-500 hover:text-gray-700"
                }`}
            >
                Email Login
            </button>
        </div>

        {/* SSO Login Form */}
        {activeTab === "sso" && (
            <div className="animate-fade-in">
                <p className="text-sm text-gray-600 mb-6">
                  Sign in securely using your Microsoft account
                </p>

                <button
                  onClick={handleMicrosoftLogin}
                  disabled={loading}
                  className="group flex items-center justify-center gap-3 w-full bg-gradient-to-r from-[#25693a] to-[#1d5330] text-white font-semibold px-6 py-3 rounded-xl shadow-md hover:shadow-lg hover:scale-[1.02] transition-all duration-200 active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <img
                      src="https://upload.wikimedia.org/wikipedia/commons/4/44/Microsoft_logo.svg"
                      alt="Microsoft"
                      className="w-5 h-5 group-hover:rotate-[10deg] transition-transform"
                    />
                  )}
                  {loading ? "Signing in..." : "Sign in with Microsoft"}
                </button>
            </div>
        )}

        {/* Email Login Form */}
        {activeTab === "email" && (
            <form onSubmit={handleEmailLogin} className="animate-fade-in text-left">
                <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <div className="relative">
                        <Mail className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                        <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all"
                            placeholder="name@company.com"
                        />
                    </div>
                </div>
                <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                    <div className="relative">
                        <Lock className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                        <input
                            type="password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all"
                            placeholder="••••••••"
                        />
                    </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-[#25693a] to-[#1d5330] text-white font-semibold px-6 py-3 rounded-xl shadow-md hover:shadow-lg hover:scale-[1.02] transition-all duration-200 active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex justify-center items-center gap-2"
                >
                   {loading && <Loader2 className="w-5 h-5 animate-spin" />}
                   {loading ? "Signing in..." : "Sign in"}
                </button>
            </form>
        )}

        {/* Footer */}
        <p className="text-xs text-gray-500 mt-8">
          © {new Date().getFullYear()} Alchemy GRC — Secure Access Portal
        </p>
      </div>
    </div>
  );
}
