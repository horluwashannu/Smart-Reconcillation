"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Download, Save, Plus, Trash2 } from "lucide-react"
import { BranchInfo } from "@/components/branch-info"
import { getSupabase } from "@/lib/supabase"

// Naira denominations from 1000 to 5
const NAIRA_DENOMINATIONS = [1000, 500, 200, 100, 50, 20, 10, 5]
// Dollar denominations
const DOLLAR_DENOMINATIONS = [100, 50, 20, 10, 5, 1]
// Pounds denominations
const POUNDS_DENOMINATIONS = [50, 20, 10, 5, 1]
// Euro denominations
const EURO_DENOMINATIONS = [500, 200, 100, 50, 20, 10, 5]

interface TellerData {
  id: string
  name: string
  buy: { [key: number]: number }
  sell: { [key: number]: number }
}

interface ConsolidatedProofProps {
  userId?: string
}

export function ConsolidatedProof({ userId }: ConsolidatedProofProps) {
  const [currency, setCurrency] = useState<"naira" | "dollar" | "pounds" | "euro">("naira")
  const [tellers, setTellers] = useState<TellerData[]>([
    { id: "T001", name: "Teller 01", buy: {}, sell: {} },
    { id: "T002", name: "Teller 02", buy: {}, sell: {} },
  ])

  const [branchCode, setBranchCode] = useState("")
  const [branchName, setBranchName] = useState("")
  const [country, setCountry] = useState("")

  // Balance tracking - only Balance BF is editable
  const [balanceBF, setBalanceBF] = useState<{ [key: number]: number }>({})

  const getDenominations = () => {
    switch (currency) {
      case "naira":
        return NAIRA_DENOMINATIONS
      case "dollar":
        return DOLLAR_DENOMINATIONS
      case "pounds":
        return POUNDS_DENOMINATIONS
      case "euro":
        return EURO_DENOMINATIONS
      default:
        return NAIRA_DENOMINATIONS
    }
  }

  const getCurrencySymbol = () => {
    switch (currency) {
      case "naira":
        return "₦"
      case "dollar":
        return "$"
      case "pounds":
        return "£"
      case "euro":
        return "€"
      default:
        return "₦"
    }
  }

  const addTeller = () => {
    const newId = `T${String(tellers.length + 1).padStart(3, "0")}`
    setTellers([...tellers, { id: newId, name: `Teller ${tellers.length + 1}`, buy: {}, sell: {} }])
  }

  const removeTeller = (id: string) => {
    setTellers(tellers.filter((t) => t.id !== id))
  }

  const updateTellerName = (tellerId: string, name: string) => {
    setTellers(tellers.map((t) => (t.id === tellerId ? { ...t, name } : t)))
  }

  const updateTellerBuy = (tellerId: string, denomination: number, value: number) => {
    setTellers(tellers.map((t) => (t.id === tellerId ? { ...t, buy: { ...t.buy, [denomination]: value } } : t)))
  }

  const updateTellerSell = (tellerId: string, denomination: number, value: number) => {
    setTellers(tellers.map((t) => (t.id === tellerId ? { ...t, sell: { ...t.sell, [denomination]: value } } : t)))
  }

  const calculateTotalDeposit = (denomination: number) => {
    return tellers.reduce((sum, teller) => sum + (teller.buy[denomination] || 0), 0)
  }

  const calculateTotalWithdrawal = (denomination: number) => {
    return tellers.reduce((sum, teller) => sum + (teller.sell[denomination] || 0), 0)
  }

  const calculateTotalBalance = (denomination: number) => {
    const bf = balanceBF[denomination] || 0
    const deposit = calculateTotalDeposit(denomination)
    const withdrawal = calculateTotalWithdrawal(denomination)
    return bf + deposit - withdrawal
  }

  const calculateGrandTotal = (type: "bf" | "deposit" | "withdrawal" | "balance") => {
    const denominations = getDenominations()
    return denominations.reduce((sum, denom) => {
      switch (type) {
        case "bf":
          return sum + (balanceBF[denom] || 0) * denom
        case "deposit":
          return sum + calculateTotalDeposit(denom) * denom
        case "withdrawal":
          return sum + calculateTotalWithdrawal(denom) * denom
        case "balance":
          return sum + calculateTotalBalance(denom) * denom
        default:
          return sum
      }
    }, 0)
  }

  useEffect(() => {
    const dailyTotal = {
      date: new Date().toISOString().split("T")[0],
      currency,
      totalBalance: calculateGrandTotal("balance"),
      totalDeposit: calculateGrandTotal("deposit"),
      totalWithdrawal: calculateGrandTotal("withdrawal"),
      branchCode,
      branchName,
      country,
    }
    localStorage.setItem("consolidatedProofDaily", JSON.stringify(dailyTotal))
  }, [tellers, balanceBF, currency, branchCode, branchName, country])

  const handleSave = async () => {
    const proofData = {
      currency,
      balance_bf: balanceBF,
      teller_data: tellers,
      total_deposit: calculateGrandTotal("deposit"),
      total_withdrawal: calculateGrandTotal("withdrawal"),
      total_balance: calculateGrandTotal("balance"),
    }

    try {
      const supabase = getSupabase()
      const { error } = await supabase.from("consolidated_proof").insert({
        user_id: userId,
        branch_code: branchCode,
        branch_name: branchName,
        country,
        date: new Date().toISOString().split("T")[0],
        currency,
        balance_bf: calculateGrandTotal("bf"),
        teller_data: tellers,
        total_deposit: calculateGrandTotal("deposit"),
        total_withdrawal: calculateGrandTotal("withdrawal"),
        total_balance: calculateGrandTotal("balance"),
      })

      if (error) throw error
      console.log("[v0] Consolidated proof saved to Supabase")
      alert("Consolidated proof saved successfully!")
    } catch (error) {
      console.log("[v0] Supabase not configured, saving to localStorage")
      localStorage.setItem("consolidatedProof", JSON.stringify(proofData))
      alert("Consolidated proof saved to local storage")
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Consolidated Proof</h1>
          <p className="text-muted-foreground">Track currency denominations and teller buy/sell transactions</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleSave} className="bg-gradient-to-r from-primary to-accent gap-2">
            <Save className="h-4 w-4" />
            Save
          </Button>
          <Button variant="outline" className="gap-2 bg-transparent">
            <Download className="h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      <BranchInfo
        branchCode={branchCode}
        branchName={branchName}
        country={country}
        onBranchCodeChange={setBranchCode}
        onBranchNameChange={setBranchName}
        onCountryChange={setCountry}
      />

      <Tabs value={currency} onValueChange={(v) => setCurrency(v as any)} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="naira">Naira (₦)</TabsTrigger>
          <TabsTrigger value="dollar">Dollar ($)</TabsTrigger>
          <TabsTrigger value="pounds">Pounds (£)</TabsTrigger>
          <TabsTrigger value="euro">Euro (€)</TabsTrigger>
        </TabsList>

        <TabsContent value={currency} className="space-y-4">
          {/* Summary Cards */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card className="border-primary/20 bg-card/50 backdrop-blur">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-card-foreground">Balance B/F</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-card-foreground">
                  {getCurrencySymbol()}
                  {calculateGrandTotal("bf").toLocaleString()}
                </div>
              </CardContent>
            </Card>
            <Card className="border-primary/20 bg-card/50 backdrop-blur">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-card-foreground">Total Deposit</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-chart-3">
                  {getCurrencySymbol()}
                  {calculateGrandTotal("deposit").toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Auto-calculated from teller buys</p>
              </CardContent>
            </Card>
            <Card className="border-primary/20 bg-card/50 backdrop-blur">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-card-foreground">Total Withdrawal</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-destructive">
                  {getCurrencySymbol()}
                  {calculateGrandTotal("withdrawal").toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Auto-calculated from teller sells</p>
              </CardContent>
            </Card>
            <Card className="border-primary/20 bg-card/50 backdrop-blur">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-card-foreground">Total Balance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-primary">
                  {getCurrencySymbol()}
                  {calculateGrandTotal("balance").toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground mt-1">BF + Deposit - Withdrawal</p>
              </CardContent>
            </Card>
          </div>

          {/* Main Denomination Table */}
          <Card className="border-primary/20 bg-card/50 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-card-foreground">Denomination Breakdown</CardTitle>
              <CardDescription>
                Balance B/F is editable. Deposit and Withdrawal are auto-calculated from teller transactions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="pb-3 text-left font-semibold text-foreground">Denomination</th>
                      <th className="pb-3 text-right font-semibold text-foreground">Balance B/F</th>
                      <th className="pb-3 text-right font-semibold text-foreground">Total Deposit</th>
                      <th className="pb-3 text-right font-semibold text-foreground">Total Withdrawal</th>
                      <th className="pb-3 text-right font-semibold text-foreground">Total Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getDenominations().map((denom) => (
                      <tr key={denom} className="border-b border-border/50">
                        <td className="py-3 font-medium text-foreground">
                          {getCurrencySymbol()}
                          {denom}
                        </td>
                        <td className="py-3 text-right">
                          <Input
                            type="number"
                            className="w-24 text-right"
                            value={balanceBF[denom] || ""}
                            onChange={(e) =>
                              setBalanceBF({ ...balanceBF, [denom]: Number.parseInt(e.target.value) || 0 })
                            }
                            placeholder="0"
                          />
                        </td>
                        <td className="py-3 text-right">
                          <div className="w-24 inline-block text-right font-mono text-chart-3 font-semibold">
                            {calculateTotalDeposit(denom)}
                          </div>
                        </td>
                        <td className="py-3 text-right">
                          <div className="w-24 inline-block text-right font-mono text-destructive font-semibold">
                            {calculateTotalWithdrawal(denom)}
                          </div>
                        </td>
                        <td className="py-3 text-right font-mono font-semibold text-primary">
                          {calculateTotalBalance(denom)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Teller Buy/Sell Section */}
          <Card className="border-primary/20 bg-card/50 backdrop-blur">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-card-foreground">Teller Buy & Sell</CardTitle>
                  <CardDescription>
                    Record individual teller transactions - these automatically update totals above
                  </CardDescription>
                </div>
                <Button onClick={addTeller} variant="outline" size="sm" className="gap-2 bg-transparent">
                  <Plus className="h-4 w-4" />
                  Add Teller
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {tellers.map((teller) => (
                <div key={teller.id} className="space-y-3 rounded-lg border border-border p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2 flex-1">
                      <Label htmlFor={`teller-name-${teller.id}`} className="text-sm font-medium text-foreground">
                        Teller Name:
                      </Label>
                      <Input
                        id={`teller-name-${teller.id}`}
                        value={teller.name}
                        onChange={(e) => updateTellerName(teller.id, e.target.value)}
                        className="max-w-xs"
                        placeholder="Enter teller name"
                      />
                      <span className="text-sm text-muted-foreground">({teller.id})</span>
                    </div>
                    <Button
                      onClick={() => removeTeller(teller.id)}
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="pb-2 text-left text-sm font-medium text-foreground">Denomination</th>
                          <th className="pb-2 text-right text-sm font-medium text-foreground">Buy (Deposit)</th>
                          <th className="pb-2 text-right text-sm font-medium text-foreground">Sell (Withdrawal)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {getDenominations().map((denom) => (
                          <tr key={denom} className="border-b border-border/30">
                            <td className="py-2 text-sm text-foreground">
                              {getCurrencySymbol()}
                              {denom}
                            </td>
                            <td className="py-2 text-right">
                              <Input
                                type="number"
                                className="h-8 w-20 text-right text-sm"
                                value={teller.buy[denom] || ""}
                                onChange={(e) =>
                                  updateTellerBuy(teller.id, denom, Number.parseInt(e.target.value) || 0)
                                }
                                placeholder="0"
                              />
                            </td>
                            <td className="py-2 text-right">
                              <Input
                                type="number"
                                className="h-8 w-20 text-right text-sm"
                                value={teller.sell[denom] || ""}
                                onChange={(e) =>
                                  updateTellerSell(teller.id, denom, Number.parseInt(e.target.value) || 0)
                                }
                                placeholder="0"
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
