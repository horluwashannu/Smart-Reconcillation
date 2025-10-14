"use client"

import { useState, useEffect } from "react"
import * as XLSX from "xlsx"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface RecordItem {
  id: number
  date: string
  tellerName: string
  txnId: string
  amount: number
  status: "Pending" | "Checked" | "Exception"
  note?: string
}

export default function HistoryLogs() {
  const [records, setRecords] = useState<RecordItem[]>([])
  const [fileName, setFileName] = useState("")

  // Load stored records from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("callover_records")
    if (saved) setRecords(JSON.parse(saved))
  }, [])

  // Auto-save any time records change
  useEffect(() => {
    localStorage.setItem("callover_records", JSON.stringify(records))
  }, [records])

  // Handle Excel upload
  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)

    const reader = new FileReader()
    reader.onload = (evt) => {
      const data = evt.target?.result
      const workbook = XLSX.read(data, { type: "binary" })
      const sheetName = workbook.SheetNames[0]
      const sheet = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName])

      // Convert Excel rows to record format
      const newRecords: RecordItem[] = (sheet as any[]).map((row, index) => ({
        id: index + 1,
        date: row.Date || "",
        tellerName: row.Teller || "",
        txnId: row.TransactionID || "",
        amount: Number(row.Amount) || 0,
        status: "Pending",
      }))

      setRecords(newRecords)
    }
    reader.readAsBinaryString(file)
  }

  // Update record status
  const updateStatus = (id: number, newStatus: "Checked" | "Exception") => {
    setRecords((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: newStatus } : r))
    )
  }

  // Add exception note
  const updateNote = (id: number, note: string) => {
    setRecords((prev) =>
      prev.map((r) => (r.id === id ? { ...r, note } : r))
    )
  }

  // Export to Excel
  const handleExport = () => {
    const ws = XLSX.utils.json_to_sheet(records)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "CallOver")
    XLSX.writeFile(wb, "CallOver_Results.xlsx")
  }

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-6">Call Over (History Logs)</h2>

      <div className="flex flex-col md:flex-row gap-4 items-center mb-6">
        <Input type="file" accept=".xlsx,.xls" onChange={handleUpload} />
        {fileName && (
          <p className="text-sm text-gray-600">Loaded: {fileName}</p>
        )}
        {records.length > 0 && (
          <Button variant="outline" onClick={handleExport}>
            Export Results
          </Button>
        )}
      </div>

      {records.length === 0 ? (
        <p className="text-gray-500 text-sm">
          Upload an Excel file with columns like: <b>Date</b>, <b>Teller</b>,
          <b>TransactionID</b>, <b>Amount</b>.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-3 text-left">#</th>
                <th className="p-3 text-left">Date</th>
                <th className="p-3 text-left">Teller</th>
                <th className="p-3 text-left">Txn ID</th>
                <th className="p-3 text-left">Amount</th>
                <th className="p-3 text-left">Status</th>
                <th className="p-3 text-left">Note</th>
                <th className="p-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr
                  key={r.id}
                  className={`border-t ${
                    r.status === "Checked"
                      ? "bg-green-50"
                      : r.status === "Exception"
                      ? "bg-red-50"
                      : ""
                  }`}
                >
                  <td className="p-3">{r.id}</td>
                  <td className="p-3">{r.date}</td>
                  <td className="p-3">{r.tellerName}</td>
                  <td className="p-3">{r.txnId}</td>
                  <td className="p-3">{r.amount.toLocaleString()}</td>
                  <td className="p-3 font-medium">{r.status}</td>
                  <td className="p-3">
                    <Input
                      type="text"
                      placeholder="Add note..."
                      value={r.note || ""}
                      onChange={(e) => updateNote(r.id, e.target.value)}
                      className="text-xs"
                    />
                  </td>
                  <td className="p-3 space-x-2">
                    <Button
                      size="sm"
                      variant="default"
                      onClick={() => updateStatus(r.id, "Checked")}
                    >
                      ✔
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => updateStatus(r.id, "Exception")}
                    >
                      ⚠
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
