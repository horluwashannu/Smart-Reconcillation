"use client";

import { useState } from "react";
import * as XLSX from "xlsx";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableCell,
  TableHead,
} from "@/components/ui/table";
import { Download, Upload } from "lucide-react";

export default function TellerProof() {
  const [activeTab, setActiveTab] = useState<"debit" | "credit">("debit");
  const [tellerRows, setTellerRows] = useState<any[]>([]);
  const [glRows, setGlRows] = useState<any[]>([]);
  const [tellerFile, setTellerFile] = useState<File | null>(null);
  const [glFile, setGlFile] = useState<File | null>(null);
  const [tellerName, setTellerName] = useState("");
  const [supervisorName, setSupervisorName] = useState("");
  const [buyAmount, setBuyAmount] = useState<number | "">("");
  const [userFilter, setUserFilter] = useState("");

  // ===== Helper: Safe Number =====
  const safeNumber = (v: any) => {
    if (!v) return 0;
    const n = Number(String(v).replace(/[^0-9.-]/g, ""));
    return isNaN(n) ? 0 : n;
  };

  // ===== Parse Teller File =====
  const parseTellerFile = async (file: File) => {
    const data = await file.arrayBuffer();
    const wb = XLSX.read(data, { type: "array" });
    const sheet =
      wb.Sheets["cast"] ||
      wb.Sheets[wb.SheetNames.find((n) => n.toLowerCase().includes("cast"))!] ||
      wb.Sheets[wb.SheetNames[1]] ||
      wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
    setTellerRows(rows);
  };

  // ===== Parse GL File =====
  const parseGlFile = async (file: File) => {
    const data = await file.arrayBuffer();
    const wb = XLSX.read(data, { type: "array" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
    setGlRows(rows);
  };

  // ===== Handle Uploads =====
  const handleTellerUpload = (e: any) => {
    const file = e.target.files?.[0];
    if (file) {
      setTellerFile(file);
      parseTellerFile(file);
    }
  };

  const handleGlUpload = (e: any) => {
    const file = e.target.files?.[0];
    if (file) {
      setGlFile(file);
      parseGlFile(file);
    }
  };

  // ===== Export File =====
  const handleExport = () => {
    const ws = XLSX.utils.json_to_sheet([...tellerRows, ...glRows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Proof");
    XLSX.writeFile(wb, "proof_result.xlsx");
  };

  // ===== Filter GL by User ID =====
  const filteredGL = glRows.filter((r) =>
    userFilter ? String(r.User || r.user || "").includes(userFilter) : true
  );

  // ===== Active Table Rows =====
  const activeRows =
    activeTab === "debit"
      ? tellerRows.slice(0, 20)
      : filteredGL.slice(0, 20); // Limit preview

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 via-teal-100 to-white p-4 md:p-10">
      <div className="max-w-7xl mx-auto bg-white shadow-2xl rounded-2xl p-6 md:p-10">
        <motion.h1
          className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-blue-600 to-teal-600 bg-clip-text text-transparent mb-6 text-center"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          Teller & GL Proof Dashboard
        </motion.h1>

        {/* Top Inputs */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <Label>Teller Name</Label>
            <Input
              placeholder="Enter teller name"
              value={tellerName}
              onChange={(e) => setTellerName(e.target.value)}
            />
          </div>
          <div>
            <Label>Supervisor Name</Label>
            <Input
              placeholder="Enter supervisor name"
              value={supervisorName}
              onChange={(e) => setSupervisorName(e.target.value)}
            />
          </div>
        </div>

        {/* File Uploads */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="flex flex-col items-center justify-center border-2 border-dashed border-teal-300 rounded-xl p-6">
            <Label className="font-semibold mb-2">Upload Teller File</Label>
            <Input type="file" onChange={handleTellerUpload} accept=".xlsx,.xls" />
            {tellerFile && (
              <p className="text-xs mt-2 text-gray-500">{tellerFile.name}</p>
            )}
          </div>

          <div className="flex flex-col items-center justify-center border-2 border-dashed border-blue-300 rounded-xl p-6">
            <Label className="font-semibold mb-2">Upload GL File</Label>
            <Input type="file" onChange={handleGlUpload} accept=".xlsx,.xls" />
            {glFile && <p className="text-xs mt-2 text-gray-500">{glFile.name}</p>}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex justify-center gap-4 mb-6">
          <Button
            variant={activeTab === "debit" ? "default" : "outline"}
            className={`px-6 py-2 rounded-full transition-all ${
              activeTab === "debit"
                ? "bg-gradient-to-r from-blue-600 to-teal-500 text-white shadow-md"
                : "bg-white border border-teal-400 text-teal-600"
            }`}
            onClick={() => setActiveTab("debit")}
          >
            Teller Debit / Credit
          </Button>

          <Button
            variant={activeTab === "credit" ? "default" : "outline"}
            className={`px-6 py-2 rounded-full transition-all ${
              activeTab === "credit"
                ? "bg-gradient-to-r from-teal-600 to-blue-500 text-white shadow-md"
                : "bg-white border border-blue-400 text-blue-600"
            }`}
            onClick={() => setActiveTab("credit")}
          >
            GL Debit / Credit
          </Button>
        </div>

        {/* Filter (only visible for GL) */}
        {activeTab === "credit" && (
          <div className="mb-4 flex items-center justify-center gap-2">
            <Label>Filter by User ID</Label>
            <Input
              placeholder="Enter user ID"
              className="w-48"
              value={userFilter}
              onChange={(e) => setUserFilter(e.target.value)}
            />
          </div>
        )}

        {/* Table Preview */}
        <div className="overflow-auto border rounded-xl shadow-inner max-h-[400px]">
          <Table>
            <TableHeader>
              <TableRow className="bg-gradient-to-r from-blue-50 to-teal-50">
                {activeRows.length > 0 &&
                  Object.keys(activeRows[0]).map((key) => (
                    <TableHead key={key}>{key}</TableHead>
                  ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {activeRows.map((row, i) => (
                <TableRow key={i}>
                  {Object.values(row).map((val, j) => (
                    <TableCell key={j}>{String(val)}</TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Buy Amount + Buttons */}
        <div className="mt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <div>
            <Label>Buy Amount</Label>
            <Input
              type="number"
              placeholder="Enter total buy amount"
              value={buyAmount}
              onChange={(e) => setBuyAmount(Number(e.target.value))}
            />
          </div>

          <div className="flex gap-3">
            <Button
              onClick={handleExport}
              className="bg-gradient-to-r from-blue-500 to-teal-500 text-white hover:opacity-90"
            >
              <Download className="w-4 h-4 mr-2" /> Export Result
            </Button>
            <Button className="bg-gradient-to-r from-green-500 to-teal-600 text-white hover:opacity-90">
              <Upload className="w-4 h-4 mr-2" /> Dummy Submit
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
