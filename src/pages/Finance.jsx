// src/pages/Finance.jsx
import { useEffect, useState } from "react";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "../firebase";
import { useNavigate } from "react-router-dom";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

// ─── Helpers ───────────────────────────────────────────
const todayISO = () => new Date().toISOString().slice(0, 10);
const thisMonth = () => new Date().toISOString().slice(0, 7);

const shiftColors = {
  morning: { bg: "#fef3c7", text: "#92400e", label: "Morning" },
  evening: { bg: "#dbeafe", text: "#1e40af", label: "Evening" },
  fullday: { bg: "#ede9fe", text: "#5b21b6", label: "Full Day" },
  afternoon: { bg: "#dcfce7", text: "#166534", label: "Afternoon" },
};

function daysLeft(endDate) {
  if (!endDate) return null;
  return Math.ceil((new Date(endDate) - new Date()) / 86400000);
}

// ─── Main Component ────────────────────────────────────
export default function Finance() {
  const navigate = useNavigate();
  const [students, setStudents] = useState([]);
  const [payments, setPayments] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("due"); // "due" | "received" | "summary"
  const [selectedMonth, setSelectedMonth] = useState(thisMonth());
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [studSnap, paySnap, expSnap] = await Promise.all([
        getDocs(collection(db, "students")),
        getDocs(query(collection(db, "payments"), orderBy("paidAt", "desc"))),
        getDocs(collection(db, "expenses")),
      ]);
      setStudents(studSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setPayments(paySnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setExpenses(expSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
    setTimeout(() => setMounted(true), 60);
  };

  // ── Derived Data ───────────────────────────────────────
  // Fee Due = students jinka endDate nikal gayi ya 7 din mein nikal rahi hai
  const feeDue = students
    .filter((s) => {
      const left = daysLeft(s.endDate);
      return left !== null && left <= 7;
    })
    .sort((a, b) => daysLeft(a.endDate) - daysLeft(b.endDate));

  // Payments us month ke
  const monthPayments = payments.filter(
    (p) => p.paidAt?.slice(0, 7) === selectedMonth,
  );
  const monthRevenue = monthPayments.reduce((s, p) => s + (p.amount || 0), 0);

  // Expenses us month ke
  const monthExpenses = expenses.filter(
    (e) => e.date?.slice(0, 7) === selectedMonth,
  );
  const monthExpTotal = monthExpenses.reduce(
    (s, e) => s + (Number(e.amount) || 0),
    0,
  );

  const netProfit = monthRevenue - monthExpTotal;

  // Total pending amount (expired students)
  const expired = students.filter(
    (s) => daysLeft(s.endDate) !== null && daysLeft(s.endDate) < 0,
  );
  const pendingAmount = expired.reduce(
    (s, st) => s + (Number(st.feeAmount) || 0),
    0,
  );

  // ── Export PDF ─────────────────────────────────────────
  const exportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text("LibraryPro — Finance Report", 14, 20);
    doc.setFontSize(11);
    doc.text(
      `Month: ${selectedMonth}  |  Generated: ${new Date().toLocaleDateString("en-IN")}`,
      14,
      30,
    );

    autoTable(doc, {
      startY: 38,
      head: [["Metric", "Amount"]],
      body: [
        ["Monthly Revenue", `Rs. ${monthRevenue.toLocaleString("en-IN")}`],
        ["Monthly Expenses", `Rs. ${monthExpTotal.toLocaleString("en-IN")}`],
        ["Net Profit", `Rs. ${netProfit.toLocaleString("en-IN")}`],
        ["Pending (Fee Due)", `Rs. ${pendingAmount.toLocaleString("en-IN")}`],
      ],
      headStyles: { fillColor: [99, 102, 241] },
    });

    doc.text("Payments Received", 14, doc.lastAutoTable.finalY + 12);
    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 16,
      head: [["Student", "Amount", "Months", "Date", "Note"]],
      body: monthPayments.map((p) => [
        p.studentName,
        `Rs. ${p.amount}`,
        `${p.months}M`,
        new Date(p.paidAt).toLocaleDateString("en-IN"),
        p.note || "—",
      ]),
      headStyles: { fillColor: [16, 185, 129] },
    });

    doc.save(`LibraryPro_Finance_${selectedMonth}.pdf`);
  };

  // ── Export Excel ───────────────────────────────────────
  const exportExcel = () => {
    const wb = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        monthPayments.map((p) => ({
          Student: p.studentName,
          "Amount (Rs.)": p.amount,
          Months: p.months,
          Date: new Date(p.paidAt).toLocaleDateString("en-IN"),
          Note: p.note || "",
        })),
      ),
      "Payments",
    );

    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        feeDue.map((s) => ({
          Name: s.name,
          Phone: s.phone,
          "Fee (Rs.)": s.feeAmount,
          "End Date": s.endDate,
          "Days Left": daysLeft(s.endDate),
        })),
      ),
      "Fee Due",
    );

    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet([
        { Metric: "Monthly Revenue", "Rs.": monthRevenue },
        { Metric: "Monthly Expenses", "Rs.": monthExpTotal },
        { Metric: "Net Profit", "Rs.": netProfit },
        { Metric: "Pending Amount", "Rs.": pendingAmount },
      ]),
      "Summary",
    );

    const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    saveAs(
      new Blob([buf], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
      `LibraryPro_Finance_${selectedMonth}.xlsx`,
    );
  };

  // ── Loading ────────────────────────────────────────────
  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#f0f2f8",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 14,
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: "50%",
              border: "4px solid #e0e7ff",
              borderTopColor: "#6366f1",
              animation: "spin 0.8s linear infinite",
            }}
          />
          <p
            style={{
              fontSize: 14,
              color: "#9ca3af",
              fontFamily: "Inter, sans-serif",
            }}
          >
            Loading finance data…
          </p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        .fin-page {
          min-height: 100vh;
          background: #f0f2f8;
          padding: 28px 16px 60px;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
          opacity: 0; transform: translateY(14px);
          transition: opacity 0.45s ease, transform 0.45s ease;
        }
        .fin-page.mounted { opacity: 1; transform: translateY(0); }
        .fin-wrap { max-width: 1000px; margin: 0 auto; }

        /* Header */
        .fin-header { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; margin-bottom: 24px; }
        .fin-header-left { display: flex; align-items: center; gap: 13px; }
        .fin-icon { width: 46px; height: 46px; border-radius: 14px; background: linear-gradient(135deg, #6366f1, #818cf8); display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 14px rgba(99,102,241,0.3); flex-shrink: 0; }
        .fin-title { font-size: 22px; font-weight: 800; color: #1e1b4b; margin: 0 0 2px; letter-spacing: -0.4px; }
        .fin-sub { font-size: 13px; color: #6b7280; margin: 0; }

        /* Export row */
        .fin-controls { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
        .fin-month { padding: 9px 14px; border-radius: 12px; border: 1.5px solid #e5e7eb; font-size: 13px; color: #1e1b4b; background: #fff; outline: none; font-family: inherit; cursor: pointer; }
        .fin-export-btn { display: flex; align-items: center; gap: 6px; padding: 9px 16px; border-radius: 12px; font-size: 13px; font-weight: 700; border: none; cursor: pointer; font-family: inherit; transition: all 0.2s ease; }
        .fin-export-btn:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,0,0,0.15); }

        /* Summary cards */
        .fin-summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 14px; margin-bottom: 24px; }
        .fin-card { border-radius: 20px; padding: 20px; color: white; box-shadow: 0 4px 20px rgba(0,0,0,0.1); animation: fadeUp 0.4s cubic-bezier(.22,1,.36,1) both; transition: transform 0.2s ease; }
        .fin-card:hover { transform: translateY(-2px); }
        .fin-card-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px; opacity: 0.8; margin-bottom: 8px; }
        .fin-card-value { font-size: 28px; font-weight: 800; line-height: 1; margin-bottom: 4px; }
        .fin-card-sub { font-size: 12px; opacity: 0.75; font-weight: 500; }

        /* Tabs */
        .fin-tabs { display: flex; gap: 4px; background: #fff; border: 1.5px solid #e5e7eb; border-radius: 16px; padding: 5px; margin-bottom: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.04); }
        .fin-tab { flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px; padding: 10px 8px; border-radius: 11px; font-size: 13px; font-weight: 700; cursor: pointer; border: none; transition: all 0.2s; font-family: inherit; color: #6b7280; background: transparent; }
        .fin-tab.active { background: linear-gradient(135deg, #6366f1, #818cf8); color: #fff; box-shadow: 0 3px 10px rgba(99,102,241,0.3); }
        .fin-tab:not(.active):hover { background: #f8fafc; color: #6366f1; }
        .fin-badge { font-size: 10px; font-weight: 800; padding: 1px 6px; border-radius: 6px; }
        .fin-tab.active .fin-badge { background: rgba(255,255,255,0.25); color: #fff; }
        .fin-tab:not(.active) .fin-badge { background: #fee2e2; color: #ef4444; }

        /* Panel */
        .fin-panel { background: #fff; border: 1.5px solid #e5e7eb; border-radius: 20px; overflow: hidden; box-shadow: 0 2px 16px rgba(0,0,0,0.04); animation: fadeUp 0.3s cubic-bezier(.22,1,.36,1); }
        .fin-panel-head { padding: 18px 20px; border-bottom: 1.5px solid #f1f3f9; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; }
        .fin-panel-title { font-size: 14px; font-weight: 800; color: #1e1b4b; margin: 0 0 2px; }
        .fin-panel-sub { font-size: 12px; color: #9ca3af; margin: 0; }

        /* Student row */
        .fin-row { display: flex; align-items: center; gap: 13px; padding: 13px 20px; border-bottom: 1.5px solid #f8fafc; transition: background 0.15s; cursor: pointer; }
        .fin-row:last-child { border-bottom: none; }
        .fin-row:hover { background: #f8faff; }
        .fin-av { width: 40px; height: 40px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 16px; font-weight: 800; flex-shrink: 0; }

        /* Days badge */
        .fin-days { flex-shrink: 0; font-size: 12px; font-weight: 800; padding: 5px 12px; border-radius: 10px; }

        /* Payment row */
        .fin-pay-row { display: flex; align-items: center; gap: 13px; padding: 13px 20px; border-bottom: 1.5px solid #f8fafc; }
        .fin-pay-row:last-child { border-bottom: none; }

        /* Empty */
        .fin-empty { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 60px 20px; color: #9ca3af; }

        /* Summary table */
        .fin-sum-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; padding: 20px; }
        .fin-sum-item { background: #f8faff; border: 1.5px solid #e0e7ff; border-radius: 14px; padding: 16px 18px; }
        .fin-sum-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280; margin-bottom: 6px; }
        .fin-sum-value { font-size: 22px; font-weight: 800; color: #1e1b4b; }

        @keyframes fadeUp { from { opacity:0; transform:translateY(12px) } to { opacity:1; transform:translateY(0) } }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      <div className={`fin-page${mounted ? " mounted" : ""}`}>
        <div className="fin-wrap">
          {/* ── Header ── */}
          <div className="fin-header">
            <div className="fin-header-left">
              <div className="fin-icon">
                <svg
                  width="22"
                  height="22"
                  fill="none"
                  stroke="white"
                  strokeWidth="2.2"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75"
                  />
                </svg>
              </div>
              <div>
                <h1 className="fin-title">Finance</h1>
                <p className="fin-sub">Revenue, dues aur payments ek jagah</p>
              </div>
            </div>

            {/* Controls */}
            <div className="fin-controls">
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="fin-month"
              />
              <button
                className="fin-export-btn"
                onClick={exportPDF}
                style={{ background: "#ef4444", color: "#fff" }}
              >
                <svg
                  width="14"
                  height="14"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m.75 12l3 3m0 0l3-3m-3 3v-6m-1.5-9H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
                  />
                </svg>
                PDF
              </button>
              <button
                className="fin-export-btn"
                onClick={exportExcel}
                style={{ background: "#16a34a", color: "#fff" }}
              >
                <svg
                  width="14"
                  height="14"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h1.5C5.496 19.5 6 18.996 6 18.375m-3.75.125v-3.375c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v3.375m-6.75 0H21M6 8.25v-3.375c0-.621.504-1.125 1.125-1.125h9.75c.621 0 1.125.504 1.125 1.125v3.375"
                  />
                </svg>
                Excel
              </button>
            </div>
          </div>

          {/* ── Summary Cards ── */}
          <div className="fin-summary">
            {[
              {
                label: "Is Month Revenue",
                value: `₹${monthRevenue.toLocaleString("en-IN")}`,
                sub: `${monthPayments.length} payments received`,
                bg: "linear-gradient(135deg, #6366f1, #818cf8)",
                delay: "0s",
              },
              {
                label: "Fee Due Students",
                value: feeDue.length,
                sub: `${feeDue.filter((s) => daysLeft(s.endDate) < 0).length} already expired`,
                bg: "linear-gradient(135deg, #ef4444, #f87171)",
                delay: "0.05s",
              },
              {
                label: "Net Profit",
                value: `₹${netProfit.toLocaleString("en-IN")}`,
                sub: "Revenue - Expenses",
                bg:
                  netProfit >= 0
                    ? "linear-gradient(135deg, #10b981, #34d399)"
                    : "linear-gradient(135deg, #ef4444, #f87171)",
                delay: "0.1s",
              },
              {
                label: "Monthly Expenses",
                value: `₹${monthExpTotal.toLocaleString("en-IN")}`,
                sub: `${monthExpenses.length} entries`,
                bg: "linear-gradient(135deg, #f59e0b, #fbbf24)",
                delay: "0.15s",
              },
            ].map((c) => (
              <div
                key={c.label}
                className="fin-card"
                style={{ background: c.bg, animationDelay: c.delay }}
              >
                <p className="fin-card-label">{c.label}</p>
                <p className="fin-card-value">{c.value}</p>
                <p className="fin-card-sub">{c.sub}</p>
              </div>
            ))}
          </div>

          {/* ── Tabs ── */}
          <div className="fin-tabs">
            {[
              { id: "due", label: "Fee Due", icon: "⚠️", badge: feeDue.length },
              {
                id: "received",
                label: "Payments",
                icon: "✅",
                badge: monthPayments.length,
              },
              { id: "summary", label: "Summary", icon: "📊" },
            ].map((tab) => (
              <button
                key={tab.id}
                className={`fin-tab${activeTab === tab.id ? " active" : ""}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
                {tab.badge > 0 && (
                  <span className="fin-badge">{tab.badge}</span>
                )}
              </button>
            ))}
          </div>

          {/* ════════════════════════════════════════
              TAB: FEE DUE
          ════════════════════════════════════════ */}
          {activeTab === "due" && (
            <div className="fin-panel">
              <div className="fin-panel-head">
                <div>
                  <p className="fin-panel-title">Fee Due Students</p>
                  <p className="fin-panel-sub">
                    {feeDue.length} students — expired ya 7 din mein expire
                    honge
                  </p>
                </div>
                {feeDue.length > 0 && (
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 800,
                      background: "#fee2e2",
                      color: "#ef4444",
                      padding: "5px 12px",
                      borderRadius: 9,
                    }}
                  >
                    ₹
                    {feeDue
                      .reduce((s, st) => s + (Number(st.feeAmount) || 0), 0)
                      .toLocaleString("en-IN")}{" "}
                    pending
                  </span>
                )}
              </div>

              {feeDue.length === 0 ? (
                <div className="fin-empty">
                  <span style={{ fontSize: 40 }}>🎉</span>
                  <p
                    style={{ fontSize: 15, fontWeight: 700, color: "#065f46" }}
                  >
                    Sab fees up-to-date hain!
                  </p>
                  <p style={{ fontSize: 13 }}>Kisi ka bhi due nahi hai abhi.</p>
                </div>
              ) : (
                feeDue.map((s, i) => {
                  const left = daysLeft(s.endDate);
                  const isExp = left < 0;
                  const shift = shiftColors[s.shift] || shiftColors.morning;
                  return (
                    <div
                      key={s.id}
                      className="fin-row"
                      onClick={() => navigate(`/students/${s.id}`)}
                      style={{ animationDelay: `${Math.min(i * 0.04, 0.3)}s` }}
                    >
                      {/* Avatar */}
                      <div
                        className="fin-av"
                        style={{
                          background: isExp ? "#fee2e2" : "#fef3c7",
                          color: isExp ? "#ef4444" : "#d97706",
                        }}
                      >
                        {s.name?.charAt(0)?.toUpperCase() || "?"}
                      </div>

                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p
                          style={{
                            fontSize: 14,
                            fontWeight: 700,
                            color: "#1e1b4b",
                            margin: "0 0 4px",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {s.name}
                        </p>
                        <div
                          style={{
                            display: "flex",
                            gap: 8,
                            alignItems: "center",
                            flexWrap: "wrap",
                          }}
                        >
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 700,
                              padding: "2px 8px",
                              borderRadius: 6,
                              background: shift.bg,
                              color: shift.text,
                            }}
                          >
                            {shift.label}
                          </span>
                          <span style={{ fontSize: 11, color: "#9ca3af" }}>
                            Seat {s.seatNumber}
                          </span>
                          <span style={{ fontSize: 11, color: "#6b7280" }}>
                            📱 {s.phone}
                          </span>
                        </div>
                      </div>

                      {/* Fee */}
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <p
                          style={{
                            fontSize: 15,
                            fontWeight: 800,
                            color: "#6366f1",
                            margin: "0 0 4px",
                          }}
                        >
                          ₹{Number(s.feeAmount).toLocaleString("en-IN")}
                        </p>
                        <span
                          className="fin-days"
                          style={{
                            background: isExp ? "#fee2e2" : "#fef3c7",
                            color: isExp ? "#991b1b" : "#92400e",
                          }}
                        >
                          {isExp
                            ? `${Math.abs(left)}d overdue`
                            : `${left}d left`}
                        </span>
                      </div>

                      {/* Arrow */}
                      <svg
                        width="16"
                        height="16"
                        fill="none"
                        stroke="#9ca3af"
                        strokeWidth="2"
                        viewBox="0 0 24 24"
                        style={{ flexShrink: 0 }}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M8.25 4.5l7.5 7.5-7.5 7.5"
                        />
                      </svg>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* ════════════════════════════════════════
              TAB: PAYMENTS RECEIVED
          ════════════════════════════════════════ */}
          {activeTab === "received" && (
            <div className="fin-panel">
              <div className="fin-panel-head">
                <div>
                  <p className="fin-panel-title">
                    Payments Received — {selectedMonth}
                  </p>
                  <p className="fin-panel-sub">
                    {monthPayments.length} transactions · ₹
                    {monthRevenue.toLocaleString("en-IN")} total
                  </p>
                </div>
              </div>

              {monthPayments.length === 0 ? (
                <div className="fin-empty">
                  <span style={{ fontSize: 40 }}>💳</span>
                  <p
                    style={{ fontSize: 14, fontWeight: 600, color: "#6b7280" }}
                  >
                    Is month koi payment nahi mili
                  </p>
                  <p style={{ fontSize: 12 }}>
                    Month change karo ya student renew karo
                  </p>
                </div>
              ) : (
                monthPayments.map((p, i) => (
                  <div
                    key={p.id}
                    className="fin-pay-row"
                    style={{ animationDelay: `${Math.min(i * 0.03, 0.25)}s` }}
                  >
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 12,
                        background: "#ecfdf5",
                        border: "1.5px solid #a7f3d0",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <svg
                        width="18"
                        height="18"
                        fill="none"
                        stroke="#10b981"
                        strokeWidth="2.2"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M4.5 12.75l6 6 9-13.5"
                        />
                      </svg>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p
                        style={{
                          fontSize: 14,
                          fontWeight: 700,
                          color: "#1e1b4b",
                          margin: "0 0 3px",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {p.studentName}
                      </p>
                      <div
                        style={{
                          display: "flex",
                          gap: 8,
                          alignItems: "center",
                          flexWrap: "wrap",
                        }}
                      >
                        <span style={{ fontSize: 11, color: "#9ca3af" }}>
                          {new Date(p.paidAt).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            background: "#eef2ff",
                            color: "#6366f1",
                            padding: "1px 7px",
                            borderRadius: 6,
                          }}
                        >
                          {p.months}M renewal
                        </span>
                        {p.note && (
                          <span
                            style={{
                              fontSize: 11,
                              color: "#9ca3af",
                              fontStyle: "italic",
                            }}
                          >
                            "{p.note}"
                          </span>
                        )}
                      </div>
                    </div>
                    <p
                      style={{
                        fontSize: 16,
                        fontWeight: 800,
                        color: "#10b981",
                        flexShrink: 0,
                      }}
                    >
                      ₹{Number(p.amount).toLocaleString("en-IN")}
                    </p>
                  </div>
                ))
              )}

              {/* Total footer */}
              {monthPayments.length > 0 && (
                <div
                  style={{
                    padding: "14px 20px",
                    background: "#f8faff",
                    borderTop: "1.5px solid #e0e7ff",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <p
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: "#6b7280",
                      margin: 0,
                    }}
                  >
                    {monthPayments.length} payments
                  </p>
                  <p
                    style={{
                      fontSize: 15,
                      fontWeight: 800,
                      color: "#1e1b4b",
                      margin: 0,
                    }}
                  >
                    Total: ₹{monthRevenue.toLocaleString("en-IN")}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ════════════════════════════════════════
              TAB: SUMMARY
          ════════════════════════════════════════ */}
          {activeTab === "summary" && (
            <div className="fin-panel">
              <div className="fin-panel-head">
                <div>
                  <p className="fin-panel-title">
                    Monthly Summary — {selectedMonth}
                  </p>
                  <p className="fin-panel-sub">
                    Revenue, expenses aur profit ka overview
                  </p>
                </div>
              </div>
              <div className="fin-sum-grid">
                {[
                  {
                    label: "Total Revenue",
                    value: `₹${monthRevenue.toLocaleString("en-IN")}`,
                    color: "#6366f1",
                  },
                  {
                    label: "Total Expenses",
                    value: `₹${monthExpTotal.toLocaleString("en-IN")}`,
                    color: "#ef4444",
                  },
                  {
                    label: "Net Profit",
                    value: `₹${netProfit.toLocaleString("en-IN")}`,
                    color: netProfit >= 0 ? "#10b981" : "#ef4444",
                  },
                  {
                    label: "Pending Fees",
                    value: `₹${pendingAmount.toLocaleString("en-IN")}`,
                    color: "#f59e0b",
                  },
                  {
                    label: "Payments Count",
                    value: monthPayments.length,
                    color: "#6366f1",
                  },
                  {
                    label: "Expense Entries",
                    value: monthExpenses.length,
                    color: "#ef4444",
                  },
                  {
                    label: "Total Students",
                    value: students.length,
                    color: "#1e1b4b",
                  },
                  {
                    label: "Fee Due Students",
                    value: feeDue.length,
                    color: "#f59e0b",
                  },
                ].map((item) => (
                  <div key={item.label} className="fin-sum-item">
                    <p className="fin-sum-label">{item.label}</p>
                    <p className="fin-sum-value" style={{ color: item.color }}>
                      {item.value}
                    </p>
                  </div>
                ))}
              </div>

              {/* Expenses breakdown */}
              {monthExpenses.length > 0 && (
                <>
                  <div
                    style={{
                      padding: "0 20px 12px",
                      borderTop: "1.5px solid #f1f3f9",
                    }}
                  >
                    <p
                      style={{
                        fontSize: 13,
                        fontWeight: 800,
                        color: "#1e1b4b",
                        margin: "16px 0 12px",
                      }}
                    >
                      Expense Breakdown
                    </p>
                    {monthExpenses.map((e, i) => (
                      <div
                        key={e.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "10px 0",
                          borderBottom:
                            i < monthExpenses.length - 1
                              ? "1px solid #f8fafc"
                              : "none",
                        }}
                      >
                        <div>
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              padding: "2px 8px",
                              borderRadius: 6,
                              background: "#fee2e2",
                              color: "#991b1b",
                            }}
                          >
                            {e.category}
                          </span>
                          <p
                            style={{
                              fontSize: 13,
                              color: "#374151",
                              margin: "4px 0 0",
                              fontWeight: 600,
                            }}
                          >
                            {e.description}
                          </p>
                        </div>
                        <p
                          style={{
                            fontSize: 14,
                            fontWeight: 800,
                            color: "#ef4444",
                            margin: 0,
                          }}
                        >
                          ₹{Number(e.amount).toLocaleString("en-IN")}
                        </p>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
