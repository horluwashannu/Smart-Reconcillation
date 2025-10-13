"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase"
import { Sidebar } from "@/components/sidebar"
import { TopBar } from "@/components/top-bar"
import { SmartReconciliation } from "@/components/modules/smart-reconciliation"
import { PendingReports } from "@/components/modules/pending-reports"
import { HistoryLogs } from "@/components/modules/history-logs"
import { SystemSettings } from "@/components/modules/system-settings"
import { AdminManagement } from "@/components/modules/admin-management"
import { WeeklyReportsCollation } from "@/components/modules/weekly-reports-collation"
import { SmartTellerCalculator } from "@/components/modules/smart-teller-calculator"
import { ConsolidatedProof } from "@/components/modules/consolidated-proof"
import { TellerProof } from "@/components/modules/teller-proof"
import { AnimatedBackground } from "@/components/animated-background"
import { WelcomeModal } from "@/components/welcome-modal"

export default function DashboardPage() {
  const [activeModule, setActiveModule] = useState("smart-reconciliation")
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [userRole, setUserRole] = useState<"admin" | "user">("user")
  const [darkMode, setDarkMode] = useState(true)
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    async function checkAuth() {
      if (!isSupabaseConfigured()) {
        console.log("[v0] Supabase not configured, auto-logging in as admin for setup")
        setUserRole("admin")
        setUserId("demo-admin-setup")
        setActiveModule("admin-management") // Start on admin panel for easy setup
        setLoading(false)
        return
      }

      const supabase = getSupabase()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.push("/login")
        return
      }

      setUserId(user.id)

      // Fetch user role from database
      const { data: userData, error } = await supabase.from("users").select("role").eq("id", user.id).single()

      if (error) {
        console.error("[v0] Error fetching user role:", error)
      } else if (userData) {
        setUserRole(userData.role as "admin" | "user")
      }

      setLoading(false)
    }

    checkAuth()
  }, [router])

  const renderModule = () => {
    switch (activeModule) {
      case "smart-reconciliation":
        return <SmartReconciliation userId={userId} />
      case "pending-reports":
        return <PendingReports userId={userId} />
      case "history-logs":
        return <HistoryLogs />
      case "weekly-reports-collation":
        return <WeeklyReportsCollation userId={userId} />
      case "smart-teller-calculator":
        return <SmartTellerCalculator userId={userId} />
      case "consolidated-proof":
        return <ConsolidatedProof userId={userId} />
      case "teller-proof":
        return <TellerProof />
      case "system-settings":
        return <SystemSettings />
      case "admin-management":
        return <AdminManagement />
      default:
        return <SmartReconciliation userId={userId} />
    }
  }

  return (
    <div className={`relative flex h-screen overflow-hidden ${darkMode ? "dark" : ""}`}>
      <AnimatedBackground darkMode={darkMode} />

      <WelcomeModal />

      <Sidebar
        activeModule={activeModule}
        setActiveModule={setActiveModule}
        collapsed={sidebarCollapsed}
        setCollapsed={setSidebarCollapsed}
        userRole={userRole}
      />
      <div className="relative z-10 flex flex-1 flex-col overflow-hidden">
        <TopBar userRole={userRole} setUserRole={setUserRole} darkMode={darkMode} setDarkMode={setDarkMode} />
        <main className="flex-1 overflow-y-auto p-6">{renderModule()}</main>
      </div>
    </div>
  )
}
