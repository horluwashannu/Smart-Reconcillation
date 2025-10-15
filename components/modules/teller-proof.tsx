// /components/TellerProof.tsx
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
import { Upload, FileSpreadsheet, Download, CheckCircle2, AlertTriangle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { BranchInfo } from "@/components/branch-info"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableHeader, TableRow, TableHead, TableCell } from "@/components/ui/table"

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
  ACCOUNT_NUMBER?: string
  LCY_AMOUNT?: number
  "DR / CR"?: string
  NARRATION?: string
  matched?: boolean
  raw?: any
}

export function TellerProof() {
  const [branchCode, setBranchCode] = useState("")
  const [branchName, setBranchName] = useState("")
  const [country, setCountry] = useState("")

  const [tellerFile, setTellerFile] = useState<File | null>(null)
  const [glFile, setGlFile] = useState<File | null>(null)

  const [activeTab, setActiveTab] = useState<"debit" | "credit" | "gl">("debit")
  const [showResults, setShowResults] = useState(false)

  const [rows, setRows] = useState<TellerRow[]>([])
  const [glRows, setGlRows] = useState<GLRow[]>([])

  const [openingBalance, setOpeningBalance] = useState<number | "">("")
  const [buyAmount, setBuyAmount] = useState<number | "">("")
  const [remainingFigure, setRemainingFigure] = useState<number | "">("")
  const [callOverOfficer, setCallOverOfficer] = useState("")

  const safeNumber = (v: any) => {
    if (v === null || v === undefined || v === "") return 0
    const s = String(v).replace(/[,₦€$]/g, "").trim()
    const n = Number(s)
    return Number.isFinite(n) ? n : 0
  }

  // ------------------- Parse Teller -------------------
  const parseTellerFile = async (file: File) => {
    try {
      const data = await file.arrayBuffer()
      const wb = XLSX.read(data, { type: "array", cellDates: true })
      const sheet = wb.Sheets[wb.SheetNames[0]]
      const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" }) as any[][]
      const headerRow = raw[0].map((h) => String(h || "").trim())
      const dataRows = raw.slice(1)

      const parsed: TellerRow[] = dataRows
        .filter((r) => r.some((c: any) => String(c).trim() !== ""))
        .map((r, i) => {
          const rowObj: any = {}
          headerRow.forEach((h, idx) => {
            rowObj[h.replace(/\s+/g, "_").toUpperCase()] = r[idx]
          })
          const mapped: TellerRow = {
            id: `T-${Date.now()}-${i}`,
            CHEQUES: safeNumber(rowObj["CHEQUES"]),
            ACCOUNT_NO: String(rowObj["ACCOUNT_NO"] || ""),
            SAVINGS_WITHDR: safeNumber(rowObj["SAVINGS_WITHDR"]),
            ACCOUNT_NO2: String(rowObj["ACCOUNT_NO2"] || ""),
            TO_VAULT: safeNumber(rowObj["TO_VAULT"]),
            EXPENSE: safeNumber(rowObj["EXPENSE"]),
            WUMT: safeNumber(rowObj["WUMT"]),
            Column1: String(rowObj["Column1"] || ""),
            OPENING_BALANCE: safeNumber(rowObj["OPENING_BALANCE"]),
            CASH_DEP: safeNumber(rowObj["CASH_DEP"]),
            CASH_DEP_2: safeNumber(rowObj["CASH_DEP_2"]),
            FROM_VAULT: safeNumber(rowObj["FROM_VAULT"]),
            bvnChecked: false,
            signatureChecked: false,
            alterationsSigned: false,
            analysisDone: false,
            matched: false,
          }
          return mapped
        })
      setRows(parsed)
      const foundOpening = parsed.find((p) => p.OPENING_BALANCE && p.OPENING_BALANCE !== 0)
      if (foundOpening) setOpeningBalance(foundOpening.OPENING_BALANCE || "")
    } catch (err) {
      console.error(err)
      alert("Failed to parse teller file. Ensure it is a valid Excel file.")
    }
  }

  // ------------------- Parse GL -------------------
  const parseGlFile = async (file: File) => {
    try {
      const data = await file.arrayBuffer()
      const wb = XLSX.read(data, { type: "array", cellDates: true })
      const sheet = wb.Sheets[wb.SheetNames[0]]
      const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" }) as any[][]
      const headerRow = raw[0].map((h) => String(h || "").trim())
      const dataRows = raw.slice(1)

      const idxAccount = headerRow.findIndex((h) => h.toLowerCase().includes("account number"))
      const idxLCY = headerRow.findIndex((h) => h.toLowerCase().includes("lcy amount"))
      const idxDRCR = headerRow.findIndex((h) => h.toLowerCase().includes("dr / cr"))
      const idxNarration = headerRow.findIndex((h) => h.toLowerCase().includes("narration"))

      const parsed: GLRow[] = dataRows.map((r) => ({
        ACCOUNT_NUMBER: idxAccount >= 0 ? String(r[idxAccount] || "") : "",
        LCY_AMOUNT: idxLCY >= 0 ? safeNumber(r[idxLCY]) : 0,
        "DR / CR": idxDRCR >= 0 ? String(r[idxDRCR] || "") : "",
        NARRATION: idxNarration >= 0 ? String(r[idxNarration] || "") : "",
        raw: r,
        matched: false,
      }))
      setGlRows(parsed)
    } catch (err) {
      console.error(err)
      alert("Failed to parse GL file. Ensure it is a valid Excel file.")
    }
  }

  const handleTellerUpload = (file: File) => {
    setTellerFile(file)
    parseTellerFile(file)
  }
  const handleGlUpload = (file: File) => {
    setGlFile(file)
    parseGlFile(file)
  }

  const updateRow = (id: string, patch: Partial<TellerRow>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  }

  const totals = useMemo(() => {
    const sum = (arr: number[]) => arr.reduce((acc, v) => acc + safeNumber(v), 0)
    const debitCols = rows.map((r) => safeNumber(r.SAVINGS_WITHDR) + safeNumber(r.TO_VAULT) + safeNumber(r.EXPENSE))
    const creditCols = rows.map((r) => safeNumber(r.CASH_DEP) + safeNumber(r.CASH_DEP_2) + safeNumber(r.FROM_VAULT) + safeNumber(r.WUMT))
    return { totalDebit: sum(debitCols), totalCredit: sum(creditCols) }
  }, [rows])

  const tillBalance = useMemo(() => safeNumber(openingBalance) + safeNumber(totals.totalCredit) - safeNumber(totals.totalDebit) - safeNumber(buyAmount), [openingBalance, buyAmount, totals])
  const difference = useMemo(() => Number((tillBalance || 0) - safeNumber(remainingFigure)), [tillBalance, remainingFigure])
  const balanced = difference === 0

  // ------------------- Matching -------------------
  useEffect(() => {
    if (rows.length === 0 || glRows.length === 0) return
    const glIndex: { key: string; used: boolean; idx: number }[] = []
    glRows.forEach((g, i) => glIndex.push({ key: `${g.ACCOUNT_NUMBER}-${g.LCY_AMOUNT}-${g["DR / CR"]}`, used: false, idx: i }))
    const newRows = rows.map((r) => {
      const key = `${r.ACCOUNT_NO}-${r.SAVINGS_WITHDR}-${"DR"}`
      const match = glIndex.find((g) => !g.used && g.key === key)
      if (match) {
        glIndex[match.idx].used = true
        return { ...r, matched: true }
      }
      return r
    })
    setRows(newRows)
  }, [rows, glRows])

  const exportCsv = () => {
    const wsTeller = XLSX.utils.json_to_sheet(rows)
    const wsGl = XLSX.utils.json_to_sheet(glRows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, wsTeller, "Teller")
    XLSX.utils.book_append_sheet(wb, wsGl, "GL")
    XLSX.writeFile(wb, `TellerProof-${Date.now()}.xlsx`)
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Teller Proof</CardTitle>
          <CardDescription>Upload teller and GL files for proofing</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <Upload /> Teller File
              <input type="file" accept=".xls,.xlsx" className="hidden" onChange={(e) => e.target.files && handleTellerUpload(e.target.files[0])} />
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <Upload /> GL File
              <input type="file" accept=".xls,.xlsx" className="hidden" onChange={(e) => e.target.files && handleGlUpload(e.target.files[0])} />
            </label>
            <Button onClick={exportCsv} className="flex items-center gap-2"><Download /> Export CSV</Button>
          </div>

          <div className="flex gap-2">
            <Input placeholder="Branch Code" value={branchCode} onChange={(e) => setBranchCode(e.target.value)} />
            <Input placeholder="Branch Name" value={branchName} onChange={(e) => setBranchName(e.target.value)} />
            <Input placeholder="Country" value={country} onChange={(e) => setCountry(e.target.value)} />
          </div>

          <div className="flex gap-2">
            <Input placeholder="Opening Balance" type="number" value={openingBalance} onChange={(e) => setOpeningBalance(Number(e.target.value))} />
            <Input placeholder="Buy Amount" type="number" value={buyAmount} onChange={(e) => setBuyAmount(Number(e.target.value))} />
            <Input placeholder="Remaining Figure" type="number" value={remainingFigure} onChange={(e) => setRemainingFigure(Number(e.target.value))} />
            <Input placeholder="Call Over Officer" value={callOverOfficer} onChange={(e) => setCallOverOfficer(e.target.value)} />
          </div>

          <div className="flex gap-2">
            <Badge variant={balanced ? "success" : "destructive"}>{balanced ? "Balanced ✅" : "Difference ❌"}</Badge>
            <span>Difference: {difference}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Proofing Tabs</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button variant={activeTab === "debit" ? "default" : "outline"} onClick={() => setActiveTab("debit")}>Debit</Button>
            <Button variant={activeTab === "credit" ? "default" : "outline"} onClick={() => setActiveTab("credit")}>Credit</Button>
            <Button variant={activeTab === "gl" ? "default" : "outline"} onClick={() => setActiveTab("gl")}>GL</Button>
          </div>

          {activeTab === "debit" && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account No</TableHead>
                  <TableHead>Savings/Withdr</TableHead>
                  <TableHead>To Vault</TableHead>
                  <TableHead>Expense</TableHead>
                  <TableHead>Matched</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.ACCOUNT_NO}</TableCell>
                    <TableCell>{r.SAVINGS_WITHDR}</TableCell>
                    <TableCell>{r.TO_VAULT}</TableCell>
                    <TableCell>{r.EXPENSE}</TableCell>
                    <TableCell>{r.matched ? <CheckCircle2 className="text-green-500" /> : <AlertTriangle className="text-red-500" />}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {activeTab === "credit" && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account No</TableHead>
                  <TableHead>Cash Dep</TableHead>
                  <TableHead>Cash Dep 2</TableHead>
                  <TableHead>From Vault</TableHead>
                  <TableHead>WUMT</TableHead>
                  <TableHead>Matched</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.ACCOUNT_NO}</TableCell>
                    <TableCell>{r.CASH_DEP}</TableCell>
                    <TableCell>{r.CASH_DEP_2}</TableCell>
                    <TableCell>{r.FROM_VAULT}</TableCell>
                    <TableCell>{r.WUMT}</TableCell>
                    <TableCell>{r.matched ? <CheckCircle2 className="text-green-500" /> : <AlertTriangle className="text-red-500" />}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {activeTab === "gl" && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account Number</TableHead>
                  <TableHead>LCY Amount</TableHead>
                  <TableHead>DR / CR</TableHead>
                  <TableHead>Narration</TableHead>
                  <TableHead>Matched</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {glRows.map((r, idx) => (
                  <TableRow key={idx}>
                    <TableCell>{r.ACCOUNT_NUMBER}</TableCell>
                    <TableCell>{r.LCY_AMOUNT}</TableCell>
                    <TableCell>{r["DR / CR"]}</TableCell>
                    <TableCell>{r.NARRATION}</TableCell>
                    <TableCell>{r.matched ? <CheckCircle2 className="text-green-500" /> : <AlertTriangle className="text-red-500" />}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
