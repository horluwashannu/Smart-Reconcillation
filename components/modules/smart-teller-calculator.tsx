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
import { BranchInfo } from "@/components/branch-info"

/**
 * SmartReconDashboard — Vercel-build-safe, client-only
 * - 4 tabs: teller_credit, teller_debit, gl_credit, gl_debit
 * - Upload and preview Excel sheets (scrollable)
 * - GL filter by User ID
 * - Matching highlight (AccountNo + Amount)
 * - Export combined workbook and Dummy Submit
 *
 * Requirements: `npm i xlsx`
 */

type AnyRow = Record<string, any>

const TAB_KEYS = ["teller_credit", "teller_debit", "gl_credit", "gl_debit"] as const
type TabKey = typeof TAB_KEYS[number]

export default function SmartReconDashboard(): JSX.Element {
  // branch metadata
  const [branchCode, setBranchCode] = useState("")
  const [branchName, setBranchName] = useState("")
  const [country, setCountry] = useState("")

  // teller & GL raw states (always arrays)
  const [tellerCreditRows, setTellerCreditRows] = useState<AnyRow[]>([])
  const [tellerDebitRows, setTellerDebitRows] = useState<AnyRow[]>([])
  const [glCreditRows, setGlCreditRows] = useState<AnyRow[]>([])
  const [glDebitRows, setGlDebitRows] = useState<AnyRow[]>([])

  // UI / meta
  const [activeTab, setActiveTab] = useState<TabKey>("teller_credit")
  const [tellerName, setTellerName] = useState("")
  const [supervisorName, setSupervisorName] = useState("")
  const [glFilterUser, setGlFilterUser] = useState("")

  // safe number parse
  const safeNumber = (v: any) => {
    if (v === null || v === undefined || v === "") return 0
    const s = String(v).replace(/[,₦€$]/g, "").trim()
    const n = Number(s)
    return Number.isFinite(n) ? n : 0
  }

  // ---------- Parsing helpers ----------
  const stripEmptyTopRows = (raw: any[][]) => {
    let start = 0
    while (start < raw.length && raw[start].every((c: any) => String(c).trim() === "")) start++
    return raw.slice(start)
  }

  const parseSheetToRows = (ws: XLSX.WorkSheet) => {
    const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" }) as any[][]
    const cleaned = stripEmptyTopRows(raw)
    if (!cleaned || cleaned.length === 0) return []
    // find header row (first row with at least 2 non-empty cells)
    let headerRowIdx = 0
    for (let i = 0; i < Math.min(cleaned.length, 6); i++) {
      const nonEmpty = cleaned[i].filter((c: any) => String(c).trim() !== "").length
      if (nonEmpty >= 2) {
        headerRowIdx = i
        break
      }
    }
    const header = (cleaned[headerRowIdx] || []).map((h: any, idx: number) =>
      String(h || `COL_${idx}`).trim()
    )
    const rows = cleaned.slice(headerRowIdx + 1)
      .filter((r) => r && r.some((c: any) => String(c).trim() !== ""))
      .map((r) => {
        const obj: AnyRow = {}
        header.forEach((h: string, i: number) => {
          obj[String(h).trim()] = r[i]
        })
        return obj
      })
    return rows
  }

  // choose sheet: prefer "cast" for teller files
  const pickSheetName = (wb: XLSX.WorkBook, preferCast = false) => {
    if (preferCast) {
      const found = wb.SheetNames.find((n) => n.toLowerCase().trim() === "cast")
      if (found) return found
      if (wb.SheetNames.length >= 2) return wb.SheetNames[1]
    }
    return wb.SheetNames[0]
  }

  // normalize keys for matching: AccountNo, Amount, Type, User, Date, Reference
  const normalizeForMatch = (row: AnyRow) => {
    const keys = Object.keys(row)
    const find = (...cands: string[]) => {
      const k = keys.find((k) =>
        cands.some((c) => k.toLowerCase().replace(/\s+/g, "").includes(c.toLowerCase().replace(/\s+/g, "")))
      )
      return k ? row[k] : undefined
    }
    const account = String(find("accountnumber", "account no", "accountno", "account", "nuban") ?? "").trim()
    const amount = safeNumber(find("lcy amount", "lcyamount", "amount", "lcyaamount", "lc y amount", "lc amount"))
    const type = String(find("dr/cr", "drcr", "dr/cr ", "dr", "cr") ?? "").trim()
    const user = String(find("userid", "user id", "user") ?? "").trim()
    const date = String(find("transactiondate", "transaction date", "value date", "date") ?? "").trim()
    const ref = String(find("externalreferenceno", "external reference", "reference") ?? "").trim()
    return { ...row, AccountNo: account, Amount: amount, Type: type, User: user, Date: date, Reference: ref }
  }

  // ---------- File handlers ----------
  const handleFile = async (file: File | undefined, tab: TabKey) => {
    if (!file) return
    try {
      const data = await file.arrayBuffer()
      const wb = XLSX.read(data, { type: "array", cellDates: true })
      const preferCast = tab.startsWith("teller")
      const sheetName = pickSheetName(wb, preferCast)
      const ws = wb.Sheets[sheetName]
      const rows = parseSheetToRows(ws).map(normalizeForMatch)
      if (tab === "teller_credit") setTellerCreditRows(rows)
      if (tab === "teller_debit") setTellerDebitRows(rows)
      if (tab === "gl_credit") setGlCreditRows(rows)
      if (tab === "gl_debit") setGlDebitRows(rows)
    } catch (err) {
      // friendly alert
      // keep simple: avoid throwing runtime errors that crash render
      // eslint-disable-next-line no-console
      console.error("Failed to parse file", err)
      alert("Failed to parse uploaded file — ensure it's a valid Excel/CSV file.")
    }
  }

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>, tab: TabKey) => {
    const file = e.target.files?.[0]
    handleFile(file, tab)
    // reset input value so same file can be re-uploaded if needed
    if (e.target) e.target.value = ""
  }

  // ---------- Matching logic ----------
  // build GL lookup map: account|amount|type -> indices
  const buildIndex = (rows: AnyRow[]) => {
    const map = new Map<string, number[]>()
    rows.forEach((r, i) => {
      const key = `${(r.AccountNo || "").trim()}|${safeNumber(r.Amount)}|${String(r.Type || "").trim()}`
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(i)
    })
    return map
  }

  const markTellerMatches = (tellerRows: AnyRow[], glRows: AnyRow[]) => {
    if (!tellerRows.length) return tellerRows.map((r) => ({ ...r, __matched: false }))
    const glIndex = buildIndex(glRows)
    return tellerRows.map((t) => {
      const acc = String(t.AccountNo || "").trim()
      const amt = safeNumber(t.Amount ?? t["AMOUNT"] ?? t["CASH DEP"] ?? t["CASH_DEP"] ?? t["SAVINGS_WITHDR"] ?? 0)
      const type = String(t.Type || "").trim()
      const keyExact = `${acc}|${amt}|${type}`
      const keyNoType = `${acc}|${amt}|`
      const matched = Boolean((glIndex.get(keyExact) && glIndex.get(keyExact)!.length > 0) || (glIndex.get(keyNoType) && glIndex.get(keyNoType)!.length > 0))
      return { ...t, __matched: matched }
    })
  }

  const markGlMatches = (glRows: AnyRow[], tellerRows: AnyRow[]) => {
    if (!glRows.length) return glRows.map((r) => ({ ...r, __matched: false }))
    const tIndex = buildIndex(tellerRows)
    return glRows.map((g) => {
      const acc = String(g.AccountNo || "").trim()
      const amt = safeNumber(g.Amount)
      const type = String(g.Type || "").trim()
      const keyExact = `${acc}|${amt}|${type}`
      const keyNoType = `${acc}|${amt}|`
      const matched = Boolean((tIndex.get(keyExact) && tIndex.get(keyExact)!.length > 0) || (tIndex.get(keyNoType) && tIndex.get(keyNoType)!.length > 0))
      return { ...g, __matched: matched }
    })
  }

  // memoized matched datasets
  const allGlRows = useMemo(() => [...glCreditRows, ...glDebitRows], [glCreditRows, glDebitRows])
  const allTellerRows = useMemo(() => [...tellerCreditRows, ...tellerDebitRows], [tellerCreditRows, tellerDebitRows])

  const tellerCreditMatched = useMemo(() => markTellerMatches(tellerCreditRows, allGlRows), [tellerCreditRows, allGlRows])
  const tellerDebitMatched = useMemo(() => markTellerMatches(tellerDebitRows, allGlRows), [tellerDebitRows, allGlRows])
  const glCreditMatched = useMemo(() => markGlMatches(glCreditRows, allTellerRows), [glCreditRows, allTellerRows])
  const glDebitMatched = useMemo(() => markGlMatches(glDebitRows, allTellerRows), [glDebitRows, allTellerRows])

  // GL filter by user id (simple contains)
  const filterGlByUser = (rows: AnyRow[]) => {
    if (!glFilterUser.trim()) return rows
    const q = glFilterUser.toLowerCase().trim()
    return rows.filter((r) => String(r.User || r["USER"] || r["USER ID"] || "").toLowerCase().includes(q))
  }

  // preview rows depending on active tab
  const previewRows = useMemo(() => {
    switch (activeTab) {
      case "teller_credit":
        return tellerCreditMatched
      case "teller_debit":
        return tellerDebitMatched
      case "gl_credit":
        return filterGlByUser(glCreditMatched)
      case "gl_debit":
        return filterGlByUser(glDebitMatched)
      default:
        return []
    }
  }, [activeTab, tellerCreditMatched, tellerDebitMatched, glCreditMatched, glDebitMatched, glFilterUser])

  // ---------- Export & Dummy ----------
  const exportAll = () => {
    const wb = XLSX.utils.book_new()
    const push = (name: string, rows: AnyRow[]) => {
      if (!rows || rows.length === 0) {
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([[`${name} — no rows`]]), name)
        return
      }
      const out = rows.map((r) => {
        const copy: AnyRow = {}
        Object.keys(r).forEach((k) => {
          if (!k.startsWith("__")) copy[k] = r[k]
        })
        copy.MATCHED = !!r.__matched
        return copy
      })
      const ws = XLSX.utils.json_to_sheet(out)
      XLSX.utils.book_append_sheet(wb, ws, name)
    }
    push("Teller_Credit", tellerCreditMatched)
    push("Teller_Debit", tellerDebitMatched)
    push("GL_Credit", glCreditMatched)
    push("GL_Debit", glDebitMatched)
    const summary = [
      ["Branch Code", branchCode],
      ["Branch Name", branchName],
      ["Country", country],
      ["Teller Name", tellerName],
      ["Supervisor Name", supervisorName],
      ["Exported At", new Date().toISOString()],
    ]
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summary), "Summary")
    XLSX.writeFile(wb, `smart_recon_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  const dummySubmit = () => {
    // client-side dummy: just show success
    alert("Dummy submit successful (client-only).")
  }

  // ---------- Preview table component ----------
  const PreviewTable: React.FC<{ rows: AnyRow[] }> = ({ rows }) => {
    if (!rows || rows.length === 0) {
      return <div className="py-8 text-center text-sm text-muted-foreground">No rows to preview</div>
    }
    // compute header keys union (limit to first 40)
    const headerKeys = Array.from(new Set(rows.flatMap((r) => Object.keys(r).filter((k) => !k.startsWith("__"))))).slice(0, 40)
    return (
      <div style={{ maxHeight: 480 }} className="overflow-auto border rounded-lg bg-background p-2">
        <table className="w-full table-auto">
          <thead className="sticky top-0 bg-muted/60">
            <tr>
              {headerKeys.map((h) => (
                <th key={h} className="px-2 py-1 text-xs text-left border-b">{h}</th>
              ))}
              <th className="px-2 py-1 text-xs text-left border-b">MATCH</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => {
              const matched = !!r.__matched
              return (
                <tr key={idx} className={matched ? "bg-green-50" : idx % 2 ? "bg-white" : "bg-muted/5"}>
                  {headerKeys.map((k) => (
                    <td key={k} className="px-2 py-1 text-xs">{String(r[k] ?? "")}</td>
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

  return (
    <div className="min-h-screen p-6 bg-gradient-to-br from-blue-50 to-teal-100">
      <Card className="max-w-6xl mx-auto rounded-2xl shadow-lg">
        <CardHeader className="bg-gradient-to-r from-blue-600 to-teal-500 text-white rounded-t-2xl p-6">
          <CardTitle className="text-2xl">Smart Recon Dashboard</CardTitle>
          <CardDescription className="text-blue-100">Upload Teller (CAST) & GL exports — preview, match, filter, export.</CardDescription>
        </CardHeader>

        <CardContent className="p-6 space-y-6">
          <BranchInfo
            branchCode={branchCode}
            branchName={branchName}
            country={country}
            onBranchCodeChange={setBranchCode}
            onBranchNameChange={setBranchName}
            onCountryChange={setCountry}
          />

          <div className="grid gap-4 md:grid-cols-2">
            {/* Teller uploads */}
            <Card>
              <CardHeader>
                <CardTitle>Teller Uploads</CardTitle>
                <CardDescription>Preferred sheet name: "cast" (falls back to sheet index 1)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Teller Credit (upload)</Label>
                    <Input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => onFileChange(e, "teller_credit")} />
                    <div className="mt-2"><Badge variant="secondary">{tellerCreditRows.length} rows</Badge></div>
                  </div>
                  <div>
                    <Label>Teller Debit (upload)</Label>
                    <Input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => onFileChange(e, "teller_debit")} />
                    <div className="mt-2"><Badge variant="secondary">{tellerDebitRows.length} rows</Badge></div>
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

            {/* GL uploads */}
            <Card>
              <CardHeader>
                <CardTitle>GL Uploads</CardTitle>
                <CardDescription>Upload GL credit & debit exports (we auto-detect relevant columns)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>GL Credit (upload)</Label>
                    <Input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => onFileChange(e, "gl_credit")} />
                    <div className="mt-2"><Badge variant="secondary">{glCreditRows.length} rows</Badge></div>
                  </div>
                  <div>
                    <Label>GL Debit (upload)</Label>
                    <Input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => onFileChange(e, "gl_debit")} />
                    <div className="mt-2"><Badge variant="secondary">{glDebitRows.length} rows</Badge></div>
                  </div>
                </div>

                <div className="mt-2">
                  <Label>Filter GL by User ID</Label>
                  <div className="flex gap-2">
                    <Input placeholder="User ID" value={glFilterUser} onChange={(e) => setGlFilterUser(e.target.value)} />
                    <Button onClick={() => { /* filter applied via state */ }}>Apply</Button>
                    <Button variant="outline" onClick={() => setGlFilterUser("")}>Clear</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Tabs */}
          <Card>
            <CardHeader className="flex items-center justify-between">
              <CardTitle>Preview & Match</CardTitle>
              <div className="flex gap-2">
                <Button size="sm" variant={activeTab === "teller_credit" ? "default" : "outline"} onClick={() => setActiveTab("teller_credit")}>Teller Credit</Button>
                <Button size="sm" variant={activeTab === "teller_debit" ? "default" : "outline"} onClick={() => setActiveTab("teller_debit")}>Teller Debit</Button>
                <Button size="sm" variant={activeTab === "gl_credit" ? "default" : "outline"} onClick={() => setActiveTab("gl_credit")}>GL Credit</Button>
                <Button size="sm" variant={activeTab === "gl_debit" ? "default" : "outline"} onClick={() => setActiveTab("gl_debit")}>GL Debit</Button>
              </div>
            </CardHeader>

            <CardContent>
              <div className="mb-3 text-sm text-muted-foreground">Active: <strong>{activeTab.replace("_", " ").toUpperCase()}</strong></div>
              <PreviewTable rows={previewRows} />

              <div className="mt-4 flex flex-wrap gap-3 justify-end">
                <Button onClick={exportAll} className="bg-gradient-to-r from-blue-600 to-teal-500 text-white">
                  <Download className="mr-2 h-4 w-4" /> Export All
                </Button>
                <Button variant="outline" onClick={dummySubmit}>Dummy Submit</Button>
              </div>
            </CardContent>
          </Card>
        </CardContent>
      </Card>
    </div>
  )
}
