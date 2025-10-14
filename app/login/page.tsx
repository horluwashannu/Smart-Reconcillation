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
