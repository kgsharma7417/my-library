// src/pages/Students.jsx
import { useEffect, useState } from "react";
import { collection, getDocs, deleteDoc, doc } from "firebase/firestore";
import { db } from "../firebase";
import StudentQRCard from "../components/StudentQRCard";
import { useNavigate } from "react-router-dom";

const SHIFT_CONFIG = {
  morning: {
    label: "Morning",
    color: "#f59e0b",
    bg: "#fef3c7",
    text: "#92400e",
  },
  evening: {
    label: "Evening",
    color: "#3b82f6",
    bg: "#dbeafe",
    text: "#1e40af",
  },
  fullday: {
    label: "Full Day",
    color: "#8b5cf6",
    bg: "#ede9fe",
    text: "#5b21b6",
  },
};

export default function Students() {
  const navigate = useNavigate();
  const [students, setStudents] = useState([]);
  const [search, setSearch] = useState("");
  const [shiftFilter, setShiftFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState("grid"); // grid | list
  const [sortBy, setSortBy] = useState("name"); // name | seat | shift
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    fetchStudents();
    setTimeout(() => setMounted(true), 60);
  }, []);

  const fetchStudents = async () => {
    setLoading(true);
    const snapshot = await getDocs(collection(db, "students"));
    const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    setStudents(data);
    setLoading(false);
  };

  const filtered = students
    .filter((s) => {
      const matchSearch =
        s.name?.toLowerCase().includes(search.toLowerCase()) ||
        s.phone?.includes(search) ||
        String(s.seatNumber).includes(search);
      const matchShift = shiftFilter === "all" || s.shift === shiftFilter;
      return matchSearch && matchShift;
    })
    .sort((a, b) => {
      if (sortBy === "name") return (a.name || "").localeCompare(b.name || "");
      if (sortBy === "seat") return (a.seatNumber || 0) - (b.seatNumber || 0);
      if (sortBy === "shift")
        return (a.shift || "").localeCompare(b.shift || "");
      return 0;
    });

  const shiftCounts = {
    morning: students.filter((s) => s.shift === "morning").length,
    evening: students.filter((s) => s.shift === "evening").length,
    fullday: students.filter((s) => s.shift === "fullday").length,
  };

  return (
    <>
      <style>{`
        .st-page {
          min-height: 100vh;
          background: #f0f2f8;
          padding: 32px 16px 56px;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
          opacity: 0;
          transform: translateY(16px);
          transition: opacity 0.5s ease, transform 0.5s ease;
        }
        .st-page.mounted { opacity: 1; transform: translateY(0); }
        .st-wrap { max-width: 1120px; margin: 0 auto; }

        /* Header */
        .st-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 16px;
          margin-bottom: 28px;
        }
        .st-header-left { display: flex; align-items: center; gap: 14px; }
        .st-icon {
          width: 46px; height: 46px;
          border-radius: 14px;
          background: linear-gradient(135deg, #6366f1, #818cf8);
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 4px 16px rgba(99,102,241,0.32);
          flex-shrink: 0;
        }
        .st-icon svg { color: #fff; }
        .st-title { font-size: 22px; font-weight: 800; color: #1e1b4b; margin: 0 0 2px; letter-spacing: -0.4px; }
        .st-subtitle { font-size: 13px; color: #6b7280; margin: 0; }
        .st-add-btn {
          display: flex; align-items: center; gap: 8px;
          padding: 11px 20px;
          background: linear-gradient(135deg, #6366f1, #818cf8);
          color: #fff; border: none; border-radius: 12px;
          font-size: 14px; font-weight: 700; cursor: pointer;
          box-shadow: 0 4px 14px rgba(99,102,241,0.3);
          transition: all 0.18s ease;
          font-family: inherit;
        }
        .st-add-btn:hover { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(99,102,241,0.4); }
        .st-add-btn:active { transform: scale(0.97); }

        /* Stats Row */
        .st-stats {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
          margin-bottom: 24px;
        }
        @media(max-width: 640px) { .st-stats { grid-template-columns: repeat(2, 1fr); } }
        .st-stat {
          background: #fff;
          border: 1.5px solid #e5e7eb;
          border-radius: 16px;
          padding: 16px;
          display: flex; align-items: center; gap: 12px;
          transition: transform 0.18s ease, box-shadow 0.18s ease;
          animation: fadeUp 0.4s cubic-bezier(.22,1,.36,1) both;
        }
        .st-stat:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(99,102,241,0.1); }
        .st-stat-dot {
          width: 38px; height: 38px; border-radius: 11px;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0; font-size: 18px;
        }
        .st-stat-val { font-size: 22px; font-weight: 800; color: #1e1b4b; line-height: 1; }
        .st-stat-lbl { font-size: 11px; color: #9ca3af; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 2px; }

        /* Toolbar */
        .st-toolbar {
          background: #fff;
          border: 1.5px solid #e5e7eb;
          border-radius: 16px;
          padding: 14px 16px;
          margin-bottom: 20px;
          display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
          box-shadow: 0 2px 12px rgba(0,0,0,0.04);
        }
        .st-search-wrap { position: relative; flex: 1; min-width: 200px; }
        .st-search-icon {
          position: absolute; left: 11px; top: 50%; transform: translateY(-50%);
          color: #9ca3af; pointer-events: none; display: flex;
        }
        .st-search {
          width: 100%; box-sizing: border-box;
          padding: 9px 12px 9px 36px;
          border: 1.5px solid #e5e7eb; border-radius: 11px;
          font-size: 14px; color: #1e1b4b; background: #fafbff;
          outline: none; font-family: inherit;
          transition: border-color 0.18s, box-shadow 0.18s;
        }
        .st-search:focus { border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99,102,241,0.1); }
        .st-search::placeholder { color: #9ca3af; }

        .st-filters { display: flex; gap: 6px; flex-wrap: wrap; }
        .st-filter-chip {
          padding: 6px 13px; border-radius: 9px;
          font-size: 12px; font-weight: 700; cursor: pointer;
          border: 1.5px solid #e5e7eb; background: #f8fafc;
          color: #6b7280; transition: all 0.15s ease; white-space: nowrap;
          font-family: inherit;
        }
        .st-filter-chip:hover { border-color: #a5b4fc; color: #6366f1; background: #eef2ff; }
        .st-filter-chip.active { background: #6366f1; color: #fff; border-color: #6366f1; }

        .st-toolbar-right { display: flex; gap: 6px; align-items: center; }
        .st-sort {
          padding: 8px 12px; border: 1.5px solid #e5e7eb; border-radius: 11px;
          font-size: 13px; color: #6b7280; background: #f8fafc;
          outline: none; cursor: pointer; font-family: inherit;
          transition: border-color 0.18s;
        }
        .st-sort:focus { border-color: #6366f1; }

        .st-view-btn {
          width: 36px; height: 36px; border-radius: 9px;
          display: flex; align-items: center; justify-content: center;
          border: 1.5px solid #e5e7eb; background: #f8fafc; cursor: pointer;
          color: #6b7280; transition: all 0.15s ease;
        }
        .st-view-btn.active { background: #6366f1; color: #fff; border-color: #6366f1; }

        /* Grid */
        .st-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 16px;
        }
        .st-list { display: flex; flex-direction: column; gap: 8px; }

        /* Student Card */
        .st-card {
          background: #fff;
          border: 1.5px solid #e5e7eb;
          border-radius: 18px;
          padding: 20px;
          cursor: pointer;
          transition: all 0.22s cubic-bezier(.22,1,.36,1);
          animation: fadeUp 0.4s cubic-bezier(.22,1,.36,1) both;
          position: relative; overflow: hidden;
        }
        .st-card::before {
          content: '';
          position: absolute; top: 0; left: 0; right: 0; height: 3px;
          background: linear-gradient(90deg, #6366f1, #818cf8);
          transform: scaleX(0); transform-origin: left;
          transition: transform 0.25s ease;
        }
        .st-card:hover { transform: translateY(-3px); box-shadow: 0 12px 32px rgba(99,102,241,0.14); border-color: #c7d2fe; }
        .st-card:hover::before { transform: scaleX(1); }

        .st-card-list {
          background: #fff;
          border: 1.5px solid #e5e7eb;
          border-radius: 14px;
          padding: 14px 18px;
          cursor: pointer;
          display: flex; align-items: center; gap: 14px;
          transition: all 0.18s ease;
          animation: fadeUp 0.35s cubic-bezier(.22,1,.36,1) both;
        }
        .st-card-list:hover { border-color: #c7d2fe; background: #fafbff; transform: translateX(3px); }

        .st-avatar {
          width: 46px; height: 46px; border-radius: 14px;
          display: flex; align-items: center; justify-content: center;
          font-size: 18px; font-weight: 800; flex-shrink: 0;
          background: linear-gradient(135deg, #eef2ff, #e0e7ff);
          color: #6366f1;
        }
        .st-card-name { font-size: 15px; font-weight: 800; color: #1e1b4b; margin: 0 0 2px; }
        .st-card-phone { font-size: 12px; color: #9ca3af; margin: 0 0 10px; }
        .st-card-meta { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        .st-pill {
          font-size: 11px; font-weight: 700;
          padding: 3px 10px; border-radius: 7px;
        }
        .st-seat-badge {
          font-size: 11px; font-weight: 600; color: #6b7280;
          background: #f1f3f9; padding: 3px 9px; border-radius: 7px;
        }
        .st-fee-badge {
          font-size: 11px; font-weight: 700; color: #059669;
          background: #ecfdf5; padding: 3px 9px; border-radius: 7px;
          margin-left: auto;
        }
        .st-qr-preview {
          width: 48px; height: 48px; border-radius: 10px;
          background: #f8fafc; border: 1px solid #e5e7eb;
          overflow: hidden; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
        }
        .st-qr-preview img { width: 100%; height: 100%; object-fit: cover; }
        .st-arrow { color: #9ca3af; flex-shrink: 0; transition: transform 0.18s; }
        .st-card-list:hover .st-arrow { transform: translateX(4px); color: #6366f1; }

        /* Empty */
        .st-empty {
          grid-column: 1 / -1;
          display: flex; flex-direction: column; align-items: center; gap: 12px;
          padding: 60px 20px; color: #9ca3af;
        }
        .st-empty-icon {
          width: 60px; height: 60px; border-radius: 18px;
          background: #f1f3f9; display: flex; align-items: center; justify-content: center;
          font-size: 28px;
        }

        /* Loading */
        .st-loading {
          display: flex; flex-direction: column; align-items: center; gap: 14px;
          padding: 80px 20px;
        }
        .st-spinner {
          width: 40px; height: 40px; border-radius: 50%;
          border: 4px solid #e0e7ff; border-top-color: #6366f1;
          animation: spin 0.8s linear infinite;
        }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(14px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      <div className={`st-page${mounted ? " mounted" : ""}`}>
        <div className="st-wrap">
          {/* Header */}
          <div className="st-header">
            <div className="st-header-left">
              <div className="st-icon">
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
                    d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"
                  />
                </svg>
              </div>
              <div>
                <h1 className="st-title">Students</h1>
                <p className="st-subtitle">
                  {students.length} registered ·{" "}
                  {students.filter((s) => s.status !== "inactive").length}{" "}
                  active
                </p>
              </div>
            </div>
            <button
              className="st-add-btn"
              onClick={() => navigate("/add-student")}
            >
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
                  d="M12 4.5v15m7.5-7.5h-15"
                />
              </svg>
              Add Student
            </button>
          </div>

          {/* Stats */}
          <div className="st-stats">
            {[
              {
                emoji: "👥",
                val: students.length,
                lbl: "Total",
                bg: "#eef2ff",
                delay: "0s",
              },
              {
                emoji: "🌅",
                val: shiftCounts.morning,
                lbl: "Morning",
                bg: "#fef3c7",
                delay: "0.05s",
              },
              {
                emoji: "🌆",
                val: shiftCounts.evening,
                lbl: "Evening",
                bg: "#dbeafe",
                delay: "0.1s",
              },
              {
                emoji: "🌓",
                val: shiftCounts.fullday,
                lbl: "Full Day",
                bg: "#ede9fe",
                delay: "0.15s",
              },
            ].map((s) => (
              <div
                className="st-stat"
                key={s.lbl}
                style={{ animationDelay: s.delay }}
              >
                <div className="st-stat-dot" style={{ background: s.bg }}>
                  {s.emoji}
                </div>
                <div>
                  <div className="st-stat-val">{s.val}</div>
                  <div className="st-stat-lbl">{s.lbl}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Toolbar */}
          <div className="st-toolbar">
            <div className="st-search-wrap">
              <span className="st-search-icon">
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
                className="st-search"
                type="text"
                placeholder="Search by name, phone, or seat…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="st-filters">
              {["all", "morning", "evening", "fullday"].map((sh) => (
                <button
                  key={sh}
                  className={`st-filter-chip${shiftFilter === sh ? " active" : ""}`}
                  onClick={() => setShiftFilter(sh)}
                >
                  {sh === "all"
                    ? "All Shifts"
                    : sh.charAt(0).toUpperCase() + sh.slice(1)}
                </button>
              ))}
            </div>
            <div className="st-toolbar-right">
              <select
                className="st-sort"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
              >
                <option value="name">Sort: Name</option>
                <option value="seat">Sort: Seat</option>
                <option value="shift">Sort: Shift</option>
              </select>
              <button
                className={`st-view-btn${viewMode === "grid" ? " active" : ""}`}
                onClick={() => setViewMode("grid")}
                title="Grid view"
              >
                <svg
                  width="14"
                  height="14"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <rect x="3" y="3" width="7" height="7" rx="1" />
                  <rect x="14" y="3" width="7" height="7" rx="1" />
                  <rect x="3" y="14" width="7" height="7" rx="1" />
                  <rect x="14" y="14" width="7" height="7" rx="1" />
                </svg>
              </button>
              <button
                className={`st-view-btn${viewMode === "list" ? " active" : ""}`}
                onClick={() => setViewMode("list")}
                title="List view"
              >
                <svg
                  width="14"
                  height="14"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>
          </div>

          {/* Content */}
          {loading ? (
            <div className="st-loading">
              <div className="st-spinner" />
              <p style={{ color: "#9ca3af", fontSize: 14 }}>
                Loading students…
              </p>
            </div>
          ) : (
            <div className={viewMode === "grid" ? "st-grid" : "st-list"}>
              {filtered.length === 0 && (
                <div className="st-empty">
                  <div className="st-empty-icon">🔍</div>
                  <p
                    style={{ fontSize: 15, fontWeight: 700, color: "#6b7280" }}
                  >
                    No students found
                  </p>
                  <p style={{ fontSize: 13 }}>
                    Try adjusting your search or filters
                  </p>
                </div>
              )}
              {filtered.map((s, i) =>
                viewMode === "grid" ? (
                  <GridCard
                    key={s.id}
                    student={s}
                    delay={Math.min(i * 0.04, 0.3)}
                    onClick={() => navigate(`/students/${s.id}`)}
                  />
                ) : (
                  <ListCard
                    key={s.id}
                    student={s}
                    delay={Math.min(i * 0.03, 0.25)}
                    onClick={() => navigate(`/students/${s.id}`)}
                  />
                ),
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function GridCard({ student, delay, onClick }) {
  const cfg = SHIFT_CONFIG[student.shift] || {};
  return (
    <div
      className="st-card"
      style={{ animationDelay: `${delay}s` }}
      onClick={onClick}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          marginBottom: 12,
        }}
      >
        <div className="st-avatar">
          {student.name?.charAt(0)?.toUpperCase() || "?"}
        </div>
        {student.qrURL && (
          <div className="st-qr-preview">
            <img src={student.qrURL} alt="QR" />
          </div>
        )}
      </div>
      <p className="st-card-name">{student.name}</p>
      <p className="st-card-phone">{student.phone || "—"}</p>
      <div className="st-card-meta">
        {cfg.label && (
          <span
            className="st-pill"
            style={{ background: cfg.bg, color: cfg.text }}
          >
            {cfg.label}
          </span>
        )}
        <span className="st-seat-badge">Seat {student.seatNumber}</span>
        {student.feeAmount > 0 && (
          <span className="st-fee-badge">₹{student.feeAmount}</span>
        )}
      </div>
    </div>
  );
}

function ListCard({ student, delay, onClick }) {
  const cfg = SHIFT_CONFIG[student.shift] || {};
  return (
    <div
      className="st-card-list"
      style={{ animationDelay: `${delay}s` }}
      onClick={onClick}
    >
      <div className="st-avatar">
        {student.name?.charAt(0)?.toUpperCase() || "?"}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p className="st-card-name" style={{ marginBottom: 4 }}>
          {student.name}
        </p>
        <div className="st-card-meta">
          {cfg.label && (
            <span
              className="st-pill"
              style={{ background: cfg.bg, color: cfg.text }}
            >
              {cfg.label}
            </span>
          )}
          <span className="st-seat-badge">Seat {student.seatNumber}</span>
          <span style={{ fontSize: 12, color: "#9ca3af" }}>
            {student.phone}
          </span>
        </div>
      </div>
      {student.feeAmount > 0 && (
        <span className="st-fee-badge" style={{ marginLeft: 0 }}>
          ₹{student.feeAmount}
        </span>
      )}
      {student.qrURL && (
        <div className="st-qr-preview">
          <img src={student.qrURL} alt="QR" />
        </div>
      )}
      <span className="st-arrow">
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
            d="M8.25 4.5l7.5 7.5-7.5 7.5"
          />
        </svg>
      </span>
    </div>
  );
}
