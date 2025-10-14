"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/ui/card"
import { Mail, Lock, Loader2 } from "lucide-react"
import { motion } from "framer-motion"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const router = useRouter()

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    setTimeout(() => {
      setLoading(false)
      if (!email || !password) {
        setError("Please enter both email and password")
        return
      }

      // Fake login success
      localStorage.setItem("user", JSON.stringify({ email }))
      router.push("/")
    }, 1000)
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-900 via-indigo-800 to-purple-900 overflow-hidden">
      {/* Blurred circles for background effect */}
      <div className="absolute w-72 h-72 bg-purple-500/20 rounded-full blur-3xl top-10 left-10 animate-pulse"></div>
      <div className="absolute w-96 h-96 bg-blue-500/20 rounded-full blur-3xl bottom-10 right-10 animate-pulse"></div>

      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6 }}
        className="relative z-10 w-full max-w-md"
      >
        <Card className="backdrop-blur-xl bg-white/10 border border-white/20 p-8 shadow-2xl rounded-2xl text-white">
          <h1 className="text-3xl font-bold mb-2 text-center">Smart Reconciliation</h1>
          <p className="text-center text-sm text-gray-200 mb-6">
            Welcome back! Please log in to continue.
          </p>

          {error && (
            <p className="mb-4 text-red-400 bg-red-950/40 border border-red-700/50 p-2 rounded-md text-center">
              {error}
            </p>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <Label htmlFor="email" className="text-gray-200">Email Address</Label>
              <div className="relative mt-1">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="pl-10 bg-white/10 border-white/20 text-white placeholder-gray-300 focus:border-indigo-400 focus:ring-indigo-400"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="password" className="text-gray-200">Password</Label>
              <div className="relative mt-1">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="pl-10 bg-white/10 border-white/20 text-white placeholder-gray-300 focus:border-indigo-400 focus:ring-indigo-400"
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 transition-all duration-300"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Logging in...</span>
                </>
              ) : (
                <span>Login</span>
              )}
            </Button>
          </form>

          <p className="text-center text-sm text-gray-300 mt-6">
            © {new Date().getFullYear()} Smart Reconciliation. All rights reserved.
          </p>
        </Card>
      </motion.div>
    </div>
  )
}
