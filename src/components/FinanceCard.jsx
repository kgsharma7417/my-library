// src/components/FinanceCard.jsx
// Ye ek simple reusable card component hai
// Finance page par multiple stat cards hain (Revenue, Pending, Profit etc.)
// Har card ka sirf title, value, color aur icon alag hota hai
// Isliye ek reusable component banaya taaki baar baar same code na likhna pade

export default function FinanceCard({ title, value, color, icon, subtitle }) {
  return (
    <div
      style={{
        background: "white",
        borderRadius: "14px",
        padding: "20px 24px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.07)",
        borderTop: `4px solid ${color}`, // top border se card ka color pata chalta hai
        minWidth: "180px",
      }}
    >
      {/* Icon — emoji as visual indicator */}
      <div style={{ fontSize: "28px", marginBottom: "8px" }}>{icon}</div>

      {/* Main value — bada aur bold dikhta hai */}
      <div
        style={{
          fontSize: "26px",
          fontWeight: "800",
          color: color,
          lineHeight: 1,
        }}
      >
        {value}
      </div>

      {/* Title — card ka naam */}
      <div
        style={{
          color: "#374151",
          fontWeight: "600",
          fontSize: "14px",
          marginTop: "6px",
        }}
      >
        {title}
      </div>

      {/* Optional subtitle — extra info jaise "this month" */}
      {subtitle && (
        <div style={{ color: "#94a3b8", fontSize: "12px", marginTop: "2px" }}>
          {subtitle}
        </div>
      )}
    </div>
  );
}
