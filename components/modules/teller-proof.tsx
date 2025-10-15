// /components/TellerProof.tsx
"use client"

import { useEffect, useMemo, useState } from "react"
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
}

export function TellerProof() {
  // branch info
  const [branchCode, setBranchCode] = useState("")
  const [branchName, setBranchName] = useState("")
  const [country, setCountry] = useState("")

  // files
  const [transactionFile, setTransactionFile] = useState<File | null>(null)
  const [systemFile, setSystemFile] = useState<File | null>(null)

  // UI
  const [activeTab, setActiveTab] = useState<"debit" | "credit">("debit")
  const [showResults, setShowResults] = useState(false)

  // parsed (or mocked) teller rows
  const [rows, setRows] = useState<TellerRow[]>([])

  // session totals and inputs
  const [openingBalance, setOpeningBalance] = useState<number | "">("")
  const [buyAmount, setBuyAmount] = useState<number | "">("")
  const [remainingFigure, setRemainingFigure] = useState<number | "">("")
  const [callOverOfficer, setCallOverOfficer] = useState("")

  // mock parse function: generate sample rows based on the column list you provided
  const mockParseTellerFile = (file: File) => {
    // Create a few sample rows (you'll replace this with real parser)
    const sample: TellerRow[] = [
      {
        id: `R-${Date.now()}-1`,
        CHEQUES: 0,
        ACCOUNT_NO: "0123456789",
        SAVINGS_WITHDR: 50000,
        ACCOUNT_NO2: "N/A",
        TO_VAULT: 0,
        EXPENSE: 2000,
        WUMT: 0,
        Column1: "Cash Withdrawal",
        OPENING_BALANCE: 0,
        CASH_DEP: 0,
        CASH_DEP_2: 0,
        FROM_VAULT: 0,
        bvnChecked: false,
        signatureChecked: false,
        alterationsSigned: false,
        analysisDone: false,
      },
      {
        id: `R-${Date.now()}-2`,
        CHEQUES: 15000,
        ACCOUNT_NO: "0212345678",
        SAVINGS_WITHDR: 0,
        ACCOUNT_NO2: "N/A",
        TO_VAULT: 10000,
        EXPENSE: 0,
        WUMT: 0,
        Column1: "To Vault",
        OPENING_BALANCE: 0,
        CASH_DEP: 0,
        CASH_DEP_2: 0,
        FROM_VAULT: 5000,
        bvnChecked: false,
        signatureChecked: false,
        alterationsSigned: false,
        analysisDone: false,
      },
      {
        id: `R-${Date.now()}-3`,
        CHEQUES: 0,
        ACCOUNT_NO: "0312345678",
        SAVINGS_WITHDR: 0,
        ACCOUNT_NO2: "N/A",
        TO_VAULT: 0,
        EXPENSE: 0,
        WUMT: 20000,
        Column1: "WUMT Inflow",
        OPENING_BALANCE: 0,
        CASH_DEP: 100000,
        CASH_DEP_2: 0,
        FROM_VAULT: 0,
        bvnChecked: false,
        signatureChecked: false,
        alterationsSigned: false,
        analysisDone: false,
      },
    ]

    // set openingBalance if any row includes OPENING_BALANCE non-zero (mock behavior)
    const foundOpening = sample.find((r) => r.OPENING_BALANCE && r.OPENING_BALANCE > 0)
    if (foundOpening) setOpeningBalance(foundOpening.OPENING_BALANCE || "")
    setRows(sample)
  }

  const handleFileUpload = (file: File, type: "transaction" | "system") => {
    if (type === "transaction") {
      setTransactionFile(file)
      // Mock parse - replace with xlsx reading later when you upload the real file
      mockParseTellerFile(file)
    } else {
      setSystemFile(file)
    }
  }

  // helpers to update row checks/values
  const updateRow = (id: string, patch: Partial<TellerRow>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  }

  // Totals (careful arithmetic)
  const totals = useMemo(() => {
    // Digit-by-digit safe sums using Number(...) coercion
    const sum = (arr: number[] | (number | undefined | null)[]) =>
      arr.reduce((acc, v) => {
        const n = Number(v || 0)
        return acc + n
      }, 0)

    const debitCols = rows.map((r) => Number(r.SAVINGS_WITHDR || 0))
    const expenseCols = rows.map((r) => Number(r.EXPENSE || 0))
    const toVaultCols = rows.map((r) => Number(r.TO_VAULT || 0))
    // DO NOT treat CHEQUES as cash deposit (per your note) - we keep it visible but exclude from cash balances
    const creditCashCols = rows.map((r) => Number(r.CASH_DEP || 0) + Number(r.CASH_DEP_2 || 0) + Number(r.FROM_VAULT || 0) + Number(r.WUMT || 0))

    const totalDebit = sum(debitCols) + sum(expenseCols) + sum(toVaultCols)
    const totalCredit = sum(creditCashCols)

    return {
      totalDebit,
      totalCredit,
    }
  }, [rows])

  // Compute till balance: Opening + Credits - Debits - Buy
  const tillBalance = useMemo(() => {
    const open = Number(openingBalance || 0)
    const buy = Number(buyAmount || 0)
    const credits = Number(totals.totalCredit || 0)
    const debits = Number(totals.totalDebit || 0)
    const val = open + credits - debits - buy
    return val
  }, [openingBalance, buyAmount, totals])

  // Difference between counted remaining figure and computed tillBalance
  const difference = useMemo(() => {
    const counted = Number(remainingFigure || 0)
    const diff = Number((tillBalance || 0) - counted)
    return diff
  }, [tillBalance, remainingFigure])

  const balanced = difference === 0

  // Export to CSV (dummy submit)
  const handleExportToCSV = () => {
    // build CSV rows
    const header = [
      "id",
      "CHEQUES",
      "ACCOUNT_NO",
      "SAVINGS_WITHDR",
      "ACCOUNT_NO2",
      "TO_VAULT",
      "EXPENSE",
      "WUMT",
      "Column1",
      "CASH_DEP",
      "CASH_DEP_2",
      "FROM_VAULT",
      "bvnChecked",
      "signatureChecked",
      "alterationsSigned",
      "analysisDone",
    ]

    const csvRows = [header.join(",")]

    rows.forEach((r) => {
      const line = [
        r.id,
        r.CHEQUES || 0,
        `"${r.ACCOUNT_NO || ""}"`,
        r.SAVINGS_WITHDR || 0,
        `"${r.ACCOUNT_NO2 || ""}"`,
        r.TO_VAULT || 0,
        r.EXPENSE || 0,
        r.WUMT || 0,
        `"${(r.Column1 || "").replace(/"/g, '""')}"`,
        r.CASH_DEP || 0,
        r.CASH_DEP_2 || 0,
        r.FROM_VAULT || 0,
        r.bvnChecked ? "TRUE" : "FALSE",
        r.signatureChecked ? "TRUE" : "FALSE",
        r.alterationsSigned ? "TRUE" : "FALSE",
        r.analysisDone ? "TRUE" : "FALSE",
      ]
      csvRows.push(line.join(","))
    })

    // add summary block
    csvRows.push("")
    csvRows.push(`Branch Code,${branchCode}`)
    csvRows.push(`Branch Name,${branchName}`)
    csvRows.push(`Country,${country}`)
    csvRows.push("")
    csvRows.push(`Opening Balance,${openingBalance || 0}`)
    csvRows.push(`Total Credit,${totals.totalCredit}`)
    csvRows.push(`Total Debit,${totals.totalDebit}`)
    csvRows.push(`Buy Amount,${buyAmount || 0}`)
    csvRows.push(`Computed Till Balance,${tillBalance}`)
    csvRows.push(`Remaining Figure (Counted),${remainingFigure || 0}`)
    csvRows.push(`Difference,${difference}`)
    csvRows.push(`Balanced,${balanced ? "TRUE" : "FALSE"}`)
    csvRows.push(`Call Over Officer,${callOverOfficer}`)

    const blob = new Blob([csvRows.join("\n")], { type: "text/csv" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    const date = new Date().toISOString().split("T")[0]
    a.download = `teller-proof-export-${branchCode || "branch"}-${date}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  // Run proof: show results dialog (we reuse computed totals)
  const handleRunProof = () => {
    setShowResults(true)
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
          Teller Proof — Callover
        </h1>
        <p className="text-sm text-muted-foreground">
          Upload teller sheet, complete checks, enter buy and remaining figure, then confirm.
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
        {/* Transaction Upload */}
        <Card className="border-primary/20 bg-card/50 backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-card-foreground">
              <FileSpreadsheet className="h-5 w-5" />
              Teller Upload (Teller's own)
            </CardTitle>
            <CardDescription>Upload the teller's sheet — for now we mock the parser</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-primary/30 bg-gradient-to-r from-primary/5 to-accent/5 p-6 text-center">
              <Upload className="mb-3 h-12 w-12 text-primary" />
              <Label htmlFor="transaction-file" className="cursor-pointer">
                <span className="text-sm font-medium text-primary hover:underline">
                  Click to upload transaction file
                </span>
                <input
                  id="transaction-file"
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], "transaction")}
                />
              </Label>
              <p className="mt-2 text-xs text-muted-foreground">Columns expected: CHEQUES, ACCOUNT NO, SAVINGS WITHDR., ACCOUNT NO2, TO VAULT, EXPENSE, WUMT, Column1, OPENING BALANCE, CASH DEP, CASH DEP 2, FROM VAULT</p>
            </div>

            {transactionFile && (
              <div className="flex items-center gap-2 rounded-lg border border-border bg-background p-3">
                <FileSpreadsheet className="h-5 w-5 text-primary" />
                <span className="text-sm font-medium text-foreground">{transactionFile.name}</span>
                <Badge variant="secondary" className="ml-auto">
                  Parsed (mock)
                </Badge>
              </div>
            )}
          </CardContent>
        </Card>

        {/* GL Upload placeholder (left for later) */}
        <Card className="border-primary/20 bg-card/50 backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-card-foreground">
              <FileSpreadsheet className="h-5 w-5" />
              System / GL Upload
            </CardTitle>
            <CardDescription>GL upload (we will integrate this after testing your GL format)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-accent/30 bg-accent/5 p-6 text-center">
              <Upload className="mb-3 h-12 w-12 text-accent" />
              <Label htmlFor="system-file" className="cursor-pointer">
                <span className="text-sm font-medium text-accent hover:underline">Click to upload system file</span>
                <input
                  id="system-file"
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], "system")}
                />
              </Label>
              <p className="mt-2 text-xs text-muted-foreground">Leave this for the next step</p>
            </div>

            {systemFile && (
              <div className="flex items-center gap-2 rounded-lg border border-border bg-background p-3">
                <FileSpreadsheet className="h-5 w-5 text-accent" />
                <span className="text-sm font-medium text-foreground">{systemFile.name}</span>
                <Badge variant="secondary" className="ml-auto">
                  Uploaded
                </Badge>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Transaction View + Tabs */}
      <Card className="border-primary/20 bg-card/50 backdrop-blur">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-card-foreground">Transaction View</CardTitle>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveTab("debit")}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-all ${
                  activeTab === "debit"
                    ? "bg-gradient-to-r from-primary to-accent text-white shadow-md"
                    : "bg-transparent text-muted-foreground hover:bg-muted/10"
                }`}
              >
                Debit
              </button>
              <button
                onClick={() => setActiveTab("credit")}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-all ${
                  activeTab === "credit"
                    ? "bg-gradient-to-r from-primary to-accent text-white shadow-md"
                    : "bg-transparent text-muted-foreground hover:bg-muted/10"
                }`}
              >
                Credit
              </button>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {/* Table */}
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="py-6 text-center text-sm text-muted-foreground">
                      No transactions yet. Upload teller file to populate rows (mock parser used).
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
                          <TableCell className="text-right font-mono">₦{Number(r.SAVINGS_WITHDR || 0).toLocaleString()}</TableCell>
                          <TableCell className="text-right font-mono">₦{Number(r.TO_VAULT || 0).toLocaleString()}</TableCell>
                          <TableCell className="text-right font-mono">₦{Number(r.EXPENSE || 0).toLocaleString()}</TableCell>
                        </>
                      ) : (
                        <>
                          <TableCell className="text-right font-mono">₦{Number(r.CASH_DEP || 0).toLocaleString()}</TableCell>
                          <TableCell className="text-right font-mono">₦{Number(r.CASH_DEP_2 || 0).toLocaleString()}</TableCell>
                          <TableCell className="text-right font-mono">₦{Number(r.FROM_VAULT || 0).toLocaleString()}</TableCell>
                          <TableCell className="text-right font-mono">₦{Number(r.WUMT || 0).toLocaleString()}</TableCell>
                        </>
                      )}

                      <TableCell className="font-mono">₦{Number(r.CHEQUES || 0).toLocaleString()}</TableCell>

                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <label className="inline-flex items-center space-x-2">
                            <input
                              type="checkbox"
                              checked={!!r.bvnChecked}
                              onChange={(e) => updateRow(r.id, { bvnChecked: e.target.checked })}
                              className="form-checkbox h-4 w-4 rounded border"
                            />
                            <span className="text-xs">BVN</span>
                          </label>
                          <label className="inline-flex items-center space-x-2">
                            <input
                              type="checkbox"
                              checked={!!r.signatureChecked}
                              onChange={(e) => updateRow(r.id, { signatureChecked: e.target.checked })}
                              className="form-checkbox h-4 w-4 rounded border"
                            />
                            <span className="text-xs">Sig</span>
                          </label>
                          <label className="inline-flex items-center space-x-2">
                            <input
                              type="checkbox"
                              checked={!!r.alterationsSigned}
                              onChange={(e) => updateRow(r.id, { alterationsSigned: e.target.checked })}
                              className="form-checkbox h-4 w-4 rounded border"
                            />
                            <span className="text-xs">Alt</span>
                          </label>

                          {/* Analysis Done only visible on Debit */}
                          {activeTab === "debit" && (
                            <label className="inline-flex items-center space-x-2">
                              <input
                                type="checkbox"
                                checked={!!r.analysisDone}
                                onChange={(e) => updateRow(r.id, { analysisDone: e.target.checked })}
                                className="form-checkbox h-4 w-4 rounded border"
                              />
                              <span className="text-xs">Analysis</span>
                            </label>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Summary Row / Inputs */}
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Opening Balance (₦)</Label>
              <Input
                type="number"
                value={openingBalance === "" ? "" : String(openingBalance)}
                onChange={(e) => setOpeningBalance(e.target.value === "" ? "" : Number(e.target.value))}
                placeholder="Enter opening balance"
              />
            </div>

            <div className="space-y-2">
              <Label>Buy Amount (₦)</Label>
              <Input
                type="number"
                value={buyAmount === "" ? "" : String(buyAmount)}
                onChange={(e) => setBuyAmount(e.target.value === "" ? "" : Number(e.target.value))}
                placeholder="Enter buy amount"
              />
            </div>

            <div className="space-y-2">
              <Label>Remaining Figure (Counted) (₦)</Label>
              <Input
                type="number"
                value={remainingFigure === "" ? "" : String(remainingFigure)}
                onChange={(e) => setRemainingFigure(e.target.value === "" ? "" : Number(e.target.value))}
                placeholder="Enter counted till"
              />
            </div>
          </div>

          {/* computed totals */}
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-lg border border-border bg-background p-3">
              <p className="text-xs text-muted-foreground">Total Debit</p>
              <p className="text-lg font-bold">₦{Number(totals.totalDebit).toLocaleString()}</p>
            </div>
            <div className="rounded-lg border border-border bg-background p-3">
              <p className="text-xs text-muted-foreground">Total Credit</p>
              <p className="text-lg font-bold">₦{Number(totals.totalCredit).toLocaleString()}</p>
            </div>
            <div className="rounded-lg border border-border bg-background p-3">
              <p className="text-xs text-muted-foreground">Computed Till Balance</p>
              <p className={`text-lg font-bold ${tillBalance >= 0 ? "text-chart-3" : "text-destructive"}`}>
                ₦{Number(tillBalance).toLocaleString()}
              </p>
            </div>
          </div>

          {/* Balance state */}
          <div className="mt-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {balanced ? (
                <Badge className="flex items-center gap-2">✅ Balanced</Badge>
              ) : (
                <Badge variant="destructive" className="flex items-center gap-2">
                  ❌ Not Balanced
                </Badge>
              )}
              <div className="text-sm text-muted-foreground">
                Difference: ₦{Number(difference).toLocaleString()}
              </div>
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto">
              <Input
                placeholder="Call Over Officer Name"
                value={callOverOfficer}
                onChange={(e) => setCallOverOfficer(e.target.value)}
                className="max-w-xs"
              />
              <Button
                onClick={handleRunProof}
                disabled={rows.length === 0}
                className="bg-gradient-to-r from-primary to-accent"
              >
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Run Proof
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
                  <CheckCircle2 className="h-5 w-5 text-chart-3" />
                  Proof Complete — Balanced
                </>
              ) : (
                <>
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                  Proof Complete — Discrepancies Found
                </>
              )}
            </DialogTitle>
            <DialogDescription>Review computed totals and difference</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-border bg-background p-3">
                <p className="text-xs text-muted-foreground">Total Debit</p>
                <p className="text-lg font-bold">₦{Number(totals.totalDebit).toLocaleString()}</p>
              </div>
              <div className="rounded-lg border border-border bg-background p-3">
                <p className="text-xs text-muted-foreground">Total Credit</p>
                <p className="text-lg font-bold">₦{Number(totals.totalCredit).toLocaleString()}</p>
              </div>
              <div className="rounded-lg border border-border bg-background p-3">
                <p className="text-xs text-muted-foreground">Difference</p>
                <p className={`text-lg font-bold ${difference === 0 ? "text-chart-3" : "text-destructive"}`}>
                  ₦{Number(difference).toLocaleString()}
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleExportToCSV} variant="outline" className="flex-1 bg-transparent">
                <Download className="mr-2 h-4 w-4" />
                Export All (CSV)
              </Button>
              <Button onClick={() => setShowResults(false)} className="flex-1">
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default TellerProof
