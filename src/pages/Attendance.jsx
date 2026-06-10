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
    dot: "bg-amber-400",
  },
  evening: {
    label: "Evening",
    badge: "bg-sky-100 text-sky-800",
    dot: "bg-sky-400",
  },
  fullday: {
    label: "Full Day",
    badge: "bg-violet-100 text-violet-800",
    dot: "bg-violet-400",
  },
};

// ─── Helpers ───────────────────────────────────────────────
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
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function Attendance() {
  // ── State ──
  const [activeTab, setActiveTab] = useState("scanner"); // scanner | manual | history | absent
  const [scanning, setScanning] = useState(false);
  const [lastScanned, setLastScanned] = useState(null);
  const [message, setMessage] = useState(null); // { type: success|warn|error, text }
  const [todayAttendance, setTodayAttendance] = useState([]);
  const [allStudents, setAllStudents] = useState([]);
  const [historyDate, setHistoryDate] = useState(todayISO());
  const [historyList, setHistoryList] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [manualSearch, setManualSearch] = useState("");
  const [manualMarking, setManualMarking] = useState(null); // studentId being marked
  const [pageLoading, setPageLoading] = useState(true);
  const qrRef = useRef(null);
  const scannerDivId = "qr-reader";

  // ── Init ──
  useEffect(() => {
    const init = async () => {
      setPageLoading(true);
      await Promise.all([fetchTodayAttendance(), fetchAllStudents()]);
      setPageLoading(false);
    };
    init();
  }, []);

  // Auto-refresh history when date changes
  useEffect(() => {
    if (activeTab === "history") fetchHistoryForDate(historyDate);
  }, [historyDate, activeTab]);

  // Stop scanner when switching tabs
  useEffect(() => {
    if (activeTab !== "scanner" && scanning) stopScanner();
  }, [activeTab]);

  // ── Firebase ──
  const fetchAllStudents = async () => {
    const snap = await getDocs(collection(db, "students"));
    setAllStudents(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  };

  const fetchTodayAttendance = async () => {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);
    const q = query(
      collection(db, "attendance"),
      where("timestamp", ">=", Timestamp.fromDate(startOfDay)),
      where("timestamp", "<=", Timestamp.fromDate(endOfDay)),
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
        text: `Attendance marked for ${student.name}!`,
      });
      await fetchTodayAttendance();
    } catch (err) {
      setMessage({
        type: "error",
        text: "Error marking attendance: " + err.message,
      });
    }
    setManualMarking(null);
  };

  // ── QR Scanner ──
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
    const student = allStudents.find((s) => s.id === studentId);
    if (!student) {
      setMessage({
        type: "error",
        text: "Student not found! Invalid QR code.",
      });
      return;
    }
    await markAttendance(student);
  };

  // ── Derived ──
  const markedIds = new Set(todayAttendance.map((a) => a.studentId));
  const absentStudents = allStudents.filter((s) => !markedIds.has(s.id));
  const filteredStudents = allStudents.filter(
    (s) =>
      s.name?.toLowerCase().includes(manualSearch.toLowerCase()) ||
      String(s.seatNumber).includes(manualSearch) ||
      s.phone?.includes(manualSearch),
  );

  const TABS = [
    {
      id: "scanner",
      label: "Scanner",
      icon: (
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M6.75 6.75h.75v.75h-.75v-.75zM6.75 16.5h.75v.75h-.75v-.75zM16.5 6.75h.75v.75h-.75v-.75zM13.5 13.5h.75v.75h-.75v-.75zM13.5 19.5h.75v.75h-.75v-.75zM19.5 13.5h.75v.75h-.75v-.75zM19.5 19.5h.75v.75h-.75v-.75zM16.5 16.5h.75v.75h-.75v-.75z"
          />
        </svg>
      ),
    },
    {
      id: "manual",
      label: "Manual",
      icon: (
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
          />
        </svg>
      ),
    },
    {
      id: "absent",
      label: "Absent",
      icon: (
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
          />
        </svg>
      ),
      badge: absentStudents.length,
    },
    {
      id: "history",
      label: "History",
      icon: (
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      ),
    },
  ];

  if (pageLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full border-4 border-indigo-200 border-t-indigo-600 animate-spin" />
          <p className="text-sm text-slate-500 font-medium">
            Loading attendance...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto px-4 py-6 sm:px-6">
        {/* ── Header ── */}
        <div className="mb-6">
          <h1 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center flex-shrink-0">
              <svg
                className="w-4 h-4 text-white"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.2}
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"
                />
              </svg>
            </span>
            QR Attendance
          </h1>
          <p className="text-sm text-slate-500 mt-0.5 ml-10">
            {new Date().toLocaleDateString("en-IN", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
        </div>

        {/* ── Today's Summary Strip ── */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <MiniStat
            label="Present"
            value={todayAttendance.length}
            color="text-emerald-600"
            bg="bg-emerald-50 border-emerald-100"
          />
          <MiniStat
            label="Absent"
            value={absentStudents.length}
            color="text-red-500"
            bg="bg-red-50 border-red-100"
          />
          <MiniStat
            label="Total"
            value={allStudents.length}
            color="text-indigo-600"
            bg="bg-indigo-50 border-indigo-100"
          />
        </div>

        {/* ── Tabs ── */}
        <div className="flex gap-1 bg-white border border-slate-200 rounded-xl p-1 mb-5 shadow-sm">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-semibold transition-all duration-150
                ${
                  activeTab === tab.id
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                }
              `}
            >
              {tab.icon}
              <span className="hidden sm:inline">{tab.label}</span>
              {tab.badge > 0 && (
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${activeTab === tab.id ? "bg-white/25 text-white" : "bg-red-100 text-red-600"}`}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Toast Message ── */}
        {message && (
          <div
            className={`
            mb-5 flex items-start gap-3 px-4 py-3.5 rounded-xl text-sm font-semibold border
            ${
              message.type === "success"
                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                : message.type === "warn"
                  ? "bg-amber-50 border-amber-200 text-amber-800"
                  : "bg-red-50 border-red-200 text-red-700"
            }
          `}
          >
            <span className="text-lg flex-shrink-0 mt-0.5">
              {message.type === "success"
                ? "✅"
                : message.type === "warn"
                  ? "⚠️"
                  : "❌"}
            </span>
            <div className="flex-1">{message.text}</div>
            <button
              onClick={() => setMessage(null)}
              className="text-current opacity-50 hover:opacity-100 flex-shrink-0"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
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

        {/* ═══════════════════════════════════════════ */}
        {/* TAB: SCANNER                                */}
        {/* ═══════════════════════════════════════════ */}
        {activeTab === "scanner" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Scanner Box */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100">
                <h2 className="text-sm font-bold text-slate-800">
                  Camera Scanner
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Point camera at student's QR code
                </p>
              </div>

              {/* Camera area */}
              <div className="p-4">
                <div
                  id={scannerDivId}
                  className="w-full rounded-xl overflow-hidden bg-slate-900"
                  style={{ minHeight: "260px" }}
                />

                {!scanning && !lastScanned && (
                  <div className="mt-3 flex flex-col items-center gap-2 py-4 text-slate-400">
                    <svg
                      className="w-10 h-10 opacity-30"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={1.5}
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z"
                      />
                    </svg>
                    <p className="text-xs">Camera preview will appear here</p>
                  </div>
                )}

                <div className="mt-4 flex gap-2">
                  {!scanning ? (
                    <button
                      onClick={startScanner}
                      className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 active:scale-[0.98] transition-all"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
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
                          d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z"
                        />
                      </svg>
                      Start Scanner
                    </button>
                  ) : (
                    <button
                      onClick={stopScanner}
                      className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 active:scale-[0.98] transition-all"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
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
              </div>

              {/* Last scanned card */}
              {lastScanned && (
                <div className="mx-4 mb-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide mb-2">
                    Last Scanned
                  </p>
                  <StudentMiniCard
                    student={lastScanned}
                    marked={markedIds.has(lastScanned.id)}
                  />
                </div>
              )}
            </div>

            {/* Today's attendance list */}
            <TodayList attendance={todayAttendance} />
          </div>
        )}

        {/* ═══════════════════════════════════════════ */}
        {/* TAB: MANUAL                                 */}
        {/* ═══════════════════════════════════════════ */}
        {activeTab === "manual" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100">
                <h2 className="text-sm font-bold text-slate-800">
                  Mark Manually
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Search by name, phone, or seat number
                </p>
              </div>
              <div className="p-4">
                {/* Search */}
                <div className="relative mb-3">
                  <svg
                    className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 15.803 7.5 7.5 0 0016.803 15.803z"
                    />
                  </svg>
                  <input
                    type="text"
                    value={manualSearch}
                    onChange={(e) => setManualSearch(e.target.value)}
                    placeholder="Search student..."
                    className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 text-slate-800 placeholder:text-slate-400"
                  />
                </div>

                {/* Student list */}
                <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                  {filteredStudents.length === 0 && (
                    <p className="text-sm text-slate-400 text-center py-8">
                      No students found
                    </p>
                  )}
                  {filteredStudents.map((s) => {
                    const isMarked = markedIds.has(s.id);
                    const isLoading = manualMarking === s.id;
                    return (
                      <div
                        key={s.id}
                        className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${isMarked ? "bg-emerald-50 border-emerald-100" : "bg-slate-50 border-slate-100 hover:border-slate-200"}`}
                      >
                        <Avatar name={s.name} marked={isMarked} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-800 truncate">
                            {s.name}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <ShiftPill shift={s.shift} />
                            <span className="text-xs text-slate-400">
                              Seat {s.seatNumber}
                            </span>
                          </div>
                        </div>
                        {isMarked ? (
                          <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600 bg-emerald-100 px-2.5 py-1 rounded-full flex-shrink-0">
                            <svg
                              className="w-3 h-3"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth={2.5}
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
                            onClick={() => markAttendance(s)}
                            disabled={isLoading}
                            className="flex-shrink-0 flex items-center gap-1 text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 px-3 py-1.5 rounded-full transition-all disabled:opacity-50"
                          >
                            {isLoading ? (
                              <span className="w-3 h-3 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin" />
                            ) : (
                              <svg
                                className="w-3 h-3"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth={2.5}
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M4.5 12.75l6 6 9-13.5"
                                />
                              </svg>
                            )}
                            Mark
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <TodayList attendance={todayAttendance} />
          </div>
        )}

        {/* ═══════════════════════════════════════════ */}
        {/* TAB: ABSENT                                 */}
        {/* ═══════════════════════════════════════════ */}
        {activeTab === "absent" && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-800">
                  Absent Today
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {absentStudents.length} students haven't marked attendance
                </p>
              </div>
              {absentStudents.length > 0 && (
                <span className="text-xs font-bold bg-red-100 text-red-600 px-2.5 py-1 rounded-full">
                  {absentStudents.length} absent
                </span>
              )}
            </div>
            <div className="p-4">
              {absentStudents.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-14 text-slate-400">
                  <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center">
                    <svg
                      className="w-7 h-7 text-emerald-500"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                  <p className="text-sm font-semibold text-slate-600">
                    Full house today!
                  </p>
                  <p className="text-xs text-center">
                    All {allStudents.length} students have marked attendance.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {absentStudents.map((s) => (
                    <div
                      key={s.id}
                      className="flex items-center gap-3 p-3 rounded-xl bg-red-50 border border-red-100"
                    >
                      <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center text-red-500 font-bold text-sm flex-shrink-0">
                        {s.name?.charAt(0)?.toUpperCase() || "?"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-800 truncate">
                          {s.name}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <ShiftPill shift={s.shift} />
                          <span className="text-xs text-slate-400">
                            Seat {s.seatNumber}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          markAttendance(s);
                          setActiveTab("manual");
                        }}
                        className="flex-shrink-0 text-xs font-semibold text-indigo-600 bg-white hover:bg-indigo-50 border border-indigo-100 px-2.5 py-1.5 rounded-full transition-all"
                      >
                        Mark
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════ */}
        {/* TAB: HISTORY                                */}
        {/* ═══════════════════════════════════════════ */}
        {activeTab === "history" && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-3">
              <div>
                <h2 className="text-sm font-bold text-slate-800">
                  Attendance History
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {historyLoading
                    ? "Loading..."
                    : `${historyList.length} records on ${formatDate(historyDate)}`}
                </p>
              </div>
              <input
                type="date"
                value={historyDate}
                max={todayISO()}
                onChange={(e) => setHistoryDate(e.target.value)}
                className="text-sm px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 text-slate-700"
              />
            </div>

            <div className="p-4">
              {historyLoading ? (
                <div className="flex justify-center py-10">
                  <div className="w-7 h-7 rounded-full border-4 border-indigo-200 border-t-indigo-600 animate-spin" />
                </div>
              ) : historyList.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-12 text-slate-400">
                  <svg
                    className="w-10 h-10 opacity-40"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.5}
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"
                    />
                  </svg>
                  <p className="text-sm font-medium text-slate-500">
                    No attendance on this date
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {historyList.map((a) => (
                    <div
                      key={a.id}
                      className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100"
                    >
                      <Avatar name={a.studentName} marked />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-800 truncate">
                          {a.studentName}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <ShiftPill shift={a.shift} />
                          <span className="text-xs text-slate-400">
                            Seat {a.seatNumber}
                          </span>
                        </div>
                      </div>
                      <div className="flex-shrink-0 text-right">
                        <span className="text-xs font-semibold text-slate-600 bg-white border border-slate-200 px-2.5 py-1 rounded-lg">
                          {formatTime(a.timestamp)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Sub-components ─────────────────────────────────────── */

function TodayList({ attendance }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100">
        <h2 className="text-sm font-bold text-slate-800">Today's Attendance</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          {attendance.length} marked so far
        </p>
      </div>
      <div className="p-4 max-h-[460px] overflow-y-auto space-y-2">
        {attendance.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-10">
            No attendance marked yet today.
          </p>
        ) : (
          [...attendance].reverse().map((a) => (
            <div
              key={a.id}
              className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100"
            >
              <Avatar name={a.studentName} marked />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800 truncate">
                  {a.studentName}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <ShiftPill shift={a.shift} />
                  <span className="text-xs text-slate-400">
                    Seat {a.seatNumber}
                  </span>
                </div>
              </div>
              <span className="flex-shrink-0 text-xs font-semibold text-slate-500 bg-white border border-slate-200 px-2 py-1 rounded-lg">
                {a.timestamp
                  ?.toDate()
                  .toLocaleTimeString("en-IN", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function MiniStat({ label, value, color, bg }) {
  return (
    <div className={`flex flex-col items-center py-3 rounded-xl border ${bg}`}>
      <span className={`text-2xl font-bold ${color}`}>{value}</span>
      <span className="text-xs text-slate-500 font-medium mt-0.5">{label}</span>
    </div>
  );
}

function Avatar({ name, marked }) {
  return (
    <div
      className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 ${marked ? "bg-emerald-100 text-emerald-700" : "bg-indigo-100 text-indigo-700"}`}
    >
      {name?.charAt(0)?.toUpperCase() || "?"}
    </div>
  );
}

function ShiftPill({ shift }) {
  const cfg = SHIFT_CONFIG[shift];
  if (!cfg) return <span className="text-xs text-slate-400">{shift}</span>;
  return (
    <span
      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${cfg.badge}`}
    >
      {cfg.label}
    </span>
  );
}

function StudentMiniCard({ student, marked }) {
  return (
    <div className="flex items-center gap-3">
      <Avatar name={student.name} marked={marked} />
      <div>
        <p className="text-sm font-bold text-slate-800">{student.name}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <ShiftPill shift={student.shift} />
          <span className="text-xs text-slate-500">
            Seat {student.seatNumber}
          </span>
          <span className="text-xs text-slate-400">{student.phone}</span>
        </div>
      </div>
    </div>
  );
}
