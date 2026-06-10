// src/components/Navbar.jsx
import { Link, useLocation, useNavigate } from "react-router-dom"; // 1. useNavigate add kiya
import { useState, useEffect } from "react";
import { signOut } from "firebase/auth"; // 2. Firebase signOut import kiya
import { auth } from "../firebase"; // 3. Firebase auth config import kiya

export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate(); // 4. Hook initialize kiya
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // 5. Logout Handler Function (Error handling ke saath)
  const handleLogout = async () => {
    if (!confirm("Kya aap log out karna chahte hain?")) return;
    try {
      await signOut(auth);
      navigate("/login"); // Logout ke baad seedhe login page pr bhejega
    } catch (err) {
      alert("Logout fail hua: " + err.message);
    }
  };

  const links = [
    {
      to: "/",
      label: "Dashboard",
      icon: (
        <svg
          viewBox="0 0 24 24"
          width="16"
          height="16"
          stroke="currentColor"
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="3" width="7" height="9"></rect>
          <rect x="14" y="3" width="7" height="5"></rect>
          <rect x="14" y="12" width="7" height="9"></rect>
          <rect x="3" y="16" width="7" height="5"></rect>
        </svg>
      ),
    },
    {
      to: "/add-student",
      label: "Add Student",
      icon: (
        <svg
          viewBox="0 0 24 24"
          width="16"
          height="16"
          stroke="currentColor"
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
          <circle cx="8.5" cy="7" r="4"></circle>
          <line x1="20" y1="8" x2="20" y2="14"></line>
          <line x1="17" y1="11" x2="23" y2="11"></line>
        </svg>
      ),
    },
    {
      to: "/students",
      label: "Students",
      icon: (
        <svg
          viewBox="0 0 24 24"
          width="16"
          height="16"
          stroke="currentColor"
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
          <circle cx="8.5" cy="7" r="4"></circle>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
        </svg>
      ),
    },
    {
      to: "/attendance",
      label: "Attendance",
      icon: (
        <svg
          viewBox="0 0 24 24"
          width="16"
          height="16"
          stroke="currentColor"
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
          <circle cx="12" cy="13" r="4"></circle>
        </svg>
      ),
    },
    {
      to: "/defaulters",
      label: "Defaulters",
      icon: (
        <svg
          viewBox="0 0 24 24"
          width="16"
          height="16"
          stroke="currentColor"
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
          <line x1="12" y1="9" x2="12" y2="13"></line>
          <line x1="12" y1="17" x2="12.01" y2="17"></line>
        </svg>
      ),
    },
    {
      to: "/finance",
      label: "Finance",
      icon: (
        <svg
          viewBox="0 0 24 24"
          width="16"
          height="16"
          stroke="currentColor"
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="12" y1="1" x2="12" y2="23"></line>
          <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
        </svg>
      ),
    },
    {
      to: "/expenses",
      label: "Expenses",
      icon: (
        <svg
          viewBox="0 0 24 24"
          width="16"
          height="16"
          stroke="currentColor"
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="2" y="4" width="20" height="16" rx="2" ry="2"></rect>
          <line x1="12" y1="4" x2="12" y2="20"></line>
        </svg>
      ),
    },
    {
      to: "/reminders",
      label: "Reminders",
      icon: (
        <svg
          viewBox="0 0 24 24"
          width="16"
          height="16"
          stroke="currentColor"
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
        </svg>
      ),
    },
  ];

  return (
    <>
      {/* ── Outer Ultra-Glass Nav Container ── */}
      <nav
        style={{
          position: "sticky",
          top: 0,
          zIndex: 1000,
          background: scrolled
            ? "rgba(4, 5, 11, 0.82)"
            : "rgba(4, 5, 11, 0.45)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          borderBottom: "1px solid var(--chroma-border)",
          boxShadow: scrolled
            ? "0 24px 60px -15px rgba(0, 0, 0, 0.9), inset 0 1px 0 0 rgba(255, 255, 255, 0.05)"
            : "inset 0 -1px 0 0 rgba(255, 255, 255, 0.02)",
          transition: "all 0.6s cubic-bezier(0.16, 1, 0.3, 1)",
          padding: "0 32px",
        }}
      >
        <div
          style={{
            maxWidth: "1400px",
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            height: scrolled ? "64px" : "82px",
            transition: "height 0.6s cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        >
          {/* ── Logo Block ── */}
          <Link
            to="/"
            style={{
              textDecoration: "none",
              display: "flex",
              alignItems: "center",
              gap: "12px",
            }}
            className="logo-glow-wrapper"
          >
            <div
              className="chroma-bg"
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "10px",
                display: "flex",
                alignItems: "center",
                justifyGround: "center",
              }}
            >
              <svg
                viewBox="0 0 24 24"
                width="18"
                height="18"
                stroke="white"
                strokeWidth="2.5"
                fill="none"
              >
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
              </svg>
            </div>
            <span
              className="chroma-text"
              style={{
                fontSize: "21px",
                fontWeight: "900",
                letterSpacing: "-0.8px",
              }}
            >
              LibraryPro
            </span>
          </Link>

          {/* ── Desktop Segmented Control Links ── */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
              background: "rgba(255, 255, 255, 0.02)",
              padding: "5px",
              borderRadius: "14px",
              border: "1px solid rgba(255, 255, 255, 0.04)",
            }}
            className="desktop-nav"
          >
            {links.map((link) => {
              const isActive = location.pathname === link.to;
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`nav-item ${isActive ? "active-item" : ""}`}
                  style={{
                    position: "relative",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "9px 15px",
                    borderRadius: "10px",
                    textDecoration: "none",
                    fontSize: "13px",
                    fontWeight: "600",
                    color: isActive ? "#ffffff" : "#707e94",
                    transition: "all 0.30s cubic-bezier(0.16, 1, 0.3, 1)",
                  }}
                >
                  <span
                    className="icon-box"
                    style={{ display: "flex", alignItems: "center" }}
                  >
                    {link.icon}
                  </span>
                  {link.label}
                  {isActive && <span className="active-glow-line" />}
                </Link>
              );
            })}
          </div>

          {/* ── Premium System Engine Badge & DESKTOP LOGOUT BUTTON ── */}
          <div
            className="desktop-nav"
            style={{ display: "flex", alignItems: "center", gap: "12px" }}
          >
            <div
              className="system-status"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "10px 18px",
                borderRadius: "22px",
                fontSize: "12px",
                fontWeight: "700",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
                cursor: "pointer",
                transition: "all 0.3s ease",
              }}
            >
              <span className="live-pulse-radar" />
              <span className="chroma-status-text">System Live</span>
            </div>

            {/* 6. Desktop Logout Button Integration */}
            <button
              onClick={handleLogout}
              className="logout-btn"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "10px 16px",
                background: "rgba(239, 68, 68, 0.1)",
                border: "1px solid rgba(239, 68, 68, 0.2)",
                borderRadius: "22px",
                color: "#ef4444",
                fontSize: "12px",
                fontWeight: "700",
                textTransform: "uppercase",
                cursor: "pointer",
                transition: "all 0.3s ease",
              }}
            >
              <svg
                viewBox="0 0 24 24"
                width="14"
                height="14"
                stroke="currentColor"
                strokeWidth="2.5"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                <polyline points="16 17 21 12 16 7"></polyline>
                <line x1="21" y1="12" x2="9" y2="12"></line>
              </svg>
              Logout
            </button>
          </div>

          {/* ── Fluid Kinetic Hamburger Button ── */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            style={{
              display: "none",
              background: "rgba(255, 255, 255, 0.02)",
              border: "1px solid rgba(255, 255, 255, 0.05)",
              borderRadius: "12px",
              width: "44px",
              height: "44px",
              cursor: "pointer",
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "column",
              gap: "5px",
              padding: 0,
            }}
            className="hamburger-btn"
            aria-label="Toggle menu"
          >
            <span
              style={{
                display: "block",
                width: "20px",
                height: "2px",
                background: "white",
                transition: "0.3s",
                transform: menuOpen
                  ? "rotate(45deg) translate(5px, 5px)"
                  : "none",
              }}
            />
            <span
              style={{
                display: "block",
                width: "14px",
                height: "2px",
                background: "white",
                transition: "0.2s",
                opacity: menuOpen ? 0 : 1,
                alignSelf: "flex-end",
                marginRight: "12px",
              }}
            />
            <span
              style={{
                display: "block",
                width: "20px",
                height: "2px",
                background: "white",
                transition: "0.3s",
                transform: menuOpen
                  ? "rotate(-45deg) translate(5px, -5px)"
                  : "none",
              }}
            />
          </button>
        </div>
      </nav>

      {/* ── Mobile Luminous Matrix Dropdown Card ── */}
      <div
        style={{
          position: "fixed",
          top: scrolled ? "76px" : "94px",
          left: "20px",
          right: "20px",
          zIndex: 999,
          background: "rgba(6, 7, 14, 0.96)",
          backdropFilter: "blur(32px)",
          WebkitBackdropFilter: "blur(32px)",
          border: "1px solid var(--chroma-border)",
          borderRadius: "24px",
          boxShadow:
            "0 40px 90px rgba(0,0,0,0.95), inset 0 1px 0 0 rgba(255,255,255,0.05)",
          overflow: "hidden",
          pointerEvents: menuOpen ? "all" : "none",
          transform: menuOpen
            ? "scale(1) translateY(0)"
            : "scale(0.95) translateY(-20px)",
          opacity: menuOpen ? 1 : 0,
          transition:
            "transform 0.5s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.4s ease",
        }}
        className="mobile-menu"
      >
        <div
          style={{
            padding: "16px",
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "10px",
          }}
        >
          {links.map((link) => {
            const isActive = location.pathname === link.to;
            return (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setMenuOpen(false)}
                className={
                  isActive ? "mobile-active-card" : "mobile-inactive-card"
                }
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                  padding: "16px",
                  borderRadius: "16px",
                  textDecoration: "none",
                  fontSize: "13px",
                  fontWeight: "600",
                  transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
                }}
              >
                <span
                  className="mobile-icon"
                  style={{ display: "inline-flex" }}
                >
                  {link.icon}
                </span>
                {link.label}
              </Link>
            );
          })}

          {/* 7. Mobile Logout Button Integration (Spans full width at bottom) */}
          <button
            onClick={() => {
              setMenuOpen(false);
              handleLogout();
            }}
            style={{
              gridColumn: "1 / -1",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              padding: "16px",
              background: "rgba(239, 68, 68, 0.1)",
              border: "1px solid rgba(239, 68, 68, 0.15)",
              borderRadius: "16px",
              color: "#f87171",
              fontSize: "13px",
              fontWeight: "700",
              cursor: "pointer",
              transition: "all 0.2s ease",
            }}
            className="mobile-logout-btn"
          >
            <svg
              viewBox="0 0 24 24"
              width="16"
              height="16"
              stroke="currentColor"
              strokeWidth="2.5"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
              <polyline points="16 17 21 12 16 7"></polyline>
              <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
            Logout From Account
          </button>
        </div>
      </div>

      {/* ── Performance CSS Engine ── */}
      <style>{`
        :root {
          --chroma-1: #6366f1;
          --chroma-2: #a855f7;
          --chroma-3: #ec4899;
          --chroma-4: #3b82f6;
          --chroma-border: rgba(255, 255, 255, 0.05);
        }

        @keyframes dynamicColorFlow {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }

        .chroma-text {
          background: linear-gradient(90deg, #ffffff, #c084fc, #6366f1, #38bdf8, #ffffff);
          background-size: 300% auto;
          color: transparent;
          -webkit-background-clip: text;
          background-clip: text;
          animation: dynamicColorFlow 8s linear infinite;
        }

        .chroma-bg {
          background: linear-gradient(135deg, var(--chroma-1), var(--chroma-2), var(--chroma-4));
          background-size: 200% 200%;
          animation: dynamicColorFlow 6s ease infinite;
          box-shadow: 0 0 25px rgba(99, 102, 241, 0.45);
        }

        .nav-item:not(.active-item):hover {
          color: #f8fafc !important;
          background: rgba(255, 255, 255, 0.04);
        }
        
        .nav-item:hover .icon-box {
          transform: translateY(-1px);
          color: #a5b4fc;
        }

        .active-item {
          background: linear-gradient(135deg, rgba(99, 102, 241, 0.08), rgba(168, 85, 247, 0.03)) !important;
          border: 1px solid rgba(168, 85, 247, 0.2) !important;
          box-shadow: 0 8px 25px -6px rgba(99, 102, 241, 0.35);
        }
        .active-item .icon-box {
          color: #a855f7 !important;
          filter: drop-shadow(0 0 8px rgba(168, 85, 247, 0.6));
        }

        /* 8. Desktop Logout Button Hover Effect */
        .logout-btn:hover {
          background: rgba(239, 68, 68, 0.25) !important;
          border-color: rgba(239, 68, 68, 0.4) !important;
          box-shadow: 0 0 20px rgba(239, 68, 68, 0.2);
          transform: translateY(-1px);
        }

        /* 9. Mobile Logout Hover Effect */
        .mobile-logout-btn:active {
          background: rgba(239, 68, 68, 0.2) !important;
        }

        .active-glow-line {
          position: absolute;
          bottom: -4px;
          left: 20%;
          right: 20%;
          height: 2px;
          background: linear-gradient(90deg, transparent, var(--chroma-2), var(--chroma-4), transparent);
          box-shadow: 0 2px 14px var(--chroma-2);
          border-radius: 20px;
        }

        .system-status {
          background: rgba(255, 255, 255, 0.01);
          border: 1px solid rgba(255, 255, 255, 0.05);
        }
        .system-status:hover {
          background: rgba(255, 255, 255, 0.03);
          border-color: rgba(168, 85, 247, 0.4);
          box-shadow: 0 0 25px rgba(168, 85, 247, 0.15);
        }
        .chroma-status-text {
          background: linear-gradient(90deg, #94a3b8, #e2e8f0, #94a3b8);
          background-size: 200% auto;
          color: transparent;
          -webkit-background-clip: text;
          background-clip: text;
          animation: dynamicColorFlow 4s linear infinite;
        }

        .live-pulse-radar {
          width: 7px;
          height: 7px;
          background: linear-gradient(135deg, #22c55e, #10b981);
          border-radius: 50%;
          position: relative;
        }
        .live-pulse-radar::after {
          content: '';
          position: absolute;
          top: -3px; left: -3px; right: -3px; bottom: -3px;
          border-radius: 50%;
          border: 2px solid #10b981;
          opacity: 0;
          animation: radarMotion 2s cubic-bezier(0.16, 1, 0.3, 1) infinite;
        }
        @keyframes radarMotion {
          0% { transform: scale(0.6); opacity: 1; }
          100% { transform: scale(2.4); opacity: 0; }
        }

        .mobile-inactive-card {
          color: #8e9cae;
          background: rgba(255, 255, 255, 0.01);
          border: 1px solid rgba(255, 255, 255, 0.02);
        }
        .mobile-inactive-card .mobile-icon { color: #475569; }
        
        .mobile-active-card {
          color: #ffffff;
          background: linear-gradient(135deg, rgba(168, 85, 247, 0.1), rgba(59, 130, 246, 0.05));
          border: 1px solid rgba(168, 85, 247, 0.25);
          box-shadow: 0 12px 30px -4px rgba(168, 85, 247, 0.25);
        }
        .mobile-active-card .mobile-icon { color: #c084fc; }

        @media (max-width: 1240px) {
          .desktop-nav { display: none !important; }
          .hamburger-btn { display: flex !important; }
        }
      `}</style>
    </>
  );
}
