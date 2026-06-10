// src/pages/Dashboard.jsx
import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import SeatLayout from "../components/SeatLayout";

export default function Dashboard() {
  const [students, setStudents] = useState([]);
  const [filterShift, setFilterShift] = useState("all");

  useEffect(() => {
    const fetch = async () => {
      const snap = await getDocs(collection(db, "students"));
      setStudents(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    };
    fetch();
  }, []);

  const occupiedSeats = students.map((s) => s.seatNumber);
  const filtered =
    filterShift === "all"
      ? students
      : students.filter((s) => s.shift === filterShift);
  const shiftCount = (shift) =>
    students.filter((s) => s.shift === shift).length;

  return (
    <div style={{ maxWidth: "1000px", margin: "30px auto", padding: "0 16px" }}>
      <h2 style={{ color: "#1e293b" }}>📊 Library Dashboard</h2>

      {/* Stats Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "16px",
          margin: "20px 0",
        }}
      >
        <StatCard
          title="Total Students"
          value={students.length}
          color="#6366f1"
          icon="👥"
        />
        <StatCard
          title="Morning Shift"
          value={shiftCount("morning")}
          color="#f59e0b"
          icon="🌅"
        />
        <StatCard
          title="Evening Shift"
          value={shiftCount("evening")}
          color="#0ea5e9"
          icon="🌆"
        />
        <StatCard
          title="Full Day"
          value={shiftCount("fullday")}
          color="#22c55e"
          icon="🌞"
        />
        <StatCard
          title="Seats Free"
          value={30 - occupiedSeats.length}
          color="#ec4899"
          icon="🪑"
        />
      </div>

      {/* Seat Layout */}
      <div
        style={{
          background: "#f8fafc",
          borderRadius: "14px",
          padding: "24px",
          marginBottom: "28px",
        }}
      >
        <h3 style={{ margin: "0 0 16px", color: "#1e293b" }}>
          🗺️ Live Seat Map
        </h3>
        <SeatLayout totalSeats={30} occupiedSeats={occupiedSeats} />
      </div>

      {/* Student List with Shift Filter */}
      <div>
        <div
          style={{
            display: "flex",
            gap: "10px",
            marginBottom: "16px",
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <strong>Filter by Shift:</strong>
          {["all", "morning", "evening", "fullday"].map((s) => (
            <button
              key={s}
              onClick={() => setFilterShift(s)}
              style={{
                padding: "6px 16px",
                borderRadius: "20px",
                cursor: "pointer",
                border: "none",
                background: filterShift === s ? "#6366f1" : "#e2e8f0",
                color: filterShift === s ? "white" : "#374151",
                fontWeight: filterShift === s ? "bold" : "normal",
              }}
            >
              {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: "14px",
          }}
        >
          <thead>
            <tr style={{ background: "#1e293b", color: "white" }}>
              {["Name", "Phone", "Shift", "Seat", "End Date", "Status"].map(
                (h) => (
                  <th
                    key={h}
                    style={{ padding: "12px 16px", textAlign: "left" }}
                  >
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {filtered.map((s, i) => (
              <tr
                key={s.id}
                style={{ background: i % 2 === 0 ? "#f8fafc" : "white" }}
              >
                <td style={td}>{s.name}</td>
                <td style={td}>{s.phone}</td>
                <td style={td}>
                  <ShiftBadge shift={s.shift} />
                </td>
                <td style={td}>🪑 {s.seatNumber}</td>
                <td style={td}>{s.endDate || "—"}</td>
                <td style={td}>
                  <span
                    style={{
                      background: "#dcfce7",
                      color: "#16a34a",
                      padding: "3px 10px",
                      borderRadius: "12px",
                      fontSize: "12px",
                      fontWeight: "bold",
                    }}
                  >
                    Active
                  </span>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  style={{
                    padding: "24px",
                    textAlign: "center",
                    color: "#94a3b8",
                  }}
                >
                  No students found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const td = { padding: "12px 16px", borderBottom: "1px solid #f1f5f9" };

function StatCard({ title, value, color, icon }) {
  return (
    <div
      style={{
        background: "white",
        borderRadius: "12px",
        padding: "20px",
        boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
        borderTop: `4px solid ${color}`,
      }}
    >
      <div style={{ fontSize: "28px" }}>{icon}</div>
      <div style={{ fontSize: "28px", fontWeight: "bold", color }}>{value}</div>
      <div style={{ color: "#64748b", fontSize: "13px" }}>{title}</div>
    </div>
  );
}

function ShiftBadge({ shift }) {
  const map = {
    morning: ["🌅", "#fef3c7", "#92400e"],
    evening: ["🌆", "#e0f2fe", "#0369a1"],
    fullday: ["🌞", "#dcfce7", "#166534"],
  };
  const [icon, bg, color] = map[shift] || ["❓", "#f1f5f9", "#374151"];
  return (
    <span
      style={{
        background: bg,
        color,
        padding: "3px 10px",
        borderRadius: "12px",
        fontSize: "12px",
        fontWeight: "bold",
      }}
    >
      {icon} {shift}
    </span>
  );
}
