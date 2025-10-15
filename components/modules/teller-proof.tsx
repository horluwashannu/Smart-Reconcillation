"use client"

import { useEffect, useMemo, useState } from "react"
import * as XLSX from "xlsx"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  AlertTriangle,
  CheckCircle2,
  Upload,
  FileSpreadsheet,
  Download,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableHeader,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table"

type TellerRow = {
  id: string
  CHEQUES?: number
  ACCOUNT_NO?: string
  SAVINGS_WITHDR?: number
  ACCOUNT_NO2?: string
  TO_VAULT?: number
  EXPENSE?: number
  WUMT?: number
  Column1?: string
  OPENING_BALANCE?: number
  CASH_DEP?: number
  CASH_DEP_2?: number
  FROM_VAULT?: number
  bvnChecked?: boolean
  signatureChecked?: boolean
  alterationsSigned?: boolean
  analysisDone?: boolean
  matched?: boolean
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
  raw?: any
  matched?: boolean
}

export function TellerProof() {
  const [branchCode, setBranchCode] = useState("")
  const [branchName, setBranchName] = useState("")
  const [country, setCountry] = useState("")

  const [tellerFile, setTellerFile] = useState<File | null>(null)
  const [glFile, setGlFile] = useState<File | null>(null)

  const [activeTab, setActiveTab] = useState<"debit" | "credit">("debit")
  const [showResults, setShowResults] = useState(false)

  const [rows, setRows] = useState<TellerRow[]>([])
  const [glRows, setGlRows] = useState<GLRow[]>([])

  const [openingBalance, setOpeningBalance] = useState<number | "">("")
  const [buyAmount, setBuyAmount] = useState<number | "">("")
  const [remainingFigure, setRemainingFigure] = useState<number | "">("")
  const [callOverOfficer, setCallOverOfficer] = useState("")

  // --- Helpers ---
  const safeNumber = (v: any) => {
    if (v === null || v === undefined || v === "") return 0
    const s = String(v).replace(/[,₦€$]/g, "").trim()
    const n = Number(s)
    return Number.isFinite(n) ? n : 0
  }

  const findCastSheet = (wb: XLSX.WorkBook) => {
    const names = wb.SheetNames
    const found = names.find((n) => n.toLowerCase().trim() === "cast")
    if (found) return wb.Sheets[found]
    if (names.length >= 2) return wb.Sheets[names[1]]
    return wb.Sheets[names[0]]
  }

  // --- Teller File Parsing ---
  const parseTellerFile = async (file: File) => {
    try {
      const data = await file.arrayBuffer()
      const wb = XLSX.read(data, { type: "array", cellDates: true })
      const sheet = findCastSheet(wb)
      const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" })
      const headersIndex = raw.findIndex((r: any[]) =>
        r.some((c) =>
          String(c || "")
            .toLowerCase()
            .replace(/\s+/g, "")
            .includes("cheques")
        ) && r.some((c) => String(c || "").toLowerCase().replace(/\s+/g, "").includes("account"))
      )
      const headerRow = headersIndex >= 0 ? raw[headersIndex].map((h) => String(h || "").trim()) : raw[0].map((h) => String(h || "").trim())
      const dataRows = raw.slice(headersIndex >= 0 ? headersIndex + 1 : 1)
      const parsed: TellerRow[] = dataRows
        .filter((r: any[]) => r.some((c) => String(c).trim() !== ""))
        .map((r: any[], i: number) => {
          const rowObj: any = {}
          headerRow.forEach((h: string, idx: number) => {
            const key = h.replace(/\s+/g, "_").toUpperCase()
            rowObj[key] = r[idx]
          })
          return {
            id: `T-${Date.now()}-${i}`,
            CHEQUES: safeNumber(rowObj["CHEQUES"]),
            ACCOUNT_NO: String(rowObj["ACCOUNT_NO"] || rowObj["ACCOUNTNUMBER"] || rowObj["ACCOUNT"] || ""),
            SAVINGS_WITHDR: safeNumber(rowObj["SAVINGS_WITHDR"] || rowObj["SAVINGS_WITHDRAWAL"] || rowObj["SAVINGSWITHDR"] || rowObj["SAVINGS"]),
            ACCOUNT_NO2: String(rowObj["ACCOUNT_NO2"] || ""),
            TO_VAULT: safeNumber(rowObj["TO_VAULT"] || rowObj["TOVAULT"]),
            EXPENSE: safeNumber(rowObj["EXPENSE"]),
            WUMT: safeNumber(rowObj["WUMT"]),
            Column1: String(rowObj["Column1"] || rowObj["NARRATION"] || ""),
            OPENING_BALANCE: safeNumber(rowObj["OPENING_BALANCE"]),
            CASH_DEP: safeNumber(rowObj["CASH_DEP"] || rowObj["CASHDEP"]),
            CASH_DEP_2: safeNumber(rowObj["CASH_DEP_2"] || rowObj["CASHDEP2"]),
            FROM_VAULT: safeNumber(rowObj["FROM_VAULT"] || rowObj["FROMVAULT"]),
            bvnChecked: false,
            signatureChecked: false,
            alterationsSigned: false,
            analysisDone: false,
            matched: false,
          }
        })
      setRows(parsed)
      const foundOpening = parsed.find((p) => p.OPENING_BALANCE && p.OPENING_BALANCE !== 0)
      if (foundOpening) setOpeningBalance(foundOpening.OPENING_BALANCE || "")
    } catch (err) {
      console.error("Failed to parse teller file", err)
      alert("Failed to parse teller file. Ensure it's valid Excel/CSV and has 'cast' sheet.")
    }
  }

  // --- GL File Parsing (Completed) ---
  const parseGlFile = async (file: File) => {
    try {
      const data = await file.arrayBuffer()
      const wb = XLSX.read(data, { type: "array", cellDates: true })
      const sheet = wb.Sheets[wb.SheetNames[0]]
      const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" }) as any[][]
      const header = raw[0].map((h) => String(h || "").trim().toLowerCase())
      const dataRows = raw.slice(1)

      const parsed: GLRow[] = dataRows.map((r, i) => ({
        Date: String(r[header.findIndex((h) => h.includes("transaction date"))] || ""),
        Branch: String(r[header.findIndex((h) => h.includes("branch"))] || ""),
        AccountNo: String(r[header.findIndex((h) => h.includes("account"))] || ""),
        Type: String(r[header.findIndex((h) => h.includes("dr/cr"))] || ""),
        Currency: String(r[header.findIndex((h) => h.includes("currency"))] || ""),
        Amount: safeNumber(r[header.findIndex((h) => h.includes("lcy amount") || h.includes("amount"))]),
        User: String(r[header.findIndex((h) => h.includes("user"))] || ""),
        Authorizer: String(r[header.findIndex((h) => h.includes("authoriser") || h.includes("authorizer"))] || ""),
        Reference: String(r[header.findIndex((h) => h.includes("reference"))] || ""),
        raw: r,
      }))
      setGlRows(parsed)
    } catch (err) {
      console.error("Failed to parse GL file", err)
      alert("Failed to parse GL file. Ensure the format is correct.")
    }
  }

  // --- Export Result ---
  const handleExport = () => {
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "TellerProof")
    XLSX.writeFile(wb, "TellerProofResult.xlsx")
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-teal-100 p-6">
      <Card className="max-w-6xl mx-auto shadow-2xl border-none rounded-2xl">
        <CardHeader className="bg-gradient-to-r from-blue-600 to-teal-500 text-white rounded-t-2xl p-6">
          <CardTitle className="text-2xl font-bold">Teller Proof Dashboard</CardTitle>
          <CardDescription className="text-blue-100">Upload Teller & GL Sheets for Reconciliation</CardDescription>
        </CardHeader>

        <CardContent className="p-6">
          {/* Tabs */}
          <div className="flex mb-6 justify-center space-x-4">
            <Button
              variant={activeTab === "debit" ? "default" : "outline"}
              onClick={() => setActiveTab("debit")}
            >
              Debit Side
            </Button>
            <Button
              variant={activeTab === "credit" ? "default" : "outline"}
              onClick={() => setActiveTab("credit")}
            >
              Credit Side
            </Button>
          </div>

          {/* Uploaders */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <Label>Teller (CAST) Sheet</Label>
              <Input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={(e) => e.target.files?.[0] && parseTellerFile(e.target.files[0])}
              />
              {rows.length > 0 && (
                <Badge className="mt-2 bg-green-600">{rows.length} Teller Rows Loaded</Badge>
              )}
            </div>

            <div>
              <Label>GL Sheet</Label>
              <Input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={(e) => e.target.files?.[0] && parseGlFile(e.target.files[0])}
              />
              {glRows.length > 0 && (
                <Badge className="mt-2 bg-blue-600">{glRows.length} GL Rows Loaded</Badge>
              )}
            </div>
          </div>

          {/* Preview Table */}
          {glRows.length > 0 && (
            <div className="overflow-auto border rounded-lg mt-6 bg-white shadow-inner">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Branch</TableHead>
                    <TableHead>Account No</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Authorizer</TableHead>
                    <TableHead>Reference</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {glRows.slice(0, 10).map((r, i) => (
                    <TableRow key={i}>
                      <TableCell>{r.Date}</TableCell>
                      <TableCell>{r.Branch}</TableCell>
                      <TableCell>{r.AccountNo}</TableCell>
                      <TableCell>{r.Type}</TableCell>
                      <TableCell>{r.Amount}</TableCell>
                      <TableCell>{r.User}</TableCell>
                      <TableCell>{r.Authorizer}</TableCell>
                      <TableCell>{r.Reference}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-center space-x-4 mt-8">
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
