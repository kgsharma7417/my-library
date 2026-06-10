import { useState } from "react";
import { signInWithEmailAndPassword, signInWithPopup } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { auth, db, googleProvider } from "../firebase";

export default function Login() {
  const navigate = useNavigate();
  const [tab, setTab] = useState("admin");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");

  // After any successful login, check role and redirect
  const redirectByRole = async (uid) => {
    try {
      const snap = await getDoc(doc(db, "users", uid));
      const role = snap.exists() ? snap.data()?.role || "student" : "student";
      navigate(role === "admin" ? "/dashboard" : "/student-home", {
        replace: true,
      });
    } catch {
      navigate("/student-home", { replace: true });
    }
  };

  const handleAdminLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      await redirectByRole(cred.user.uid);
    } catch {
      setError("Email ya password galat hai.");
    }
    setLoading(false);
  };

  const handleStudentLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const fakeEmail = `${phone}@library.app`;
      const cred = await signInWithEmailAndPassword(auth, fakeEmail, phone);
      await redirectByRole(cred.user.uid);
    } catch {
      setError("Phone number se koi account nahi mila. Admin se contact karo.");
    }
    setLoading(false);
  };

  const handleGoogleLogin = async () => {
    setError("");
    setGoogleLoading(true);

    try {
      const cred = await signInWithPopup(auth, googleProvider);

      const user = cred.user;

      const userRef = doc(db, "users", user.uid);

      const snap = await getDoc(userRef);

      // Agar user pehli baar login kar raha hai
      if (!snap.exists()) {
        await setDoc(userRef, {
          uid: user.uid,
          email: user.email,
          role: "student",
          createdAt: new Date().toISOString(),
        });
      }

      await redirectByRole(user.uid);
    } catch (err) {
      if (err.code !== "auth/popup-closed-by-user") {
        setError("Google sign-in fail hua. Dobara try karein.");
      }
    }

    setGoogleLoading(false);
  };
  return (
    <>
      <style>{`
        .login-bg {
          min-height: 100vh;
          background: #f0f2f8;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px 16px;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
        }
        .login-card {
          background: #fff;
          border-radius: 24px;
          border: 1.5px solid #e5e7eb;
          box-shadow: 0 8px 40px rgba(99,102,241,0.10);
          width: 100%;
          max-width: 420px;
          padding: 36px 32px 32px;
          animation: fadeUp 0.4s cubic-bezier(.22,1,.36,1) both;
        }
        .login-logo {
          width: 52px; height: 52px;
          border-radius: 16px;
          background: linear-gradient(135deg, #6366f1, #818cf8);
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 4px 16px rgba(99,102,241,0.32);
          margin: 0 auto 20px;
        }
        .login-logo svg { color: #fff; }
        .login-title {
          text-align: center;
          font-size: 22px;
          font-weight: 800;
          color: #1e1b4b;
          margin: 0 0 4px;
          letter-spacing: -0.4px;
        }
        .login-subtitle {
          text-align: center;
          font-size: 13px;
          color: #9ca3af;
          margin: 0 0 24px;
        }
        .login-tabs {
          display: flex;
          background: #f1f3f9;
          border-radius: 12px;
          padding: 4px;
          margin-bottom: 24px;
          gap: 4px;
        }
        .login-tab {
          flex: 1;
          padding: 9px;
          border-radius: 9px;
          border: none;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s ease;
          font-family: inherit;
          color: #6b7280;
          background: transparent;
        }
        .login-tab.active {
          background: #fff;
          color: #6366f1;
          box-shadow: 0 2px 8px rgba(99,102,241,0.12);
        }
        .login-field { margin-bottom: 16px; }
        .login-label {
          display: block;
          font-size: 11px;
          font-weight: 700;
          color: #6b7280;
          text-transform: uppercase;
          letter-spacing: 0.6px;
          margin-bottom: 6px;
        }
        .login-input-wrap { position: relative; }
        .login-input-icon {
          position: absolute;
          left: 12px; top: 50%;
          transform: translateY(-50%);
          color: #9ca3af;
          pointer-events: none;
          display: flex;
        }
        .login-input {
          width: 100%;
          box-sizing: border-box;
          padding: 11px 12px 11px 38px;
          border: 1.5px solid #e5e7eb;
          border-radius: 12px;
          font-size: 14px;
          color: #1e1b4b;
          background: #fafbff;
          outline: none;
          font-family: inherit;
          transition: border-color 0.18s, box-shadow 0.18s;
        }
        .login-input:focus {
          border-color: #6366f1;
          box-shadow: 0 0 0 3px rgba(99,102,241,0.1);
          background: #fff;
        }
        .login-error {
          background: #fef2f2;
          border: 1.5px solid #fecaca;
          border-radius: 10px;
          padding: 10px 14px;
          font-size: 13px;
          color: #dc2626;
          font-weight: 600;
          margin-bottom: 16px;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .login-btn {
          width: 100%;
          padding: 13px;
          border-radius: 13px;
          border: none;
          background: linear-gradient(135deg, #6366f1, #818cf8);
          color: #fff;
          font-size: 15px;
          font-weight: 700;
          cursor: pointer;
          font-family: inherit;
          box-shadow: 0 4px 14px rgba(99,102,241,0.3);
          transition: all 0.18s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          margin-top: 4px;
        }
        .login-btn:hover { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(99,102,241,0.4); }
        .login-btn:active { transform: scale(0.98); }
        .login-btn:disabled { background: #e5e7eb; color: #9ca3af; box-shadow: none; transform: none; cursor: not-allowed; }
        /* Divider */
        .login-divider {
          display: flex; align-items: center; gap: 10px;
          margin: 18px 0;
          color: #d1d5db;
          font-size: 12px; font-weight: 600;
        }
        .login-divider::before,
        .login-divider::after {
          content: ''; flex: 1;
          height: 1px; background: #e5e7eb;
        }
        /* Google button */
        .login-google-btn {
          width: 100%;
          padding: 12px;
          border-radius: 13px;
          border: 1.5px solid #e5e7eb;
          background: #fff;
          color: #374151;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          font-family: inherit;
          transition: all 0.18s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.06);
        }
        .login-google-btn:hover {
          border-color: #c7d2fe;
          background: #fafbff;
          transform: translateY(-1px);
          box-shadow: 0 4px 14px rgba(0,0,0,0.1);
        }
        .login-google-btn:active { transform: scale(0.98); }
        .login-google-btn:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }
        .login-hint {
          text-align: center;
          font-size: 12px;
          color: #9ca3af;
          margin-top: 16px;
        }
        .login-spin {
          width: 16px; height: 16px;
          border-radius: 50%;
          border: 2.5px solid rgba(255,255,255,0.4);
          border-top-color: #fff;
          animation: spin 0.7s linear infinite;
        }
        .login-spin-dark {
          width: 16px; height: 16px;
          border-radius: 50%;
          border: 2.5px solid #e5e7eb;
          border-top-color: #6366f1;
          animation: spin 0.7s linear infinite;
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(18px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      <div className="login-bg">
        <div className="login-card">
          {/* Logo */}
          <div className="login-logo">
            <svg
              width="26"
              height="26"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25"
              />
            </svg>
          </div>

          <h1 className="login-title">Library Pro</h1>
          <p className="login-subtitle">Apne account mein sign in karein</p>

          {/* Tabs */}
          <div className="login-tabs">
            <button
              className={`login-tab${tab === "admin" ? " active" : ""}`}
              onClick={() => {
                setTab("admin");
                setError("");
              }}
            >
              👨‍💼 Admin
            </button>
            <button
              className={`login-tab${tab === "student" ? " active" : ""}`}
              onClick={() => {
                setTab("student");
                setError("");
              }}
            >
              🎓 Student
            </button>
          </div>

          {/* Error */}
          {error && (
            <div className="login-error">
              <svg
                width="14"
                height="14"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
                />
              </svg>
              {error}
            </div>
          )}

          {/* ── Google Sign-In (works for both admin & student) ── */}
          <button
            className="login-google-btn"
            onClick={handleGoogleLogin}
            disabled={googleLoading || loading}
          >
            {googleLoading ? (
              <span className="login-spin-dark" />
            ) : (
              <svg width="18" height="18" viewBox="0 0 48 48">
                <path
                  fill="#EA4335"
                  d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                />
                <path
                  fill="#4285F4"
                  d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                />
                <path
                  fill="#FBBC05"
                  d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                />
                <path
                  fill="#34A853"
                  d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                />
              </svg>
            )}
            {googleLoading
              ? "Sign in ho raha hai..."
              : "Google se Sign In karein"}
          </button>

          <div className="login-divider">ya</div>

          {/* Admin Form */}
          {tab === "admin" && (
            <form onSubmit={handleAdminLogin}>
              <div className="login-field">
                <label className="login-label">Email</label>
                <div className="login-input-wrap">
                  <span className="login-input-icon">
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
                    className="login-input"
                    type="email"
                    placeholder="admin@library.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="login-field">
                <label className="login-label">Password</label>
                <div className="login-input-wrap">
                  <span className="login-input-icon">
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
                    className="login-input"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
              </div>
              <button className="login-btn" type="submit" disabled={loading}>
                {loading ? <span className="login-spin" /> : null}
                {loading ? "Sign in ho raha hai..." : "Admin Login"}
              </button>
            </form>
          )}

          {/* Student Form */}
          {tab === "student" && (
            <form onSubmit={handleStudentLogin}>
              <div className="login-field">
                <label className="login-label">Phone Number</label>
                <div className="login-input-wrap">
                  <span className="login-input-icon">
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
                        d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z"
                      />
                    </svg>
                  </span>
                  <input
                    className="login-input"
                    type="tel"
                    placeholder="10-digit phone number"
                    value={phone}
                    onChange={(e) =>
                      setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))
                    }
                    required
                  />
                </div>
              </div>
              <button
                className="login-btn"
                type="submit"
                disabled={loading || phone.length !== 10}
              >
                {loading ? <span className="login-spin" /> : null}
                {loading ? "Sign in ho raha hai..." : "Student Login"}
              </button>
              <p className="login-hint">Aapka phone number hi password hai</p>
            </form>
          )}
        </div>
      </div>
    </>
  );
}
