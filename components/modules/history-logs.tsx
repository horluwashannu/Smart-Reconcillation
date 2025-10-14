"use client"

import React, { useState } from "react"
import * as XLSX from "xlsx"
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, Send } from "lucide-react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

// Optional import guard for Supabase (prevents crash if lib missing)
let getSupabase: any = () => null
try {
  // Dynamically import only if available (avoids build error)
  getSupabase = require("@/lib/supabase").getSupabase
} catch (e) {
  console.warn("Supabase not configured — using local fallback only.")
}

interface CallOverRow {
  id: number
  Date: string
  Narration: string
  Amount: number
  Processor: string
  Authorizer: string
  status: "Correct" | "Exception" | "Pending"
  reason?: string
}

export default function SmartCallOver() {
  const [rows, setRows] = useState<CallOverRow[]>([])
  const [ticketRef, setTicketRef] = useState("")
  const [officer, setOfficer] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Upload Excel File
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setError(null)

    try {
      const buffer = await file.arrayBuffer()
      const workbook = XLSX.read(buffer)
      const firstSheet = workbook.SheetNames[0]
      const data = XLSX.utils.sheet_to_json<any>(workbook.Sheets[firstSheet], { defval: "" })

      const formatted = data.map((r: any, i: number) => ({
        id: i + 1,
        Date: r.Date || r["Transaction Date"] || "-",
        Narration: r.Narration || r.Description || "-",
        Amount: Number(r.Amount || r["Transaction Amount"] || 0),
        Processor: r.Processor || r.Inputter || "-",
        Authorizer: r.Authorizer || r.Approver || "-",
        status: "Pending" as const,
      }))

      setRows(formatted)
    } catch (err) {
      console.error("Excel parse error:", err)
      setError("Failed to read Excel file. Please use a valid .xlsx sheet.")
    }
  }

  const toggleStatus = (id: number, newStatus: "Correct" | "Exception") => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status: newStatus } : r)))
  }

  const updateReason = (id: number, reason: string) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, reason } : r)))
  }

  const handleSubmit = async () => {
    if (!ticketRef || !officer) {
      alert("Please fill in Ticket Reference and Officer Name.")
      return
    }

    if (rows.length === 0) {
      alert("Please upload a transaction journal first.")
      return
    }

    setLoading(true)
    setError(null)

    try {
      const supabase = getSupabase?.()
      if (supabase) {
        const { error } = await supabase.from("callover_reports").insert({
          ticket_ref: ticketRef,
          officer,
          data: rows,
          created_at: new Date().toISOString(),
        })
        if (error) throw error
        alert("✅ Report submitted successfully!")
      } else {
        // local fallback
        localStorage.setItem("callover_backup", JSON.stringify({ ticketRef, officer, rows }))
        alert("Saved locally (Supabase not active).")
      }

      setRows([])
      setTicketRef("")
      setOfficer("")
    } catch (err: any) {
      console.error("Submit failed:", err)
      setError("Failed to submit. Check connection or Supabase config.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold text-foreground">Smart Call-Over</h1>
        <p className="text-muted-foreground">
          Upload transaction journal, review entries, and flag exceptions automatically.
        </p>
      </header>

      {error && (
        <div className="p-3 bg-red-100 border border-red-300 text-red-700 rounded-md">{error}</div>
      )}

      <Card className="border-primary/30 bg-card/50 backdrop-blur">
        <CardHeader>
          <CardTitle>Upload Journal</CardTitle>
          <CardDescription>Select your daily transaction Excel file (.xlsx)</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-3">
          <Input type="file" accept=".xlsx,.xls" onChange={handleUpload} className="w-1/2" />
          <Button variant="outline" className="gap-2">
            <Upload className="h-4 w-4" /> Upload
          </Button>
        </CardContent>
      </Card>

      <Card className="border-primary/30 bg-card/50 backdrop-blur">
        <CardHeader>
          <CardTitle>Transaction Review</CardTitle>
          <CardDescription>
            Mark transactions as Correct or Exception, and provide reasons for flagged entries.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Narration</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Processor</TableHead>
                <TableHead>Authorizer</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Reason</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-6">
                    <FileSpreadsheet className="inline-block h-5 w-5 mr-2" />
                    No transactions uploaded yet
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{row.Date}</TableCell>
                    <TableCell className="max-w-xs truncate">{row.Narration}</TableCell>
                    <TableCell className="text-right font-mono">
                      ₦{row.Amount.toLocaleString()}
                    </TableCell>
                    <TableCell>{row.Processor}</TableCell>
                    <TableCell>{row.Authorizer}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant={row.status === "Correct" ? "default" : "outline"}
                          onClick={() => toggleStatus(row.id, "Correct")}
                        >
                          <CheckCircle className="h-4 w-4 mr-1" /> Correct
                        </Button>
                        <Button
                          size="sm"
                          variant={row.status === "Exception" ? "destructive" : "outline"}
                          onClick={() => toggleStatus(row.id, "Exception")}
                        >
                          <AlertCircle className="h-4 w-4 mr-1" /> Exception
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      {row.status === "Exception" && (
                        <Textarea
                          placeholder="Enter reason"
                          className="h-8 text-sm"
                          value={row.reason || ""}
                          onChange={(e) => updateReason(row.id, e.target.value)}
                        />
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {rows.length > 0 && (
        <Card className="border-primary/30 bg-card/50 backdrop-blur">
          <CardHeader>
            <CardTitle>Finalize & Submit</CardTitle>
            <CardDescription>Provide required details before submission.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Ticket Reference</label>
                <Input
                  value={ticketRef}
                  onChange={(e) => setTicketRef(e.target.value)}
                  placeholder="e.g. TCK-2025-1002"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Call-Over Officer</label>
                <Input
                  value={officer}
                  onChange={(e) => setOfficer(e.target.value)}
                  placeholder="Enter officer name"
                />
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={handleSubmit} disabled={loading} className="gap-2">
                <Send className={`h-4 w-4 ${loading ? "animate-pulse" : ""}`} />
                {loading ? "Submitting..." : "Submit Report"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
