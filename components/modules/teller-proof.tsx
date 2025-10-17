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
  User?: string // assigned teller id when uploaded
  Matched?: boolean
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
  Matched?: boolean
}

export function TellerProof() {
  const [activeTab, setActiveTab] = useState<
    "teller_debit" | "teller_credit" | "gl_debit" | "gl_credit"
  >("teller_debit")

  // core datasets
  const [tellerRows, setTellerRows] = useState<TellerRow[]>([])
  const [castRows, setCastRows] = useState<TellerRow[]>([])
  const [glRows, setGlRows] = useState<GLRow[]>([])
  const [filteredGl, setFilteredGl] = useState<GLRow[]>([])

  // UI / filters / metadata
  const [tellerId, setTellerId] = useState("") // mandatory for reconciliation
  const [supervisorId, setSupervisorId] = useState("")
  const [tellerName, setTellerName] = useState("")
  const [glFilterUser, setGlFilterUser] = useState("")
  const [openCast, setOpenCast] = useState(false)
  const [openPendingGL, setOpenPendingGL] = useState(false)
  const [buyAmount, setBuyAmount] = useState<number>(0)
  const [sellAmount, setSellAmount] = useState<number>(0)

  // reconciliation state
  const [isReconciled, setIsReconciled] = useState(false)
  const [matchedTotals, setMatchedTotals] = useState({
    matchedDeposit: 0,
    matchedWithdrawal: 0,
  })

  // totals
  const [totals, setTotals] = useState({
    withdrawal: 0,
    deposit: 0,
    expense: 0,
    wumt: 0,
    buy: 0,
    sell: 0,
    glDebit: 0,
    glCredit: 0,
  })

  const safeNumber = (v: any) => {
    const s = String(v || "").replace(/[,₦$]/g, "").trim()
    const n = Number(s)
    return Number.isFinite(n) ? n : 0
  }

  // ----------------------------
  // Teller Upload Parsing
  // ----------------------------
  // Accepts header variations and any file/sheet name.
  // Expected columns (case-insensitive, keyword-based):
  // "withdrawal" / "withdrawal amount"
  // "withdrawal account"
  // "deposit" / "deposit amount"
  // "deposit account"
  // "expense"
  // "wumt" / "w/m/t"
  const parseTellerUpload = async (file: File) => {
    try {
      const data = await file.arrayBuffer()
      const wb = XLSX.read(data, { type: "array" })

      // Always pick the first sheet (works with any sheet name)
      const sheet = wb.Sheets[wb.SheetNames[0]]
      const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" })

      if (!raw || raw.length === 0) {
        alert("Empty Teller file.")
        return
      }

      // Normalize header row for keyword matching
      const headerRow = (raw[0] || []).map((h: any) =>
        String(h || "").trim().toLowerCase()
      )

      // Helper: find index by keywords
      const findIndexByKeywords = (keywords: string[]) => {
        for (let i = 0; i < headerRow.length; i++) {
          const h = headerRow[i]
          if (!h) continue
          for (const kw of keywords) {
            if (h.includes(kw)) return i
          }
        }
        return -1
      }

      // Find indexes
      const idxWithdrawalAmount = findIndexByKeywords([
        "withdrawal amount",
        "withdrawal",
        "withdraw amt",
        "withd",
      ])
      const idxWithdrawalAccount = findIndexByKeywords([
        "withdrawal account",
        "withdrawal acct",
        "withdraw acct",
        "withdraw account",
        "withdrawal acc",
      ])

      const idxDepositAmount = findIndexByKeywords([
        "deposit amount",
        "deposit",
        "deposit amt",
        "depos",
      ])
      const idxDepositAccount = findIndexByKeywords([
        "deposit account",
        "deposit acct",
        "deposit acc",
        "deposit no",
      ])

      const idxExpense = findIndexByKeywords(["expense", "expenses"])
      const idxWumt = findIndexByKeywords(["wumt", "w/m/t", "wmt"])

      // fallback: any column that looks like account
      const accountIndexes: number[] = []
      headerRow.forEach((h: string, i: number) => {
        if (h.includes("account") || h.includes("acct") || h.includes("account number")) {
          accountIndexes.push(i)
        }
      })

      const acctIdxWithdrawalFinal =
        idxWithdrawalAccount >= 0
          ? idxWithdrawalAccount
          : accountIndexes.length > 0
          ? accountIndexes[0]
          : -1

      const acctIdxDepositFinal =
        idxDepositAccount >= 0
          ? idxDepositAccount
          : accountIndexes.length > 1
          ? accountIndexes[1]
          : accountIndexes.length > 0
          ? accountIndexes[0]
          : -1

      // build rows
      const rows: TellerRow[] = []
      raw.slice(1).forEach((r: any[]) => {
        const withdrawalVal =
          idxWithdrawalAmount >= 0 ? safeNumber(r[idxWithdrawalAmount]) : 0
        const depositVal =
          idxDepositAmount >= 0 ? safeNumber(r[idxDepositAmount]) : 0
        const expenseVal = idxExpense >= 0 ? safeNumber(r[idxExpense]) : 0
        const wumtVal = idxWumt >= 0 ? safeNumber(r[idxWumt]) : 0

        const acctWithdrawal =
          acctIdxWithdrawalFinal >= 0 ? String(r[acctIdxWithdrawalFinal] || "").trim() : ""
        const acctDeposit =
          acctIdxDepositFinal >= 0 ? String(r[acctIdxDepositFinal] || "").trim() : acctWithdrawal

        // When tellerId is present, tag each row with that user (uploader)
        const userTag = tellerId || undefined

        if (withdrawalVal > 0) {
          rows.push({
            ACCOUNT_NO: acctWithdrawal || "",
            WITHDRAWAL: withdrawalVal,
            User: userTag,
            Matched: false,
          })
        }

        if (depositVal > 0) {
          rows.push({
            ACCOUNT_NO: acctDeposit || acctWithdrawal || "",
            DEPOSIT: depositVal,
            User: userTag,
            Matched: false,
          })
        }

        if (expenseVal > 0) {
          rows.push({
            ACCOUNT_NO: acctWithdrawal || acctDeposit || "",
            EXPENSE: expenseVal,
            User: userTag,
            Matched: false,
          })
        }

        if (wumtVal > 0) {
          rows.push({
            ACCOUNT_NO: acctWithdrawal || acctDeposit || "",
            WUMT: wumtVal,
            User: userTag,
            Matched: false,
          })
        }
      })

      // Set tellerRows and recalc
      setTellerRows(rows)
      recalcTotals()
      alert(`${rows.length} Teller Rows Loaded ✅`)
    } catch (err) {
      console.error(err)
      alert("Invalid Teller file or column mismatch")
    }
  }

  // ----------------------------
  // GL Parsing (unchanged logic but kept robust)
  // ----------------------------
  const parseGL = async (file: File) => {
    try {
      const data = await file.arrayBuffer()
      const wb = XLSX.read(data, { type: "array" })
      const sheet = wb.Sheets[wb.SheetNames[0]]
      const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" })
      const header = raw[0].map((h) => String(h || "").trim().toLowerCase())

      const rows: GLRow[] = raw.slice(1).map((r) => {
        const branch = String(r[header.findIndex((h) => h.includes("branch"))] || "")
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
          Matched: false,
        }
      })

      const validRows = rows.filter((r) => r.AccountNo && r.Type)
      setGlRows(validRows)
      setFilteredGl(validRows)
      recalcTotals()
      alert(`${validRows.length} GL Rows Loaded ✅`)
    } catch (err) {
      console.error(err)
      alert("Invalid GL file format or missing required columns.")
    }
  }

  // ----------------------------
  // GL Filter: simple user filter / reset
  // ----------------------------
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

  // ----------------------------
  // Save CAST rows (append)
  // ----------------------------
  const saveCastRows = () => {
    // tag cast rows with tellerId if present
    const tagged = castRows.map((r) => ({ ...r, User: tellerId || r.User, Matched: false }))
    setTellerRows((prev) => [...prev, ...tagged])
    recalcTotals()
    setOpenCast(false)
  }

  // ----------------------------
  // Export combined results (same as before)
  // ----------------------------
  const handleExport = () => {
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(tellerRows), "Teller")
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(glRows), "GL")
    XLSX.writeFile(wb, "TellerProofResult.xlsx")
  }

  // ----------------------------
  // Totals calculation
  // ----------------------------
  const recalcTotals = () => {
    const withdrawal = tellerRows.reduce((sum, r) => sum + safeNumber(r.WITHDRAWAL), 0)
    const deposit = tellerRows.reduce((sum, r) => sum + safeNumber(r.DEPOSIT), 0)
    const expense = tellerRows.reduce((sum, r) => sum + safeNumber(r.EXPENSE), 0)
    const wumt = tellerRows.reduce((sum, r) => sum + safeNumber(r.WUMT), 0)

    const glDebit = glRows
      .filter((r) => r.Type === "DEBIT")
      .reduce((sum, r) => sum + safeNumber(r.Amount), 0)
    const glCredit = glRows
      .filter((r) => r.Type === "CREDIT")
      .reduce((sum, r) => sum + safeNumber(r.Amount), 0)

    setTotals({
      withdrawal,
      deposit,
      expense,
      wumt,
      buy: buyAmount,
      sell: sellAmount,
      glDebit,
      glCredit,
    })
  }

  useEffect(() => recalcTotals(), [tellerRows, glRows, buyAmount, sellAmount])

  // ----------------------------
  // Reconciliation logic
  // ----------------------------
  // Single Reconcile button: matches GL Credit <-> Teller Deposit and GL Debit <-> Teller Withdrawal
  const reconcile = () => {
    // require tellerId
    if (!tellerId || tellerId.trim() === "") {
      alert("Teller ID is required for reconciliation.")
      return
    }

    // Work on copies (immutability)
    const glCopy = glRows.map((r) => ({ ...r, Matched: !!r.Matched }))
    const tellerCopy = tellerRows.map((r) => ({ ...r, Matched: !!r.Matched }))

    // Helper: find match in array (first unmatched) by account+amount
    const findAndMarkMatch = (
      sourceList: any[],
      targetList: any[],
      sourceFilterFn: (item: any) => boolean,
      targetFilterFn: (item: any) => boolean,
      sourceAmtKey: string,
      targetAmtKey: string,
      sourceAcctKey: string,
      targetAcctKey: string
    ) => {
      for (let i = 0; i < sourceList.length; i++) {
        const s = sourceList[i]
        if (!sourceFilterFn(s) || s.Matched) continue

        // search target
        for (let j = 0; j < targetList.length; j++) {
          const t = targetList[j]
          if (!targetFilterFn(t) || t.Matched) continue

          const sAmt = safeNumber((s as any)[sourceAmtKey])
          const tAmt = safeNumber((t as any)[targetAmtKey])
          const sAcct = String((s as any)[sourceAcctKey] || "").trim()
          const tAcct = String((t as any)[targetAcctKey] || "").trim()

          if (sAmt === tAmt && sAcct !== "" && sAcct === tAcct) {
            // mark both matched
            sourceList[i].Matched = true
            targetList[j].Matched = true
            return { sourceIndex: i, targetIndex: j }
          }
        }
      }
      return null
    }

    // For credit matching:
    // GL rows with Type === "CREDIT" and (optionally) User === tellerId (we restrict to the teller's GL user)
    // Match against tellerRows where DEPOSIT > 0 and User === tellerId (we tagged tellerRows on upload)
    const glCredits = glCopy.filter((r) => r.Type === "CREDIT")
    const tellerDeposits = tellerCopy.filter((r) => safeNumber(r.DEPOSIT) > 0)

    // credit matching loop
    let madeMatch = true
    while (madeMatch) {
      madeMatch = false
      const res = findAndMarkMatch(
        glCredits,
        tellerDeposits,
        (s) => !s.Matched && (s.User ? s.User === tellerId : true),
        (t) => !t.Matched && (t.User ? t.User === tellerId : true),
        "Amount",
        "DEPOSIT",
        "AccountNo",
        "ACCOUNT_NO"
      )
      if (res) madeMatch = true
    }

    // For debit matching:
    const glDebits = glCopy.filter((r) => r.Type === "DEBIT")
    const tellerWithdrawals = tellerCopy.filter((r) => safeNumber(r.WITHDRAWAL) > 0)

    madeMatch = true
    while (madeMatch) {
      madeMatch = false
      const res = findAndMarkMatch(
        glDebits,
        tellerWithdrawals,
        (s) => !s.Matched && (s.User ? s.User === tellerId : true),
        (t) => !t.Matched && (t.User ? t.User === tellerId : true),
        "Amount",
        "WITHDRAWAL",
        "AccountNo",
        "ACCOUNT_NO"
      )
      if (res) madeMatch = true
    }

    // Now propagate Matched flags back to main arrays (we matched on filtered lists, so mark originals)
    // We'll match by content: amount + account + type
    const markMatchesBack = () => {
      // mark GL
      const glNew = glCopy.map((g) => ({ ...g }))
      // mark Teller
      const tellerNew = tellerCopy.map((t) => ({ ...t }))

      setGlRows(glNew)
      setTellerRows(tellerNew)

      // compute matched totals
      const matchedDeposit = tellerNew
        .filter((r) => r.Matched && safeNumber(r.DEPOSIT) > 0)
        .reduce((s, r) => s + safeNumber(r.DEPOSIT), 0)

      const matchedWithdrawal = tellerNew
        .filter((r) => r.Matched && safeNumber(r.WITHDRAWAL) > 0)
        .reduce((s, r) => s + safeNumber(r.WITHDRAWAL), 0)

      setMatchedTotals({ matchedDeposit, matchedWithdrawal })
      setIsReconciled(true)
      recalcTotals()
    }

    markMatchesBack()
    alert("Reconciliation complete. Matched items flagged.")
  }

  // ----------------------------
  // Data switching logic (teller and gl filters)
  // ----------------------------
  const currentData =
    activeTab === "gl_debit"
      ? filteredGl.filter((r) => r.Type === "DEBIT")
      : activeTab === "gl_credit"
      ? filteredGl.filter((r) => r.Type === "CREDIT")
      : activeTab === "teller_debit"
      ? // show only withdrawal rows for teller_debit (and filter by tellerId if present)
        tellerRows.filter((r) => safeNumber(r.WITHDRAWAL) > 0 && (tellerId ? r.User === tellerId : true))
      : // teller_credit -> show only deposit rows (and filter by tellerId if present)
        tellerRows.filter((r) => safeNumber(r.DEPOSIT) > 0 && (tellerId ? r.User === tellerId : true))

  // Table column keys
  const currentKeys =
    activeTab === "teller_debit" || activeTab === "teller_credit"
      ? ["ACCOUNT_NO", activeTab === "teller_debit" ? "WITHDRAWAL" : "DEPOSIT", "EXPENSE", "WUMT", "User", "Matched"]
      : currentData.length > 0
      ? // ensure GL preview includes Matched column for clarity
        [...new Set([...Object.keys(currentData[0]), "Matched"])]
      : []

  // ----------------------------
  // Helper: filter GL/ teller by tellerId or supervisorId whenever set
  // - When tellerId provided, we tag previously-uploaded tellerRows with that tellerId if they lack it.
  // - Filtered GL is set to glRows filtered by User or Authorizer depending on inputs.
  // ----------------------------
  useEffect(() => {
    // tag existing tellerRows with tellerId if not already set (useful when uploading before entering tellerId)
    if (tellerId) {
      setTellerRows((prev) =>
        prev.map((r) => {
          if (!r.User) return { ...r, User: tellerId }
          return r
        })
      )
    }

    // Filter GL rows based on glFilterUser input or tellerId/supervisorId if provided
    if (glFilterUser && glFilterUser.trim() !== "") {
      setFilteredGl(glRows.filter((r) => r.User?.toLowerCase().includes(glFilterUser.toLowerCase())))
    } else if (supervisorId && supervisorId.trim() !== "") {
      // If supervisorId is provided, show GL rows authorized by this supervisor
      setFilteredGl(glRows.filter((r) => r.Authorizer === supervisorId))
    } else if (tellerId && tellerId.trim() !== "") {
      // If tellerId provided, prefer GL rows where User === tellerId
      setFilteredGl(glRows.filter((r) => r.User === tellerId))
    } else {
      setFilteredGl(glRows)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [glRows, glFilterUser, tellerId, supervisorId])

  // ----------------------------
  // Render
  // ----------------------------
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-800 p-6">
      <Card className="max-w-7xl mx-auto shadow-xl border-none rounded-2xl">
        <CardHeader className="bg-gradient-to-r from-blue-600 to-teal-500 text-white rounded-t-2xl p-6">
          <CardTitle className="text-2xl font-bold">Teller Proof Dashboard</CardTitle>
          <CardDescription className="text-blue-100">
            Upload Teller & GL files, reconcile teller transactions with GL.
          </CardDescription>
        </CardHeader>

        <CardContent className="p-6 space-y-6">
          {/* Upload + IDs Section */}
          <div className="grid md:grid-cols-4 gap-6">
            <div>
              <Label>Teller Upload</Label>
              <Input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={(e) => e.target.files?.[0] && parseTellerUpload(e.target.files[0])}
              />
              {tellerRows.length > 0 && (
                <Badge className="mt-2 bg-green-600">{tellerRows.length} Rows Loaded</Badge>
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
                <Badge className="mt-2 bg-blue-600">{glRows.length} GL Rows Loaded</Badge>
              )}
            </div>

            <div>
              <Label>Teller ID (required)</Label>
              <Input
                placeholder="Enter Teller ID"
                value={tellerId}
                onChange={(e) => setTellerId(e.target.value)}
              />
              <div className="text-xs text-gray-500 mt-1">Teller ID is required for reconciliation</div>
            </div>

            <div>
              <Label>Supervisor ID (optional)</Label>
              <Input
                placeholder="Supervisor ID"
                value={supervisorId}
                onChange={(e) => setSupervisorId(e.target.value)}
              />
            </div>
          </div>

          {/* Buy/Sell Inputs */}
          <div className="grid md:grid-cols-2 gap-4 mt-2">
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
          <div className="flex w-full mt-4">
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

          {/* GL Filter - visible when viewing GL tabs */}
          {activeTab.includes("gl") && (
            <div className="flex flex-wrap gap-3 items-center justify-center mt-4">
              <Input
                placeholder="Filter by GL User ID"
                value={glFilterUser}
                onChange={(e) => setGlFilterUser(e.target.value)}
                className="w-60"
              />
              <Button onClick={handleFilter}>Filter</Button>
              <Button
                variant="outline"
                onClick={() => {
                  setGlFilterUser("")
                  setFilteredGl(glRows)
                }}
              >
                Reset Filter
              </Button>
            </div>
          )}

          {/* Teller & Supervisor Name (display only) */}
          <div className="grid md:grid-cols-2 gap-4 mt-4">
            <div>
              <Label>Teller Name</Label>
              <Input
                placeholder="Enter Teller Name (optional)"
                value={tellerName}
                onChange={(e) => setTellerName(e.target.value)}
              />
            </div>
            <div>
              <Label>GL Filter (Authorizer / Supervisor)</Label>
              <Input
                placeholder="Use Supervisor ID or leave blank"
                value={supervisorId}
                onChange={(e) => setSupervisorId(e.target.value)}
              />
            </div>
          </div>

          {/* Reconcile Controls */}
          <div className="flex items-center gap-3 mt-4">
            <Button
              onClick={() => {
                // Must have tellerId to allow reconcile
                if (!tellerId || tellerId.trim() === "") {
                  alert("Please enter Teller ID before reconciliation.")
                  return
                }
                reconcile()
              }}
              className="bg-gradient-to-r from-green-600 to-teal-500 text-white"
            >
              Reconcile
            </Button>

            <Button
              variant="outline"
              onClick={() => {
                // Reset matched flags
                setGlRows((prev) => prev.map((r) => ({ ...r, Matched: false })))
                setTellerRows((prev) => prev.map((r) => ({ ...r, Matched: false })))
                setMatchedTotals({ matchedDeposit: 0, matchedWithdrawal: 0 })
                setIsReconciled(false)
                recalcTotals()
                alert("Reconciliation reset.")
              }}
            >
              Reset Reconciliation
            </Button>

            <div className="ml-auto flex gap-2 items-center">
              <Badge className="bg-indigo-600">Teller ID: {tellerId || "—"}</Badge>
              <Badge className="bg-slate-600">Supervisor: {supervisorId || "—"}</Badge>
              <Badge className="bg-emerald-600">
                Reconciled: {isReconciled ? "Yes" : "No"}
              </Badge>
            </div>
          </div>

          {/* Preview Table */}
          {currentData.length > 0 ? (
            <div className="overflow-auto border rounded-xl bg-white dark:bg-gray-700 shadow-inner mt-6 max-h-[50vh]">
              <Table>
                <TableHeader>
                  <TableRow>
                    {currentKeys.map((key) => (
                      <TableHead key={key}>{key}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {currentData.map((row, i) => (
                    <TableRow key={i}>
                      {currentKeys.map((k, j) => (
                        <TableCell key={j}>
                          {k === "Matched" ? (
                            (row as any).Matched ? (
                              <span className="text-green-600 font-semibold">✓</span>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )
                          ) : (
                            String((row as any)[k] ?? "")
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center text-sm text-gray-500 mt-6">No data to display.</div>
          )}

          {/* Totals Footer (includes matched totals & till balance) */}
          <Card className="bg-gray-100 dark:bg-gray-700 p-4 mt-6">
            {activeTab.includes("gl") ? (
              <div className="grid md:grid-cols-3 gap-4">
                <div>Total GL Debit: ₦{totals.glDebit.toLocaleString()}</div>
                <div>Total GL Credit: ₦{totals.glCredit.toLocaleString()}</div>
                <div>
                  Matched Withdrawals: ₦{matchedTotals.matchedWithdrawal.toLocaleString()} <br />
                  Matched Deposits: ₦{matchedTotals.matchedDeposit.toLocaleString()}
                </div>
              </div>
            ) : (
              <>
                <div className="grid md:grid-cols-3 gap-4">
                  <div>
                    Total Withdrawal: <strong>₦{totals.withdrawal.toLocaleString()}</strong>
                    {activeTab === "teller_debit" && (
                      <div className="text-sm text-gray-600 mt-1">Showing withdrawals only</div>
                    )}
                  </div>

                  <div>
                    Total Deposit: <strong>₦{totals.deposit.toLocaleString()}</strong>
                    {activeTab === "teller_credit" && (
                      <div className="text-sm text-gray-600 mt-1">Showing deposits only</div>
                    )}
                  </div>

                  <div>Total Expenses: ₦{totals.expense.toLocaleString()}</div>
                </div>

                <div className="grid md:grid-cols-3 gap-4 mt-2">
                  <div>Total WUMT: ₦{totals.wumt.toLocaleString()}</div>
                  <div>Buy: ₦{totals.buy.toLocaleString()}</div>
                  <div>Sell: ₦{totals.sell.toLocaleString()}</div>
                </div>

                {/* Matched + Till Balance */}
                <div className="mt-4">
                  <div>
                    Matched Deposit Total: ₦{matchedTotals.matchedDeposit.toLocaleString()}
                  </div>
                  <div>
                    Matched Withdrawal Total: ₦{matchedTotals.matchedWithdrawal.toLocaleString()}
                  </div>
                  <div className="mt-2 font-semibold">
                    Till Balance = (Buy + Matched Deposits) - (Sell + Matched Withdrawals)
                    <div className="mt-1 text-lg">
                      ₦
                      {(
                        buyAmount +
                        matchedTotals.matchedDeposit -
                        (sellAmount + matchedTotals.matchedWithdrawal)
                      ).toLocaleString()}
                    </div>
                  </div>
                </div>
              </>
            )}
          </Card>

          {/* CAST Popup */}
          <Dialog open={openCast} onOpenChange={setOpenCast}>
            <DialogContent className="w-full max-w-[98vw] h-[90vh] overflow-auto">
              <DialogHeader>
                <DialogTitle>CAST Input</DialogTitle>
              </DialogHeader>

              <div className="overflow-auto max-h-[75vh]">
                <Table className="w-full border">
                  <TableHeader>
                    <TableRow>
                      {[
                        "CHEQUES",
                        "WITHDRAWAL",
                        "ACCOUNT_NO",
                        "SAVINGS",
                        "ACCOUNT_NO2",
                        "DEPOSIT",
                        "ACCOUNT_NO3",
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
                        <TableCell>
                          <Input
                            type="number"
                            value={row.WITHDRAWAL || 0}
                            onChange={(e) => {
                              const v = safeNumber(e.target.value)
                              setCastRows((prev) => {
                                const copy = [...prev]
                                copy[i].WITHDRAWAL = v
                                recalcTotals()
                                return copy
                              })
                            }}
                          />
                        </TableCell>

                        <TableCell>{row.ACCOUNT_NO || ""}</TableCell>

                        <TableCell>
                          <Input
                            type="number"
                            value={row.DEPOSIT || 0}
                            onChange={(e) => {
                              const v = safeNumber(e.target.value)
                              setCastRows((prev) => {
                                const copy = [...prev]
                                copy[i].DEPOSIT = v
                                recalcTotals()
                                return copy
                              })
                            }}
                          />
                        </TableCell>

                        <TableCell>{row.ACCOUNT_NO || ""}</TableCell>

                        <TableCell>
                          <Input
                            type="number"
                            value={row.EXPENSE || 0}
                            onChange={(e) => {
                              const v = safeNumber(e.target.value)
                              setCastRows((prev) => {
                                const copy = [...prev]
                                copy[i].EXPENSE = v
                                recalcTotals()
                                return copy
                              })
                            }}
                          />
                        </TableCell>

                        <TableCell>
                          <Input
                            type="number"
                            value={row.WUMT || 0}
                            onChange={(e) => {
                              const v = safeNumber(e.target.value)
                              setCastRows((prev) => {
                                const copy = [...prev]
                                copy[i].WUMT = v
                                recalcTotals()
                                return copy
                              })
                            }}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
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

          {/* Actions */}
          <div className="flex justify-center gap-4 mt-8 flex-wrap">
            <Button
              onClick={handleExport}
              className="bg-gradient-to-r from-blue-600 to-teal-500 text-white"
            >
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
