"use client";

import React, { useState } from "react";
import * as XLSX from "xlsx";

export default function TellerProof() {
  const [tellerData, setTellerData] = useState<any[]>([]);
  const [glData, setGLData] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState("upload");
  const [matched, setMatched] = useState<any[]>([]);
  const [unmatchedTeller, setUnmatchedTeller] = useState<any[]>([]);
  const [unmatchedGL, setUnmatchedGL] = useState<any[]>([]);

  // Read and convert Excel to JSON
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, type: string) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const data = evt.target?.result;
      const workbook = XLSX.read(data, { type: "binary" });
      const sheetName = workbook.SheetNames[1] || workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const json = XLSX.utils.sheet_to_json(sheet);
      if (type === "teller") setTellerData(json);
      else setGLData(json);
    };
    reader.readAsBinaryString(file);
  };

  // Matching logic (Account Number + Amount)
  const reconcile = () => {
    const matches: any[] = [];
    const unmatchedT: any[] = [];
    const unmatchedG = [...glData];

    tellerData.forEach((tRow) => {
      const tAcc = (tRow["ACCOUNT NO"] || tRow["Account Number"] || "").toString().trim();
      const tAmt = Number(tRow["SAVINGS WITHDR."] || tRow["LCY AMOUNT"] || tRow["Amount"] || 0);

      const gIndex = unmatchedG.findIndex((gRow) => {
        const gAcc = (gRow["ACCOUNT NUMBER"] || gRow["Account Number"] || "").toString().trim();
        const gAmt = Number(gRow["LCY AMOUNT"] || gRow["Amount"] || 0);
        return tAcc === gAcc && tAmt === gAmt;
      });

      if (gIndex >= 0) {
        matches.push({ ...tRow, matchedWith: unmatchedG[gIndex] });
        unmatchedG.splice(gIndex, 1);
      } else unmatchedT.push(tRow);
    });

    setMatched(matches);
    setUnmatchedTeller(unmatchedT);
    setUnmatchedGL(unmatchedG);
    setActiveTab("reconcile");
  };

  // Export helper
  const exportToExcel = () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(matched), "Matched");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(unmatchedTeller), "Unmatched Teller");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(unmatchedGL), "Unmatched GL");
    XLSX.writeFile(wb, "reconciliation_result.xlsx");
  };

  const SummaryCard = ({ title, value, color }: any) => (
    <div className={`rounded-2xl shadow p-4 text-center text-white ${color}`}>
      <h3 className="text-sm opacity-80">{title}</h3>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-500 to-teal-400 text-white rounded-xl p-4 shadow mb-6">
        <h1 className="text-2xl font-bold">Smart Teller ↔ GL Reconciliation</h1>
        <p className="opacity-80 text-sm">Upload Teller & GL Sheets, Preview, and Match Automatically</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        {[
          ["upload", "Upload Files"],
          ["preview", "Preview Data"],
          ["reconcile", "Reconciliation"],
        ].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition ${
              activeTab === key
                ? "bg-teal-500 text-white shadow"
                : "bg-white border border-gray-200 text-gray-700"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Upload Tab */}
      {activeTab === "upload" && (
        <div className="grid md:grid-cols-2 gap-4">
          <div className="p-4 bg-white rounded-xl shadow">
            <h2 className="font-semibold mb-2">Upload Teller Sheet</h2>
            <input type="file" accept=".xlsx,.csv" onChange={(e) => handleFileUpload(e, "teller")} />
          </div>
          <div className="p-4 bg-white rounded-xl shadow">
            <h2 className="font-semibold mb-2">Upload GL Sheet</h2>
            <input type="file" accept=".xlsx,.csv" onChange={(e) => handleFileUpload(e, "gl")} />
          </div>
          <button
            onClick={reconcile}
            disabled={!tellerData.length || !glData.length}
            className="mt-4 bg-teal-500 text-white px-6 py-2 rounded-lg shadow hover:bg-teal-600"
          >
            Run Reconciliation
          </button>
        </div>
      )}

      {/* Preview Tab */}
      {activeTab === "preview" && (
        <div className="grid md:grid-cols-2 gap-4">
          {[{ title: "Teller Data", data: tellerData }, { title: "GL Data", data: glData }].map(
            ({ title, data }) => (
              <div key={title} className="bg-white rounded-xl shadow p-4">
                <h2 className="font-semibold mb-3">{title}</h2>
                <div className="overflow-x-auto max-h-[400px]">
                  <table className="min-w-full text-sm border">
                    <thead className="bg-gray-100 sticky top-0">
                      <tr>
                        {data[0] &&
                          Object.keys(data[0]).map((key) => (
                            <th key={key} className="p-2 border text-left">
                              {key}
                            </th>
                          ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.map((row, i) => (
                        <tr key={i} className="odd:bg-gray-50 even:bg-white">
                          {Object.values(row).map((val: any, j) => (
                            <td key={j} className="p-2 border truncate max-w-[180px]">
                              {val?.toString()}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          )}
        </div>
      )}

      {/* Reconciliation Tab */}
      {activeTab === "reconcile" && (
        <div className="space-y-6">
          {/* Summary */}
          <div className="grid sm:grid-cols-3 gap-4">
            <SummaryCard title="Matched Records" value={matched.length} color="bg-green-500" />
            <SummaryCard title="Unmatched Teller" value={unmatchedTeller.length} color="bg-orange-500" />
            <SummaryCard title="Unmatched GL" value={unmatchedGL.length} color="bg-red-500" />
          </div>

          {/* Matched Table */}
          <div className="bg-white p-4 rounded-xl shadow">
            <h2 className="font-semibold mb-2 text-green-700">Matched Entries</h2>
            <div className="overflow-x-auto max-h-[350px]">
              <table className="min-w-full text-sm border">
                <thead className="bg-green-50 sticky top-0">
                  <tr>
                    {matched[0] &&
                      Object.keys(matched[0]).map((key) => (
                        <th key={key} className="p-2 border text-left">
                          {key}
                        </th>
                      ))}
                  </tr>
                </thead>
                <tbody>
                  {matched.map((row, i) => (
                    <tr key={i} className="odd:bg-green-50 even:bg-green-100">
                      {Object.values(row).map((val: any, j) => (
                        <td key={j} className="p-2 border truncate max-w-[200px]">
                          {val?.toString()}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Unmatched Teller */}
          <div className="bg-white p-4 rounded-xl shadow">
            <h2 className="font-semibold mb-2 text-orange-700">Unmatched Teller Entries</h2>
            <div className="overflow-x-auto max-h-[350px]">
              <table className="min-w-full text-sm border">
                <thead className="bg-orange-50 sticky top-0">
                  <tr>
                    {unmatchedTeller[0] &&
                      Object.keys(unmatchedTeller[0]).map((key) => (
                        <th key={key} className="p-2 border text-left">
                          {key}
                        </th>
                      ))}
                  </tr>
                </thead>
                <tbody>
                  {unmatchedTeller.map((row, i) => (
                    <tr key={i} className="odd:bg-orange-50 even:bg-orange-100">
                      {Object.values(row).map((val: any, j) => (
                        <td key={j} className="p-2 border truncate max-w-[200px]">
                          {val?.toString()}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Unmatched GL */}
          <div className="bg-white p-4 rounded-xl shadow">
            <h2 className="font-semibold mb-2 text-red-700">Unmatched GL Entries</h2>
            <div className="overflow-x-auto max-h-[350px]">
              <table className="min-w-full text-sm border">
                <thead className="bg-red-50 sticky top-0">
                  <tr>
                    {unmatchedGL[0] &&
                      Object.keys(unmatchedGL[0]).map((key) => (
                        <th key={key} className="p-2 border text-left">
                          {key}
                        </th>
                      ))}
                  </tr>
                </thead>
                <tbody>
                  {unmatchedGL.map((row, i) => (
                    <tr key={i} className="odd:bg-red-50 even:bg-red-100">
                      {Object.values(row).map((val: any, j) => (
                        <td key={j} className="p-2 border truncate max-w-[200px]">
                          {val?.toString()}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Export Button */}
          <div className="text-right">
            <button
              onClick={exportToExcel}
              className="bg-blue-500 text-white px-6 py-2 rounded-lg shadow hover:bg-blue-600"
            >
              Export Result
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
