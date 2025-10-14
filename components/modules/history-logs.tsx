"use client"

import React, { useState } from "react"
import * as XLSX from "xlsx"
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, Send } from "lucide-react"

// ✅ Simple fallback components (in case shadcn/ui paths are missing)
const SafeCard = ({ title, children }: { title?: string; children: any }) => (
  <div className="border rounded-lg p-4 bg-white/70 shadow-sm">
    {title && <h2 className="font-semibold text-lg mb-2">{title}</h2>}
    {children}
  </div>
)

const SafeTable = ({ children }: { children: any }) => (
  <table className="w-full border border-gray-200 text-sm">{children}</table>
)

const SafeButton = ({
  onClick,
  children,
  variant,
  disabled,
}: {
  onClick?: any
  children: any
  variant?: string
  disabled?: boolean
}) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`px-3 py-1.5 rounded-md text-sm ${
      variant === "danger"
        ? "bg-red-500 text-white"
        : variant === "outline"
        ? "border border-gray-300 text-gray-700"
        : "bg-blue-600 text-white"
    } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
  >
    {children}
  </button>
)

// ✅ Guard Supabase import
let getSupabase: any = () => null
try {
  getSupabase = require("@/lib/supabase").getSupabase
} catch {
  console.warn("[v0] Supabase not active — using local fallback.")
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

export default function CallOverPage() {
  const [rows, setRows] = useState<CallOverRow[]>([])
  const [ticketRef, setTicketRef] = useState("")
  const [officer, setOfficer] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ✅ Upload and parse Excel
  const handleUpload = async (e: any) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)

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
    } catch (err) {
      console.error(err)
      setError("❌ Invalid Excel format. Please upload a valid .xlsx file.")
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
      alert("Fill in Ticket Reference and Officer Name")
      return
    }

    setLoading(true)
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
        alert("✅ Call-Over report submitted successfully.")
      } else {
        localStorage.setItem("callover_backup", JSON.stringify({ ticketRef, officer, rows }))
        alert("Saved locally (Supabase off).")
      }
      setRows([])
      setOfficer("")
      setTicketRef("")
    } catch (e) {
      console.error(e)
      setError("❌ Failed to submit report.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Smart Call-Over</h1>
      <p className="text-gray-600">
        Upload your journal, review transactions, flag exceptions, and submit results to admin.
      </p>

      {error && <div className="bg-red-100 text-red-700 px-4 py-2 rounded">{error}</div>}

      {/* Upload */}
      <SafeCard title="Upload Journal">
        <input type="file" accept=".xlsx,.xls" onChange={handleUpload} className="mb-3" />
      </SafeCard>

      {/* Table */}
      {rows.length > 0 && (
        <SafeCard title="Transaction Review">
          <div className="overflow-x-auto">
            <SafeTable>
              <thead className="bg-gray-100 text-gray-700">
                <tr>
                  <th className="p-2">Date</th>
                  <th className="p-2">Narration</th>
                  <th className="p-2">Amount</th>
                  <th className="p-2">Processor</th>
                  <th className="p-2">Authorizer</th>
                  <th className="p-2">Status</th>
                  <th className="p-2">Reason</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="p-2">{r.Date}</td>
                    <td className="p-2 max-w-xs truncate">{r.Narration}</td>
                    <td className="p-2 text-right">₦{r.Amount.toLocaleString()}</td>
                    <td className="p-2">{r.Processor}</td>
                    <td className="p-2">{r.Authorizer}</td>
                    <td className="p-2">
                      <SafeButton
                        onClick={() => toggleStatus(r.id, "Correct")}
                        variant={r.status === "Correct" ? "primary" : "outline"}
                      >
                        <CheckCircle className="inline-block h-4 w-4 mr-1" />
                        Correct
                      </SafeButton>
                      <SafeButton
                        onClick={() => toggleStatus(r.id, "Exception")}
                        variant={r.status === "Exception" ? "danger" : "outline"}
                        className="ml-2"
                      >
                        <AlertCircle className="inline-block h-4 w-4 mr-1" />
                        Exception
                      </SafeButton>
                    </td>
                    <td className="p-2">
                      {r.status === "Exception" && (
                        <textarea
                          className="border rounded w-full p-1 text-sm"
                          value={r.reason || ""}
                          onChange={(e) => updateReason(r.id, e.target.value)}
                        />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </SafeTable>
          </div>
        </SafeCard>
      )}

      {/* Finalize */}
      {rows.length > 0 && (
        <SafeCard title="Finalize & Submit">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Ticket Reference</label>
              <input
                value={ticketRef}
                onChange={(e) => setTicketRef(e.target.value)}
                className="border rounded w-full p-2"
                placeholder="e.g. TCK-2025-1002"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Officer</label>
              <input
                value={officer}
                onChange={(e) => setOfficer(e.target.value)}
                className="border rounded w-full p-2"
                placeholder="Officer name"
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <SafeButton onClick={handleSubmit} disabled={loading}>
              <Send className="inline-block h-4 w-4 mr-1" />
              {loading ? "Submitting..." : "Submit Report"}
            </SafeButton>
          </div>
        </SafeCard>
      )}
    </div>
  )
}
