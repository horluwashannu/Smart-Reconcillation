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

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, setter: React.Dispatch<React.SetStateAction<Row[]>>) => {
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
      setter(jsonData.map(r => ({
        Date: r.Date,
        Narration: r.Narration,
        Account: r.Account,
        Amount: Number(r.Amount),
        Type: r.Type,
        RefNo: r.RefNo
      })));
    };
    reader.readAsBinaryString(file);
  };

  const compareData = () => {
    const fuse = new Fuse(gl, { keys: ["Narration"], threshold: 0.3 });
    const comparison: ComparisonResult[] = tickets.map(ticket => {
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
      const count = arr.filter(r => r.Amount === row.Amount && r.RefNo === row.RefNo).length;
      if (count > 1) acc.push(row.RefNo);
      return acc;
    }, [] as string[]);

    const finalResults = comparison.map(r => duplicates.includes(r.RefNo) ? { ...r, Status: "Duplicate", Remarks: "Duplicate in GL" } : r);
    setResults(finalResults);
  };

  const exportExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(results);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "CallOver");
    XLSX.writeFile(workbook, `CallOver_Exceptions_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  const metrics = {
    totalTickets: results.length,
    matched: results.filter(r => r.Status === "Matched").length,
    mismatched: results.filter(r => r.Status === "Mismatch").length,
    missing: results.filter(r => r.Status === "Pending Post").length,
    duplicates: results.filter(r => r.Status === "Duplicate").length,
  };

  return (
    <div style={{ padding: 20 }}>
      <h1>Call-Over Dashboard</h1>

      <div>
        <input type="text" placeholder="Enter User" value={user} onChange={e => setUser(e.target.value)} />
        <input type="text" placeholder="Enter Role" value={role} onChange={e => setRole(e.target.value)} />
      </div>

      <div style={{ marginTop: 20 }}>
        <label>Upload Tickets Register:</label>
        <input type="file" accept=".xlsx,.xls" onChange={e => handleFileUpload(e, setTickets)} />
      </div>

      <div style={{ marginTop: 20 }}>
        <label>Upload GL Statement:</label>
        <input type="file" accept=".xlsx,.xls" onChange={e => handleFileUpload(e, setGl)} />
      </div>

      <button style={{ marginTop: 20 }} onClick={compareData}>Run Comparison</button>
      <button style={{ marginLeft: 10 }} onClick={exportExcel}>Export Results</button>

      {results.length > 0 && (
        <div style={{ marginTop: 30 }}>
          <h2>Metrics</h2>
          <ul>
            <li>Total Tickets: {metrics.totalTickets}</li>
            <li>Matched: {metrics.matched}</li>
            <li>Mismatched: {metrics.mismatched}</li>
            <li>Missing in GL: {metrics.missing}</li>
            <li>Duplicates: {metrics.duplicates}</li>
          </ul>

          <h2>Results</h2>
          <table border={1} cellPadding={5}>
            <thead>
              <tr>
                <th>Date</th>
                <th>Narration</th>
                <th>Account</th>
                <th>Amount</th>
                <th>Type</th>
                <th>Ref No</th>
                <th>Status</th>
                <th>Remarks</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r, idx) => (
                <tr key={idx} style={{ backgroundColor: r.Status === "Matched" ? "#c8e6c9" : r.Status === "Mismatch" ? "#ffe0b2" : "#ffcdd2" }}>
                  <td>{r.Date}</td>
                  <td>{r.Narration}</td>
                  <td>{r.Account}</td>
                  <td>{r.Amount}</td>
                  <td>{r.Type}</td>
                  <td>{r.RefNo}</td>
                  <td>{r.Status}</td>
                  <td>{r.Remarks || ""}</td>
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
