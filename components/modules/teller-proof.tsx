"use client";

import { useState } from "react";
import * as XLSX from "xlsx";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";

export default function TellerProof() {
  const [deposit, setDeposit] = useState(0);
  const [withdrawal, setWithdrawal] = useState(0);
  const [buy, setBuy] = useState(0);
  const [sell, setSell] = useState(0);
  const [openingBalance, setOpeningBalance] = useState(0);
  const [tillBalance, setTillBalance] = useState(0);
  const [calculatedBalance, setCalculatedBalance] = useState(0);
  const [loading, setLoading] = useState(false);
  const [glData, setGlData] = useState([]);

  // --- New Logic: Strict Excel GL Upload (No fuzzy match)
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(sheet, { defval: "" });

        // Expected strict headers
        const expectedHeaders = [
          "n",
          "Purpose of expenses",
          "Vendor's Detail",
          "Amount",
          "GL to debit",
          "Monthly allocated budget to the GL",
          "Cumulative expenses made within the month",
          "Remaining balance on GL within the month",
        ];

        const firstRow = Object.keys(json[0] || {});
        const validHeaders = expectedHeaders.every((h) =>
          firstRow.includes(h)
        );

        if (!validHeaders) {
          alert(
            "❌ Invalid Excel format.\nPlease ensure your columns exactly match:\n\n" +
              expectedHeaders.join(", ")
          );
          return;
        }

        setGlData(json);
        alert("✅ GL file uploaded successfully!");
      } catch (err) {
        console.error(err);
        alert("Error reading file. Please check your Excel format.");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleCalculate = () => {
    setLoading(true);
    setTimeout(() => {
      const result = openingBalance + deposit + sell - withdrawal - buy;
      setCalculatedBalance(result);
      setLoading(false);
    }, 800);
  };

  const handleDummySubmit = () => {
    alert("✅ Teller proof submitted successfully!");
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      <Card className="shadow-md border border-gray-200">
        <CardHeader>
          <CardTitle>Teller Proof Summary</CardTitle>
          <CardDescription>
            Upload your GL file and verify teller balances automatically.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-5">
          {/* GL Upload */}
          <div>
            <Label htmlFor="glFile">Upload GL Excel File</Label>
            <Input
              id="glFile"
              type="file"
              accept=".xlsx, .xls"
              onChange={handleFileUpload}
              className="mt-2"
            />
          </div>

          {/* Inputs */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <Label>Opening Balance</Label>
              <Input
                type="number"
                value={openingBalance}
                onChange={(e) => setOpeningBalance(Number(e.target.value))}
              />
            </div>
            <div>
              <Label>Deposit</Label>
              <Input
                type="number"
                value={deposit}
                onChange={(e) => setDeposit(Number(e.target.value))}
              />
            </div>
            <div>
              <Label>Withdrawal</Label>
              <Input
                type="number"
                value={withdrawal}
                onChange={(e) => setWithdrawal(Number(e.target.value))}
              />
            </div>
            <div>
              <Label>Buy</Label>
              <Input
                type="number"
                value={buy}
                onChange={(e) => setBuy(Number(e.target.value))}
              />
            </div>
            <div>
              <Label>Sell</Label>
              <Input
                type="number"
                value={sell}
                onChange={(e) => setSell(Number(e.target.value))}
              />
            </div>
            <div>
              <Label>Till Balance (Expected)</Label>
              <Input
                type="number"
                value={tillBalance}
                onChange={(e) => setTillBalance(Number(e.target.value))}
              />
            </div>
          </div>

          {/* Loader + Result */}
          <div className="flex items-center gap-4">
            <Button onClick={handleCalculate} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Calculating…
                </>
              ) : (
                "Calculate"
              )}
            </Button>

            {calculatedBalance !== 0 && (
              <p className="text-sm text-gray-700">
                <strong>Calculated Till Balance:</strong> ₦
                {calculatedBalance.toLocaleString()}
              </p>
            )}
          </div>

          {/* Notes */}
          <div>
            <Label>Comments / Notes</Label>
            <Textarea
              placeholder="Enter remarks or observations…"
              className="mt-2"
            />
          </div>

          {/* Dummy Submit */}
          <div className="pt-4 border-t flex justify-end">
            <Button onClick={handleDummySubmit}>Dummy Submit</Button>
          </div>
        </CardContent>
      </Card>

      {/* Dialog for Viewing Uploaded GL */}
      {glData.length > 0 && (
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline">View Uploaded GL Data</Button>
          </DialogTrigger>
          <DialogContent className="max-h-[80vh] overflow-y-auto">
            <table className="w-full text-sm border">
              <thead className="bg-gray-100">
                <tr>
                  {Object.keys(glData[0]).map((key) => (
                    <th key={key} className="border px-2 py-1 text-left">
                      {key}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {glData.map((row, i) => (
                  <tr key={i}>
                    {Object.values(row).map((val, j) => (
                      <td key={j} className="border px-2 py-1">
                        {val}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
