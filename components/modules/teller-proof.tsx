// /components/TellerProof.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download, Upload, Filter } from "lucide-react";
import {
  Table,
  TableBody,
  TableHeader,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";

type TellerRow = Record<string, any>;
type GLRow = Record<string, any>;

export default function TellerProof() {
  // UI / Meta
  const [tellerName, setTellerName] = useState("");
  const [supervisorName, setSupervisorName] = useState("");
  const [activeView, setActiveView] = useState<
    "tellerDebit" | "tellerCredit" | "glDebit" | "glCredit"
  >("tellerDebit");

  // Files & parsed data
  const [tellerFile, setTellerFile] = useState<File | null>(null);
  const [glFile, setGlFile] = useState<File | null>(null);
  const [tellerRows, setTellerRows] = useState<TellerRow[]>([]);
  const [glRows, setGlRows] = useState<GLRow[]>([]);

  // Filter & summary
  const [glFilterUser, setGlFilterUser] = useState("");
  const [buyAmount, setBuyAmount] = useState<number | "">("");
  const [dummySubmitted, setDummySubmitted] = useState(false);

  // safe number parsing
  const safeNumber = (v: any) => {
    if (v === null || v === undefined || v === "") return 0;
    const s = String(v).replace(/[,₦$ ]/g, "").trim();
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
  };

  // Find 'cast' sheet or fallback to first or second sheet
  const findCastSheetName = (wb: XLSX.WorkBook) => {
    const names = wb.SheetNames;
    const found = names.find((n) => n.toLowerCase().trim() === "cast");
    if (found) return found;
    if (names.length >= 2) return names[1];
    return names[0];
  };

  // Parse Teller file: read sheet "cast" or fallback, return array of objects
  const parseTellerFile = async (file: File) => {
    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data, { type: "array", cellDates: true });
      const sheetName = findCastSheetName(wb);
      const sheet = wb.Sheets[sheetName];
      const json = XLSX.utils.sheet_to_json<TellerRow>(sheet, { defval: "" });
      // Keep only rows that have some relevant columns (for safety)
      setTellerRows(
        json.map((r, i) => {
          // normalize headers to predictable keys for easier totals
          const norm: TellerRow = {};
          Object.keys(r).forEach((k) => {
            const kk = String(k).trim();
            norm[kk] = r[k];
          });
          // add id for React list keys
          norm.__id = `T-${Date.now()}-${i}`;
          return norm;
        })
      );
    } catch (err) {
      console.error("parseTellerFile error", err);
      alert("Failed to parse teller file. Ensure it's a valid Excel/CSV file and includes expected columns.");
    }
  };

  // Parse GL file (first sheet)
  const parseGLFile = async (file: File) => {
    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data, { type: "array", cellDates: true });
      const sheetName = wb.SheetNames[0];
      const sheet = wb.Sheets[sheetName];
      const json = XLSX.utils.sheet_to_json<GLRow>(sheet, { defval: "" });
      setGlRows(
        json.map((r, i) => {
          const norm: GLRow = {};
          Object.keys(r).forEach((k) => {
            const kk = String(k).trim();
            norm[kk] = r[k];
          });
          norm.__id = `G-${Date.now()}-${i}`;
          return norm;
        })
      );
    } catch (err) {
      console.error("parseGLFile error", err);
      alert("Failed to parse GL file. Ensure it's a valid Excel/CSV file.");
    }
  };

  // Upload handlers
  const handleTellerFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setTellerFile(f);
    if (f) parseTellerFile(f);
  };
  const handleGlFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setGlFile(f);
    if (f) parseGLFile(f);
  };

  // Filtered GL by User ID
  const filteredGL = useMemo(() => {
    if (!glFilterUser.trim()) return glRows;
    const q = glFilterUser.trim().toLowerCase();
    return glRows.filter((r) => {
      // check common user id header names
      const userVal =
        r["USER ID"] ?? r["USERID"] ?? r["USER"] ?? r["User"] ?? r["user"] ?? "";
      return String(userVal).toLowerCase().includes(q);
    });
  }, [glRows, glFilterUser]);

  // Totals computed from tellerRows - deposit, withdrawal, sell etc.
  const totals = useMemo(() => {
    // Try to handle various header names gracefully
    let totalDeposit = 0;
    let totalDeposit2 = 0;
    let totalWithdraw = 0;
    let totalToVault = 0;
    let totalExpense = 0;
    let totalWumt = 0;
    let totalFromVault = 0;

    tellerRows.forEach((r) => {
      // common names from user's spec
      totalDeposit += safeNumber(r["CASH DEP"] ?? r["CASH_DEP"] ?? r["CASH DEP "] ?? r["CASHDEP"]);
      totalDeposit2 += safeNumber(r["CASH DEP 2"] ?? r["CASH_DEP_2"] ?? r["CASHDEP2"]);
      totalWithdraw += safeNumber(r["SAVINGS WITHDR."] ?? r["SAVINGS_WITHDR"] ?? r["SAVINGSWITHDR"] ?? r["SAVINGS"]);
      totalToVault += safeNumber(r["TO VAULT"] ?? r["TOV AULT"] ?? r["TO_VAULT"]);
      totalExpense += safeNumber(r["EXPENSE"]);
      totalWumt += safeNumber(r["WUMT"]);
      totalFromVault += safeNumber(r["FROM VAULT"] ?? r["FROM_VAULT"]);
    });

    const totalCredits = totalDeposit + totalDeposit2 + totalFromVault + totalWumt;
    const totalDebits = totalWithdraw + totalToVault + totalExpense;

    return {
      totalDeposit,
      totalDeposit2,
      totalFromVault,
      totalWumt,
      totalWithdraw,
      totalToVault,
      totalExpense,
      totalCredits,
      totalDebits,
    };
  }, [tellerRows]);

  // Computed till balance: opening balance from teller (if present) + credits - debits - buyAmount
  const computedTillBalance = useMemo(() => {
    // find opening balance if any row has OPENING BALANCE
    const opening = tellerRows.reduce((acc, r) => {
      const v = r["OPENING BALANCE"] ?? r["OPENING_BALANCE"] ?? 0;
      return acc + safeNumber(v);
    }, 0);
    const buy = safeNumber(buyAmount);
    return opening + totals.totalCredits - totals.totalDebits - buy;
  }, [tellerRows, totals, buyAmount]);

  // Export currently visible dataset (teller or GL) plus metadata
  const handleExport = () => {
    const wb = XLSX.utils.book_new();
    const headerMeta = [
      ["Teller Name", tellerName || ""],
      ["Supervisor Name", supervisorName || ""],
      ["Buy Amount", String(buyAmount || "")],
      ["Computed Till Balance", String(computedTillBalance)],
      [],
    ];

    // Teller sheet
    const tellerSheetData = [
      ...headerMeta,
      ...(tellerRows.length ? [Object.keys(tellerRows[0])] : []),
      ...tellerRows.map((r) => Object.values(r)),
    ];
    const ws1 = XLSX.utils.aoa_to_sheet(tellerSheetData);
    XLSX.utils.book_append_sheet(wb, ws1, "Teller");

    // GL sheet
    const glSheetData = [
      ...(glRows.length ? [Object.keys(glRows[0])] : []),
      ...glRows.map((r) => Object.values(r)),
    ];
    const ws2 = XLSX.utils.aoa_to_sheet(glSheetData);
    XLSX.utils.book_append_sheet(wb, ws2, "GL");

    XLSX.writeFile(wb, `teller-proof-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // Dummy submit (just toggle state and export a CSV locally)
  const handleDummySubmit = () => {
    setDummySubmitted(true);
    // Create a combined CSV (teller rows + summary)
    const csvRows: string[] = [];
    // header
    csvRows.push(["TellerProof Export"].join(","));
    csvRows.push(["Teller Name", tellerName].join(","));
    csvRows.push(["Supervisor Name", supervisorName].join(","));
    csvRows.push(["Buy Amount", String(buyAmount)].join(","));
    csvRows.push(["Computed Till Balance", String(computedTillBalance)].join(","));
    csvRows.push("");
    // columns
    if (tellerRows.length) {
      const cols = Object.keys(tellerRows[0]);
      csvRows.push(cols.join(","));
      tellerRows.forEach((r) => {
        csvRows.push(cols.map((c) => `"${String(r[c] ?? "")}"`).join(","));
      });
    }
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `teller-proof-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    // small UX feedback
    setTimeout(() => setDummySubmitted(false), 1500);
  };

  // Helper to render preview table (first 50 rows)
  const PreviewTable: React.FC<{ data: any[] }> = ({ data }) => {
    if (!data || data.length === 0) {
      return <div className="p-4 text-sm text-muted-foreground">No rows to preview</div>;
    }
    const headers = Object.keys(data[0]).slice(0, 12); // limit columns for readability
    return (
      <div className="overflow-auto max-h-[420px] border rounded-lg bg-white">
        <table className="min-w-full">
          <thead className="bg-gradient-to-r from-blue-50 to-teal-50 sticky top-0">
            <tr>
              {headers.map((h) => (
                <th key={h} className="p-2 text-left text-xs font-semibold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.slice(0, 50).map((row, i) => (
              <tr key={row.__id ?? i} className={i % 2 ? "bg-white" : "bg-gray-50"}>
                {headers.map((h) => (
                  <td key={h} className="p-2 text-xs">{String(row[h] ?? "")}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="min-h-screen p-6 bg-gradient-to-br from-blue-50 to-teal-50">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="rounded-2xl bg-gradient-to-r from-blue-600 to-teal-500 text-white p-6 shadow-lg">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold">Teller Proof — Dashboard</h1>
              <p className="text-sm opacity-90">Upload Teller ("cast") & GL sheets, preview, filter and reconcile.</p>
            </div>
            <div className="flex gap-3 items-center">
              <Button onClick={handleExport} className="bg-white text-blue-600">
                <Download className="mr-2 h-4 w-4" /> Export
              </Button>
              <Button onClick={handleDummySubmit} className="bg-white text-teal-600">
                <Upload className="mr-2 h-4 w-4" /> Dummy Submit
              </Button>
            </div>
          </div>
        </div>

        {/* Top Inputs */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-lg bg-white p-4 shadow-sm">
            <Label>Teller Name</Label>
            <Input value={tellerName} onChange={(e) => setTellerName(e.target.value)} placeholder="Enter Teller Name" className="mt-2" />
          </div>
          <div className="rounded-lg bg-white p-4 shadow-sm">
            <Label>Supervisor Name</Label>
            <Input value={supervisorName} onChange={(e) => setSupervisorName(e.target.value)} placeholder="Enter Supervisor Name" className="mt-2" />
          </div>
        </div>

        {/* Uploads */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="rounded-lg bg-white p-4 shadow-sm flex flex-col gap-3">
            <Label className="font-medium">Teller Upload (sheet named "cast" or sheet2)</Label>
            <input type="file" accept=".xlsx,.xls,.csv" onChange={handleTellerFileChange} />
            <div className="text-sm text-muted-foreground">Expected columns: CHEQUES, ACCOUNT NO, SAVINGS WITHDR., ACCOUNT NO2, TO VAULT, EXPENSE, WUMT, OPENING BALANCE, CASH DEP, CASH DEP 2, FROM VAULT</div>
            <div className="mt-2">
              <div className="text-xs font-medium text-muted-foreground mb-2">Teller Preview</div>
              <PreviewTable data={tellerRows} />
            </div>
          </div>

          <div className="rounded-lg bg-white p-4 shadow-sm flex flex-col gap-3">
            <Label className="font-medium">GL Upload (raw)</Label>
            <input type="file" accept=".xlsx,.xls,.csv" onChange={handleGlFileChange} />
            <div className="text-sm text-muted-foreground">We extract TRANSACTION DATE, BRANCH NAME, ACCOUNT NUMBER, DR/CR, CURRENCY, LCY AMOUNT, USER ID, AUTHORISER ID, EXTERNAL REFERENCE</div>

            <div className="mt-2 space-y-2">
              <div className="flex gap-2">
                <Input placeholder="Filter GL by User ID" value={glFilterUser} onChange={(e) => setGlFilterUser(e.target.value)} />
                <Button variant="outline" onClick={() => setGlFilterUser("")}><Filter className="h-4 w-4 mr-1" /> Clear</Button>
              </div>

              <div className="text-xs font-medium text-muted-foreground">GL Preview</div>
              <PreviewTable data={filteredGL} />
            </div>
          </div>
        </div>

        {/* Views (4 buttons) */}
        <div className="rounded-lg bg-white p-4 shadow-sm">
          <div className="flex flex-wrap gap-3 mb-4">
            <Button variant={activeView === "tellerDebit" ? "default" : "outline"} onClick={() => setActiveView("tellerDebit")}>Teller Debit</Button>
            <Button variant={activeView === "tellerCredit" ? "default" : "outline"} onClick={() => setActiveView("tellerCredit")}>Teller Credit</Button>
            <Button variant={activeView === "glDebit" ? "default" : "outline"} onClick={() => setActiveView("glDebit")}>GL Debit</Button>
            <Button variant={activeView === "glCredit" ? "default" : "outline"} onClick={() => setActiveView("glCredit")}>GL Credit</Button>
          </div>

          {/* Active preview area */}
          <div>
            {activeView.startsWith("teller") ? (
              <div>
                <div className="mb-3 text-sm text-muted-foreground">Showing Teller rows (first 50). Use uploaded Teller file above to populate.</div>
                <PreviewTable data={tellerRows} />
              </div>
            ) : (
              <div>
                <div className="mb-3 text-sm text-muted-foreground">Showing GL rows (filtered by User ID if set). Use uploaded GL file above to populate.</div>
                <PreviewTable data={filteredGL} />
              </div>
            )}
          </div>
        </div>

        {/* Buy amount & computed balance */}
        <div className="rounded-lg bg-white p-4 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="w-full md:w-1/3">
            <Label>Buy Amount (₦)</Label>
            <Input type="number" value={buyAmount as any} onChange={(e) => setBuyAmount(e.target.value === "" ? "" : Number(e.target.value))} className="mt-2" />
          </div>

          <div className="w-full md:w-1/3 text-center">
            <div className="text-sm text-muted-foreground">Computed Till Balance</div>
            <div className={`mt-2 text-lg font-bold ${computedTillBalance < 0 ? "text-destructive" : "text-chart-3"}`}>
              ₦{Number(computedTillBalance || 0).toLocaleString()}
            </div>
            <div className="text-xs text-muted-foreground mt-1">Difference = Opening + Credits - Debits - Buy</div>
          </div>

          <div className="w-full md:w-1/3 flex gap-2 justify-end">
            <Button onClick={handleExport} className="bg-gradient-to-r from-blue-600 to-teal-500 text-white"><Download className="mr-2 h-4 w-4" /> Export All</Button>
            <Button variant="outline" onClick={handleDummySubmit} disabled={dummySubmitted}>{dummySubmitted ? "Submitted" : "Dummy Submit"}</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
