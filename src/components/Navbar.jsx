// src/components/Navbar.jsx
// Mobile par hamburger menu add kiya hai
// useState se menu open/close track hota hai
// window.innerWidth se screen size check hoti hai
// Responsive design — chhoti screen par links toggle hote hain

import { Link, useLocation } from "react-router-dom";
import { useState } from "react";

export default function Navbar() {
  const location = useLocation();
  // menuOpen = mobile par hamburger click hone par links show/hide
  const [menuOpen, setMenuOpen] = useState(false);

  const links = [
    { to: "/", label: "📊 Dashboard" },
    { to: "/add-student", label: "➕ Add" },
    { to: "/students", label: "👥 Students" },
    { to: "/attendance", label: "📷 Attendance" },
    { to: "/defaulters", label: "⚠️ Defaulters" },
    { to: "/finance", label: "💰 Finance" },
    { to: "/expenses", label: "💸 Expenses" },
    { to: "/reminders", label: "🔔 Reminders" }, // NEW
  ];

  return (
    <nav style={styles.nav}>
      <span style={styles.logo}>📚 LibraryPro</span>

      {/* Hamburger button — sirf mobile par dikhe */}
      {/* onClick se menuOpen toggle hota hai */}
      <button
        onClick={() => setMenuOpen(!menuOpen)}
        style={styles.hamburger}
        aria-label="Toggle menu"
      >
        {menuOpen ? "✕" : "☰"}
      </button>

      {/* Links container */}
      {/* Desktop par hamesha dikhe, mobile par sirf menuOpen true hone par */}
      <div
        style={{
          ...styles.links,
          // Mobile detection — 768px se chhota = mobile
          display: menuOpen ? "flex" : undefined,
        }}
        className="nav-links"
      >
        {links.map((link) => (
          <Link
            key={link.to}
            to={link.to}
            // Link click hone par menu band karo (mobile par useful)
            onClick={() => setMenuOpen(false)}
            style={{
              ...styles.link,
              color: location.pathname === link.to ? "white" : "#94a3b8",
              borderBottom:
                location.pathname === link.to
                  ? "2px solid #6366f1"
                  : "2px solid transparent",
            }}
          >
            {link.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}

const styles = {
  nav: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "12px 24px",
    background: "#1e293b",
    color: "white",
    flexWrap: "wrap",
    gap: "10px",
    position: "sticky",
    top: 0,
    zIndex: 100, // scroll karne par bhi upar rahe
  },
  logo: { fontSize: "20px", fontWeight: "bold" },
  links: { display: "flex", gap: "14px", flexWrap: "wrap" },
  link: { textDecoration: "none", fontSize: "13px", paddingBottom: "4px" },
  hamburger: {
    display: "none", // desktop par hide
    background: "none",
    border: "none",
    color: "white",
    fontSize: "22px",
    cursor: "pointer",
    padding: "4px",
  },
};
