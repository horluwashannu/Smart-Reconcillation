"use client";

import React, { useState } from "react";
import dynamic from "next/dynamic";
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

// ✅ Dynamically import framer-motion (safe for Vercel)
const MotionDiv = dynamic(
  () =>
    import("framer-motion").then((mod) => ({
      default: mod.motion.div,
    })),
  { ssr: false }
);
const AnimatePresence = dynamic(
  () =>
    import("framer-motion").then((mod) => ({
      default: mod.AnimatePresence,
    })),
  { ssr: false }
);

type TellerRow = Record<string, any>;
type GLRow = Record<string, any>;

export default function TellerProof() {
  const [activeTab, setActiveTab] = useState<
    "teller_debit" | "teller_credit" | "gl_debit" | "gl_credit"
  >("teller_debit");
  const [tellerRows, setTellerRows] = useState<TellerRow[]>([]);
  const [glRows, setGlRows] = useState<GLRow[]>([]);
  const [tellerName, setTellerName] = useState("");
  const [supervisorName, setSupervisorName] = useState("");
  const [glFilterUser, setGlFilterUser] = useState("");
  const [filteredGl, setFilteredGl] = useState<GLRow[]>([]);

  const safeNumber = (v: any) => {
    const s = String(v || "").replace(/[,₦$]/g, "").trim();
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
  };

  const findCastSheet = (wb: XLSX.WorkBook) => {
    const found = wb.SheetNames.find(
      (n) => n.toLowerCase().trim() === "cast"
    );
    return found ? wb.Sheets[found] : wb.Sheets[wb.SheetNames[0]];
  };

  const parseTeller = async (file: File) => {
    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data, { type: "array" });
      const sheet = findCastSheet(wb);
      const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
      const header = raw[0].map((h: any) => String(h || "").trim());
      const rows = raw.slice(1).map((r: any[]) => {
        const obj: any = {};
        header.forEach((h: string, i: number) => {
          obj[h.replace(/\s+/g, "_").toUpperCase()] = r[i];
        });
        return obj;
      });
      setTellerRows(rows.filter((r) => r.ACCOUNT_NO));
    } catch (err) {
      console.error(err);
      alert("Invalid Teller (CAST) file or missing 'cast' sheet.");
    }
  };

  const parseGL = async (file: File) => {
    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
      const header = raw[0].map((h: any) => String(h || "").trim().toLowerCase());
      const rows = raw.slice(1).map((r: any[]) => ({
        Date: String(r[header.findIndex((h: string) => h.includes("transaction date"))] || ""),
        Branch: String(r[header.findIndex((h: string) => h.includes("branch"))] || ""),
        AccountNo: String(r[header.findIndex((h: string) => h.includes("account"))] || ""),
        Type: String(r[header.findIndex((h: string) => h.includes("dr/cr"))] || ""),
        Currency: String(r[header.findIndex((h: string) => h.includes("currency"))] || ""),
        Amount: safeNumber(
          r[header.findIndex((h: string) => h.includes("lcy amount") || h.includes("amount"))]
        ),
        User: String(r[header.findIndex((h: string) => h.includes("user"))] || ""),
        Authorizer: String(r[header.findIndex((h: string) => h.includes("authoriser"))] || ""),
        Reference: String(r[header.findIndex((h: string) => h.includes("reference"))] || ""),
      }));
      setGlRows(rows.filter((r) => r.AccountNo));
      setFilteredGl(rows.filter((r) => r.AccountNo));
    } catch (err) {
      console.error(err);
      alert("Invalid GL file format.");
    }
  };

  const handleFilter = () => {
    if (!glFilterUser.trim()) setFilteredGl(glRows);
    else
      setFilteredGl(
        glRows.filter((r) =>
          r.User?.toLowerCase().includes(glFilterUser.toLowerCase())
        )
      );
  };

  const handleExport = () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(tellerRows), "Teller");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(glRows), "GL");
    XLSX.writeFile(wb, "TellerProofResult.xlsx");
  };

  const currentData =
    activeTab === "teller_debit" || activeTab === "teller_credit"
      ? tellerRows
      : filteredGl;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-teal-100 p-6">
      <Card className="max-w-7xl mx-auto shadow-xl border-none rounded-2xl">
        <CardHeader className="bg-gradient-to-r from-blue-600 to-teal-500 text-white rounded-t-2xl p-6">
          <CardTitle className="text-2xl font-bold">Teller Proof Dashboard</CardTitle>
          <CardDescription>Upload Teller & GL files and preview</CardDescription>
        </CardHeader>

        <CardContent className="p-6 space-y-6">
          {/* Uploaders */}
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <Label>Teller (CAST) Sheet</Label>
              <Input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={(e) => e.target.files?.[0] && parseTeller(e.target.files[0])}
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
                <Badge className="mt-2 bg-blue-600">{glRows.length} GL Rows Loaded</Badge>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex flex-wrap justify-center gap-3 mt-6">
            {["teller_debit", "teller_credit", "gl_debit", "gl_credit"].map((tab) => (
              <Button
                key={tab}
                variant={activeTab === tab ? "default" : "outline"}
                onClick={() => setActiveTab(tab as any)}
              >
                {tab.replace("_", " ").toUpperCase()}
              </Button>
            ))}
          </div>

          {/* Filter */}
          {activeTab.includes("gl") && (
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

          {/* Animated Table */}
          <AnimatePresence>
            <MotionDiv
              key={activeTab}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4 }}
              className="overflow-x-auto overflow-y-auto max-h-[500px] border rounded-xl bg-white shadow-inner mt-6"
            >
              {currentData.length > 0 ? (
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
                    {currentData.slice(0, 50).map((row, i) => (
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
              ) : (
                <div className="p-8 text-center text-gray-500">
                  No data to display.
                </div>
              )}
            </MotionDiv>
          </AnimatePresence>

          {/* Actions */}
          <div className="flex justify-center gap-4 mt-8 flex-wrap">
            <Button
              onClick={handleExport}
              className="bg-gradient-to-r from-blue-600 to-teal-500 text-white"
            >
              <Download className="mr-2 h-4 w-4" /> Export Result
            </Button>
            <Button variant="outline" onClick={() => alert("Submitted ✅")}>
              Dummy Submit
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
