// src/pages/Reminders.jsx
import { useEffect, useState, useMemo } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import dayjs from "dayjs";

// ── Skeleton Card ─────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div style={{ padding: "14px 0", borderBottom: "1px solid #f1f5f9" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
        }}
      >
        <div style={{ flex: 1 }}>
          <div
            className="rem-skeleton"
            style={{
              width: "40%",
              height: 16,
              borderRadius: 6,
              marginBottom: 8,
            }}
          />
          <div
            className="rem-skeleton"
            style={{ width: "65%", height: 12, borderRadius: 6 }}
          />
        </div>
        <div
          className="rem-skeleton"
          style={{ width: 130, height: 36, borderRadius: 10 }}
        />
      </div>
    </div>
  );
}

// ── Donut Chart (SVG) ─────────────────────────────────────────
function DonutChart({ data }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return null;

  let offset = 0;
  const r = 42,
    cx = 54,
    cy = 54,
    circ = 2 * Math.PI * r;

  return (
    <svg width="108" height="108" viewBox="0 0 108 108">
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke="#f1f5f9"
        strokeWidth="16"
      />
      {data.map((d, i) => {
        const pct = d.value / total;
        const dash = pct * circ;
        const gap = circ - dash;
        const rotation = offset * 360 - 90;
        offset += pct;
        return (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={d.color}
            strokeWidth="16"
            strokeDasharray={`${dash} ${gap}`}
            strokeDashoffset={0}
            transform={`rotate(${rotation} ${cx} ${cy})`}
            style={{ transition: "stroke-dasharray 0.6s ease" }}
          />
        );
      })}
      <text
        x={cx}
        y={cy - 6}
        textAnchor="middle"
        fontSize="18"
        fontWeight="800"
        fill="#1e293b"
      >
        {total}
      </text>
      <text
        x={cx}
        y={cy + 12}
        textAnchor="middle"
        fontSize="9"
        fill="#94a3b8"
        fontWeight="600"
      >
        PENDING
      </text>
    </svg>
  );
}

