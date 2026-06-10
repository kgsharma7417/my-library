// src/components/ShiftSelector.jsx
export default function ShiftSelector({ value, onChange }) {
  const shifts = [
    { id: "morning", label: "🌅 Morning", time: "6am – 12pm" },
    { id: "evening", label: "🌆 Evening", time: "12pm – 6pm" },
    { id: "fullday", label: "🌞 Full Day", time: "6am – 10pm" },
  ];

  return (
    <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
      {shifts.map((shift) => (
        <div
          key={shift.id}
          onClick={() => onChange(shift.id)}
          style={{
            padding: "12px 20px",
            borderRadius: "10px",
            cursor: "pointer",
            border:
              value === shift.id ? "2px solid #6366f1" : "2px solid #e2e8f0",
            background: value === shift.id ? "#eef2ff" : "#f8fafc",
            textAlign: "center",
            minWidth: "110px",
          }}
        >
          <div style={{ fontWeight: "bold" }}>{shift.label}</div>
          <div style={{ fontSize: "12px", color: "#64748b" }}>{shift.time}</div>
        </div>
      ))}
    </div>
  );
}
