"use client"

import React, { useState, useEffect } from "react"
import * as XLSX from "xlsx"
import { Upload, CheckCircle, AlertCircle, Send, Download } from "lucide-react"

/* ---------------- SAFE FALLBACK UI COMPONENTS ---------------- */
const Card = ({ title, children }: { title?: string; children: any }) => (
  <div className="border border-gray-200 rounded-lg p-4 bg-white shadow-sm">
    {title && <h2 className="font-semibold text-lg mb-2">{title}</h2>}
    {children}
  </div>
)

const Button = ({
  onClick,
  children,
  variant,
  disabled,
}: {
  onClick?: () => void
  children: any
  variant?: "primary" | "danger" | "outline"
  disabled?: boolean
}) => {
  const base =
    "px-3 py-1.5 text-sm rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
  const styles =
    variant === "danger"
      ? "bg-red-500 text-white hover:bg-red-600"
      : variant === "outline"
      ? "border border-gray-300 text-gray-700 hover:bg-gray-50"
      : "bg-blue-600 text-white hover:bg-blue-700"
  return (
    <button onClick={onClick} disabled={disabled} className={`${base} ${styles}`}>
      {children}
    </button>
  )
}

const Table = ({ children }: { children: any }) => (
  <table className="w-full text-sm border border-gray-200">{children}</table>
)

/* ---------------- MAIN CALL-OVER COMPONENT ---------------- */
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

export default function CallOverPage() {
  const [rows, setRows] = useState<CallOverRow[]>([])
  const [ticketRef, setTicketRef] = useState("")
  const [officer, setOfficer] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /* Load saved report on mount */
  useEffect(() => {
    const saved = localStorage.getItem("calloverReport")
    if (saved) {
      const parsed = JSON.parse(saved)
      setRows(parsed.data || [])
      setTicketRef(parsed.ticketRef || "")
      setOfficer(parsed.officer || "")
    }
  }, [])

  /* ---------- Upload Excel ---------- */
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      const buf = await file.arrayBuffer()
      const workbook = XLSX.read(buf)
      const sheet = workbook.SheetNames[0]
      const data = XLSX.utils.sheet_to_json<any>(workbook.Sheets[sheet], { defval: "" })

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
      setError(null)
    } catch (err) {
      console.error(err)
      setError("❌ Invalid Excel file. Please upload a valid .xlsx journal.")
    }
  }

  /* ---------- Row actions ---------- */
  const toggleStatus = (id: number, status: "Correct" | "Exception") => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)))
  }

  const updateReason = (id: number, reason: string) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, reason } : r)))
  }

  /* ---------- Submit locally ---------- */
  const handleSubmit = () => {
    if (!ticketRef || !officer) {
      alert("Please fill in Ticket Reference and Officer Name.")
      return
    }

    const report = {
      ticketRef,
      officer,
      date: new Date().toISOString(),
      data: rows,
    }

    localStorage.setItem("calloverReport", JSON.stringify(report))
    alert("✅ Call-Over report saved locally.")

    // Clear after save
    setRows([])
    setTicketRef("")
    setOfficer("")
  }

  /* ---------- Export to Excel ---------- */
  const handleExport = () => {
    const ws = XLSX.utils.json_to_sheet(
      rows.map(({ id, ...r }) => ({ ...r })) // remove id for export
    )
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "CallOver")
    XLSX.writeFile(wb, `CallOverReport_${Date.now()}.xlsx`)
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Smart Call-Over</h1>
      <p className="text-gray-600">
        Upload the daily transaction journal, verify records, mark exceptions, and submit your findings.
      </p>

      {error && (
        <div className="bg-red-100 border border-red-300 text-red-700 px-4 py-2 rounded">{error}</div>
      )}

      {/* Upload */}
      <Card title="Upload Journal">
        <div className="flex items-center gap-3">
          <Upload className="h-5 w-5 text-gray-500" />
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={handleUpload}
            className="text-sm border border-gray-300 p-2 rounded"
          />
        </div>
      </Card>

      {/* Table display */}
      {rows.length > 0 && (
        <Card title="Transaction Review">
          <div className="overflow-x-auto">
            <Table>
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-2 text-left">Date</th>
                  <th className="p-2 text-left">Narration</th>
                  <th className="p-2 text-right">Amount</th>
                  <th className="p-2 text-left">Processor</th>
                  <th className="p-2 text-left">Authorizer</th>
                  <th className="p-2 text-center">Status</th>
                  <th className="p-2 text-left">Exception Reason</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-gray-200">
                    <td className="p-2">{r.Date}</td>
                    <td className="p-2 max-w-xs truncate">{r.Narration}</td>
                    <td className="p-2 text-right">₦{r.Amount.toLocaleString()}</td>
                    <td className="p-2">{r.Processor}</td>
                    <td className="p-2">{r.Authorizer}</td>
                    <td className="p-2 text-center space-x-2">
                      <Button
                        onClick={() => toggleStatus(r.id, "Correct")}
                        variant={r.status === "Correct" ? "primary" : "outline"}
                      >
                        <CheckCircle className="inline-block h-4 w-4 mr-1" />
                        Correct
                      </Button>
                      <Button
                        onClick={() => toggleStatus(r.id, "Exception")}
                        variant={r.status === "Exception" ? "danger" : "outline"}
                      >
                        <AlertCircle className="inline-block h-4 w-4 mr-1" />
                        Exception
                      </Button>
                    </td>
                    <td className="p-2">
                      {r.status === "Exception" && (
                        <textarea
                          value={r.reason || ""}
                          onChange={(e) => updateReason(r.id, e.target.value)}
                          className="w-full border border-gray-300 rounded p-1 text-sm"
                          placeholder="Enter reason"
                        />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        </Card>
      )}

      {/* Submit & Export section */}
      {rows.length > 0 && (
        <Card title="Finalize & Submit">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
            <div>
              <label className="text-sm font-medium text-gray-700">Ticket Reference</label>
              <input
                value={ticketRef}
                onChange={(e) => setTicketRef(e.target.value)}
                className="mt-1 border border-gray-300 rounded p-2 w-full"
                placeholder="e.g. TCK-2025-1003"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Call-Over Officer</label>
              <input
                value={officer}
                onChange={(e) => setOfficer(e.target.value)}
                className="mt-1 border border-gray-300 rounded p-2 w-full"
                placeholder="Officer name"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSubmit} disabled={loading}>
                <Send className="inline-block h-4 w-4 mr-1" />
                {loading ? "Submitting..." : "Submit"}
              </Button>
              <Button onClick={handleExport} variant="outline">
                <Download className="inline-block h-4 w-4 mr-1" />
                Export
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Sample notification area */}
      <div className="p-3 text-xs text-gray-500 border-t border-gray-200">
        📧 <b>Sample Alert Space:</b> “Daily call-over summary will appear here when email service is enabled.”
      </div>
    </div>
  )
}
