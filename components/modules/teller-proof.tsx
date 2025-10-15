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
import { BranchInfo } from "@/components/branch-info"
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
  // UI checks:
  bvnChecked?: boolean
  signatureChecked?: boolean
  alterationsSigned?: boolean
  analysisDone?: boolean
  // matched flag
  matched?: boolean
}

type GLRow = {
  Date?: string
  Branch?: string
  AccountNo?: string
  Type?: string // D / C
  Currency?: string
  Amount?: number
  User?: string
  Authorizer?: string
  Reference?: string
  raw?: any
  matched?: boolean
}

export function TellerProof() {
  // Branch meta
  const [branchCode, setBranchCode] = useState("")
  const [branchName, setBranchName] = useState("")
  const [country, setCountry] = useState("")

  // files
  const [tellerFile, setTellerFile] = useState<File | null>(null)
  const [glFile, setGlFile] = useState<File | null>(null)

  // UI
  const [activeTab, setActiveTab] = useState<"debit" | "credit">("debit")
  const [showResults, setShowResults] = useState(false)

  // data
  const [rows, setRows] = useState<TellerRow[]>([])
  const [glRows, setGlRows] = useState<GLRow[]>([])

  // inputs & summary
  const [openingBalance, setOpeningBalance] = useState<number | "">("")
  const [buyAmount, setBuyAmount] = useState<number | "">("")
  const [remainingFigure, setRemainingFigure] = useState<number | "">("")
  const [callOverOfficer, setCallOverOfficer] = useState("")

  // Helpers - robust number parse (digit-by-digit approach)
  const safeNumber = (v: any) => {
    if (v === null || v === undefined || v === "") return 0
    // remove commas, currency symbols, spaces
    const s = String(v).replace(/[,₦€$]/g, "").trim()
    const n = Number(s)
    return Number.isFinite(n) ? n : 0
  }

  // find sheet by name (case-insensitive) or fallback to second sheet for "cast"
  const findCastSheet = (wb: XLSX.WorkBook) => {
    const names = wb.SheetNames
    // try find exact 'cast' or 'cast ' with spaces
    const found = names.find((n) => n.toLowerCase().trim() === "cast")
    if (found) return wb.Sheets[found]
    // fallback: use second sheet (index 1) if exists
    if (names.length >= 2) return wb.Sheets[names[1]]
    // otherwise first
    return wb.Sheets[names[0]]
  }

  // Read teller file and parse Sheet2 ('cast')
  const parseTellerFile = async (file: File) => {
    try {
      const data = await file.arrayBuffer()
      const wb = XLSX.read(data, { type: "array", cellDates: true })
      const sheet = findCastSheet(wb)
      // convert to JSON rows, raw - preserve headers
      // use header:1 to inspect header rows
      const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" })
      // find header row by detecting any of expected column names (case-insensitive)
      const headersIndex = raw.findIndex((r: any[]) =>
        r.some((c) =>
          String(c || "")
            .toLowerCase()
            .replace(/\s+/g, "")
            .includes("cheques")
        ) && r.some((c) => String(c || "").toLowerCase().replace(/\s+/g, "").includes("account"))
      )
      const headerRow = headersIndex >= 0 ? raw[headersIndex].map((h) => String(h || "").trim()) : raw[0].map((h) => String(h || "").trim())
      // map rows after header
      const dataRows = raw.slice(headersIndex >= 0 ? headersIndex + 1 : 1)
      const parsed: TellerRow[] = dataRows
        .filter((r: any[]) => r.some((c) => String(c).trim() !== "")) // skip empty rows
        .map((r: any[], i: number) => {
          const rowObj: any = {}
          headerRow.forEach((h: string, idx: number) => {
            const key = h.replace(/\s+/g, "_").toUpperCase()
            rowObj[key] = r[idx]
          })
          // map to our known fields forgivingly
          const mapped: TellerRow = {
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
          return mapped
        })
      setRows(parsed)
      // if any opening balance present, set the opening input
      const foundOpening = parsed.find((p) => p.OPENING_BALANCE && p.OPENING_BALANCE !== 0)
      if (foundOpening) setOpeningBalance(foundOpening.OPENING_BALANCE || "")
    } catch (err) {
      console.error("Failed to parse teller file", err)
      alert("Failed to parse teller file. Ensure it's a valid Excel/CSV file and sheet2 called 'cast' exists.")
    }
  }

  // Parse GL file - robust header detection and mapping
  const parseGlFile = async (file: File) => {
    try {
      const data = await file.arrayBuffer()
      const wb = XLSX.read(data, { type: "array", cellDates: true })
      // try to find a sheet with GL-like headers
      let sheet: XLSX.WorkSheet | null = null
      for (const name of wb.SheetNames) {
        const s = wb.Sheets[name]
        const preview = XLSX.utils.sheet_to_json(s, { header: 1, range: 0, defval: "" }) as any[][]
        const headRow = preview.find((r) =>
          r &&
          r.some((c: any) => String(c || "").toLowerCase().includes("account")) &&
          r.some((c: any) => String(c || "").toLowerCase().includes("transaction"))
        )
        if (headRow) {
          sheet = s
          break
        }
      }
      // fallback: pick first sheet
      if (!sheet) sheet = wb.Sheets[wb.SheetNames[0]]

      const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" }) as any[][]
      // detect header row: look for 'ACCOUNT NUMBER' or 'TRANSACTION DATE' tokens
      const headerIdx = raw.findIndex((r) =>
        r.some((c: any) => String(c || "").toLowerCase().includes("account")) &&
        r.some((c: any) => String(c || "").toLowerCase().includes("transaction"))
      )
      const headerRow = (headerIdx >= 0 ? raw[headerIdx] : raw[0]).map((h: any) => String(h || "").trim())
      const dataRows = raw.slice(headerIdx >= 0 ? headerIdx + 1 : 1)

      // build mapping by checking header titles similarity
      const headerMap: Record<string, number> = {}
      headerRow.forEach((h: string, idx: number) => {
        const key = h.toLowerCase().replace(/\s+/g, "")
        headerMap[key] = idx
      })

      const findIndexByPossible = (candidates: string[]) => {
        for (const c of candidates) {
          const k = c.toLowerCase().replace(/\s+/g, "")
          if (headerMap[k] !== undefined) return headerMap[k]
        }
        return -1
      }

      const idxTransactionDate = findIndexByPossible(["transactiondate", "transactiondate ", "transaction_date", "transaction date"])
      const idxBranch = findIndexByPossible(["branchname", "branch", "branchname "])
      const idxAccount = findIndexByPossible(["accountnumber", "accountnumber ", "accountno", "account"])
      const idxDrCr = findIndexByPossible(["dr/cr", "drcr", "drcr "])
      const idxCurrency = findIndexByPossible(["currency"])
      const idxLcy = findIndexByPossible(["lcya amount", "lcyaamount", "lcamount", "lcyamount", "lcyamount " , "lcy_amount", "lcy"])
      // try other names for amount
      const idxAmount = idxLcy >= 0 ? idxLcy : findIndexByPossible(["amount", "lcya amount", "fc y amount", "lc y amount"])

      const idxUser = findIndexByPossible(["userid", "user id", "user"])
      const idxAuthorizer = findIndexByPossible(["authoriserid", "authoriser id", "authorizer", "authoriser"])
      const idxRef = findIndexByPossible(["externalreferenceno", "externalreferenceno ", "external reference no", "reference", "externalreference"])

      const parsedGl: GLRow[] = dataRows
        .filter((r: any[]) => r && r.some((c) => String(c).trim() !== ""))
        .map((r: any[]) => {
          const acc = idxAccount >= 0 ? String(r[idxAccount] || "").trim() : ""
          const amt = idxAmount >= 0 ? safeNumber(r[idxAmount]) : safeNumber(r[idxLcy])
          const drcr = idxDrCr >= 0 ? String(r[idxDrCr] || "").trim() : ""
          const date = idxTransactionDate >= 0 ? formatExcelDate(r[idxTransactionDate]) : ""
          const br = idxBranch >= 0 ? String(r[idxBranch] || "").trim() : ""
          const user = idxUser >= 0 ? String(r[idxUser] || "").trim() : ""
          const authorizer = idxAuthorizer >= 0 ? String(r[idxAuthorizer] || "").trim() : ""
          const ref = idxRef >= 0 ? String(r[idxRef] || "").trim() : ""
          return {
            Date: date,
            Branch: br,
            AccountNo: acc,
            Type: drcr,
            Currency: idxCurrency >= 0 ? String(r[idxCurrency] || "") : undefined,
            Amount: amt,
            User: user,
            Authorizer: authorizer,
            Reference: ref,
            raw: r,
            matched: false,
          } as GLRow
        })

      setGlRows(parsedGl)
    } catch (err) {
      console.error("Failed to parse GL file", err)
      alert("Failed to parse GL file. Ensure it's a valid Excel/CSV file.")
    }
  }

  // helper to format excel dates where necessary
  const formatExcelDate = (v: any) => {
    if (!v) return ""
    // if Date object
    if (v instanceof Date) {
      return v.toLocaleDateString()
    }
    // if number (excel serial)
    if (typeof v === "number") {
      const d = XLSX.SSF.parse_date_code(v)
      if (d) return `${d.d}/${d.m}/${d.y}`
    }
    // fallback string
    return String(v)
  }

  // file upload handlers
  const handleTellerUpload = (file: File) => {
    setTellerFile(file)
    parseTellerFile(file)
  }
  const handleGlUpload = (file: File) => {
    setGlFile(file)
    parseGlFile(file)
  }

  // update single row
  const updateRow = (id: string, patch: Partial<TellerRow>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  }

  // Totals
  const totals = useMemo(() => {
    const sum = (arr: number[] | (number | undefined | null)[]) =>
      arr.reduce((acc, v) => acc + safeNumber(v), 0)

    const debitCols = rows.map((r) => safeNumber(r.SAVINGS_WITHDR))
    const expenseCols = rows.map((r) => safeNumber(r.EXPENSE))
    const toVaultCols = rows.map((r) => safeNumber(r.TO_VAULT))
    const totalDebit = sum(debitCols) + sum(expenseCols) + sum(toVaultCols)

    const creditCashCols = rows.map((r) => safeNumber(r.CASH_DEP) + safeNumber(r.CASH_DEP_2) + safeNumber(r.FROM_VAULT) + safeNumber(r.WUMT))
    const totalCredit = sum(creditCashCols)

    return { totalDebit, totalCredit }
  }, [rows])

  // computed till balance
  const tillBalance = useMemo(() => {
    const open = safeNumber(openingBalance)
    const buy = safeNumber(buyAmount)
    const credits = safeNumber(totals.totalCredit)
    const debits = safeNumber(totals.totalDebit)
    return open + credits - debits - buy
  }, [openingBalance, buyAmount, totals])

  const difference = useMemo(() => {
    const counted = safeNumber(remainingFigure)
    return Number((tillBalance || 0) - counted)
  }, [tillBalance, remainingFigure])

  const balanced = difference === 0

  // Matching logic: mark rows matched if GL has same account no & amount (and same DR/CR if present)
  useEffect(() => {
    if (rows.length === 0 || glRows.length === 0) return
    // map gl rows by account# + amount -> allow multiple matches; mark first-match
    const glIndex: { key: string; used: boolean; idx: number }[] = []
    glRows.forEach((g, i) => {
      const key = `${(g.AccountNo || "").trim()}|${safeNumber(g.Amount)}|${(g.Type || "").trim()}`
      glIndex.push({ key, used: false, idx: i })
    })
    const newRows = rows.map((r) => {
      const rAcc = (r.ACCOUNT_NO || "").trim()
      const rAmt = safeNumber(
        // teller side amount could be in SAVINGS_WITHDR, TO_VAULT, EXPENSE, or CHEQUES depending on row type — try match any non-zero
        r.SAVINGS_WITHDR || r.TO_VAULT || r.EXPENSE || r.CASH_DEP || r.CASH_DEP_2 || r.FROM_VAULT || r.WUMT || r.CHEQUES
      )
      // attempt exact match
      const candidate = glIndex.find((g) => !g.used && g.key.startsWith(`${rAcc}|${rAmt}`))
      if (candidate) {
        candidate.used = true
        // mark glRows candidate matched (mutate copy)
        setGlRows((prev) => prev.map((x, i) => (i === candidate.idx ? { ...x, matched: true } : x)))
        return { ...r, matched: true }
      }
      return { ...r, matched: false }
    })
    setRows(newRows)
  }, [glRows, rows.length]) // run when glRows change and when rows present

  // Export combined CSV (Dummy Submit)
  const handleExportToCSV = () => {
    const header = [
      "id",
      "ACCOUNT_NO",
      "SAVINGS_WITHDR",
      "TO_VAULT",
      "EXPENSE",
      "CASH_DEP",
      "CASH_DEP_2",
      "FROM_VAULT",
      "WUMT",
      "CHEQUES",
      "bvnChecked",
      "signatureChecked",
      "alterationsSigned",
      "analysisDone",
      "matched",
    ]
    const csvRows = [header.join(",")]
    rows.forEach((r) => {
      const line = [
        r.id,
        `"${r.ACCOUNT_NO || ""}"`,
        safeNumber(r.SAVINGS_WITHDR),
        safeNumber(r.TO_VAULT),
        safeNumber(r.EXPENSE),
        safeNumber(r.CASH_DEP),
        safeNumber(r.CASH_DEP_2),
        safeNumber(r.FROM_VAULT),
        safeNumber(r.WUMT),
        safeNumber(r.CHEQUES),
        r.bvnChecked ? "TRUE" : "FALSE",
        r.signatureChecked ? "TRUE" : "FALSE",
        r.alterationsSigned ? "TRUE" : "FALSE",
        r.analysisDone ? "TRUE" : "FALSE",
        r.matched ? "MATCHED" : "UNMATCHED",
      ]
      csvRows.push(line.join(","))
    })

    // summary
    csvRows.push("")
    csvRows.push(`Branch Code,${branchCode}`)
    csvRows.push(`Branch Name,${branchName}`)
    csvRows.push(`Country,${country}`)
    csvRows.push(`Opening Balance,${safeNumber(openingBalance)}`)
    csvRows.push(`Total Credit,${safeNumber(totals.totalCredit)}`)
    csvRows.push(`Total Debit,${safeNumber(totals.totalDebit)}`)
    csvRows.push(`Buy Amount,${safeNumber(buyAmount)}`)
    csvRows.push(`Computed Till Balance,${safeNumber(tillBalance)}`)
    csvRows.push(`Remaining Figure,${safeNumber(remainingFigure)}`)
    csvRows.push(`Difference,${difference}`)
    csvRows.push(`Balanced,${balanced ? "TRUE" : "FALSE"}`)
    csvRows.push(`Call Over Officer,${callOverOfficer}`)

    const blob = new Blob([csvRows.join("\n")], { type: "text/csv" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    const date = new Date().toISOString().split("T")[0]
    a.download = `teller-proof-${branchCode || "branch"}-${date}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const handleRunProof = () => {
    setShowResults(true)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Teller Proof — Callover</h1>
        <p className="text-sm text-muted-foreground">
          Upload teller "cast" sheet (Sheet2) and GL file. Matching uses Account No + Amount. Blue → Teal theme.
        </p>
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
        {/* Teller Upload */}
        <Card className="border-primary/20 bg-card/50 backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-card-foreground">
              <FileSpreadsheet className="h-5 w-5" />
              Teller Upload (Sheet2: cast)
            </CardTitle>
            <CardDescription>Upload the teller's sheet — will read sheet named 'cast' or sheet index 1</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-sky-300 bg-gradient-to-r from-blue-50 to-teal-50 p-6 text-center">
              <Upload className="mb-3 h-12 w-12 text-sky-600" />
              <Label htmlFor="teller-file" className="cursor-pointer">
                <span className="text-sm font-medium text-sky-600 hover:underline">Click to upload teller file (cast sheet)</span>
                <input id="teller-file" type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => e.target.files?.[0] && handleTellerUpload(e.target.files[0])} />
              </Label>
              <p className="mt-2 text-xs text-muted-foreground">Expected columns: CHEQUES, ACCOUNT NO, SAVINGS WITHDR., ACCOUNT NO2, TO VAULT, EXPENSE, WUMT, OPENING BALANCE, CASH DEP, CASH DEP 2, FROM VAULT</p>
            </div>

            {tellerFile && (
              <div className="flex items-center gap-2 rounded-lg border border-border bg-background p-3">
                <FileSpreadsheet className="h-5 w-5 text-sky-600" />
                <span className="text-sm font-medium text-foreground">{tellerFile.name}</span>
                <Badge variant="secondary" className="ml-auto">Loaded</Badge>
              </div>
            )}
          </CardContent>
        </Card>

        {/* GL Upload */}
        <Card className="border-primary/20 bg-card/50 backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-card-foreground">
              <FileSpreadsheet className="h-5 w-5" />
              GL Upload (raw)
            </CardTitle>
            <CardDescription>Upload GL export (we will auto-clean and pick required columns)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-teal-300 bg-gradient-to-r from-teal-50 to-blue-50 p-6 text-center">
              <Upload className="mb-3 h-12 w-12 text-teal-600" />
              <Label htmlFor="gl-file" className="cursor-pointer">
                <span className="text-sm font-medium text-teal-600 hover:underline">Click to upload GL file</span>
                <input id="gl-file" type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => e.target.files?.[0] && handleGlUpload(e.target.files[0])} />
              </Label>
              <p className="mt-2 text-xs text-muted-foreground">We extract: TRANSACTION DATE, BRANCH NAME, ACCOUNT NUMBER, DR/CR, CURRENCY, LCY AMOUNT, USER ID, AUTHORISER ID, EXTERNAL REFERENCE</p>
            </div>

            {glFile && (
              <div className="flex items-center gap-2 rounded-lg border border-border bg-background p-3">
                <FileSpreadsheet className="h-5 w-5 text-teal-600" />
                <span className="text-sm font-medium text-foreground">{glFile.name}</span>
                <Badge variant="secondary" className="ml-auto">Loaded</Badge>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Transaction View */}
      <Card className="border-primary/20 bg-card/50 backdrop-blur">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-card-foreground">Transaction View</CardTitle>
            <div className="flex items-center gap-2">
              <button onClick={() => setActiveTab("debit")} className={`px-3 py-1 rounded-md text-sm font-medium transition-all ${activeTab === "debit" ? "bg-gradient-to-r from-sky-600 to-teal-400 text-white shadow-lg" : "bg-transparent text-muted-foreground hover:bg-muted/10"}`}>
                Debit
              </button>
              <button onClick={() => setActiveTab("credit")} className={`px-3 py-1 rounded-md text-sm font-medium transition-all ${activeTab === "credit" ? "bg-gradient-to-r from-sky-600 to-teal-400 text-white shadow-lg" : "bg-transparent text-muted-foreground hover:bg-muted/10"}`}>
                Credit
              </button>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <div className="overflow-x-auto rounded-lg border border-border bg-background">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date/Tag</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead>Narration</TableHead>
                  {activeTab === "debit" ? (
                    <>
                      <TableHead className="text-right">Savings Withdr. (₦)</TableHead>
                      <TableHead className="text-right">To Vault (₦)</TableHead>
                      <TableHead className="text-right">Expense (₦)</TableHead>
                    </>
                  ) : (
                    <>
                      <TableHead className="text-right">Cash Dep (₦)</TableHead>
                      <TableHead className="text-right">Cash Dep 2 (₦)</TableHead>
                      <TableHead className="text-right">From Vault (₦)</TableHead>
                      <TableHead className="text-right">WUMT (₦)</TableHead>
                    </>
                  )}
                  <TableHead>CHEQUES</TableHead>
                  <TableHead>Checks</TableHead>
                  <TableHead>Match</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={12} className="py-6 text-center text-sm text-muted-foreground">
                      No transactions yet. Upload teller file (cast sheet) to populate rows.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-sm">{r.Column1 || "-"}</TableCell>
                      <TableCell className="font-mono">{r.ACCOUNT_NO || "-"}</TableCell>
                      <TableCell>{r.Column1 || "-"}</TableCell>

                      {activeTab === "debit" ? (
                        <>
                          <TableCell className="text-right font-mono">₦{safeNumber(r.SAVINGS_WITHDR).toLocaleString()}</TableCell>
                          <TableCell className="text-right font-mono">₦{safeNumber(r.TO_VAULT).toLocaleString()}</TableCell>
                          <TableCell className="text-right font-mono">₦{safeNumber(r.EXPENSE).toLocaleString()}</TableCell>
                        </>
                      ) : (
                        <>
                          <TableCell className="text-right font-mono">₦{safeNumber(r.CASH_DEP).toLocaleString()}</TableCell>
                          <TableCell className="text-right font-mono">₦{safeNumber(r.CASH_DEP_2).toLocaleString()}</TableCell>
                          <TableCell className="text-right font-mono">₦{safeNumber(r.FROM_VAULT).toLocaleString()}</TableCell>
                          <TableCell className="text-right font-mono">₦{safeNumber(r.WUMT).toLocaleString()}</TableCell>
                        </>
                      )}

                      <TableCell className="font-mono">₦{safeNumber(r.CHEQUES).toLocaleString()}</TableCell>

                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <label className="inline-flex items-center space-x-2">
                            <input type="checkbox" checked={!!r.bvnChecked} onChange={(e) => updateRow(r.id, { bvnChecked: e.target.checked })} className="form-checkbox h-4 w-4 rounded border" />
                            <span className="text-xs">BVN</span>
                          </label>
                          <label className="inline-flex items-center space-x-2">
                            <input type="checkbox" checked={!!r.signatureChecked} onChange={(e) => updateRow(r.id, { signatureChecked: e.target.checked })} className="form-checkbox h-4 w-4 rounded border" />
                            <span className="text-xs">Sig</span>
                          </label>
                          <label className="inline-flex items-center space-x-2">
                            <input type="checkbox" checked={!!r.alterationsSigned} onChange={(e) => updateRow(r.id, { alterationsSigned: e.target.checked })} className="form-checkbox h-4 w-4 rounded border" />
                            <span className="text-xs">Alt</span>
                          </label>
                          {activeTab === "debit" && (
                            <label className="inline-flex items-center space-x-2">
                              <input type="checkbox" checked={!!r.analysisDone} onChange={(e) => updateRow(r.id, { analysisDone: e.target.checked })} className="form-checkbox h-4 w-4 rounded border" />
                              <span className="text-xs">Analysis</span>
                            </label>
                          )}
                        </div>
                      </TableCell>

                      <TableCell>
                        {r.matched ? (
                          <Badge className="text-xs">Matched</Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs">Unmatched</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Summary inputs */}
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Opening Balance (₦)</Label>
              <Input type="number" value={openingBalance === "" ? "" : String(openingBalance)} onChange={(e) => setOpeningBalance(e.target.value === "" ? "" : Number(e.target.value))} placeholder="Enter opening balance" />
            </div>
            <div className="space-y-2">
              <Label>Buy Amount (₦)</Label>
              <Input type="number" value={buyAmount === "" ? "" : String(buyAmount)} onChange={(e) => setBuyAmount(e.target.value === "" ? "" : Number(e.target.value))} placeholder="Enter buy amount" />
            </div>
            <div className="space-y-2">
              <Label>Remaining Figure (Counted) (₦)</Label>
              <Input type="number" value={remainingFigure === "" ? "" : String(remainingFigure)} onChange={(e) => setRemainingFigure(e.target.value === "" ? "" : Number(e.target.value))} placeholder="Enter counted till" />
            </div>
          </div>

          {/* computed totals */}
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-lg border border-border bg-background p-3">
              <p className="text-xs text-muted-foreground">Total Debit</p>
              <p className="text-lg font-bold">₦{safeNumber(totals.totalDebit).toLocaleString()}</p>
            </div>
            <div className="rounded-lg border border-border bg-background p-3">
              <p className="text-xs text-muted-foreground">Total Credit</p>
              <p className="text-lg font-bold">₦{safeNumber(totals.totalCredit).toLocaleString()}</p>
            </div>
            <div className="rounded-lg border border-border bg-background p-3">
              <p className="text-xs text-muted-foreground">Computed Till Balance</p>
              <p className={`text-lg font-bold ${tillBalance >= 0 ? "text-chart-3" : "text-destructive"}`}>₦{safeNumber(tillBalance).toLocaleString()}</p>
            </div>
          </div>

          {/* balance and actions */}
          <div className="mt-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {balanced ? (
                <Badge className="flex items-center gap-2">✅ Balanced</Badge>
              ) : (
                <Badge variant="destructive" className="flex items-center gap-2">❌ Not Balanced</Badge>
              )}
              <div className="text-sm text-muted-foreground">Difference: ₦{Number(difference).toLocaleString()}</div>
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto">
              <Input placeholder="Call Over Officer Name" value={callOverOfficer} onChange={(e) => setCallOverOfficer(e.target.value)} className="max-w-xs" />
              <Button onClick={handleRunProof} disabled={rows.length === 0} className="bg-gradient-to-r from-sky-600 to-teal-400">
                <CheckCircle2 className="mr-2 h-4 w-4" /> Run Proof
              </Button>

              <Button onClick={handleExportToCSV} variant="outline" className="ml-2">
                <Download className="mr-2 h-4 w-4" /> Dummy Submit
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results Dialog */}
      <Dialog open={showResults} onOpenChange={setShowResults}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {balanced ? (
                <>
                  <CheckCircle2 className="h-5 w-5 text-chart-3" /> Proof Complete — Balanced
                </>
              ) : (
                <>
                  <AlertTriangle className="h-5 w-5 text-destructive" /> Proof Complete — Discrepancies Found
                </>
              )}
            </DialogTitle>
            <DialogDescription>Review computed totals and difference</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-border bg-background p-3">
                <p className="text-xs text-muted-foreground">Total Debit</p>
                <p className="text-lg font-bold">₦{safeNumber(totals.totalDebit).toLocaleString()}</p>
              </div>
              <div className="rounded-lg border border-border bg-background p-3">
                <p className="text-xs text-muted-foreground">Total Credit</p>
                <p className="text-lg font-bold">₦{safeNumber(totals.totalCredit).toLocaleString()}</p>
              </div>
              <div className="rounded-lg border border-border bg-background p-3">
                <p className="text-xs text-muted-foreground">Difference</p>
                <p className={`text-lg font-bold ${difference === 0 ? "text-chart-3" : "text-destructive"}`}>₦{Number(difference).toLocaleString()}</p>
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleExportToCSV} variant="outline" className="flex-1 bg-transparent">
                <Download className="mr-2 h-4 w-4" /> Export All (CSV)
              </Button>
              <Button onClick={() => setShowResults(false)} className="flex-1">Close</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default TellerProof
