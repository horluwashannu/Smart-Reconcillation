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
import { Download, PlusCircle, Eye } from "lucide-react"
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table"
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

type TellerRow = {
  CHEQUES?: number
  WITHDRAWAL?: number
  ACCOUNT_NO?: string
  SAVINGS?: number
  DEPOSIT?: number
  TO_VAULT?: number
  EXPENSE?: number
  WUMT?: number
}

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

export function TellerProof() {
  const [activeTab, setActiveTab] = useState<
    "teller_debit" | "teller_credit" | "gl_debit" | "gl_credit"
  >("teller_debit")

  // Rows
  const [tellerRows, setTellerRows] = useState<TellerRow[]>([])
  const [castRows, setCastRows] = useState<TellerRow[]>([{}])
  const [glRows, setGlRows] = useState<GLRow[]>([])
  const [filteredGl, setFilteredGl] = useState<GLRow[]>([])
  const [glFilterUser, setGlFilterUser] = useState("")

  // Inputs
  const [manualBuy, setManualBuy] = useState(0)
  const [manualSell, setManualSell] = useState(0)

  // Sums
  const [tellerTotals, setTellerTotals] = useState({ buy: 0, sell: 0 })
  const [castTotals, setCastTotals] = useState({ buy: 0, sell: 0 })
  const [glTotals, setGlTotals] = useState({ total: 0 })
  const [pendingGLTotal, setPendingGLTotal] = useState(0)

  // UI
  const [openCast, setOpenCast] = useState(false)
  const [openPendingGL, setOpenPendingGL] = useState(false)
  const [viewMore, setViewMore] = useState(false)

  const safeNumber = (v: any) => {
    const s = String(v || "").replace(/[,₦$]/g, "").trim()
    const n = Number(s)
    return Number.isFinite(n) ? n : 0
  }

  // --- GL parsing ---
  const parseGL = async (file: File) => {
    try {
      const data = await file.arrayBuffer()
      const wb = XLSX.read(data, { type: "array" })
      const sheet = wb.Sheets[wb.SheetNames[0]]
      const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" })
      const header = raw[0].map((h) => String(h || "").trim().toLowerCase())
      const rows = raw.slice(1).map((r) => ({
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
      }))
      setGlRows(rows.filter((r) => r.AccountNo))
      setFilteredGl(rows.filter((r) => r.AccountNo))
    } catch {
      alert("Invalid GL file format.")
    }
  }

  const handleFilter = () => {
    if (!glFilterUser.trim()) setFilteredGl(glRows)
    else {
      const filtered = glRows.filter((r) =>
        r.User?.toLowerCase().includes(glFilterUser.toLowerCase())
      )
      setFilteredGl(filtered)
    }
  }

  const handleExport = () => {
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(tellerRows), "Teller")
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(glRows), "GL")
    XLSX.writeFile(wb, "TellerProofResult.xlsx")
  }

  // --- Auto Sums ---
  const recalcTotals = () => {
    const tellerBuy = tellerRows.reduce(
      (sum, r) => sum + safeNumber(r.DEPOSIT) + safeNumber(r.SAVINGS) + safeNumber(r.CHEQUES),
      0
    )
    const tellerSell = tellerRows.reduce(
      (sum, r) =>
        sum + safeNumber(r.WITHDRAWAL) + safeNumber(r.TO_VAULT) + safeNumber(r.EXPENSE) + safeNumber(r.WUMT),
      0
    )
    setTellerTotals({ buy: tellerBuy, sell: tellerSell })

    const castBuy = castRows.reduce(
      (sum, r) => sum + safeNumber(r.DEPOSIT) + safeNumber(r.SAVINGS) + safeNumber(r.CHEQUES),
      0
    )
    const castSell = castRows.reduce(
      (sum, r) =>
        sum + safeNumber(r.WITHDRAWAL) + safeNumber(r.TO_VAULT) + safeNumber(r.EXPENSE) + safeNumber(r.WUMT),
      0
    )
    setCastTotals({ buy: castBuy, sell: castSell })

    const glSum = glRows.reduce((sum, r) => sum + safeNumber(r.Amount), 0)
    setGlTotals({ total: glSum })

    const matchedAccounts = new Set([
      ...tellerRows.map((r) => r.ACCOUNT_NO),
      ...castRows.map((r) => r.ACCOUNT_NO),
    ])
    const pending = glRows
      .filter((r) => !matchedAccounts.has(r.AccountNo))
      .reduce((sum, r) => sum + safeNumber(r.Amount), 0)
    setPendingGLTotal(pending)
  }

  useEffect(() => recalcTotals(), [tellerRows, castRows, glRows])

  // --- CAST popup ---
  const handleCastChange = (i: number, key: keyof TellerRow, value: any) => {
    const newRows = [...castRows]
    newRows[i][key] = value
    setCastRows(newRows)
  }
  const addCastRow = () => setCastRows([...castRows, {}])
  const saveCastRows = () => {
    setTellerRows([...tellerRows, ...castRows])
    setCastRows([{}])
    setOpenCast(false)
    alert("CAST rows added to Teller ✅")
  }

  const currentData =
    activeTab === "teller_debit" || activeTab === "teller_credit"
      ? tellerRows
      : filteredGl

  const displayData = viewMore ? currentData : currentData.slice(0, 15)

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-teal-100 dark:from-gray-900 dark:to-gray-800 p-6 text-gray-900 dark:text-gray-100">
      <Card className="w-full mx-auto shadow-xl border-none rounded-2xl bg-white dark:bg-gray-900">
        <CardHeader className="bg-gradient-to-r from-blue-600 to-teal-500 text-white rounded-t-2xl p-6">
          <CardTitle className="text-2xl font-bold">Teller Proof Dashboard</CardTitle>
          <CardDescription className="text-blue-100">
            Upload or Input Teller & GL files for reconciliation and preview
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          {/* Uploads */}
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <Label>CAST Upload</Label>
              <Input type="file" accept=".xlsx,.xls,.csv" />
            </div>
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
          </div>

          {/* Manual Buy/Sell */}
          <div className="flex flex-wrap gap-6 mt-6">
            <div>
              <Label>Manual Buy (₦)</Label>
              <Input
                type="number"
                value={manualBuy}
                onChange={(e) => setManualBuy(safeNumber(e.target.value))}
              />
            </div>
            <div>
              <Label>Manual Sell (₦)</Label>
              <Input
                type="number"
                value={manualSell}
                onChange={(e) => setManualSell(safeNumber(e.target.value))}
              />
            </div>
          </div>

          {/* Totals Footer */}
          <div className="flex flex-wrap gap-4 mt-6">
            <div className="p-4 rounded-xl w-60 text-white font-bold text-center bg-green-600">
              Total Buy (₦): {(tellerTotals.buy + castTotals.buy + manualBuy).toLocaleString()}
            </div>
            <div className="p-4 rounded-xl w-60 text-white font-bold text-center bg-green-600">
              Total Sell (₦): {(tellerTotals.sell + castTotals.sell + manualSell).toLocaleString()}
            </div>
            <div className="p-4 rounded-xl w-60 text-white font-bold text-center bg-yellow-600">
              Pending GL (₦): {pendingGLTotal.toLocaleString()}
            </div>
            <div className="p-4 rounded-xl w-60 text-white font-bold text-center bg-blue-600">
              Difference (₦): {(tellerTotals.buy + castTotals.buy + manualBuy) - pendingGLTotal}
            </div>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
            <TabsList className="grid grid-cols-4 w-full mt-6">
              <TabsTrigger value="teller_debit">TELLER DEBIT</TabsTrigger>
              <TabsTrigger value="teller_credit">TELLER CREDIT</TabsTrigger>
              <TabsTrigger value="gl_debit">GL DEBIT</TabsTrigger>
              <TabsTrigger value="gl_credit">GL CREDIT</TabsTrigger>
            </TabsList>
            <TabsContent value={activeTab}>
              {activeTab.includes("gl") && (
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

              {currentData.length > 0 && (
                <div className="overflow-auto border rounded-xl bg-white dark:bg-gray-800 shadow-inner mt-6 max-h-[500px] w-full">
                  <Table className="w-full">
                    <TableHeader>
                      <TableRow>
                        {Object.keys(currentData[0])
                          .slice(0, 8)
                          .map((key) => (
                            <TableHead key={key}>{key}</TableHead>
                          ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {displayData.map((row, i) => (
                        <TableRow key={i}>
                          {Object.values(row)
                            .slice(0, 8)
                            .map((val, j) => (
                              <TableCell key={j}>{String(val)}</TableCell>
                            ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {currentData.length > 15 && (
                <div className="flex justify-center mt-4">
                  <Button variant="outline" onClick={() => setViewMore(!viewMore)}>
                    {viewMore ? "Show Less" : "View More"}
                  </Button>
                </div>
              )}
            </TabsContent>
          </Tabs>

          {/* CAST popup button */}
          <div className="flex justify-between mt-6 flex-wrap gap-4">
            <Button onClick={() => setOpenCast(true)} className="bg-teal-600 text-white">
              <PlusCircle className="mr-2 h-4 w-4" /> Input CAST
            </Button>
            <Button onClick={() => setOpenPendingGL(true)} className="bg-yellow-600 text-white">
              <Eye className="mr-2 h-4 w-4" /> Preview Pending GL
            </Button>
          </div>

          {/* CAST popup */}
          <Dialog open={openCast} onOpenChange={setOpenCast}>
            <DialogContent className="w-full max-w-[98vw] h-[90vh] overflow-auto">
              <DialogHeader>
                <DialogTitle>Input CAST (Excel-like)</DialogTitle>
              </DialogHeader>

              <div className="overflow-auto max-h-[70vh]">
                <Table className="w-full border">
                  <TableHeader>
                    <TableRow>
                      {[
                        "CHEQUES",
                        "WITHDRAWAL (₦)",
                        "ACCOUNT NO",
                        "SAVINGS (₦)",
                        "DEPOSIT (₦)",
                        "TO VAULT",
                        "EXPENSE",
                        "WUMT",
                      ].map((col) => (
                        <TableHead key={col}>{col}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {castRows.map((row, i) => (
                      <TableRow key={i}>
                        {(
                          [
                            "CHEQUES",
                            "WITHDRAWAL",
                            "ACCOUNT_NO",
                            "SAVINGS",
                            "DEPOSIT",
                            "TO_VAULT",
                            "EXPENSE",
                            "WUMT",
                          ] as (keyof TellerRow)[]
                        ).map((key, j) => (
                          <TableCell key={j}>
                            <Input
                              value={row[key] || ""}
                              type={typeof row[key] === "number" ? "number" : "text"}
                              onChange={(e) => handleCastChange(i, key, e.target.value)}
                              className="w-full"
                            />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                    {/* CAST Footer Totals */}
                    <TableRow className="bg-gray-200 dark:bg-gray-700 font-bold">
                      <TableCell>Total</TableCell>
                      <TableCell>{castRows.reduce((sum, r) => sum + safeNumber(r.WITHDRAWAL), 0)}</TableCell>
                      <TableCell></TableCell>
                      <TableCell>{castRows.reduce((sum, r) => sum + safeNumber(r.SAVINGS), 0)}</TableCell>
                      <TableCell>{castRows.reduce((sum, r) => sum + safeNumber(r.DEPOSIT), 0)}</TableCell>
                      <TableCell>{castRows.reduce((sum, r) => sum + safeNumber(r.TO_VAULT), 0)}</TableCell>
                      <TableCell>{castRows.reduce((sum, r) => sum + safeNumber(r.EXPENSE), 0)}</TableCell>
                      <TableCell>{castRows.reduce((sum, r) => sum + safeNumber(r.WUMT), 0)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>

              <div className="flex justify-end gap-4 mt-4">
                <Button onClick={() => setOpenCast(false)} variant="outline">
                  Cancel
                </Button>
                <Button onClick={saveCastRows} className="bg-teal-600 text-white">
                  Save CAST
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Pending GL popup */}
          <Dialog open={openPendingGL} onOpenChange={setOpenPendingGL}>
            <DialogContent className="w-full max-w-[98vw] h-[90vh] overflow-auto">
              <DialogHeader>
                <DialogTitle>Pending GL Transactions</DialogTitle>
              </DialogHeader>
              <div className="overflow-auto max-h-[75vh]">
                <Table className="w-full border">
                  <TableHeader>
                    <TableRow>
                      {Object.keys(filteredGl[0] || {}).map((col) => (
                        <TableHead key={col}>{col}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredGl
                      .filter(
                        (r) =>
                          ![...tellerRows, ...castRows].map((x) => x.ACCOUNT_NO).includes(r.AccountNo)
                      )
                      .map((row, i) => (
                        <TableRow key={i}>
                          {Object.values(row).map((val, j) => (
                            <TableCell key={j}>{String(val)}</TableCell>
                          ))}
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>
              <div className="flex justify-end mt-4">
                <Button onClick={() => setOpenPendingGL(false)}>Close</Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Actions */}
          <div className="flex justify-center gap-4 mt-8 flex-wrap">
            <Button onClick={handleExport} className="bg-gradient-to-r from-blue-600 to-teal-500 text-white">
              <Download className="mr-2 h-4 w-4" /> Export Result
            </Button>
            <Button variant="outline" onClick={() => alert("Submitted Successfully ✅")}>
              Dummy Submit
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
