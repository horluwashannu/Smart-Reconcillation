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

export default function TellerProofGL() {
  const [data, setData] = useState<any[]>([])
  const [filter, setFilter] = useState<"Debit" | "Credit" | "All">("All")

  // Handle Excel Upload
  const handleFileUpload = (e: any) => {
    const file = e.target.files[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (evt) => {
      const bstr = evt.target?.result
      const wb = XLSX.read(bstr, { type: "binary" })
      const wsname = wb.SheetNames[0]
      const ws = wb.Sheets[wsname]
      const jsonData: any[] = XLSX.utils.sheet_to_json(ws, { defval: "" })
      setData(jsonData)
    }
    reader.readAsBinaryString(file)
  }

  // Apply filter
  const filteredData =
    filter === "All" ? data : data.filter((row) => row.DebitCredit === filter)

  // Calculate totals
  const totalDebit = data
    .filter((row) => row.DebitCredit === "Debit")
    .reduce((acc, row) => acc + (parseFloat(row.Amount) || 0), 0)

  const totalCredit = data
    .filter((row) => row.DebitCredit === "Credit")
    .reduce((acc, row) => acc + (parseFloat(row.Amount) || 0), 0)

  // Export filtered to Excel
  const exportToExcel = () => {
    const ws = XLSX.utils.json_to_sheet(filteredData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Filtered GL")
    XLSX.writeFile(wb, "Filtered_GL.xlsx")
  }

  return (
    <Card className="p-4">
      <CardHeader>
        <CardTitle className="text-xl font-bold">Teller GL Proof</CardTitle>
        <CardDescription>Upload and filter your GL Excel file</CardDescription>
      </CardHeader>

      <CardContent>
        {/* Upload Field */}
        <div className="flex items-center gap-3 mb-4">
          <Label htmlFor="upload">Upload GL Excel:</Label>
          <Input
            id="upload"
            type="file"
            accept=".xlsx, .xls"
            onChange={handleFileUpload}
            className="w-60"
          />
          <Button onClick={exportToExcel} disabled={!filteredData.length}>
            <Download className="w-4 h-4 mr-2" /> Export
          </Button>
        </div>

        {/* Filter Buttons */}
        <div className="flex gap-2 mb-3">
          <Button
            variant={filter === "Debit" ? "default" : "outline"}
            onClick={() => setFilter("Debit")}
          >
            Debit
          </Button>
          <Button
            variant={filter === "Credit" ? "default" : "outline"}
            onClick={() => setFilter("Credit")}
          >
            Credit
          </Button>
          <Button
            variant={filter === "All" ? "default" : "outline"}
            onClick={() => setFilter("All")}
          >
            All
          </Button>
        </div>

        {/* Table Display */}
        {filteredData.length > 0 ? (
          <div className="overflow-x-auto border rounded-md">
            <table className="w-full text-sm">
              <thead className="bg-gray-100 text-left">
                <tr>
                  {Object.keys(filteredData[0]).map((key) => (
                    <th key={key} className="p-2 font-semibold">
                      {key}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredData.map((row, i) => (
                  <tr
                    key={i}
                    className={`border-b ${
                      row.DebitCredit === "Debit"
                        ? "bg-red-50"
                        : row.DebitCredit === "Credit"
                        ? "bg-green-50"
                        : ""
                    }`}
                  >
                    {Object.values(row).map((val: any, j) => (
                      <td key={j} className="p-2">
                        {val}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Footer Totals */}
            <div className="flex justify-between mt-3 p-2 bg-gray-50 border-t">
              <Badge variant="secondary" className="text-red-700 font-bold">
                Total Debit: ₦{totalDebit.toLocaleString()}
              </Badge>
              <Badge variant="secondary" className="text-green-700 font-bold">
                Total Credit: ₦{totalCredit.toLocaleString()}
              </Badge>
            </div>
          </div>
        ) : (
          <p className="text-gray-500 text-center mt-4">
            No data uploaded yet.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
