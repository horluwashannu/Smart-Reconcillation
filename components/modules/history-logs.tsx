// App.tsx
import React, { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import Fuse from "fuse.js";

interface Transaction {
  Date: string;
  Narration: string;
  Account: string;
  Amount: number;
  Type: "Debit" | "Credit";
  RefNo: string;
  Status?: string; // Matched, Mismatch, Pending, Duplicate
  Remarks?: string;
}

const App: React.FC = () => {
  const [tickets, setTickets] = useState<Transaction[]>([]);
  const [gls, setGLs] = useState<Transaction[]>([]);
  const [comparisonResults, setComparisonResults] = useState<Transaction[]>([]);

  // Load previous comparison if exists
  useEffect(() => {
    const stored = localStorage.getItem("comparisonResults");
    if (stored) setComparisonResults(JSON.parse(stored));
  }, []);

  useEffect(() => {
    localStorage.setItem("comparisonResults", JSON.stringify(comparisonResults));
  }, [comparisonResults]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, type: "ticket" | "gl") => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const data = evt.target?.result;
      if (!data) return;

      const workbook = XLSX.read(data, { type: "binary" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const jsonData: any[] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
      const headers = jsonData[0] as string[];

      const idxMap: Record<string, number> = {
        Date: headers.indexOf("Date"),
        Narration: headers.indexOf("Narration"),
        Account: headers.indexOf("Account"),
        Amount: headers.indexOf("Amount"),
        Type: headers.indexOf("Type"),
        RefNo: headers.indexOf("Ref No"),
      };

      const transactions: Transaction[] = jsonData.slice(1).map((row: any) => ({
        Date: row[idxMap.Date],
        Narration: row[idxMap.Narration],
        Account: row[idxMap.Account],
        Amount: Number(row[idxMap.Amount]),
        Type: row[idxMap.Type],
        RefNo: row[idxMap.RefNo],
      }));

      if (type === "ticket") setTickets(transactions);
      else setGLs(transactions);
    };
    reader.readAsBinaryString(file);
  };

  const runComparison = () => {
    const results: Transaction[] = [];

    const fuse = new Fuse(gls, {
      keys: ["Narration"],
      threshold: 0.4, // Adjust for fuzzy matching
    });

    tickets.forEach((ticket) => {
      const glMatch = fuse.search(ticket.Narration);
      if (glMatch.length > 0) {
        const gl = glMatch[0].item;
        if (gl.Amount === ticket.Amount && gl.Date === ticket.Date) {
          results.push({ ...ticket, Status: "Matched", Remarks: "" });
        } else {
          results.push({ ...ticket, Status: "Mismatch", Remarks: `GL: ${gl.Date} ${gl.Amount}` });
        }
      } else {
        results.push({ ...ticket, Status: "Pending Post", Remarks: "Not found in GL" });
      }
    });

    // Check for duplicates in GL
    gls.forEach((gl) => {
      const count = gls.filter((x) => x.Amount === gl.Amount && x.RefNo === gl.RefNo).length;
      if (count > 1) {
        results.push({ ...gl, Status: "Duplicate", Remarks: "Duplicate in GL" });
      }
    });

    setComparisonResults(results);
  };

  const exportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(comparisonResults);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "CallOver");
    XLSX.writeFile(wb, `CallOver_Exceptions_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  const summary = comparisonResults.reduce(
    (acc, curr) => {
      if (curr.Status === "Matched") acc.Matched += 1;
      else if (curr.Status === "Mismatch") acc.Mismatched += 1;
      else if (curr.Status === "Pending Post") acc.Missing += 1;
      else if (curr.Status === "Duplicate") acc.Duplicates += 1;
      return acc;
    },
    { Matched: 0, Mismatched: 0, Missing: 0, Duplicates: 0 }
  );

  return (
    <div style={{ maxWidth: 1000, margin: "50px auto", fontFamily: "Arial, sans-serif" }}>
      <h1>Call-Over Reconciliation</h1>

      <div style={{ marginBottom: 20 }}>
        <input type="file" accept=".xlsx,.xls" onChange={(e) => handleFileUpload(e, "ticket")} />
        <span style={{ marginLeft: 10 }}>Upload Tickets Register</span>
      </div>

      <div style={{ marginBottom: 20 }}>
        <input type="file" accept=".xlsx,.xls" onChange={(e) => handleFileUpload(e, "gl")} />
        <span style={{ marginLeft: 10 }}>Upload GL Statement</span>
      </div>

      <div style={{ marginBottom: 20 }}>
        <button onClick={runComparison}>Run Comparison</button>
        <button onClick={exportExcel} style={{ marginLeft: 10 }}>Export Exceptions</button>
      </div>

      <h2>Summary</h2>
      <ul>
        <li>Total Tickets: {tickets.length}</li>
        <li>Matched: {summary.Matched}</li>
        <li>Mismatched: {summary.Mismatched}</li>
        <li>Missing in GL: {summary.Missing}</li>
        <li>Duplicates: {summary.Duplicates}</li>
      </ul>

      <h2>Detailed Results</h2>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={{ border: "1px solid black", padding: 8 }}>Date</th>
            <th style={{ border: "1px solid black", padding: 8 }}>Narration</th>
            <th style={{ border: "1px solid black", padding: 8 }}>Account</th>
            <th style={{ border: "1px solid black", padding: 8 }}>Amount</th>
            <th style={{ border: "1px solid black", padding: 8 }}>Type</th>
            <th style={{ border: "1px solid black", padding: 8 }}>Ref No</th>
            <th style={{ border: "1px solid black", padding: 8 }}>Status</th>
            <th style={{ border: "1px solid black", padding: 8 }}>Remarks</th>
          </tr>
        </thead>
        <tbody>
          {comparisonResults.map((res, idx) => (
            <tr key={idx} style={{ backgroundColor: res.Status === "Matched" ? "#c8e6c9" :
              res.Status === "Mismatch" ? "#ffecb3" :
              res.Status === "Pending Post" ? "#ffcdd2" :
              res.Status === "Duplicate" ? "#f8bbd0" : "white"
            }}>
              <td style={{ border: "1px solid black", padding: 8 }}>{res.Date}</td>
              <td style={{ border: "1px solid black", padding: 8 }}>{res.Narration}</td>
              <td style={{ border: "1px solid black", padding: 8 }}>{res.Account}</td>
              <td style={{ border: "1px solid black", padding: 8 }}>{res.Amount}</td>
              <td style={{ border: "1px solid black", padding: 8 }}>{res.Type}</td>
              <td style={{ border: "1px solid black", padding: 8 }}>{res.RefNo}</td>
              <td style={{ border: "1px solid black", padding: 8 }}>{res.Status}</td>
              <td style={{ border: "1px solid black", padding: 8 }}>{res.Remarks}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default App;
