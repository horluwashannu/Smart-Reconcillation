"use client"

import React, { useState } from "react"
import * as XLSX from "xlsx"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Upload, CheckCircle, AlertTriangle, Download } from "lucide-react"

export default function TellerGLReconciliation() {
  const [tellerData, setTellerData] = useState<any[]>([])
  const [glData, setGlData] = useState<any[]>([])
  const [matchedData, setMatchedData] = useState<any[]>([])
  const [totals, setTotals] = useState({ tellerDebit: 0, tellerCredit: 0, glDebit: 0, glCredit: 0 })
  const [difference, setDifference] = useState(0)
  const [previewLimit, setPreviewLimit] = useState(50)

  // -------- Excel Upload Handler --------
  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>, type: "teller" | "gl") => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (evt) => {
      const data = new Uint8Array(evt.target?.result as ArrayBuffer)
      const workbook = XLSX.read(data, { type: "array" })
      const sheet = workbook.Sheets[workbook.SheetNames[0]]
      const json = XLSX.utils.sheet_to_json(sheet, { defval: "" })

      const formatted = json.map((row: any, i: number) => ({
        id: i + 1,
        account: row.Account || row["Account Number"] || row["Acct No"] || "",
        amount: parseFloat(row.Amount || row["Amount (₦)"] || 0),
        side:
          row.Debit || row["Dr"] ? "debit" : row.Credit || row["Cr"] ? "credit" : "unknown",
        narration: row.Narration || row.Description || "",
        date: row.Date || "",
      }))

      if (type === "teller") setTellerData(formatted)
      else setGlData(formatted)
    }
    reader.readAsArrayBuffer(file)
  }

  // -------- Matching Logic --------
  const reconcileData = () => {
    if (!tellerData.length || !glData.length) return alert("Upload both Teller and GL files")

    const matched: any[] = []
    const unmatchedTeller = [...tellerData]
    const unmatchedGL = [...glData]

    unmatchedTeller.forEach((teller) => {
      const matchIndex = unmatchedGL.findIndex(
        (gl) =>
          String(gl.account).trim() === String(teller.account).trim() &&
          Number(gl.amount) === Number(teller.amount)
      )
      if (matchIndex !== -1) {
        matched.push({ ...teller, matched: true })
        unmatchedGL.splice(matchIndex, 1)
      } else {
        matched.push({ ...teller, matched: false })
      }
    })

    setMatchedData(matched)

    const tellerDebit = tellerData
      .filter((r) => r.side === "debit")
      .reduce((a, b) => a + b.amount, 0)
    const tellerCredit = tellerData
      .filter((r) => r.side === "credit")
      .reduce((a, b) => a + b.amount, 0)
    const glDebit = glData.filter((r) => r.side === "debit").reduce((a, b) => a + b.amount, 0)
    const glCredit = glData.filter((r) => r.side === "credit").reduce((a, b) => a + b.amount, 0)
    setTotals({ tellerDebit, tellerCredit, glDebit, glCredit })

    const till = tellerCredit - tellerDebit
    const glNet = glCredit - glDebit
    setDifference(till - glNet)
  }

  // -------- Export Logic --------
  const handleExport = () => {
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(tellerData),
      "Teller"
    )
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(glData), "GL")
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(matchedData), "Matched")
    XLSX.writeFile(wb, "Teller_GL_Reconciliation.xlsx")
  }

  const computedTill = totals.tellerCredit - totals.tellerDebit

  // -------- Render --------
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Teller & GL Reconciliation Dashboard</CardTitle>
          <CardDescription>Upload, review, and reconcile teller vs GL transactions.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <Upload className="w-4 h-4" />
              <span>Teller Excel</span>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                hidden
                onChange={(e) => handleExcelUpload(e, "teller")}
              />
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <Upload className="w-4 h-4" />
              <span>GL Excel</span>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                hidden
                onChange={(e) => handleExcelUpload(e, "gl")}
              />
            </label>
            <Button onClick={reconcileData}>Reconcile</Button>
          </div>

          <Tabs defaultValue="teller" className="mt-6">
            <TabsList>
              <TabsTrigger value="teller">Teller</TabsTrigger>
              <TabsTrigger value="gl">GL</TabsTrigger>
              <TabsTrigger value="matched">Matched Summary</TabsTrigger>
            </TabsList>

            {/* Teller Tab */}
            <TabsContent value="teller">
              <div className="overflow-auto max-h-[60vh] mt-4">
                <table className="min-w-full text-sm border">
                  <thead className="bg-gray-100 dark:bg-gray-800 sticky top-0">
                    <tr>
                      <th className="p-2 text-left">Acct No</th>
                      <th className="p-2">Side</th>
                      <th className="p-2 text-right">Amount</th>
                      <th className="p-2">Narration</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tellerData.slice(0, previewLimit).map((r) => (
                      <tr key={r.id} className="border-b">
                        <td className="p-2">{r.account}</td>
                        <td className="p-2 capitalize">{r.side}</td>
                        <td className="p-2 text-right">₦{r.amount.toLocaleString()}</td>
                        <td className="p-2">{r.narration}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </TabsContent>

            {/* GL Tab */}
            <TabsContent value="gl">
              <div className="overflow-auto max-h-[60vh] mt-4">
                <table className="min-w-full text-sm border">
                  <thead className="bg-gray-100 dark:bg-gray-800 sticky top-0">
                    <tr>
                      <th className="p-2 text-left">Acct No</th>
                      <th className="p-2">Side</th>
                      <th className="p-2 text-right">Amount</th>
                      <th className="p-2">Narration</th>
                    </tr>
                  </thead>
                  <tbody>
                    {glData.slice(0, previewLimit).map((r) => (
                      <tr key={r.id} className="border-b">
                        <td className="p-2">{r.account}</td>
                        <td className="p-2 capitalize">{r.side}</td>
                        <td className="p-2 text-right">₦{r.amount.toLocaleString()}</td>
                        <td className="p-2">{r.narration}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </TabsContent>

            {/* Matched Summary */}
            <TabsContent value="matched">
              <div className="overflow-auto max-h-[60vh] mt-4">
                <table className="min-w-full text-sm border">
                  <thead className="bg-gray-100 dark:bg-gray-800 sticky top-0">
                    <tr>
                      <th className="p-2 text-left">Acct No</th>
                      <th className="p-2">Side</th>
                      <th className="p-2 text-right">Amount</th>
                      <th className="p-2">Narration</th>
                      <th className="p-2 text-center">Match</th>
                    </tr>
                  </thead>
                  <tbody>
                    {matchedData.slice(0, previewLimit).map((r) => (
                      <tr
                        key={r.id}
                        className={`border-b ${
                          r.matched ? "bg-green-50" : "bg-red-50"
                        }`}
                      >
                        <td className="p-2">{r.account}</td>
                        <td className="p-2 capitalize">{r.side}</td>
                        <td className="p-2 text-right">₦{r.amount.toLocaleString()}</td>
                        <td className="p-2">{r.narration}</td>
                        <td className="p-2 text-center">
                          {r.matched ? (
                            <CheckCircle className="h-4 w-4 text-green-600 inline" />
                          ) : (
                            <AlertTriangle className="h-4 w-4 text-red-600 inline" />
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex items-center justify-between mt-4">
            <Button variant="outline" onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" /> Export Full Report
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Computed Till vs GL Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <div className="text-sm text-muted-foreground">Teller Till</div>
              <div className="text-xl font-bold">₦{computedTill.toLocaleString()}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">GL Net (Cr - Dr)</div>
              <div className="text-xl font-bold">
                ₦{(totals.glCredit - totals.glDebit).toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Difference</div>
              <div
                className={`text-xl font-bold ${
                  Math.abs(difference) < 1 ? "text-green-600" : "text-red-600"
                }`}
              >
                ₦{difference.toLocaleString()}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
