// src/pages/Reminders.jsx
import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import { useNavigate } from "react-router-dom";

// ─── Helpers ───────────────────────────────────────────
function daysLeft(endDate) {
  if (!endDate) return null;
  return Math.ceil((new Date(endDate) - new Date()) / 86400000);
}

// Pre-made WhatsApp message templates
const TEMPLATES = {
  expired: (s, days) =>
    `Namaste ${s.name} ji! 🙏\n\nLibraryPro se yaad dilaana tha ki aapki library membership *${Math.abs(days)} din pehle expire* ho gayi hai.\n\n📅 Expiry date thi: *${s.endDate}*\n🪑 Aapki seat: *${s.seatNumber}*\n\nKripya jald se jald renewal karein warna seat kisi aur ko de di jayegi.\n\nShukriya! 📚`,

  expiringSoon: (s, days) =>
    `Namaste ${s.name} ji! 🔔\n\nAapki LibraryPro membership *${days} din mein expire* hone wali hai.\n\n📅 Expiry date: *${s.endDate}*\n🪑 Seat: *${s.seatNumber}*\n\nAbhi renew karein aur apni seat secure rakhen!\n\nShukriya! 📚`,

  custom: (s) =>
    `Namaste ${s.name} ji! 📚\n\nLibraryPro ki taraf se ek important notification hai.\nKripya library se sampark karein.\n\nShukriya!`,
};

const shiftColors = {
  morning: { bg: "#fef3c7", text: "#92400e", label: "Morning" },
  evening: { bg: "#dbeafe", text: "#1e40af", label: "Evening" },
  fullday: { bg: "#ede9fe", text: "#5b21b6", label: "Full Day" },
  afternoon: { bg: "#dcfce7", text: "#166534", label: "Afternoon" },
};

