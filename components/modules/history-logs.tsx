'use client';

import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { Download, Upload, FileSpreadsheet } from 'lucide-react';

interface RecordItem {
  id: number;
  name: string;
  accountNumber: string;
  amount: number;
  date: string;
  status: string;
}

export default function HistoryLogs() {
  const [records, setRecords] = useState<RecordItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  // Load stored data on page load
  useEffect(() => {
    const storedData = localStorage.getItem('callover_records');
    if (storedData) setRecords(JSON.parse(storedData));
  }, []);

  // Save to local storage whenever updated
  useEffect(() => {
    localStorage.setItem('callover_records', JSON.stringify(records));
  }, [records]);

  // Handle Excel upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const data = new Uint8Array(evt.target?.result as ArrayBuffer);
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[];

      // Assuming Excel format: Name | Account Number | Amount | Date | Status
      const extracted: RecordItem[] = jsonData.slice(1).map((row, index) => ({
        id: index + 1,
        name: row[0] || '',
        accountNumber: row[1] || '',
        amount: Number(row[2]) || 0,
        date: row[3] || '',
        status: row[4] || 'Pending',
      }));

      setRecords(extracted);
    };
    reader.readAsArrayBuffer(file);
  };

  // Export current table to Excel
  const handleExport = () => {
    const worksheet = XLSX.utils.json_to_sheet(records);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'CallOverData');
    XLSX.writeFile(workbook, 'callover_records.xlsx');
  };

  // Simple client-side search (no Fuse.js)
  const filteredRecords = records.filter((item) =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.accountNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.status.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <FileSpreadsheet className="w-6 h-6 text-green-600" />
          Call Over Records
        </h1>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition">
            <Upload className="w-4 h-4" />
            <span>Upload Excel</span>
            <input
              type="file"
              accept=".xlsx, .xls"
              className="hidden"
              onChange={handleFileUpload}
            />
          </label>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
          >
            <Download className="w-4 h-4" />
            <span>Export</span>
          </button>
        </div>
      </div>

      <div className="bg-white p-4 rounded-lg shadow">
        <div className="flex justify-between items-center mb-4">
          <input
            type="text"
            placeholder="Search name, account, or status..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="border border-gray-300 rounded-md p-2 w-1/2 focus:ring-2 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-500">
            Showing {filteredRecords.length} of {records.length} records
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full border border-gray-200 rounded-lg text-sm">
            <thead className="bg-gray-100 text-gray-700">
              <tr>
                <th className="p-3 border">#</th>
                <th className="p-3 border text-left">Name</th>
                <th className="p-3 border text-left">Account Number</th>
                <th className="p-3 border text-left">Amount</th>
                <th className="p-3 border text-left">Date</th>
                <th className="p-3 border text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.length > 0 ? (
                filteredRecords.map((rec, idx) => (
                  <tr
                    key={rec.id}
                    className={`${
                      idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                    } hover:bg-blue-50 transition`}
                  >
                    <td className="p-3 border text-center">{idx + 1}</td>
                    <td className="p-3 border">{rec.name}</td>
                    <td className="p-3 border">{rec.accountNumber}</td>
                    <td className="p-3 border text-green-700 font-semibold">
                      ₦{rec.amount.toLocaleString()}
                    </td>
                    <td className="p-3 border">{rec.date}</td>
                    <td
                      className={`p-3 border font-medium ${
                        rec.status.toLowerCase() === 'approved'
                          ? 'text-green-600'
                          : rec.status.toLowerCase() === 'pending'
                          ? 'text-yellow-600'
                          : 'text-red-600'
                      }`}
                    >
                      {rec.status}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={6}
                    className="text-center py-10 text-gray-500 italic"
                  >
                    No records found. Upload an Excel file to begin.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
