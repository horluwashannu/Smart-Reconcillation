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

type TellerRow = Record<string, any> & {
  ACCOUNT_NO?: string;
  SAVINGS_WITHDR?: number;
  CASH_DEP?: number;
  CASH_DEP_2?: number;
  FROM_VAULT?: number;
  TO_VAULT?: number;
  EXPENSE?: number;
  WUMT?: number;
  OPENING_BALANCE?: number;
  Column1?: string;
  __match?: boolean;
};

type GLRow = Record<string, any> & {
  AccountNo?: string;
  Amount?: number;
  Type?: string; // D / C
  User?: string;
  __match?: boolean;
};

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
  // UI state
  const [activeTab, setActiveTab] = useState<
    "teller_debit" | "teller_credit" | "gl_debit" | "gl_credit"
  >("teller_debit");

  // data
  const [tellerRows, setTellerRows] = useState<TellerRow[]>([]);
  const [glRows, setGlRows] = useState<GLRow[]>([]);
  const [filteredGlRows, setFilteredGlRows] = useState<GLRow[]>([]);

  // meta inputs
  const [tellerName, setTellerName] = useState("");
  const [supervisorName, setSupervisorName] = useState("");
  const [glFilterUser, setGlFilterUser] = useState("");

  // parse teller file (sheet 'cast' or fallback)
  const handleTellerUpload = async (file: File) => {
    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data, { type: "array", cellDates: true });
      const sheet = findCastSheet(wb);
      const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" }) as any[][];
      if (!raw || raw.length === 0) {
        alert("Empty Teller file.");
        return;
      }

      // find best header row: look for CHEQUES and ACCOUNT tokens
      const headerRowIndex = raw.findIndex((r) =>
        Array.isArray(r) &&
        r.some((c) => String(c || "").toLowerCase().replace(/\s+/g, "").includes("cheques")) &&
        r.some((c) => String(c || "").toLowerCase().replace(/\s+/g, "").includes("account"))
      );

      const header = (headerRowIndex >= 0 ? raw[headerRowIndex] : raw[0]).map((h: any) =>
        String(h || "").trim()
      );
      const dataRows = raw.slice(headerRowIndex >= 0 ? headerRowIndex + 1 : 1);

      const parsed: TellerRow[] = dataRows
        .filter((r) => r && r.some((c: any) => String(c || "").trim() !== ""))
        .map((r) => {
          const obj: Record<string, any> = {};
          header.forEach((h: string, i: number) => {
            const key = String(h || "").trim();
            if (key) obj[key] = r[i];
          });

          // normalize keys we care about (tolerant to many header spellings)
          const get = (names: string[]) => {
            for (const n of names) {
              if (obj[n] !== undefined) return obj[n];
              const alt = Object.keys(obj).find((k) => k.toLowerCase().replace(/\s+/g, "") === n.toLowerCase().replace(/\s+/g, ""));
              if (alt) return obj[alt];
            }
            return undefined;
          };

          const normalized: TellerRow = {
            ACCOUNT_NO: String(get(["ACCOUNT NO", "ACCOUNT_NO", "ACCOUNT", "Account"]) ?? "").trim(),
            OPENING_BALANCE: safeNumber(get(["OPENING BALANCE", "OPENING_BALANCE", "Opening Balance"])),
            CASH_DEP: safeNumber(get(["CASH DEP", "CASH_DEP", "CASHDEP"])),
            CASH_DEP_2: safeNumber(get(["CASH DEP 2", "CASH_DEP_2", "CASHDEP2"])),
            SAVINGS_WITHDR: safeNumber(get(["SAVINGS WITHDR.", "SAVINGS_WITHDR", "SAVINGSWITHDR", "SAVINGS"])),
            TO_VAULT: safeNumber(get(["TO VAULT", "TO_VAULT", "TOVAULT"])),
            FROM_VAULT: safeNumber(get(["FROM VAULT", "FROM_VAULT", "FROMVAULT"])),
            EXPENSE: safeNumber(get(["EXPENSE"])),
            WUMT: safeNumber(get(["WUMT"])),
            Column1: get(["Column1", "NARRATION", "Narration"]) ?? "",
            __match: false,
          };

          return normalized;
        });

      setTellerRows(parsed);
    } catch (err) {
      console.error(err);
      alert("Failed to parse Teller file. Ensure valid Excel/CSV and sheet contents.");
    }
  };

  // parse GL file (pick first sheet and detect headers)
  const handleGlUpload = async (file: File) => {
    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data, { type: "array", cellDates: true });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" }) as any[][];
      if (!raw || raw.length === 0) {
        alert("Empty GL file.");
        return;
      }

      // header row detection: prefer row containing 'account' and 'transaction'
      const headerRowIndex = raw.findIndex((r) =>
        Array.isArray(r) &&
        r.some((c) => String(c || "").toLowerCase().includes("account")) &&
        r.some((c) => String(c || "").toLowerCase().includes("transaction"))
      );

      const header = (headerRowIndex >= 0 ? raw[headerRowIndex] : raw[0]).map((h: any) =>
        String(h || "").trim().toLowerCase()
      );
      const dataRows = raw.slice(headerRowIndex >= 0 ? headerRowIndex + 1 : 1);

      const findIndex = (candidates: string[]) => {
        for (const c of candidates) {
          const idx = header.findIndex((h) => h.includes(c));
          if (idx >= 0) return idx;
        }
        return -1;
      };

      const idxAccount = findIndex(["accountnumber", "account number", "account no", "account"]);
      const idxAmount = findIndex(["lcy amount", "lcyamount", "lc y amount", "lcamount", "amount", "lc y"]);
      const idxDrCr = findIndex(["dr/cr", "drcr", "dr cr", "dr"]);
      const idxUser = findIndex(["userid", "user id", "user"]);
      const idxDate = findIndex(["transaction date", "transactiondate", "date"]);
      const idxBranch = findIndex(["branch name", "branch"]);
      const idxCurrency = findIndex(["currency"]);
      const idxAuthorizer = findIndex(["authoriser id", "authoriserid", "authorizer"]);
      const idxReference = findIndex(["external reference no", "externalreferenceno", "reference"]);

      const parsed: GLRow[] = dataRows
        .filter((r) => r && r.some((c: any) => String(c || "").trim() !== ""))
        .map((r) => {
          const account = idxAccount >= 0 ? String(r[idxAccount] ?? "") : "";
          const amount = idxAmount >= 0 ? safeNumber(r[idxAmount]) : 0;
          const drcrRaw = idxDrCr >= 0 ? String(r[idxDrCr] ?? "") : "";
          const drcr = drcrRaw.toUpperCase().includes("D") && !drcrRaw.toUpperCase().includes("C") ? "D" : (drcrRaw.toUpperCase().includes("C") ? "C" : "");
          return {
            Date: idxDate >= 0 ? String(r[idxDate] ?? "") : "",
            Branch: idxBranch >= 0 ? String(r[idxBranch] ?? "") : "",
            AccountNo: account.trim(),
            Type: drcr,
            Currency: idxCurrency >= 0 ? String(r[idxCurrency] ?? "") : "",
            Amount: amount,
            User: idxUser >= 0 ? String(r[idxUser] ?? "") : "",
            Authorizer: idxAuthorizer >= 0 ? String(r[idxAuthorizer] ?? "") : "",
            Reference: idxReference >= 0 ? String(r[idxReference] ?? "") : "",
            __match: false,
          };
        });

      setGlRows(parsed);
      setFilteredGlRows(parsed);
    } catch (err) {
      console.error(err);
      alert("Failed to parse GL file. Ensure it's a valid Excel/CSV export.");
    }
  };

  // filter GL by user id
  useEffect(() => {
    if (!glFilterUser.trim()) {
      setFilteredGlRows(glRows);
      return;
    }
    const q = glFilterUser.trim().toLowerCase();
    setFilteredGlRows(glRows.filter((g) => String(g.User || "").toLowerCase().includes(q)));
  }, [glFilterUser, glRows]);

  // Matching logic for both sides (run whenever GL or teller data changes)
  useEffect(() => {
    // build two maps from filtered GL: debit map and credit map
    const debitMap = new Map<string, number>();
    const creditMap = new Map<string, number>();

    for (const g of filteredGlRows) {
      const key = `${String(g.AccountNo || "").trim()}|${safeNumber(g.Amount)}`;
      if ((g.Type || "").toUpperCase() === "D") {
        debitMap.set(key, (debitMap.get(key) || 0) + 1);
      } else if ((g.Type || "").toUpperCase() === "C") {
        creditMap.set(key, (creditMap.get(key) || 0) + 1);
      } else {
        // if Type not specified, include in both maps (best-effort) so matches can be found
        debitMap.set(key, (debitMap.get(key) || 0) + 1);
        creditMap.set(key, (creditMap.get(key) || 0) + 1);
      }
    }

    // match teller rows: compute teller-side debit amount and credit amount, mark __match accordingly
    const updatedTellers = tellerRows.map((t) => {
      // teller debit amount usually from savings withdrawal, to_vault, expense
      const tellerDebit =
        safeNumber(t.SAVINGS_WITHDR) + safeNumber(t.TO_VAULT) + safeNumber(t.EXPENSE);
      // teller credit amount from cash dep fields, from vault, wumt
      const tellerCredit =
        safeNumber(t.CASH_DEP) + safeNumber(t.CASH_DEP_2) + safeNumber(t.FROM_VAULT) + safeNumber(t.WUMT);

      const acct = String(t.ACCOUNT_NO || "").trim();

      const debitKey = `${acct}|${tellerDebit}`;
      const creditKey = `${acct}|${tellerCredit}`;

      // preferred match based on activeTab context later, but we mark matched if either side matches
      const matchedDebit = tellerDebit !== 0 && (debitMap.get(debitKey) || 0) > 0;
      if (matchedDebit) debitMap.set(debitKey, debitMap.get(debitKey)! - 1);

      const matchedCredit = tellerCredit !== 0 && (creditMap.get(creditKey) || 0) > 0;
      if (matchedCredit) creditMap.set(creditKey, creditMap.get(creditKey)! - 1);

      // if either matched, mark true
      return { ...t, __match: !!(matchedDebit || matchedCredit) };
    });

    setTellerRows(updatedTellers);

    // mark GL rows matched if a teller exists with same key (best-effort)
    const newGl = filteredGlRows.map((g) => {
      const key = `${String(g.AccountNo || "").trim()}|${safeNumber(g.Amount)}`;
      const inTeller = updatedTellers.some((t) => {
        const tDebit = safeNumber(t.SAVINGS_WITHDR) + safeNumber(t.TO_VAULT) + safeNumber(t.EXPENSE);
        const tCredit = safeNumber(t.CASH_DEP) + safeNumber(t.CASH_DEP_2) + safeNumber(t.FROM_VAULT) + safeNumber(t.WUMT);
        return key === `${String(t.ACCOUNT_NO || "").trim()}|${tDebit}` || key === `${String(t.ACCOUNT_NO || "").trim()}|${tCredit}`;
      });
      return { ...g, __match: !!inTeller };
    });
    setFilteredGlRows(newGl);
  }, [filteredGlRows.length, glRows.length, tellerRows.length]); // rerun when key arrays change

  // current view data (for preview)
  const currentPreview = useMemo(() => {
    if (activeTab.startsWith("teller")) return tellerRows;
    return filteredGlRows;
  }, [activeTab, tellerRows, filteredGlRows]);

  // export combined file
  const handleExportAll = () => {
    const wb = XLSX.utils.book_new();
    const t = tellerRows.length ? XLSX.utils.json_to_sheet(tellerRows) : XLSX.utils.aoa_to_sheet([["No Teller Data"]]);
    const g = glRows.length ? XLSX.utils.json_to_sheet(glRows) : XLSX.utils.aoa_to_sheet([["No GL Data"]]);
    XLSX.utils.book_append_sheet(wb, t, "Teller");
    XLSX.utils.book_append_sheet(wb, g, "GL");
    XLSX.writeFile(wb, `teller-proof-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // helper to produce safe header list
  const renderHeaders = (row: Record<string, any>) => {
    const keys = Object.keys(row);
    // prioritize some human headers if present
    const preferredOrder = ["ACCOUNT_NO", "AccountNo", "ACCOUNT NO", "Column1", "NARRATION", "Amount", "Type", "User", "Date"];
    const ordered = Array.from(new Set([...preferredOrder.filter((k) => keys.includes(k)), ...keys]));
    // limit to first 12 columns to avoid overflow in header row
    return ordered.slice(0, 12);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-teal-100 p-6">
      <Card className="max-w-7xl mx-auto shadow-xl border-none rounded-2xl">
        <CardHeader className="bg-gradient-to-r from-blue-600 to-teal-500 text-white rounded-t-2xl p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="text-2xl font-bold">Teller Proof Dashboard</CardTitle>
              <CardDescription className="text-blue-100">
                Upload Teller (cast) and GL files — switch views, filter GL, and auto-match.
              </CardDescription>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleExportAll} className="bg-white text-blue-600">
                <Download className="mr-2 h-4 w-4" /> Export All
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-6 space-y-6">
          {/* Uploaders */}
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <Label>Teller (CAST) Sheet</Label>
              <Input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => e.target.files?.[0] && handleTellerUpload(e.target.files[0])} />
              {tellerRows.length > 0 && <Badge className="mt-2 bg-green-600">{tellerRows.length} Teller Rows Loaded</Badge>}
            </div>

            <div>
              <Label>GL Sheet</Label>
              <Input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => e.target.files?.[0] && handleGlUpload(e.target.files[0])} />
              {glRows.length > 0 && <Badge className="mt-2 bg-blue-600">{glRows.length} GL Rows Loaded</Badge>}
            </div>
          </div>

          {/* Tabs / View Buttons */}
          <div className="flex flex-wrap justify-center gap-3 mt-6">
            {[
              { key: "teller_debit", label: "Teller Debit" },
              { key: "teller_credit", label: "Teller Credit" },
              { key: "gl_debit", label: "GL Debit" },
              { key: "gl_credit", label: "GL Credit" },
            ].map((t) => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key as any)}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-all ${
                  activeTab === t.key ? "bg-gradient-to-r from-sky-600 to-teal-400 text-white shadow-lg" : "bg-transparent text-muted-foreground hover:bg-muted/10"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* GL Filter */}
          {activeTab.startsWith("gl") && (
            <div className="flex items-center justify-center gap-3 mt-4">
              <Input placeholder="Filter GL by User ID" value={glFilterUser} onChange={(e) => setGlFilterUser(e.target.value)} className="w-64" />
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

          {/* Preview area (scrollable) */}
          <div className="overflow-auto border rounded-xl bg-white shadow-inner mt-6 max-h-[720px]">
            {currentPreview.length === 0 ? (
              <div className="p-8 text-center text-gray-500">No data available for this view.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    {renderHeaders(currentPreview[0]).map((h) => (
                      <TableHead key={h}>{h}</TableHead>
                    ))}
                    {activeTab.startsWith("teller") && <TableHead>Match</TableHead>}
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {currentPreview.map((row, rIdx) => {
                    const headers = renderHeaders(row);
                    // highlight row if matched (teller) or if GL matched
                    const isMatched = !!row.__match;
                    return (
                      <TableRow key={rIdx} className={isMatched ? "bg-green-50" : ""}>
                        {headers.map((k) => (
                          <TableCell key={k}>{String(row[k] ?? "")}</TableCell>
                        ))}
                        {activeTab.startsWith("teller") && (
                          <TableCell>
                            {isMatched ? (
                              <Badge className="bg-green-100 text-green-800">Matched</Badge>
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
            <Button onClick={handleExportAll} className="bg-gradient-to-r from-blue-600 to-teal-500 text-white">
              <Download className="mr-2 h-4 w-4" /> Export Result
            </Button>

            <Button variant="outline" onClick={() => alert("Dummy Submit Successful ✅")}>Dummy Submit</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
