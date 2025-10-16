"use client";

import { useState } from "react";
import * as XLSX from "xlsx";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface RecordRow {
  accountNumber: string;
  amount: number;
  type: "credit" | "debit";
  matched?: boolean;
}

export default function TellerGLReconciliation() {
  const [glCredit, setGlCredit] = useState<RecordRow[]>([]);
  const [glDebit, setGlDebit] = useState<RecordRow[]>([]);
  const [tellerCredit, setTellerCredit] = useState<RecordRow[]>([]);
  const [tellerDebit, setTellerDebit] = useState<RecordRow[]>([]);
  const [activeTab, setActiveTab] = useState("gl-credit");

  const handleFileUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    setState: (data: RecordRow[]) => void,
    type: "credit" | "debit"
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const data = evt.target?.result;
      if (!data) return;
      const workbook = XLSX.read(data, { type: "binary" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const json: any[] = XLSX.utils.sheet_to_json(sheet);

      const formatted = json.map((r) => ({
        accountNumber: String(r["Account Number"] || r["Acct No"] || r["Account"]),
        amount: Number(r["Amount"] || r["Value"] || 0),
        type,
      }));
      setState(formatted);
    };
    reader.readAsBinaryString(file);
  };

  const matchRecords = () => {
    const matchedGLCredit = glCredit.map((gl) => ({
      ...gl,
      matched: tellerCredit.some(
        (t) => t.accountNumber === gl.accountNumber && t.amount === gl.amount
      ),
    }));

    const matchedGLDebit = glDebit.map((gl) => ({
      ...gl,
      matched: tellerDebit.some(
        (t) => t.accountNumber === gl.accountNumber && t.amount === gl.amount
      ),
    }));

    setGlCredit(matchedGLCredit);
    setGlDebit(matchedGLDebit);
  };

  const renderTable = (title: string, data: RecordRow[]) => (
    <div className="overflow-x-auto max-h-[70vh] overflow-y-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            <th className="p-3 text-left font-semibold">Account Number</th>
            <th className="p-3 text-right font-semibold">Amount</th>
            <th className="p-3 text-center font-semibold">Match</th>
          </tr>
        </thead>
        <tbody>
          {data.map((r, i) => (
            <tr
              key={i}
              className={`border-t border-border ${
                r.matched
                  ? "bg-green-100 dark:bg-green-900/30"
                  : "bg-red-50 dark:bg-red-900/20"
              }`}
            >
              <td className="p-2">{r.accountNumber}</td>
              <td className="p-2 text-right">{r.amount.toLocaleString()}</td>
              <td className="p-2 text-center font-semibold">
                {r.matched ? "✔️" : "❌"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight text-foreground">
        Teller/GL Reconciliation
      </h1>
      <p className="text-muted-foreground">
        Upload Teller and GL files to auto-match by Account Number & Amount
      </p>

      <Card className="border-primary/20 bg-card/50 backdrop-blur">
        <CardHeader>
          <CardTitle>Upload Files</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="font-semibold">GL Credit File</label>
            <Input
              type="file"
              accept=".xlsx, .xls"
              onChange={(e) => handleFileUpload(e, setGlCredit, "credit")}
            />
          </div>
          <div>
            <label className="font-semibold">GL Debit File</label>
            <Input
              type="file"
              accept=".xlsx, .xls"
              onChange={(e) => handleFileUpload(e, setGlDebit, "debit")}
            />
          </div>
          <div>
            <label className="font-semibold">Teller Credit File</label>
            <Input
              type="file"
              accept=".xlsx, .xls"
              onChange={(e) => handleFileUpload(e, setTellerCredit, "credit")}
            />
          </div>
          <div>
            <label className="font-semibold">Teller Debit File</label>
            <Input
              type="file"
              accept=".xlsx, .xls"
              onChange={(e) => handleFileUpload(e, setTellerDebit, "debit")}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={matchRecords}>Match Records</Button>
      </div>

      <Tabs
        defaultValue="gl-credit"
        value={activeTab}
        onValueChange={setActiveTab}
        className="w-full"
      >
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="gl-credit">GL Credit</TabsTrigger>
          <TabsTrigger value="gl-debit">GL Debit</TabsTrigger>
          <TabsTrigger value="teller-credit">Teller Credit</TabsTrigger>
          <TabsTrigger value="teller-debit">Teller Debit</TabsTrigger>
        </TabsList>

        <TabsContent value="gl-credit" className="mt-6">
          {renderTable("GL Credit", glCredit)}
        </TabsContent>
        <TabsContent value="gl-debit" className="mt-6">
          {renderTable("GL Debit", glDebit)}
        </TabsContent>
        <TabsContent value="teller-credit" className="mt-6">
          {renderTable("Teller Credit", tellerCredit)}
        </TabsContent>
        <TabsContent value="teller-debit" className="mt-6">
          {renderTable("Teller Debit", tellerDebit)}
        </TabsContent>
      </Tabs>
    </div>
  );
}
