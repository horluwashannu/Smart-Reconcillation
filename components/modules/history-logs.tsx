"use client"

import { useState, useEffect } from "react"
import { History, Search, RefreshCw } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { getSupabase } from "@/lib/supabase"

interface HistoryLog {
  id: string
  timestamp: string
  user: string
  action: string
  status: string
  details?: string
}

export function HistoryLogs() {
  const [logs, setLogs] = useState<HistoryLog[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [loading, setLoading] = useState(false)

  const fetchHistoryLogs = async () => {
    setLoading(true)
    try {
      const supabase = getSupabase()
      if (supabase) {
        const { data, error } = await supabase
          .from("history_logs")
          .select("*")
          .order("timestamp", { ascending: false })
          .limit(100)

        if (data && !error) {
          setLogs(data)
        }
      } else {
        // Fallback to localStorage if Supabase not configured
        const storedLogs = localStorage.getItem("historyLogs")
        if (storedLogs) {
          setLogs(JSON.parse(storedLogs))
        }
      }
    } catch (error) {
      console.error("Error fetching history logs:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchHistoryLogs()
  }, [])

  const filteredLogs = logs.filter(
    (log) =>
      log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.user.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.details?.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">History Logs</h1>
          <p className="text-muted-foreground">View system activity and audit trail from database</p>
        </div>
        <Button onClick={fetchHistoryLogs} variant="outline" className="gap-2 bg-transparent" disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5 text-primary" />
                Activity Log
              </CardTitle>
              <CardDescription>Recent system activities and user actions</CardDescription>
            </div>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search logs..."
                className="pl-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Log ID</TableHead>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      {loading ? "Loading logs..." : "No logs found"}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="font-medium">{log.id}</TableCell>
                      <TableCell className="font-mono text-sm">{log.timestamp}</TableCell>
                      <TableCell>{log.user}</TableCell>
                      <TableCell>{log.action}</TableCell>
                      <TableCell>
                        <Badge variant={log.status === "Success" ? "default" : "destructive"}>{log.status}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{log.details || "-"}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
