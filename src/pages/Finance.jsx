// src/pages/Finance.jsx
// Ye page library ki poori financial summary dikhata hai
// 3 kaam karta hai:
// 1. Firebase se students fetch karke revenue calculate karta hai
// 2. Expenses fetch karke net profit calculate karta hai
// 3. PDF aur Excel export karta hai

import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import FinanceCard from "../components/FinanceCard";

// jsPDF — browser mein PDF banane ki library
// jspdf-autotable — jsPDF ka plugin jo tables banata hai PDF mein
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// xlsx — Excel files banane ki library
// file-saver — browser mein file download trigger karta hai
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

export default function Finance() {
  const [students, setStudents] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);

  // Month filter — default current month
  const [selectedMonth, setSelectedMonth] = useState(
    new Date().toISOString().slice(0, 7), // format: "2025-01"
  );

  useEffect(() => {
    fetchData();
  }, []);

  // Firebase se students aur expenses dono fetch karo
  const fetchData = async () => {
    const [studSnap, expSnap] = await Promise.all([
      getDocs(collection(db, "students")),
      getDocs(collection(db, "expenses")),
    ]);
    // Promise.all = dono requests parallel mein bhejo, wait mat karo ek ek karke

    setStudents(studSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
    setExpenses(expSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
    setLoading(false);
  };

  // Selected month ke students filter karo
  // Student ka startDate check karte hain
  const monthStudents = students.filter((s) => {
    if (!s.startDate) return false;
    // startDate "2025-01-15" format mein hai
    // slice(0,7) se "2025-01" milta hai jo selectedMonth se compare hota hai
    return s.startDate.slice(0, 7) === selectedMonth;
  });

  // Total revenue = us month mein aaye sabhi students ki fees ka sum
  const totalRevenue = monthStudents.reduce(
    (sum, s) => sum + (Number(s.feeAmount) || 0),
    0,
  );
  // reduce = array ke saare items par loop karo aur ek value mein combine karo

  // Pending fees = jinki endDate nikal chuki hai (defaulters)
  const pendingStudents = students.filter((s) => {
    if (!s.endDate) return false;
    return new Date(s.endDate) < new Date();
  });
  const totalPending = pendingStudents.reduce(
    (sum, s) => sum + (Number(s.feeAmount) || 0),
    0,
  );

  // Us month ke expenses
  const monthExpenses = expenses.filter((e) => {
    if (!e.date) return false;
    return e.date.slice(0, 7) === selectedMonth;
  });
  const totalExpenses = monthExpenses.reduce(
    (sum, e) => sum + (Number(e.amount) || 0),
    0,
  );

  // Net Profit = Revenue - Expenses
  const netProfit = totalRevenue - totalExpenses;

  // ─── PDF Export ───────────────────────────────────────────────
  // jsPDF se ek naya PDF document banao
  // autoTable se table add karo
  // save() se browser download trigger hota hai
  const exportPDF = () => {
    const doc = new jsPDF();

    // Title
    doc.setFontSize(18);
    doc.text(`LibraryPro — Financial Report`, 14, 20);
    doc.setFontSize(11);
    doc.text(`Month: ${selectedMonth}`, 14, 30);
    doc.text(`Generated: ${new Date().toLocaleDateString("en-IN")}`, 14, 37);

    // Summary section
    doc.setFontSize(13);
    doc.text("Summary", 14, 50);
    autoTable(doc, {
      startY: 55,
      head: [["Metric", "Amount"]],
      body: [
        ["Total Revenue", `Rs. ${totalRevenue}`],
        ["Total Expenses", `Rs. ${totalExpenses}`],
        ["Net Profit", `Rs. ${netProfit}`],
        ["Pending Fees", `Rs. ${totalPending}`],
      ],
      // headStyles = table header ka style
      headStyles: { fillColor: [99, 102, 241] }, // indigo color
    });

    // Students table
    doc.text("Student Fee Collections", 14, doc.lastAutoTable.finalY + 15);
    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 20,
      // head = column names
      head: [["Name", "Phone", "Shift", "Seat", "Fee", "Start", "End"]],
      // body = data rows — har student ki ek row
      body: monthStudents.map((s) => [
        s.name,
        s.phone,
        s.shift,
        s.seatNumber,
        `Rs. ${s.feeAmount}`,
        s.startDate,
        s.endDate,
      ]),
      headStyles: { fillColor: [99, 102, 241] },
    });

    // Expenses table
    if (monthExpenses.length > 0) {
      doc.text("Expenses", 14, doc.lastAutoTable.finalY + 15);
      autoTable(doc, {
        startY: doc.lastAutoTable.finalY + 20,
        head: [["Category", "Description", "Amount", "Date"]],
        body: monthExpenses.map((e) => [
          e.category,
          e.description,
          `Rs. ${e.amount}`,
          e.date,
        ]),
        headStyles: { fillColor: [239, 68, 68] }, // red for expenses
      });
    }

    // File save karo
    doc.save(`LibraryPro_Finance_${selectedMonth}.pdf`);
  };

  // ─── Excel Export ──────────────────────────────────────────────
  // XLSX library se workbook banao
  // Multiple sheets add karo (Students, Expenses, Summary)
  // file-saver se download karo
  const exportExcel = () => {
    // Workbook = Excel file
    const wb = XLSX.utils.book_new();

    // Sheet 1: Students
    // json_to_sheet = array of objects ko Excel sheet mein convert karta hai
    const studData = monthStudents.map((s) => ({
      Name: s.name,
      Phone: s.phone,
      Shift: s.shift,
      Seat: s.seatNumber,
      "Fee (Rs.)": s.feeAmount,
      "Start Date": s.startDate,
      "End Date": s.endDate,
      Status: new Date(s.endDate) < new Date() ? "Expired" : "Active",
    }));
    const studSheet = XLSX.utils.json_to_sheet(studData);
    XLSX.utils.book_append_sheet(wb, studSheet, "Students"); // sheet ka naam "Students"

    // Sheet 2: Expenses
    const expData = monthExpenses.map((e) => ({
      Category: e.category,
      Description: e.description,
      "Amount (Rs.)": e.amount,
      Date: e.date,
    }));
    const expSheet = XLSX.utils.json_to_sheet(expData);
    XLSX.utils.book_append_sheet(wb, expSheet, "Expenses");

    // Sheet 3: Summary
    const summaryData = [
      { Metric: "Total Revenue", "Amount (Rs.)": totalRevenue },
      { Metric: "Total Expenses", "Amount (Rs.)": totalExpenses },
      { Metric: "Net Profit", "Amount (Rs.)": netProfit },
      { Metric: "Pending Fees", "Amount (Rs.)": totalPending },
      {
        Metric: "Total Students (Month)",
        "Amount (Rs.)": monthStudents.length,
      },
    ];
    const summarySheet = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, summarySheet, "Summary");

    // Excel file ka binary data banao
    const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    // Blob = binary data ko file jaisa treat karna browser mein
    const blob = new Blob([excelBuffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    // saveAs = file-saver library ka function jo download trigger karta hai
    saveAs(blob, `LibraryPro_Finance_${selectedMonth}.xlsx`);
  };

  if (loading)
    return <p style={{ padding: "30px" }}>Loading financial data...</p>;

  return (
    <div style={{ maxWidth: "1000px", margin: "30px auto", padding: "0 16px" }}>
      <h2 style={{ color: "#1e293b", marginBottom: "6px" }}>
        💰 Financial Analytics
      </h2>
      <p style={{ color: "#64748b", marginBottom: "24px" }}>
        Revenue, expenses aur net profit ek jagah
      </p>

      {/* Month Selector + Export Buttons — ek row mein */}
      <div
        style={{
          display: "flex",
          gap: "12px",
          flexWrap: "wrap",
          alignItems: "center",
          marginBottom: "28px",
        }}
      >
        {/* Month input — type="month" browser ka native month picker deta hai */}
        <input
          type="month"
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          style={{
            padding: "10px 14px",
            borderRadius: "10px",
            border: "1.5px solid #e2e8f0",
            fontSize: "15px",
          }}
        />
        <button onClick={exportPDF} style={exportBtn("#ef4444")}>
          📄 Export PDF
        </button>
        <button onClick={exportExcel} style={exportBtn("#16a34a")}>
          📊 Export Excel
        </button>
      </div>

      {/* Stats Cards — 2x2 grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "16px",
          marginBottom: "32px",
        }}
      >
        <FinanceCard
          title="Total Revenue"
          value={`₹${totalRevenue.toLocaleString("en-IN")}`}
          color="#6366f1"
          icon="💰"
          subtitle={`${monthStudents.length} students this month`}
        />
        <FinanceCard
          title="Total Expenses"
          value={`₹${totalExpenses.toLocaleString("en-IN")}`}
          color="#ef4444"
          icon="💸"
          subtitle={`${monthExpenses.length} expense entries`}
        />
        <FinanceCard
          title="Net Profit"
          value={`₹${netProfit.toLocaleString("en-IN")}`}
          // Profit positive hai toh green, negative toh red
          color={netProfit >= 0 ? "#22c55e" : "#ef4444"}
          icon={netProfit >= 0 ? "📈" : "📉"}
          subtitle="Revenue - Expenses"
        />
        <FinanceCard
          title="Pending Fees"
          value={`₹${totalPending.toLocaleString("en-IN")}`}
          color="#f59e0b"
          icon="⏳"
          subtitle={`${pendingStudents.length} defaulters`}
        />
      </div>

      {/* Students Table — us month ke saare students */}
      <div
        style={{
          background: "white",
          borderRadius: "14px",
          padding: "20px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
          marginBottom: "24px",
        }}
      >
        <h3 style={{ margin: "0 0 16px", color: "#1e293b" }}>
          📋 Fee Collections — {selectedMonth}
          <span
            style={{
              marginLeft: "10px",
              fontSize: "13px",
              color: "#6366f1",
              fontWeight: "normal",
            }}
          >
            ({monthStudents.length} students)
          </span>
        </h3>

        {monthStudents.length === 0 ? (
          <p style={{ color: "#94a3b8", textAlign: "center", padding: "20px" }}>
            Is month koi student nahi mila.
          </p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: "14px",
              }}
            >
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  {[
                    "Name",
                    "Phone",
                    "Shift",
                    "Seat",
                    "Fee",
                    "Start",
                    "End",
                    "Status",
                  ].map((h) => (
                    <th key={h} style={thStyle}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {monthStudents.map((s, i) => {
                  const isExpired =
                    s.endDate && new Date(s.endDate) < new Date();
                  return (
                    <tr
                      key={s.id}
                      style={{ background: i % 2 === 0 ? "#f8fafc" : "white" }}
                    >
                      <td style={tdStyle}>{s.name}</td>
                      <td style={tdStyle}>{s.phone}</td>
                      <td style={tdStyle}>{s.shift}</td>
                      <td style={tdStyle}>🪑 {s.seatNumber}</td>
                      <td
                        style={{
                          ...tdStyle,
                          fontWeight: "bold",
                          color: "#6366f1",
                        }}
                      >
                        ₹{s.feeAmount}
                      </td>
                      <td style={tdStyle}>{s.startDate}</td>
                      <td style={tdStyle}>{s.endDate}</td>
                      <td style={tdStyle}>
                        <span
                          style={{
                            padding: "3px 10px",
                            borderRadius: "12px",
                            fontSize: "12px",
                            fontWeight: "bold",
                            background: isExpired ? "#fee2e2" : "#dcfce7",
                            color: isExpired ? "#991b1b" : "#166534",
                          }}
                        >
                          {isExpired ? "Expired" : "Active"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Expenses Table — us month ke saare kharche */}
      <div
        style={{
          background: "white",
          borderRadius: "14px",
          padding: "20px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
        }}
      >
        <h3 style={{ margin: "0 0 16px", color: "#1e293b" }}>
          💸 Expenses — {selectedMonth}
        </h3>
        {monthExpenses.length === 0 ? (
          <p style={{ color: "#94a3b8", textAlign: "center", padding: "20px" }}>
            Is month koi expense record nahi mila.
            <br />
            <a href="/expenses" style={{ color: "#6366f1" }}>
              Expenses page par jao → Add Expense
            </a>
          </p>
        ) : (
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: "14px",
            }}
          >
            <thead>
              <tr style={{ background: "#f8fafc" }}>
                {["Category", "Description", "Amount", "Date"].map((h) => (
                  <th key={h} style={thStyle}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {monthExpenses.map((e, i) => (
                <tr
                  key={e.id}
                  style={{ background: i % 2 === 0 ? "#f8fafc" : "white" }}
                >
                  <td style={tdStyle}>
                    <span
                      style={{
                        background: "#fee2e2",
                        color: "#991b1b",
                        padding: "2px 8px",
                        borderRadius: "8px",
                        fontSize: "12px",
                      }}
                    >
                      {e.category}
                    </span>
                  </td>
                  <td style={tdStyle}>{e.description}</td>
                  <td
                    style={{ ...tdStyle, fontWeight: "bold", color: "#ef4444" }}
                  >
                    ₹{Number(e.amount).toLocaleString("en-IN")}
                  </td>
                  <td style={tdStyle}>{e.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// Table header style
const thStyle = {
  padding: "10px 14px",
  textAlign: "left",
  fontWeight: "600",
  color: "#374151",
  borderBottom: "2px solid #e2e8f0",
};

// Table data cell style
const tdStyle = {
  padding: "11px 14px",
  borderBottom: "1px solid #f1f5f9",
};

// Export button style — color parameter se red ya green banta hai
const exportBtn = (bg) => ({
  background: bg,
  color: "white",
  border: "none",
  padding: "10px 20px",
  borderRadius: "10px",
  fontSize: "14px",
  fontWeight: "bold",
  cursor: "pointer",
});
