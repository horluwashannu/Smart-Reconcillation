"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { AlertTriangle, CheckCircle2, Upload, FileSpreadsheet, Download } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { BranchInfo } from "@/components/branch-info"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableHeader, TableRow, TableHead, TableCell } from "@/components/ui/table"

interface Transaction {
  amount: number
  date: string
  narration: string
}

export function TellerProof() {
  const [transactionFile, setTransactionFile] = useState<File | null>(null)
  const [systemFile, setSystemFile] = useState<File | null>(null)
  const [showResults, setShowResults] = useState(false)
  const [proofResults, setProofResults] = useState<any>(null)
  const [branchCode, setBranchCode] = useState("")
  const [branchName, setBranchName] = useState("")
  const [country, setCountry] = useState("")

  // Manual transaction entry state
  const [manualTransactions, setManualTransactions] = useState<any[]>([])
  const [newTransaction, setNewTransaction] = useState({
    date: "",
    narration: "",
    amount: "",
    accountNumber: "",
    transactionType: "withdrawal",
    paymentMethod: "slip",
  })
  const [filterType, setFilterType] = useState<string>("all")

  const handleFileUpload = (file: File, type: "transaction" | "system") => {
    console.log(`Uploading ${type} file:`, file.name)
    if (type === "transaction") {
      setTransactionFile(file)
    } else {
      setSystemFile(file)
    }
  }

  const handleRunProof = () => {
    // Simulated proof results
    setProofResults({
      transactionTotal: 1250000,
      systemTotal: 1248500,
      difference: -1500,
      matched: 45,
      unmatched: 3,
      errors: [
        { amount: -500, date: "2024-04-15", narration: "Cash withdrawal mismatch" },
        { amount: -1000, date: "2024-04-15", narration: "Deposit not recorded in system" },
      ],
    })
    setShowResults(true)
  }

  const handleExportToExcel = () => {
    // TODO: Implement actual Excel export using a library like xlsx
    console.log("Exporting results to Excel...")
    // For now, create a simple CSV download
    const csvContent = [
      ["Teller Proof Results"],
      ["Branch Code", branchCode],
      ["Branch Name", branchName],
      ["Country", country],
      [""],
      ["Transaction Total", proofResults.transactionTotal],
      ["System Total", proofResults.systemTotal],
      ["Difference", proofResults.difference],
      [""],
      ["Errors and Discrepancies"],
      ["Amount", "Date", "Narration"],
      ...proofResults.errors.map((e: any) => [e.amount, e.date, e.narration]),
    ]
      .map((row) => row.join(","))
      .join("\n")

    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `teller-proof-${branchCode}-${new Date().toISOString().split("T")[0]}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const handleAddTransaction = () => {
    if (newTransaction.date && newTransaction.narration && newTransaction.amount) {
      setManualTransactions([
        ...manualTransactions,
        {
          ...newTransaction,
          id: `TXN-${Date.now()}`,
          amount: Number.parseFloat(newTransaction.amount),
        },
      ])
      // Reset form
      setNewTransaction({
        date: "",
        narration: "",
        amount: "",
        accountNumber: "",
        transactionType: "withdrawal",
        paymentMethod: "slip",
      })
    }
  }

  const filteredTransactions = manualTransactions.filter((txn) => {
    if (filterType === "all") return true
    if (filterType === "cheque") return txn.paymentMethod === "cheque"
    if (filterType === "slip") return txn.paymentMethod === "slip"
    return txn.transactionType === filterType
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Teller Proof</h1>
        <p className="text-muted-foreground">Upload transaction and system files to check for errors and shortages</p>
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
        <Card className="border-primary/20 bg-card/50 backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-card-foreground">
              <FileSpreadsheet className="h-5 w-5" />
              Transaction Data
            </CardTitle>
            <CardDescription>Upload Excel file with Amount, Date, and Narration</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-primary/30 bg-primary/5 p-8 text-center">
              <Upload className="mb-4 h-12 w-12 text-primary" />
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
              <p className="mt-2 text-xs text-muted-foreground">Excel or CSV format</p>
            </div>
            {transactionFile && (
              <div className="flex items-center gap-2 rounded-lg border border-border bg-background p-3">
                <FileSpreadsheet className="h-5 w-5 text-primary" />
                <span className="text-sm font-medium text-foreground">{transactionFile.name}</span>
                <Badge variant="secondary" className="ml-auto">
                  Uploaded
                </Badge>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-primary/20 bg-card/50 backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-card-foreground">
              <FileSpreadsheet className="h-5 w-5" />
              System/GL Figure
            </CardTitle>
            <CardDescription>Upload Excel file with Amount, Date, and Narration</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-accent/30 bg-accent/5 p-8 text-center">
              <Upload className="mb-4 h-12 w-12 text-accent" />
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
              <p className="mt-2 text-xs text-muted-foreground">Excel or CSV format</p>
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

      {/* Manual Transaction Entry */}
      <Card className="border-primary/20 bg-card/50 backdrop-blur">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-card-foreground">
            <FileSpreadsheet className="h-5 w-5" />
            Manual Transaction Entry
          </CardTitle>
          <CardDescription>Cast your proof of transactions manually</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="txn-date">Date</Label>
              <Input
                id="txn-date"
                type="date"
                value={newTransaction.date}
                onChange={(e) => setNewTransaction({ ...newTransaction, date: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="txn-amount">Amount (₦)</Label>
              <Input
                id="txn-amount"
                type="number"
                placeholder="Enter amount"
                value={newTransaction.amount}
                onChange={(e) => setNewTransaction({ ...newTransaction, amount: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="txn-account">Account Number</Label>
              <Input
                id="txn-account"
                type="text"
                placeholder="Enter account number"
                value={newTransaction.accountNumber}
                onChange={(e) => setNewTransaction({ ...newTransaction, accountNumber: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="txn-narration">Narration</Label>
              <Input
                id="txn-narration"
                type="text"
                placeholder="Enter narration"
                value={newTransaction.narration}
                onChange={(e) => setNewTransaction({ ...newTransaction, narration: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="txn-type">Transaction Type</Label>
              <select
                id="txn-type"
                value={newTransaction.transactionType}
                onChange={(e) => setNewTransaction({ ...newTransaction, transactionType: e.target.value })}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
              >
                <option value="withdrawal">Withdrawal</option>
                <option value="transfer">Transfer</option>
                <option value="deposit">Deposit</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="txn-payment">Payment Method</Label>
              <select
                id="txn-payment"
                value={newTransaction.paymentMethod}
                onChange={(e) => setNewTransaction({ ...newTransaction, paymentMethod: e.target.value })}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
              >
                <option value="slip">Slip</option>
                <option value="cheque">Cheque</option>
              </select>
            </div>
          </div>
          <Button onClick={handleAddTransaction} className="w-full bg-gradient-to-r from-primary to-accent">
            Add Transaction
          </Button>
        </CardContent>
      </Card>

      {/* Display Manual Transactions */}
      {manualTransactions.length > 0 && (
        <Card className="border-primary/20 bg-card/50 backdrop-blur">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-card-foreground">Transaction List</CardTitle>
              <div className="flex gap-2">
                <Button
                  variant={filterType === "all" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilterType("all")}
                  className={filterType !== "all" ? "bg-transparent" : ""}
                >
                  All ({manualTransactions.length})
                </Button>
                <Button
                  variant={filterType === "withdrawal" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilterType("withdrawal")}
                  className={filterType !== "withdrawal" ? "bg-transparent" : ""}
                >
                  Withdrawals
                </Button>
                <Button
                  variant={filterType === "cheque" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilterType("cheque")}
                  className={filterType !== "cheque" ? "bg-transparent" : ""}
                >
                  Cheque
                </Button>
                <Button
                  variant={filterType === "slip" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilterType("slip")}
                  className={filterType !== "slip" ? "bg-transparent" : ""}
                >
                  Slip
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Account Number</TableHead>
                    <TableHead>Narration</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Method</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTransactions.map((txn) => (
                    <TableRow key={txn.id}>
                      <TableCell className="font-mono text-sm">{txn.date}</TableCell>
                      <TableCell className="font-mono">{txn.accountNumber}</TableCell>
                      <TableCell>{txn.narration}</TableCell>
                      <TableCell className="text-right font-mono">₦{txn.amount.toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{txn.transactionType}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={txn.paymentMethod === "cheque" ? "default" : "secondary"}>
                          {txn.paymentMethod}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-primary/20 bg-card/50 backdrop-blur">
        <CardContent className="pt-6">
          <Button
            onClick={handleRunProof}
            disabled={!transactionFile || !systemFile}
            className="w-full bg-gradient-to-r from-primary to-accent"
            size="lg"
          >
            <CheckCircle2 className="mr-2 h-5 w-5" />
            Run Teller Proof
          </Button>
        </CardContent>
      </Card>

      <Dialog open={showResults} onOpenChange={setShowResults}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground">
              {proofResults?.difference === 0 ? (
                <>
                  <CheckCircle2 className="h-5 w-5 text-chart-3" />
                  Proof Complete - Balanced
                </>
              ) : (
                <>
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                  Proof Complete - Discrepancies Found
                </>
              )}
            </DialogTitle>
            <DialogDescription>Review the comparison results below</DialogDescription>
          </DialogHeader>

          {proofResults && (
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-lg border border-border bg-background p-3">
                  <p className="text-xs text-muted-foreground">Transaction Total</p>
                  <p className="text-lg font-bold text-foreground">₦{proofResults.transactionTotal.toLocaleString()}</p>
                </div>
                <div className="rounded-lg border border-border bg-background p-3">
                  <p className="text-xs text-muted-foreground">System Total</p>
                  <p className="text-lg font-bold text-foreground">₦{proofResults.systemTotal.toLocaleString()}</p>
                </div>
                <div className="rounded-lg border border-border bg-background p-3">
                  <p className="text-xs text-muted-foreground">Difference</p>
                  <p
                    className={`text-lg font-bold ${proofResults.difference >= 0 ? "text-chart-3" : "text-destructive"}`}
                  >
                    ₦{Math.abs(proofResults.difference).toLocaleString()}
                  </p>
                </div>
              </div>

              {proofResults.errors.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-semibold text-foreground">Errors & Discrepancies</h4>
                  {proofResults.errors.map((error: any, index: number) => (
                    <div
                      key={index}
                      className="flex items-start gap-3 rounded-lg border border-destructive/20 bg-destructive/5 p-3"
                    >
                      <AlertTriangle className="h-5 w-5 shrink-0 text-destructive" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-semibold text-destructive">
                            ₦{Math.abs(error.amount).toLocaleString()}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {error.date}
                          </Badge>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">{error.narration}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-2">
                <Button onClick={handleExportToExcel} variant="outline" className="flex-1 bg-transparent">
                  <Download className="mr-2 h-4 w-4" />
                  Export to Excel
                </Button>
                <Button onClick={() => setShowResults(false)} className="flex-1">
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
