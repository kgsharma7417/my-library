// src/components/StudentQRCard.jsx
import { QRCodeSVG } from "qrcode.react";

// Har student ka ek digital card hota hai
// QRCodeSVG component student ki Firebase ID ko
// ek unique QR code image mein convert karta hai
// Jab scanner is QR ko padhe, toh student ka ID milta hai
// Aur us ID se Firebase mein attendance save hoti hai

export default function StudentQRCard({ student }) {
  return (
    <div
      style={{
        background: "white",
        borderRadius: "14px",
        padding: "20px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
        textAlign: "center",
        width: "200px",
      }}
    >
      {/* Student ka naam aur shift */}
      <div
        style={{ fontWeight: "bold", fontSize: "15px", marginBottom: "4px" }}
      >
        {student.name}
      </div>
      <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "12px" }}>
        🪑 Seat {student.seatNumber} &nbsp;|&nbsp;
        {student.shift === "morning"
          ? "🌅"
          : student.shift === "evening"
            ? "🌆"
            : "🌞"}{" "}
        {student.shift}
      </div>

      {/* QRCodeSVG — student.id Firebase ka unique document ID hai */}
      {/* Scanner jab ise scan kare, exact same ID return hoti hai */}
      <QRCodeSVG
        value={student.id} // Firebase document ID as QR data
        size={140}
        bgColor="#ffffff"
        fgColor="#1e293b"
        level="M" // Error correction level (Medium)
      />

      <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "8px" }}>
        ID: {student.id.slice(0, 8)}...
      </div>
    </div>
  );
}
