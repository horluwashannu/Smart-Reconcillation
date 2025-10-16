// /components/SmartReconDashboard.tsx
"use client"

import React, { useMemo, useState } from "react"
import * as XLSX from "xlsx"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Download } from "lucide-react"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { BranchInfo } from "@/components/branch-info"

/**
 * SmartReconDashboard
 * - 4 tabs: teller_credit, teller_debit, gl_credit, gl_debit
 * - Each tab can accept an Excel upload and preview the parsed rows (scollable)
 * - GL preview supports filter by User ID
 * - Matching logic: AccountNo + Amount (+ Type/DRCR when available)
 * - Export and Dummy Submit buttons (client-side export using xlsx)
 *
 * Notes:
 * - Install: npm i xlsx
 * - This is client-only and Vercel build safe (no server/API calls)
 */

type RowAny = Record<string, any>

const TAB_KEYS = [
  "teller_credit",
  "teller_debit",
  "gl_credit",
  "gl_debit",
] as const
type TabKey = typeof TAB_KEYS[number]

export default function SmartReconDashboard() {
  // Branch + meta
  const [branchCode, setBranchCode] = useState("")
  const [branchName, setBranchName] = useState("")
  const [country, setCountry] = useState("")

  // Teller & GL uploader state
  const [tellerCreditRows, setTellerCreditRows] = useState<RowAny[]>([])
  const [tellerDebitRows, setTellerDebitRows] = useState<RowAny[]>([])
  const [glCreditRows, setGlCreditRows] = useState<RowAny[]>([])
  const [glDebitRows, setGlDebitRows] = useState<RowAny[]>([])

  // UI state
  const [activeTab, setActiveTab] = useState<TabKey>("teller_credit")
  const [tellerName, setTellerName] = useState("")
  const [supervisorName, setSupervisorName] = useState("")
  const [glFilterUser, setGlFilterUser] = useState("")

  // Robust value to number
  const safeNumber = (v: any) => {
    if (v === null || v === undefined || v === "") return 0
    const s = String(v).replace(/[,₦€$]/g, "").trim()
    const n = Number(s)
    return Number.isFinite(n) ? n : 0
  }

  // --- Generic sheet parsing helpers ---
  // tries to find header row (first row with many non-empty cells) and returns parsed objects
  const parseSheetToRows = (ws: XLSX.WorkSheet) => {
    const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" }) as any[][]
    // remove fully-empty top rows
    let start = 0
    while (start < raw.length && raw[start].every((c) => String(c).trim() === "")) start++
    if (start >= raw.length) return []
    // find header row by guessing a row with at least 2 text headers
    let headerRowIndex = start
    for (let i = start; i < Math.min(raw.length, start + 6); i++) {
      const nonEmptyCount = raw[i].filter((c: any) => String(c).trim() !== "").length
      if (nonEmptyCount >= 2) {
        headerRowIndex = i
        break
      }
    }
    const header = raw[headerRowIndex].map((h: any, idx: number) =>
      String(h || `COL_${idx}`).trim()
    )
    const dataRows = raw.slice(headerRowIndex + 1)
    const rows = dataRows
      .filter((r) => r && r.some((c) => String(c).trim() !== ""))
      .map((r) => {
        const obj: RowAny = {}
        header.forEach((h: string, i: number) => {
          // normalize header key: remove newlines, trim
          const key = String(h).replace(/\r?\n/g, " ").trim()
          obj[key] = r[i]
        })
        return obj
      })
    return rows
  }

  // Generic file handler for a tab
  const handleFileForTab = async (file: File | undefined, tab: TabKey) => {
    if (!file) return
    const data = await file.arrayBuffer()
    const wb = XLSX.read(data, { type: "array", cellDates: true })
    // choose sheet: prefer "cast" for teller loads, otherwise first sheet
    let sheetName = wb.SheetNames[0]
    if (tab.startsWith("teller")) {
      const cast = wb.SheetNames.find((n) => n.toLowerCase().trim() === "cast")
      if (cast) sheetName = cast
      else if (wb.SheetNames.length >= 2) sheetName = wb.SheetNames[1] // your convention
    }
    const ws = wb.Sheets[sheetName]
    const rows = parseSheetToRows(ws)

    // Map/normalize common fields to helpful keys for matching
    const normalized = rows.map((r) => {
      const keys = Object.keys(r)
      // helper find value by possible header names (case-insensitive)
      const find = (...cands: string[]) => {
        const lk = keys.find((k) =>
          cands.some((c) => k.toLowerCase().replace(/\s+/g, "").includes(c.toLowerCase().replace(/\s+/g, "")))
        )
        return lk ? r[lk] : undefined
      }

      const account = find("accountnumber", "accountno", "account", "nuban", "account number")
      const drcr = find("dr/cr", "drcr", "dr / cr", "dr", "cr")
      const amount = find("lcyaamount", "lcy amount", "amount", "lc y amount", "lcyamount", "lcy")
      const txnDate = find("transactiondate", "transaction date", "value date")
      const user = find("userid", "user id", "user")
      const authoriser = find("authoriserid", "authoriser id", "authorizer", "authoriser")
      const ref = find("externalreferenceno", "external reference", "reference", "external reference no")

      return {
        __raw: r,
        AccountNo: String(account ?? "").trim(),
        Type: drcr ? String(drcr).trim() : undefined,
        Amount: safeNumber(amount),
        Date: txnDate ? String(txnDate) : "",
        User: user ? String(user).trim() : "",
        Authorizer: authoriser ? String(authoriser).trim() : "",
        Reference: ref ? String(ref).trim() : "",
        // keep original keys to preview columns
        ...r,
      }
    })

    // save into proper state
    if (tab === "teller_credit") setTellerCreditRows(normalized)
    if (tab === "teller_debit") setTellerDebitRows(normalized)
    if (tab === "gl_credit") setGlCreditRows(normalized)
    if (tab === "gl_debit") setGlDebitRows(normalized)
  }

  // UI file change handlers
  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>, tab: TabKey) => {
    const f = e.target.files?.[0]
    handleFileForTab(f, tab)
  }

  // Matching logic: given teller rows and gl rows, mark matched
  // We'll create a quick lookup map for GL rows by "account|amount|type" to allow matching
  const buildGlIndex = (glRows: RowAny[]) => {
    const map = new Map<string, number[]>()
    glRows.forEach((g, idx) => {
      const key = `${(g.AccountNo || "").trim()}|${safeNumber(g.Amount)}|${String(g.Type || "").trim()}`
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(idx)
    })
    return map
  }

  const markMatchesForTeller = (tellerRows: RowAny[], glRows: RowAny[]) => {
    // return rows with matched boolean, and a glMatchedIndices set
    const glIndex = buildGlIndex(glRows)
    const matchedTellerRows = tellerRows.map((t) => {
      const tAcc = (t.AccountNo || t["ACCOUNT NO"] || t["ACCOUNT_NO"] || "").toString().trim()
      // teller amount could be any of several fields; we'll try commonly used ones
      const possibleAmountFields = ["Amount", "AMOUNT", "CASH DEP", "CASH_DEP", "CASHDEP", "SAVINGS_WITHDR", "SAVINGS WITHDR", "TO_VAULT", "EXPENSE", "WUMT", "CHEQUES", "LCY AMOUNT", "LCYAMOUNT"]
      let amt = 0
      for (const f of possibleAmountFields) {
        if (t[f] !== undefined && t[f] !== null && t[f] !== "") {
          amt = safeNumber(t[f])
          if (amt !== 0) break
        }
      }
      // fallback: try any numeric-looking cell
      if (amt === 0) {
        const numericCell = Object.values(t).find((v) => typeof v === "number" && v !== 0)
        if (numericCell) amt = safeNumber(numericCell)
      }

      const candidateKeyExact = `${tAcc}|${amt}|${String((t.Type || "").trim())}`
      const candidateKeyNoType = `${tAcc}|${amt}|`
      // try exact match including type
      const foundExact = glIndex.get(candidateKeyExact)
      const foundNoType = glIndex.get(candidateKeyNoType)

      const matched = Boolean((foundExact && foundExact.length > 0) || (foundNoType && foundNoType.length > 0))
      return { ...t, __matched: matched, __matchedAmount: amt }
    })
    return matchedTellerRows
  }

  // Combined match highlights for UI (memoized)
  const tellerCreditWithMatch = useMemo(
    () => markMatchesForTeller(tellerCreditRows, [...glCreditRows, ...glDebitRows]),
    [tellerCreditRows, glCreditRows, glDebitRows]
  )
  const tellerDebitWithMatch = useMemo(
    () => markMatchesForTeller(tellerDebitRows, [...glCreditRows, ...glDebitRows]),
    [tellerDebitRows, glCreditRows, glDebitRows]
  )

  // For GL tabs we can mark whether GL row has a matching teller row
  const glCreditWithMatch = useMemo(() => {
    const tIndex = new Map<string, number[]>()
    const allTellers = [...tellerCreditRows, ...tellerDebitRows]
    allTellers.forEach((t) => {
      const acc = (t.AccountNo || t["ACCOUNT_NO"] || t["ACCOUNT NO"] || "").toString().trim()
      const amt = safeNumber(t.__matchedAmount ?? t.Amount ?? t["AMOUNT"])
      const key = `${acc}|${amt}|${String((t.Type || "").trim())}`
      if (!tIndex.has(key)) tIndex.set(key, [])
      tIndex.get(key)!.push(1)
    })
    return glCreditRows.map((g) => {
      const key = `${(g.AccountNo || "").trim()}|${safeNumber(g.Amount)}|${String((g.Type || "").trim())}`
      const keyNoType = `${(g.AccountNo || "").trim()}|${safeNumber(g.Amount)}|`
      const matched = Boolean(tIndex.get(key) || tIndex.get(keyNoType))
      return { ...g, __matched: matched }
    })
  }, [glCreditRows, tellerCreditRows, tellerDebitRows])

  const glDebitWithMatch = useMemo(() => {
    const tIndex = new Map<string, number[]>()
    const allTellers = [...tellerCreditRows, ...tellerDebitRows]
    allTellers.forEach((t) => {
      const acc = (t.AccountNo || t["ACCOUNT_NO"] || t["ACCOUNT NO"] || "").toString().trim()
      const amt = safeNumber(t.__matchedAmount ?? t.Amount ?? t["AMOUNT"])
      const key = `${acc}|${amt}|${String((t.Type || "").trim())}`
      if (!tIndex.has(key)) tIndex.set(key, [])
      tIndex.get(key)!.push(1)
    })
    return glDebitRows.map((g) => {
      const key = `${(g.AccountNo || "").trim()}|${safeNumber(g.Amount)}|${String((g.Type || "").trim())}`
      const keyNoType = `${(g.AccountNo || "").trim()}|${safeNumber(g.Amount)}|`
      const matched = Boolean(tIndex.get(key) || tIndex.get(keyNoType))
      return { ...g, __matched: matched }
    })
  }, [glDebitRows, tellerCreditRows, tellerDebitRows])

  // Filter GL by user id (simple contains)
  const getFilteredGl = (rows: RowAny[]) => {
    if (!glFilterUser.trim()) return rows
    const q = glFilterUser.toLowerCase().trim()
    return rows.filter((r) => String(r.User || r.USER || r["USER ID"] || "").toLowerCase().includes(q))
  }

  // Export results (combined) as excel
  const handleExportAll = () => {
    const wb = XLSX.utils.book_new()
    const pushSheet = (name: string, rows: RowAny[]) => {
      if (!rows || rows.length === 0) {
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([[`${name} - no rows`]]), name)
        return
      }
      // flatten rows: keep original keys and add __matched flag
      const out = rows.map((r) => {
        const copy: RowAny = {}
        Object.keys(r).forEach((k) => {
          if (!k.startsWith("__")) copy[k] = r[k]
        })
        copy["MATCHED"] = !!r.__matched
        return copy
      })
      const ws = XLSX.utils.json_to_sheet(out)
      XLSX.utils.book_append_sheet(wb, ws, name)
    }

    pushSheet("Teller_Credit", tellerCreditWithMatch)
    pushSheet("Teller_Debit", tellerDebitWithMatch)
    pushSheet("GL_Credit", glCreditWithMatch)
    pushSheet("GL_Debit", glDebitWithMatch)
    // summary sheet
    const summary = [
      ["Branch Code", branchCode],
      ["Branch Name", branchName],
      ["Country", country],
      ["Teller Name", tellerName],
      ["Supervisor Name", supervisorName],
      ["Exported At", new Date().toISOString()],
    ]
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summary), "Summary")
    XLSX.writeFile(wb, `smart_recon_export_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  // Dummy submit action
  const handleDummySubmit = () => {
    // simply show a success alert; in real app you would POST to server
    alert("Dummy submit complete — data packaged client-side (no server call).")
  }

  // Helper to render preview table with scroll & highlight
  const PreviewTable: React.FC<{ rows: RowAny[] }> = ({ rows }) => {
    if (!rows || rows.length === 0) {
      return <div className="py-8 text-center text-sm text-muted-foreground">No rows to preview</div>
    }
    // build header union (up to first 30 columns)
    const headerKeys = Array.from(
      new Set(rows.flatMap((r) => Object.keys(r).filter((k) => !k.startsWith("__"))))
    ).slice(0, 40)

    return (
      <div style={{ maxHeight: 420 }} className="overflow-auto border rounded-lg bg-background p-2">
        <table className="w-full table-auto">
          <thead className="sticky top-0 bg-muted/60">
            <tr>
              {headerKeys.map((h) => (
                <th key={h} className="text-left px-2 py-1 text-xs sticky top-0 bg-muted/60 border-b">
                  {h}
                </th>
              ))}
              <th className="text-left px-2 py-1 text-xs border-b">MATCH</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const matched = !!r.__matched
              return (
                <tr key={i} className={matched ? "bg-green-50" : i % 2 ? "bg-white" : "bg-muted/5"}>
                  {headerKeys.map((k) => (
                    <td key={k} className="px-2 py-1 text-xs">
                      {String(r[k] ?? "")}
                    </td>
                  ))}
                  <td className="px-2 py-1 text-xs">
                    {matched ? <Badge>Matched</Badge> : <Badge variant="outline">Unmatched</Badge>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    )
  }

  // Determine which preview rows to render based on tab
  const previewRows = useMemo(() => {
    switch (activeTab) {
      case "teller_credit":
        return tellerCreditWithMatch
      case "teller_debit":
        return tellerDebitWithMatch
      case "gl_credit":
        return getFilteredGl(glCreditWithMatch)
      case "gl_debit":
        return getFilteredGl(glDebitWithMatch)
      default:
        return []
    }
  }, [activeTab, tellerCreditWithMatch, tellerDebitWithMatch, glCreditWithMatch, glDebitWithMatch, glFilterUser])

  // small counts display
  const counts = useMemo(() => {
    return {
      tellerCredit: tellerCreditRows.length,
      tellerDebit: tellerDebitRows.length,
      glCredit: glCreditRows.length,
      glDebit: glDebitRows.length,
    }
  }, [tellerCreditRows.length, tellerDebitRows.length, glCreditRows.length, glDebitRows.length])

  return (
    <div className="space-y-6 p-4 min-h-screen bg-gradient-to-br from-blue-50 to-teal-50">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Smart Recon Dashboard</h1>
        <p className="text-sm text-muted-foreground">Upload Teller (CAST) & GL exports — 4 tabs, match highlights, filter and export.</p>
      </div>

      <BranchInfo
        branchCode={branchCode}
        branchName={branchName}
        country={country}
        onBranchCodeChange={setBranchCode}
        onBranchNameChange={setBranchName}
        onCountryChange={setCountry}
      />

      <div className="grid gap-4 md:grid-cols-2">
        {/* Teller Uploads */}
        <Card>
          <CardHeader>
            <CardTitle>Upload Teller Files</CardTitle>
            <CardDescription>Sheet name "cast" preferred — we try sheet index 1 as fallback.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Teller Credit (upload)</Label>
                <Input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => onFileChange(e, "teller_credit")} />
                <div className="mt-2"><Badge variant="secondary">Rows: {counts.tellerCredit}</Badge></div>
              </div>
              <div>
                <Label>Teller Debit (upload)</Label>
                <Input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => onFileChange(e, "teller_debit")} />
                <div className="mt-2"><Badge variant="secondary">Rows: {counts.tellerDebit}</Badge></div>
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-3">
              <div>
                <Label>Teller Name</Label>
                <Input value={tellerName} onChange={(e) => setTellerName(e.target.value)} placeholder="Teller name" />
              </div>
              <div>
                <Label>Supervisor Name</Label>
                <Input value={supervisorName} onChange={(e) => setSupervisorName(e.target.value)} placeholder="Supervisor name" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* GL Uploads */}
        <Card>
          <CardHeader>
            <CardTitle>Upload GL Files</CardTitle>
            <CardDescription>We auto-detect relevant columns and separate by DR/CR if present.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>GL Credit (upload)</Label>
                <Input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => onFileChange(e, "gl_credit")} />
                <div className="mt-2"><Badge variant="secondary">Rows: {counts.glCredit}</Badge></div>
              </div>
              <div>
                <Label>GL Debit (upload)</Label>
                <Input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => onFileChange(e, "gl_debit")} />
                <div className="mt-2"><Badge variant="secondary">Rows: {counts.glDebit}</Badge></div>
              </div>
            </div>

            <div className="mt-2">
              <Label>Filter GL by User ID</Label>
              <div className="flex gap-2">
                <Input value={glFilterUser} onChange={(e) => setGlFilterUser(e.target.value)} placeholder="Enter user id to filter" />
                <Button onClick={() => { /* filter applied via memo */ }}>Apply</Button>
                <Button variant="outline" onClick={() => setGlFilterUser("")}>Clear</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs selection */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between w-full">
            <CardTitle>Preview & Match</CardTitle>
            <div className="flex gap-2">
              <Button size="sm" variant={activeTab === "teller_credit" ? "default" : "outline"} onClick={() => setActiveTab("teller_credit")}>Teller Credit</Button>
              <Button size="sm" variant={activeTab === "teller_debit" ? "default" : "outline"} onClick={() => setActiveTab("teller_debit")}>Teller Debit</Button>
              <Button size="sm" variant={activeTab === "gl_credit" ? "default" : "outline"} onClick={() => setActiveTab("gl_credit")}>GL Credit</Button>
              <Button size="sm" variant={activeTab === "gl_debit" ? "default" : "outline"} onClick={() => setActiveTab("gl_debit")}>GL Debit</Button>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <div>
            <div className="mb-3 text-sm text-muted-foreground">
              Active: <strong>{activeTab.replace("_", " ").toUpperCase()}</strong>
            </div>

            {/* Preview table (scrollable) */}
            <PreviewTable rows={previewRows} />
          </div>

          {/* Actions */}
          <div className="mt-4 flex flex-wrap gap-3 justify-end">
            <Button onClick={handleExportAll} className="bg-gradient-to-r from-blue-600 to-teal-500 text-white">
              <Download className="mr-2 h-4 w-4" /> Export All
            </Button>
            <Button variant="outline" onClick={handleDummySubmit}>Dummy Submit</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
