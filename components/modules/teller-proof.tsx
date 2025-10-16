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
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Download } from "lucide-react";
import {
  Table,
  TableBody,
  TableHeader,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";

type TellerRow = Record<string, any> & { __match?: boolean };
type GLRow = Record<string, any>;

const safeNumber = (v: any) => {
  if (v === null || v === undefined || v === "") return 0;
  const s = String(v).replace(/[,₦$ ]/g, "").trim();
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
};

const findCastSheet = (wb: XLSX.WorkBook) => {
  const found = wb.SheetNames.find((n) => n.toLowerCase().trim() === "cast");
  if (found) return wb.Sheets[found];
  if (wb.SheetNames.length >= 2) return wb.Sheets[wb.SheetNames[1]];
  return wb.Sheets[wb.SheetNames[0]];
};

export default function TellerProof(): JSX.Element {
  const [activeTab, setActiveTab] = useState<
    "teller_debit" | "teller_credit" | "gl_debit" | "gl_credit"
  >("teller_debit");

  const [tellerRows, setTellerRows] = useState<TellerRow[]>([]);
  const [glRows, setGlRows] = useState<GLRow[]>([]);
  const [filteredGl, setFilteredGl] = useState<GLRow[]>([]);

  const [tellerName, setTellerName] = useState("");
  const [supervisorName, setSupervisorName] = useState("");
  const [glFilterUser, setGlFilterUser] = useState("");

  // --- file parsing ---
  const parseTellerFile = async (file: File) => {
    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data, { type: "array", cellDates: true });
      const sheet = findCastSheet(wb);
      const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" }) as any[][];
      if (!raw || raw.length === 0) {
        alert("Teller file appears empty.");
        return;
      }
      // locate header row (best-effort)
      const headerRowIndex = raw.findIndex((r) =>
        r.some((c: any) =>
          String(c || "").toLowerCase().replace(/\s+/g, "").includes("cheques")
        ) && r.some((c: any) => String(c || "").toLowerCase().replace(/\s+/g, "").includes("account"))
      );
      const header = (headerRowIndex >= 0 ? raw[headerRowIndex] : raw[0]).map((h: any) =>
        String(h || "").trim()
      );
      const dataRows = raw.slice(headerRowIndex >= 0 ? headerRowIndex + 1 : 1);
      const parsed: TellerRow[] = dataRows
        .filter((r) => r && r.some((c: any) => String(c || "").trim() !== ""))
        .map((r, i) => {
          const obj: any = {};
          header.forEach((h: string, idx: number) => {
            const key = String(h || "").trim();
            if (!key) return;
            obj[key] = r[idx];
          });
          // Normalize keys used in UI
          const normalized: TellerRow = {
            ACCOUNT_NO: obj["ACCOUNT NO"] ?? obj["ACCOUNT_NO"] ?? obj["ACCOUNT"] ?? obj["Account"] ?? "",
            OPENING_BALANCE: safeNumber(obj["OPENING BALANCE"] ?? obj["OPENING_BALANCE"] ?? obj["Opening Balance"]),
            CASH_DEP: safeNumber(obj["CASH DEP"] ?? obj["CASH_DEP"] ?? obj["CASHDEP"]),
            CASH_DEP_2: safeNumber(obj["CASH DEP 2"] ?? obj["CASH_DEP_2"] ?? obj["CASHDEP2"]),
            SAVINGS_WITHDR: safeNumber(obj["SAVINGS WITHDR."] ?? obj["SAVINGS_WITHDR"] ?? obj["SAVINGSWITHDR"] ?? obj["SAVINGS"]),
            TO_VAULT: safeNumber(obj["TO VAULT"] ?? obj["TO_VAULT"]),
            FROM_VAULT: safeNumber(obj["FROM VAULT"] ?? obj["FROM_VAULT"]),
            EXPENSE: safeNumber(obj["EXPENSE"]),
            WUMT: safeNumber(obj["WUMT"]),
            Column1: obj["Column1"] ?? obj["NARRATION"] ?? obj["Narration"] ?? "",
            __match: false,
          };
          return normalized;
        });
      setTellerRows(parsed);
    } catch (err) {
      console.error(err);
      alert("Failed to parse Teller file. Ensure it's a valid Excel/CSV with 'cast' sheet or similar layout.");
    }
  };

  const parseGlFile = async (file: File) => {
    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data, { type: "array", cellDates: true });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" }) as any[][];
      if (!raw || raw.length === 0) {
        alert("GL file appears empty.");
        return;
      }
      // find header row index that contains 'account' and 'transaction' tokens if possible
      const headerRowIndex = raw.findIndex((r) =>
        r.some((c: any) => String(c || "").toLowerCase().includes("account")) &&
        r.some((c: any) => String(c || "").toLowerCase().includes("transaction"))
      );
      const header = (headerRowIndex >= 0 ? raw[headerRowIndex] : raw[0]).map((h: any) =>
        String(h || "").trim().toLowerCase()
      );
      const dataRows = raw.slice(headerRowIndex >= 0 ? headerRowIndex + 1 : 1);
      const parsed: GLRow[] = dataRows
        .filter((r) => r && r.some((c: any) => String(c || "").trim() !== ""))
        .map((r) => {
          const findIndex = (candidates: string[]) => {
            for (const c of candidates) {
              const idx = header.findIndex((h) => h.includes(c));
              if (idx >= 0) return idx;
            }
            return -1;
          };
          const idxAccount = findIndex(["accountnumber", "account number", "account no", "account"]);
          const idxAmount = findIndex(["lcy amount", "lcyamount", "amount", "lc y amount", "lcamount"]);
          const idxDate = findIndex(["transaction date", "transactiondate", "date"]);
          const idxUser = findIndex(["user id", "userid", "user"]);
          const idxAuth = findIndex(["authoriser id", "authoriserid", "authorizer"]);
          const idxDrCr = findIndex(["dr/cr", "drcr"]);
          const idxCurrency = findIndex(["currency"]);
          const idxRef = findIndex(["external reference no", "externalreferenceno", "reference", "external reference"]);
          return {
            Date: idxDate >= 0 ? r[idxDate] : "",
            Branch: (header.includes("branch name") ? r[header.indexOf("branch name")] : r[findIndex(["branch"])]) ?? "",
            AccountNo: idxAccount >= 0 ? String(r[idxAccount] ?? "") : "",
            Type: idxDrCr >= 0 ? String(r[idxDrCr] ?? "") : "",
            Currency: idxCurrency >= 0 ? String(r[idxCurrency] ?? "") : "",
            Amount: idxAmount >= 0 ? safeNumber(r[idxAmount]) : 0,
            User: idxUser >= 0 ? String(r[idxUser] ?? "") : "",
            Authorizer: idxAuth >= 0 ? String(r[idxAuth] ?? "") : "",
            Reference: idxRef >= 0 ? String(r[idxRef] ?? "") : "",
          };
        });
      setGlRows(parsed);
      setFilteredGl(parsed);
    } catch (err) {
      console.error(err);
      alert("Failed to parse GL file. Ensure it's a valid Excel/CSV export.");
    }
  };

  // GL filter by user
  useEffect(() => {
    if (!glFilterUser.trim()) {
      setFilteredGl(glRows);
      return;
    }
    const q = glFilterUser.trim().toLowerCase();
    setFilteredGl(glRows.filter((g) => String(g.User || "").toLowerCase().includes(q)));
  }, [glFilterUser, glRows]);

  // Matching logic: mark teller rows matched if GL has same AccountNo + Amount
  useEffect(() => {
    if (tellerRows.length === 0 || filteredGl.length === 0) {
      // clear matches
      setTellerRows((prev) => prev.map((r) => ({ ...r, __match: false })));
      return;
    }
    // build map of GL keys => counts
    const map = new Map<string, number>();
    filteredGl.forEach((g) => {
      const key = `${String(g.AccountNo || "").trim()}|${safeNumber(g.Amount)}`;
      map.set(key, (map.get(key) || 0) + 1);
    });
    const updated = tellerRows.map((r) => {
      const acct = String(r.ACCOUNT_NO || "").trim();
      // try to infer teller amount from likely fields (savings withdrawal, cash dep, etc.)
      const amt =
        safeNumber(r.SAVINGS_WITHDR) ||
        safeNumber(r.CASH_DEP) ||
        safeNumber(r.CASH_DEP_2) ||
        safeNumber(r.FROM_VAULT) ||
        safeNumber(r.TO_VAULT) ||
        safeNumber(r.EXPENSE) ||
        safeNumber(r.WUMT) ||
        0;
      const key = `${acct}|${amt}`;
      const matched = map.get(key) && map.get(key)! > 0;
      // If matched, decrease count so multiple teller rows don't match same GL row artificially
      if (matched) {
        map.set(key, (map.get(key) || 1) - 1);
      }
      return { ...r, __match: !!matched };
    });
    setTellerRows(updated);
  }, [filteredGl, tellerRows.length]); // re-run when filtered GL changes or teller rows initially present

  // Export both sheets to workbook
  const handleExport = () => {
    const wb = XLSX.utils.book_new();
    const tSheet = tellerRows.length ? XLSX.utils.json_to_sheet(tellerRows) : XLSX.utils.aoa_to_sheet([["No Teller Data"]]);
    const gSheet = glRows.length ? XLSX.utils.json_to_sheet(glRows) : XLSX.utils.aoa_to_sheet([["No GL Data"]]);
    XLSX.utils.book_append_sheet(wb, tSheet, "Teller");
    XLSX.utils.book_append_sheet(wb, gSheet, "GL");
    XLSX.writeFile(wb, `teller-proof-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // current preview data
  const currentData = useMemo(() => {
    return activeTab.startsWith("teller") ? tellerRows : filteredGl;
  }, [activeTab, tellerRows, filteredGl]);

  // Helper render table header cells (limit to first 10 columns for readability)
  const renderTableHeader = (row: Record<string, any>) => {
    const keys = Object.keys(row).slice(0, 10);
    // if teller rows, add Match column
    const extra = activeTab.startsWith("teller") ? ["Match"] : [];
    return [...keys, ...extra];
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-teal-100 p-6">
      <Card className="max-w-7xl mx-auto shadow-xl border-none rounded-2xl">
        <CardHeader className="bg-gradient-to-r from-blue-600 to-teal-500 text-white rounded-t-2xl p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle className="text-2xl font-bold">Teller Proof Dashboard</CardTitle>
              <CardDescription className="text-blue-100">
                Upload Teller "cast" sheet and GL export — previews, filter and auto-match.
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleExport} className="bg-white text-blue-600">
                <Download className="mr-2 h-4 w-4" /> Export
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-6 space-y-6">
          {/* Uploaders */}
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <Label>Teller (CAST) Sheet</Label>
              <Input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => e.target.files?.[0] && parseTellerFile(e.target.files[0])} />
              {tellerRows.length > 0 && <Badge className="mt-2 bg-green-600">{tellerRows.length} Teller Rows Loaded</Badge>}
            </div>

            <div>
              <Label>GL Sheet</Label>
              <Input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => e.target.files?.[0] && parseGlFile(e.target.files[0])} />
              {glRows.length > 0 && <Badge className="mt-2 bg-blue-600">{glRows.length} GL Rows Loaded</Badge>}
            </div>
          </div>

          {/* View Buttons */}
          <div className="flex flex-wrap justify-center gap-3 mt-6">
            {["teller_debit", "teller_credit", "gl_debit", "gl_credit"].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-all ${
                  activeTab === tab ? "bg-gradient-to-r from-sky-600 to-teal-400 text-white shadow-lg" : "bg-transparent text-muted-foreground hover:bg-muted/10"
                }`}
              >
                {tab.replace("_", " ").toUpperCase()}
              </button>
            ))}
          </div>

          {/* GL Filter (visible on GL tabs) */}
          {activeTab.includes("gl") && (
            <div className="flex flex-wrap gap-3 items-center justify-center mt-4">
              <Input placeholder="Filter by User ID" value={glFilterUser} onChange={(e) => setGlFilterUser(e.target.value)} className="w-60" />
              <Button onClick={() => setGlFilterUser("")} variant="outline">Clear</Button>
            </div>
          )}

          {/* Teller & Supervisor */}
          <div className="grid md:grid-cols-2 gap-4 mt-6">
            <div>
              <Label>Teller Name</Label>
              <Input placeholder="Enter Teller Name" value={tellerName} onChange={(e) => setTellerName(e.target.value)} />
            </div>
            <div>
              <Label>Supervisor Name</Label>
              <Input placeholder="Enter Supervisor Name" value={supervisorName} onChange={(e) => setSupervisorName(e.target.value)} />
            </div>
          </div>

          {/* Preview (scrollable) */}
          <div className="overflow-auto border rounded-xl bg-white shadow-inner mt-6 max-h-[620px]">
            {currentData.length === 0 ? (
              <div className="p-8 text-center text-gray-500">No data for this view.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    {renderTableHeader(currentData[0]).map((h) => (
                      <TableHead key={h}>{h}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {currentData.map((row, idx) => {
                    const keys = Object.keys(row).slice(0, 10);
                    return (
                      <TableRow key={idx} className={activeTab.startsWith("teller") && row.__match ? "bg-green-50" : ""}>
                        {keys.map((k) => (
                          <TableCell key={k}>{String(row[k] ?? "")}</TableCell>
                        ))}
                        {activeTab.startsWith("teller") && (
                          <TableCell>
                            {row.__match ? (
                              <Badge className="bg-green-100 text-green-700">Matched</Badge>
                            ) : (
                              <Badge variant="outline" className="text-destructive">Unmatched</Badge>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-center gap-4 mt-8 flex-wrap">
            <Button onClick={handleExport} className="bg-gradient-to-r from-blue-600 to-teal-500 text-white">
              <Download className="mr-2 h-4 w-4" /> Export Result
            </Button>
            <Button variant="outline" onClick={() => alert("Submitted Successfully ✅")}>Dummy Submit</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
