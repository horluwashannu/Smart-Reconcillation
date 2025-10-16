// /components/TellerGLReconciliation.tsx
"use client"

import React, { useEffect, useMemo, useState } from "react"
import * as XLSX from "xlsx"
import { Upload, FileSpreadsheet, Download, CheckCircle, AlertTriangle } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { BranchInfo } from "@/components/branch-info"

type TellerRawRow = Record<string, any>
type GLRawRow = Record<string, any>

type NormalizedRow = {
  id: string
  source: "teller" | "gl"
  side: "debit" | "credit"
  account: string
  amount: number
  currency?: string
  date?: string
  narration?: string
  user?: string
  authorizer?: string
  reference?: string
  matched?: boolean
  raw?: any
}

export default function TellerGLReconciliation() {
  // Branch / meta
  const [branchCode, setBranchCode] = useState("")
  const [branchName, setBranchName] = useState("")
  const [country, setCountry] = useState("")

  // Upload files
  const [tellerFile, setTellerFile] = useState<File | null>(null)
  const [glFile, setGlFile] = useState<File | null>(null)

  // Parsed raw arrays
  const [tellerRaw, setTellerRaw] = useState<TellerRawRow[]>([])
  const [glRaw, setGlRaw] = useState<GLRawRow[]>([])

  // Normalized lists (split debit/credit entries)
  const [tellerNormalized, setTellerNormalized] = useState<NormalizedRow[]>([])
  const [glNormalized, setGlNormalized] = useState<NormalizedRow[]>([])

  // UI & inputs
  const [activeTab, setActiveTab] = useState<
    "teller_debit" | "teller_credit" | "gl_debit" | "gl_credit"
  >("teller_debit")
  const [tellerName, setTellerName] = useState("")
  const [supervisorName, setSupervisorName] = useState("")
  const [openingBalance, setOpeningBalance] = useState<number | "">("")
  const [buyAmount, setBuyAmount] = useState<number | "">("") // amount teller bought (remove from till)
  const [sellAmount, setSellAmount] = useState<number | "">("") // amount teller sold (add to till)
  const [previewLimit, setPreviewLimit] = useState(200)

  // Helpers
  const safeNumber = (v: any) => {
    if (v === null || v === undefined || v === "") return 0
    const s = String(v).replace(/[,\s₦$€£]/g, "").trim()
    const n = Number(s)
    return Number.isFinite(n) ? n : 0
  }

  // Try to find sheet named "cast" or use first sheet
  const findCastSheet = (wb: XLSX.WorkBook) => {
    const found = wb.SheetNames.find((n) => n.toLowerCase().trim() === "cast")
    if (found) return wb.Sheets[found]
    if (wb.SheetNames.length >= 2) return wb.Sheets[wb.SheetNames[1]]
    return wb.Sheets[wb.SheetNames[0]]
  }

  // Generic parse helper (returns array of row objects)
  const parseWorkbookToJson = (wb: XLSX.WorkBook, preferCast = false) => {
    const sheet = preferCast ? findCastSheet(wb) : wb.Sheets[wb.SheetNames[0]]
    const raw = XLSX.utils.sheet_to_json(sheet, { defval: "" }) as any[]
    return raw
  }

  // Teller parse (expects columns like: CHEQUES, ACCOUNT NO, SAVINGS WITHDR., ACCOUNT NO2, TO VAULT, EXPENSE, WUMT, Column1, OPENING BALANCE, CASH DEP, CASH DEP 2, FROM VAULT)
  const handleTellerUpload = async (file: File) => {
    setTellerFile(file)
    try {
      const data = await file.arrayBuffer()
      const wb = XLSX.read(data, { type: "array", cellDates: true })
      const raw = parseWorkbookToJson(wb, true)
      setTellerRaw(raw)
      // normalize immediately
      const norm = normalizeTellerRows(raw)
      setTellerNormalized(norm)
      // try set opening balance from first row if present
      const firstWithOpening = raw.find((r) => {
        const keys = Object.keys(r).map((k) => k.toLowerCase().replace(/\s+/g, ""))
        return keys.some((k) => k.includes("opening"))
      })
      if (firstWithOpening) {
        const v = Object.values(firstWithOpening).find((val) => typeof val === "number" || /[0-9]/.test(String(val)))
        if (v !== undefined) setOpeningBalance(safeNumber(v))
      }
    } catch (err) {
      console.error("Failed to parse teller file", err)
      alert("Failed to parse teller file. Ensure it's a valid Excel or CSV workbook.")
    }
  }

  // GL parse - expecting your GL export (we will auto-clean)
  const handleGlUpload = async (file: File) => {
    setGlFile(file)
    try {
      const data = await file.arrayBuffer()
      const wb = XLSX.read(data, { type: "array", cellDates: true })
      // pick the sheet that contains 'account' and 'transaction' keywords if possible
      let sheetName = wb.SheetNames[0]
      for (const n of wb.SheetNames) {
        const preview = XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, defval: "" }) as any[][]
        const headerRow = preview.find((r) => r && r.some((c: any) => String(c).toLowerCase().includes("account")) && r.some((c: any) => String(c).toLowerCase().includes("transaction")))
        if (headerRow) {
          sheetName = n
          break
        }
      }
      const raw = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: "" }) as any[]
      setGlRaw(raw)
      setGlNormalized(normalizeGlRows(raw))
    } catch (err) {
      console.error("Failed to parse GL file", err)
      alert("Failed to parse GL file. Ensure it's a valid Excel or CSV workbook.")
    }
  }

  // Normalization logic for teller rows
  const normalizeTellerRows = (rawRows: TellerRawRow[]) => {
    const out: NormalizedRow[] = []
    rawRows.forEach((r, idx) => {
      // build a forgiving map of header->value
      const map: Record<string, any> = {}
      Object.keys(r).forEach((k) => (map[k.toLowerCase().replace(/\s+/g, "")] = r[k]))

      const acct = String(map["accountno"] || map["account_no"] || map["account"] || map["accountnumber"] || map["nubanac"] || "").trim()
      const narration = String(map["column1"] || map["narration"] || map["column"] || map["description"] || map["account/gldescription"] || "").trim()

      // possible columns with amounts (debit side)
      const savingsWithdr = safeNumber(map["savingswithdr"] || map["savings_withdr"] || map["savings_withdrawal"] || map["savings"])
      const toVault = safeNumber(map["tovault"] || map["to_vault"])
      const expense = safeNumber(map["expense"])
      // credit-side
      const cashDep = safeNumber(map["cashdep"] || map["cash_dep"] || map["cashdeposit"] || map["cashdeposit2"])
      const cashDep2 = safeNumber(map["cashdep2"] || map["cash_dep_2"])
      const fromVault = safeNumber(map["fromvault"] || map["from_vault"])
      const wumt = safeNumber(map["wumt"] || map["wumt"])
      const cheques = safeNumber(map["cheques"])

      // For teller sheet we'll create separate normalized entries for each non-zero amount with correct side
      const pushIf = (amt: number, side: "debit" | "credit", label?: string) => {
        if (!acct || amt === 0) return
        out.push({
          id: `T-${idx}-${label || side}-${out.length}`,
          source: "teller",
          side,
          account: acct,
          amount: amt,
          narration,
          raw: r,
          matched: false,
        })
      }

      pushIf(savingsWithdr, "debit", "savings")
      pushIf(toVault, "debit", "tovault")
      pushIf(expense, "debit", "expense")

      pushIf(cashDep, "credit", "cashdep")
      pushIf(cashDep2, "credit", "cashdep2")
      pushIf(fromVault, "credit", "fromvault")
      pushIf(wumt, "credit", "wumt")

      // CHEQUES - treat as credit for teller side only if present (but earlier you said don't add cheque deposit to balance — we'll mark but not include in computed till by default)
      if (cheques) {
        out.push({
          id: `T-${idx}-cheque-${out.length}`,
          source: "teller",
          side: "credit",
          account: acct,
          amount: cheques,
          narration: `CHEQUE: ${narration}`,
          raw: r,
          matched: false,
        })
      }
    })
    return out
  }

  // Normalization logic for GL rows
  const normalizeGlRows = (rawRows: GLRawRow[]) => {
    const out: NormalizedRow[] = []
    rawRows.forEach((r, idx) => {
      // create lowercase map
      const map: Record<string, any> = {}
      Object.keys(r).forEach((k) => (map[k.toLowerCase().replace(/\s+/g, "")] = r[k]))

      const acct = String(map["accountnumber"] || map["account_number"] || map["accountno"] || map["account"] || map["nubanac"] || "").trim()
      const narration = String(map["narration"] || map["transactiondescription"] || map["transaction_description"] || map["account/gldescription"] || "").trim()
      // DR/CR value if present
      const drcr = String(map["dr/cr"] || map["drcr"] || map["type"] || map["dr"] || map["cr"] || "").trim().toLowerCase()
      // amount candidates: lcy amount, lcyamount, lcya amount variations or amount or lcamount
      const amountCandidates = ["lcyamount", "lcy_amount", "lcyaamount", "lcya amount", "lcamount", "amount", "lcy"]
      let amt = 0
      for (const c of amountCandidates) {
        if (map[c] !== undefined) {
          amt = safeNumber(map[c])
          if (amt !== 0) break
        }
      }
      // also try FCY AMOUNT if LCY not present
      if (amt === 0 && map["fcyamount"]) amt = safeNumber(map["fcyamount"])

      // choose side: if dr/cr present, use it. Otherwise infer positive = debit? (we'll default to debit if not present)
      const side: "debit" | "credit" = drcr.includes("d") ? "debit" : drcr.includes("c") ? "credit" : amt < 0 ? "credit" : "debit"

      if (!acct || amt === 0) {
        // still include if narration and something present
        if (acct && amt === 0) {
          // include zero-amt row? skip
        }
        return
      }

      out.push({
        id: `G-${idx}`,
        source: "gl",
        side,
        account: acct,
        amount: Math.abs(amt),
        currency: String(map["currency"] || ""),
        date: String(map["transactiondate"] || map["transaction_date"] || map["valuedate"] || ""),
        narration,
        user: String(map["userid"] || map["user"] || ""),
        authorizer: String(map["authoriserid"] || map["authoriser"] || map["authorizer"] || ""),
        reference: String(map["externalreferenceno"] || map["externalreference" || "reference"] || ""),
        raw: r,
        matched: false,
      })
    })
    return out
  }

  // Matching logic: account + amount exact match (both normalized lists)
  const runMatch = (tellerList: NormalizedRow[], glList: NormalizedRow[]) => {
    // Build index for GL: account|amount|side => indices
    const index = new Map<string, number[]>()
    glList.forEach((g, i) => {
      const key = `${g.account}__${Number(g.amount).toFixed(2)}__${g.side}`
      if (!index.has(key)) index.set(key, [])
      index.get(key)!.push(i)
    })

    // copy arrays to mutate matched flags
    const glCopy = glList.map((g) => ({ ...g, matched: false }))
    const tellerCopy = tellerList.map((t) => ({ ...t, matched: false }))

    // Attempt to match teller entries to GL entries
    for (let ti = 0; ti < tellerCopy.length; ti++) {
      const t = tellerCopy[ti]
      const keyExact = `${t.account}__${Number(t.amount).toFixed(2)}__${t.side}`
      const candidates = index.get(keyExact) ?? []

      // pick first unmatched gl index
      const pick = candidates.find((ci) => !glCopy[ci].matched)
      if (pick !== undefined) {
        tellerCopy[ti].matched = true
        glCopy[pick].matched = true
      } else {
        // If not found with same side, allow match regardless of GL side (some GL exports don't have correct DR/CR label)
        const keyNoSide = `${t.account}__${Number(t.amount).toFixed(2)}__`
        // find any gl row with same account & amount
        const anyIdx = glCopy.findIndex((g) => !g.matched && g.account === t.account && Number(g.amount).toFixed(2) === Number(t.amount).toFixed(2))
        if (anyIdx !== -1) {
          tellerCopy[ti].matched = true
          glCopy[anyIdx].matched = true
        }
      }
    }

    return { tellerCopy, glCopy }
  }

  // When either normalized list changes, re-run matching
  useEffect(() => {
    const { tellerCopy, glCopy } = runMatch(tellerNormalized, glNormalized)
    setTellerNormalized(tellerCopy)
    setGlNormalized(glCopy)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tellerRaw.length, glRaw.length]) // only run when files change

  // Totals for summary cards
  const totals = useMemo(() => {
    const sum = (arr: NormalizedRow[]) => arr.reduce((a, b) => a + (b.amount || 0), 0)
    const tellerDebit = sum(tellerNormalized.filter((r) => r.side === "debit"))
    const tellerCredit = sum(tellerNormalized.filter((r) => r.side === "credit"))
    const glDebit = sum(glNormalized.filter((r) => r.side === "debit"))
    const glCredit = sum(glNormalized.filter((r) => r.side === "credit"))
    const matchedCount = (tellerNormalized.filter((r) => r.matched).length + glNormalized.filter((r) => r.matched).length) / 2 // pairs
    const unmatchedTeller = tellerNormalized.filter((r) => !r.matched).length
    const unmatchedGl = glNormalized.filter((r) => !r.matched).length
    return { tellerDebit, tellerCredit, glDebit, glCredit, matchedCount, unmatchedTeller, unmatchedGl }
  }, [tellerNormalized, glNormalized])

  // Computed Till logic (example formula)
  // Opening + totalCredit - totalDebit - buyAmount + sellAmount
  // NOTE: user told not to add cheque deposit — we will exclude teller cheque rows from credit total when computing till
  const computedTill = useMemo(() => {
    const opening = safeNumber(openingBalance)
    const buy = safeNumber(buyAmount)
    const sell = safeNumber(sellAmount)
    // exclude cheques by checking narration === 'CHEQUE:' prefix
    const credits = tellerNormalized
      .filter((r) => r.side === "credit" && !(String(r.narration || "").toUpperCase().includes("CHEQUE")))
      .reduce((s, r) => s + r.amount, 0)
    const debits = tellerNormalized.filter((r) => r.side === "debit").reduce((s, r) => s + r.amount, 0)
    return opening + credits - debits - buy + sell
  }, [openingBalance, buyAmount, sellAmount, tellerNormalized])

  const difference = useMemo(() => {
    // difference between computed till and GL-balanced figure (we'll use glCredit - glDebit as GL net)
    const glNet = totals.glCredit - totals.glDebit
    // Your expected comparison might be computedTill - glNet
    return Number((computedTill - glNet).toFixed(2))
  }, [computedTill, totals])

  // Export function
  const handleExport = () => {
    const wb = XLSX.utils.book_new()
    const tellerSheet = tellerNormalized.map((r) => ({
      id: r.id,
      source: r.source,
      side: r.side,
      account: r.account,
      amount: r.amount,
      narration: r.narration,
      matched: r.matched ? "MATCHED" : "UNMATCHED",
    }))
    const glSheet = glNormalized.map((r) => ({
      id: r.id,
      source: r.source,
      side: r.side,
      account: r.account,
      amount: r.amount,
      date: r.date,
      narration: r.narration,
      user: r.user,
      matched: r.matched ? "MATCHED" : "UNMATCHED",
    }))
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(tellerSheet), "Teller_Normalized")
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(glSheet), "GL_Normalized")
    const date = new Date().toISOString().split("T")[0]
    XLSX.writeFile(wb, `teller_gl_recon_${date}.xlsx`)
  }

  // UI lists for current tab
  const tabRows = useMemo(() => {
    switch (activeTab) {
      case "teller_debit":
        return tellerNormalized.filter((r) => r.side === "debit")
      case "teller_credit":
        return tellerNormalized.filter((r) => r.side === "credit")
      case "gl_debit":
        return glNormalized.filter((r) => r.side === "debit")
      case "gl_credit":
        return glNormalized.filter((r) => r.side === "credit")
      default:
        return []
    }
  }, [activeTab, tellerNormalized, glNormalized])

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">Teller & GL Reconciliation — Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Upload Teller Proof and GL Report, preview and auto-match by Account + Amount.</p>
      </div>

      <BranchInfo
        branchCode={branchCode}
        branchName={branchName}
        country={country}
        onBranchCodeChange={setBranchCode}
        onBranchNameChange={setBranchName}
        onCountryChange={setCountry}
      />

      {/* Upload Section */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><FileSpreadsheet className="h-4 w-4 text-primary" /> Teller Proof</CardTitle>
            <CardDescription>Upload the teller excel (sheet named 'cast' preferred or simple columns)</CardDescription>
          </CardHeader>
          <CardContent>
            <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 text-center hover:bg-muted/50">
              <Upload className="h-8 w-8 mb-2" />
              <span className="text-sm font-medium">{tellerFile ? tellerFile.name : "Click to upload teller file (Sheet2: cast preferred)"}</span>
              <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => e.target.files?.[0] && handleTellerUpload(e.target.files[0])} />
            </label>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Input placeholder="Teller Name" value={tellerName} onChange={(e) => setTellerName(e.target.value)} />
              <Input placeholder="Supervisor Name" value={supervisorName} onChange={(e) => setSupervisorName(e.target.value)} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><FileSpreadsheet className="h-4 w-4 text-primary" /> GL Report</CardTitle>
            <CardDescription>Upload the GL export (we auto-clean and map TXN DATE, BRANCH, ACCOUNT NUMBER, DR/CR, LCY AMOUNT, USER ID, AUTHORISER ID, EXTERNAL REFERENCE)</CardDescription>
          </CardHeader>
          <CardContent>
            <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 text-center hover:bg-muted/50">
              <Upload className="h-8 w-8 mb-2" />
              <span className="text-sm font-medium">{glFile ? glFile.name : "Click to upload GL file"}</span>
              <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => e.target.files?.[0] && handleGlUpload(e.target.files[0])} />
            </label>

            <div className="mt-3 grid grid-cols-3 gap-2">
              <Input type="number" placeholder="Opening Balance (₦)" value={openingBalance === "" ? "" : String(openingBalance)} onChange={(e) => setOpeningBalance(e.target.value === "" ? "" : Number(e.target.value))} />
              <Input type="number" placeholder="Buy Amount (₦)" value={buyAmount === "" ? "" : String(buyAmount)} onChange={(e) => setBuyAmount(e.target.value === "" ? "" : Number(e.target.value))} />
              <Input type="number" placeholder="Sell Amount (₦)" value={sellAmount === "" ? "" : String(sellAmount)} onChange={(e) => setSellAmount(e.target.value === "" ? "" : Number(e.target.value))} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Summary Cards */}
      <div className="grid md:grid-cols-4 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Teller Total Debit</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₦{totals.tellerDebit.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">Sum of teller debit entries</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Teller Total Credit</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₦{totals.tellerCredit.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">Sum of teller credit entries (cheques excluded from till)</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">GL Net (Credit - Debit)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₦{(totals.glCredit - totals.glDebit).toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">GL side totals</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Matched Pairs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.matchedCount}</div>
            <div className="text-xs text-muted-foreground">Auto-matched by Account + Amount</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs + Preview */}
      <Card>
        <CardHeader>
          <CardTitle>Preview & Tabs</CardTitle>
          <CardDescription>Switch between Teller Debit / Teller Credit / GL Debit / GL Credit</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
            <TabsList className="grid grid-cols-4 gap-2 mb-4">
              <TabsTrigger value="teller_debit">Teller Debit</TabsTrigger>
              <TabsTrigger value="teller_credit">Teller Credit</TabsTrigger>
              <TabsTrigger value="gl_debit">GL Debit</TabsTrigger>
              <TabsTrigger value="gl_credit">GL Credit</TabsTrigger>
            </TabsList>

            <div className="rounded-lg border overflow-auto max-h-[520px]">
              <table className="w-full table-auto">
                <thead className="bg-muted/50 sticky top-0">
                  <tr>
                    <th className="p-2 text-left">Account</th>
                    <th className="p-2 text-left">Side</th>
                    <th className="p-2 text-right">Amount</th>
                    <th className="p-2 text-left">Narration / Date / User</th>
                    <th className="p-2 text-center">Matched</th>
                  </tr>
                </thead>
                <tbody>
                  {tabRows.slice(0, previewLimit).map((r) => (
                    <tr key={r.id} className={r.matched ? "bg-green-50" : "bg-white"}>
                      <td className="p-2 font-mono">{r.account}</td>
                      <td className="p-2">{r.side.toUpperCase()}</td>
                      <td className="p-2 text-right font-mono">₦{Number(r.amount).toLocaleString()}</td>
                      <td className="p-2 text-sm">
                        <div>{r.narration}</div>
                        <div className="text-xs text-muted-foreground">{r.date || ""} {r.user ? ` • ${r.user}` : ""}</div>
                      </td>
                      <td className="p-2 text-center">
                        {r.matched ? <Badge>Matched</Badge> : <Badge variant="outline">Pending</Badge>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <div className="text-xs text-muted-foreground">Showing up to {previewLimit} rows. Scroll inside the box to see more.</div>
              <div className="flex items-center gap-2">
                <Input type="number" value={previewLimit} onChange={(e) => setPreviewLimit(Number(e.target.value || 50))} className="w-24" />
                <Button onClick={() => { setPreviewLimit(500); alert("Preview expanded to 500 rows") }}>Expand</Button>
              </div>
            </div>
          </Tabs>
        </CardContent>
      </Card>

      {/* Results / Actions */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="space-y-1">
          <div className="text-sm">Computed Till Balance</div>
          <div className="text-2xl font-bold">₦{computedTill.toLocaleString()}</div>
          <div className="text-sm text-muted-foreground">Difference vs GL Net: <span className={difference === 0 ? "text-green-600" : "text-destructive"}>₦{difference.toLocaleString()}</span></div>
        </div>

        <div className="flex gap-2">
          <Button onClick={handleExport} className="bg-gradient-to-r from-blue-600 to-teal-500 text-white">
            <Download className="mr-2 h-4 w-4" /> Export Result
          </Button>
          <Button onClick={() => alert("Dummy Submit clicked — implement backend submit as needed")} variant="outline">Dummy Submit</Button>
        </div>
      </div>

      {/* Matched / Pending lists */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Matched Entries</CardTitle>
            <CardDescription>Auto-matched rows (Teller ↔︎ GL)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-auto max-h-72 rounded border">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="p-2">Source</th>
                    <th className="p-2">Account</th>
                    <th className="p-2 text-right">Amount</th>
                    <th className="p-2">Side</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ...tellerNormalized.filter((r) => r.matched),
                    ...glNormalized.filter((r) => r.matched),
                  ].slice(0, 200).map((r) => (
                    <tr key={r.id} className="bg-green-50">
                      <td className="p-2">{r.source.toUpperCase()}</td>
                      <td className="p-2 font-mono">{r.account}</td>
                      <td className="p-2 text-right">₦{r.amount.toLocaleString()}</td>
                      <td className="p-2">{r.side}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pending Entries</CardTitle>
            <CardDescription>Unmatched rows needing attention</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-auto max-h-72 rounded border">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="p-2">Source</th>
                    <th className="p-2">Account</th>
                    <th className="p-2 text-right">Amount</th>
                    <th className="p-2">Side</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ...tellerNormalized.filter((r) => !r.matched),
                    ...glNormalized.filter((r) => !r.matched),
                  ].slice(0, 200).map((r) => (
                    <tr key={r.id}>
                      <td className="p-2">{r.source.toUpperCase()}</td>
                      <td className="p-2 font-mono">{r.account}</td>
                      <td className="p-2 text-right">₦{r.amount.toLocaleString()}</td>
                      <td className="p-2">{r.side}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
