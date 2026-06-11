// src/pages/Login.jsx
import { useState, useEffect } from "react";
import { signInWithEmailAndPassword, signInWithPopup } from "firebase/auth";
import { auth, db, googleProvider } from "../firebase";
import { useNavigate } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");
  const [mounted, setMounted] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Role-based routing — email aur Google dono ke liye common
  const handleUserRouting = async (userInstance) => {
    const userDocRef = doc(db, "users", userInstance.uid);
    const userDocSnap = await getDoc(userDocRef);

    if (userDocSnap.exists()) {
      const userData = userDocSnap.data();
      if (userData.role === "student") {
        navigate("/student-home");
      } else if (userData.role === "admin") {
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

  // Email/Password login
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

  // Google login — popup (localhost pe kaam karta hai, redirect nahi)
  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    setError("");
    try {
      const result = await signInWithPopup(auth, googleProvider);
      await handleUserRouting(result.user);
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
          padding: 40px 36px 36px; max-width: 420px; width: 100%;
        }

        .lg-brand { text-align: center; margin-bottom: 28px; }
        .lg-brand-icon-wrap {
          width: 64px; height: 64px; border-radius: 18px;
          background: linear-gradient(135deg, #6366f1, #818cf8);
          display: inline-flex; align-items: center; justify-content: center;
          font-size: 30px; margin-bottom: 14px;
          box-shadow: 0 6px 20px rgba(99,102,241,0.28);
        }
        .lg-brand h2 { color: #1e1b4b; font-size: 22px; font-weight: 800; margin: 0 0 5px; letter-spacing: -0.4px; }
        .lg-brand p { color: #9ca3af; font-size: 13px; margin: 0; }

        .lg-error-banner {
          background: #fef2f2; border: 1.5px solid #fca5a5; color: #991b1b;
          border-radius: 12px; padding: 11px 14px; font-size: 12.5px; font-weight: 600;
          margin-bottom: 22px; display: flex; align-items: flex-start; gap: 8px;
          line-height: 1.5; animation: slideDown 0.2s ease;
        }
        @keyframes slideDown { from { opacity:0; transform:translateY(-6px); } to { opacity:1; transform:translateY(0); } }
        .lg-error-close {
          margin-left: auto; cursor: pointer; opacity: 0.6;
          background: none; border: none; padding: 0;
          color: #991b1b; font-size: 16px; line-height: 1; flex-shrink: 0;
        }
        .lg-error-close:hover { opacity: 1; }

        .lg-form { display: flex; flex-direction: column; gap: 18px; }
        .lg-field { display: flex; flex-direction: column; gap: 6px; }
        .lg-label { font-size: 11px; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: 0.7px; }
        .lg-input-wrap { position: relative; }
        .lg-input-icon { position: absolute; left: 13px; top: 50%; transform: translateY(-50%); color: #9ca3af; display: flex; pointer-events: none; }
        .lg-input {
          width: 100%; border-radius: 12px; border: 1.5px solid #e5e7eb;
          background: #fafbff; color: #1e1b4b; font-size: 14px; font-family: inherit;
          padding: 12px 12px 12px 40px; outline: none;
          transition: border-color 0.18s, box-shadow 0.18s, background 0.18s;
        }
        .lg-input:focus { border-color: #6366f1; box-shadow: 0 0 0 3.5px rgba(99,102,241,0.13); background: #fff; }
        .lg-input:disabled { opacity: 0.6; cursor: not-allowed; }
        .lg-input::placeholder { color: #c4c9d4; }
        .lg-input-pw { padding-right: 44px; }
        .lg-pw-toggle {
          position: absolute; right: 12px; top: 50%; transform: translateY(-50%);
          background: none; border: none; cursor: pointer;
          color: #9ca3af; display: flex; padding: 4px; transition: color 0.15s;
        }
        .lg-pw-toggle:hover { color: #6366f1; }

        .lg-btn {
          width: 100%; padding: 13px; border-radius: 13px;
          font-size: 14px; font-weight: 700; cursor: pointer; border: none;
          background: linear-gradient(135deg, #6366f1 0%, #818cf8 100%);
          color: #fff; box-shadow: 0 4px 16px rgba(99,102,241,0.3);
          transition: all 0.2s ease; font-family: inherit;
          display: flex; align-items: center; justify-content: center; gap: 8px; margin-top: 2px;
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

        .lg-divider { display: flex; align-items: center; gap: 10px; margin: 22px 0; }
        .lg-divider-line { flex: 1; height: 1.5px; background: #f0f1f8; }
        .lg-divider-text { color: #b0b8cc; font-size: 11.5px; font-weight: 700; letter-spacing: 0.5px; }

        .lg-google-btn {
          width: 100%; padding: 12px; border-radius: 13px;
          font-size: 14px; font-weight: 600; cursor: pointer;
          background: #fff; color: #374151; border: 1.5px solid #e5e7eb;
          display: flex; align-items: center; justify-content: center; gap: 10px;
          transition: all 0.18s ease; font-family: inherit;
          box-shadow: 0 1px 4px rgba(0,0,0,0.04);
        }
        .lg-google-btn:hover:not(:disabled) { background: #f8f9ff; border-color: #c7d2fe; color: #1e1b4b; box-shadow: 0 2px 8px rgba(99,102,241,0.1); transform: translateY(-1px); }
        .lg-google-btn:active:not(:disabled) { transform: translateY(0); }
        .lg-google-btn:disabled { opacity: 0.65; cursor: not-allowed; }
        .lg-google-spinner {
          width: 18px; height: 18px; border: 2px solid #e5e7eb;
          border-top-color: #6366f1; border-radius: 50%;
          animation: spin 0.7s linear infinite; flex-shrink: 0;
        }

        @media (max-width: 460px) {
          .lg-card { padding: 28px 20px 24px; border-radius: 22px; }
        }
      `}</style>

      <div className={`lg-page${mounted ? " mounted" : ""}`}>
        <div className="lg-card">
          <div className="lg-brand">
            <div className="lg-brand-icon-wrap">📚</div>
            <h2>Digital Library</h2>
            <p>Apna library account access karein</p>
          </div>

          {error && (
            <div className="lg-error-banner">
              <span>⚠️</span>
              <span style={{ flex: 1 }}>{error}</span>
              <button
                className="lg-error-close"
                onClick={() => setError("")}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
          )}

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

            <button type="submit" className="lg-btn" disabled={isAnyLoading}>
              {loading ? (
                <>
                  <span className="lg-btn-spinner" />
                  Verifying...
                </>
              ) : (
                "Sign In"
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
                <span className="lg-google-spinner" />
                Connecting to Google...
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
        </div>
      </div>
    </>
  );
}
