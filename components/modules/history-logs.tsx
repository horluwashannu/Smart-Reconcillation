"use client";

import { useState } from "react";
import * as XLSX from "xlsx";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Download } from "lucide-react";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";

type GLRow = {
  Date?: string;
  Branch?: string;
  AccountNo?: string;
  Type?: string;
  Currency?: string;
  Amount?: number;
  User?: string;
  Authorizer?: string;
  Reference?: string;
};

export default function HistoryLogs() {
  const [activeTab, setActiveTab] = useState<"gl_debit" | "gl_credit">(
    "gl_debit"
  );
  const [glRows, setGlRows] = useState<GLRow[]>([]);
  const [filteredGl, setFilteredGl] = useState<GLRow[]>([]);
  const [glFilterUser, setGlFilterUser] = useState("");

  // --- Safe Number Parser ---
  const safeNumber = (v: any) => {
    const s = String(v || "").replace(/[,₦$]/g, "").trim();
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
  };

  // --- GL Upload Parser ---
  const parseGL = async (file: File) => {
    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
      const header = raw[0].map((h) => String(h || "").trim().toLowerCase());

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
      }));

      const cleanRows = rows.filter((r) => r.AccountNo);
      setGlRows(cleanRows);
      setFilteredGl(cleanRows);
      alert(`${cleanRows.length} GL Rows Loaded ✅`);
    } catch {
      alert("Invalid GL file format. Please check your column headers.");
    }
  };

  // --- Filter ---
  const handleFilter = () => {
    if (!glFilterUser.trim()) setFilteredGl(glRows);
    else
      setFilteredGl(
        glRows.filter((r) =>
          r.User?.toLowerCase().includes(glFilterUser.toLowerCase())
        )
      );
  };

  // --- Export ---
  const handleExport = () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(glRows), "GL");
    XLSX.writeFile(wb, "GL_Result.xlsx");
  };

  const currentData = filteredGl;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-800 p-6">
      <Card className="max-w-7xl mx-auto shadow-xl border-none rounded-2xl">
        <CardHeader className="bg-gradient-to-r from-indigo-600 to-cyan-500 text-white rounded-t-2xl p-6">
          <CardTitle className="text-2xl font-bold">GL Reports Console</CardTitle>
          <CardDescription className="text-indigo-100">
            Upload GL file and filter by User ID for quick reconciliation
          </CardDescription>
        </CardHeader>

        <CardContent className="p-6 space-y-6">
          {/* GL Upload */}
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <Label>GL Upload</Label>
              <Input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={(e) =>
                  e.target.files?.[0] && parseGL(e.target.files[0])
                }
              />
              {glRows.length > 0 && (
                <Badge className="mt-2 bg-blue-600">{glRows.length} Rows Loaded</Badge>
              )}
            </div>
            <div className="flex flex-col justify-end">
              <Button
                onClick={handleExport}
                className="bg-gradient-to-r from-indigo-600 to-cyan-500 text-white"
              >
                <Download className="mr-2 h-4 w-4" /> Export GL Data
              </Button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex w-full mt-6">
            {["gl_debit", "gl_credit"].map((tab) => (
              <Button
                key={tab}
                className="flex-1 text-sm md:text-base"
                variant={activeTab === tab ? "default" : "outline"}
                onClick={() => setActiveTab(tab as any)}
              >
                {tab.replace("_", " ").toUpperCase()}
              </Button>
            ))}
          </div>

          {/* Filter */}
          <div className="flex flex-wrap gap-3 items-center justify-center mt-4">
            <Input
              placeholder="Filter by User ID"
              value={glFilterUser}
              onChange={(e) => setGlFilterUser(e.target.value)}
              className="w-60"
            />
            <Button onClick={handleFilter}>Filter</Button>
          </div>

          {/* Table */}
          {currentData.length > 0 && (
            <div className="overflow-auto border rounded-xl bg-white dark:bg-gray-700 shadow-inner mt-6 max-h-[60vh]">
              <Table>
                <TableHeader>
                  <TableRow>
                    {Object.keys(currentData[0]).map((key) => (
                      <TableHead key={key}>{key}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentData.map((row, i) => (
                    <TableRow key={i}>
                      {Object.values(row).map((val, j) => (
                        <TableCell key={j}>{String(val)}</TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
