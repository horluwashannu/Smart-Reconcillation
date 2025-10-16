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
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs"

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
  Column1?: string
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
          Column1: obj["NARRATION"] || "",
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

  const currentData =
    activeTab === "teller_debit" || activeTab === "teller_credit"
      ? tellerRows
      : filteredGl

  const displayData = viewMore ? currentData : currentData.slice(0, 15)

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-teal-100 p-6">
      <Card className="max-w-7xl mx-auto shadow-xl border-none rounded-2xl">
        <CardHeader className="bg-gradient-to-r from-blue-600 to-teal-500 text-white rounded-t-2xl p-6">
          <CardTitle className="text-2xl font-bold">Teller Proof Dashboard</CardTitle>
          <CardDescription className="text-blue-100">
            Upload Teller & GL files for reconciliation and preview below
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
            <TabsList className="flex flex-wrap justify-center gap-3 mt-6">
              <TabsTrigger value="teller_debit">TELLER DEBIT</TabsTrigger>
              <TabsTrigger value="teller_credit">TELLER CREDIT</TabsTrigger>
              <TabsTrigger value="gl_debit">GL DEBIT</TabsTrigger>
              <TabsTrigger value="gl_credit">GL CREDIT</TabsTrigger>
            </TabsList>

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

                {/* Teller & Supervisor */}
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

                {/* Preview */}
                {currentData.length > 0 && (
                  <div className="overflow-auto border rounded-xl bg-white shadow-inner mt-6 max-h-[500px]">
                    <Table>
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
