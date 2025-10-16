"use client"

import { useState, useEffect } from "react"
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
import { Download } from "lucide-react"
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table"

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
  Exceptions?: string[] // Added field
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
        Date: String(r[header.findIndex((h) => h.includes("transaction date"))] || ""),
        Branch: String(r[header.findIndex((h) => h.includes("branch"))] || ""),
        AccountNo: String(r[header.findIndex((h) => h.includes("account"))] || ""),
        Type: String(r[header.findIndex((h) => h.includes("dr/cr"))] || ""),
        Currency: String(r[header.findIndex((h) => h.includes("currency"))] || ""),
        Amount: safeNumber(
          r[header.findIndex((h) => h.includes("lcy amount") || h.includes("amount"))]
        ),
        User: String(r[header.findIndex((h) => h.includes("user"))] || ""),
        Authorizer: String(r[header.findIndex((h) => h.includes("authoriser"))] || ""),
        Reference: String(r[header.findIndex((h) => h.includes("reference"))] || ""),
        Exceptions: ["None"], // Default exception
      }))

      const validRows = rows.filter((r) => r.AccountNo)
      setGlRows(validRows)
      setFilteredGl(validRows)
      alert(`${validRows.length} GL Rows Loaded ✅`)
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

  // --- Exception Update ---
  const toggleException = (rowIndex: number, exception: string) => {
    setFilteredGl((prev) =>
      prev.map((row, i) => {
        if (i !== rowIndex) return row
        const exists = row.Exceptions?.includes(exception)
        let updated = exists
          ? row.Exceptions?.filter((e) => e !== exception)
          : [...(row.Exceptions || []), exception]

        if (updated.length === 0) updated = ["None"]
        if (updated.includes("None") && updated.length > 1)
          updated = updated.filter((e) => e !== "None")

        return { ...row, Exceptions: updated }
      })
    )
  }

  // --- Color Logic ---
  const getRowColor = (exceptions: string[] = []) => {
    if (exceptions.length === 1 && exceptions[0] === "None") return "bg-green-100"
    if (exceptions.length === 1) return "bg-yellow-100"
    if (exceptions.length > 1) return "bg-red-100"
    return ""
  }

  // --- Export Result ---
  const handleExport = () => {
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(filteredGl),
      "GL Exceptions"
    )
    XLSX.writeFile(wb, "GL_Exceptions_Report.xlsx")
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-800 p-6">
      <Card className="max-w-7xl mx-auto shadow-xl border-none rounded-2xl">
        <CardHeader className="bg-gradient-to-r from-blue-600 to-teal-500 text-white rounded-t-2xl p-6">
          <CardTitle className="text-2xl font-bold">GL Exception Review</CardTitle>
          <CardDescription className="text-blue-100">
            Upload GL File and Tag Exceptions
          </CardDescription>
        </CardHeader>

        <CardContent className="p-6 space-y-6">
          {/* Upload Section */}
          <div>
            <Label>GL Upload</Label>
            <Input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => e.target.files?.[0] && parseGL(e.target.files[0])}
            />
            {glRows.length > 0 && (
              <Badge className="mt-2 bg-blue-600">{glRows.length} Rows Loaded</Badge>
            )}
          </div>

          {/* Filter Section */}
          {glRows.length > 0 && (
            <div className="flex flex-wrap gap-3 items-center justify-center mt-4">
              <Input
                placeholder="Filter by User ID"
                value={glFilterUser}
                onChange={(e) => setGlFilterUser(e.target.value)}
                className="w-60"
              />
              <Button onClick={handleFilter}>Filter</Button>
            </div>
          )}

          {/* GL Table */}
          {filteredGl.length > 0 && (
            <div className="overflow-auto border rounded-xl bg-white dark:bg-gray-700 shadow-inner mt-6 max-h-[65vh]">
              <Table>
                <TableHeader>
                  <TableRow>
                    {Object.keys(filteredGl[0])
                      .filter((key) => key !== "Exceptions")
                      .map((key) => (
                        <TableHead key={key}>{key}</TableHead>
                      ))}
                    <TableHead>Exceptions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredGl.map((row, i) => (
                    <TableRow key={i} className={getRowColor(row.Exceptions)}>
                      {Object.keys(row)
                        .filter((key) => key !== "Exceptions")
                        .map((key, j) => (
                          <TableCell key={j}>{String((row as any)[key])}</TableCell>
                        ))}
                      <TableCell>
                        {["None", "No BVN", "No Signature", "No Analysis", "No Mandate", "Other"].map(
                          (ex) => (
                            <label key={ex} className="flex items-center gap-1 text-xs">
                              <input
                                type="checkbox"
                                checked={row.Exceptions?.includes(ex) || false}
                                onChange={() => toggleException(i, ex)}
                              />
                              {ex}
                            </label>
                          )
                        )}
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
                <Download className="mr-2 h-4 w-4" /> Export Exceptions
              </Button>
              <Button variant="outline" onClick={() => alert("Submitted Successfully ✅")}>
                Dummy Submit
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
