// src/pages/Login.jsx
import { useState, useEffect } from "react";
import {
  signInWithEmailAndPassword,
  signInWithPopup,
  createUserWithEmailAndPassword,
} from "firebase/auth";
import { auth, db, googleProvider, secondaryAuth } from "../firebase";
import { useNavigate } from "react-router-dom";
import { doc, getDoc, setDoc } from "firebase/firestore";

export default function Login() {
  const navigate = useNavigate();

  // "admin" | "student"
  const [userType, setUserType] = useState("admin");
  // "login" | "register"  (only for admin)
  const [adminMode, setAdminMode] = useState("login");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [libraryName, setLibraryName] = useState("");

  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [mounted, setMounted] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Reset fields whenever tab/mode changes
  useEffect(() => {
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setLibraryName("");
    setError("");
    setSuccessMsg("");
    setShowPassword(false);
  }, [userType, adminMode]);

  // ── Role-based routing ───────────────────────────────
  const handleUserRouting = async (userInstance) => {
    const userDocRef = doc(db, "users", userInstance.uid);
    const userDocSnap = await getDoc(userDocRef);

    if (userDocSnap.exists()) {
      const userData = userDocSnap.data();
      if (userData.role === "student") {
        if (userType === "admin") {
          setError(
            "Yeh account student ka hai. 'Student Login' tab se login karein.",
          );
          return;
        }
        navigate("/student-home");
      } else if (userData.role === "admin") {
        if (userType === "student") {
          setError(
            "Yeh account admin ka hai. 'Admin Login' tab se login karein.",
          );
          return;
        }
        navigate("/dashboard");
      } else {
        navigate("/");
      }
    } else {
      setError(
        "Aap library database mein registered nahi hain. Kripya Admin se sampark karein.",
      );
    }
  };

  // ── Admin Register ───────────────────────────────────
  const handleAdminRegister = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password || !confirmPassword) {
      setError("Sab fields bharna zaruri hai.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords match nahi kar rahe.");
      return;
    }
    if (password.length < 6) {
      setError("Password kam se kam 6 characters ka hona chahiye.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      // Use secondaryAuth so an already-logged-in admin doesn't get kicked out
      const userCredential = await createUserWithEmailAndPassword(
        secondaryAuth,
        email.trim(),
        password,
      );
      const newUID = userCredential.user.uid;

      // Write admin role to users collection
      await setDoc(doc(db, "users", newUID), {
        role: "admin",
        email: email.trim(),
        libraryName: libraryName.trim() || "",
        createdAt: new Date().toISOString(),
      });

      // Sign secondaryAuth back out so it stays clean
      await secondaryAuth.signOut();

      setSuccessMsg("Admin account ban gaya! Ab neeche login karein.");
      setAdminMode("login");
    } catch (err) {
      console.error(err);
      if (err.code === "auth/email-already-in-use") {
        setError("Yeh Email ID pehle se registered hai.");
      } else {
        setError("Registration failed: " + err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Email/Password Login ─────────────────────────────
  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError("Email aur Password dono bharna zaruri hai!");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const userCredential = await signInWithEmailAndPassword(
        auth,
        email.trim(),
        password,
      );
      await handleUserRouting(userCredential.user);
    } catch (err) {
      console.error(err);
      if (
        err.code === "auth/user-not-found" ||
        err.code === "auth/wrong-password" ||
        err.code === "auth/invalid-credential"
      ) {
        setError("Galat Email ID ya Password daala hai.");
      } else {
        setError("Login karne mein dikkat aayi: " + err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Google Login (admin only) ────────────────────────
  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    setError("");
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const userDocRef = doc(db, "users", result.user.uid);
      const userDocSnap = await getDoc(userDocRef);

      if (!userDocSnap.exists()) {
        // First-time Google admin — create the record
        await setDoc(userDocRef, {
          role: "admin",
          email: result.user.email,
          libraryName: "",
          createdAt: new Date().toISOString(),
        });
        navigate("/dashboard");
      } else {
        await handleUserRouting(result.user);
      }
    } catch (err) {
      console.error("Google Auth Error:", err);
      if (err.code === "auth/popup-closed-by-user") {
        setError("Google login window band kar di gayi.");
      } else if (err.code === "auth/popup-blocked") {
        setError("Browser ne popup block kar diya. Please popup allow karein.");
      } else {
        setError("Google se login nahi ho paya. Dobara try karein.");
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  const isAnyLoading = loading || googleLoading;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        *, *::before, *::after { box-sizing: border-box; }

        .lg-page {
          min-height: 100vh;
          background: linear-gradient(135deg, #eef2ff 0%, #f0f4ff 50%, #faf5ff 100%);
          display: flex; align-items: center; justify-content: center;
          font-family: 'Inter', sans-serif; padding: 16px;
          opacity: 0; transform: translateY(16px);
          transition: opacity 0.45s ease, transform 0.45s ease;
        }
        .lg-page.mounted { opacity: 1; transform: translateY(0); }

        .lg-card {
          background: #fff; border-radius: 28px;
          border: 1.5px solid #e8eaf6;
          box-shadow: 0 4px 6px rgba(99,102,241,0.04), 0 12px 40px rgba(99,102,241,0.08);
          padding: 36px 32px 32px; max-width: 440px; width: 100%;
        }

        /* Brand */
        .lg-brand { text-align: center; margin-bottom: 24px; }
        .lg-brand-icon-wrap {
          width: 60px; height: 60px; border-radius: 18px;
          background: linear-gradient(135deg, #6366f1, #818cf8);
          display: inline-flex; align-items: center; justify-content: center;
          font-size: 28px; margin-bottom: 12px;
          box-shadow: 0 6px 20px rgba(99,102,241,0.28);
        }
        .lg-brand h2 { color: #1e1b4b; font-size: 21px; font-weight: 800; margin: 0 0 4px; letter-spacing: -0.4px; }
        .lg-brand p  { color: #9ca3af; font-size: 13px; margin: 0; }

        /* User Type Tabs */
        .lg-type-tabs {
          display: flex; gap: 4px;
          background: #f1f3f9; border-radius: 14px;
          padding: 4px; margin-bottom: 20px;
        }
        .lg-type-tab {
          flex: 1; padding: 9px 10px; border-radius: 10px;
          font-size: 13px; font-weight: 700; cursor: pointer;
          border: none; background: transparent; color: #6b7280;
          transition: all 0.2s ease; font-family: inherit;
          display: flex; align-items: center; justify-content: center; gap: 6px;
        }
        .lg-type-tab.active {
          background: #fff; color: #6366f1;
          box-shadow: 0 2px 8px rgba(99,102,241,0.12);
        }

        /* Admin mode sub-tabs */
        .lg-mode-tabs {
          display: flex; gap: 0;
          border-bottom: 1.5px solid #f1f3f9; margin-bottom: 20px;
        }
        .lg-mode-tab {
          flex: 1; padding: 8px 12px; border: none; background: transparent;
          font-size: 13px; font-weight: 700; color: #9ca3af;
          cursor: pointer; font-family: inherit;
          border-bottom: 2px solid transparent; margin-bottom: -1.5px;
          transition: all 0.18s ease;
        }
        .lg-mode-tab.active { color: #6366f1; border-bottom-color: #6366f1; }
        .lg-mode-tab:hover:not(.active) { color: #4b5563; }

        /* Messages */
        .lg-error-banner {
          background: #fef2f2; border: 1.5px solid #fca5a5; color: #991b1b;
          border-radius: 12px; padding: 11px 14px; font-size: 12.5px; font-weight: 600;
          margin-bottom: 18px; display: flex; align-items: flex-start; gap: 8px;
          line-height: 1.5; animation: slideDown 0.2s ease;
        }
        .lg-success-banner {
          background: #ecfdf5; border: 1.5px solid #a7f3d0; color: #065f46;
          border-radius: 12px; padding: 11px 14px; font-size: 12.5px; font-weight: 600;
          margin-bottom: 18px; display: flex; align-items: flex-start; gap: 8px;
          line-height: 1.5; animation: slideDown 0.2s ease;
        }
        @keyframes slideDown { from { opacity:0; transform:translateY(-6px); } to { opacity:1; transform:translateY(0); } }
        .lg-msg-close {
          margin-left: auto; cursor: pointer; opacity: 0.6;
          background: none; border: none; padding: 0;
          color: inherit; font-size: 16px; line-height: 1; flex-shrink: 0;
        }
        .lg-msg-close:hover { opacity: 1; }

        /* Form */
        .lg-form { display: flex; flex-direction: column; gap: 16px; }
        .lg-field { display: flex; flex-direction: column; gap: 6px; }
        .lg-label { font-size: 11px; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: 0.7px; }
        .lg-input-wrap { position: relative; }
        .lg-input-icon { position: absolute; left: 13px; top: 50%; transform: translateY(-50%); color: #9ca3af; display: flex; pointer-events: none; }
        .lg-input {
          width: 100%; border-radius: 12px; border: 1.5px solid #e5e7eb;
          background: #fafbff; color: #1e1b4b; font-size: 14px; font-family: inherit;
          padding: 11px 12px 11px 40px; outline: none;
          transition: border-color 0.18s, box-shadow 0.18s, background 0.18s;
        }
        .lg-input:focus { border-color: #6366f1; box-shadow: 0 0 0 3.5px rgba(99,102,241,0.13); background: #fff; }
        .lg-input:disabled { opacity: 0.6; cursor: not-allowed; }
        .lg-input::placeholder { color: #c4c9d4; }
        .lg-input.no-icon { padding-left: 12px; }
        .lg-input-pw { padding-right: 44px; }
        .lg-pw-toggle {
          position: absolute; right: 12px; top: 50%; transform: translateY(-50%);
          background: none; border: none; cursor: pointer;
          color: #9ca3af; display: flex; padding: 4px; transition: color 0.15s;
        }
        .lg-pw-toggle:hover { color: #6366f1; }

        /* Buttons */
        .lg-btn {
          width: 100%; padding: 13px; border-radius: 13px;
          font-size: 14px; font-weight: 700; cursor: pointer; border: none;
          background: linear-gradient(135deg, #6366f1 0%, #818cf8 100%);
          color: #fff; box-shadow: 0 4px 16px rgba(99,102,241,0.3);
          transition: all 0.2s ease; font-family: inherit;
          display: flex; align-items: center; justify-content: center; gap: 8px; margin-top: 4px;
        }
        .lg-btn:hover:not(:disabled) { background: linear-gradient(135deg, #4f46e5 0%, #6366f1 100%); box-shadow: 0 6px 20px rgba(99,102,241,0.4); transform: translateY(-1px); }
        .lg-btn:active:not(:disabled) { transform: translateY(0); }
        .lg-btn:disabled { opacity: 0.65; cursor: not-allowed; }

        @keyframes spin { to { transform: rotate(360deg); } }
        .lg-btn-spinner {
          width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.4);
          border-top-color: #fff; border-radius: 50%;
          animation: spin 0.7s linear infinite; flex-shrink: 0;
        }

        .lg-divider { display: flex; align-items: center; gap: 10px; margin: 18px 0; }
        .lg-divider-line { flex: 1; height: 1.5px; background: #f0f1f8; }
        .lg-divider-text { color: #b0b8cc; font-size: 11.5px; font-weight: 700; letter-spacing: 0.5px; }

        .lg-google-btn {
          width: 100%; padding: 11px; border-radius: 13px;
          font-size: 14px; font-weight: 600; cursor: pointer;
          background: #fff; color: #374151; border: 1.5px solid #e5e7eb;
          display: flex; align-items: center; justify-content: center; gap: 10px;
          transition: all 0.18s ease; font-family: inherit;
          box-shadow: 0 1px 4px rgba(0,0,0,0.04);
        }
        .lg-google-btn:hover:not(:disabled) { background: #f8f9ff; border-color: #c7d2fe; color: #1e1b4b; box-shadow: 0 2px 8px rgba(99,102,241,0.1); transform: translateY(-1px); }
        .lg-google-btn:disabled { opacity: 0.65; cursor: not-allowed; }
        .lg-google-spinner {
          width: 18px; height: 18px; border: 2px solid #e5e7eb;
          border-top-color: #6366f1; border-radius: 50%;
          animation: spin 0.7s linear infinite; flex-shrink: 0;
        }

        .lg-footer-note {
          text-align: center; font-size: 12px; color: #9ca3af; margin-top: 16px;
        }
        .lg-footer-link {
          color: #6366f1; font-weight: 700; cursor: pointer; background: none;
          border: none; padding: 0; font-family: inherit; font-size: 12px;
        }
        .lg-footer-link:hover { text-decoration: underline; }

        @media (max-width: 460px) {
          .lg-card { padding: 24px 18px 22px; border-radius: 22px; }
        }
      `}</style>

      <div className={`lg-page${mounted ? " mounted" : ""}`}>
        <div className="lg-card">
          {/* Brand */}
          <div className="lg-brand">
            <div className="lg-brand-icon-wrap">📚</div>
            <h2>LibraryPro</h2>
            <p>Apna account access karein</p>
          </div>

          {/* User Type Tabs */}
          <div className="lg-type-tabs">
            <button
              className={`lg-type-tab${userType === "admin" ? " active" : ""}`}
              onClick={() => setUserType("admin")}
            >
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
                  d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
                />
              </svg>
              Admin Login
            </button>
            <button
              className={`lg-type-tab${userType === "student" ? " active" : ""}`}
              onClick={() => setUserType("student")}
            >
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
                  d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5"
                />
              </svg>
              Student Login
            </button>
          </div>

          {/* Admin sub-tabs: Login / Register */}
          {userType === "admin" && (
            <div className="lg-mode-tabs">
              <button
                className={`lg-mode-tab${adminMode === "login" ? " active" : ""}`}
                onClick={() => setAdminMode("login")}
              >
                Sign In
              </button>
              <button
                className={`lg-mode-tab${adminMode === "register" ? " active" : ""}`}
                onClick={() => setAdminMode("register")}
              >
                New Admin? Register
              </button>
            </div>
          )}

          {/* Error / Success Messages */}
          {error && (
            <div className="lg-error-banner">
              <span>⚠️</span>
              <span style={{ flex: 1 }}>{error}</span>
              <button className="lg-msg-close" onClick={() => setError("")}>
                ✕
              </button>
            </div>
          )}
          {successMsg && (
            <div className="lg-success-banner">
              <span>✅</span>
              <span style={{ flex: 1 }}>{successMsg}</span>
              <button
                className="lg-msg-close"
                onClick={() => setSuccessMsg("")}
              >
                ✕
              </button>
            </div>
          )}

          {/* ── ADMIN REGISTER FORM ── */}
          {userType === "admin" && adminMode === "register" && (
            <form className="lg-form" onSubmit={handleAdminRegister} noValidate>
              {/* Library Name (optional) */}
              <div className="lg-field">
                <label className="lg-label">Library Name (optional)</label>
                <div className="lg-input-wrap">
                  <span className="lg-input-icon">
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
                        d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75z"
                      />
                    </svg>
                  </span>
                  <input
                    type="text"
                    className="lg-input"
                    placeholder="Jaise: Sharma Library"
                    value={libraryName}
                    onChange={(e) => setLibraryName(e.target.value)}
                    disabled={isAnyLoading}
                  />
                </div>
              </div>

              {/* Email */}
              <div className="lg-field">
                <label className="lg-label">
                  Email Address <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <div className="lg-input-wrap">
                  <span className="lg-input-icon">
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
                        d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
                      />
                    </svg>
                  </span>
                  <input
                    type="email"
                    className="lg-input"
                    placeholder="admin@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isAnyLoading}
                    autoComplete="email"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="lg-field">
                <label className="lg-label">
                  Password <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <div className="lg-input-wrap">
                  <span className="lg-input-icon">
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
                        d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
                      />
                    </svg>
                  </span>
                  <input
                    type={showPassword ? "text" : "password"}
                    className="lg-input lg-input-pw"
                    placeholder="Minimum 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isAnyLoading}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    className="lg-pw-toggle"
                    onClick={() => setShowPassword((p) => !p)}
                    tabIndex={-1}
                  >
                    {showPassword ? (
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
                          d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88"
                        />
                      </svg>
                    ) : (
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
                          d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div className="lg-field">
                <label className="lg-label">
                  Confirm Password <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <div className="lg-input-wrap">
                  <span className="lg-input-icon">
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
                        d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
                      />
                    </svg>
                  </span>
                  <input
                    type={showPassword ? "text" : "password"}
                    className="lg-input lg-input-pw"
                    placeholder="Password dobara likhein"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={isAnyLoading}
                    autoComplete="new-password"
                  />
                </div>
              </div>

              <button type="submit" className="lg-btn" disabled={isAnyLoading}>
                {loading ? (
                  <>
                    <span className="lg-btn-spinner" /> Creating Account...
                  </>
                ) : (
                  "Create Admin Account"
                )}
              </button>
            </form>
          )}

          {/* ── ADMIN LOGIN FORM ── */}
          {userType === "admin" && adminMode === "login" && (
            <>
              <form className="lg-form" onSubmit={handleLogin} noValidate>
                <div className="lg-field">
                  <label className="lg-label">Email Address</label>
                  <div className="lg-input-wrap">
                    <span className="lg-input-icon">
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
                          d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
                        />
                      </svg>
                    </span>
                    <input
                      type="email"
                      className="lg-input"
                      placeholder="name@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={isAnyLoading}
                      autoComplete="email"
                    />
                  </div>
                </div>

                <div className="lg-field">
                  <label className="lg-label">Password</label>
                  <div className="lg-input-wrap">
                    <span className="lg-input-icon">
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
                          d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
                        />
                      </svg>
                    </span>
                    <input
                      type={showPassword ? "text" : "password"}
                      className="lg-input lg-input-pw"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={isAnyLoading}
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      className="lg-pw-toggle"
                      onClick={() => setShowPassword((p) => !p)}
                      tabIndex={-1}
                    >
                      {showPassword ? (
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
                            d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88"
                          />
                        </svg>
                      ) : (
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
                            d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                          />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  className="lg-btn"
                  disabled={isAnyLoading}
                >
                  {loading ? (
                    <>
                      <span className="lg-btn-spinner" /> Verifying...
                    </>
                  ) : (
                    "Sign In as Admin"
                  )}
                </button>
              </form>

              <div className="lg-divider">
                <div className="lg-divider-line" />
                <span className="lg-divider-text">OR</span>
                <div className="lg-divider-line" />
              </div>

              <button
                type="button"
                className="lg-google-btn"
                onClick={handleGoogleLogin}
                disabled={isAnyLoading}
              >
                {googleLoading ? (
                  <>
                    <span className="lg-google-spinner" /> Connecting to
                    Google...
                  </>
                ) : (
                  <>
                    <svg width="18" height="18" viewBox="0 0 24 24">
                      <path
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        fill="#4285F4"
                      />
                      <path
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        fill="#34A853"
                      />
                      <path
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                        fill="#FBBC05"
                      />
                      <path
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                        fill="#EA4335"
                      />
                    </svg>
                    Continue with Google
                  </>
                )}
              </button>
            </>
          )}

          {/* ── STUDENT LOGIN FORM ── */}
          {userType === "student" && (
            <>
              <form className="lg-form" onSubmit={handleLogin} noValidate>
                <div className="lg-field">
                  <label className="lg-label">Student Email</label>
                  <div className="lg-input-wrap">
                    <span className="lg-input-icon">
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
                          d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
                        />
                      </svg>
                    </span>
                    <input
                      type="email"
                      className="lg-input"
                      placeholder="Admin ne jo email diya tha"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={isAnyLoading}
                      autoComplete="email"
                    />
                  </div>
                </div>

                <div className="lg-field">
                  <label className="lg-label">Password</label>
                  <div className="lg-input-wrap">
                    <span className="lg-input-icon">
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
                          d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
                        />
                      </svg>
                    </span>
                    <input
                      type={showPassword ? "text" : "password"}
                      className="lg-input lg-input-pw"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={isAnyLoading}
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      className="lg-pw-toggle"
                      onClick={() => setShowPassword((p) => !p)}
                      tabIndex={-1}
                    >
                      {showPassword ? (
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
                            d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88"
                          />
                        </svg>
                      ) : (
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
                            d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                          />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  className="lg-btn"
                  disabled={isAnyLoading}
                >
                  {loading ? (
                    <>
                      <span className="lg-btn-spinner" /> Verifying...
                    </>
                  ) : (
                    "Sign In as Student"
                  )}
                </button>
              </form>

              <p className="lg-footer-note" style={{ marginTop: 16 }}>
                Account nahi hai? Apne library admin se credentials maangein.
              </p>
            </>
          )}
        </div>
      </div>
    </>
  );
}
