"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/ui/card"
import { AlertCircle, Loader2, Building2, Settings, Lock, Mail } from "lucide-react"
import Link from "next/link"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [isSignUp, setIsSignUp] = useState(false)
  const [isConfigured, setIsConfigured] = useState(false)
  const router = useRouter()

  useEffect(() => {
    setIsConfigured(isSupabaseConfigured())
  }, [])

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!isSupabaseConfigured()) {
      setError(
        "Supabase is not configured. Please configure it in Admin Management → Database tab first, or access the app directly to configure it.",
      )
      return
    }

    setLoading(true)
    setError("")

    try {
      const supabase = getSupabase()

      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
          },
        })

        if (error) {
          console.error("[v0] Sign up error:", error)
          throw new Error(error.message || "Failed to create account")
        }

        if (data.user) {
          // Check if this is the first user
          const { count } = await supabase.from("users").select("*", { count: "exact", head: true })
          const role = count === 0 ? "admin" : "user"

          // Create user profile
          const { error: insertError } = await supabase.from("users").insert({
            id: data.user.id,
            email: data.user.email,
            role: role,
          })

          if (insertError) {
            console.error("[v0] Error creating user profile:", insertError)
          }

          setError("")
          alert(
            `Account created successfully! ${role === "admin" ? "You are the first user and have been granted admin access." : ""} You can now sign in.`,
          )

          // Switch to sign in mode
          setIsSignUp(false)
          setPassword("")
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })

        if (error) {
          console.error("[v0] Sign in error:", error)

          // Provide helpful error messages
          if (error.message.includes("Invalid login credentials") || error.message.includes("Invalid")) {
            throw new Error("Invalid email or password. If you haven't created an account yet, please sign up first.")
          } else if (error.message.includes("Email not confirmed")) {
            throw new Error(
              "Please confirm your email address before signing in. Check your inbox for the confirmation email.",
            )
          } else {
            throw new Error(error.message || "Failed to sign in")
          }
        }

        if (data.user) {
          // Verify user profile exists
          const { data: userData, error: userError } = await supabase
            .from("users")
            .select("*")
            .eq("id", data.user.id)
            .single()

          if (userError || !userData) {
            console.error("[v0] User profile not found:", userError)
            throw new Error("User profile not found. Please contact support or try signing up again.")
          }

          // Redirect to main app
          router.push("/")
        }
      }
    } catch (err: any) {
      console.error("[v0] Authentication error:", err)
      setError(err.message || "An error occurred during authentication")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden p-4">
      {/* Background Image with Overlay */}
      <div className="absolute inset-0 z-0">
        <img
          src="/modern-financial-office-workspace-with-computers-a.jpg"
          alt="Background"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900/95 via-slate-800/90 to-slate-900/95 backdrop-blur-sm" />
      </div>

      {/* Animated Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-1/4 -left-48 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 -right-48 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      <div className="w-full max-w-6xl relative z-10 grid md:grid-cols-2 gap-8 items-center">
        {/* Left Side - Branding */}
        <div className="hidden md:block text-white space-y-6">
          <div className="inline-flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
              <Building2 className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-3xl font-bold">Smart Reconciliation</h1>
          </div>
          <h2 className="text-4xl font-bold leading-tight">Streamline Your Financial Reconciliation Process</h2>
          <p className="text-lg text-slate-300">
            Powerful tools for managing transactions, generating reports, and maintaining accurate financial records.
          </p>
          <div className="space-y-3 pt-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span className="text-slate-300">Automated reconciliation with AI-powered matching</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span className="text-slate-300">Comprehensive reporting and analytics</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span className="text-slate-300">Secure role-based access control</span>
            </div>
          </div>
        </div>

        {/* Right Side - Login Form */}
        <Card className="w-full bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-slate-200 dark:border-slate-800 shadow-2xl">
          <div className="p-8">
            {/* Mobile Logo */}
            <div className="md:hidden text-center mb-6">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 mb-3 shadow-lg">
                <Building2 className="w-7 h-7 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-foreground">Smart Reconciliation</h1>
            </div>

            <div className="mb-6">
              <h2 className="text-2xl font-bold text-foreground mb-2">
                {isSignUp ? "Create Account" : "Welcome Back"}
              </h2>
              <p className="text-muted-foreground">{isSignUp ? "Sign up to get started" : "Sign in to your account"}</p>
            </div>

            {!isConfigured && (
              <div className="mb-6 p-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 flex items-start gap-3">
                <Settings className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-amber-600 dark:text-amber-400">Supabase Not Configured</p>
                  <p className="text-xs text-amber-600/80 dark:text-amber-400/80 mt-1">
                    You need to configure Supabase first. Click the link below to access admin settings.
                  </p>
                </div>
              </div>
            )}

            {error && (
              <div className="mb-6 p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}

            <form onSubmit={handleAuth} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-foreground font-medium">
                  Email Address
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="h-12 pl-10 bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-foreground font-medium">
                  Password
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="h-12 pl-10 bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading || !isConfigured}
                className="w-full h-12 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    {isSignUp ? "Creating Account..." : "Signing In..."}
                  </>
                ) : (
                  <>{isSignUp ? "Create Account" : "Sign In"}</>
                )}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(!isSignUp)
                  setError("")
                }}
                disabled={!isConfigured}
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSignUp ? "Already have an account? Sign in" : "Don't have an account? Sign up"}
              </button>
            </div>

            {!isConfigured && (
              <div className="mt-6 text-center">
                <Link
                  href="/?role=admin"
                  className="text-sm text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 inline-flex items-center gap-1 transition-colors font-medium"
                >
                  <Settings className="w-4 h-4" />
                  Go to Admin Settings to Configure Supabase
                </Link>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}
