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
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table"

type GLRow = {
  BranchCode?: string
  TransactionDescription?: string
  AccountNumber?: string
  AccountDescription?: string
  CurrencyDrCr?: string
  BatchNo?: string
  TransactionDate?: string
  UserID?: string
  AuthoriserID?: string
  Status?: string
}

export function GLProof() {
  const [glRows, setGlRows] = useState<GLRow[]>([])
  const [filteredGl, setFilteredGl] = useState<GLRow[]>([])
  const [filterTerm, setFilterTerm] = useState("")
  const [filterType, setFilterType] = useState<"UserID" | "AuthoriserID" | "AccountNumber">("UserID")

  const safeString = (v: any) => String(v || "").trim()

  const parseGL = async (file: File) => {
    try {
      const data = await file.arrayBuffer()
      const wb = XLSX.read(data, { type: "array" })
      const sheet = wb.Sheets[wb.SheetNames[0]]
      const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" })

      const header = raw[0].map((h) => safeString(h).toLowerCase())
      const findIndex = (key: string) => header.findIndex((h) => h.includes(key))

      const rows: GLRow[] = raw.slice(1).map((r) => ({
        BranchCode: safeString(r[findIndex("originating branch code")]),
        TransactionDescription: safeString(r[findIndex("transaction description")]),
        AccountNumber: safeString(r[findIndex("account number")]),
        AccountDescription: safeString(r[findIndex("account / gl description")]),
        CurrencyDrCr: safeString(r[findIndex("dr / cr")]),
        BatchNo: safeString(r[findIndex("batch no")]),
        TransactionDate: safeString(r[findIndex("transaction date")]),
        UserID: safeString(r[findIndex("user id")]),
        AuthoriserID: safeString(r[findIndex("authoriser id")]),
      }))

      // Auto-detect audit status logic (simple sample: you can adjust)
      const processed = rows.map((r) => {
        let status = "Okay"
        if (r.UserID && r.AuthoriserID && r.UserID === r.AuthoriserID) status = "Detected"
        else if (!r.AuthoriserID) status = "Regularized"
        return { ...r, Status: status }
      })

      setGlRows(processed)
      setFilteredGl(processed)
      alert(`${processed.length} GL Rows Loaded ✅`)
    } catch (err) {
      console.error(err)
      alert("Invalid GL file format or missing required columns.")
    }
  }

  const handleFilter = () => {
    if (!filterTerm.trim()) {
      setFilteredGl(glRows)
    } else {
      const filtered = glRows.filter((r) =>
        (r[filterType] || "").toLowerCase().includes(filterTerm.toLowerCase())
      )
      setFilteredGl(filtered)
    }
  }

  const getStatusColor = (status?: string) => {
    switch (status) {
      case "Detected":
        return "bg-red-600 text-white"
      case "Regularized":
        return "bg-yellow-400 text-black"
      default:
        return "bg-green-600 text-white"
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-800 p-6">
      <Card className="max-w-7xl mx-auto shadow-xl border-none rounded-2xl">
        <CardHeader className="bg-gradient-to-r from-blue-600 to-teal-500 text-white rounded-t-2xl p-6">
          <CardTitle className="text-2xl font-bold">GL Proof Dashboard</CardTitle>
          <CardDescription className="text-blue-100">
            Upload GL file for audit and reconciliation
          </CardDescription>
        </CardHeader>

        <CardContent className="p-6 space-y-6">
          {/* GL Upload */}
          <div>
            <Label>Upload GL File</Label>
            <Input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => e.target.files?.[0] && parseGL(e.target.files[0])}
            />
            {glRows.length > 0 && (
              <Badge className="mt-2 bg-blue-600">{glRows.length} Rows Loaded</Badge>
            )}
          </div>

          {/* Filters */}
          {glRows.length > 0 && (
            <div className="flex flex-wrap items-center gap-4 mt-6">
              <select
                className="border rounded-md p-2"
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as any)}
              >
                <option value="UserID">User ID</option>
                <option value="AuthoriserID">Authoriser ID</option>
                <option value="AccountNumber">Account Number</option>
              </select>
              <Input
                placeholder={`Filter by ${filterType}`}
                value={filterTerm}
                onChange={(e) => setFilterTerm(e.target.value)}
                className="w-60"
              />
              <Button onClick={handleFilter}>Apply Filter</Button>
            </div>
          )}

          {/* Exception Status Box */}
          <div className="flex justify-center gap-3 mt-4">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 bg-red-600 rounded-full"></span> Detected
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 bg-yellow-400 rounded-full"></span> Regularized
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 bg-green-600 rounded-full"></span> Okay
            </div>
          </div>

          {/* Preview Table */}
          {filteredGl.length > 0 && (
            <div className="overflow-auto border rounded-xl bg-white dark:bg-gray-700 shadow-inner mt-6 max-h-[65vh]">
              <Table>
                <TableHeader>
                  <TableRow>
                    {[
                      "Branch Code",
                      "Transaction Description",
                      "Account Number",
                      "Account/GL Description",
                      "Currency DR/CR",
                      "Batch No",
                      "Transaction Date",
                      "User ID",
                      "Authoriser ID",
                      "Status",
                    ].map((col) => (
                      <TableHead key={col}>{col}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredGl.map((row, i) => (
                    <TableRow key={i}>
                      <TableCell>{row.BranchCode}</TableCell>
                      <TableCell>{row.TransactionDescription}</TableCell>
                      <TableCell>{row.AccountNumber}</TableCell>
                      <TableCell>{row.AccountDescription}</TableCell>
                      <TableCell>{row.CurrencyDrCr}</TableCell>
                      <TableCell>{row.BatchNo}</TableCell>
                      <TableCell>{row.TransactionDate}</TableCell>
                      <TableCell>{row.UserID}</TableCell>
                      <TableCell>{row.AuthoriserID}</TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(row.Status)}>
                          {row.Status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
