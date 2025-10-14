"use client"

import { useState } from "react"
import * as XLSX from "xlsx"
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, Send } from "lucide-react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { getSupabase } from "@/lib/supabase"

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

  // Parse Excel and load transactions
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      const data = await file.arrayBuffer()
      const workbook = XLSX.read(data)
      const sheet = workbook.SheetNames[0]
      const jsonData = XLSX.utils.sheet_to_json<any>(workbook.Sheets[sheet], { defval: "" })

      const formatted = jsonData.map((item: any, index: number) => ({
        id: index + 1,
        Date: item.Date || item["Transaction Date"] || "-",
        Narration: item.Narration || item.Description || "-",
        Amount: Number(item.Amount || item["Transaction Amount"] || 0),
        Processor: item.Processor || item.Inputter || "-",
        Authorizer: item.Authorizer || item.Approver || "-",
        status: "Pending" as "Pending",
      }))

      setRows(formatted)
    } catch (error) {
      console.error("Error parsing Excel:", error)
      alert("Error reading Excel file. Please ensure it’s a valid transaction journal.")
    }
  }

  const toggleStatus = (id: number, newStatus: "Correct" | "Exception") => {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: newStatus } : r))
    )
  }

  const updateReason = (id: number, value: string) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, reason: value } : r)))
  }

  const handleSubmit = async () => {
    if (!ticketRef || !officer) {
      alert("Please enter Ticket Reference and Call-Over Officer.")
      return
    }
    if (rows.length === 0) {
      alert("Please upload a transaction journal first.")
      return
    }

    setLoading(true)
    const supabase = getSupabase()

    try {
      if (!supabase) throw new Error("Supabase not configured")

      const { error } = await supabase.from("callover_reports").insert({
        ticket_ref: ticketRef,
        officer,
        records: rows,
        created_at: new Date().toISOString(),
      })

      if (error) throw error

      alert("✅ Call-Over Report submitted successfully!")
      setRows([])
      setTicketRef("")
      setOfficer("")
    } catch (error) {
      console.error("Submission error:", error)
      alert("Could not submit to server. Saving locally as backup.")

      // fallback save
      localStorage.setItem("callover_backup", JSON.stringify({ ticketRef, officer, rows }))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Smart Call-Over</h1>
          <p className="text-muted-foreground">
            Upload transaction journals, review entries, and flag exceptions for review.
          </p>
        </div>
      </div>

      <Card className="border-primary/20 bg-card/50 backdrop-blur">
        <CardHeader>
          <CardTitle>Upload Journal</CardTitle>
          <CardDescription>Select your daily transaction Excel sheet to begin.</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-3">
          <Input type="file" accept=".xlsx,.xls" onChange={handleUpload} className="w-1/2" />
          <Button variant="outline" className="gap-2">
            <Upload className="h-4 w-4" /> Upload
          </Button>
        </CardContent>
      </Card>

      <Card className="border-primary/20 bg-card/50 backdrop-blur">
        <CardHeader>
          <CardTitle>Transaction Review</CardTitle>
          <CardDescription>Flag mismatched or suspicious transactions before submitting.</CardDescription>
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
                <TableHead>Reason (if Exception)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-6">
                    <FileSpreadsheet className="inline-block h-5 w-5 mr-2" />
                    No transactions uploaded
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-mono text-sm">{row.Date}</TableCell>
                    <TableCell className="max-w-xs truncate">{row.Narration}</TableCell>
                    <TableCell className="font-mono text-right">
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
                          placeholder="Enter reason..."
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
        <Card className="border-primary/20 bg-card/50 backdrop-blur">
          <CardHeader>
            <CardTitle>Finalize & Submit</CardTitle>
            <CardDescription>
              Provide required info before sending to Admin or Operations Supervisor.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Ticket Reference / Batch No</label>
                <Input
                  value={ticketRef}
                  onChange={(e) => setTicketRef(e.target.value)}
                  placeholder="e.g. TCK-2025-1001"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Call-Over Officer</label>
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
