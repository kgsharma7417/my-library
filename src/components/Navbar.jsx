// src/components/Navbar.jsx
// Premium design with:
// - Glassmorphism effect (backdrop blur)
// - Smooth hover animations
// - Active link indicator with slide animation
// - Mobile hamburger with smooth slide-down menu
// - Gradient logo text

import { Link, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";

export default function Navbar() {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  // Scroll hone par navbar ka shadow badhe
  const [scrolled, setScrolled] = useState(false);

  // Window scroll detect karna
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
    // cleanup — component unmount hone par event listener hatao
  }, []);

  const links = [
    { to: "/", label: "Dashboard", icon: "📊" },
    { to: "/add-student", label: "Add Student", icon: "➕" },
    { to: "/students", label: "Students", icon: "👥" },
    { to: "/attendance", label: "Attendance", icon: "📷" },
    { to: "/defaulters", label: "Defaulters", icon: "⚠️" },
    { to: "/finance", label: "Finance", icon: "💰" },
    { to: "/expenses", label: "Expenses", icon: "💸" },
    { to: "/reminders", label: "Reminders", icon: "🔔" },
  ];

  return (
    <>
      {/* ── Navbar ── */}
      <nav
        style={{
          position: "sticky",
          top: 0,
          zIndex: 1000,
          background: scrolled
            ? "rgba(15, 23, 42, 0.92)" // scroll hone par dark + blur
            : "rgba(15, 23, 42, 0.98)",
          backdropFilter: "blur(12px)", // glassmorphism effect
          WebkitBackdropFilter: "blur(12px)",
          borderBottom: "1px solid rgba(99, 102, 241, 0.2)",
          // Scroll hone par deeper shadow
          boxShadow: scrolled
            ? "0 4px 24px rgba(0,0,0,0.4)"
            : "0 2px 10px rgba(0,0,0,0.2)",
          transition: "all 0.3s ease", // smooth shadow transition
          padding: "0 24px",
        }}
      >
        <div
          style={{
            maxWidth: "1200px",
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            height: "62px",
          }}
        >
          {/* ── Logo ── */}
          <Link to="/" style={{ textDecoration: "none" }}>
            <span
              style={{
                fontSize: "22px",
                fontWeight: "800",
                // Gradient text effect
                background:
                  "linear-gradient(135deg, #6366f1, #a78bfa, #38bdf8)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
                letterSpacing: "-0.5px",
              }}
            >
              📚 LibraryPro
            </span>
          </Link>

          {/* ── Desktop Links ── */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "2px",
            }}
            className="desktop-nav"
          >
            {links.map((link) => {
              const isActive = location.pathname === link.to;
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  style={{
                    position: "relative",
                    display: "flex",
                    alignItems: "center",
                    gap: "5px",
                    padding: "8px 12px",
                    borderRadius: "10px",
                    textDecoration: "none",
                    fontSize: "13px",
                    fontWeight: isActive ? "600" : "400",
                    color: isActive ? "white" : "#94a3b8",
                    // Active link ka background
                    background: isActive
                      ? "rgba(99, 102, 241, 0.2)"
                      : "transparent",
                    border: isActive
                      ? "1px solid rgba(99, 102, 241, 0.4)"
                      : "1px solid transparent",
                    // Smooth hover transition
                    transition: "all 0.2s ease",
                  }}
                  // Hover effect — inline style se nahi hota
                  // isliye CSS inject karte hain
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.color = "white";
                      e.currentTarget.style.background =
                        "rgba(255,255,255,0.06)";
                      e.currentTarget.style.transform = "translateY(-1px)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.color = "#94a3b8";
                      e.currentTarget.style.background = "transparent";
                      e.currentTarget.style.transform = "translateY(0)";
                    }
                  }}
                >
                  <span style={{ fontSize: "14px" }}>{link.icon}</span>
                  {link.label}

                  {/* Active indicator — neeche purple dot */}
                  {isActive && (
                    <span
                      style={{
                        position: "absolute",
                        bottom: "4px",
                        left: "50%",
                        transform: "translateX(-50%)",
                        width: "4px",
                        height: "4px",
                        borderRadius: "50%",
                        background: "#6366f1",
                      }}
                    />
                  )}
                </Link>
              );
            })}
          </div>

          {/* ── Hamburger Button (Mobile only) ── */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            style={{
              display: "none", // CSS se mobile par show hoga
              background: menuOpen
                ? "rgba(99, 102, 241, 0.2)"
                : "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "white",
              borderRadius: "10px",
              width: "40px",
              height: "40px",
              fontSize: "18px",
              cursor: "pointer",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 0.2s ease",
            }}
            className="hamburger-btn"
            aria-label="Toggle menu"
          >
            {/* Hamburger to X animation */}
            <span
              style={{
                display: "block",
                transition: "transform 0.3s ease",
                transform: menuOpen ? "rotate(45deg)" : "rotate(0deg)",
              }}
            >
              {menuOpen ? "✕" : "☰"}
            </span>
          </button>
        </div>
      </nav>

      {/* ── Mobile Dropdown Menu ── */}
      {/* Height animation se smooth slide down hota hai */}
      <div
        style={{
          position: "sticky",
          top: "62px",
          zIndex: 999,
          background: "rgba(15, 23, 42, 0.97)",
          backdropFilter: "blur(12px)",
          borderBottom: menuOpen ? "1px solid rgba(99,102,241,0.2)" : "none",
          // Slide down animation
          maxHeight: menuOpen ? "500px" : "0px",
          overflow: "hidden",
          transition: "max-height 0.35s cubic-bezier(0.4, 0, 0.2, 1)",
        }}
        className="mobile-menu"
      >
        <div style={{ padding: menuOpen ? "12px 16px 16px" : "0 16px" }}>
          {links.map((link, index) => {
            const isActive = location.pathname === link.to;
            return (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setMenuOpen(false)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "12px 16px",
                  borderRadius: "10px",
                  textDecoration: "none",
                  marginBottom: "4px",
                  color: isActive ? "white" : "#94a3b8",
                  background: isActive
                    ? "rgba(99, 102, 241, 0.2)"
                    : "transparent",
                  border: isActive
                    ? "1px solid rgba(99,102,241,0.3)"
                    : "1px solid transparent",
                  fontWeight: isActive ? "600" : "400",
                  fontSize: "14px",
                  // Staggered animation — har link thoda delay se aaye
                  transition: `all 0.2s ease ${index * 30}ms`,
                }}
              >
                <span style={{ fontSize: "18px" }}>{link.icon}</span>
                {link.label}
                {isActive && (
                  <span
                    style={{
                      marginLeft: "auto",
                      width: "6px",
                      height: "6px",
                      borderRadius: "50%",
                      background: "#6366f1",
                    }}
                  />
                )}
              </Link>
            );
          })}
        </div>
      </div>

      {/* ── CSS for responsive ── */}
      <style>{`
        /* Mobile par hamburger dikhe, desktop links chhupe */
        @media (max-width: 768px) {
          .desktop-nav { display: none !important; }
          .hamburger-btn { display: flex !important; }
        }
        /* Desktop par mobile menu chhupa rahe */
        @media (min-width: 769px) {
          .mobile-menu { display: none !important; }
        }
      `}</style>
    </>
  );
}
