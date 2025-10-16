// /components/TellerGLReconciliation.tsx
"use client";

import React, { useMemo, useState } from "react";
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
import { Download, Upload, CheckCircle2, AlertTriangle } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { BranchInfo } from "@/components/branch-info";

type TellerRow = {
  id: string;
  ACCOUNT_NO?: string;
  NARRATION?: string;
  CHEQUES?: number;
  SAVINGS_WITHDR?: number;
  TO_VAULT?: number;
  EXPENSE?: number;
  WUMT?: number;
  OPENING_BALANCE?: number;
  CASH_DEP?: number;
  CASH_DEP_2?: number;
  FROM_VAULT?: number;
  // meta
  side?: "debit" | "credit";
  matched?: boolean;
  matchKey?: string;
  raw?: any;
};

type GLRow = {
  id: string;
  Date?: string;
  Branch?: string;
  AccountNo?: string;
  Type?: string; // D / C
  Currency?: string;
  Amount?: number;
  User?: string;
  Authorizer?: string;
  Reference?: string;
  matched?: boolean;
  matchKey?: string;
  raw?: any;
};

export default function TellerGLReconciliation() {
  // meta
  const [branchCode, setBranchCode] = useState("");
  const [branchName, setBranchName] = useState("");
  const [country, setCountry] = useState("");

  // uploader states
  const [tellerFileName, setTellerFileName] = useState<string | null>(null);
  const [glFileName, setGlFileName] = useState<string | null>(null);

  // parsed data
  const [tellerRows, setTellerRows] = useState<TellerRow[]>([]);
  const [glRows, setGlRows] = useState<GLRow[]>([]);

  // UI
  const [activeTab, setActiveTab] = useState<
    "teller_debit" | "teller_credit" | "gl_debit" | "gl_credit"
  >("teller_debit");
  const [tellerName, setTellerName] = useState("");
  const [supervisorName, setSupervisorName] = useState("");
  const [glFilterUser, setGlFilterUser] = useState("");

  // small helper: robust number parse (digit-by-digit)
  const safeNumber = (v: any) => {
    if (v === null || v === undefined || v === "") return 0;
    const s = String(v).replace(/[,₦€$]/g, "").trim();
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
  };

  // find 'cast' sheet or fallback
  const findCastSheet = (wb: XLSX.WorkBook) => {
    const found = wb.SheetNames.find((n) => n.toLowerCase().trim() === "cast");
    if (found) return wb.Sheets[found];
    if (wb.SheetNames.length >= 2) return wb.Sheets[wb.SheetNames[1]];
    return wb.Sheets[wb.SheetNames[0]];
  };

  // parse teller (expects columns like the ones you gave)
  const parseTellerFile = async (file: File) => {
    try {
      const ab = await file.arrayBuffer();
      const wb = XLSX.read(ab, { type: "array", cellDates: true });
      const sheet = findCastSheet(wb);
      const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" }) as any[][];
      if (!raw || raw.length === 0) {
        alert("Teller file appears empty.");
        return;
      }

      // find header row by looking for CHEQUES and ACCOUNT keywords
      let headerIdx = 0;
      for (let i = 0; i < Math.min(6, raw.length); i++) {
        const row = raw[i];
        const joined = row.join(" ").toLowerCase();
        if (joined.includes("cheques") && joined.includes("account")) {
          headerIdx = i;
          break;
        }
      }
      const headerRow = (raw[headerIdx] || raw[0]).map((h: any) => String(h || "").trim());
      const dataRows = raw.slice(headerIdx + 1);

      const parsed: TellerRow[] = dataRows
        .filter((r) => r && r.some((c: any) => String(c).trim() !== ""))
        .map((r, i) => {
          const obj: Record<string, any> = {};
          headerRow.forEach((h: string, idx: number) => {
            const key = String(h || "").replace(/\s+/g, "_").toUpperCase();
            obj[key] = r[idx];
          });

          const acc =
            obj["ACCOUNT_NO"] ||
            obj["ACCOUNT NO"] ||
            obj["ACCOUNT"] ||
            obj["ACCOUNTNUMBER"] ||
            obj["ACCOUNT_NO2"] ||
            "";

          // determine primary amount for matching: for teller we attempt find a non-zero amount
          const debitAmount =
            safeNumber(obj["SAVINGS_WITHDR"] || obj["SAVINGS WITHDR"] || obj["SAVINGS"]) +
            safeNumber(obj["TO_VAULT"]) +
            safeNumber(obj["EXPENSE"]);
          const creditAmount =
            safeNumber(obj["CASH_DEP"]) + safeNumber(obj["CASH_DEP_2"]) + safeNumber(obj["FROM_VAULT"]) + safeNumber(obj["WUMT"]);

          const side: "debit" | "credit" = debitAmount > 0 && creditAmount === 0 ? "debit" : creditAmount > 0 && debitAmount === 0 ? "credit" : debitAmount >= creditAmount ? "debit" : "credit";

          const amountForMatch = side === "debit" ? Math.abs(debitAmount) : Math.abs(creditAmount);

          return {
            id: `T-${Date.now()}-${i}`,
            ACCOUNT_NO: String(acc).trim(),
            NARRATION: obj["NARRATION"] || obj["Column1"] || "",
            CHEQUES: safeNumber(obj["CHEQUES"]),
            SAVINGS_WITHDR: safeNumber(obj["SAVINGS_WITHDR"] || obj["SAVINGS WITHDR"]),
            TO_VAULT: safeNumber(obj["TO_VAULT"]),
            EXPENSE: safeNumber(obj["EXPENSE"]),
            WUMT: safeNumber(obj["WUMT"]),
            OPENING_BALANCE: safeNumber(obj["OPENING_BALANCE"]),
            CASH_DEP: safeNumber(obj["CASH_DEP"]),
            CASH_DEP_2: safeNumber(obj["CASH_DEP_2"]),
            FROM_VAULT: safeNumber(obj["FROM_VAULT"]),
            side,
            matched: false,
            matchKey: `${String(acc).replace(/\s+/g, "")}|${Number(amountForMatch).toFixed(2)}`,
            raw: r,
          } as TellerRow;
        });

      setTellerFileName(file.name);
      setTellerRows(parsed);
    } catch (err) {
      console.error(err);
      alert("Failed to parse Teller file. Ensure the file is valid Excel/CSV and contains expected headers.");
    }
  };

  // parse GL file
  const parseGlFile = async (file: File) => {
    try {
      const ab = await file.arrayBuffer();
      const wb = XLSX.read(ab, { type: "array", cellDates: true });
      // pick sheet that likely contains headers - fallback to first
      let sheet = wb.Sheets[wb.SheetNames[0]];
      for (const name of wb.SheetNames) {
        const s = wb.Sheets[name];
        const preview = XLSX.utils.sheet_to_json(s, { header: 1, defval: "", range: 0 }) as any[][];
        const joined = (preview[0] || []).join(" ").toLowerCase();
        if (joined.includes("transaction") && joined.includes("account")) {
          sheet = s;
          break;
        }
      }

      const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" }) as any[][];
      if (!raw || raw.length === 0) {
        alert("GL file appears empty.");
        return;
      }

      // detect header
      let headerIdx = 0;
      for (let i = 0; i < Math.min(6, raw.length); i++) {
        const row = raw[i].map((c: any) => String(c || "").toLowerCase());
        if (row.some((c: string) => c.includes("account")) && row.some((c: string) => c.includes("transaction"))) {
          headerIdx = i;
          break;
        }
      }
      const headerRow = (raw[headerIdx] || raw[0]).map((h: any) => String(h || "").trim());
      const dataRows = raw.slice(headerIdx + 1);

      // build index map for header name lookups
      const headerMap: Record<string, number> = {};
      headerRow.forEach((h: string, idx: number) => {
        headerMap[String(h || "").toLowerCase().replace(/\s+/g, "")] = idx;
      });

      const findIndex = (candidates: string[]) => {
        for (const c of candidates) {
          const key = c.toLowerCase().replace(/\s+/g, "");
          if (headerMap[key] !== undefined) return headerMap[key];
        }
        return -1;
      };

      const idxTransactionDate = findIndex(["transactiondate", "transaction date", "transaction_date"]);
      const idxBranch = findIndex(["branchname", "branch"]);
      const idxAccount = findIndex(["accountnumber", "account number", "accountno", "account"]);
      const idxDrCr = findIndex(["dr/cr", "drcr", "dr", "cr", "drcr.", "dr"]);
      const idxCurrency = findIndex(["currency"]);
      const idxLcy = findIndex(["lcya amount", "lcy amount", "lcyamount", "lc y amount", "lcamount", "lcyamount"]);
      const idxAmount = idxLcy >= 0 ? idxLcy : findIndex(["amount", "lcamount", "lcyamount", "fc y amount"]);
      const idxUser = findIndex(["userid", "user id", "user"]);
      const idxAuthorizer = findIndex(["authoriserid", "authoriser id", "authorizer", "authoriser"]);
      const idxRef = findIndex(["externalreferenceno", "external reference no", "reference", "externalreference"]);

      const parsed: GLRow[] = dataRows
        .filter((r) => r && r.some((c: any) => String(c).trim() !== ""))
        .map((r, i) => {
          const acc = idxAccount >= 0 ? String(r[idxAccount] || "").trim() : "";
          const amt = idxAmount >= 0 ? safeNumber(r[idxAmount]) : 0;
          const drcr = idxDrCr >= 0 ? String(r[idxDrCr] || "").trim() : "";
          const date = idxTransactionDate >= 0 ? String(r[idxTransactionDate] || "") : "";
          const br = idxBranch >= 0 ? String(r[idxBranch] || "") : "";
          const user = idxUser >= 0 ? String(r[idxUser] || "") : "";
          const authorizer = idxAuthorizer >= 0 ? String(r[idxAuthorizer] || "") : "";
          const ref = idxRef >= 0 ? String(r[idxRef] || "") : "";

          return {
            id: `G-${Date.now()}-${i}`,
            Date: date,
            Branch: br,
            AccountNo: String(acc),
            Type: drcr,
            Currency: idxCurrency >= 0 ? String(r[idxCurrency] || "") : undefined,
            Amount: amt,
            User: user,
            Authorizer: authorizer,
            Reference: ref,
            matched: false,
            matchKey: `${String(acc).replace(/\s+/g, "")}|${Number(Math.abs(amt)).toFixed(2)}`,
            raw: r,
          } as GLRow;
        });

      setGlFileName(file.name);
      setGlRows(parsed);
    } catch (err) {
      console.error(err);
      alert("Failed to parse GL file. Ensure it's valid Excel/CSV file.");
    }
  };

  // filter GL by user id (case-insensitive)
  const filteredGLByUser = useMemo(() => {
    if (!glFilterUser.trim()) return glRows;
    return glRows.filter((g) => String(g.User || "").toLowerCase().includes(glFilterUser.toLowerCase()));
  }, [glRows, glFilterUser]);

  // Matching logic (AccountNo + Amount):
  // Run whenever tellerRows or glRows change
  const runMatching = () => {
    if (tellerRows.length === 0 && glRows.length === 0) return;

    // index gl by matchKey -> store array indices
    const glIndex: Record<string, number[]> = {};
    glRows.forEach((g, idx) => {
      const k = g.matchKey || `${String(g.AccountNo || "").replace(/\s+/g, "")}|0.00`;
      glIndex[k] = glIndex[k] || [];
      glIndex[k].push(idx);
    });

    // new copies
    const newGl = glRows.map((g) => ({ ...g, matched: false }));
    const newTeller = tellerRows.map((t) => ({ ...t, matched: false }));

    // match teller -> gl by exact keys (first available)
    newTeller.forEach((t, tIdx) => {
      const k = t.matchKey || `${String(t.ACCOUNT_NO || "").replace(/\s+/g, "")}|0.00`;
      const candidates = glIndex[k] || [];
      if (candidates.length > 0) {
        // use first candidate not yet matched
        const foundIdx = candidates.find((gi) => !newGl[gi].matched);
        if (foundIdx !== undefined) {
          newTeller[tIdx].matched = true;
          newGl[foundIdx].matched = true;
        }
      }
    });

    setTellerRows(newTeller);
    setGlRows(newGl);
  };

  // compute totals per side and per file
  const totals = useMemo(() => {
    const tellerDebit = tellerRows.reduce((s, r) => {
      if (r.side === "debit") {
        const amt =
          safeNumber(r.SAVINGS_WITHDR) + safeNumber(r.TO_VAULT) + safeNumber(r.EXPENSE) + safeNumber(r.CHEQUES || 0);
        return s + Math.abs(amt);
      }
      return s;
    }, 0);
    const tellerCredit = tellerRows.reduce((s, r) => {
      if (r.side === "credit") {
        const amt = safeNumber(r.CASH_DEP) + safeNumber(r.CASH_DEP_2) + safeNumber(r.FROM_VAULT) + safeNumber(r.WUMT || 0);
        return s + Math.abs(amt);
      }
      return s;
    }, 0);

    const glDebit = glRows.reduce((s, r) => {
      if ((r.Type || "").toLowerCase().includes("d") || (r.Type || "").toLowerCase().includes("dr")) {
        return s + Math.abs(safeNumber(r.Amount));
      }
      return s;
    }, 0);
    const glCredit = glRows.reduce((s, r) => {
      if ((r.Type || "").toLowerCase().includes("c") || (r.Type || "").toLowerCase().includes("cr")) {
        return s + Math.abs(safeNumber(r.Amount));
      }
      return s;
    }, 0);

    return {
      tellerDebit,
      tellerCredit,
      glDebit,
      glCredit,
      tellerCount: tellerRows.length,
      glCount: glRows.length,
      matchedTeller: tellerRows.filter((r) => r.matched).length,
      matchedGl: glRows.filter((r) => r.matched).length,
    };
  }, [tellerRows, glRows]);

  // Run match when user clicks Run Match or after both uploads (we'll provide a button + auto-run)
  const handleRunMatch = () => {
    runMatching();
    // small feedback (no toast lib used)
    alert("Matching completed (Account Number + Amount). Matched rows are highlighted.");
  };

  // Export to Excel (Teller, GL, MatchSummary)
  const handleExport = () => {
    const date = new Date().toISOString().split("T")[0];
    const wb = XLSX.utils.book_new();

    const tellerSheet = tellerRows.map((r) => ({
      id: r.id,
      ACCOUNT_NO: r.ACCOUNT_NO,
      NARRATION: r.NARRATION,
      side: r.side,
      matched: r.matched ? "MATCHED" : "UNMATCHED",
      CHEQUES: r.CHEQUES,
      SAVINGS_WITHDR: r.SAVINGS_WITHDR,
      TO_VAULT: r.TO_VAULT,
      EXPENSE: r.EXPENSE,
      CASH_DEP: r.CASH_DEP,
      CASH_DEP_2: r.CASH_DEP_2,
      FROM_VAULT: r.FROM_VAULT,
      WUMT: r.WUMT,
    }));
    const glSheet = glRows.map((g) => ({
      id: g.id,
      Date: g.Date,
      Branch: g.Branch,
      AccountNo: g.AccountNo,
      Type: g.Type,
      Amount: g.Amount,
      User: g.User,
      Authorizer: g.Authorizer,
      Reference: g.Reference,
      matched: g.matched ? "MATCHED" : "UNMATCHED",
    }));

    const summary = [
      ["Branch Code", branchCode],
      ["Branch Name", branchName],
      ["Country", country],
      ["Teller Name", tellerName],
      ["Supervisor Name", supervisorName],
      ["Teller Rows", totals.tellerCount],
      ["GL Rows", totals.glCount],
      ["Matched Teller Rows", totals.matchedTeller],
      ["Matched GL Rows", totals.matchedGl],
      ["Teller Total Debit", totals.tellerDebit],
      ["Teller Total Credit", totals.tellerCredit],
      ["GL Total Debit", totals.glDebit],
      ["GL Total Credit", totals.glCredit],
      ["Date", date],
    ];

    const wsT = XLSX.utils.json_to_sheet(tellerSheet);
    const wsG = XLSX.utils.json_to_sheet(glSheet);
    const wsS = XLSX.utils.aoa_to_sheet(summary);

    XLSX.utils.book_append_sheet(wb, wsT, "Teller");
    XLSX.utils.book_append_sheet(wb, wsG, "GL");
    XLSX.utils.book_append_sheet(wb, wsS, "Summary");
    XLSX.writeFile(wb, `teller-gl-reconciliation-${date}.xlsx`);
  };

  // UI: table row background class based on match state and active tab logic
  const rowClassForTeller = (r: TellerRow) => {
    if (r.matched) return "bg-emerald-50";
    // if key exists in GL? We already mark matched; find if account exists but amount diff -> highlight red
    const glMatchExists = glRows.some((g) => String(g.AccountNo || "").replace(/\s+/g, "") === String(r.ACCOUNT_NO || "").replace(/\s+/g, ""));
    if (glMatchExists && !r.matched) return "bg-rose-50";
    if (!glMatchExists) return "bg-yellow-50";
    return "";
  };
  const rowClassForGL = (g: GLRow) => {
    if (g.matched) return "bg-emerald-50";
    const tellerMatchExists = tellerRows.some((t) => String(t.ACCOUNT_NO || "").replace(/\s+/g, "") === String(g.AccountNo || "").replace(/\s+/g, ""));
    if (tellerMatchExists && !g.matched) return "bg-rose-50";
    if (!tellerMatchExists) return "bg-yellow-50";
    return "";
  };

  // which rows to show in the current tab
  const currentPreviewRows: (TellerRow | GLRow)[] = useMemo(() => {
    if (activeTab.startsWith("teller")) {
      const side = activeTab === "teller_debit" ? "debit" : "credit";
      return tellerRows.filter((r) => r.side === side);
    } else {
      const side = activeTab === "gl_debit" ? "debit" : "credit";
      // GL side determination by Type field: treat DR/ D as debit and CR/ C as credit
      return filteredGLByUser.filter((g) => {
        const t = (g.Type || "").toLowerCase();
        const isDebit = t.includes("d") || t.includes("dr");
        const isCredit = t.includes("c") || t.includes("cr");
        return side === "debit" ? isDebit : isCredit;
      });
    }
  }, [activeTab, tellerRows, filteredGLByUser]);

  // Preview table headers for teller and gl (slice limited to a set of columns to keep UI neat)
  const renderPreviewTable = () => {
    if (activeTab.startsWith("teller")) {
      const rows = (currentPreviewRows as TellerRow[]);
      return (
        <div className="overflow-auto max-h-[40vh] border rounded-lg bg-white">
          <table className="w-full min-w-[900px]">
            <thead className="sticky top-0 bg-gray-50">
              <tr>
                <th className="p-2 text-left">Account No</th>
                <th className="p-2 text-left">Narration</th>
                <th className="p-2 text-right">Savings Withdr.</th>
                <th className="p-2 text-right">To Vault</th>
                <th className="p-2 text-right">Expense</th>
                <th className="p-2 text-right">Cash Dep</th>
                <th className="p-2 text-right">Cash Dep 2</th>
                <th className="p-2 text-right">From Vault</th>
                <th className="p-2 text-right">WUMT</th>
                <th className="p-2">Match</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className={`${rowClassForTeller(r)} border-b`}>
                  <td className="p-2 font-mono">{r.ACCOUNT_NO || "-"}</td>
                  <td className="p-2">{r.NARRATION || "-"}</td>
                  <td className="p-2 text-right">₦{safeNumber(r.SAVINGS_WITHDR).toLocaleString()}</td>
                  <td className="p-2 text-right">₦{safeNumber(r.TO_VAULT).toLocaleString()}</td>
                  <td className="p-2 text-right">₦{safeNumber(r.EXPENSE).toLocaleString()}</td>
                  <td className="p-2 text-right">₦{safeNumber(r.CASH_DEP).toLocaleString()}</td>
                  <td className="p-2 text-right">₦{safeNumber(r.CASH_DEP_2).toLocaleString()}</td>
                  <td className="p-2 text-right">₦{safeNumber(r.FROM_VAULT).toLocaleString()}</td>
                  <td className="p-2 text-right">₦{safeNumber(r.WUMT).toLocaleString()}</td>
                  <td className="p-2">
                    {r.matched ? (
                      <Badge className="bg-emerald-100 text-emerald-700">Matched</Badge>
                    ) : (
                      <Badge className="bg-rose-100 text-rose-700">Unmatched</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    } else {
      const rows = (currentPreviewRows as GLRow[]);
      return (
        <div className="overflow-auto max-h-[40vh] border rounded-lg bg-white">
          <table className="w-full min-w-[900px]">
            <thead className="sticky top-0 bg-gray-50">
              <tr>
                <th className="p-2 text-left">Account No</th>
                <th className="p-2 text-left">Date</th>
                <th className="p-2 text-left">Branch</th>
                <th className="p-2 text-right">Amount</th>
                <th className="p-2 text-left">Type</th>
                <th className="p-2 text-left">User</th>
                <th className="p-2 text-left">Authorizer</th>
                <th className="p-2 text-left">Reference</th>
                <th className="p-2">Match</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((g) => (
                <tr key={g.id} className={`${rowClassForGL(g as GLRow)} border-b`}>
                  <td className="p-2 font-mono">{g.AccountNo || "-"}</td>
                  <td className="p-2">{g.Date || "-"}</td>
                  <td className="p-2">{g.Branch || "-"}</td>
                  <td className="p-2 text-right">₦{safeNumber(g.Amount).toLocaleString()}</td>
                  <td className="p-2">{g.Type || "-"}</td>
                  <td className="p-2">{g.User || "-"}</td>
                  <td className="p-2">{g.Authorizer || "-"}</td>
                  <td className="p-2">{g.Reference || "-"}</td>
                  <td className="p-2">
                    {g.matched ? (
                      <Badge className="bg-emerald-100 text-emerald-700">Matched</Badge>
                    ) : (
                      <Badge className="bg-rose-100 text-rose-700">Unmatched</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
  };

  return (
    <div className="min-h-screen p-6 bg-gradient-to-br from-blue-50 to-teal-100">
      <Card className="max-w-7xl mx-auto rounded-2xl shadow-lg border-none">
        <CardHeader className="rounded-t-2xl p-6 bg-gradient-to-r from-blue-600 to-teal-500 text-white">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl font-bold">Teller ↔ GL Reconciliation</CardTitle>
              <CardDescription className="text-blue-100">
                Upload Teller (CAST) and GL exports. Matching uses Account Number + Amount. Use the tabs to switch views.
              </CardDescription>
            </div>
            <div className="flex gap-3">
              <Button onClick={handleRunMatch} className="bg-gradient-to-r from-sky-600 to-teal-400 text-white">
                <CheckCircle2 className="mr-2 h-4 w-4" /> Run Match
              </Button>
              <Button onClick={handleExport} variant="outline">
                <Download className="mr-2 h-4 w-4" /> Export
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-6 space-y-6">
          {/* Branch + teller/supervisor fields */}
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <BranchInfo
                branchCode={branchCode}
                branchName={branchName}
                country={country}
                onBranchCodeChange={setBranchCode}
                onBranchNameChange={setBranchName}
                onCountryChange={setCountry}
              />
            </div>

            <div className="space-y-2">
              <Label>Teller Name</Label>
              <Input placeholder="Enter Teller name" value={tellerName} onChange={(e) => setTellerName(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>Supervisor Name</Label>
              <Input placeholder="Enter Supervisor name" value={supervisorName} onChange={(e) => setSupervisorName(e.target.value)} />
            </div>
          </div>

          {/* Uploaders */}
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <Label>Teller file (CAST sheet expected)</Label>
              <div className="flex gap-2 items-center">
                <Input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={(e) => e.target.files?.[0] && parseTellerFile(e.target.files[0])}
                />
                {tellerFileName ? <Badge className="bg-green-600">{tellerFileName}</Badge> : null}
              </div>
              <p className="text-xs text-muted-foreground mt-2">Expected columns: CHEQUES, ACCOUNT NO, SAVINGS WITHDR., TO VAULT, EXPENSE, WUMT, OPENING BALANCE, CASH DEP, CASH DEP 2, FROM VAULT</p>
            </div>

            <div>
              <Label>GL file</Label>
              <div className="flex gap-2 items-center">
                <Input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={(e) => e.target.files?.[0] && parseGlFile(e.target.files[0])}
                />
                {glFileName ? <Badge className="bg-blue-600">{glFileName}</Badge> : null}
              </div>
              <p className="text-xs text-muted-foreground mt-2">We extract: TRANSACTION DATE, BRANCH NAME, ACCOUNT NUMBER, DR/CR, CURRENCY, LCY AMOUNT, USER ID, AUTHORISER ID, EXTERNAL REFERENCE</p>
            </div>
          </div>

          {/* Tabs - 4 views */}
          <div>
            <div className="flex flex-wrap justify-center gap-3">
              <Button variant={activeTab === "teller_debit" ? "default" : "outline"} onClick={() => setActiveTab("teller_debit")}>Teller Debit</Button>
              <Button variant={activeTab === "teller_credit" ? "default" : "outline"} onClick={() => setActiveTab("teller_credit")}>Teller Credit</Button>
              <Button variant={activeTab === "gl_debit" ? "default" : "outline"} onClick={() => setActiveTab("gl_debit")}>GL Debit</Button>
              <Button variant={activeTab === "gl_credit" ? "default" : "outline"} onClick={() => setActiveTab("gl_credit")}>GL Credit</Button>
            </div>

            {/* GL filter */}
            {activeTab.startsWith("gl") && (
              <div className="flex items-center gap-2 justify-center mt-3">
                <Input placeholder="Filter GL by User ID" value={glFilterUser} onChange={(e) => setGlFilterUser(e.target.value)} className="w-60" />
                <Button onClick={() => { /* uses filteredGLByUser computed */ alert("Filter applied"); }}>Filter</Button>
              </div>
            )}

            {/* Preview */}
            <div className="mt-4">{renderPreviewTable()}</div>
          </div>

          {/* Summary cards */}
          <div className="grid md:grid-cols-4 gap-4">
            <Card className="p-3">
              <div className="text-xs text-muted-foreground">Teller Rows</div>
              <div className="text-xl font-bold">{totals.tellerCount}</div>
            </Card>
            <Card className="p-3">
              <div className="text-xs text-muted-foreground">GL Rows</div>
              <div className="text-xl font-bold">{totals.glCount}</div>
            </Card>
            <Card className="p-3">
              <div className="text-xs text-muted-foreground">Matched</div>
              <div className="text-xl font-bold">{totals.matchedTeller}</div>
            </Card>
            <Card className="p-3">
              <div className="text-xs text-muted-foreground">Difference (Teller Debit - GL Debit)</div>
              <div className={`text-xl font-bold ${Math.abs(totals.tellerDebit - totals.glDebit) === 0 ? "text-emerald-600" : "text-rose-600"}`}>
                ₦{Math.abs(totals.tellerDebit - totals.glDebit).toLocaleString()}
              </div>
            </Card>
          </div>
        </CardContent>
      </Card>

      {/* small legend */}
      <div className="max-w-7xl mx-auto mt-4 flex gap-3">
        <div className="flex items-center gap-2">
          <span className="w-4 h-4 bg-emerald-100 border border-emerald-300 rounded-sm" /> <span className="text-sm">Matched</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-4 h-4 bg-rose-100 border border-rose-300 rounded-sm" /> <span className="text-sm">Present but amount mismatch</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-4 h-4 bg-yellow-50 border border-yellow-300 rounded-sm" /> <span className="text-sm">Only in one file</span>
        </div>
      </div>
    </div>
  );
}
