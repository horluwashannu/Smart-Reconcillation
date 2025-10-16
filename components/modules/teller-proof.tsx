"use client"

import { useState } from "react"
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
import { Download, PlusCircle } from "lucide-react"
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table"
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"

type TellerRow = {
  ACCOUNT_NO?: string
  OPENING_BALANCE?: number
  CASH_DEP?: number
  CASH_DEP_2?: number
  SAVINGS_WITHDR?: number
  TO_VAULT?: number
  FROM_VAULT?: number
  EXPENSE?: number
  WUMT?: number
  CHEQUES?: number
  ACCOUNT_NO2?: string
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
}

export function TellerProof() {
  const [activeTab, setActiveTab] = useState<
    "teller_debit" | "teller_credit" | "gl_debit" | "gl_credit"
  >("teller_debit")
  const [tellerRows, setTellerRows] = useState<TellerRow[]>([])
  const [glRows, setGlRows] = useState<GLRow[]>([])
  const [tellerName, setTellerName] = useState("")
  const [supervisorName, setSupervisorName] = useState("")
  const [glFilterUser, setGlFilterUser] = useState("")
  const [filteredGl, setFilteredGl] = useState<GLRow[]>([])
  const [viewMore, setViewMore] = useState(false)
  const [buyTotal, setBuyTotal] = useState(0)
  const [sellTotal, setSellTotal] = useState(0)
  const [openCast, setOpenCast] = useState(false)
  const [castData, setCastData] = useState<any>({
    CHEQUES: "",
    ACCOUNT_NO: "",
    SAVINGS_WITHDR: "",
    ACCOUNT_NO2: "",
    TO_VAULT: "",
    EXPENSE: "",
    WUMT: "",
    OPENING_BALANCE: "",
    CASH_DEP: "",
    CASH_DEP_2: "",
    FROM_VAULT: "",
  })

  const safeNumber = (v: any) => {
    const s = String(v || "").replace(/[,₦$]/g, "").trim()
    const n = Number(s)
    return Number.isFinite(n) ? n : 0
  }

  const findCastSheet = (wb: XLSX.WorkBook) => {
    const found = wb.SheetNames.find(
      (n) => n.toLowerCase().trim() === "cast"
    )
    return found ? wb.Sheets[found] : wb.Sheets[wb.SheetNames[0]]
  }

  const parseTeller = async (file: File) => {
    try {
      const data = await file.arrayBuffer()
      const wb = XLSX.read(data, { type: "array" })
      const sheet = findCastSheet(wb)
      const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" })
      const header = raw[0].map((h) => String(h || "").trim())
      const rows = raw.slice(1).map((r) => {
        const obj: any = {}
        header.forEach((h, i) => {
          obj[h.replace(/\s+/g, "_").toUpperCase()] = r[i]
        })
        return {
          ACCOUNT_NO: obj["ACCOUNT_NO"] || obj["ACCOUNT"] || obj["ACCOUNTNUMBER"],
          OPENING_BALANCE: safeNumber(obj["OPENING_BALANCE"]),
          CASH_DEP: safeNumber(obj["CASH_DEP"]),
          CASH_DEP_2: safeNumber(obj["CASH_DEP_2"]),
          SAVINGS_WITHDR: safeNumber(obj["SAVINGS_WITHDR"]),
          TO_VAULT: safeNumber(obj["TO_VAULT"]),
          FROM_VAULT: safeNumber(obj["FROM_VAULT"]),
          EXPENSE: safeNumber(obj["EXPENSE"]),
          WUMT: safeNumber(obj["WUMT"]),
        }
      })
      setTellerRows(rows.filter((r) => r.ACCOUNT_NO))
    } catch {
      alert("Invalid Teller (CAST) file or missing 'cast' sheet.")
    }
  }

  const parseGL = async (file: File) => {
    try {
      const data = await file.arrayBuffer()
      const wb = XLSX.read(data, { type: "array" })
      const sheet = wb.Sheets[wb.SheetNames[0]]
      const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" })
      const header = raw[0].map((h) => String(h || "").trim().toLowerCase())
      const rows = raw.slice(1).map((r) => ({
        Date: String(r[header.findIndex((h) => h.includes("transaction date"))] || ""),
        Branch: String(r[header.findIndex((h) => h.includes("branch"))] || ""),
        AccountNo: String(r[header.findIndex((h) => h.includes("account"))] || ""),
        Type: String(r[header.findIndex((h) => h.includes("dr/cr"))] || ""),
        Currency: String(r[header.findIndex((h) => h.includes("currency"))] || ""),
        Amount: safeNumber(
          r[header.findIndex((h) => h.includes("lcy amount") || h.includes("amount"))]
        ),
        User: String(r[header.findIndex((h) => h.includes("user"))] || ""),
        Authorizer: String(r[header.findIndex((h) => h.includes("authoriser"))] || ""),
        Reference: String(r[header.findIndex((h) => h.includes("reference"))] || ""),
      }))
      setGlRows(rows.filter((r) => r.AccountNo))
      setFilteredGl(rows.filter((r) => r.AccountNo))
    } catch {
      alert("Invalid GL file format.")
    }
  }

  const handleFilter = () => {
    if (!glFilterUser.trim()) setFilteredGl(glRows)
    else {
      const filtered = glRows.filter((r) =>
        r.User?.toLowerCase().includes(glFilterUser.toLowerCase())
      )
      setFilteredGl(filtered)
    }
  }

  const handleExport = () => {
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(tellerRows), "Teller")
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(glRows), "GL")
    XLSX.writeFile(wb, "TellerProofResult.xlsx")
  }

  const handleCastSubmit = () => {
    const newRow: TellerRow = {
      ...castData,
      OPENING_BALANCE: safeNumber(castData.OPENING_BALANCE),
      CASH_DEP: safeNumber(castData.CASH_DEP),
      CASH_DEP_2: safeNumber(castData.CASH_DEP_2),
      SAVINGS_WITHDR: safeNumber(castData.SAVINGS_WITHDR),
      TO_VAULT: safeNumber(castData.TO_VAULT),
      FROM_VAULT: safeNumber(castData.FROM_VAULT),
      EXPENSE: safeNumber(castData.EXPENSE),
      WUMT: safeNumber(castData.WUMT),
      CHEQUES: safeNumber(castData.CHEQUES),
    }

    const isCredit =
      safeNumber(castData.CASH_DEP) > 0 ||
      safeNumber(castData.CASH_DEP_2) > 0 ||
      safeNumber(castData.FROM_VAULT) > 0

    const updated = [...tellerRows, newRow]
    setTellerRows(updated)
    setOpenCast(false)
    alert(isCredit ? "Added to Teller Credit ✅" : "Added to Teller Debit ✅")
  }

  const currentData =
    activeTab === "teller_debit" || activeTab === "teller_credit"
      ? tellerRows
      : filteredGl

  const displayData = viewMore ? currentData : currentData.slice(0, 15)

  const numericKeys = currentData.length
    ? Object.keys(currentData[0]).filter((k) => typeof (currentData[0] as any)[k] === "number")
    : []

  const totals: Record<string, number> = {}
  numericKeys.forEach((k) => {
    totals[k] = currentData.reduce(
      (sum, row) => sum + safeNumber((row as any)[k]),
      0
    )
  })

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-teal-100 dark:from-gray-900 dark:to-gray-800 p-6 text-gray-900 dark:text-gray-100">
      <Card className="w-full mx-auto shadow-xl border-none rounded-2xl bg-white dark:bg-gray-900">
        <CardHeader className="bg-gradient-to-r from-blue-600 to-teal-500 text-white rounded-t-2xl p-6">
          <CardTitle className="text-2xl font-bold">Teller Proof Dashboard</CardTitle>
          <CardDescription className="text-blue-100">
            Upload or Input Teller & GL files for reconciliation and preview
          </CardDescription>
        </CardHeader>

        <CardContent className="p-6 space-y-6">
          {/* Upload Section */}
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <Label>Teller (CAST) Sheet</Label>
              <Input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={(e) =>
                  e.target.files?.[0] && parseTeller(e.target.files[0])
                }
              />
              {tellerRows.length > 0 && (
                <Badge className="mt-2 bg-green-600">
                  {tellerRows.length} Teller Rows Loaded
                </Badge>
              )}
            </div>

            <div>
              <Label>GL Sheet</Label>
              <Input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={(e) => e.target.files?.[0] && parseGL(e.target.files[0])}
              />
              {glRows.length > 0 && (
                <Badge className="mt-2 bg-blue-600">
                  {glRows.length} GL Rows Loaded
                </Badge>
              )}
            </div>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
            <TabsList className="grid grid-cols-4 w-full mt-6">
              <TabsTrigger value="teller_debit">TELLER DEBIT</TabsTrigger>
              <TabsTrigger value="teller_credit">TELLER CREDIT</TabsTrigger>
              <TabsTrigger value="gl_debit">GL DEBIT</TabsTrigger>
              <TabsTrigger value="gl_credit">GL CREDIT</TabsTrigger>
            </TabsList>

            {/* Each Tab Content */}
            {["teller_debit", "teller_credit", "gl_debit", "gl_credit"].map((tab) => (
              <TabsContent key={tab} value={tab}>
                {/* GL Filter */}
                {tab.includes("gl") && (
                  <div className="flex flex-wrap gap-3 items-center justify-center mt-4">
                    <Input
                      placeholder="Filter by User ID"
                      value={glFilterUser}
                      onChange={(e) => setGlFilterUser(e.target.value)}
                      className="w-60"
                    />
                    <Button onClick={handleFilter}>Filter</Button>
                  </div>
                )}

                {/* Teller Info */}
                <div className="grid md:grid-cols-2 gap-4 mt-6">
                  <div>
                    <Label>Teller Name</Label>
                    <Input
                      placeholder="Enter Teller Name"
                      value={tellerName}
                      onChange={(e) => setTellerName(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Supervisor Name</Label>
                    <Input
                      placeholder="Enter Supervisor Name"
                      value={supervisorName}
                      onChange={(e) => setSupervisorName(e.target.value)}
                    />
                  </div>
                </div>

                {/* Buy/Sell Inputs */}
                <div className="grid md:grid-cols-2 gap-4 mt-6">
                  <div>
                    <Label>Total Buy</Label>
                    <Input
                      type="number"
                      value={buyTotal}
                      onChange={(e) => setBuyTotal(Number(e.target.value))}
                    />
                  </div>
                  <div>
                    <Label>Total Sell</Label>
                    <Input
                      type="number"
                      value={sellTotal}
                      onChange={(e) => setSellTotal(Number(e.target.value))}
                    />
                  </div>
                </div>

                {/* Preview */}
                {currentData.length > 0 && (
                  <div className="overflow-auto border rounded-xl bg-white dark:bg-gray-800 shadow-inner mt-6 max-h-[500px] w-full">
                    <Table className="w-full">
                      <TableHeader>
                        <TableRow>
                          {Object.keys(currentData[0])
                            .slice(0, 8)
                            .map((key) => (
                              <TableHead key={key}>{key}</TableHead>
                            ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {displayData.map((row, i) => (
                          <TableRow key={i}>
                            {Object.values(row)
                              .slice(0, 8)
                              .map((val, j) => (
                                <TableCell key={j}>{String(val)}</TableCell>
                              ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}

                {/* Totals */}
                {Object.keys(totals).length > 0 && (
                  <div className="mt-4 bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                    <h4 className="font-semibold mb-2">Auto Totals:</h4>
                    <div className="grid md:grid-cols-3 gap-3 text-sm">
                      {Object.entries(totals).map(([k, v]) => (
                        <div key={k}>
                          <strong>{k}</strong>: {v.toLocaleString()}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {currentData.length > 15 && (
                  <div className="flex justify-center mt-4">
                    <Button
                      variant="outline"
                      onClick={() => setViewMore(!viewMore)}
                    >
                      {viewMore ? "Show Less" : "View More"}
                    </Button>
                  </div>
                )}
              </TabsContent>
            ))}
          </Tabs>

          {/* Cast Input Popup */}
          <div className="flex justify-center mt-6">
            <Button onClick={() => setOpenCast(true)} className="bg-teal-600 text-white">
              <PlusCircle className="mr-2 h-4 w-4" /> Input Cast Directly
            </Button>
          </div>

          <Dialog open={openCast} onOpenChange={setOpenCast}>
            <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>Input Teller Cast</DialogTitle>
              </DialogHeader>

              <div className="grid grid-cols-2 gap-3 mt-4">
                {Object.keys(castData).map((field) => (
                  <div key={field}>
                    <Label>{field.replace(/_/g, " ")}</Label>
                    <Input
                      type="text"
                      value={castData[field]}
                      onChange={(e) =>
                        setCastData({ ...castData, [field]: e.target.value })
                      }
                    />
                  </div>
                ))}
              </div>

              <DialogFooter className="mt-6">
                <Button onClick={handleCastSubmit} className="bg-blue-600 text-white">
                  OK
                </Button>
              </DialogFooter>
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
