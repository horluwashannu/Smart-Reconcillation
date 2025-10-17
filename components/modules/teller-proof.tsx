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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

type TellerRow = {
  ACCOUNT_NO?: string
  WITHDRAWAL?: number
  DEPOSIT?: number
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

  const [tellerRows, setTellerRows] = useState<TellerRow[]>([])
  const [castRows, setCastRows] = useState<TellerRow[]>([])
  const [glRows, setGlRows] = useState<GLRow[]>([])
  const [filteredGl, setFilteredGl] = useState<GLRow[]>([])

  const [tellerName, setTellerName] = useState("")
  const [supervisorName, setSupervisorName] = useState("")
  const [glFilterUser, setGlFilterUser] = useState("")
  const [openCast, setOpenCast] = useState(false)
  const [openPendingGL, setOpenPendingGL] = useState(false)
  const [buyAmount, setBuyAmount] = useState<number>(0)
  const [sellAmount, setSellAmount] = useState<number>(0)

  const safeNumber = (v: any) => {
    const s = String(v || "").replace(/[,₦$]/g, "").trim()
    const n = Number(s)
    return Number.isFinite(n) ? n : 0
  }

  // --- Teller Upload Parsing ---
  const parseTellerUpload = async (file: File) => {
    try {
      const data = await file.arrayBuffer()
      const wb = XLSX.read(data, { type: "array" })
      const sheet = wb.Sheets[wb.SheetNames[0]]
      const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" })
      const header = raw[0]
        .map((h) =>
          String(h || "")
            .replace(/\s+/g, "_")
            .replace(/\(N\)/g, "")
            .toUpperCase()
        )

      const rows: TellerRow[] = []
      raw.slice(1).forEach((r) => {
        const obj: any = {}
        header.forEach((h, i) => {
          obj[h] = r[i]
        })

        if (safeNumber(obj["CHEQUES"]) > 0)
          rows.push({ ACCOUNT_NO: obj["ACCOUNT_NO"] || "", WITHDRAWAL: safeNumber(obj["CHEQUES"]) })
        if (safeNumber(obj["SAVINGS"]) > 0)
          rows.push({ ACCOUNT_NO: obj["ACCOUNT_NO_2"] || "", WITHDRAWAL: safeNumber(obj["SAVINGS"]) })
        if (safeNumber(obj["DEPOSIT"]) > 0)
          rows.push({ ACCOUNT_NO: obj["ACCOUNT_NO_3"] || "", DEPOSIT: safeNumber(obj["DEPOSIT"]) })
        if (safeNumber(obj["EXPENSE"]) > 0)
          rows.push({ ACCOUNT_NO: obj["ACCOUNT_NO_4"] || "", EXPENSE: safeNumber(obj["EXPENSE"]) })
        if (safeNumber(obj["WUMT"]) > 0)
          rows.push({ ACCOUNT_NO: obj["ACCOUNT_NO_5"] || "", WUMT: safeNumber(obj["WUMT"]) })
      })

      setTellerRows(rows)
      recalcTotals()
      alert(`${rows.length} Teller Rows Loaded ✅`)
    } catch (err) {
      console.error(err)
      alert("Invalid Teller file or column mismatch")
    }
  }

  // --- GL Parsing (Updated for your Excel format) ---
  const parseGL = async (file: File) => {
    try {
      const data = await file.arrayBuffer()
      const wb = XLSX.read(data, { type: "array" })
      const sheet = wb.Sheets[wb.SheetNames[0]]
      const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" })
      const header = raw[0].map((h) => String(h || "").trim().toLowerCase())

      const rows: GLRow[] = raw.slice(1).map((r) => {
        const branch = String(r[header.findIndex((h) => h.includes("branch"))] || "")
        const product = String(r[header.findIndex((h) => h.includes("product"))] || "")
        const acct = String(r[header.findIndex((h) => h.includes("account"))] || "")
        const narration = String(r[header.findIndex((h) => h.includes("narration"))] || "")
        const currency = String(r[header.findIndex((h) => h.includes("currency"))] || "")
        const drcr = String(r[header.findIndex((h) => h.includes("dr"))] || "").toUpperCase()
        const amount = safeNumber(
          r[header.findIndex((h) => h.includes("lcy amount"))] ||
          r[header.findIndex((h) => h.includes("amount"))]
        )
        const date = String(r[header.findIndex((h) => h.includes("transaction date"))] || "")
        const user = String(r[header.findIndex((h) => h.includes("user"))] || "")
        const auth = String(r[header.findIndex((h) => h.includes("authoriser"))] || "")

        return {
          Date: date,
          Branch: branch,
          AccountNo: acct,
          Type: drcr === "D" ? "DEBIT" : drcr === "C" ? "CREDIT" : "",
          Currency: currency,
          Amount: amount,
          User: user,
          Authorizer: auth,
          Reference: narration,
        }
      })

      const validRows = rows.filter((r) => r.AccountNo && r.Type)
      setGlRows(validRows)
      setFilteredGl(validRows)

      alert(`${validRows.length} GL Rows Loaded ✅`)
    } catch (err) {
      console.error(err)
      alert("Invalid GL file format or missing required columns.")
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

  // --- CAST Popup Save ---
  const saveCastRows = () => {
    setTellerRows((prev) => [...prev, ...castRows])
    recalcTotals()
    setOpenCast(false)
  }

  // --- Export ---
  const handleExport = () => {
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(tellerRows), "Teller")
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(glRows), "GL")
    XLSX.writeFile(wb, "TellerProofResult.xlsx")
  }

  // --- Recalculate Totals ---
  const [totals, setTotals] = useState({
    withdrawal: 0,
    deposit: 0,
    expense: 0,
    wumt: 0,
    buy: 0,
    sell: 0,
  })

  const recalcTotals = () => {
    const withdrawal = tellerRows.reduce((sum, r) => sum + safeNumber(r.WITHDRAWAL), 0)
    const deposit = tellerRows.reduce((sum, r) => sum + safeNumber(r.DEPOSIT), 0)
    const expense = tellerRows.reduce((sum, r) => sum + safeNumber(r.EXPENSE), 0)
    const wumt = tellerRows.reduce((sum, r) => sum + safeNumber(r.WUMT), 0)
    setTotals({ withdrawal, deposit, expense, wumt, buy: buyAmount, sell: sellAmount })
  }

  useEffect(() => recalcTotals(), [tellerRows, buyAmount, sellAmount])

  // --- Current Data ---
  const currentData =
    activeTab === "teller_debit" || activeTab === "teller_credit"
      ? tellerRows
      : filteredGl

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-800 p-6">
      <Card className="max-w-7xl mx-auto shadow-xl border-none rounded-2xl">
        <CardHeader className="bg-gradient-to-r from-blue-600 to-teal-500 text-white rounded-t-2xl p-6">
          <CardTitle className="text-2xl font-bold">Teller Proof Dashboard</CardTitle>
          <CardDescription className="text-blue-100">
            Upload Teller & GL files or input CAST for reconciliation
          </CardDescription>
        </CardHeader>

        <CardContent className="p-6 space-y-6">
          {/* Upload Section */}
          <div className="grid md:grid-cols-3 gap-6">
            <div>
              <Label>Teller Upload</Label>
              <Input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={(e) => e.target.files?.[0] && parseTellerUpload(e.target.files[0])}
              />
              {tellerRows.length > 0 && (
                <Badge className="mt-2 bg-green-600">
                  {tellerRows.length} Rows Loaded
                </Badge>
              )}
            </div>

            <div>
              <Label>GL Upload</Label>
              <Input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={(e) => e.target.files?.[0] && parseGL(e.target.files[0])}
              />
              {glRows.length > 0 && (
                <Badge className="mt-2 bg-blue-600">
                  {glRows.length} GL Rows Loaded
                </Badge>
              )}
            </div>

            <div>
              <Label>CAST Input</Label>
              <Button onClick={() => setOpenCast(true)}>Open CAST Popup</Button>
            </div>
          </div>

          {/* Buy/Sell Inputs */}
          <div className="grid md:grid-cols-2 gap-4 mt-4">
            <div>
              <Label>Total Buy (₦)</Label>
              <Input
                type="number"
                value={buyAmount}
                onChange={(e) => setBuyAmount(safeNumber(e.target.value))}
              />
            </div>
            <div>
              <Label>Total Sell (₦)</Label>
              <Input
                type="number"
                value={sellAmount}
                onChange={(e) => setSellAmount(safeNumber(e.target.value))}
              />
            </div>
          </div>

          {/* Tabs */}
          <div className="flex w-full mt-6">
            {["teller_debit", "teller_credit", "gl_debit", "gl_credit"].map((tab) => (
              <Button
                key={tab}
                className="flex-1"
                variant={activeTab === tab ? "default" : "outline"}
                onClick={() => setActiveTab(tab as any)}
              >
                {tab.replace("_", " ").toUpperCase()}
              </Button>
            ))}
          </div>

          {/* GL Filter */}
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

          {/* Teller & Supervisor */}
          <div className="grid md:grid-cols-2 gap-4 mt-6">
            <div>
              <Label>Teller Name</Label>
              <Input
                placeholder="Enter Teller Name"
                value={tellerName}
                onChange={(e) => setTellerName(e.target.value)}
              />
            </div>
            <div>
              <Label>Supervisor Name</Label>
              <Input
                placeholder="Enter Supervisor Name"
                value={supervisorName}
                onChange={(e) => setSupervisorName(e.target.value)}
              />
            </div>
          </div>

          {/* Preview Table */}
          {currentData.length > 0 && (
            <div className="overflow-auto border rounded-xl bg-white dark:bg-gray-700 shadow-inner mt-6 max-h-[50vh]">
              <Table>
                <TableHeader>
                  <TableRow>
                    {Object.keys(currentData[0]).map((key) => (
                      <TableHead key={key}>{key}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentData.map((row, i) => (
                    <TableRow key={i}>
                      {Object.values(row).map((val, j) => (
                        <TableCell key={j}>{String(val)}</TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Totals Footer */}
          <Card className="bg-gray-100 dark:bg-gray-700 p-4 mt-6">
            <div className="grid md:grid-cols-3 gap-4">
              <div>Total Withdrawal: {totals.withdrawal.toLocaleString()}</div>
              <div>Total Deposit: {totals.deposit.toLocaleString()}</div>
              <div>Total Expenses: {totals.expense.toLocaleString()}</div>
            </div>
            <div className="grid md:grid-cols-2 gap-4 mt-2">
              <div>Total WUMT: {totals.wumt.toLocaleString()}</div>
              <div>Buy/Sell Diff: {(totals.buy - totals.sell).toLocaleString()}</div>
            </div>
          </Card>

          {/* Export */}
          <div className="flex justify-center gap-4 mt-8 flex-wrap">
            <Button
              onClick={handleExport}
              className="bg-gradient-to-r from-blue-600 to-teal-500 text-white"
            >
              <Download className="mr-2 h-4 w-4" /> Export Result
            </Button>
            <Button
              variant="outline"
              onClick={() => alert("Submitted Successfully ✅")}
            >
              Dummy Submit
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
