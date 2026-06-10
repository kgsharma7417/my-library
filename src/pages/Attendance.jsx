// src/pages/Attendance.jsx
import { useEffect, useRef, useState } from "react";
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  Timestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import { Html5Qrcode } from "html5-qrcode";

const SHIFT_CONFIG = {
  morning: {
    label: "Morning",
    badge: "bg-amber-100 text-amber-800",
    bg: "#fef3c7",
    text: "#92400e",
    dot: "#f59e0b",
  },
  evening: {
    label: "Evening",
    badge: "bg-sky-100 text-sky-800",
    bg: "#dbeafe",
    text: "#1e40af",
    dot: "#3b82f6",
  },
  fullday: {
    label: "Full Day",
    badge: "bg-violet-100 text-violet-800",
    bg: "#ede9fe",
    text: "#5b21b6",
    dot: "#8b5cf6",
  },
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function formatTime(ts) {
  if (!ts) return "—";
  return ts
    .toDate()
    .toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}
function formatDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function Attendance() {
  const [activeTab, setActiveTab] = useState("scanner");
  const [scanning, setScanning] = useState(false);
  const [lastScanned, setLastScanned] = useState(null);
  const [message, setMessage] = useState(null);
  const [todayAttendance, setTodayAttendance] = useState([]);
  const [allStudents, setAllStudents] = useState([]);
  const [historyDate, setHistoryDate] = useState(todayISO());
  const [historyList, setHistoryList] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [manualSearch, setManualSearch] = useState("");
  const [manualMarking, setManualMarking] = useState(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const qrRef = useRef(null);
  const allStudentsRef = useRef([]); // ← FIX: stale closure se bachne ke liye
  const scannerDivId = "qr-reader";

  useEffect(() => {
    const init = async () => {
      setPageLoading(true);
      await Promise.all([fetchTodayAttendance(), fetchAllStudents()]);
      setPageLoading(false);
      setTimeout(() => setMounted(true), 60);
    };
    init();
  }, []);

  useEffect(() => {
    if (activeTab === "history") fetchHistoryForDate(historyDate);
  }, [historyDate, activeTab]);

  useEffect(() => {
    if (activeTab !== "scanner" && scanning) stopScanner();
  }, [activeTab]);

  // Auto-dismiss toast
  useEffect(() => {
    if (message) {
      const t = setTimeout(() => setMessage(null), 4000);
      return () => clearTimeout(t);
    }
  }, [message]);

  const fetchAllStudents = async () => {
    const snap = await getDocs(collection(db, "students"));
    const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    setAllStudents(data);
    allStudentsRef.current = data; // ← FIX: ref bhi update karo
  };

  const fetchTodayAttendance = async () => {
    const s = new Date();
    s.setHours(0, 0, 0, 0);
    const e = new Date();
    e.setHours(23, 59, 59, 999);
    const q = query(
      collection(db, "attendance"),
      where("timestamp", ">=", Timestamp.fromDate(s)),
      where("timestamp", "<=", Timestamp.fromDate(e)),
    );
    const snap = await getDocs(q);
    setTodayAttendance(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  };

  const fetchHistoryForDate = async (dateISO) => {
    setHistoryLoading(true);
    const d = new Date(dateISO);
    const start = new Date(d);
    start.setHours(0, 0, 0, 0);
    const end = new Date(d);
    end.setHours(23, 59, 59, 999);
    const q = query(
      collection(db, "attendance"),
      where("timestamp", ">=", Timestamp.fromDate(start)),
      where("timestamp", "<=", Timestamp.fromDate(end)),
    );
    const snap = await getDocs(q);
    setHistoryList(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    setHistoryLoading(false);
  };

  const markAttendance = async (student) => {
    setManualMarking(student.id);
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const alreadyMarked = todayAttendance.find(
      (a) => a.studentId === student.id && a.timestamp?.toDate() >= startOfDay,
    );
    if (alreadyMarked) {
      setMessage({
        type: "warn",
        text: `${student.name} ki attendance aaj already mark ho chuki hai!`,
      });
      setLastScanned(student);
      setManualMarking(null);
      return;
    }
    try {
      await addDoc(collection(db, "attendance"), {
        studentId: student.id,
        studentName: student.name,
        shift: student.shift,
        seatNumber: student.seatNumber,
        timestamp: Timestamp.now(),
        date: new Date().toLocaleDateString("en-IN"),
      });
      setLastScanned(student);
      setMessage({
        type: "success",
        text: `✓ Attendance marked for ${student.name}`,
      });
      await fetchTodayAttendance();
    } catch (err) {
      setMessage({ type: "error", text: "Error: " + err.message });
    }
    setManualMarking(null);
  };

  const startScanner = async () => {
    setScanning(true);
    setMessage(null);
    const html5QrCode = new Html5Qrcode(scannerDivId);
    qrRef.current = html5QrCode;
    try {
      await html5QrCode.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        onScanSuccess,
        () => {},
      );
    } catch {
      setMessage({
        type: "error",
        text: "Camera access denied. Please allow camera permission.",
      });
      setScanning(false);
    }
  };

  const stopScanner = async () => {
    if (qrRef.current) {
      try {
        await qrRef.current.stop();
      } catch (_) {}
      qrRef.current = null;
    }
    setScanning(false);
  };

  const onScanSuccess = async (studentId) => {
    await stopScanner();
    const student = allStudentsRef.current.find((s) => s.id === studentId); // ← FIX: ref use karo
    if (!student) {
      setMessage({
        type: "error",
        text: "Invalid QR code — student not found.",
      });
      return;
    }
    await markAttendance(student);
  };

  const markedIds = new Set(todayAttendance.map((a) => a.studentId));
  const absentStudents = allStudents.filter((s) => !markedIds.has(s.id));
  const filteredStudents = allStudents.filter(
    (s) =>
      s.name?.toLowerCase().includes(manualSearch.toLowerCase()) ||
      String(s.seatNumber).includes(manualSearch) ||
      s.phone?.includes(manualSearch),
  );

  const TABS = [
    { id: "scanner", label: "Scanner", icon: "⬛" },
    { id: "manual", label: "Manual", icon: "👤" },
    { id: "absent", label: "Absent", icon: "🚫", badge: absentStudents.length },
    { id: "history", label: "History", icon: "🕐" },
  ];

  if (pageLoading) {
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
            Loading attendance…
          </p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <>
      <style>{`
        .att-page {
          min-height: 100vh;
          background: #f0f2f8;
          padding: 28px 16px 56px;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
          opacity: 0; transform: translateY(14px);
          transition: opacity 0.45s ease, transform 0.45s ease;
        }
        .att-page.mounted { opacity: 1; transform: translateY(0); }
        .att-wrap { max-width: 960px; margin: 0 auto; }

        /* Header */
        .att-header { display: flex; align-items: center; gap: 13px; margin-bottom: 22px; }
        .att-header-icon {
          width: 44px; height: 44px; border-radius: 14px;
          background: linear-gradient(135deg, #6366f1, #818cf8);
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 4px 14px rgba(99,102,241,0.3); flex-shrink: 0;
        }
        .att-title { font-size: 22px; font-weight: 800; color: #1e1b4b; margin: 0 0 2px; letter-spacing: -0.4px; }
        .att-date { font-size: 13px; color: #6b7280; }

        /* Summary */
        .att-summary {
          display: grid; grid-template-columns: repeat(3, 1fr);
          gap: 12px; margin-bottom: 22px;
        }
        .att-mini {
          background: #fff; border: 1.5px solid #e5e7eb; border-radius: 16px;
          padding: 16px 12px; display: flex; flex-direction: column; align-items: center;
          transition: transform 0.2s ease;
          animation: fadeUp 0.4s cubic-bezier(.22,1,.36,1) both;
        }
        .att-mini:hover { transform: translateY(-2px); }
        .att-mini-val { font-size: 28px; font-weight: 800; line-height: 1; }
        .att-mini-lbl { font-size: 11px; color: #9ca3af; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 4px; }

        /* Tabs */
        .att-tabs {
          display: flex; gap: 4px;
          background: #fff; border: 1.5px solid #e5e7eb; border-radius: 16px;
          padding: 5px; margin-bottom: 20px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.04);
        }
        .att-tab {
          flex: 1; display: flex; align-items: center; justify-content: center;
          gap: 6px; padding: 9px 8px; border-radius: 11px;
          font-size: 13px; font-weight: 700; cursor: pointer; border: none;
          transition: all 0.2s cubic-bezier(.22,1,.36,1);
          font-family: inherit; color: #6b7280; background: transparent;
          position: relative;
        }
        .att-tab.active {
          background: linear-gradient(135deg, #6366f1, #818cf8);
          color: #fff;
          box-shadow: 0 3px 10px rgba(99,102,241,0.3);
        }
        .att-tab:not(.active):hover { background: #f8fafc; color: #6366f1; }
        .att-tab-badge {
          font-size: 10px; font-weight: 800; padding: 1px 6px; border-radius: 6px;
        }
        .att-tab.active .att-tab-badge { background: rgba(255,255,255,0.25); color: #fff; }
        .att-tab:not(.active) .att-tab-badge { background: #fee2e2; color: #ef4444; }

        /* Toast */
        .att-toast {
          display: flex; align-items: flex-start; gap: 12px;
          padding: 14px 16px; border-radius: 14px;
          margin-bottom: 18px; border: 1.5px solid;
          font-size: 14px; font-weight: 600;
          animation: slideIn 0.3s cubic-bezier(.22,1,.36,1);
        }
        .att-toast.success { background: #ecfdf5; border-color: #a7f3d0; color: #065f46; }
        .att-toast.warn { background: #fffbeb; border-color: #fde68a; color: #92400e; }
        .att-toast.error { background: #fef2f2; border-color: #fecaca; color: #991b1b; }
        .att-toast-close { margin-left: auto; cursor: pointer; opacity: 0.5; transition: opacity 0.15s; background: none; border: none; color: inherit; display: flex; }
        .att-toast-close:hover { opacity: 1; }

        /* Panel */
        .att-panel { animation: fadeUp 0.3s cubic-bezier(.22,1,.36,1); }

        /* Cards */
        .att-card {
          background: #fff; border: 1.5px solid #e5e7eb;
          border-radius: 20px; overflow: hidden;
          box-shadow: 0 2px 16px rgba(0,0,0,0.04);
        }
        .att-card-head {
          padding: 18px 20px; border-bottom: 1.5px solid #f1f3f9;
          display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px;
        }
        .att-card-title { font-size: 14px; font-weight: 800; color: #1e1b4b; margin: 0 0 2px; }
        .att-card-sub { font-size: 12px; color: #9ca3af; margin: 0; }
        .att-card-body { padding: 16px 20px; }

        /* Scanner */
        .att-scanner-area {
          background: #0f0f1a; border-radius: 14px; overflow: hidden;
          min-height: 260px; position: relative;
        }
        #qr-reader { width: 100% !important; }
        #qr-reader video { width: 100% !important; }
        .att-scanner-idle {
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          gap: 12px; padding: 40px 20px; color: #4b5563;
        }
        .att-scanner-idle-icon {
          width: 64px; height: 64px; border-radius: 18px;
          background: rgba(99,102,241,0.12); display: flex; align-items: center; justify-content: center;
          color: #6366f1;
        }
        .att-scan-pulse {
          width: 64px; height: 64px; border-radius: 18px;
          background: rgba(99,102,241,0.08);
          display: flex; align-items: center; justify-content: center;
          animation: pulse 2s ease-in-out infinite;
          color: #6366f1;
        }
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.08); opacity: 0.8; }
        }

        /* Buttons */
        .att-btn {
          display: flex; align-items: center; justify-content: center; gap: 8px;
          padding: 12px 20px; border-radius: 13px;
          font-size: 14px; font-weight: 700; cursor: pointer; border: none;
          transition: all 0.18s ease; font-family: inherit; width: 100%;
        }
        .att-btn-primary {
          background: linear-gradient(135deg, #6366f1, #818cf8);
          color: #fff; box-shadow: 0 4px 14px rgba(99,102,241,0.3);
        }
        .att-btn-primary:hover { transform: translateY(-1px); box-shadow: 0 6px 18px rgba(99,102,241,0.4); }
        .att-btn-danger {
          background: linear-gradient(135deg, #ef4444, #f87171);
          color: #fff; box-shadow: 0 4px 12px rgba(239,68,68,0.3);
        }
        .att-btn-danger:hover { transform: translateY(-1px); }
        .att-btn:active { transform: scale(0.97) !important; }

        /* Last scanned */
        .att-last-scan {
          margin-top: 14px; padding: 14px; background: #fafbff;
          border: 1.5px solid #e0e7ff; border-radius: 14px;
          animation: fadeUp 0.3s ease;
        }
        .att-last-label { font-size: 10px; font-weight: 800; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.7px; margin-bottom: 10px; }

        /* Today list */
        .att-list { max-height: 460px; overflow-y: auto; space-y: 8px; }
        .att-list-item {
          display: flex; align-items: center; gap: 12px;
          padding: 11px 14px; border-radius: 12px;
          background: #fafbff; border: 1.5px solid #f1f3f9;
          margin-bottom: 7px;
          transition: all 0.18s ease;
          animation: fadeUp 0.3s cubic-bezier(.22,1,.36,1) both;
        }
        .att-list-item:hover { border-color: #c7d2fe; background: #f5f7ff; }

        /* Avatar */
        .att-av {
          width: 38px; height: 38px; border-radius: 11px;
          display: flex; align-items: center; justify-content: center;
          font-size: 15px; font-weight: 800; flex-shrink: 0;
        }
        .att-av-marked { background: #d1fae5; color: #059669; }
        .att-av-default { background: #eef2ff; color: #6366f1; }

        /* Shift pill */
        .att-pill { font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 6px; }
        .att-time-badge {
          flex-shrink: 0; font-size: 12px; font-weight: 700;
          color: #6366f1; background: #eef2ff; border: 1px solid #c7d2fe;
          padding: 4px 10px; border-radius: 9px;
        }

        /* Manual search */
        .att-search-wrap { position: relative; margin-bottom: 12px; }
        .att-search-icon {
          position: absolute; left: 11px; top: 50%; transform: translateY(-50%);
          color: #9ca3af; pointer-events: none; display: flex;
        }
        .att-search {
          width: 100%; box-sizing: border-box;
          padding: 10px 12px 10px 36px;
          border: 1.5px solid #e5e7eb; border-radius: 12px;
          font-size: 14px; color: #1e1b4b; background: #fafbff;
          outline: none; font-family: inherit;
          transition: border-color 0.18s, box-shadow 0.18s;
        }
        .att-search:focus { border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99,102,241,0.1); }

        /* Mark button */
        .att-mark-btn {
          flex-shrink: 0; font-size: 12px; font-weight: 700;
          color: #6366f1; background: #eef2ff; border: 1.5px solid #c7d2fe;
          padding: 6px 14px; border-radius: 9px; cursor: pointer;
          transition: all 0.15s ease; font-family: inherit;
        }
        .att-mark-btn:hover { background: #6366f1; color: #fff; border-color: #6366f1; }
        .att-mark-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .att-marked-chip {
          flex-shrink: 0; font-size: 12px; font-weight: 700;
          color: #059669; background: #d1fae5; padding: 6px 12px; border-radius: 9px;
          display: flex; align-items: center; gap: 4px;
        }

        /* Absent */
        .att-absent-grid {
          display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 10px;
        }
        .att-absent-item {
          display: flex; align-items: center; gap: 12px;
          padding: 12px 14px; border-radius: 14px;
          background: #fef2f2; border: 1.5px solid #fecaca;
          transition: all 0.18s ease;
          animation: fadeUp 0.35s cubic-bezier(.22,1,.36,1) both;
        }
        .att-absent-item:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(239,68,68,0.1); }

        /* Empty state */
        .att-empty {
          display: flex; flex-direction: column; align-items: center; gap: 12px;
          padding: 56px 20px; color: #9ca3af;
        }
        .att-empty-icon {
          width: 56px; height: 56px; border-radius: 18px;
          display: flex; align-items: center; justify-content: center;
          font-size: 26px;
        }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(-10px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      <div className={`att-page${mounted ? " mounted" : ""}`}>
        <div className="att-wrap">
          {/* Header */}
          <div className="att-header">
            <div className="att-header-icon">
              <svg
                width="22"
                height="22"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"
                />
              </svg>
            </div>
            <div>
              <h1 className="att-title">QR Attendance</h1>
              <p className="att-date">
                {new Date().toLocaleDateString("en-IN", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </p>
            </div>
          </div>

          {/* Summary */}
          <div className="att-summary">
            {[
              {
                val: todayAttendance.length,
                lbl: "Present",
                color: "#10b981",
                bg: "#ecfdf5",
                delay: "0s",
              },
              {
                val: absentStudents.length,
                lbl: "Absent",
                color: "#ef4444",
                bg: "#fef2f2",
                delay: "0.05s",
              },
              {
                val: allStudents.length,
                lbl: "Total",
                color: "#6366f1",
                bg: "#eef2ff",
                delay: "0.1s",
              },
            ].map((s) => (
              <div
                className="att-mini"
                key={s.lbl}
                style={{
                  animationDelay: s.delay,
                  borderColor:
                    s.bg === "#eef2ff"
                      ? "#c7d2fe"
                      : s.bg === "#ecfdf5"
                        ? "#a7f3d0"
                        : "#fecaca",
                }}
              >
                <span className="att-mini-val" style={{ color: s.color }}>
                  {s.val}
                </span>
                <span className="att-mini-lbl">{s.lbl}</span>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div className="att-tabs">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                className={`att-tab${activeTab === tab.id ? " active" : ""}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <span style={{ fontSize: 14 }}>{tab.icon}</span>
                <span
                  style={{
                    display: window.innerWidth < 480 ? "none" : "inline",
                  }}
                >
                  {tab.label}
                </span>
                {tab.badge > 0 && (
                  <span className="att-tab-badge">{tab.badge}</span>
                )}
              </button>
            ))}
          </div>

          {/* Toast */}
          {message && (
            <div className={`att-toast ${message.type}`}>
              <span style={{ fontSize: 16, flexShrink: 0 }}>
                {message.type === "success"
                  ? "✅"
                  : message.type === "warn"
                    ? "⚠️"
                    : "❌"}
              </span>
              <span style={{ flex: 1 }}>{message.text}</span>
              <button
                className="att-toast-close"
                onClick={() => setMessage(null)}
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
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          )}

          {/* ─── SCANNER TAB ─── */}
          {activeTab === "scanner" && (
            <div
              className="att-panel"
              style={{ display: "grid", gridTemplateColumns: "1fr", gap: 16 }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
                  gap: 16,
                }}
              >
                {/* Scanner Card */}
                <div className="att-card">
                  <div className="att-card-head">
                    <div>
                      <p className="att-card-title">Camera Scanner</p>
                      <p className="att-card-sub">
                        Point camera at student's QR code
                      </p>
                    </div>
                    {scanning && (
                      <span
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          fontSize: 12,
                          fontWeight: 700,
                          color: "#10b981",
                          background: "#ecfdf5",
                          padding: "4px 10px",
                          borderRadius: 8,
                        }}
                      >
                        <span
                          style={{
                            width: 7,
                            height: 7,
                            borderRadius: "50%",
                            background: "#10b981",
                            animation: "pulse 1s infinite",
                          }}
                        />
                        Live
                      </span>
                    )}
                  </div>
                  <div className="att-card-body">
                    <div className="att-scanner-area">
                      <div id={scannerDivId} />
                      {!scanning && (
                        <div className="att-scanner-idle">
                          <div
                            className={
                              lastScanned
                                ? "att-scanner-idle-icon"
                                : "att-scan-pulse"
                            }
                          >
                            <svg
                              width="28"
                              height="28"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.8"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z"
                              />
                            </svg>
                          </div>
                          <p
                            style={{
                              fontSize: 13,
                              fontWeight: 600,
                              color: "#6b7280",
                            }}
                          >
                            {lastScanned
                              ? "Scanner stopped"
                              : "Camera preview will appear here"}
                          </p>
                        </div>
                      )}
                    </div>
                    <div style={{ marginTop: 12 }}>
                      {!scanning ? (
                        <button
                          className="att-btn att-btn-primary"
                          onClick={startScanner}
                        >
                          <svg
                            width="16"
                            height="16"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z"
                            />
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z"
                            />
                          </svg>
                          Start Scanner
                        </button>
                      ) : (
                        <button
                          className="att-btn att-btn-danger"
                          onClick={stopScanner}
                        >
                          <svg
                            width="16"
                            height="16"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M5.25 7.5A2.25 2.25 0 017.5 5.25h9a2.25 2.25 0 012.25 2.25v9a2.25 2.25 0 01-2.25 2.25h-9a2.25 2.25 0 01-2.25-2.25v-9z"
                            />
                          </svg>
                          Stop Scanner
                        </button>
                      )}
                    </div>
                    {lastScanned && (
                      <div className="att-last-scan">
                        <p className="att-last-label">Last Scanned</p>
                        <AttStudentRow
                          student={lastScanned}
                          marked={markedIds.has(lastScanned.id)}
                        />
                      </div>
                    )}
                  </div>
                </div>
                {/* Today list */}
                <TodayList attendance={todayAttendance} />
              </div>
            </div>
          )}

          {/* ─── MANUAL TAB ─── */}
          {activeTab === "manual" && (
            <div
              className="att-panel"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
                gap: 16,
              }}
            >
              <div className="att-card">
                <div className="att-card-head">
                  <div>
                    <p className="att-card-title">Mark Manually</p>
                    <p className="att-card-sub">
                      Search by name, phone, or seat
                    </p>
                  </div>
                </div>
                <div className="att-card-body">
                  <div className="att-search-wrap">
                    <span className="att-search-icon">
                      <svg
                        width="15"
                        height="15"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 15.803 7.5 7.5 0 0016.803 15.803z"
                        />
                      </svg>
                    </span>
                    <input
                      className="att-search"
                      type="text"
                      value={manualSearch}
                      onChange={(e) => setManualSearch(e.target.value)}
                      placeholder="Search student…"
                    />
                  </div>
                  <div style={{ maxHeight: 420, overflowY: "auto" }}>
                    {filteredStudents.length === 0 ? (
                      <div className="att-empty">
                        <div
                          className="att-empty-icon"
                          style={{ background: "#f1f3f9" }}
                        >
                          🔍
                        </div>
                        <p
                          style={{
                            fontSize: 14,
                            fontWeight: 600,
                            color: "#6b7280",
                          }}
                        >
                          No students found
                        </p>
                      </div>
                    ) : (
                      filteredStudents.map((s, i) => {
                        const isMarked = markedIds.has(s.id);
                        const isLoading = manualMarking === s.id;
                        const cfg = SHIFT_CONFIG[s.shift] || {};
                        return (
                          <div
                            key={s.id}
                            className="att-list-item"
                            style={{
                              animationDelay: `${Math.min(i * 0.03, 0.25)}s`,
                              background: isMarked ? "#f0fdf4" : undefined,
                              borderColor: isMarked ? "#bbf7d0" : undefined,
                            }}
                          >
                            <div
                              className={`att-av ${isMarked ? "att-av-marked" : "att-av-default"}`}
                            >
                              {s.name?.charAt(0)?.toUpperCase() || "?"}
                            </div>
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
                                  gap: 6,
                                  alignItems: "center",
                                  flexWrap: "wrap",
                                }}
                              >
                                {cfg.label && (
                                  <span
                                    className="att-pill"
                                    style={{
                                      background: cfg.bg,
                                      color: cfg.text,
                                    }}
                                  >
                                    {cfg.label}
                                  </span>
                                )}
                                <span
                                  style={{ fontSize: 11, color: "#9ca3af" }}
                                >
                                  Seat {s.seatNumber}
                                </span>
                              </div>
                            </div>
                            {isMarked ? (
                              <span className="att-marked-chip">
                                <svg
                                  width="12"
                                  height="12"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2.5"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M4.5 12.75l6 6 9-13.5"
                                  />
                                </svg>
                                Done
                              </span>
                            ) : (
                              <button
                                className="att-mark-btn"
                                onClick={() => markAttendance(s)}
                                disabled={isLoading}
                              >
                                {isLoading ? (
                                  <span
                                    style={{
                                      width: 12,
                                      height: 12,
                                      borderRadius: "50%",
                                      border: "2px solid #c7d2fe",
                                      borderTopColor: "#6366f1",
                                      animation: "spin 0.7s linear infinite",
                                      display: "inline-block",
                                    }}
                                  />
                                ) : (
                                  "Mark"
                                )}
                              </button>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
              <TodayList attendance={todayAttendance} />
            </div>
          )}

          {/* ─── ABSENT TAB ─── */}
          {activeTab === "absent" && (
            <div className="att-panel att-card">
              <div className="att-card-head">
                <div>
                  <p className="att-card-title">Absent Today</p>
                  <p className="att-card-sub">
                    {absentStudents.length} students haven't marked attendance
                  </p>
                </div>
                {absentStudents.length > 0 && (
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
                    {absentStudents.length} absent
                  </span>
                )}
              </div>
              <div className="att-card-body">
                {absentStudents.length === 0 ? (
                  <div className="att-empty">
                    <div
                      className="att-empty-icon"
                      style={{ background: "#ecfdf5" }}
                    >
                      🎉
                    </div>
                    <p
                      style={{
                        fontSize: 15,
                        fontWeight: 700,
                        color: "#065f46",
                      }}
                    >
                      Full house today!
                    </p>
                    <p style={{ fontSize: 13 }}>
                      All {allStudents.length} students have marked attendance.
                    </p>
                  </div>
                ) : (
                  <div className="att-absent-grid">
                    {absentStudents.map((s, i) => {
                      const cfg = SHIFT_CONFIG[s.shift] || {};
                      return (
                        <div
                          key={s.id}
                          className="att-absent-item"
                          style={{
                            animationDelay: `${Math.min(i * 0.04, 0.3)}s`,
                          }}
                        >
                          <div
                            style={{
                              width: 38,
                              height: 38,
                              borderRadius: 11,
                              background: "#fee2e2",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              color: "#ef4444",
                              fontWeight: 800,
                              fontSize: 15,
                              flexShrink: 0,
                            }}
                          >
                            {s.name?.charAt(0)?.toUpperCase() || "?"}
                          </div>
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
                                gap: 6,
                                alignItems: "center",
                              }}
                            >
                              {cfg.label && (
                                <span
                                  className="att-pill"
                                  style={{
                                    background: cfg.bg,
                                    color: cfg.text,
                                  }}
                                >
                                  {cfg.label}
                                </span>
                              )}
                              <span style={{ fontSize: 11, color: "#9ca3af" }}>
                                Seat {s.seatNumber}
                              </span>
                            </div>
                          </div>
                          <button
                            className="att-mark-btn"
                            onClick={() => {
                              markAttendance(s);
                              setActiveTab("manual");
                            }}
                          >
                            Mark
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ─── HISTORY TAB ─── */}
          {activeTab === "history" && (
            <div className="att-panel att-card">
              <div className="att-card-head">
                <div>
                  <p className="att-card-title">Attendance History</p>
                  <p className="att-card-sub">
                    {historyLoading
                      ? "Loading…"
                      : `${historyList.length} records on ${formatDate(historyDate)}`}
                  </p>
                </div>
                <input
                  type="date"
                  value={historyDate}
                  max={todayISO()}
                  onChange={(e) => setHistoryDate(e.target.value)}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 11,
                    border: "1.5px solid #e5e7eb",
                    fontSize: 13,
                    color: "#1e1b4b",
                    background: "#fafbff",
                    outline: "none",
                    fontFamily: "Inter, sans-serif",
                  }}
                />
              </div>
              <div className="att-card-body">
                {historyLoading ? (
                  <div className="att-empty">
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: "50%",
                        border: "4px solid #e0e7ff",
                        borderTopColor: "#6366f1",
                        animation: "spin 0.8s linear infinite",
                      }}
                    />
                  </div>
                ) : historyList.length === 0 ? (
                  <div className="att-empty">
                    <div
                      className="att-empty-icon"
                      style={{ background: "#f1f3f9" }}
                    >
                      📅
                    </div>
                    <p
                      style={{
                        fontSize: 14,
                        fontWeight: 600,
                        color: "#6b7280",
                      }}
                    >
                      No attendance on this date
                    </p>
                  </div>
                ) : (
                  historyList.map((a, i) => {
                    const cfg = SHIFT_CONFIG[a.shift] || {};
                    return (
                      <div
                        key={a.id}
                        className="att-list-item"
                        style={{
                          animationDelay: `${Math.min(i * 0.03, 0.25)}s`,
                        }}
                      >
                        <div className="att-av att-av-marked">
                          {a.studentName?.charAt(0)?.toUpperCase() || "?"}
                        </div>
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
                            {a.studentName}
                          </p>
                          <div
                            style={{
                              display: "flex",
                              gap: 6,
                              flexWrap: "wrap",
                            }}
                          >
                            {cfg.label && (
                              <span
                                className="att-pill"
                                style={{ background: cfg.bg, color: cfg.text }}
                              >
                                {cfg.label}
                              </span>
                            )}
                            <span style={{ fontSize: 11, color: "#9ca3af" }}>
                              Seat {a.seatNumber}
                            </span>
                          </div>
                        </div>
                        <span className="att-time-badge">
                          {formatTime(a.timestamp)}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

/* Sub-components */

function TodayList({ attendance }) {
  return (
    <div className="att-card">
      <div className="att-card-head">
        <div>
          <p className="att-card-title">Today's Attendance</p>
          <p className="att-card-sub">{attendance.length} marked so far</p>
        </div>
      </div>
      <div className="att-card-body att-list">
        {attendance.length === 0 ? (
          <div className="att-empty">
            <div className="att-empty-icon" style={{ background: "#f1f3f9" }}>
              📋
            </div>
            <p style={{ fontSize: 13, color: "#9ca3af" }}>
              No attendance marked yet
            </p>
          </div>
        ) : (
          [...attendance].reverse().map((a, i) => {
            const cfg = SHIFT_CONFIG[a.shift] || {};
            return (
              <div
                key={a.id}
                className="att-list-item"
                style={{ animationDelay: `${Math.min(i * 0.03, 0.25)}s` }}
              >
                <div className="att-av att-av-marked">
                  {a.studentName?.charAt(0)?.toUpperCase() || "?"}
                </div>
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
                    {a.studentName}
                  </p>
                  <div style={{ display: "flex", gap: 6 }}>
                    {cfg.label && (
                      <span
                        className="att-pill"
                        style={{ background: cfg.bg, color: cfg.text }}
                      >
                        {cfg.label}
                      </span>
                    )}
                    <span style={{ fontSize: 11, color: "#9ca3af" }}>
                      Seat {a.seatNumber}
                    </span>
                  </div>
                </div>
                <span className="att-time-badge">
                  {a.timestamp?.toDate().toLocaleTimeString("en-IN", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function AttStudentRow({ student, marked }) {
  const cfg = SHIFT_CONFIG[student.shift] || {};
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <div className={`att-av ${marked ? "att-av-marked" : "att-av-default"}`}>
        {student.name?.charAt(0)?.toUpperCase() || "?"}
      </div>
      <div>
        <p
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: "#1e1b4b",
            margin: "0 0 4px",
          }}
        >
          {student.name}
        </p>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {cfg.label && (
            <span
              className="att-pill"
              style={{ background: cfg.bg, color: cfg.text }}
            >
              {cfg.label}
            </span>
          )}
          <span style={{ fontSize: 11, color: "#9ca3af" }}>
            Seat {student.seatNumber}
          </span>
          {student.phone && (
            <span style={{ fontSize: 11, color: "#9ca3af" }}>
              {student.phone}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
