"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Mail, Lock, Loader2 } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Simulate a login delay
    setTimeout(() => {
      localStorage.setItem("user", JSON.stringify({ email: "demo@smartrec.com" }));
      setLoading(false);
      router.push("/");
    }, 1000);
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-br from-indigo-900 via-purple-800 to-blue-900 text-white">
      {/* Decorative glows */}
      <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.1),transparent_40%)]"></div>
      <div className="absolute -bottom-20 -right-20 w-[400px] h-[400px] bg-purple-500/30 rounded-full blur-3xl animate-pulse"></div>
      <div className="absolute -top-20 -left-20 w-[400px] h-[400px] bg-blue-500/20 rounded-full blur-3xl animate-pulse"></div>

      <motion.div
        initial={{ opacity: 0, y: 60, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.7, ease: "easeOut" }}
        className="relative z-10 w-full max-w-md bg-white/10 backdrop-blur-xl border border-white/20 p-8 rounded-3xl shadow-2xl"
      >
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Smart Reconciliation</h1>
          <p className="text-gray-300 mt-2 text-sm">
            Effortless call-over and reconciliation — simplified.
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-2">
            <label htmlFor="email" className="text-gray-200 text-sm font-medium">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                id="email"
                type="email"
                placeholder="you@example.com"
                className="w-full pl-10 pr-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="password" className="text-gray-200 text-sm font-medium">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                id="password"
                type="password"
                placeholder="••••••••"
                className="w-full pl-10 pr-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition"
                required
              />
            </div>
          </div>

          <motion.button
            whileTap={{ scale: 0.96 }}
            type="submit"
            disabled={loading}
            className="w-full flex justify-center items-center py-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 rounded-lg shadow-lg shadow-indigo-900/30 font-semibold tracking-wide transition-all duration-300"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                Logging in...
              </>
            ) : (
              "Login"
            )}
          </motion.button>
        </form>

        <p className="text-center text-xs text-gray-400 mt-8">
          © {new Date().getFullYear()} Smart Reconciliation. All Rights Reserved.
        </p>
      </motion.div>
    </div>
  );
}
