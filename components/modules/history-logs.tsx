"use client"

import { useState } from "react"
import * as XLSX from "xlsx"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
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
  // Exception fields
  noBVN?: boolean
  noSignature?: boolean
  alteration?: boolean
  noDate?: boolean
  noAnalysis?: boolean
  wrongNarration?: boolean
  regularized?: boolean
}

export function TellerProof() {
  const [glRows, setGlRows] = useState<GLRow[]>([])
  const [filteredGl, setFilteredGl] = useState<GLRow[]>([])
  const [glFilterUser, setGlFilterUser] = useState("")

  const safeNumber = (v: any) => {
    const s = String(v || "").replace(/[,₦$]/g, "").trim()
    const n = Number(s)
    return Number.isFinite(n) ? n : 0
  }

  // --- GL Parsing ---
  const parseGL = async (file: File) => {
    try {
      const data = await file.arrayBuffer()
      const wb = XLSX.read(data, { type: "array" })
      const sheet = wb.Sheets[wb.SheetNames[0]]
      const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" })

      const header = raw[0].map((h) => String(h || "").trim().toLowerCase())

      const rows: GLRow[] = raw.slice(1).map((r) => ({
        Date: String(r[header.findIndex((h) => h.includes("date"))] || ""),
        Branch: String(r[header.findIndex((h) => h.includes("branch"))] || ""),
        AccountNo: String(r[header.findIndex((h) => h.includes("account"))] || ""),
        Type: String(r[header.findIndex((h) => h.includes("dr/cr"))] || ""),
        Currency: String(r[header.findIndex((h) => h.includes("currency"))] || ""),
        Amount: safeNumber(r[header.findIndex((h) => h.includes("amount"))]),
        User: String(r[header.findIndex((h) => h.includes("user"))] || ""),
        Authorizer: String(r[header.findIndex((h) => h.includes("authoriser"))] || ""),
        Reference: String(r[header.findIndex((h) => h.includes("reference"))] || ""),
        noBVN: false,
        noSignature: false,
        alteration: false,
        noDate: false,
        noAnalysis: false,
        wrongNarration: false,
        regularized: false,
      }))

      setGlRows(rows.filter((r) => r.AccountNo))
      setFilteredGl(rows.filter((r) => r.AccountNo))
      alert(`${rows.length} GL Rows Loaded ✅`)
    } catch {
      alert("Invalid GL file format.")
    }
  }

  // --- GL Filter ---
  const handleFilter = () => {
    if (!glFilterUser.trim()) {
      setFilteredGl(glRows)
    } else {
      const filtered = glRows.filter((r) =>
        r.User?.toLowerCase().includes(glFilterUser.toLowerCase())
      )
      setFilteredGl(filtered)
    }
  }

  // --- Exception Toggle ---
  const toggleException = (i: number, key: keyof GLRow) => {
    setFilteredGl((prev) => {
      const copy = [...prev]
      // @ts-ignore
      copy[i][key] = !copy[i][key]
      return copy
    })
  }

  // --- Regularization Toggle ---
  const toggleRegularized = (i: number) => {
    setFilteredGl((prev) => {
      const copy = [...prev]
      copy[i].regularized = !copy[i].regularized
      return copy
    })
  }

  // --- Row Color based on Flags ---
  const getRowColor = (row: GLRow) => {
    const flags = [
      row.noBVN,
      row.noSignature,
      row.alteration,
      row.noDate,
      row.noAnalysis,
      row.wrongNarration,
    ].filter(Boolean).length

    if (flags >= 2) return "bg-red-200 dark:bg-red-800"
    if (flags === 1) return "bg-yellow-200 dark:bg-yellow-700"
    return ""
  }

  // --- Export ---
  const handleExport = () => {
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filteredGl), "GL Reviewed")
    XLSX.writeFile(wb, "GL_Review_Result.xlsx")
  }

  // --- Dummy Submit ---
  const handleSubmit = () => {
    alert("All GL entries reviewed and submitted successfully ✅")
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-800 p-6">
      <Card className="max-w-7xl mx-auto shadow-xl border-none rounded-2xl">
        <CardHeader className="bg-gradient-to-r from-blue-600 to-teal-500 text-white rounded-t-2xl p-6">
          <CardTitle className="text-2xl font-bold">GL Proof Dashboard</CardTitle>
          <CardDescription className="text-blue-100">
            Upload GL files and mark exceptions (No BVN, No Signature, etc.)
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          {/* Upload */}
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <Label>GL Upload</Label>
              <Input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={(e) => e.target.files?.[0] && parseGL(e.target.files[0])}
              />
              {glRows.length > 0 && (
                <Badge className="mt-2 bg-blue-600">{glRows.length} GL Rows Loaded</Badge>
              )}
            </div>
            <div className="flex flex-col justify-end">
              <Label>Filter by User</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Enter User ID"
                  value={glFilterUser}
                  onChange={(e) => setGlFilterUser(e.target.value)}
                  className="w-60"
                />
                <Button onClick={handleFilter}>Filter</Button>
              </div>
            </div>
          </div>

          {/* Table */}
          {filteredGl.length > 0 && (
            <div className="overflow-auto border rounded-xl bg-white dark:bg-gray-700 shadow-inner mt-6 max-h-[70vh]">
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
                      "Regularized?",
                    ].map((col) => (
                      <TableHead key={col}>{col}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredGl.map((row, i) => (
                    <TableRow key={i} className={getRowColor(row)}>
                      <TableCell>{row.Date}</TableCell>
                      <TableCell>{row.Branch}</TableCell>
                      <TableCell>{row.AccountNo}</TableCell>
                      <TableCell>{row.Type}</TableCell>
                      <TableCell>{row.Currency}</TableCell>
                      <TableCell>{row.Amount?.toLocaleString()}</TableCell>
                      <TableCell>{row.User}</TableCell>
                      <TableCell>{row.Authorizer}</TableCell>
                      <TableCell>{row.Reference}</TableCell>

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
                            checked={row[key as keyof GLRow] as boolean}
                            onChange={() => toggleException(i, key as keyof GLRow)}
                          />
                        </TableCell>
                      ))}
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={row.regularized}
                          onChange={() => toggleRegularized(i)}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Actions */}
          {filteredGl.length > 0 && (
            <div className="flex justify-center gap-4 mt-8 flex-wrap">
              <Button
                onClick={handleExport}
                className="bg-gradient-to-r from-blue-600 to-teal-500 text-white"
              >
                <Download className="mr-2 h-4 w-4" /> Export Reviewed GL
              </Button>
              <Button variant="outline" onClick={handleSubmit}>
                Dummy Submit
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
