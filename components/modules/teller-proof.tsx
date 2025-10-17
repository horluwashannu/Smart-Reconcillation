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
}

export default function HistoryLogs() {
  const [glRows, setGlRows] = useState<GLRow[]>([])
  const [filteredRows, setFilteredRows] = useState<GLRow[]>([])
  const [activeTab, setActiveTab] = useState<"debit" | "credit">("debit")
  const [filterUser, setFilterUser] = useState("")

  const safeNumber = (v: any) => {
    const s = String(v || "").replace(/[,₦$]/g, "").trim()
    const n = Number(s)
    return Number.isFinite(n) ? n : 0
  }

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
        Amount: safeNumber(r[header.findIndex((h) => h.includes("lcy amount") || h.includes("amount"))]),
        User: String(r[header.findIndex((h) => h.includes("user"))] || ""),
        Authorizer: String(r[header.findIndex((h) => h.includes("authoriser"))] || ""),
        Reference: String(r[header.findIndex((h) => h.includes("reference"))] || ""),
      }))

      const cleaned = rows.filter((r) => r.AccountNo && r.Amount)
      setGlRows(cleaned)
      setFilteredRows(cleaned)
      alert(`${cleaned.length} GL rows loaded ✅`)
    } catch (err) {
      console.error(err)
      alert("Invalid GL file format or column mismatch ❌")
    }
  }

  const handleFilter = () => {
    if (!filterUser.trim()) {
      setFilteredRows(glRows)
    } else {
      const filtered = glRows.filter((r) =>
        r.User?.toLowerCase().includes(filterUser.toLowerCase())
      )
      setFilteredRows(filtered)
    }
  }

  const currentData = filteredRows.filter((r) =>
    activeTab === "debit"
      ? r.Type?.toLowerCase().includes("dr")
      : r.Type?.toLowerCase().includes("cr")
  )

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <Card className="max-w-7xl mx-auto shadow-lg rounded-2xl">
        <CardHeader className="bg-gradient-to-r from-blue-600 to-indigo-500 text-white rounded-t-2xl p-6">
          <CardTitle className="text-2xl font-bold">GL History Logs</CardTitle>
          <CardDescription className="text-blue-100">
            Upload and review GL Debit/Credit entries
          </CardDescription>
        </CardHeader>

        <CardContent className="p-6 space-y-6">
          {/* Upload Section */}
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end justify-between">
            <div className="w-full sm:w-auto">
              <Label htmlFor="glUpload">GL Upload</Label>
              <Input
                id="glUpload"
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={(e) => e.target.files?.[0] && parseGL(e.target.files[0])}
              />
              {glRows.length > 0 && (
                <Badge className="mt-2 bg-blue-600">{glRows.length} rows loaded</Badge>
              )}
            </div>

            {/* Filter by User */}
            <div className="flex gap-2 w-full sm:w-auto">
              <Input
                placeholder="Filter by User ID"
                value={filterUser}
                onChange={(e) => setFilterUser(e.target.value)}
                className="w-full sm:w-64"
              />
              <Button onClick={handleFilter}>Filter</Button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex w-full mt-4">
            {["debit", "credit"].map((tab) => (
              <Button
                key={tab}
                onClick={() => setActiveTab(tab as "debit" | "credit")}
                variant={activeTab === tab ? "default" : "outline"}
                className="flex-1 py-3 text-lg"
              >
                {tab.toUpperCase()}
              </Button>
            ))}
          </div>

          {/* Table */}
          {currentData.length > 0 ? (
            <div className="overflow-auto mt-6 border rounded-xl bg-white dark:bg-gray-800 shadow-inner max-h-[70vh]">
              <Table>
                <TableHeader>
                  <TableRow>
                    {Object.keys(currentData[0]).map((key) => (
                      <TableHead key={key} className="text-sm font-semibold">
                        {key}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentData.map((row, i) => (
                    <TableRow key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      {Object.values(row).map((val, j) => (
                        <TableCell key={j} className="text-xs">
                          {String(val)}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-center text-gray-500 mt-6">
              No data to display. Upload a GL file and select a tab.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
