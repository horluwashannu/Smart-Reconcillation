"use client";

import React, { useState } from "react";
import * as XLSX from "xlsx";
import { Download } from "lucide-react";

type TellerRow = {
  ACCOUNT_NO?: string;
  OPENING_BALANCE?: number;
  CASH_DEP?: number;
  CASH_DEP_2?: number;
  SAVINGS_WITHDR?: number;
  TO_VAULT?: number;
  FROM_VAULT?: number;
  EXPENSE?: number;
  WUMT?: number;
  Column1?: string;
};

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

export default function TellerProof() {
  const [activeTab, setActiveTab] = useState<
    "teller_debit" | "teller_credit" | "gl_debit" | "gl_credit"
  >("teller_debit");
  const [tellerRows, setTellerRows] = useState<TellerRow[]>([]);
  const [glRows, setGlRows] = useState<GLRow[]>([]);
  const [filteredGl, setFilteredGl] = useState<GLRow[]>([]);
  const [glFilterUser, setGlFilterUser] = useState("");
  const [tellerName, setTellerName] = useState("");
  const [supervisorName, setSupervisorName] = useState("");

  // Utility
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

  // --- Parse Teller ---
  const parseTeller = async (file: File) => {
    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data, { type: "array" });
      const sheet = findCastSheet(wb);
      const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
      const header = raw[0].map((h) => String(h || "").trim());
      const rows = raw.slice(1).map((r) => {
        const obj: any = {};
        header.forEach((h, i) => {
          obj[h.replace(/\s+/g, "_").toUpperCase()] = r[i];
        });
        return {
          ACCOUNT_NO:
            obj["ACCOUNT_NO"] || obj["ACCOUNT"] || obj["ACCOUNTNUMBER"],
          OPENING_BALANCE: safeNumber(obj["OPENING_BALANCE"]),
          CASH_DEP: safeNumber(obj["CASH_DEP"]),
          CASH_DEP_2: safeNumber(obj["CASH_DEP_2"]),
          SAVINGS_WITHDR: safeNumber(obj["SAVINGS_WITHDR"]),
          TO_VAULT: safeNumber(obj["TO_VAULT"]),
          FROM_VAULT: safeNumber(obj["FROM_VAULT"]),
          EXPENSE: safeNumber(obj["EXPENSE"]),
          WUMT: safeNumber(obj["WUMT"]),
          Column1: obj["NARRATION"] || "",
        };
      });
      setTellerRows(rows.filter((r) => r.ACCOUNT_NO));
    } catch {
      alert("Invalid Teller (CAST) file or missing 'cast' sheet.");
    }
  };

  // --- Parse GL ---
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
      setGlRows(rows.filter((r) => r.AccountNo));
      setFilteredGl(rows.filter((r) => r.AccountNo));
    } catch {
      alert("Invalid GL file format.");
    }
  };

  // --- Filter GL ---
  const handleFilter = () => {
    if (!glFilterUser.trim()) {
      setFilteredGl(glRows);
    } else {
      const filtered = glRows.filter((r) =>
        r.User?.toLowerCase().includes(glFilterUser.toLowerCase())
      );
      setFilteredGl(filtered);
    }
  };

  // --- Export both ---
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
      <div className="max-w-7xl mx-auto shadow-xl bg-white rounded-2xl p-6 border border-gray-200">
        <h2 className="text-2xl font-bold text-center bg-gradient-to-r from-blue-600 to-teal-500 bg-clip-text text-transparent mb-4">
          Teller & GL Reconciliation
        </h2>
        <p className="text-center text-gray-600 mb-8">
          Upload Teller (CAST) and GL sheets, compare, and export results.
        </p>

        {/* Uploads */}
        <div className="grid md:grid-cols-2 gap-6 mb-6">
          <div>
            <label className="block font-medium text-gray-700 mb-1">
              Teller (CAST) Sheet
            </label>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(e) =>
                e.target.files?.[0] && parseTeller(e.target.files[0])
              }
              className="w-full p-2 border rounded-md"
            />
            {tellerRows.length > 0 && (
              <p className="text-sm text-green-600 mt-1">
                ✅ {tellerRows.length} Teller Rows Loaded
              </p>
            )}
          </div>
          <div>
            <label className="block font-medium text-gray-700 mb-1">
              GL Sheet
            </label>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => e.target.files?.[0] && parseGL(e.target.files[0])}
              className="w-full p-2 border rounded-md"
            />
            {glRows.length > 0 && (
              <p className="text-sm text-blue-600 mt-1">
                ✅ {glRows.length} GL Rows Loaded
              </p>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap justify-center gap-3 mb-4">
          {["teller_debit", "teller_credit", "gl_debit", "gl_credit"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`px-4 py-2 rounded-lg font-medium ${
                activeTab === tab
                  ? "bg-gradient-to-r from-blue-600 to-teal-500 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {tab.replace("_", " ").toUpperCase()}
            </button>
          ))}
        </div>

        {/* Filter */}
        {activeTab.includes("gl") && (
          <div className="flex flex-wrap justify-center gap-3 mb-6">
            <input
              type="text"
              placeholder="Filter by User ID"
              value={glFilterUser}
              onChange={(e) => setGlFilterUser(e.target.value)}
              className="border p-2 rounded-md"
            />
            <button
              onClick={handleFilter}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
            >
              Filter
            </button>
          </div>
        )}

        {/* Names */}
        <div className="grid md:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block font-medium text-gray-700 mb-1">
              Teller Name
            </label>
            <input
              type="text"
              value={tellerName}
              onChange={(e) => setTellerName(e.target.value)}
              className="w-full border p-2 rounded-md"
            />
          </div>
          <div>
            <label className="block font-medium text-gray-700 mb-1">
              Supervisor Name
            </label>
            <input
              type="text"
              value={supervisorName}
              onChange={(e) => setSupervisorName(e.target.value)}
              className="w-full border p-2 rounded-md"
            />
          </div>
        </div>

        {/* Preview Table */}
        {currentData.length > 0 && (
          <div className="overflow-auto border rounded-xl max-h-[500px]">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-100 sticky top-0">
                <tr>
                  {Object.keys(currentData[0]).slice(0, 8).map((key) => (
                    <th key={key} className="px-3 py-2 text-left font-semibold">
                      {key}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {currentData.slice(0, 100).map((row, i) => (
                  <tr key={i} className="border-t hover:bg-gray-50">
                    {Object.values(row)
                      .slice(0, 8)
                      .map((val, j) => (
                        <td key={j} className="px-3 py-1">
                          {String(val)}
                        </td>
                      ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-center gap-4 mt-8 flex-wrap">
          <button
            onClick={handleExport}
            className="flex items-center bg-gradient-to-r from-blue-600 to-teal-500 text-white px-4 py-2 rounded-lg hover:opacity-90"
          >
            <Download className="mr-2 h-4 w-4" /> Export Result
          </button>
          <button
            onClick={() => alert('Submitted successfully ✅')}
            className="border px-4 py-2 rounded-lg hover:bg-gray-100"
          >
            Dummy Submit
          </button>
        </div>
      </div>
    </div>
  );
}
