"use client";

import React, { useState } from "react";

export default function TellerProof() {
  const [tellerData, setTellerData] = useState<any[]>([]);
  const [glData, setGLData] = useState<any[]>([]);
  const [matched, setMatched] = useState<any[]>([]);
  const [unmatched, setUnmatched] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState("upload");

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, type: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const rows = text.split("\n").map((r) => r.split(","));
      const data = rows.slice(1).map((row) => ({
        accountNumber: row[0]?.trim(),
        amount: parseFloat(row[1]),
        type: row[2]?.trim()?.toLowerCase(),
      }));

      if (type === "teller") setTellerData(data);
      else setGLData(data);
    };
    reader.readAsText(file);
  };

  const reconcile = () => {
    const matches: any[] = [];
    const unmatchedEntries: any[] = [];

    tellerData.forEach((t) => {
      const found = glData.find(
        (g) => g.accountNumber === t.accountNumber && g.amount === t.amount
      );
      if (found) matches.push({ ...t, status: "Matched" });
      else unmatchedEntries.push({ ...t, status: "Unmatched" });
    });

    setMatched(matches);
    setUnmatched(unmatchedEntries);
    setActiveTab("results");
  };

  const renderTable = (data: any[], title: string) => (
    <div className="overflow-x-auto max-h-[400px] overflow-y-auto border rounded-lg mt-3">
      <table className="min-w-full border-collapse">
        <thead className="bg-gray-100 sticky top-0">
          <tr>
            <th className="p-2 border text-left">Account Number</th>
            <th className="p-2 border text-left">Amount</th>
            <th className="p-2 border text-left">Type</th>
            <th className="p-2 border text-left">Status</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr
              key={i}
              className={`border ${
                row.status === "Matched" ? "bg-green-50" : row.status === "Unmatched" ? "bg-red-50" : ""
              }`}
            >
              <td className="p-2 border">{row.accountNumber}</td>
              <td className="p-2 border">{row.amount}</td>
              <td className="p-2 border capitalize">{row.type}</td>
              <td className="p-2 border">{row.status || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="p-6 bg-white rounded-xl shadow-lg w-full">
      <h2 className="text-2xl font-semibold mb-4 text-gray-800">Teller–GL Reconciliation</h2>

      {/* Tab Switch */}
      <div className="flex space-x-4 mb-6">
        {["upload", "preview", "results"].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-md font-medium transition-all ${
              activeTab === tab ? "bg-blue-600 text-white" : "bg-gray-200 hover:bg-gray-300"
            }`}
          >
            {tab === "upload" && "Upload Files"}
            {tab === "preview" && "Preview Data"}
            {tab === "results" && "Results"}
          </button>
        ))}
      </div>

      {/* Upload Tab */}
      {activeTab === "upload" && (
        <div className="space-y-6">
          <div>
            <label className="block font-medium text-gray-700 mb-1">Upload Teller File (CSV)</label>
            <input
              type="file"
              accept=".csv"
              onChange={(e) => handleFileUpload(e, "teller")}
              className="w-full p-2 border rounded-md"
            />
          </div>
          <div>
            <label className="block font-medium text-gray-700 mb-1">Upload GL File (CSV)</label>
            <input
              type="file"
              accept=".csv"
              onChange={(e) => handleFileUpload(e, "gl")}
              className="w-full p-2 border rounded-md"
            />
          </div>

          <button
            onClick={reconcile}
            className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-md transition"
          >
            Reconcile
          </button>
        </div>
      )}

      {/* Preview Tab */}
      {activeTab === "preview" && (
        <div>
          <h3 className="text-lg font-semibold mb-2 text-gray-700">Teller Data</h3>
          {renderTable(tellerData, "Teller")}
          <h3 className="text-lg font-semibold mt-6 mb-2 text-gray-700">GL Data</h3>
          {renderTable(glData, "GL")}
        </div>
      )}

      {/* Results Tab */}
      {activeTab === "results" && (
        <div>
          <h3 className="text-lg font-semibold text-green-700 mb-2">Matched Entries</h3>
          {renderTable(matched, "Matched")}
          <h3 className="text-lg font-semibold text-red-700 mt-6 mb-2">Unmatched Entries</h3>
          {renderTable(unmatched, "Unmatched")}
        </div>
      )}
    </div>
  );
}
