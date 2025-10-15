// /components/TellerProof.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  AlertTriangle,
  CheckCircle2,
  Upload,
  FileSpreadsheet,
  Download,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BranchInfo } from "@/components/branch-info";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableHeader,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";

type TellerRow = {
  id: string;
  CHEQUES?: number;
  ACCOUNT_NO?: string;
  SAVINGS_WITHDR?: number;
  ACCOUNT_NO2?: string;
  TO_VAULT?: number;
  EXPENSE?: number;
  WUMT?: number;
  Column1?: string;
  OPENING_BALANCE?: number;
  CASH_DEP?: number;
  CASH_DEP_2?: number;
  FROM_VAULT?: number;
  // UI checks
  bvnChecked?: boolean;
  signatureChecked?: boolean;
  alterationsSigned?: boolean;
  analysisDone?: boolean;
  // matched flag
  matched?: boolean;
};

type GLRow = {
  Date?: string;
  Branch?: string;
  AccountNo?: string;
  Type?: string; // D / C
  Currency?: string;
  Amount?: number;
  User?: string;
  Authorizer?: string;
  Reference?: string;
  raw?: any;
  matched?: boolean;
};

export function TellerProof() {
  // Branch meta
  const [branchCode, setBranchCode] = useState("");
  const [branchName, setBranchName] = useState("");
  const [country, setCountry] = useState("");

  // Files
  const [tellerFile, setTellerFile] = useState<File | null>(null);
  const [glFile, setGlFile] = useState<File | null>(null);

  // UI
  const [activeTab, setActiveTab] = useState<"debit" | "credit">("debit");
  const [showResults, setShowResults] = useState(false);

  // Data
  const [rows, setRows] = useState<TellerRow[]>([]);
  const [glRows, setGlRows] = useState<GLRow[]>([]);

  // Inputs & summary
  const [openingBalance, setOpeningBalance] = useState<number | "">("");
  const [buyAmount, setBuyAmount] = useState<number | "">("");
  const [remainingFigure, setRemainingFigure] = useState<number | "">("");
  const [callOverOfficer, setCallOverOfficer] = useState("");

  // Helpers
  const safeNumber = (v: any) => {
    if (v === null || v === undefined || v === "") return 0;
    const s = String(v).replace(/[,₦€$]/g, "").trim();
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
  };

  const findCastSheet = (wb: XLSX.WorkBook) => {
    const names = wb.SheetNames;
    const found = names.find((n) => n.toLowerCase().trim() === "cast");
    if (found) return wb.Sheets[found];
    if (names.length >= 2) return wb.Sheets[names[1]];
    return wb.Sheets[names[0]];
  };

  const parseTellerFile = async (file: File) => {
    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data, { type: "array", cellDates: true });
      const sheet = findCastSheet(wb);
      const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
      const headersIndex = raw.findIndex((r: any[]) =>
        r.some((c) =>
          String(c || "")
            .toLowerCase()
            .replace(/\s+/g, "")
            .includes("cheques")
        ) &&
        r.some((c) =>
          String(c || "")
            .toLowerCase()
            .replace(/\s+/g, "")
            .includes("account")
        )
      );
      const headerRow =
        headersIndex >= 0
          ? raw[headersIndex].map((h) => String(h || "").trim())
          : raw[0].map((h) => String(h || "").trim());

      const dataRows = raw.slice(headersIndex >= 0 ? headersIndex + 1 : 1);
      const parsed: TellerRow[] = dataRows
        .filter((r: any[]) => r.some((c) => String(c).trim() !== ""))
        .map((r: any[], i: number) => {
          const rowObj: any = {};
          headerRow.forEach((h: string, idx: number) => {
            const key = h.replace(/\s+/g, "_").toUpperCase();
            rowObj[key] = r[idx];
          });
          const mapped: TellerRow = {
            id: `T-${Date.now()}-${i}`,
            CHEQUES: safeNumber(rowObj["CHEQUES"]),
            ACCOUNT_NO: String(
              rowObj["ACCOUNT_NO"] ||
                rowObj["ACCOUNTNUMBER"] ||
                rowObj["ACCOUNT"] ||
                ""
            ),
            SAVINGS_WITHDR: safeNumber(
              rowObj["SAVINGS_WITHDR"] ||
                rowObj["SAVINGS_WITHDRAWAL"] ||
                rowObj["SAVINGSWITHDR"] ||
                rowObj["SAVINGS"]
            ),
            ACCOUNT_NO2: String(rowObj["ACCOUNT_NO2"] || ""),
            TO_VAULT: safeNumber(rowObj["TO_VAULT"] || rowObj["TOVAULT"]),
            EXPENSE: safeNumber(rowObj["EXPENSE"]),
            WUMT: safeNumber(rowObj["WUMT"]),
            Column1: String(rowObj["Column1"] || rowObj["NARRATION"] || ""),
            OPENING_BALANCE: safeNumber(rowObj["OPENING_BALANCE"]),
            CASH_DEP: safeNumber(rowObj["CASH_DEP"] || rowObj["CASHDEP"]),
            CASH_DEP_2: safeNumber(rowObj["CASH_DEP_2"] || rowObj["CASHDEP2"]),
            FROM_VAULT: safeNumber(rowObj["FROM_VAULT"] || rowObj["FROMVAULT"]),
            bvnChecked: false,
            signatureChecked: false,
            alterationsSigned: false,
            analysisDone: false,
            matched: false,
          };
          return mapped;
        });
      setRows(parsed);

      const foundOpening = parsed.find(
        (p) => p.OPENING_BALANCE && p.OPENING_BALANCE !== 0
      );
      if (foundOpening) setOpeningBalance(foundOpening.OPENING_BALANCE || "");
    } catch (err) {
      console.error("Failed to parse teller file", err);
      alert(
        "Failed to parse teller file. Ensure it's a valid Excel/CSV file and sheet2 called 'cast' exists."
      );
    }
  };

  const parseGlFile = async (file: File) => {
    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data, { type: "array", cellDates: true });

      let sheet: XLSX.WorkSheet | null = null;
      for (const name of wb.SheetNames) {
        const s = wb.Sheets[name];
        const preview = XLSX.utils.sheet_to_json(s, { header: 1, defval: "" }) as any[][];
        const headRow = preview.find(
          (r) =>
            r &&
            r.some((c: any) =>
              String(c || "").toLowerCase().includes("account")
            ) &&
            r.some((c: any) =>
              String(c || "").toLowerCase().includes("transaction")
            )
        );
        if (headRow) {
          sheet = s;
          break;
        }
      }

      if (!sheet) sheet = wb.Sheets[wb.SheetNames[0]];

      const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" }) as any[][];
      const headerIdx = raw.findIndex(
        (r) =>
          r.some((c: any) => String(c || "").toLowerCase().includes("account")) &&
          r.some((c: any) => String(c || "").toLowerCase().includes("transaction"))
      );
      const headerRow =
        (headerIdx >= 0 ? raw[headerIdx] : raw[0]).map((h: any) => String(h || "").trim());
      const dataRows = raw.slice(headerIdx >= 0 ? headerIdx + 1 : 1);

      const headerMap: Record<string, number> = {};
      headerRow.forEach((h: string, idx: number) => {
        const key = h.toLowerCase().replace(/\s+/g, "");
        headerMap[key] = idx;
      });

      const findIndexByPossible = (candidates: string[]) => {
        for (const c of candidates) {
          const k = c.toLowerCase().replace(/\s+/g, "");
          if (headerMap[k] !== undefined) return headerMap[k];
        }
        return -1;
      };

      const idxTransactionDate = findIndexByPossible([
        "transactiondate",
        "transactiondate ",
        "transaction_date",
        "transaction date",
      ]);
      const idxBranch = findIndexByPossible(["branchname", "branch", "branchname "]);
      const idxAccount = findIndexByPossible(["accountnumber", "accountnumber ", "accountno", "account"]);
      const idxDrCr = findIndexByPossible(["dr/cr", "drcr", "drcr "]);
      const idxCurrency = findIndexByPossible(["currency"]);
      const idxLcy = findIndexByPossible([
        "lcya amount",
        "lcyaamount",
        "lcamount",
        "lcyamount",
        "lcyamount ",
        "lcy_amount",
        "lcy",
      ]);
      const idxAmount = idxLcy >= 0 ? idxLcy : findIndexByPossible(["amount", "lcya amount", "fc y amount", "lc y amount"]);
      const idxUser = findIndexByPossible(["userid", "user id", "user"]);
      const idxAuthorizer = findIndexByPossible(["authoriserid", "authoriser id", "authorizer", "authoriser"]);
      const idxRef = findIndexByPossible([
        "externalreferenceno",
        "externalreferenceno ",
        "external reference no",
        "reference",
        "externalreference",
      ]);

      const parsedGl: GLRow[] = dataRows
        .filter((r: any[]) => r && r.some((c) => String(c).trim() !== ""))
        .map((r: any[]) => {
          const acc = idxAccount >= 0 ? String(r[idxAccount] || "").trim() : "";
          const amt = idxAmount >= 0 ? safeNumber(r[idxAmount]) : safeNumber(r[idxLcy]);
          const drcr = idxDrCr >= 0 ? String(r[idxDrCr] || "").trim() : "";
          const date = idxTransactionDate >= 0 ? formatExcelDate(r[idxTransactionDate]) : "";
          const br = idxBranch >= 0 ? String(r[idxBranch] || "").trim() : "";
          const user = idxUser >= 0 ? String(r[idxUser] || "").trim() : "";
          const authorizer = idxAuthorizer >= 0 ? String(r[idxAuthorizer] || "").trim() : "";
          const ref = idxRef >= 0 ? String(r[idxRef] || "").trim() : "";
          return {
            Date: date,
            Branch: br,
            AccountNo: acc,
            Type: drcr,
            Currency: idxCurrency >= 0 ? String(r[idxCurrency] || "") : undefined,
            Amount: amt,
            User: user,
            Authorizer: authorizer,
            Reference: ref,
            raw: r,
            matched: false,
          } as GLRow;
        });

      setGlRows(parsedGl);
    } catch (err) {
      console.error("Failed to parse GL file", err);
      alert("Failed to parse GL file. Ensure it's a valid Excel/CSV file.");
    }
  };

  const formatExcelDate = (v: any) => {
    if (!v) return "";
    if (v instanceof Date) return v.toLocaleDateString();
    if (typeof v === "number") {
      const d = XLSX.SSF.parse_date_code(v);
      if (d) return `${d.d}/${d.m}/${d.y}`;
    }
    return String(v);
  };

  const handleTellerUpload = (file: File) => {
    setTellerFile(file);
    parseTellerFile(file);
  };

  const handleGlUpload = (file: File) => {
    setGlFile(file);
    parseGlFile(file);
  };

  const updateRow = (id: string, patch: Partial<TellerRow>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const totals = useMemo(() => {
    const sum = (arr: (number | undefined | null)[]) => arr.reduce((acc, v) => acc + safeNumber(v), 0);
    const debitCols = rows.map((r) => safeNumber(r.SAVINGS_WITHDR));
    const expenseCols = rows.map((r) => safeNumber(r.EXPENSE));
    const toVaultCols = rows.map((r) => safeNumber(r.TO_VAULT));
    const totalDebit = sum(debitCols) + sum(expenseCols) + sum(toVaultCols);

    const creditCashCols = rows.map((r) =>
      safeNumber(r.CASH_DEP) + safeNumber(r.CASH_DEP_2) + safeNumber(r.FROM_VAULT) + safeNumber(r.WUMT)
    );
    const totalCredit = sum(creditCashCols);

    return { totalDebit, totalCredit };
  }, [rows]);

  const tillBalance = useMemo(() => {
    const open = safeNumber(openingBalance);
    const buy = safeNumber(buyAmount);
    const credits = safeNumber(totals.totalCredit);
    const debits = safeNumber(totals.totalDebit);
    return open + credits - debits - buy;
  }, [openingBalance, buyAmount, totals]);

  const difference = useMemo(() => {
    return Number((tillBalance || 0) - safeNumber(remainingFigure));
  }, [tillBalance, remainingFigure]);

  const balanced = difference === 0;

  // Matching logic
  useEffect(() => {
    if (rows.length === 0 || glRows.length === 0) return;

    const glIndex: { key: string; used: boolean; idx: number }[] = [];
    glRows.forEach((g, i) => {
      const key = `${(g.AccountNo || "").trim()}|${safeNumber(g.Amount)}|${(g.Type || "").trim()}`;
      glIndex.push({ key, used: false, idx: i });
    });

    const newRows = rows.map((r) => {
      const rAcc = (r.ACCOUNT_NO || "").trim();
      const rAmt = safeNumber(
        r.SAVINGS_WITHDR ||
        r.TO_VAULT ||
        r.EXPENSE ||
        r.CASH_DEP ||
        r.CASH_DEP_2 ||
        r.FROM_VAULT ||
        r.WUMT ||
        r.CHEQUES
      );
      const candidate = glIndex.find((g) => !g.used && g.key.startsWith(`${rAcc}|${rAmt}`));
      if (candidate) {
        candidate.used = true;
        setGlRows((prev) =>
          prev.map((x, i) => (i === candidate.idx ? { ...x, matched: true } : x))
        );
        return { ...r, matched: true };
      }
      return { ...r, matched: false };
    });

    setRows(newRows);
  }, [glRows, rows.length]);

  const handleExportToCSV = () => {
    const header = [
      "id",
      "ACCOUNT_NO",
      "SAVINGS_WITHDR",
      "TO_VAULT",
      "EXPENSE",
      "CASH_DEP",
      "CASH_DEP_2",
      "FROM_VAULT",
      "WUMT",
      "CHEQUES",
      "bvnChecked",
      "signatureChecked",
      "alterationsSigned",
      "analysisDone",
      "matched",
    ];

    const csvRows = [header.join(",")];

    rows.forEach((r) => {
      const line = [
        r.id,
        `${r.ACCOUNT_NO || ""}`,
        safeNumber(r.SAVINGS_WITHDR),
        safeNumber(r.TO_VAULT),
        safeNumber(r.EXPENSE),
        safeNumber(r.CASH_DEP),
        safeNumber(r.CASH_DEP_2),
        safeNumber(r.FROM_VAULT),
        safeNumber(r.WUMT),
        safeNumber(r.CHEQUES),
        r.bvnChecked ? "TRUE" : "FALSE",
        r.signatureChecked ? "TRUE" : "FALSE",
        r.alterationsSigned ? "TRUE" : "FALSE",
        r.analysisDone ? "TRUE" : "FALSE",
        r.matched ? "MATCHED" : "UNMATCHED",
      ];
      csvRows.push(line.join(","));
    });

    // Summary
    csvRows.push("");
    csvRows.push(`Branch Code,${branchCode}`);
    csvRows.push(`Branch Name,${branchName}`);
    csvRows.push(`Country,${country}`);
    csvRows.push(`Opening Balance,${safeNumber(openingBalance)}`);
    csvRows.push(`Total Credit,${safeNumber(totals.totalCredit)}`);
    csvRows.push(`Total Debit,${safeNumber(totals.totalDebit)}`);
    csvRows.push(`Buy Amount,${safeNumber(buyAmount)}`);
    csvRows.push(`Computed Till Balance,${safeNumber(tillBalance)}`);
    csvRows.push(`Remaining Figure,${safeNumber(remainingFigure)}`);
    csvRows.push(`Difference,${difference}`);
    csvRows.push(`Balanced,${balanced ? "TRUE" : "FALSE"}`);
    csvRows.push(`Call Over Officer,${callOverOfficer}`);

    const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const date = new Date().toISOString().split("T")[0];
    a.download = `teller-proof-${branchCode || "branch"}-${date}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleRunProof = () => {
    setShowResults(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
          Teller Proof — Callover
        </h1>
        <p className="text-sm text-muted-foreground">
          Upload teller "cast" sheet (Sheet2) and GL file. Matching uses Account No + Amount. Blue → Teal theme.
        </p>
      </div>

      <BranchInfo
        branchCode={branchCode}
        branchName={branchName}
        country={country}
        onBranchCodeChange={setBranchCode}
        onBranchNameChange={setBranchName}
        onCountryChange={setCountry}
      />

      {/* Upload Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Teller Upload */}
        <Card className="border-primary/20 bg-card/50 backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-card-foreground">
              <FileSpreadsheet className="h-5 w-5" /> Teller Upload (Sheet2: cast)
            </CardTitle>
            <CardDescription>
              Upload the teller's sheet — will read sheet named 'cast' or sheet index 1
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-sky-300 bg-gradient-to-r from-blue-50 to-teal-50 p-6 text-center">
              <Upload className="mb-3 h-12 w-12 text-sky-600" />
              <Label htmlFor="teller-file" className="cursor-pointer">
                <span className="text-sm font-medium text-sky-600 hover:underline">
                  Click to upload teller file (cast sheet)
                </span>
                <input
                  id="teller-file"
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleTellerUpload(e.target.files[0])}
                />
              </Label>
              <p className="mt-2 text-xs text-muted-foreground">
                Expected columns: CHEQUES, ACCOUNT NO, SAVINGS WITHDR., ACCOUNT NO2, TO VAULT, EXPENSE, WUMT, OPENING BALANCE, CASH DEP, CASH DEP 2, FROM VAULT
              </p>
            </div>
            {tellerFile && (
              <div className="flex items-center gap-2 rounded-lg border border-border bg-background p-3">
                <FileSpreadsheet className="h-5 w-5 text-sky-600" />
                <span className="text-sm font-medium text-foreground">{tellerFile.name}</span>
                <Badge variant="secondary" className="ml-auto">Loaded</Badge>
              </div>
            )}
          </CardContent>
        </Card>

        {/* GL Upload */}
        <Card className="border-primary/20 bg-card/50 backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-card-foreground">
              <FileSpreadsheet className="h-5 w-5" /> GL Upload (raw)
            </CardTitle>
            <CardDescription>Upload GL export (we will auto-clean and pick required columns)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-teal-300 bg-gradient-to-r from-teal-50 to-blue-50 p-6 text-center">
              <Upload className="mb-3 h-12 w-12 text-teal-600" />
              <Label htmlFor="gl-file" className="cursor-pointer">
                <span className="text-sm font-medium text-teal-600 hover:underline">
                  Click to upload GL file
                </span>
                <input
                  id="gl-file"
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleGlUpload(e.target.files[0])}
                />
              </Label>
              <p className="mt-2 text-xs text-muted-foreground">
                We extract: TRANSACTION DATE, BRANCH NAME, ACCOUNT NUMBER, DR/CR, CURRENCY, LCY AMOUNT, USER ID, AUTHORISER ID, EXTERNAL REFERENCE
              </p>
            </div>
            {glFile && (
              <div className="flex items-center gap-2 rounded-lg border border-border bg-background p-3">
                <FileSpreadsheet className="h-5 w-5 text-teal-600" />
                <span className="text-sm font-medium text-foreground">{glFile.name}</span>
                <Badge variant="secondary" className="ml-auto">Loaded</Badge>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Transaction View & Summary */}
      {/* ... Remaining JSX (Tables, Inputs, Totals, Buttons, Dialog) */}
    </div>
  );
}
