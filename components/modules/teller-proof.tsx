"use client"

import { useState, useMemo } from "react"
import * as XLSX from "xlsx"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Download } from "lucide-react"

type TellerRow = {
  CHEQUES?: number
  CHEQUE_ACCOUNT?: string
  SAVINGS?: number
  SAVINGS_ACCOUNT?: string
  DEPOSIT?: number
  DEPOSIT_ACCOUNT?: string
  EXPENSE?: number
  WUMT?: number
}

type GLRow = {
  Branch?: string
  AccountNo?: string
  Currency?: string
  Type?: string
  Batch?: string
  Amount?: number
  Date?: string
  User?: string
  Authorizer?: string
}

export default function TellerProof() {
  const [activeTab, setActiveTab] = useState<"teller_debit" | "teller_credit" | "gl_debit" | "gl_credit">("teller_debit")
  const [tellerRows, setTellerRows] = useState<TellerRow[]>([])
  const [glRows, setGlRows] = useState<GLRow[]>([])

  const safeNumber = (v: any) => {
    const s = String(v || "").replace(/[,₦$]/g, "").trim()
    const n = Number(s)
    return Number.isFinite(n) ? n : 0
  }

  // --- Teller Upload Parser ---
  const parseTeller = async (file: File) => {
    try {
      const data = await file.arrayBuffer()
      const wb = XLSX.read(data, { type: "array" })
      const sheet = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" })

      if (rows.length < 2) {
        alert("Invalid Teller file or empty sheet.")
        return
      }

      const header = rows[0].map((h) => String(h || "").trim().toUpperCase())
      const findCol = (label: string) => header.findIndex((h) => h.includes(label.toUpperCase()))

      const colMap = {
        cheques: findCol("CHEQUES"),
        chequeAcct: findCol("CHEQUES") + 1,
        savings: findCol("SAVINGS"),
        savingsAcct: findCol("SAVINGS") + 1,
        deposit: findCol("DEPOSIT"),
        depositAcct: findCol("DEPOSIT") + 1,
        expense: findCol("EXPENSE"),
        wumt: findCol("WUMT"),
      }

      const parsed: TellerRow[] = rows.slice(1).map((r) => ({
        CHEQUES: safeNumber(r[colMap.cheques]),
        CHEQUE_ACCOUNT: String(r[colMap.chequeAcct] || ""),
        SAVINGS: safeNumber(r[colMap.savings]),
        SAVINGS_ACCOUNT: String(r[colMap.savingsAcct] || ""),
        DEPOSIT: safeNumber(r[colMap.deposit]),
        DEPOSIT_ACCOUNT: String(r[colMap.depositAcct] || ""),
        EXPENSE: safeNumber(r[colMap.expense]),
        WUMT: safeNumber(r[colMap.wumt]),
      }))

      setTellerRows(parsed.filter((r) => r.CHEQUE_ACCOUNT || r.SAVINGS_ACCOUNT || r.DEPOSIT_ACCOUNT))
      alert(`✅ Teller CAST Loaded (${parsed.length} rows)`)
    } catch (err) {
      console.error(err)
      alert("Error reading Teller CAST file.")
    }
  }

  // --- TJ File (GL) Upload Parser ---
  const parseTJUpload = async (file: File) => {
    try {
      const data = await file.arrayBuffer()
      const workbook = XLSX.read(data, { type: "array" })
      const sheet = workbook.Sheets[workbook.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" })

      if (rows.length < 2) {
        alert("TJ file seems empty.")
        return
      }

      const headerRow = rows[0].map((h) => String(h || "").trim().toUpperCase())
      const findCol = (label: string) =>
        headerRow.findIndex((h) => h.includes(label.toUpperCase()))

      const colMap = {
        branchCode: findCol("ORIGINATING BRANCH CODE"),
        acctNo: findCol("ACCOUNT NUMBER"),
        currency: findCol("CURRENCY"),
        drcr: findCol("DR / CR"),
        batchNo: findCol("BATCH NO"),
        amount: findCol("LCY AMOUNT"),
        txnDate: findCol("TRANSACTION DATE"),
        userId: findCol("USER ID"),
        authoriser: findCol("AUTHORISER ID"),
      }

      if (colMap.acctNo === -1 || colMap.amount === -1 || colMap.drcr === -1) {
        alert("Invalid TJ template – required columns missing.")
        return
      }

      const parsed: GLRow[] = rows.slice(1).map((r) => ({
        Branch: String(r[colMap.branchCode] || ""),
        AccountNo: String(r[colMap.acctNo] || ""),
        Currency: String(r[colMap.currency] || ""),
        Type: String(r[colMap.drcr] || "").toUpperCase().trim(),
        Batch: String(r[colMap.batchNo] || ""),
        Amount: safeNumber(r[colMap.amount]),
        Date: String(r[colMap.txnDate] || ""),
        User: String(r[colMap.userId] || ""),
        Authorizer: String(r[colMap.authoriser] || ""),
      }))

      setGlRows(parsed.filter((r) => r.AccountNo))
      alert(`✅ TJ GL File Loaded (${parsed.length} rows)`)
    } catch (err) {
      console.error(err)
      alert("Error parsing TJ file. Please verify your Excel format.")
    }
  }

  // --- Totals ---
  const tellerDebit = useMemo(() => {
    let total = 0
    tellerRows.forEach((r) => {
      total += (r.CHEQUES || 0) + (r.SAVINGS || 0) + (r.EXPENSE || 0)
    })
    return total
  }, [tellerRows])

  const tellerCredit = useMemo(() => {
    let total = 0
    tellerRows.forEach((r) => {
      total += (r.DEPOSIT || 0)
    })
    return total
  }, [tellerRows])

  const glDebit = useMemo(
    () =>
      glRows
        .filter((r) => r.Type === "DR")
        .reduce((sum, r) => sum + (r.Amount || 0), 0),
    [glRows]
  )

  const glCredit = useMemo(
    () =>
      glRows
        .filter((r) => r.Type === "CR")
        .reduce((sum, r) => sum + (r.Amount || 0), 0),
    [glRows]
  )

  const handleExport = () => {
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(tellerRows), "Teller")
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(glRows), "GL")
    XLSX.writeFile(wb, "TellerProofResult.xlsx")
  }

  // --- Displayed Data ---
  const currentData =
    activeTab === "teller_debit"
      ? tellerRows
      : activeTab === "teller_credit"
      ? tellerRows
      : glRows.filter((r) => (activeTab === "gl_debit" ? r.Type === "DR" : r.Type === "CR"))

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-teal-50 dark:from-gray-900 dark:to-gray-800 text-gray-900 dark:text-gray-100 p-6">
      <Card className="max-w-7xl mx-auto shadow-xl border-none rounded-2xl overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-blue-600 to-teal-500 text-white p-6">
          <CardTitle className="text-2xl font-bold">Teller Proof Dashboard</CardTitle>
          <CardDescription className="text-blue-100">
            Upload Teller CAST and TJ (GL) files for reconciliation
          </CardDescription>
        </CardHeader>

        <CardContent className="p-6 space-y-8">
          {/* Uploaders */}
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <Label>Teller (CAST) Sheet</Label>
              <Input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => e.target.files?.[0] && parseTeller(e.target.files[0])} />
              {tellerRows.length > 0 && (
                <Badge className="mt-2 bg-green-600">
                  {tellerRows.length} Teller Rows Loaded
                </Badge>
              )}
            </div>

            <div>
              <Label>TJ (GL) File</Label>
              <Input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => e.target.files?.[0] && parseTJUpload(e.target.files[0])} />
              {glRows.length > 0 && (
                <Badge className="mt-2 bg-blue-600">
                  {glRows.length} GL Rows Loaded
                </Badge>
              )}
            </div>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
            <TabsList className="grid grid-cols-4 w-full">
              <TabsTrigger value="teller_debit">Teller Debit</TabsTrigger>
              <TabsTrigger value="teller_credit">Teller Credit</TabsTrigger>
              <TabsTrigger value="gl_debit">GL Debit</TabsTrigger>
              <TabsTrigger value="gl_credit">GL Credit</TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab}>
              {currentData.length > 0 ? (
                <div className="overflow-auto border rounded-xl bg-white dark:bg-gray-900 shadow-inner mt-6">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {Object.keys(currentData[0]).slice(0, 8).map((key) => (
                          <TableHead key={key}>{key}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {currentData.slice(0, 20).map((row, i) => (
                        <TableRow key={i}>
                          {Object.values(row).slice(0, 8).map((val, j) => (
                            <TableCell key={j}>{String(val)}</TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-center text-gray-500 mt-6">No data yet...</p>
              )}
            </TabsContent>
          </Tabs>

          {/* Footer Totals */}
          <div className="grid md:grid-cols-2 gap-6">
            <Card className="bg-gradient-to-r from-blue-600 to-teal-500 text-white text-center p-4 rounded-xl">
              <CardTitle>Total Teller Debit: ₦{tellerDebit.toLocaleString()}</CardTitle>
              <CardTitle>Total Teller Credit: ₦{tellerCredit.toLocaleString()}</CardTitle>
            </Card>
            <Card className="bg-gradient-to-r from-gray-700 to-gray-900 text-white text-center p-4 rounded-xl">
              <CardTitle>Total GL Debit: ₦{glDebit.toLocaleString()}</CardTitle>
              <CardTitle>Total GL Credit: ₦{glCredit.toLocaleString()}</CardTitle>
            </Card>
          </div>

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
