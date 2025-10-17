"use client"

import { useState } from "react"
import * as XLSX from "xlsx"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table"
import { Download } from "lucide-react"

// Define the shape of each GL row
type GLRow = {
  Date?: string
  Branch?: string
  AccountNo?: string
  Type?: string
  Currency?: string
  Amount?: number
  User?: string
  Authorizer?: string
  Reference?: string
  noBVN?: boolean
  noSignature?: boolean
  alteration?: boolean
  noDate?: boolean
  noAnalysis?: boolean
  wrongNarration?: boolean
  regularized?: boolean
}

export default function HistoryLogs() {
  const [glRows, setGlRows] = useState<GLRow[]>([])
  const [filtered, setFiltered] = useState<GLRow[]>([])
  const [filterUser, setFilterUser] = useState("")

  // Safely parse numeric values
  const safeNumber = (v: any) => {
    const s = String(v || "").replace(/[,₦$]/g, "").trim()
    const n = Number(s)
    return Number.isFinite(n) ? n : 0
  }

  // Handle Excel upload
  const handleFileUpload = async (file: File) => {
    try {
      const data = await file.arrayBuffer()
      const wb = XLSX.read(data, { type: "array" })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" })

      const header = raw[0].map((h) => String(h || "").trim().toLowerCase())

      const rows: GLRow[] = raw.slice(1).map((r) => ({
        Date: String(r[header.findIndex((h) => h.includes("date"))] || ""),
        Branch: String(r[header.findIndex((h) => h.includes("branch"))] || ""),
        AccountNo: String(r[header.findIndex((h) => h.includes("account"))] || ""),
        Type: String(r[header.findIndex((h) => h.includes("dr/cr"))] || ""),
        Currency: String(r[header.findIndex((h) => h.includes("currency"))] || ""),
        Amount: safeNumber(r[header.findIndex((h) => h.includes("amount"))]),
        User: String(r[header.findIndex((h) => h.includes("user"))] || ""),
        Authorizer: String(r[header.findIndex((h) => h.includes("authorizer"))] || ""),
        Reference: String(r[header.findIndex((h) => h.includes("reference"))] || ""),
        noBVN: false,
        noSignature: false,
        alteration: false,
        noDate: false,
        noAnalysis: false,
        wrongNarration: false,
        regularized: false,
      }))

      setGlRows(rows)
      setFiltered(rows)
      alert(`${rows.length} rows loaded ✅`)
    } catch (err) {
      console.error(err)
      alert("Invalid Excel format ❌")
    }
  }

  // Filter by user field
  const applyFilter = () => {
    if (!filterUser.trim()) setFiltered(glRows)
    else setFiltered(glRows.filter((r) => r.User?.toLowerCase().includes(filterUser.toLowerCase())))
  }

  // Toggle flags
  const toggleFlag = (i: number, key: keyof GLRow) => {
    setFiltered((prev) => {
      const copy = [...prev]
      // @ts-ignore
      copy[i][key] = !copy[i][key]
      return copy
    })
  }

  // Get row color
  const getRowColor = (r: GLRow) => {
    const flags = [
      r.noBVN,
      r.noSignature,
      r.alteration,
      r.noDate,
      r.noAnalysis,
      r.wrongNarration,
    ].filter(Boolean).length

    if (flags >= 2) return "bg-red-200 dark:bg-red-800"
    if (flags === 1) return "bg-yellow-200 dark:bg-yellow-700"
    return ""
  }

  // Export to Excel
  const exportResult = () => {
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filtered), "GL_Reviewed")
    XLSX.writeFile(wb, "GL_Review.xlsx")
  }

  // Dummy submit
  const submitData = () => alert("All GL entries reviewed and submitted ✅")

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <Card className="max-w-7xl mx-auto shadow-lg border-none rounded-2xl">
        <CardHeader className="bg-gradient-to-r from-blue-600 to-cyan-500 text-white rounded-t-2xl p-6">
          <CardTitle className="text-2xl font-semibold">History Logs (GL Review)</CardTitle>
          <CardDescription className="text-blue-100">
            Upload GL files and manually flag exceptions (test environment)
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          {/* Upload + Filter */}
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <Label>GL Upload File</Label>
              <Input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
              />
              {glRows.length > 0 && (
                <Badge className="mt-2 bg-blue-600">{glRows.length} Rows Loaded</Badge>
              )}
            </div>
            <div className="flex flex-col justify-end">
              <Label>Filter by User</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Enter username"
                  value={filterUser}
                  onChange={(e) => setFilterUser(e.target.value)}
                  className="w-60"
                />
                <Button onClick={applyFilter}>Filter</Button>
              </div>
            </div>
          </div>

          {/* Table */}
          {filtered.length > 0 && (
            <div className="overflow-auto border rounded-xl bg-white dark:bg-gray-800 shadow-inner mt-6 max-h-[70vh]">
              <Table>
                <TableHeader>
                  <TableRow>
                    {[
                      "Date",
                      "Branch",
                      "AccountNo",
                      "Type",
                      "Currency",
                      "Amount",
                      "User",
                      "Authorizer",
                      "Reference",
                      "No BVN",
                      "No Signature",
                      "Alteration",
                      "No Date",
                      "No Analysis",
                      "Wrong Narration",
                      "Regularized",
                    ].map((h) => (
                      <TableHead key={h}>{h}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r, i) => (
                    <TableRow key={i} className={getRowColor(r)}>
                      <TableCell>{r.Date}</TableCell>
                      <TableCell>{r.Branch}</TableCell>
                      <TableCell>{r.AccountNo}</TableCell>
                      <TableCell>{r.Type}</TableCell>
                      <TableCell>{r.Currency}</TableCell>
                      <TableCell>{r.Amount?.toLocaleString()}</TableCell>
                      <TableCell>{r.User}</TableCell>
                      <TableCell>{r.Authorizer}</TableCell>
                      <TableCell>{r.Reference}</TableCell>

                      {[
                        "noBVN",
                        "noSignature",
                        "alteration",
                        "noDate",
                        "noAnalysis",
                        "wrongNarration",
                      ].map((key) => (
                        <TableCell key={key}>
                          <input
                            type="checkbox"
                            checked={r[key as keyof GLRow] as boolean}
                            onChange={() => toggleFlag(i, key as keyof GLRow)}
                          />
                        </TableCell>
                      ))}
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={r.regularized}
                          onChange={() => toggleFlag(i, "regularized")}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Actions */}
          {filtered.length > 0 && (
            <div className="flex justify-center gap-4 mt-8 flex-wrap">
              <Button
                onClick={exportResult}
                className="bg-gradient-to-r from-blue-600 to-cyan-500 text-white"
              >
                <Download className="mr-2 h-4 w-4" /> Export Reviewed
              </Button>
              <Button variant="outline" onClick={submitData}>
                Dummy Submit
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
