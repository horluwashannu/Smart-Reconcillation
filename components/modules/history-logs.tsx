"use client";

import React, { useState } from "react";
import * as XLSX from "xlsx";
import Fuse from "fuse.js";

interface Row {
  Date: string;
  Narration: string;
  Account: string;
  Amount: number;
  Type: string;
  RefNo: string;
}

interface ComparisonResult extends Row {
  Status: string;
  Remarks?: string;
}

const CallOverPage: React.FC = () => {
  const [user, setUser] = useState("");
  const [role, setRole] = useState("");
  const [tickets, setTickets] = useState<Row[]>([]);
  const [gl, setGl] = useState<Row[]>([]);
  const [results, setResults] = useState<ComparisonResult[]>([]);

  const handleFileUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: React.Dispatch<React.SetStateAction<Row[]>>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const data = evt.target?.result;
      if (!data) return;

      const workbook = XLSX.read(data, { type: "binary" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData: Row[] = XLSX.utils.sheet_to_json(worksheet, { defval: "" }) as Row[];
      setter(
        jsonData.map((r) => ({
          Date: r.Date,
          Narration: r.Narration,
          Account: r.Account,
          Amount: Number(r.Amount),
          Type: r.Type,
          RefNo: r.RefNo,
        }))
      );
    };
    reader.readAsBinaryString(file);
  };

  const compareData = () => {
    const fuse = new Fuse(gl, { keys: ["Narration"], threshold: 0.3 });

    const comparison: ComparisonResult[] = tickets.map((ticket) => {
      const match = fuse.search(ticket.Narration)[0];
      if (match) {
        const glRow = match.item;
        if (glRow.Amount === ticket.Amount && glRow.Date === ticket.Date) {
          return { ...ticket, Status: "Matched" };
        }
        return { ...ticket, Status: "Mismatch", Remarks: "Amount or Date differs" };
      } else {
        return { ...ticket, Status: "Pending Post", Remarks: "Missing in GL" };
      }
    });

    // Detect duplicates in GL
    const duplicates = gl.reduce((acc, row, idx, arr) => {
      const count = arr.filter((r) => r.Amount === row.Amount && r.RefNo === row.RefNo).length;
      if (count > 1) acc.push(row.RefNo);
      return acc;
    }, [] as string[]);

    const finalResults = comparison.map((r) =>
      duplicates.includes(r.RefNo) ? { ...r, Status: "Duplicate", Remarks: "Duplicate in GL" } : r
    );

    setResults(finalResults);
  };

  const exportExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(results);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "CallOver");
    XLSX.writeFile(workbook, `CallOver_Exceptions_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const metrics = {
    totalTickets: results.length,
    matched: results.filter((r) => r.Status === "Matched").length,
    mismatched: results.filter((r) => r.Status === "Mismatch").length,
    missing: results.filter((r) => r.Status === "Pending Post").length,
    duplicates: results.filter((r) => r.Status === "Duplicate").length,
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Call-Over Dashboard</h1>

      {/* User & Role */}
      <div className="flex flex-wrap gap-4 mb-6">
        <input
          type="text"
          placeholder="Enter User"
          value={user}
          onChange={(e) => setUser(e.target.value)}
          className="border p-2 rounded w-60"
        />
        <input
          type="text"
          placeholder="Enter Role"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="border p-2 rounded w-60"
        />
      </div>

      {/* File Uploads */}
      <div className="flex flex-wrap gap-6 mb-6">
        <div>
          <label className="block mb-2 font-medium">Upload Tickets Register:</label>
          <input type="file" accept=".xlsx,.xls" onChange={(e) => handleFileUpload(e, setTickets)} />
        </div>
        <div>
          <label className="block mb-2 font-medium">Upload GL Statement:</label>
          <input type="file" accept=".xlsx,.xls" onChange={(e) => handleFileUpload(e, setGl)} />
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-4 mb-6">
        <button
          onClick={compareData}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition"
        >
          Run Comparison
        </button>
        <button
          onClick={exportExcel}
          className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition"
        >
          Export Results
        </button>
      </div>

      {/* Metrics */}
      {results.length > 0 && (
        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-3">Metrics</h2>
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
            <div className="bg-gray-100 p-4 rounded shadow">
              <div className="text-gray-600">Total Tickets</div>
              <div className="text-2xl font-bold">{metrics.totalTickets}</div>
            </div>
            <div className="bg-green-100 p-4 rounded shadow">
              <div className="text-gray-600">Matched</div>
              <div className="text-2xl font-bold">{metrics.matched}</div>
            </div>
            <div className="bg-orange-100 p-4 rounded shadow">
              <div className="text-gray-600">Mismatched</div>
              <div className="text-2xl font-bold">{metrics.mismatched}</div>
            </div>
            <div className="bg-red-100 p-4 rounded shadow">
              <div className="text-gray-600">Missing in GL</div>
              <div className="text-2xl font-bold">{metrics.missing}</div>
            </div>
            <div className="bg-pink-100 p-4 rounded shadow">
              <div className="text-gray-600">Duplicates</div>
              <div className="text-2xl font-bold">{metrics.duplicates}</div>
            </div>
          </div>
        </div>
      )}

      {/* Results Table */}
      {results.length > 0 && (
        <div className="overflow-auto max-h-[500px] border rounded">
          <table className="min-w-full border-collapse">
            <thead className="bg-gray-200 sticky top-0">
              <tr>
                <th className="p-2 border">Date</th>
                <th className="p-2 border">Narration</th>
                <th className="p-2 border">Account</th>
                <th className="p-2 border">Amount</th>
                <th className="p-2 border">Type</th>
                <th className="p-2 border">Ref No</th>
                <th className="p-2 border">Status</th>
                <th className="p-2 border">Remarks</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r, idx) => (
                <tr
                  key={idx}
                  className={
                    r.Status === "Matched"
                      ? "bg-green-100"
                      : r.Status === "Mismatch"
                      ? "bg-orange-100"
                      : r.Status === "Pending Post"
                      ? "bg-red-100"
                      : "bg-pink-100"
                  }
                >
                  <td className="p-2 border">{r.Date}</td>
                  <td className="p-2 border">{r.Narration}</td>
                  <td className="p-2 border">{r.Account}</td>
                  <td className="p-2 border">{r.Amount}</td>
                  <td className="p-2 border">{r.Type}</td>
                  <td className="p-2 border">{r.RefNo}</td>
                  <td className="p-2 border">{r.Status}</td>
                  <td className="p-2 border">{r.Remarks || ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default CallOverPage;
