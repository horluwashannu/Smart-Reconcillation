"use client"

import React, { useState, useEffect } from "react"
import * as XLSX from "xlsx"
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Download, Upload, Filter } from "lucide-react"

// ✅ Define types for clarity
type GLRecord = {
  accountNumber: string
  description?: string
  amount: number
  type: "Debit" | "Credit"
  date?: string
}

export default function HistoryLogs() {
  const [glData, setGlData] = useState<GLRecord[]>([])
  const [filterType, setFilterType] = useState<"All" | "Debit" | "Credit">("All")
  const [totalDebit, setTotalDebit] = useState(0)
  const [totalCredit, setTotalCredit] = useState(0)

  // ✅ Handle GL Upload
  const handleGLUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      const data = await file.arrayBuffer()
      const workbook = XLSX.read(data, { type: "array" })
      const sheetName = workbook.SheetNames[0]
      const sheet = workbook.Sheets[sheetName]
      const jsonData = XLSX.utils.sheet_to_json(sheet, { defval: "" })

      // Parse based on available headers
      const parsed = (jsonData as any[]).map((row) => {
        const acc =
          row["ACCOUNT NUMBER"] ||
          row["Account Number"] ||
          row["Acct No"] ||
          row["ACCT NO"] ||
          ""
        const desc =
          row["DESCRIPTION"] ||
          row["Description"] ||
          row["Narration"] ||
          row["Particulars"] ||
          ""
        const amt =
          Number(row["AMOUNT"] || row["Amount"] || row["VALUE"] || 0) || 0
        const type =
          (row["TYPE"] ||
            row["Type"] ||
            row["Dr/Cr"] ||
            row["CR/DR"] ||
            row["CREDIT/DEBIT"] ||
            row["Credit/Debit"] ||
            "").toString().toLowerCase()

        let txType: "Debit" | "Credit" = "Debit"
        if (type.includes("cr") || type.includes("credit")) txType = "Credit"

        return {
          accountNumber: acc.toString(),
          description: desc,
          amount: amt,
          type: txType,
          date:
            row["DATE"] ||
            row["Date"] ||
            row["Transaction Date"] ||
            new Date().toLocaleDateString(),
        }
      })

      setGlData(parsed)
      calculateTotals(parsed)
    } catch (error) {
      console.error("Error reading GL file:", error)
      alert("Invalid GL file format. Please check headers and try again.")
    }
  }

  // ✅ Calculate Totals
  const calculateTotals = (data: GLRecord[]) => {
    const debit = data
      .filter((d) => d.type === "Debit")
      .reduce((sum, item) => sum + item.amount, 0)
    const credit = data
      .filter((d) => d.type === "Credit")
      .reduce((sum, item) => sum + item.amount, 0)
    setTotalDebit(debit)
    setTotalCredit(credit)
  }

  // ✅ Apply Filter
  const filteredData =
    filterType === "All"
      ? glData
      : glData.filter((item) => item.type === filterType)

  // ✅ Download GL Data as Excel
  const downloadGL = () => {
    const ws = XLSX.utils.json_to_sheet(glData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "GL Upload")
    XLSX.writeFile(wb, "GL_Upload.xlsx")
  }

  // ✅ Reset All
  const resetAll = () => {
    setGlData([])
    setTotalCredit(0)
    setTotalDebit(0)
    setFilterType("All")
  }

  return (
    <div className="p-6 space-y-6">
      <Card className="shadow-md border border-gray-200">
        <CardHeader>
          <CardTitle className="text-xl font-semibold">General Ledger Upload</CardTitle>
          <CardDescription>
            Upload your GL Excel sheet below to view and filter transactions.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="glFile">Upload GL File</Label>
              <Input
                id="glFile"
                type="file"
                accept=".xlsx, .xls"
                onChange={handleGLUpload}
              />
            </div>

            <div className="flex flex-col justify-end space-y-2 sm:space-y-0 sm:flex-row sm:items-end sm:space-x-2">
              <Button
                variant={filterType === "Debit" ? "default" : "outline"}
                onClick={() => setFilterType("Debit")}
              >
                <Filter className="mr-2 h-4 w-4" /> Debit
              </Button>
              <Button
                variant={filterType === "Credit" ? "default" : "outline"}
                onClick={() => setFilterType("Credit")}
              >
                <Filter className="mr-2 h-4 w-4" /> Credit
              </Button>
              <Button
                variant={filterType === "All" ? "default" : "outline"}
                onClick={() => setFilterType("All")}
              >
                <Filter className="mr-2 h-4 w-4" /> All
              </Button>
            </div>

            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={downloadGL}>
                <Download className="mr-2 h-4 w-4" /> Export
              </Button>
              <Button variant="destructive" onClick={resetAll}>
                Clear
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ✅ GL TABLE SECTION */}
      {glData.length > 0 ? (
        <Card className="shadow-md border border-gray-200">
          <CardHeader>
            <CardTitle className="text-lg font-semibold flex items-center justify-between">
              <span>GL Transactions ({filterType})</span>
              <Badge variant="secondary">{filteredData.length} Records</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="overflow-auto">
            <table className="min-w-full border border-gray-200">
              <thead className="bg-gray-100 text-left">
                <tr>
                  <th className="p-2 border">Date</th>
                  <th className="p-2 border">Account Number</th>
                  <th className="p-2 border">Description</th>
                  <th className="p-2 border">Amount (₦)</th>
                  <th className="p-2 border">Type</th>
                </tr>
              </thead>
              <tbody>
                {filteredData.map((item, index) => (
                  <tr
                    key={index}
                    className={`border-b hover:bg-gray-50 ${
                      item.type === "Credit"
                        ? "text-green-700"
                        : "text-red-700"
                    }`}
                  >
                    <td className="p-2 border">{item.date}</td>
                    <td className="p-2 border">{item.accountNumber}</td>
                    <td className="p-2 border">{item.description}</td>
                    <td className="p-2 border">
                      {item.amount.toLocaleString("en-NG", {
                        style: "currency",
                        currency: "NGN",
                      })}
                    </td>
                    <td className="p-2 border">{item.type}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-100 font-semibold">
                <tr>
                  <td colSpan={3} className="p-2 border text-right">
                    Total Debit:
                  </td>
                  <td className="p-2 border text-red-700">
                    {totalDebit.toLocaleString("en-NG", {
                      style: "currency",
                      currency: "NGN",
                    })}
                  </td>
                  <td className="p-2 border"></td>
                </tr>
                <tr>
                  <td colSpan={3} className="p-2 border text-right">
                    Total Credit:
                  </td>
                  <td className="p-2 border text-green-700">
                    {totalCredit.toLocaleString("en-NG", {
                      style: "currency",
                      currency: "NGN",
                    })}
                  </td>
                  <td className="p-2 border"></td>
                </tr>
              </tfoot>
            </table>
          </CardContent>
        </Card>
      ) : (
        <div className="text-center py-10 text-gray-500">
          <p>No GL data uploaded yet.</p>
        </div>
      )}
    </div>
  )
}
