// src/pages/StudentView.jsx
// Student self-service view — QR code, subscription status, attendance history
import { useState, useEffect } from "react";
import {
  collection,
  getDocs,
  query,
  where,
  Timestamp,
  doc,
  getDoc,
} from "firebase/firestore";
import { db } from "../firebase";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import QRCode from "qrcode";

const SHIFT_CONFIG = {
  morning: { label: "Morning", bg: "#fef3c7", text: "#92400e", dot: "#f59e0b" },
  evening: { label: "Evening", bg: "#dbeafe", text: "#1e40af", dot: "#3b82f6" },
  fullday: {
    label: "Full Day",
    bg: "#ede9fe",
    text: "#5b21b6",
    dot: "#8b5cf6",
  },
  afternoon: {
    label: "Afternoon",
    bg: "#d1fae5",
    text: "#065f46",
    dot: "#10b981",
  },
};

function daysLeftCalc(endDate) {
  if (!endDate) return null;
  const diff = Math.ceil((new Date(endDate) - new Date()) / 86400000);
  return diff;
}

function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatTime(ts) {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

function formatDay(ts) {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function getWeekdayShort(ts) {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("en-IN", { weekday: "short" });
}

export default function StudentHome() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [id, setId] = useState(null);
  const [student, setStudent] = useState(null);
  const [qrDataURL, setQrDataURL] = useState(null);
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [qrCopied, setQrCopied] = useState(false);
  const [mappingError, setMappingError] = useState(false);

  // Step 1: Fetch associated studentId from users collection mapping node
  useEffect(() => {
    const fetchStudentId = async () => {
      if (!user?.uid) return;

      try {
        const userSnap = await getDoc(doc(db, "users", user.uid));

        if (userSnap.exists()) {
          const data = userSnap.data();
          if (data.studentId) {
            setId(data.studentId);
          } else {
            setMappingError(true);
            setLoading(false);
          }
        } else {
          setMappingError(true);
          setLoading(false);
        }
      } catch (e) {
        console.error("User mapping query failure:", e);
        setLoading(false);
      }
    };

    fetchStudentId();
  }, [user]);

  // Step 2: Initialize secondary synchronization pipeline when studentId pointer connects
  useEffect(() => {
    if (!id) return;

    const init = async () => {
      await Promise.all([fetchStudent(), fetchAttendance()]);
      setLoading(false);
      setTimeout(() => setMounted(true), 60);
    };

    init();
  }, [id]);

  const fetchStudent = async () => {
    try {
      const snap = await getDoc(doc(db, "students", id));
      if (!snap.exists()) {
        navigate("/");
        return;
      }
      const data = { id: snap.id, ...snap.data() };
      setStudent(data);
      if (data.qrData) {
        const url = await QRCode.toDataURL(data.qrData, {
          width: 320,
          margin: 2,
          color: { dark: "#1e1b4b", light: "#ffffff" },
        });
        setQrDataURL(url);
      }
    } catch (e) {
      console.error("Student profile parsing error:", e);
    }
  };

  const fetchAttendance = async () => {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      thirtyDaysAgo.setHours(0, 0, 0, 0);

      const q = query(
        collection(db, "attendance"),
        where("studentId", "==", id),
        where("timestamp", ">=", Timestamp.fromDate(thirtyDaysAgo)),
      );
      const snap = await getDocs(q);
      const records = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => b.timestamp?.toMillis() - a.timestamp?.toMillis());
      setAttendance(records);
    } catch (e) {
      console.error("Attendance log retrieval error:", e);
    }
  };

  const handleShareQR = async () => {
    if (!qrDataURL) return;
    const blob = await (await fetch(qrDataURL)).blob();
    const file = new File([blob], `${student?.name || "Student"}_QR.png`, {
      type: "image/png",
    });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: `${student.name}'s QR Code`,
        });
        return;
      } catch (_) {}
    }
    const link = document.createElement("a");
    link.href = qrDataURL;
    link.download = `${student?.name || "Student"}_QR.png`;
    link.click();
    setQrCopied(true);
    setTimeout(() => setQrCopied(false), 2200);
  };

  // UI state management for structural loader
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
            Loading profile…
          </p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // Handle case where authentication exists but database pointer mapping fails
  if (mappingError) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#f0f2f8",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "Inter, sans-serif",
          padding: 16,
        }}
      >
        <div
          style={{
            background: "#fff",
            borderRadius: 20,
            padding: "32px 24px",
            border: "1.5px solid #e5e7eb",
            textAlign: "center",
            maxWidth: 400,
            width: "100%",
          }}
        >
          <div style={{ fontSize: 42, marginBottom: 12 }}>⚠️</div>
          <h2 style={{ color: "#1e1b4b", fontWeight: 800, margin: "0 0 8px" }}>
            Mapping Profile Missing
          </h2>
          <p
            style={{
              color: "#6b7280",
              fontSize: 13,
              lineHeight: "1.5",
              margin: "0 0 20px",
            }}
          >
            Aapka email registered hai par user record complete nahi mila.
            Kripya library administrator se bolkar check karein ki aapka UID
            correctly linked hai ya nahi.
          </p>
          <button className="sv-qr-share" onClick={() => navigate("/")}>
            Go to Home
          </button>
        </div>
      </div>
    );
  }

  if (!student) return null;

  const daysLeft = daysLeftCalc(student.endDate);
  const totalDays = (() => {
    if (!student.startDate || !student.endDate) return 30;
    return Math.max(
      1,
      Math.ceil(
        (new Date(student.endDate) - new Date(student.startDate)) / 86400000,
      ),
    );
  })();
  const daysUsed = Math.max(0, totalDays - Math.max(0, daysLeft ?? 0));
  const progressPct = Math.min(100, Math.max(0, (daysUsed / totalDays) * 100));

  const isExpiringSoon = daysLeft !== null && daysLeft <= 7 && daysLeft >= 0;
  const isExpired = daysLeft !== null && daysLeft < 0;
  const shiftCfg = SHIFT_CONFIG[student.shift] || SHIFT_CONFIG.morning;

  // Build calendar matrix tracking past month cycles
  const calendarDays = Array.from({ length: 30 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (29 - i));
    return d;
  });
  const attendedDates = new Set(
    attendance.map((a) => {
      const d = a.timestamp?.toDate
        ? a.timestamp.toDate()
        : new Date(a.timestamp);
      return d.toLocaleDateString("en-CA");
    }),
  );

  return (
    <>
      <style>{`
        .sv-page {
          min-height: 100vh;
          background: #f0f2f8;
          padding: 24px 16px 56px;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
          opacity: 0; transform: translateY(14px);
          transition: opacity 0.45s ease, transform 0.45s ease;
        }
        .sv-page.mounted { opacity: 1; transform: translateY(0); }
        .sv-wrap { max-width: 480px; margin: 0 auto; }

        /* Back navigation */
        .sv-back {
          display: inline-flex; align-items: center; gap: 6px;
          color: #6b7280; font-size: 13px; font-weight: 600;
          background: none; border: none; cursor: pointer;
          padding: 0; margin-bottom: 20px; font-family: inherit;
          transition: color 0.15s;
        }
        .sv-back:hover { color: #1e1b4b; }

        /* Card panels layout */
        .sv-card {
          background: #fff;
          border: 1.5px solid #e5e7eb;
          border-radius: 20px;
          overflow: hidden;
          margin-bottom: 16px;
          box-shadow: 0 2px 16px rgba(99,102,241,0.05);
          animation: fadeUp 0.4s cubic-bezier(.22,1,.36,1) both;
        }

        /* Profile metadata elements */
        .sv-profile {
          display: flex; align-items: center; gap: 14px;
          padding: 20px 22px;
          background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%);
          color: #fff;
        }
        .sv-avatar {
          width: 52px; height: 52px; border-radius: 16px;
          background: rgba(255,255,255,0.18);
          display: flex; align-items: center; justify-content: center;
          font-size: 22px; font-weight: 800; color: #fff; flex-shrink: 0;
          border: 2px solid rgba(255,255,255,0.25);
        }
        .sv-profile-name { font-size: 18px; font-weight: 800; margin: 0 0 4px; }
        .sv-profile-sub { font-size: 12px; opacity: 0.7; margin: 0; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        .sv-shift-pill {
          font-size: 10px; font-weight: 800;
          padding: 2px 9px; border-radius: 6px;
          letter-spacing: 0.3px;
        }
        .sv-active-dot {
          display: inline-flex; align-items: center; gap: 5px; font-size: 11px;
        }
        .sv-dot {
          width: 6px; height: 6px; border-radius: 50%; background: #34d399;
          box-shadow: 0 0 0 2px rgba(52,211,153,0.3);
        }

        /* QR Frame wrappers */
        .sv-qr-body {
          display: flex; flex-direction: column; align-items: center;
          padding: 28px 22px 24px;
          gap: 0;
        }
        .sv-qr-frame {
          width: 200px; height: 200px;
          border-radius: 18px;
          background: #fff;
          border: 2px solid #e0e7ff;
          padding: 10px;
          box-sizing: border-box;
          display: flex; align-items: center; justify-content: center;
          margin-bottom: 16px;
        }
        .sv-qr-frame img { width: 100%; height: 100%; border-radius: 10px; }
        .sv-qr-label {
          font-size: 11px; font-weight: 700; color: #9ca3af;
          text-transform: uppercase; letter-spacing: 0.6px;
          margin-bottom: 16px; text-align: center;
        }
        .sv-qr-share {
          width: 100%; display: flex; align-items: center; justify-content: center;
          gap: 8px; padding: 12px 20px; border-radius: 13px;
          background: linear-gradient(135deg, #6366f1, #818cf8);
          color: #fff; border: none; cursor: pointer;
          font-size: 14px; font-weight: 700; font-family: inherit;
          box-shadow: 0 4px 14px rgba(99,102,241,0.28);
          transition: all 0.18s ease;
        }
        .sv-qr-share:hover { transform: translateY(-1px); box-shadow: 0 6px 18px rgba(99,102,241,0.38); }
        .sv-qr-share:active { transform: scale(0.97); }
        .sv-qr-empty {
          width: 200px; height: 200px; border-radius: 18px;
          background: #f8fafc; border: 2px dashed #c7d2fe;
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          gap: 8px; color: #9ca3af; font-size: 12px; margin-bottom: 16px;
        }

        /* Subscription metadata display */
        .sv-sub-head {
          display: flex; align-items: center; justify-content: space-between;
          padding: 18px 22px 14px;
          border-bottom: 1.5px solid #f1f3f9;
        }
        .sv-sub-title { font-size: 14px; font-weight: 800; color: #1e1b4b; margin: 0 0 2px; }
        .sv-sub-subtitle { font-size: 12px; color: #9ca3af; margin: 0; }
        .sv-days-display { display: flex; flex-direction: column; align-items: flex-end; }
        .sv-days-num { font-size: 28px; font-weight: 800; line-height: 1; letter-spacing: -1px; }
        .sv-days-lbl { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 2px; }
        .sv-sub-body { padding: 16px 22px 20px; }

        /* Progress tracker metrics */
        .sv-progress-wrap { margin-bottom: 18px; }
        .sv-progress-labels { display: flex; justify-content: space-between; font-size: 11px; color: #9ca3af; margin-bottom: 7px; font-weight: 600; }
        .sv-progress-track { height: 8px; background: #f1f3f9; border-radius: 100px; overflow: hidden; }
        .sv-progress-fill { height: 100%; border-radius: 100px; transition: width 0.8s cubic-bezier(.22,1,.36,1); }

        /* Details layout grid */
        .sv-detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .sv-detail-box { background: #fafbff; border: 1.5px solid #f1f3f9; border-radius: 13px; padding: 12px 14px; }
        .sv-detail-label { font-size: 10px; font-weight: 700; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.6px; margin: 0 0 5px; }
        .sv-detail-value { font-size: 14px; font-weight: 800; color: #1e1b4b; margin: 0; }

        /* Threshold Warnings styling rules */
        .sv-warning { display: flex; align-items: center; gap: 10px; background: #fef2f2; border: 1.5px solid #fecaca; border-radius: 12px; padding: 11px 14px; margin-bottom: 16px; animation: pulse-bg 2s ease-in-out infinite; }
        .sv-warning-icon { width: 30px; height: 30px; border-radius: 9px; background: #fee2e2; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .sv-warning-title { font-size: 13px; font-weight: 700; color: #991b1b; margin: 0 0 1px; }
        .sv-warning-sub { font-size: 11.5px; color: #b91c1c; margin: 0; }
        .sv-expired-banner { display: flex; align-items: center; gap: 10px; background: #fef2f2; border: 1.5px solid #fca5a5; border-radius: 12px; padding: 11px 14px; margin-bottom: 16px; }

        /* Attendance log components list */
        .sv-att-head { display: flex; align-items: center; justify-content: space-between; padding: 18px 22px 14px; border-bottom: 1.5px solid #f1f3f9; }
        .sv-att-title { font-size: 14px; font-weight: 800; color: #1e1b4b; margin: 0 0 2px; }
        .sv-att-subtitle { font-size: 12px; color: #9ca3af; margin: 0; }
        .sv-att-badge { background: #eef2ff; color: #4f46e5; font-size: 13px; font-weight: 800; padding: 5px 12px; border-radius: 9px; border: 1px solid #c7d2fe; }

        /* Heatmap Grid matrix components */
        .sv-calendar { padding: 16px 22px 6px; border-bottom: 1.5px solid #f1f3f9; }
        .sv-cal-label { font-size: 11px; font-weight: 700; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.6px; margin-bottom: 10px; }
        .sv-cal-grid { display: grid; grid-template-columns: repeat(10, 1fr); gap: 5px; }
        .sv-cal-day { aspect-ratio: 1; border-radius: 7px; display: flex; align-items: center; justify-content: center; font-size: 9px; font-weight: 700; transition: transform 0.15s ease; }
        .sv-cal-day:hover { transform: scale(1.15); }
        .sv-cal-present { background: #6366f1; color: #fff; }
        .sv-cal-absent { background: #f1f3f9; color: #c7d2fe; }
        .sv-cal-today { background: #1e1b4b; color: #fff; }

        .sv-att-list { padding: 12px 22px 20px; }
        .sv-att-item { display: flex; align-items: center; gap: 12px; padding: 10px 0; border-bottom: 1.5px solid #f8fafc; animation: fadeUp 0.35s cubic-bezier(.22,1,.36,1) both; }
        .sv-att-item:last-child { border-bottom: none; }
        .sv-att-av { width: 38px; height: 38px; border-radius: 11px; flex-shrink: 0; background: #eef2ff; display: flex; align-items: center; justify-content: center; }
        .sv-att-day { font-size: 12px; font-weight: 800; color: #1e1b4b; margin: 0 0 2px; }
        .sv-att-date { font-size: 11px; color: #9ca3af; margin: 0; }
        .sv-att-time { margin-left: auto; flex-shrink: 0; font-size: 12px; font-weight: 700; color: #6366f1; background: #eef2ff; border: 1px solid #c7d2fe; padding: 4px 10px; border-radius: 8px; }
        .sv-att-checkmark { width: 18px; height: 18px; border-radius: 50%; background: #10b981; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }

        .sv-empty-att { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 32px 20px; color: #9ca3af; }
        .sv-empty-icon { width: 48px; height: 48px; border-radius: 14px; background: #f1f3f9; display: flex; align-items: center; justify-content: center; font-size: 22px; }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse-bg {
          0%, 100% { box-shadow: none; }
          50% { box-shadow: 0 0 0 4px rgba(239,68,68,0.1); }
        }
      `}</style>

      <div className={`sv-page${mounted ? " mounted" : ""}`}>
        <div className="sv-wrap">
          {/* Back Navigation Bar */}
          <button className="sv-back" onClick={() => navigate(-1)}>
            <svg
              width="15"
              height="15"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"
              />
            </svg>
            Back
          </button>

          {/* ── Profile strip Card ── */}
          <div className="sv-card" style={{ animationDelay: "0s" }}>
            <div className="sv-profile">
              <div className="sv-avatar">
                {student.name?.charAt(0)?.toUpperCase() || "?"}
              </div>
              <div>
                <p className="sv-profile-name">{student.name}</p>
                <div className="sv-profile-sub">
                  <span
                    className="sv-shift-pill"
                    style={{ background: shiftCfg.bg, color: shiftCfg.text }}
                  >
                    {shiftCfg.label}
                  </span>
                  <span>Seat {student.seatNumber}</span>
                  {student.status !== "inactive" && (
                    <span className="sv-active-dot">
                      <span className="sv-dot" />
                      Active
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* ── QR Container View ── */}
            <div className="sv-qr-body">
              {qrDataURL ? (
                <div className="sv-qr-frame">
                  <img
                    src={qrDataURL}
                    alt={`${student.name}'s attendance QR code`}
                  />
                </div>
              ) : (
                <div className="sv-qr-empty">
                  <svg
                    width="28"
                    height="28"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5z"
                    />
                  </svg>
                  <span>No QR code yet</span>
                </div>
              )}

              <p className="sv-qr-label">Scan this at the library entrance</p>

              <button className="sv-qr-share" onClick={handleShareQR}>
                {qrCopied ? (
                  <>
                    <svg
                      width="16"
                      height="16"
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
                    Downloaded!
                  </>
                ) : (
                  <>
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
                        d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z"
                      />
                    </svg>
                    Share / Download QR
                  </>
                )}
              </button>
            </div>
          </div>

          {/* ── Subscription Management Panel ── */}
          <div className="sv-card" style={{ animationDelay: "0.08s" }}>
            <div className="sv-sub-head">
              <div>
                <p className="sv-sub-title">Subscription</p>
                <p className="sv-sub-subtitle">
                  {isExpired
                    ? "Membership has expired"
                    : `Renews on ${formatDate(student.endDate)}`}
                </p>
              </div>
              <div className="sv-days-display">
                <span
                  className="sv-days-num"
                  style={{
                    color: isExpired
                      ? "#ef4444"
                      : isExpiringSoon
                        ? "#f97316"
                        : "#1e1b4b",
                  }}
                >
                  {isExpired ? "0" : Math.max(0, daysLeft ?? 0)}
                </span>
                <span
                  className="sv-days-lbl"
                  style={{
                    color: isExpired
                      ? "#ef4444"
                      : isExpiringSoon
                        ? "#f97316"
                        : "#9ca3af",
                  }}
                >
                  {isExpired ? "Expired" : "Days left"}
                </span>
              </div>
            </div>

            <div className="sv-sub-body">
              {/* Threshold Warnings conditional wrappers */}
              {isExpired && (
                <div className="sv-expired-banner">
                  <div className="sv-warning-icon">
                    <svg
                      width="15"
                      height="15"
                      fill="none"
                      stroke="#ef4444"
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z"
                      />
                    </svg>
                  </div>
                  <div>
                    <p className="sv-warning-title">Membership expired</p>
                    <p className="sv-warning-sub">
                      Contact the library to renew your seat
                    </p>
                  </div>
                </div>
              )}

              {isExpiringSoon && !isExpired && (
                <div className="sv-warning">
                  <div className="sv-warning-icon">
                    <svg
                      width="15"
                      height="15"
                      fill="none"
                      stroke="#ef4444"
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                  <div>
                    <p className="sv-warning-title">
                      Expiring in {daysLeft} day{daysLeft === 1 ? "" : "s"}
                    </p>
                    <p className="sv-warning-sub">
                      Contact the library to renew and keep your seat
                    </p>
                  </div>
                </div>
              )}

              {/* Progress track container */}
              <div className="sv-progress-wrap">
                <div className="sv-progress-labels">
                  <span>Start: {formatDate(student.startDate)}</span>
                  <span>End: {formatDate(student.endDate)}</span>
                </div>
                <div className="sv-progress-track">
                  <div
                    className="sv-progress-fill"
                    style={{
                      width: `${progressPct}%`,
                      background: isExpired
                        ? "#ef4444"
                        : isExpiringSoon
                          ? "linear-gradient(90deg, #f97316, #ef4444)"
                          : "linear-gradient(90deg, #6366f1, #818cf8)",
                    }}
                  />
                </div>
              </div>

              {/* Meta Detail Grid structure */}
              <div className="sv-detail-grid">
                <div className="sv-detail-box">
                  <p className="sv-detail-label">Seat</p>
                  <p className="sv-detail-value">No. {student.seatNumber}</p>
                </div>
                <div className="sv-detail-box">
                  <p className="sv-detail-label">Shift</p>
                  <p
                    className="sv-detail-value"
                    style={{ color: shiftCfg.dot }}
                  >
                    {shiftCfg.label}
                  </p>
                </div>
                <div className="sv-detail-box">
                  <p className="sv-detail-label">Monthly fee</p>
                  <p className="sv-detail-value">₹{student.feeAmount || "—"}</p>
                </div>
                <div className="sv-detail-box">
                  <p className="sv-detail-label">Member since</p>
                  <p className="sv-detail-value" style={{ fontSize: 13 }}>
                    {student.createdAt
                      ? new Date(student.createdAt).toLocaleDateString(
                          "en-IN",
                          { month: "short", year: "numeric" },
                        )
                      : formatDate(student.startDate)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* ── Attendance Log History view ── */}
          <div className="sv-card" style={{ animationDelay: "0.16s" }}>
            <div className="sv-att-head">
              <div>
                <p className="sv-att-title">Attendance — last 30 days</p>
                <p className="sv-att-subtitle">
                  {attendance.length} session
                  {attendance.length !== 1 ? "s" : ""} attended
                </p>
              </div>
              <span className="sv-att-badge">{attendance.length} / 30</span>
            </div>

            {/* Micro calendar heat strip */}
            <div className="sv-calendar">
              <p className="sv-cal-label">Daily presence</p>
              <div className="sv-cal-grid">
                {calendarDays.map((d, i) => {
                  const key = d.toLocaleDateString("en-CA");
                  const isToday =
                    key === new Date().toLocaleDateString("en-CA");
                  const present = attendedDates.has(key);
                  return (
                    <div
                      key={i}
                      className={`sv-cal-day ${isToday ? "sv-cal-today" : present ? "sv-cal-present" : "sv-cal-absent"}`}
                      title={`${d.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}${present ? " — Present" : ""}`}
                    >
                      {d.getDate()}
                    </div>
                  );
                })}
              </div>
              {/* Legends wrapper block */}
              <div
                style={{
                  display: "flex",
                  gap: 14,
                  alignItems: "center",
                  marginTop: 10,
                  paddingBottom: 4,
                }}
              >
                {[
                  { cls: "sv-cal-present", label: "Present" },
                  { cls: "sv-cal-absent", label: "Absent" },
                  { cls: "sv-cal-today", label: "Today" },
                ].map(({ cls, label }) => (
                  <div
                    key={label}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 5,
                      fontSize: 11,
                      color: "#9ca3af",
                      fontWeight: 600,
                    }}
                  >
                    <div
                      className={`sv-cal-day ${cls}`}
                      style={{
                        width: 14,
                        height: 14,
                        borderRadius: 4,
                        flexShrink: 0,
                      }}
                    />
                    {label}
                  </div>
                ))}
              </div>
            </div>

            {/* Log iteration feed */}
            <div className="sv-att-list">
              {attendance.length === 0 ? (
                <div className="sv-empty-att">
                  <div className="sv-empty-icon">📋</div>
                  <p
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      color: "#6b7280",
                      margin: 0,
                    }}
                  >
                    No attendance yet
                  </p>
                  <p style={{ fontSize: 12, margin: 0, textAlign: "center" }}>
                    Scan your QR code at the entrance to mark attendance
                  </p>
                </div>
              ) : (
                attendance.map((a, i) => (
                  <div
                    key={a.id}
                    className="sv-att-item"
                    style={{ animationDelay: `${Math.min(i * 0.04, 0.35)}s` }}
                  >
                    <div className="sv-att-av">
                      <div className="sv-att-checkmark">
                        <svg
                          width="10"
                          height="10"
                          fill="none"
                          stroke="#fff"
                          strokeWidth="2.5"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M4.5 12.75l6 6 9-13.5"
                          />
                        </svg>
                      </div>
                    </div>
                    <div>
                      <p className="sv-att-day">
                        {getWeekdayShort(a.timestamp)}, {formatDay(a.timestamp)}
                      </p>
                      <p className="sv-att-date">{shiftCfg.label} shift</p>
                    </div>
                    <span className="sv-att-time">
                      {formatTime(a.timestamp)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
