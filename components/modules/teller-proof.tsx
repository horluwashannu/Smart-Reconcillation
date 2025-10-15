"use client";

import React, { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import {
  Button,
  Input,
  Label,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui";
import { Download, Upload, Filter } from "lucide-react";

type Row = Record<string, any>;

export default function TellerProof() {
  const [tellerRows, setTellerRows] = useState<Row[]>([]);
  const [glRows, setGlRows] = useState<Row[]>([]);
  const [tellerFile, setTellerFile] = useState<File | null>(null);
  const [glFile, setGlFile] = useState<File | null>(null);

  const [tellerName, setTellerName] = useState("");
  const [supervisorName, setSupervisorName] = useState("");
  const [glFilterUser, setGlFilterUser] = useState("");
  const [buyAmount, setBuyAmount] = useState<number | "">("");
  const [activeView, setActiveView] = useState<
    "tellerDebit" | "tellerCredit" | "glDebit" | "glCredit"
  >("tellerDebit");
  const [dummySubmitted, setDummySubmitted] = useState(false);

  const safeNumber = (v: any) => {
    if (!v) return 0;
    const n = Number(String(v).replace(/[,₦$ ]/g, ""));
    return Number.isFinite(n) ? n : 0;
  };

  const readExcel = async (file: File, isTeller = false) => {
    const data = await file.arrayBuffer();
    const wb = XLSX.read(data, { type: "array" });
    const name = wb.SheetNames.find((n) => n.toLowerCase().includes("cast")) || wb.SheetNames[0];
    const sheet = wb.Sheets[name];
    const json = XLSX.utils.sheet_to_json<Row>(sheet, { defval: "" });
    const rows = json.map((r, i) => ({ __id: i, ...r }));
    isTeller ? setTellerRows(rows) : setGlRows(rows);
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>, teller = false) => {
    const f = e.target.files?.[0];
    if (!f) return;
    teller ? setTellerFile(f) : setGlFile(f);
    readExcel(f, teller);
  };

  // Filtered GL by User ID
  const filteredGL = useMemo(() => {
    if (!glFilterUser.trim()) return glRows;
    const q = glFilterUser.trim().toLowerCase();
    return glRows.filter((r) =>
      String(
        r["USER ID"] ??
          r["USERID"] ??
          r["USER"] ??
          r["User"] ??
          r["user"] ??
          ""
      )
        .toLowerCase()
        .includes(q)
    );
  }, [glRows, glFilterUser]);

  // Auto-match Teller rows with GL
  const tellerWithMatch = useMemo(() => {
    if (!tellerRows.length || !filteredGL.length) return tellerRows;
    const glIndex = new Map<string, Row[]>();

    filteredGL.forEach((r) => {
      const acct =
        r["ACCOUNT NUMBER"] ?? r["ACCOUNT"] ?? r["ACCT"] ?? r["NUBAN AC"] ?? "";
      const amt = safeNumber(
        r["LCY AMOUNT"] ?? r["AMOUNT"] ?? r["FCY AMOUNT"] ?? 0
      );
      const key = `${acct}-${amt}`;
      if (!glIndex.has(key)) glIndex.set(key, []);
      glIndex.get(key)!.push(r);
    });

    return tellerRows.map((r) => {
      const acct =
        r["ACCOUNT NO"] ??
        r["ACCOUNT NUMBER"] ??
        r["ACCT"] ??
        r["NUBAN"] ??
        "";
      const amt =
        safeNumber(r["AMOUNT"]) ||
        safeNumber(r["CASH DEP"]) ||
        safeNumber(r["CASH DEP 2"]) ||
        safeNumber(r["SAVINGS WITHDR."]) ||
        safeNumber(r["SAVINGS"]) ||
        0;

      const key = `${acct}-${amt}`;
      const matched = glIndex.has(key);
      return { ...r, __match: matched ? "✅ Matched" : "❌ Unmatched" };
    });
  }, [tellerRows, filteredGL]);

  const totalCredits = tellerRows.reduce(
    (sum, r) =>
      sum +
      safeNumber(r["CASH DEP"]) +
      safeNumber(r["CASH DEP 2"]) +
      safeNumber(r["FROM VAULT"]) +
      safeNumber(r["WUMT"]),
    0
  );
  const totalDebits = tellerRows.reduce(
    (sum, r) =>
      sum +
      safeNumber(r["SAVINGS WITHDR."]) +
      safeNumber(r["TO VAULT"]) +
      safeNumber(r["EXPENSE"]),
    0
  );
  const opening = tellerRows.reduce(
    (s, r) => s + safeNumber(r["OPENING BALANCE"]),
    0
  );
  const computedTillBalance =
    opening + totalCredits - totalDebits - safeNumber(buyAmount);

  const exportExcel = () => {
    const wb = XLSX.utils.book_new();
    const t = XLSX.utils.json_to_sheet(tellerWithMatch);
    const g = XLSX.utils.json_to_sheet(glRows);
    XLSX.utils.book_append_sheet(wb, t, "Teller");
    XLSX.utils.book_append_sheet(wb, g, "GL");
    XLSX.writeFile(wb, "teller-proof.xlsx");
  };

  const handleDummySubmit = () => {
    setDummySubmitted(true);
    setTimeout(() => setDummySubmitted(false), 1000);
  };

  const Preview = ({ data }: { data: Row[] }) => {
    if (!data?.length)
      return <div className="p-2 text-sm text-gray-500">No data to preview</div>;
    const headers = Object.keys(data[0] || {}).slice(0, 10);
    return (
      <div className="overflow-auto max-h-[420px] border rounded-md">
        <table className="min-w-full text-xs">
          <thead className="bg-teal-50 sticky top-0">
            <tr>
              {headers.map((h) => (
                <th key={h} className="p-2 text-left font-semibold">
                  {h}
                </th>
              ))}
              {data === tellerWithMatch && <th className="p-2">Match Status</th>}
            </tr>
          </thead>
          <tbody>
            {data.slice(0, 50).map((r, i) => (
              <tr key={r.__id ?? i} className="odd:bg-gray-50">
                {headers.map((h) => (
                  <td key={h} className="p-2">
                    {String(r[h] ?? "")}
                  </td>
                ))}
                {r.__match && (
                  <td
                    className={`p-2 font-semibold ${
                      r.__match.includes("✅")
                        ? "text-green-600"
                        : "text-red-500"
                    }`}
                  >
                    {r.__match}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-teal-50 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-teal-500 text-white p-6 rounded-xl shadow-lg flex flex-wrap justify-between items-center">
          <div>
            <h1 className="text-2xl font-semibold">Teller Proof Dashboard</h1>
            <p className="text-sm opacity-90">
              Upload, preview, match and reconcile Teller & GL records.
            </p>
          </div>
          <div className="flex gap-3">
            <Button onClick={exportExcel} className="bg-white text-blue-600">
              <Download className="mr-2 h-4 w-4" /> Export
            </Button>
            <Button
              onClick={handleDummySubmit}
              className="bg-white text-teal-600"
            >
              <Upload className="mr-2 h-4 w-4" />{" "}
              {dummySubmitted ? "Submitted" : "Dummy Submit"}
            </Button>
          </div>
        </div>

        {/* Names */}
        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-white p-4 rounded-lg shadow-sm">
            <Label>Teller Name</Label>
            <Input
              value={tellerName}
              onChange={(e) => setTellerName(e.target.value)}
            />
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm">
            <Label>Supervisor Name</Label>
            <Input
              value={supervisorName}
              onChange={(e) => setSupervisorName(e.target.value)}
            />
          </div>
        </div>

        {/* Uploads */}
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-white p-4 rounded-lg shadow-sm space-y-2">
            <Label>Teller Upload (.xlsx / .csv)</Label>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => handleFile(e, true)}
            />
            <Preview data={tellerWithMatch} />
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm space-y-2">
            <Label>GL Upload (.xlsx / .csv)</Label>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => handleFile(e, false)}
            />
            <div className="flex gap-2 mt-2">
              <Input
                placeholder="Filter GL by User ID"
                value={glFilterUser}
                onChange={(e) => setGlFilterUser(e.target.value)}
              />
              <Button variant="outline" onClick={() => setGlFilterUser("")}>
                <Filter className="h-4 w-4 mr-1" /> Clear
              </Button>
            </div>
            <Preview data={filteredGL} />
          </div>
        </div>

        {/* Views */}
        <div className="bg-white p-4 rounded-lg shadow-sm">
          <div className="flex flex-wrap gap-3 mb-4">
            <Button
              variant={activeView === "tellerDebit" ? "default" : "outline"}
              onClick={() => setActiveView("tellerDebit")}
            >
              Teller Debit
            </Button>
            <Button
              variant={activeView === "tellerCredit" ? "default" : "outline"}
              onClick={() => setActiveView("tellerCredit")}
            >
              Teller Credit
            </Button>
            <Button
              variant={activeView === "glDebit" ? "default" : "outline"}
              onClick={() => setActiveView("glDebit")}
            >
              GL Debit
            </Button>
            <Button
              variant={activeView === "glCredit" ? "default" : "outline"}
              onClick={() => setActiveView("glCredit")}
            >
              GL Credit
            </Button>
          </div>
          {activeView.startsWith("teller") ? (
            <Preview data={tellerWithMatch} />
          ) : (
            <Preview data={filteredGL} />
          )}
        </div>

        {/* Summary */}
        <div className="bg-white p-4 rounded-lg shadow-sm flex flex-col md:flex-row justify-between gap-4">
          <div>
            <Label>Buy Amount (₦)</Label>
            <Input
              type="number"
              value={buyAmount as any}
              onChange={(e) =>
                setBuyAmount(e.target.value === "" ? "" : Number(e.target.value))
              }
            />
          </div>
          <div className="text-center">
            <div className="text-sm text-gray-500">Computed Till Balance</div>
            <div
              className={`text-lg font-bold ${
                computedTillBalance < 0 ? "text-red-600" : "text-green-600"
              }`}
            >
              ₦{computedTillBalance.toLocaleString()}
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button
              onClick={exportExcel}
              className="bg-gradient-to-r from-blue-600 to-teal-500 text-white"
            >
              <Download className="mr-2 h-4 w-4" /> Export All
            </Button>
            <Button variant="outline" onClick={handleDummySubmit}>
              Dummy Submit
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