// ─── Main Component ────────────────────────────────────
export default function Reminders() {
  const navigate = useNavigate();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [activeGroup, setActiveGroup] = useState("expired"); // "expired" | "soon" | "all"
  const [sentSet, setSentSet] = useState(new Set()); // track karo kis ko message gaya

  // Custom message modal
  const [customModal, setCustomModal] = useState(null); // { student } | null
  const [customMsg, setCustomMsg] = useState("");

  useEffect(() => {
    fetchStudents();
  }, []);

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, "students"));
      setStudents(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
    setTimeout(() => setMounted(true), 60);
  };

  // ── Grouping Logic ─────────────────────────────────────
  const expired = students
    .filter((s) => {
      const d = daysLeft(s.endDate);
      return d !== null && d < 0;
    })
    .sort((a, b) => daysLeft(a.endDate) - daysLeft(b.endDate));

  const expiringSoon = students
    .filter((s) => {
      const d = daysLeft(s.endDate);
      return d !== null && d >= 0 && d <= 7;
    })
    .sort((a, b) => daysLeft(a.endDate) - daysLeft(b.endDate));

  const allDue = [...expired, ...expiringSoon];

  const displayList =
    activeGroup === "expired"
      ? expired
      : activeGroup === "soon"
        ? expiringSoon
        : allDue;

  // ── Send WhatsApp ──────────────────────────────────────
  const sendWhatsApp = (student, templateType = null) => {
    const days = daysLeft(student.endDate);
    const type = templateType || (days < 0 ? "expired" : "expiringSoon");
    const msg = encodeURIComponent(TEMPLATES[type](student, days));
    window.open(`https://wa.me/91${student.phone}?text=${msg}`, "_blank");
    setSentSet((prev) => new Set(prev).add(student.id));
  };

  const sendCustom = () => {
    if (!customModal || !customMsg.trim()) return;
    const msg = encodeURIComponent(customMsg);
    window.open(`https://wa.me/91${customModal.phone}?text=${msg}`, "_blank");
    setSentSet((prev) => new Set(prev).add(customModal.id));
    setCustomModal(null);
    setCustomMsg("");
  };

  // Bulk send — saare ek ek karke open karo (1 second gap)
  const bulkSend = () => {
    if (
      !window.confirm(
        `${displayList.length} students ko WhatsApp message bhejoge?`,
      )
    )
      return;
    displayList.forEach((s, i) => {
      setTimeout(() => sendWhatsApp(s), i * 1200);
    });
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
            Loading reminders…
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
        .rem-page {
          min-height: 100vh;
          background: #f0f2f8;
          padding: 28px 16px 60px;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
          opacity: 0; transform: translateY(14px);
          transition: opacity 0.45s ease, transform 0.45s ease;
        }
        .rem-page.mounted { opacity: 1; transform: translateY(0); }
        .rem-wrap { max-width: 840px; margin: 0 auto; }

        /* Header */
        .rem-header { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; margin-bottom: 22px; }
        .rem-header-left { display: flex; align-items: center; gap: 13px; }
        .rem-icon { width: 46px; height: 46px; border-radius: 14px; background: linear-gradient(135deg, #f59e0b, #fbbf24); display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 14px rgba(245,158,11,0.35); flex-shrink: 0; }
        .rem-title { font-size: 22px; font-weight: 800; color: #1e1b4b; margin: 0 0 2px; letter-spacing: -0.4px; }
        .rem-sub { font-size: 13px; color: #6b7280; margin: 0; }

        /* Summary pills */
        .rem-pills { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 20px; }
        .rem-pill { display: flex; align-items: center; gap: 8px; padding: 10px 16px; border-radius: 14px; font-size: 13px; font-weight: 700; border: 1.5px solid; transition: all 0.2s ease; cursor: pointer; }

        /* Tabs */
        .rem-tabs { display: flex; gap: 4px; background: #fff; border: 1.5px solid #e5e7eb; border-radius: 16px; padding: 5px; margin-bottom: 18px; box-shadow: 0 2px 10px rgba(0,0,0,0.04); }
        .rem-tab { flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px; padding: 10px 8px; border-radius: 11px; font-size: 13px; font-weight: 700; cursor: pointer; border: none; transition: all 0.2s; font-family: inherit; color: #6b7280; background: transparent; }
        .rem-tab.active { background: linear-gradient(135deg, #f59e0b, #fbbf24); color: #fff; box-shadow: 0 3px 10px rgba(245,158,11,0.3); }
        .rem-tab:not(.active):hover { background: #fffbeb; color: #d97706; }
        .rem-badge { font-size: 10px; font-weight: 800; padding: 1px 6px; border-radius: 6px; }
        .rem-tab.active .rem-badge { background: rgba(255,255,255,0.3); color: #fff; }
        .rem-tab:not(.active) .rem-badge { background: #fee2e2; color: #ef4444; }

        /* Panel */
        .rem-panel { background: #fff; border: 1.5px solid #e5e7eb; border-radius: 20px; overflow: hidden; box-shadow: 0 2px 16px rgba(0,0,0,0.04); animation: fadeUp 0.3s cubic-bezier(.22,1,.36,1); }
        .rem-panel-head { padding: 18px 20px; border-bottom: 1.5px solid #f1f3f9; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; }
        .rem-panel-title { font-size: 14px; font-weight: 800; color: #1e1b4b; margin: 0 0 2px; }
        .rem-panel-sub { font-size: 12px; color: #9ca3af; margin: 0; }

        /* Student card */
        .rem-card { margin: 12px 16px; border-radius: 16px; border: 1.5px solid #e5e7eb; overflow: hidden; transition: box-shadow 0.2s; animation: fadeUp 0.35s cubic-bezier(.22,1,.36,1) both; }
        .rem-card:hover { box-shadow: 0 6px 20px rgba(0,0,0,0.08); }
        .rem-card-top { display: flex; align-items: center; gap: 12px; padding: 14px 16px; }
        .rem-av { width: 42px; height: 42px; border-radius: 13px; display: flex; align-items: center; justify-content: center; font-size: 17px; font-weight: 800; flex-shrink: 0; }
        .rem-card-bottom { padding: 0 16px 14px; display: flex; gap: 8px; flex-wrap: wrap; }

        /* Buttons */
        .rem-btn { display: flex; align-items: center; gap: 6px; padding: 9px 16px; border-radius: 12px; font-size: 13px; font-weight: 700; border: none; cursor: pointer; font-family: inherit; transition: all 0.18s ease; }
        .rem-btn:hover { transform: translateY(-1px); }
        .rem-btn:active { transform: scale(0.97); }

        /* Bulk button */
        .rem-bulk { display: flex; align-items: center; gap: 8px; padding: 11px 20px; border-radius: 14px; font-size: 13px; font-weight: 800; border: none; cursor: pointer; font-family: inherit; background: linear-gradient(135deg, #25d366, #128c7e); color: white; box-shadow: 0 4px 14px rgba(37,211,102,0.3); transition: all 0.2s ease; }
        .rem-bulk:hover { transform: translateY(-1px); box-shadow: 0 6px 18px rgba(37,211,102,0.4); }
        .rem-bulk:active { transform: scale(0.97); }

        /* Empty */
        .rem-empty { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 60px 20px; color: #9ca3af; }

        /* Sent chip */
        .rem-sent { display: flex; align-items: center; gap: 4px; font-size: 11px; font-weight: 700; color: #10b981; background: #ecfdf5; padding: 4px 10px; border-radius: 8px; border: 1px solid #a7f3d0; }

        /* Modal overlay */
        .rem-overlay { position: fixed; inset: 0; z-index: 50; display: flex; align-items: flex-end; justify-content: center; padding: 16px; background: rgba(15,23,42,0.5); animation: fadeIn 0.2s ease; }
        @media (min-width: 640px) { .rem-overlay { align-items: center; } }
        .rem-modal { background: #fff; border-radius: 24px; width: 100%; max-width: 480px; overflow: hidden; animation: scaleIn 0.25s cubic-bezier(.22,1,.36,1); }

        @keyframes fadeUp   { from { opacity:0; transform:translateY(12px) } to { opacity:1; transform:translateY(0) } }
        @keyframes fadeIn   { from { opacity:0 } to { opacity:1 } }
        @keyframes scaleIn  { from { opacity:0; transform:scale(0.95) } to { opacity:1; transform:scale(1) } }
        @keyframes spin     { to { transform: rotate(360deg); } }
      `}</style>

      <div className={`rem-page${mounted ? " mounted" : ""}`}>
        <div className="rem-wrap">
          {/* ── Header ── */}
          <div className="rem-header">
            <div className="rem-header-left">
              <div className="rem-icon">
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
                    d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
                  />
                </svg>
              </div>
              <div>
                <h1 className="rem-title">Reminders</h1>
                <p className="rem-sub">WhatsApp se fee reminders bhejo</p>
              </div>
            </div>

            {/* Bulk Send button */}
            {displayList.length > 0 && (
              <button className="rem-bulk" onClick={bulkSend}>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
                  <path d="M12 0C5.373 0 0 5.373 0 12c0 2.124.554 4.118 1.525 5.847L.057 23.57a.75.75 0 00.918.919l5.82-1.488A11.948 11.948 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22.5a10.46 10.46 0 01-5.399-1.497l-.386-.228-4.003 1.024 1.053-3.9-.252-.4A10.463 10.463 0 011.5 12C1.5 6.21 6.21 1.5 12 1.5S22.5 6.21 22.5 12 17.79 22.5 12 22.5z" />
                </svg>
                Sabko Message Bhejo ({displayList.length})
              </button>
            )}
          </div>

          {/* ── Summary Pills ── */}
          <div className="rem-pills">
            <div
              className="rem-pill"
              style={{
                background: "#fef2f2",
                borderColor: "#fecaca",
                color: "#991b1b",
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: "#ef4444",
                  display: "inline-block",
                }}
              />
              <span>{expired.length} Expired</span>
            </div>
            <div
              className="rem-pill"
              style={{
                background: "#fffbeb",
                borderColor: "#fde68a",
                color: "#92400e",
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: "#f59e0b",
                  display: "inline-block",
                  animation: "pulse 1.5s infinite",
                }}
              />
              <span>{expiringSoon.length} Expiring in 7 days</span>
            </div>
            <div
              className="rem-pill"
              style={{
                background: "#ecfdf5",
                borderColor: "#a7f3d0",
                color: "#065f46",
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: "#10b981",
                  display: "inline-block",
                }}
              />
              <span>{sentSet.size} Messages sent today</span>
            </div>
          </div>

          {/* ── Tabs ── */}
          <div className="rem-tabs">
            {[
              {
                id: "expired",
                label: "Expired",
                icon: "🔴",
                badge: expired.length,
              },
              {
                id: "soon",
                label: "Expiring Soon",
                icon: "🟡",
                badge: expiringSoon.length,
              },
              { id: "all", label: "All Due", icon: "📋", badge: allDue.length },
            ].map((tab) => (
              <button
                key={tab.id}
                className={`rem-tab${activeGroup === tab.id ? " active" : ""}`}
                onClick={() => setActiveGroup(tab.id)}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
                {tab.badge > 0 && (
                  <span className="rem-badge">{tab.badge}</span>
                )}
              </button>
            ))}
          </div>

          {/* ── Panel ── */}
          <div className="rem-panel">
            <div className="rem-panel-head">
              <div>
                <p className="rem-panel-title">
                  {activeGroup === "expired"
                    ? "Expired Students"
                    : activeGroup === "soon"
                      ? "7 Din Mein Expire"
                      : "Saare Due Students"}
                </p>
                <p className="rem-panel-sub">
                  {displayList.length} students · Click karo aur WhatsApp
                  message bhejo
                </p>
              </div>
            </div>

            {displayList.length === 0 ? (
              <div className="rem-empty">
                <span style={{ fontSize: 44 }}>🎉</span>
                <p style={{ fontSize: 15, fontWeight: 700, color: "#065f46" }}>
                  {activeGroup === "expired"
                    ? "Koi expired student nahi!"
                    : activeGroup === "soon"
                      ? "Koi jald expire nahi ho raha!"
                      : "Sab students up-to-date hain!"}
                </p>
                <p style={{ fontSize: 13 }}>
                  Filhaal koi reminder bhejne ki zaroorat nahi.
                </p>
              </div>
            ) : (
              <div style={{ padding: "8px 0 8px" }}>
                {displayList.map((s, i) => {
                  const left = daysLeft(s.endDate);
                  const isExp = left < 0;
                  const shift = shiftColors[s.shift] || shiftColors.morning;
                  const wasSent = sentSet.has(s.id);

                  return (
                    <div
                      key={s.id}
                      className="rem-card"
                      style={{
                        animationDelay: `${Math.min(i * 0.04, 0.3)}s`,
                        borderColor: isExp ? "#fecaca" : "#fde68a",
                        background: isExp ? "#fffafa" : "#fffdf7",
                      }}
                    >
                      {/* Top row */}
                      <div className="rem-card-top">
                        <div
                          className="rem-av"
                          style={{
                            background: isExp ? "#fee2e2" : "#fef3c7",
                            color: isExp ? "#ef4444" : "#d97706",
                          }}
                        >
                          {s.name?.charAt(0)?.toUpperCase() || "?"}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                              flexWrap: "wrap",
                            }}
                          >
                            <p
                              style={{
                                fontSize: 14,
                                fontWeight: 700,
                                color: "#1e1b4b",
                                margin: 0,
                              }}
                            >
                              {s.name}
                            </p>
                            {wasSent && (
                              <span className="rem-sent">
                                <svg
                                  width="10"
                                  height="10"
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
                                Sent
                              </span>
                            )}
                          </div>
                          <div
                            style={{
                              display: "flex",
                              gap: 8,
                              alignItems: "center",
                              marginTop: 5,
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
                            <span
                              style={{
                                fontSize: 11,
                                color: "#6b7280",
                                fontWeight: 600,
                              }}
                            >
                              📱 {s.phone}
                            </span>
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 800,
                                padding: "2px 10px",
                                borderRadius: 8,
                                background: isExp ? "#fee2e2" : "#fef3c7",
                                color: isExp ? "#991b1b" : "#92400e",
                              }}
                            >
                              {isExp
                                ? `${Math.abs(left)}d overdue`
                                : `${left}d left`}
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
                              margin: "0 0 2px",
                            }}
                          >
                            ₹{Number(s.feeAmount).toLocaleString("en-IN")}
                          </p>
                          <p
                            style={{
                              fontSize: 11,
                              color: "#9ca3af",
                              margin: 0,
                            }}
                          >
                            {s.endDate}
                          </p>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="rem-card-bottom">
                        {/* Quick WhatsApp — template auto-select */}
                        <button
                          className="rem-btn"
                          onClick={() => sendWhatsApp(s)}
                          style={{
                            background: "#25d366",
                            color: "#fff",
                            flex: 1,
                            justifyContent: "center",
                          }}
                        >
                          <svg
                            width="15"
                            height="15"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                          >
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
                            <path d="M12 0C5.373 0 0 5.373 0 12c0 2.124.554 4.118 1.525 5.847L.057 23.57a.75.75 0 00.918.919l5.82-1.488A11.948 11.948 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22.5a10.46 10.46 0 01-5.399-1.497l-.386-.228-4.003 1.024 1.053-3.9-.252-.4A10.463 10.463 0 011.5 12C1.5 6.21 6.21 1.5 12 1.5S22.5 6.21 22.5 12 17.79 22.5 12 22.5z" />
                          </svg>
                          WhatsApp Reminder
                        </button>

                        {/* Custom message */}
                        <button
                          className="rem-btn"
                          onClick={() => {
                            setCustomModal(s);
                            setCustomMsg(TEMPLATES.custom(s));
                          }}
                          style={{
                            background: "#eef2ff",
                            color: "#6366f1",
                            border: "1.5px solid #c7d2fe",
                          }}
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
                              d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z"
                            />
                          </svg>
                          Custom
                        </button>

                        {/* Profile link */}
                        <button
                          className="rem-btn"
                          onClick={() => navigate(`/students/${s.id}`)}
                          style={{
                            background: "#f8fafc",
                            color: "#64748b",
                            border: "1.5px solid #e2e8f0",
                          }}
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
                              d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
                            />
                          </svg>
                          Profile
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Message Templates Info ── */}
          <div
            style={{
              marginTop: 20,
              background: "#fff",
              border: "1.5px solid #e5e7eb",
              borderRadius: 16,
              padding: 20,
            }}
          >
            <p
              style={{
                fontSize: 13,
                fontWeight: 800,
                color: "#1e1b4b",
                margin: "0 0 12px",
              }}
            >
              📝 Auto Message Templates
            </p>
            <div style={{ display: "grid", gap: 10 }}>
              {[
                {
                  label: "🔴 Expired Student",
                  desc: "Kitne din se expire hua, seat jaane ki warning, jaldi renew karo",
                },
                {
                  label: "🟡 Expiring Soon",
                  desc: "Kitne din bacha hai, seat secure karne ka request",
                },
              ].map((t) => (
                <div
                  key={t.label}
                  style={{
                    background: "#f8fafc",
                    borderRadius: 10,
                    padding: "10px 14px",
                    display: "flex",
                    gap: 10,
                    alignItems: "flex-start",
                  }}
                >
                  <p
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: "#374151",
                      margin: 0,
                      flexShrink: 0,
                    }}
                  >
                    {t.label}
                  </p>
                  <p style={{ fontSize: 12, color: "#9ca3af", margin: 0 }}>
                    {t.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Custom Message Modal ── */}
      {customModal && (
        <div
          className="rem-overlay"
          onClick={(e) => e.target === e.currentTarget && setCustomModal(null)}
        >
          <div className="rem-modal">
            <div
              style={{
                padding: "20px 20px 16px",
                borderBottom: "1.5px solid #f1f3f9",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    background: "#fef3c7",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 18,
                    fontWeight: 800,
                    color: "#d97706",
                    flexShrink: 0,
                  }}
                >
                  {customModal.name?.charAt(0)?.toUpperCase()}
                </div>
                <div>
                  <p
                    style={{
                      fontSize: 14,
                      fontWeight: 800,
                      color: "#1e1b4b",
                      margin: "0 0 2px",
                    }}
                  >
                    {customModal.name}
                  </p>
                  <p style={{ fontSize: 12, color: "#9ca3af", margin: 0 }}>
                    📱 +91 {customModal.phone}
                  </p>
                </div>
              </div>
            </div>

            <div style={{ padding: 20 }}>
              <label
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#6b7280",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                  display: "block",
                  marginBottom: 8,
                }}
              >
                Message Edit Karo
              </label>
              <textarea
                value={customMsg}
                onChange={(e) => setCustomMsg(e.target.value)}
                rows={8}
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  borderRadius: 14,
                  border: "1.5px solid #e5e7eb",
                  fontSize: 13,
                  fontFamily: "inherit",
                  color: "#374151",
                  outline: "none",
                  resize: "vertical",
                  boxSizing: "border-box",
                  lineHeight: 1.6,
                }}
              />
              <p style={{ fontSize: 11, color: "#9ca3af", margin: "6px 0 0" }}>
                {customMsg.length} characters
              </p>
            </div>

            <div style={{ padding: "0 20px 20px", display: "flex", gap: 10 }}>
              <button
                onClick={() => {
                  setCustomModal(null);
                  setCustomMsg("");
                }}
                style={{
                  flex: 1,
                  padding: "12px",
                  borderRadius: 14,
                  border: "1.5px solid #e5e7eb",
                  background: "#f8fafc",
                  fontSize: 14,
                  fontWeight: 700,
                  color: "#64748b",
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                Cancel
              </button>
              <button
                onClick={sendCustom}
                style={{
                  flex: 1,
                  padding: "12px",
                  borderRadius: 14,
                  border: "none",
                  background: "#25d366",
                  fontSize: 14,
                  fontWeight: 700,
                  color: "#fff",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
                  <path d="M12 0C5.373 0 0 5.373 0 12c0 2.124.554 4.118 1.525 5.847L.057 23.57a.75.75 0 00.918.919l5.82-1.488A11.948 11.948 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22.5 10.46 10.46 10.46 0 01-5.399-1.497l-.386-.228-4.003 1.024 1.053-3.9-.252-.4A10.463 10.463 0 011.5 12C1.5 6.21 6.21 1.5 12 1.5S22.5 6.21 22.5 12 17.79 22.5 12 22.5z" />
                </svg>
                WhatsApp Bhejo
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