export default function Reminders() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sent, setSent] = useState({});
  const [renewed, setRenewed] = useState({});
  const [contacted, setContacted] = useState({});
  const [search, setSearch] = useState("");
  const [bulkSending, setBulkSending] = useState(null);
  const [toast, setToast] = useState(null);
  const [mounted, setMounted] = useState(false);

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  useEffect(() => {
    fetchStudents();
    setTimeout(() => setMounted(true), 60);
  }, []);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchStudents = async () => {
    const snap = await getDocs(collection(db, "students"));
    setStudents(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    setLoading(false);
  };

  const today = dayjs();

  const filterBySearch = (list) => {
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter(
      (s) =>
        s.name?.toLowerCase().includes(q) ||
        s.phone?.includes(q) ||
        String(s.seatNumber).includes(q),
    );
  };

  const expireIn3Days = useMemo(
    () =>
      students.filter((s) => {
        if (!s.endDate || renewed[s.id]) return false;
        return dayjs(s.endDate).diff(today, "day") === 3;
      }),
    [students, renewed],
  );

  const expireIn1Day = useMemo(
    () =>
      students.filter((s) => {
        if (!s.endDate || renewed[s.id]) return false;
        return dayjs(s.endDate).diff(today, "day") === 1;
      }),
    [students, renewed],
  );

  const expireToday = useMemo(
    () =>
      students.filter((s) => {
        if (!s.endDate || renewed[s.id]) return false;
        const diff = dayjs(s.endDate).diff(today, "day");
        return diff === 0 || diff === -1;
      }),
    [students, renewed],
  );

  const totalPending =
    expireIn3Days.length + expireIn1Day.length + expireToday.length;

  const buildMsg = (student, type) => {
    if (type === "3days")
      return `Hello ${student.name}! 📚\n\nLibraryPro reminder: Aapki library membership *3 din mein expire hone wali hai* (${student.endDate}).\n\nKripya jald renew karein taaki aapki seat (No. ${student.seatNumber}) safe rahe.\n\nDhanyawaad! 🙏`;
    if (type === "1day")
      return `Hello ${student.name}! ⚠️\n\n*Urgent Reminder:* Aapki library membership *kal expire ho rahi hai* (${student.endDate}).\n\nAaj hi renew karein — seat No. ${student.seatNumber} hold hai abhi tak.\n\nLibraryPro 📚`;
    return `Hello ${student.name}! 🚨\n\n*Final Alert:* Aapki library membership *aaj expire ho rahi hai*.\n\nRenew na karne par aapka access block ho jayega aur seat No. ${student.seatNumber} release kar di jayegi.\n\nAbhi contact karein. — LibraryPro 📚`;
  };

  const sendWhatsApp = (student, type) => {
    const msg = encodeURIComponent(buildMsg(student, type));
    window.open(`https://wa.me/91${student.phone}?text=${msg}`, "_blank");
    setSent((prev) => ({ ...prev, [student.id + type]: true }));
  };

  const handleBulkSend = async (list, type) => {
    setBulkSending(type);
    for (let i = 0; i < list.length; i++) {
      setTimeout(() => {
        const msg = encodeURIComponent(buildMsg(list[i], type));
        window.open(`https://wa.me/91${list[i].phone}?text=${msg}`, "_blank");
        setSent((prev) => ({ ...prev, [list[i].id + type]: true }));
      }, i * 800);
    }
    setTimeout(() => {
      setBulkSending(null);
      showToast(`${list.length} messages bheje gaye!`);
    }, list.length * 800);
  };

  const exportCSV = () => {
    const all = [
      ...expireIn3Days.map((s) => ({ ...s, bucket: "3 Din Mein" })),
      ...expireIn1Day.map((s) => ({ ...s, bucket: "Kal Expire" })),
      ...expireToday.map((s) => ({ ...s, bucket: "Aaj Expire" })),
    ];
    const header = "Name,Phone,Seat,Shift,End Date,Category";
    const rows = all.map(
      (s) =>
        `${s.name},${s.phone},${s.seatNumber},${s.shift},${s.endDate},${s.bucket}`,
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `reminders_${dayjs().format("YYYY-MM-DD")}.csv`;
    a.click();
    showToast("CSV download ho gaya!");
  };

  // ── Section Component ─────────────────────────────────────────
  const ReminderSection = ({ title, color, bgColor, list, type, icon }) => {
    const filtered = filterBySearch(list);
    const allSent =
      filtered.length > 0 && filtered.every((s) => sent[s.id + type]);

    return (
      <div className="rem-card" style={{ borderTop: `4px solid ${color}` }}>
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 10,
            marginBottom: 16,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: bgColor,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 18,
              }}
            >
              {icon}
            </div>
            <div>
              <h3
                style={{
                  margin: 0,
                  color: "#1e293b",
                  fontSize: 15,
                  fontWeight: 800,
                }}
              >
                {title}
              </h3>
              <p style={{ margin: 0, fontSize: 12, color: "#94a3b8" }}>
                {filtered.length} student{filtered.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
          {filtered.length > 1 && (
            <button
              className="rem-bulk-btn"
              style={{ background: allSent ? "#94a3b8" : color }}
              onClick={() => !allSent && handleBulkSend(filtered, type)}
              disabled={allSent || bulkSending === type}
            >
              {bulkSending === type ? (
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span className="rem-spin" />
                  Sending…
                </span>
              ) : allSent ? (
                "✅ Sab Sent"
              ) : (
                `📲 Bulk Send (${filtered.length})`
              )}
            </button>
          )}
        </div>

        {filtered.length === 0 ? (
          <div
            style={{ textAlign: "center", padding: "24px 0", color: "#94a3b8" }}
          >
            <div style={{ fontSize: 28, marginBottom: 6 }}>✅</div>
            <p style={{ margin: 0, fontSize: 13 }}>
              {search
                ? "Search mein koi match nahi"
                : "Is category mein koi student nahi"}
            </p>
          </div>
        ) : (
          filtered.map((student, i) => {
            const wasSent = sent[student.id + type];
            const wasRenewed = renewed[student.id];
            const daysLeft = dayjs(student.endDate).diff(today, "day");

            return (
              <div
                key={student.id}
                className="rem-row"
                style={{
                  animationDelay: `${i * 0.04}s`,
                  opacity: wasRenewed ? 0.5 : 1,
                }}
              >
                {/* Avatar */}
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    flexShrink: 0,
                    background: bgColor,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 800,
                    fontSize: 16,
                    color: color,
                  }}
                >
                  {student.name?.charAt(0).toUpperCase()}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontWeight: 700,
                      fontSize: 14,
                      color: "#1e293b",
                      marginBottom: 3,
                    }}
                  >
                    {student.name}
                    {wasRenewed && (
                      <span
                        style={{
                          marginLeft: 8,
                          fontSize: 11,
                          background: "#dcfce7",
                          color: "#166534",
                          padding: "2px 8px",
                          borderRadius: 6,
                          fontWeight: 700,
                        }}
                      >
                        ✓ Renewed
                      </span>
                    )}
                  </div>
                  <div
                    style={{
                      color: "#64748b",
                      fontSize: 12,
                      display: "flex",
                      gap: 8,
                      flexWrap: "wrap",
                    }}
                  >
                    <span>📱 {student.phone}</span>
                    <span>🪑 Seat {student.seatNumber}</span>
                    <span
                      style={{
                        background:
                          daysLeft <= 0
                            ? "#fee2e2"
                            : daysLeft === 1
                              ? "#ffedd5"
                              : "#fef9c3",
                        color:
                          daysLeft <= 0
                            ? "#991b1b"
                            : daysLeft === 1
                              ? "#9a3412"
                              : "#854d0e",
                        padding: "1px 7px",
                        borderRadius: 6,
                        fontWeight: 700,
                      }}
                    >
                      {daysLeft <= 0 ? "Aaj/Overdue" : `${daysLeft}d left`}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  <button
                    title="Renewed mark karo"
                    onClick={() => {
                      setRenewed((p) => ({
                        ...p,
                        [student.id]: !p[student.id],
                      }));
                      showToast(
                        renewed[student.id]
                          ? "Renewed mark hataya"
                          : `${student.name} renewed mark kiya!`,
                      );
                    }}
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 9,
                      border: "1.5px solid",
                      borderColor: wasRenewed ? "#86efac" : "#e2e8f0",
                      background: wasRenewed ? "#dcfce7" : "#f8fafc",
                      color: wasRenewed ? "#16a34a" : "#94a3b8",
                      cursor: "pointer",
                      fontSize: 14,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      transition: "all 0.15s",
                    }}
                  >
                    ✓
                  </button>
                  <button
                    className="rem-wa-btn"
                    style={{ background: wasSent ? "#94a3b8" : "#25d366" }}
                    onClick={() => sendWhatsApp(student, type)}
                  >
                    {wasSent ? "✅ Sent" : "📲 Send"}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    );
  };

  return (
    <>
      <style>{`
        .rem-page {
          max-width: 920px;
          margin: 0 auto;
          padding: 28px 16px 56px;
          font-family: 'Inter', -apple-system, sans-serif;
          opacity: 0; transform: translateY(16px);
          transition: opacity 0.45s ease, transform 0.45s ease;
        }
        .rem-page.mounted { opacity: 1; transform: translateY(0); }

        .rem-card {
          background: #fff;
          border-radius: 18px;
          padding: 20px;
          box-shadow: 0 2px 16px rgba(0,0,0,0.06);
          margin-bottom: 20px;
          border: 1.5px solid #f1f5f9;
          animation: fadeUp 0.4s cubic-bezier(.22,1,.36,1) both;
        }

        .rem-row {
          display: flex; align-items: center; gap: 12px;
          padding: 11px 0; border-bottom: 1px solid #f8fafc;
          animation: fadeUp 0.35s cubic-bezier(.22,1,.36,1) both;
          transition: background 0.15s;
        }
        .rem-row:last-child { border-bottom: none; }
        .rem-row:hover { background: #fafbff; border-radius: 10px; padding-left: 6px; padding-right: 6px; }

        .rem-wa-btn {
          color: #fff; border: none;
          padding: 8px 14px; border-radius: 9px;
          font-size: 12px; font-weight: 700; cursor: pointer;
          transition: all 0.15s ease; white-space: nowrap;
          font-family: inherit;
        }
        .rem-wa-btn:hover { transform: translateY(-1px); filter: brightness(1.08); }

        .rem-bulk-btn {
          color: #fff; border: none;
          padding: 8px 16px; border-radius: 10px;
          font-size: 12px; font-weight: 700; cursor: pointer;
          transition: all 0.15s ease; font-family: inherit;
        }
        .rem-bulk-btn:hover:not(:disabled) { transform: translateY(-1px); filter: brightness(1.08); }
        .rem-bulk-btn:disabled { cursor: not-allowed; }

        .rem-skeleton {
          background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%);
          background-size: 200% 100%;
          animation: shimmer 1.4s infinite;
        }
        @keyframes shimmer {
          from { background-position: 200% 0; }
          to { background-position: -200% 0; }
        }

        .rem-spin {
          width: 12px; height: 12px; border-radius: 50%;
          border: 2px solid rgba(255,255,255,0.4);
          border-top-color: #fff;
          animation: spin 0.7s linear infinite;
          display: inline-block;
        }

        .rem-search {
          width: 100%; box-sizing: border-box;
          padding: 10px 12px 10px 38px;
          border: 1.5px solid #e2e8f0; border-radius: 12px;
          font-size: 14px; outline: none; font-family: inherit;
          background: #fafbff; color: #1e293b;
          transition: border-color 0.18s, box-shadow 0.18s;
        }
        .rem-search:focus { border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99,102,241,0.1); }

        .rem-toast {
          position: fixed; bottom: 24px; right: 24px; z-index: 999;
          padding: 12px 18px; border-radius: 12px;
          font-size: 13px; font-weight: 700;
          box-shadow: 0 8px 24px rgba(0,0,0,0.15);
          animation: slideUp 0.3s cubic-bezier(.22,1,.36,1);
          display: flex; align-items: center; gap: 8px;
        }

        @keyframes fadeUp {
          from { opacity:0; transform:translateY(12px); }
          to { opacity:1; transform:translateY(0); }
        }
        @keyframes slideUp {
          from { opacity:0; transform:translateY(16px); }
          to { opacity:1; transform:translateY(0); }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes countUp {
          from { opacity:0; transform: scale(0.8); }
          to { opacity:1; transform: scale(1); }
        }
      `}</style>

      <div className={`rem-page${mounted ? " mounted" : ""}`}>
        {/* Toast */}
        {toast && (
          <div
            className="rem-toast"
            style={{
              background: toast.type === "error" ? "#fee2e2" : "#ecfdf5",
              color: toast.type === "error" ? "#991b1b" : "#065f46",
              border: `1.5px solid ${toast.type === "error" ? "#fca5a5" : "#a7f3d0"}`,
            }}
          >
            {toast.type === "error" ? "❌" : "✅"} {toast.msg}
          </div>
        )}

        {/* Header */}
        <div style={{ marginBottom: 24, animation: "fadeUp 0.4s ease both" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 12,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: 14,
                  background: "linear-gradient(135deg, #f59e0b, #d97706)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 22,
                  boxShadow: "0 4px 14px rgba(245,158,11,0.3)",
                }}
              >
                🔔
              </div>
              <div>
                <h2
                  style={{
                    margin: 0,
                    fontSize: 22,
                    fontWeight: 800,
                    color: "#1e1b4b",
                    letterSpacing: "-0.4px",
                  }}
                >
                  Reminder Center
                </h2>
                <p style={{ margin: 0, fontSize: 13, color: "#94a3b8" }}>
                  {greeting}!{" "}
                  {totalPending > 0
                    ? `${totalPending} urgent reminders hain aaj`
                    : "Sab clear hai aaj 🎉"}
                </p>
              </div>
            </div>
            <button
              onClick={exportCSV}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 7,
                padding: "9px 16px",
                borderRadius: 11,
                background: "#fff",
                border: "1.5px solid #e2e8f0",
                fontSize: 13,
                fontWeight: 700,
                color: "#475569",
                cursor: "pointer",
                transition: "all 0.15s ease",
                fontFamily: "inherit",
              }}
              onMouseOver={(e) =>
                (e.currentTarget.style.borderColor = "#6366f1")
              }
              onMouseOut={(e) =>
                (e.currentTarget.style.borderColor = "#e2e8f0")
              }
            >
              📥 Export CSV
            </button>
          </div>
        </div>

        {/* Summary Banner with Donut */}
        <div
          style={{
            background:
              totalPending > 0
                ? "linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)"
                : "linear-gradient(135deg, #064e3b, #065f46)",
            borderRadius: 20,
            padding: "20px 24px",
            color: "white",
            marginBottom: 24,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 16,
            boxShadow: "0 8px 32px rgba(99,102,241,0.2)",
            animation: "fadeUp 0.45s ease both",
          }}
        >
          <div>
            <div
              style={{
                fontSize: 36,
                fontWeight: 800,
                lineHeight: 1,
                animation: "countUp 0.5s ease both",
              }}
            >
              {totalPending}
            </div>
            <div style={{ fontSize: 14, opacity: 0.8, marginTop: 4 }}>
              Reminders Pending
            </div>
            <div
              style={{
                display: "flex",
                gap: 16,
                marginTop: 12,
                flexWrap: "wrap",
              }}
            >
              {[
                { label: "3 Din", val: expireIn3Days.length, color: "#fbbf24" },
                { label: "Kal", val: expireIn1Day.length, color: "#fb923c" },
                { label: "Aaj", val: expireToday.length, color: "#f87171" },
              ].map((s) => (
                <div
                  key={s.label}
                  style={{ display: "flex", alignItems: "center", gap: 6 }}
                >
                  <div
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 3,
                      background: s.color,
                    }}
                  />
                  <span style={{ fontSize: 13, opacity: 0.9 }}>
                    {s.val} {s.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
          {!loading && (
            <DonutChart
              data={[
                { value: expireIn3Days.length, color: "#fbbf24" },
                { value: expireIn1Day.length, color: "#fb923c" },
                { value: expireToday.length, color: "#f87171" },
              ]}
            />
          )}
        </div>

        {/* Search */}
        <div
          style={{
            position: "relative",
            marginBottom: 20,
            animation: "fadeUp 0.45s ease both",
          }}
        >
          <span
            style={{
              position: "absolute",
              left: 12,
              top: "50%",
              transform: "translateY(-50%)",
              color: "#94a3b8",
              fontSize: 15,
            }}
          >
            🔍
          </span>
          <input
            className="rem-search"
            placeholder="Search by naam, phone, ya seat…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              style={{
                position: "absolute",
                right: 12,
                top: "50%",
                transform: "translateY(-50%)",
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "#94a3b8",
                fontSize: 16,
              }}
            >
              ×
            </button>
          )}
        </div>

        {/* Sections */}
        {loading ? (
          <>
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="rem-card"
                style={{ borderTop: "4px solid #e2e8f0" }}
              >
                <div
                  className="rem-skeleton"
                  style={{
                    width: "30%",
                    height: 18,
                    borderRadius: 6,
                    marginBottom: 16,
                  }}
                />
                {[1, 2].map((k) => (
                  <SkeletonCard key={k} />
                ))}
              </div>
            ))}
          </>
        ) : (
          <>
            <ReminderSection
              title="3 Din Mein Expire"
              color="#f59e0b"
              bgColor="#fef9c3"
              list={expireIn3Days}
              type="3days"
              icon="🟡"
            />
            <ReminderSection
              title="Kal Expire Hoga"
              color="#f97316"
              bgColor="#ffedd5"
              list={expireIn1Day}
              type="1day"
              icon="🟠"
            />
            <ReminderSection
              title="Aaj Expire / Overdue"
              color="#ef4444"
              bgColor="#fee2e2"
              list={expireToday}
              type="today"
              icon="🔴"
            />
          </>
        )}

        {/* Footer stats */}
        {!loading && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 12,
              marginTop: 8,
              animation: "fadeUp 0.5s ease both",
            }}
          >
            {[
              {
                label: "Total Renewed (Session)",
                val: Object.values(renewed).filter(Boolean).length,
                color: "#10b981",
                bg: "#ecfdf5",
              },
              {
                label: "Messages Sent",
                val: Object.keys(sent).length,
                color: "#6366f1",
                bg: "#eef2ff",
              },
              {
                label: "Still Pending",
                val: Math.max(
                  0,
                  totalPending - Object.values(renewed).filter(Boolean).length,
                ),
                color: "#f59e0b",
                bg: "#fffbeb",
              },
            ].map((s) => (
              <div
                key={s.label}
                style={{
                  background: s.bg,
                  borderRadius: 14,
                  padding: "14px 16px",
                  border: `1.5px solid ${s.bg}`,
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: 24, fontWeight: 800, color: s.color }}>
                  {s.val}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: "#64748b",
                    fontWeight: 600,
                    marginTop: 2,
                  }}
                >
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
