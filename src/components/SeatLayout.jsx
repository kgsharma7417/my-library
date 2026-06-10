// src/components/SeatLayout.jsx

export default function SeatLayout({ totalSeats = 30, occupiedSeats = [] }) {
  return (
    <div>
      <div
        style={{
          display: "flex",
          gap: "12px",
          marginBottom: "16px",
          flexWrap: "wrap",
        }}
      >
        <LegendItem color="#22c55e" label="Available" />
        <LegendItem color="#ef4444" label="Occupied" />
        <LegendItem color="#f59e0b" label="Selected" />
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(6, 1fr)",
          gap: "10px",
          maxWidth: "400px",
        }}
      >
        {Array.from({ length: totalSeats }, (_, i) => {
          const seatNum = i + 1;
          const isOccupied = occupiedSeats.includes(seatNum);
          return (
            <div
              key={seatNum}
              style={{
                width: "52px",
                height: "52px",
                borderRadius: "8px",
                background: isOccupied ? "#fee2e2" : "#dcfce7",
                border: `2px solid ${isOccupied ? "#ef4444" : "#22c55e"}`,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "12px",
                fontWeight: "bold",
                color: isOccupied ? "#ef4444" : "#16a34a",
              }}
            >
              <span>🪑</span>
              <span>{seatNum}</span>
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: "14px", color: "#64748b", fontSize: "14px" }}>
        ✅ Available: {totalSeats - occupiedSeats.length} &nbsp;|&nbsp; ❌
        Occupied: {occupiedSeats.length} &nbsp;|&nbsp; 📊 Total: {totalSeats}
      </div>
    </div>
  );
}

function LegendItem({ color, label }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "6px",
        fontSize: "13px",
      }}
    >
      <div
        style={{
          width: "14px",
          height: "14px",
          borderRadius: "3px",
          background: color,
        }}
      />
      {label}
    </div>
  );
}
