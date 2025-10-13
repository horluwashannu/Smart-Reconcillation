"use client"

import { useState, useEffect } from "react"
import { Upload, FileSpreadsheet, Download, CheckCircle, AlertCircle, X, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { BranchInfo } from "@/components/branch-info"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import * as XLSX from "xlsx"
import { getSupabaseClient } from "@/lib/supabase"

interface TransactionRow {
  Date: string
  Narration: string
  OriginalAmount: string
  SignedAmount: number
  IsNegative: boolean
  First15: string
  Last15: string
  HelperKey1: string
  HelperKey2: string
  side?: "debit" | "credit"
  status?: "matched" | "pending"
}

interface ReconciliationSummary {
  matchedCount: number
  pendingDebitCount: number
  pendingCreditCount: number
}

interface SmartReconciliationProps {
  userId: string | null
}

export function SmartReconciliation({ userId }: SmartReconciliationProps) {
  const [previousFile, setPreviousFile] = useState<File | null>(null)
  const [currentFile, setCurrentFile] = useState<File | null>(null)
  const [uploadedPrev, setUploadedPrev] = useState<TransactionRow[]>([])
  const [uploadedCurr, setUploadedCurr] = useState<TransactionRow[]>([])
  const [resultRows, setResultRows] = useState<TransactionRow[]>([])
  const [showResults, setShowResults] = useState(false)
  const [summary, setSummary] = useState<ReconciliationSummary>({
    matchedCount: 0,
    pendingDebitCount: 0,
    pendingCreditCount: 0,
  })
  const [branchCode, setBranchCode] = useState("")
  const [branchName, setBranchName] = useState("")
  const [region, setRegion] = useState("")
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set())

  useEffect(() => {
    const savedPrev = localStorage.getItem("recon_prev")
    const savedCurr = localStorage.getItem("recon_curr")
    if (savedPrev) setUploadedPrev(JSON.parse(savedPrev))
    if (savedCurr) setUploadedCurr(JSON.parse(savedCurr))
  }, [])

  const getField = (row: any, names: string[]): any => {
    for (const n of names) {
      if (row.hasOwnProperty(n)) return row[n]
    }
    const keys = Object.keys(row)
    for (const k of keys) {
      if (names.some((n) => k.trim().toLowerCase() === n.trim().toLowerCase())) return row[k]
    }
    return undefined
  }

  const parseExcelAmount = (val: any): { original: string; value: number; isNegative: boolean } => {
    if (val === undefined || val === null) return { original: "", value: 0, isNegative: false }
    const original = String(val).trim()
    let s = original.replace(/[^0-9\-$$$$.,]/g, "").replace(/\s+/g, "")
    let isNegative = false
    if (s.startsWith("(") && s.endsWith(")")) {
      isNegative = true
      s = "-" + s.slice(1, -1)
    }
    s = s.replace(/,/g, "")
    const num = Number.parseFloat(s)
    return { original, value: isNaN(num) ? 0 : num, isNegative: isNegative || num < 0 }
  }

  const normalizeRow = (raw: any): TransactionRow => {
    const date = getField(raw, ["Date", "DATE", "date"]) || ""
    const narration = getField(raw, ["Narration", "NARRATION", "narration", "Narrative"]) || ""
    const amountRaw = getField(raw, ["Amount", "AMOUNT", "amount", "Amount (NGN)"]) || ""
    const parsed = parseExcelAmount(amountRaw)
    const cleanNarration = String(narration).replace(/\s+/g, " ").trim()
    const first15 = cleanNarration.substring(0, 15).toUpperCase().trim()
    const last15 = cleanNarration.slice(-15).toUpperCase().trim()
    const helper1 = `${first15}_${parsed.value}`
    const helper2 = `${last15}_${parsed.value}`
    return {
      Date: date,
      Narration: narration,
      OriginalAmount: parsed.original,
      SignedAmount: parsed.value,
      IsNegative: parsed.isNegative,
      First15: first15,
      Last15: last15,
      HelperKey1: helper1,
      HelperKey2: helper2,
    }
  }

  const handleFileUpload = async (file: File, fileType: "previous" | "current") => {
    console.log(`[v0] Uploading ${fileType} file:`, file.name)

    if (fileType === "previous") {
      setPreviousFile(file)
    } else {
      setCurrentFile(file)
    }

    try {
      const arrayBuffer = await file.arrayBuffer()
      const workbook = XLSX.read(arrayBuffer, { type: "array" })
      const sheet = workbook.SheetNames[0]
      const raw = XLSX.utils.sheet_to_json(workbook.Sheets[sheet], { defval: "" })
      const cleaned = raw.map(normalizeRow)

      if (fileType === "previous") {
        setUploadedPrev(cleaned)
        localStorage.setItem("recon_prev", JSON.stringify(cleaned))
      } else {
        setUploadedCurr(cleaned)
        localStorage.setItem("recon_curr", JSON.stringify(cleaned))
      }

      alert(`${fileType === "previous" ? "Previous" : "Current"} file uploaded successfully!`)
    } catch (error: any) {
      console.error("[v0] Error parsing Excel file:", error)

      if (error.message && error.message.includes("Encrypted")) {
        alert(
          "❌ This Excel file is password-protected or encrypted.\n\n" +
            "Please:\n" +
            "1. Open the file in Excel\n" +
            "2. Save As → Excel Workbook (.xlsx)\n" +
            "3. Make sure 'Save with password' is NOT checked\n" +
            "4. Upload the new unencrypted file",
        )
      } else {
        alert(
          "❌ Error parsing Excel file.\n\n" +
            "Please ensure:\n" +
            "• The file is a valid Excel file (.xlsx or .xls)\n" +
            "• The file is not password-protected\n" +
            "• The file has columns named: Date, Narration, Amount",
        )
      }
    }
  }

  const runReconciliation = async () => {
    console.log("[v0] Running reconciliation...")

    if (!uploadedPrev.length || !uploadedCurr.length) {
      alert("Please upload both Previous and Current Excel files first!")
      return
    }

    const debits = uploadedPrev.map((r) => ({ ...r, side: "debit" as const }))
    const credits = uploadedCurr.map((r) => ({ ...r, side: "credit" as const }))

    // Index credits by both helperkeys for fast lookup
    const creditIndex = new Map<string, number[]>()
    credits.forEach((c, idx) => {
      if (!creditIndex.has(c.HelperKey1)) creditIndex.set(c.HelperKey1, [])
      if (!creditIndex.has(c.HelperKey2)) creditIndex.set(c.HelperKey2, [])
      creditIndex.get(c.HelperKey1)!.push(idx)
      creditIndex.get(c.HelperKey2)!.push(idx)
    })

    const matchedPairs: { debit: TransactionRow; credit: TransactionRow }[] = []
    const pendingDebits: TransactionRow[] = []
    const usedCreditIdx = new Set<number>()

    // Match debits to credits
    for (const d of debits) {
      let foundIdx: number | null = null
      const keysToTry = [d.HelperKey1, d.HelperKey2]

      for (const k of keysToTry) {
        const arr = creditIndex.get(k)
        if (arr && arr.length) {
          const idx = arr.find((i) => !usedCreditIdx.has(i))
          if (idx !== undefined) {
            foundIdx = idx
            break
          }
        }
      }

      if (foundIdx !== null) {
        usedCreditIdx.add(foundIdx)
        matchedPairs.push({ debit: d, credit: credits[foundIdx] })
      } else {
        pendingDebits.push(d)
      }
    }

    const pendingCredits = credits.filter((_, i) => !usedCreditIdx.has(i))

    const results: TransactionRow[] = [
      ...matchedPairs.flatMap((p) => [
        { ...p.debit, status: "matched" as const, side: "debit" as const },
        { ...p.credit, status: "matched" as const, side: "credit" as const },
      ]),
      ...pendingDebits.map((r) => ({ ...r, status: "pending" as const, side: "debit" as const })),
      ...pendingCredits.map((r) => ({ ...r, status: "pending" as const, side: "credit" as const })),
    ]

    setResultRows(results)
    setShowResults(true)

    const matchedCount = matchedPairs.length
    const pendingDebitCount = pendingDebits.length
    const pendingCreditCount = pendingCredits.length
    setSummary({ matchedCount, pendingDebitCount, pendingCreditCount })

    try {
      const supabase = getSupabaseClient()
      if (supabase && userId) {
        // Insert in chunks to avoid payload limits
        const CHUNK = 200
        for (let i = 0; i < results.length; i += CHUNK) {
          const chunk = results.slice(i, i + CHUNK)
          const { error } = await supabase.from("reconciliation_results").insert(
            chunk.map((row) => ({
              date: row.Date,
              narration: row.Narration,
              original_amount: row.OriginalAmount,
              signed_amount: row.SignedAmount,
              is_negative: row.IsNegative,
              first15: row.First15,
              last15: row.Last15,
              helper_key1: row.HelperKey1,
              helper_key2: row.HelperKey2,
              side: row.side,
              status: row.status,
              branch_code: branchCode || "DEFAULT_BRANCH",
              user_id: userId,
            })),
          )
          if (error) {
            console.error("[v0] Supabase insert error", error)
            throw error
          }
        }
        console.log("[v0] Saved to Supabase")
      } else {
        localStorage.setItem("recon_results_temp", JSON.stringify(results))
        console.log("[v0] Saved to localStorage")
      }
    } catch (err) {
      console.error("[v0] Save failed - falling back to localStorage", err)
      localStorage.setItem("recon_results_temp", JSON.stringify(results))
    }

    alert(
      `Reconciliation Complete!\nMatched Pairs: ${matchedCount}\nPending Debits: ${pendingDebitCount}\nPending Credits: ${pendingCreditCount}`,
    )
  }

  const exportSelected = () => {
    const selected = Array.from(selectedRows)
      .map((idx) => resultRows[idx])
      .filter(Boolean)
    if (selected.length === 0) {
      alert("Please select rows to export")
      return
    }
    const ws = XLSX.utils.json_to_sheet(selected)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Selected")
    XLSX.writeFile(wb, "pending_selection.xlsx")
  }

  const adminClearTemp = async () => {
    if (!confirm("Are you sure you want to delete all temporary reconciliation results?")) return
    try {
      const supabase = getSupabaseClient()
      if (supabase) {
        await supabase.from("reconciliation_results").delete().neq("id", 0)
      }
      localStorage.removeItem("recon_results_temp")
      setResultRows([])
      setShowResults(false)
      alert("Temporary results cleared")
    } catch (err) {
      console.error("[v0] Error clearing temp results", err)
    }
  }

  const clearAll = () => {
    setPreviousFile(null)
    setCurrentFile(null)
    setUploadedPrev([])
    setUploadedCurr([])
    setResultRows([])
    setShowResults(false)
    setSummary({
      matchedCount: 0,
      pendingDebitCount: 0,
      pendingCreditCount: 0,
    })
    setSelectedRows(new Set())
    localStorage.removeItem("recon_prev")
    localStorage.removeItem("recon_curr")
    console.log("[v0] Cleared all uploaded files and results")
  }

  const pendingDebits = resultRows.filter((r) => r.status === "pending" && r.side === "debit")
  const pendingCredits = resultRows.filter((r) => r.status === "pending" && r.side === "credit")

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Smart Reconciliation</h1>
        <p className="text-muted-foreground">Upload and reconcile transaction files with intelligent matching</p>
      </div>

      <BranchInfo
        branchCode={branchCode}
        branchName={branchName}
        region={region}
        onBranchCodeChange={setBranchCode}
        onBranchNameChange={setBranchName}
        onRegionChange={setRegion}
      />

      {/* File Upload Section */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-card-foreground">
              <FileSpreadsheet className="h-5 w-5 text-primary" />
              Previous Pending Reconciliation
            </CardTitle>
            <CardDescription>Upload previous pending reconciliation Excel file</CardDescription>
          </CardHeader>
          <CardContent>
            <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted/50 p-8 transition-colors hover:bg-muted">
              <Upload className="mb-2 h-8 w-8 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">
                {previousFile ? previousFile.name : "Click to upload or drag and drop"}
              </span>
              <span className="mt-1 text-xs text-muted-foreground">Excel files (.xlsx, .xls)</span>
              <input
                type="file"
                className="hidden"
                accept=".xlsx,.xls"
                onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], "previous")}
              />
            </label>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-card-foreground">
              <FileSpreadsheet className="h-5 w-5 text-primary" />
              Current Month Transactions
            </CardTitle>
            <CardDescription>Upload current month transactions Excel file</CardDescription>
          </CardHeader>
          <CardContent>
            <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted/50 p-8 transition-colors hover:bg-muted">
              <Upload className="mb-2 h-8 w-8 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">
                {currentFile ? currentFile.name : "Click to upload or drag and drop"}
              </span>
              <span className="mt-1 text-xs text-muted-foreground">Excel files (.xlsx, .xls)</span>
              <input
                type="file"
                className="hidden"
                accept=".xlsx,.xls"
                onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], "current")}
              />
            </label>
          </CardContent>
        </Card>
      </div>

      {(previousFile || currentFile) && (
        <div className="flex justify-end">
          <Button
            onClick={clearAll}
            variant="outline"
            className="gap-2 border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground bg-transparent"
          >
            <X className="h-4 w-4" />
            Clear All Files
          </Button>
        </div>
      )}

      {(uploadedPrev.length > 0 || uploadedCurr.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-card-foreground">File Preview (First 200 Rows)</CardTitle>
            <CardDescription>Review uploaded data with derived columns before reconciliation</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="previous" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="previous">Previous File ({uploadedPrev.length})</TabsTrigger>
                <TabsTrigger value="current">Current File ({uploadedCurr.length})</TabsTrigger>
              </TabsList>

              <TabsContent value="previous" className="mt-4">
                <PreviewTable data={uploadedPrev.slice(0, 200)} />
              </TabsContent>

              <TabsContent value="current" className="mt-4">
                <PreviewTable data={uploadedCurr.slice(0, 200)} />
              </TabsContent>
            </Tabs>

            <div className="mt-6 flex justify-end">
              <Button onClick={runReconciliation} size="lg" className="gap-2">
                <FileSpreadsheet className="h-4 w-4" />
                Run Reconciliation
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {showResults && (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-card-foreground">Matched</CardTitle>
                <CheckCircle className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">{summary.matchedCount}</div>
                <p className="text-xs text-muted-foreground">Successfully reconciled transactions</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-card-foreground">Pending Debits</CardTitle>
                <AlertCircle className="h-4 w-4 text-yellow-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">{summary.pendingDebitCount}</div>
                <p className="text-xs text-muted-foreground">Unmatched debit transactions</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-card-foreground">Pending Credits</CardTitle>
                <AlertCircle className="h-4 w-4 text-orange-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">{summary.pendingCreditCount}</div>
                <p className="text-xs text-muted-foreground">Unmatched credit transactions</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-card-foreground">Pending Results</CardTitle>
                  <CardDescription>Unmatched transactions requiring attention</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button onClick={exportSelected} variant="outline" className="gap-2 bg-transparent">
                    <Download className="h-4 w-4" />
                    Export Selected
                  </Button>
                  <Button
                    onClick={adminClearTemp}
                    variant="outline"
                    className="gap-2 bg-transparent border-destructive text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete Temp Results
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="pending-debits" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="pending-debits">Pending Debits ({pendingDebits.length})</TabsTrigger>
                  <TabsTrigger value="pending-credits">Pending Credits ({pendingCredits.length})</TabsTrigger>
                </TabsList>

                <TabsContent value="pending-debits" className="mt-4">
                  <SelectableTable
                    data={pendingDebits}
                    selectedRows={selectedRows}
                    onSelectionChange={setSelectedRows}
                    allData={resultRows}
                  />
                </TabsContent>

                <TabsContent value="pending-credits" className="mt-4">
                  <SelectableTable
                    data={pendingCredits}
                    selectedRows={selectedRows}
                    onSelectionChange={setSelectedRows}
                    allData={resultRows}
                  />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

function PreviewTable({ data }: { data: TransactionRow[] }) {
  if (data.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-muted/50 p-8 text-center">
        <p className="text-sm text-muted-foreground">No data to display</p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-foreground">Date</TableHead>
            <TableHead className="text-foreground">Narration</TableHead>
            <TableHead className="text-foreground">Original Amount</TableHead>
            <TableHead className="text-right text-foreground">Signed Amount</TableHead>
            <TableHead className="text-center text-foreground">Is Negative</TableHead>
            <TableHead className="text-foreground">First15</TableHead>
            <TableHead className="text-foreground">Last15</TableHead>
            <TableHead className="text-foreground">HelperKey1</TableHead>
            <TableHead className="text-foreground">HelperKey2</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row, index) => (
            <TableRow key={index}>
              <TableCell className="font-medium text-foreground">{row.Date}</TableCell>
              <TableCell className="max-w-xs text-foreground">{row.Narration}</TableCell>
              <TableCell className="text-foreground">{row.OriginalAmount}</TableCell>
              <TableCell
                className={`text-right font-mono ${row.SignedAmount === 0 ? "text-red-500" : "text-foreground"}`}
              >
                {row.SignedAmount.toLocaleString()}
              </TableCell>
              <TableCell className="text-center">
                <Badge variant={row.IsNegative ? "destructive" : "secondary"}>{row.IsNegative ? "Yes" : "No"}</Badge>
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">{row.First15}</TableCell>
              <TableCell className="text-xs text-muted-foreground">{row.Last15}</TableCell>
              <TableCell className="text-xs font-mono text-muted-foreground">{row.HelperKey1}</TableCell>
              <TableCell className="text-xs font-mono text-muted-foreground">{row.HelperKey2}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function SelectableTable({
  data,
  selectedRows,
  onSelectionChange,
  allData,
}: {
  data: TransactionRow[]
  selectedRows: Set<number>
  onSelectionChange: (selected: Set<number>) => void
  allData: TransactionRow[]
}) {
  if (data.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-muted/50 p-8 text-center">
        <p className="text-sm text-muted-foreground">No pending transactions</p>
      </div>
    )
  }

  const toggleRow = (index: number) => {
    const newSelected = new Set(selectedRows)
    if (newSelected.has(index)) {
      newSelected.delete(index)
    } else {
      newSelected.add(index)
    }
    onSelectionChange(newSelected)
  }

  const toggleAll = () => {
    if (selectedRows.size === data.length) {
      onSelectionChange(new Set())
    } else {
      const allIndices = data.map((_, idx) => allData.indexOf(_)).filter((i) => i !== -1)
      onSelectionChange(new Set(allIndices))
    }
  }

  return (
    <div className="rounded-lg border border-border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">
              <Checkbox checked={selectedRows.size === data.length && data.length > 0} onCheckedChange={toggleAll} />
            </TableHead>
            <TableHead className="text-foreground">Date</TableHead>
            <TableHead className="text-foreground">Narration</TableHead>
            <TableHead className="text-right text-foreground">Amount</TableHead>
            <TableHead className="text-foreground">HelperKey1</TableHead>
            <TableHead className="text-foreground">HelperKey2</TableHead>
            <TableHead className="text-foreground">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row, index) => {
            const globalIndex = allData.indexOf(row)
            return (
              <TableRow key={index}>
                <TableCell>
                  <Checkbox checked={selectedRows.has(globalIndex)} onCheckedChange={() => toggleRow(globalIndex)} />
                </TableCell>
                <TableCell className="font-medium text-foreground">{row.Date}</TableCell>
                <TableCell className="max-w-xs text-foreground">{row.Narration}</TableCell>
                <TableCell className="text-right font-mono text-foreground">
                  ₦{Math.abs(row.SignedAmount).toLocaleString()}
                </TableCell>
                <TableCell className="text-xs font-mono text-muted-foreground">{row.HelperKey1}</TableCell>
                <TableCell className="text-xs font-mono text-muted-foreground">{row.HelperKey2}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{row.status}</Badge>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
