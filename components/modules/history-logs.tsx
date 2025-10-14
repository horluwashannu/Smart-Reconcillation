"use client"

import { useState } from "react"
import * as XLSX from "xlsx"
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, Send } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { getSupabase } from "@/lib/supabase"

interface CallOverRow {
  Date: string
  Narration: string
  Amount: string
  Processor: string
  Authorizer: string
  TicketRef: string
  correct: boolean
  exception: boolean
  reason?: string
  status: "Regularized" | "Pending"
  calloverOfficer: string
}

export function SmartCallOver() {
  const [file, setFile] = useState<File | null>(null)
  const [batchNo, setBatchNo] = useState("")
  const [rows, setRows] = useState<CallOverRow[]>([])
  const [officer, setOfficer] = useState("")

  const handleFileUpload = async (file: File) => {
    setFile(file)
    try {
      const buffer = await file.arrayBuffer()
      const wb = XLSX.read(buffer, { type: "array" })
      const sheet = wb.SheetNames[0]
      const raw = XLSX.utils.sheet_to_json<any>(wb.Sheets[sheet], { defval: "" })
      const parsed: CallOverRow[] = raw.map((r: any) => ({
        Date: r.Date || r.DATE || "",
        Narration: r.Narration || r.NARRATION || "",
        Amount: r.Amount || r.AMOUNT || "",
        Processor: r.Processor || r.PROCESSOR || "",
        Authorizer: r.Authorizer || r.AUTHORIZER || "",
        TicketRef: r.Ticket || r.Batch || "",
        correct: true,
        exception: false,
        reason: "",
        status: "Regularized",
        calloverOfficer: officer || "",
      }))
      setRows(parsed)
    } catch (err) {
      console.error("Error parsing call-over file:", err)
      alert("❌ Failed to parse file. Ensure it has columns: Date, Narration, Amount, Processor, Authorizer, TicketRef.")
    }
  }

  const toggleException = (index: number) => {
    const updated = [...rows]
    updated[index].exception = !updated[index].exception
    if (!updated[index].exception) updated[index].reason = ""
    setRows(updated)
  }

  const updateReason = (index: number, value: string) => {
    const updated = [...rows]
    updated[index].reason = value
    setRows(updated)
  }

  const updateStatus = (index: number, value: "Regularized" | "Pending") => {
    const updated = [...rows]
    updated[index].status = value
    setRows(updated)
  }

  const handleSubmit = async () => {
    if (!batchNo) {
      alert("Please enter a Batch/Ticket Reference before submitting.")
      return
    }

    try {
      const supabase = getSupabase()
      if (supabase) {
        const { error } = await supabase.from("callover_reports").insert(
          rows.map((r) => ({
            date: r.Date,
            narration: r.Narration,
            amount: r.Amount,
            processor: r.Processor,
            authorizer: r.Authorizer,
            ticket_ref: r.TicketRef || batchNo,
            exception: r.exception,
            reason: r.reason,
            status: r.status,
            callover_officer: officer,
            submitted_at: new Date().toISOString(),
          })),
        )
        if (error) throw error
        alert("✅ Call-over report submitted successfully!")
        setRows([])
        setFile(null)
        setBatchNo("")
      } else {
        localStorage.setItem("callover_temp", JSON.stringify(rows))
        alert("Saved locally (Supabase not configured).")
      }
    } catch (err) {
      console.error("Error saving call-over:", err)
      alert("❌ Failed to submit call-over report")
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Smart Call-Over</h1>
        <p className="text-muted-foreground">Upload transaction journal, review entries, and flag exceptions</p>
      </div>

      {/* Batch + Officer */}
      <Card>
        <CardHeader>
          <CardTitle>Batch Info</CardTitle>
          <CardDescription>Enter Batch/Ticket reference and call-over officer details</CardDescription>
        </CardHeader>
        <CardContent className="flex gap-4">
          <Input placeholder="Batch/Ticket No" value={batchNo} onChange={(e) => setBatchNo(e.target.value)} />
          <Input placeholder="Call-over Officer" value={officer} onChange={(e) => setOfficer(e.target.value)} />
        </CardContent>
      </Card>

      {/* Upload */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Upload Transaction Journal
          </CardTitle>
          <CardDescription>Excel/CSV file with Date, Narration, Amount, Processor, Authorizer, TicketRef</CardDescription>
        </CardHeader>
        <CardContent>
          <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 hover:bg-muted">
            <Upload className="mb-2 h-8 w-8 text-muted-foreground" />
            <span>{file ? file.name : "Click or drag to upload"}</span>
            <input type="file" className="hidden" accept=".xlsx,.xls,.csv" onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])} />
          </label>
        </CardContent>
      </Card>

      {/* Table */}
      {rows.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Review Transactions</CardTitle>
            <CardDescription>Flag exceptions, add reasons, and set status before submission</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Narration</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Processor</TableHead>
                    <TableHead>Authorizer</TableHead>
                    <TableHead>Ticket Ref</TableHead>
                    <TableHead>Correct/Exception</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{row.Date}</TableCell>
                      <TableCell className="max-w-xs truncate">{row.Narration}</TableCell>
                      <TableCell>{row.Amount}</TableCell>
                      <TableCell>{row.Processor}</TableCell>
                      <TableCell>{row.Authorizer}</TableCell>
                      <TableCell>{row.TicketRef}</TableCell>
                      <TableCell>
                        <Button size="sm" variant={row.exception ? "destructive" : "default"} onClick={() => toggleException(idx)}>
                          {row.exception ? <AlertCircle className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
                          {row.exception ? "Exception" : "Correct"}
                        </Button>
                      </TableCell>
                      <TableCell>
                        {row.exception && (
                          <Input
                            value={row.reason || ""}
                            onChange={(e) => updateReason(idx, e.target.value)}
                            placeholder="Reason"
                          />
                        )}
                      </TableCell>
                      <TableCell>
                        <select value={row.status} onChange={(e) => updateStatus(idx, e.target.value as any)} className="rounded border p-1">
                          <option value="Regularized">Regularized</option>
                          <option value="Pending">Pending</option>
                        </select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="mt-6 flex justify-end">
              <Button size="lg" className="gap-2" onClick={handleSubmit}>
                <Send className="h-4 w-4" /> Submit Call-Over
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
