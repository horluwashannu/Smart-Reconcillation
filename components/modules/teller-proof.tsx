// File: components/ExcelMatcher.tsx
"use client";

import React, { useState } from "react";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

interface TellerRow {
  [key: string]: any;
}

interface GLRow {
  [key: string]: any;
}

const ExcelMatcher = () => {
  const [tellerData, setTellerData] = useState<TellerRow[]>([]);
  const [glData, setGlData] = useState<GLRow[]>([]);
  const [matchedData, setMatchedData] = useState<GLRow[]>([]);

  // --- File Upload Handlers ---
  const handleTellerUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const data = evt.target?.result;
      const workbook = XLSX.read(data, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const json = XLSX.utils.sheet_to_json<TellerRow>(sheet, { defval: 0 });
      setTellerData(json);
    };
    reader.readAsArrayBuffer(file);
  };

  const handleGLUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const data = evt.target?.result;
      const workbook = XLSX.read(data, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const json = XLSX.utils.sheet_to_json<GLRow>(sheet, { defval: 0 });
      setGlData(json);
    };
    reader.readAsArrayBuffer(file);
  };

  // --- Processing Logic ---
  const processMatch = () => {
    if (!tellerData.length || !glData.length) return;

    // Teller Debit/Credit mapping
    const tellerDebit = ["SAVINGS WITHDR.", "TO VAULT", "EXPENSE"];
    const tellerCredit = ["CASH DEP", "CASH DEP 2", "FROM VAULT", "WUMT"];

    const tellerLong: TellerRow[] = [];
    tellerData.forEach((row) => {
      Object.keys(row).forEach((col) => {
        if (tellerDebit.includes(col) && row[col] > 0) {
          tellerLong.push({
            Account_Number: row["ACCOUNT NO"] || row["ACCOUNT NO2"],
            Amount: row[col],
            DR_CR: "Debit",
            CHEQUES: row["CHEQUES"] || "",
          });
        } else if (tellerCredit.includes(col) && row[col] > 0) {
          tellerLong.push({
            Account_Number: row["ACCOUNT NO"] || row["ACCOUNT NO2"],
            Amount: row[col],
            DR_CR: "Credit",
            CHEQUES: row["CHEQUES"] || "",
          });
        }
      });
    });

    // GL Debit/Credit mapping
    const glFiltered = glData
      .map((row) => {
        const desc = String(row["TRANSACTION DESCRIPTION"] || "").toUpperCase();
        let DR_CR: string = "";
        if (desc.includes("WITHDRAWAL") || desc.includes("TRANSFER")) DR_CR = "Debit";
        else if (desc.includes("DEPOSIT")) DR_CR = "Credit";
        return { ...row, DR_CR };
      })
      .filter((row) => row.DR_CR === "Debit" || row.DR_CR === "Credit");

    // Matching by Account + Amount + DR/CR
    const matched: GLRow[] = [];
    tellerLong.forEach((tRow) => {
      glFiltered.forEach((gRow) => {
        if (
          tRow.Account_Number === gRow["ACCOUNT NUMBER"] &&
          tRow.Amount === gRow["LCY AMOUNT"] &&
          tRow.DR_CR === gRow.DR_CR
        ) {
          matched.push(gRow);
        }
      });
    });

    setMatchedData(matched);
  };

  // --- Export Function ---
  const exportCSV = () => {
    if (!matchedData.length) return;
    const ws = XLSX.utils.json_to_sheet(matchedData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Matched");
    XLSX.writeFile(wb, "matched_gl_result.xlsx");
  };

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-bold">Teller & GL Reconciliation</h1>

      <div className="flex gap-4">
        <div>
          <label className="block font-medium">Upload Teller</label>
          <input type="file" accept=".xlsx" onChange={handleTellerUpload} />
          {tellerData.length > 0 && (
            <div className="mt-2 text-sm">
              Preview: {tellerData.slice(0, 5).map((row, i) => (
                <div key={i}>{JSON.stringify(row)}</div>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className="block font-medium">Upload GL</label>
          <input type="file" accept=".xlsx" onChange={handleGLUpload} />
          {glData.length > 0 && (
            <div className="mt-2 text-sm">
              Preview: {glData.slice(0, 5).map((row, i) => (
                <div key={i}>{JSON.stringify(row)}</div>
              ))}
            </div>
          )}
        </div>
      </div>

      <button
        className="bg-blue-500 text-white px-4 py-2 rounded"
        onClick={processMatch}
      >
        Process & Match
      </button>

      {matchedData.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mt-4">Matched Result</h2>
          <div className="max-h-64 overflow-auto border p-2">
            {matchedData.slice(0, 50).map((row, i) => (
              <div key={i}>{JSON.stringify(row)}</div>
            ))}
            {matchedData.length > 50 && <div>... ({matchedData.length} rows)</div>}
          </div>
          <button
            className="bg-green-500 text-white px-4 py-2 rounded mt-2"
            onClick={exportCSV}
          >
            Export Matched GL
          </button>
        </div>
      )}
    </div>
  );
};

export default ExcelMatcher;
