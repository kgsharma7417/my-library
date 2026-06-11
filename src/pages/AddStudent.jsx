// src/pages/AddStudent.jsx
import { useState, useEffect } from "react";
import {
  collection,
  addDoc,
  getDocs,
  updateDoc,
  doc,
  setDoc,
} from "firebase/firestore";
import { db, secondaryAuth } from "../firebase"; // 👈 custom secondaryAuth import kiya h
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import ShiftSelector from "../components/ShiftSelector";
import SeatLayout from "../components/SeatLayout";
import QRCode from "qrcode";

// Firebase Auth se primary utilities import karne ki zarurat nahi h ab 👈
import { createUserWithEmailAndPassword } from "firebase/auth";

export default function AddStudent() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    password: "",
    aadhaar: "",
    shift: "morning",
    seatNumber: "",
    feeAmount: "",
    startDate: today(),
    endDate: oneMonthLater(),
  });

  const [occupiedSeats, setOccupiedSeats] = useState([]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [savedStudentId, setSavedStudentId] = useState(null);
  const [errors, setErrors] = useState({});
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setTimeout(() => setMounted(true), 50);
    const fetchSeats = async () => {
      const snapshot = await getDocs(collection(db, "students"));
      const seats = snapshot.docs.map((d) => d.data().seatNumber);
      setOccupiedSeats(seats.filter(Boolean).map(Number));
    };
    fetchSeats();
  }, []);

  function today() {
    return new Date().toISOString().split("T")[0];
  }
  function oneMonthLater() {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    return d.toISOString().split("T")[0];
  }

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === "aadhaar") {
      const cleaned = value.replace(/\D/g, "").slice(0, 12);
      const formatted = cleaned.replace(/(\d{4})(?=\d)/g, "$1 ").trim();
      setForm((prev) => ({ ...prev, aadhaar: formatted }));
      if (errors.aadhaar) setErrors((prev) => ({ ...prev, aadhaar: "" }));
      return;
    }
    if (name === "startDate") {
      const start = new Date(value);
      start.setMonth(start.getMonth() + 1);
      const newEnd = start.toISOString().split("T")[0];
      setForm((prev) => ({ ...prev, startDate: value, endDate: newEnd }));
      if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
      return;
    }
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const handleBlur = (e) => {
    const { name } = e.target;
    const partial = {};
    if (name === "phone" && form.phone) {
      if (!/^[6-9]\d{9}$/.test(form.phone))
        partial.phone = "Valid 10-digit mobile number chahiye";
    }
    if (name === "aadhaar" && form.aadhaar) {
      const digits = form.aadhaar.replace(/\s/g, "");
      if (digits.length !== 12)
        partial.aadhaar = "Aadhaar 12 digits ka hona chahiye";
    }
    if (Object.keys(partial).length)
      setErrors((prev) => ({ ...prev, ...partial }));
  };

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = "Student ka naam zaruri hai";
    if (!form.phone.trim()) e.phone = "Phone number zaruri hai";
    else if (!/^[6-9]\d{9}$/.test(form.phone))
      e.phone = "Valid 10-digit mobile number chahiye";

    if (!form.email.trim()) e.email = "Student Login Email zaruri hai";
    if (!form.password || form.password.length < 6)
      e.password = "Password kam se kam 6 characters ka hona chahiye";

    if (form.aadhaar) {
      const digits = form.aadhaar.replace(/\s/g, "");
      if (digits.length !== 12) e.aadhaar = "Aadhaar 12 digits ka hona chahiye";
    }
    if (!form.seatNumber) e.seatNumber = "Seat select karo";
    else if (occupiedSeats.includes(Number(form.seatNumber)))
      e.seatNumber = `Seat ${form.seatNumber} already occupied hai`;
    if (!form.shift) e.shift = "Shift select karo";
    if (form.feeAmount && Number(form.feeAmount) <= 0)
      e.feeAmount = "Valid fee amount enter karo";
    if (form.startDate && form.endDate && form.endDate < form.startDate)
      e.endDate = "End date start date se pehle nahi ho sakti";
    return e;
  };

  const handleSubmit = async () => {
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    setLoading(true);
    try {
      let automaticUID = "";

      // Step 1: secondaryAuth ka use karke account banana taaki session override na ho 👈
      try {
        const userCredential = await createUserWithEmailAndPassword(
          secondaryAuth, // 👈 Pura khel yahan change hua h (secondaryAuth instance)
          form.email.trim(),
          form.password,
        );
        automaticUID = userCredential.user.uid;
      } catch (authErr) {
        console.error("Auth Register Error Context: ", authErr);
        if (authErr.code === "auth/email-already-in-use") {
          throw new Error("Yeh Email ID library mein pehle se registered hai.");
        } else {
          throw new Error("Authentication failure: " + authErr.message);
        }
      }

      // Metadata structures
      const studentData = {
        name: form.name,
        phone: form.phone,
        email: form.email.trim(),
        aadhaar: form.aadhaar.replace(/\s/g, ""),
        shift: form.shift,
        seatNumber: Number(form.seatNumber),
        feeAmount: Number(form.feeAmount),
        startDate: form.startDate,
        endDate: form.endDate,
        userUID: automaticUID,
        photoURL: "",
        status: "active",
        createdAt: new Date().toISOString(),
        adminId: user.uid,
      };

      const docRef = await addDoc(collection(db, "students"), studentData);
      const studentDocID = docRef.id;

      const qrData = JSON.stringify({
        id: studentDocID,
        name: form.name,
        seat: form.seatNumber,
        shift: form.shift,
      });
      const qrDataURL = await QRCode.toDataURL(qrData, {
        width: 300,
        margin: 2,
        color: { dark: "#1e1b4b", light: "#ffffff" },
      });

      await updateDoc(doc(db, "students", studentDocID), {
        qrURL: qrDataURL,
        qrData,
      });

      await setDoc(doc(db, "users", automaticUID), {
        role: "student",
        studentId: studentDocID,
      });

      setSavedStudentId(studentDocID);
      setSuccess(true);
      setOccupiedSeats((prev) => [...prev, Number(form.seatNumber)]);

      setForm({
        name: "",
        phone: "",
        email: "",
        password: "",
        aadhaar: "",
        shift: "morning",
        seatNumber: "",
        feeAmount: "",
        startDate: today(),
        endDate: oneMonthLater(),
      });
      setErrors({});
      setTimeout(() => setSuccess(false), 6000);
    } catch (err) {
      console.error(err);
      setErrors({
        submit:
          err.message || "Student save karne mein error aaya. Dobara try karo.",
      });
    }
    setLoading(false);
  };

  const handleClear = () => {
    setForm({
      name: "",
      phone: "",
      email: "",
      password: "",
      aadhaar: "",
      shift: "morning",
      seatNumber: "",
      feeAmount: "",
      startDate: today(),
      endDate: oneMonthLater(),
    });
    setErrors({});
  };

  return (
    <>
      <style>{`
        .as-page { min-height: 100vh; background: #f0f2f8; padding: 32px 16px 48px; font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; opacity: 0; transform: translateY(18px); transition: opacity 0.5s ease, transform 0.5s ease; }
        .as-page.mounted { opacity: 1; transform: translateY(0); }
        .as-wrap { max-width: 720px; margin: 0 auto; }
        .as-header { display: flex; align-items: center; gap: 14px; margin-bottom: 28px; animation: slideDown 0.45s cubic-bezier(.22,1,.36,1) both; }
        .as-header-icon { width: 44px; height: 44px; border-radius: 14px; background: linear-gradient(135deg, #6366f1, #818cf8); display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 14px rgba(99,102,241,0.35); flex-shrink: 0; font-size: 20px; }
        .as-header-text h1 { font-size: 22px; font-weight: 800; color: #1e1b4b; letter-spacing: -0.4px; margin: 0 0 2px; }
        .as-header-text p { font-size: 13px; color: #6b7280; margin: 0; }
        .as-banner { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 14px 18px; border-radius: 14px; margin-bottom: 20px; animation: slideInLeft 0.35s cubic-bezier(.22,1,.36,1) both; }
        .as-banner-success { background: #ecfdf5; border: 1.5px solid #a7f3d0; color: #065f46; }
        .as-banner-error { background: #fef2f2; border: 1.5px solid #fecaca; color: #991b1b; }
        .as-banner-inner { display: flex; align-items: center; gap: 12px; }
        .as-banner-check { width: 28px; height: 28px; border-radius: 50%; background: #10b981; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .as-banner-check svg { color: #fff; }
        .as-banner-title { font-size: 13px; font-weight: 700; margin: 0 0 1px; }
        .as-banner-sub { font-size: 12px; color: #059669; margin: 0; }
        .as-banner-btn { background: #d1fae5; border: none; color: #065f46; font-size: 12px; font-weight: 700; padding: 7px 14px; border-radius: 9px; cursor: pointer; white-space: nowrap; transition: background 0.15s; }
        .as-banner-btn:hover { background: #a7f3d0; }
        .as-card { background: #fff; border-radius: 20px; border: 1.5px solid #e5e7eb; box-shadow: 0 2px 20px rgba(99,102,241,0.06); overflow: hidden; margin-bottom: 20px; }
        .as-section { padding: 24px 24px; animation: fadeUp 0.4s cubic-bezier(.22,1,.36,1) both; }
        .as-section-heading { display: flex; align-items: flex-start; gap: 12px; margin-bottom: 20px; }
        .as-section-icon { width: 30px; height: 30px; border-radius: 9px; background: #eef2ff; border: 1.5px solid #c7d2fe; display: flex; align-items: center; justify-content: center; color: #6366f1; flex-shrink: 0; margin-top: 1px; }
        .as-section-title { font-size: 14px; font-weight: 800; color: #1e1b4b; margin: 0 0 2px; }
        .as-section-sub { font-size: 12px; color: #9ca3af; margin: 0; }
        .as-divider { height: 1px; background: #f1f3f9; margin: 0 24px; }
        .as-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .as-col-full { grid-column: 1 / -1; }
        .as-field { display: flex; flex-direction: column; gap: 6px; }
        .as-label { font-size: 11px; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: 0.6px; }
        .as-label-req { color: #ef4444; margin-left: 2px; }
        .as-input-wrap { position: relative; }
        .as-input-icon { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #9ca3af; pointer-events: none; display: flex; align-items: center; }
        .as-input { width: 100%; box-sizing: border-box; border-radius: 12px; border: 1.5px solid #e5e7eb; background: #fafbff; color: #1e1b4b; font-size: 14px; padding: 10px 12px 10px 38px; outline: none; transition: border-color 0.18s, box-shadow 0.18s, background 0.18s; font-family: inherit; }
        .as-input.no-icon { padding-left: 12px; }
        .as-input:hover:not(:focus) { border-color: #c7d2fe; background: #f5f7ff; }
        .as-input:focus { border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99,102,241,0.12); background: #fff; }
        .as-input.error { border-color: #fca5a5; background: #fff8f8; }
        .as-input.error:focus { border-color: #ef4444; box-shadow: 0 0 0 3px rgba(239,68,68,0.1); }
        .as-input.valid { border-color: #6ee7b7; background: #f0fdf4; }
        .as-input-tick { position: absolute; right: 12px; top: 50%; transform: translateY(-50%); color: #10b981; display: flex; }
        .as-error-msg { display: flex; align-items: center; gap: 4px; font-size: 11.5px; color: #ef4444; font-weight: 500; }
        .as-hint { font-size: 11.5px; color: #9ca3af; }
        .as-chips { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
        .as-chip { padding: 5px 12px; border-radius: 8px; font-size: 12px; font-weight: 700; cursor: pointer; border: 1.5px solid #e5e7eb; background: #f8fafc; color: #6b7280; transition: all 0.15s ease; }
        .as-chip:hover { border-color: #a5b4fc; color: #6366f1; background: #eef2ff; }
        .as-chip.active { background: #6366f1; color: #fff; border-color: #6366f1; box-shadow: 0 2px 8px rgba(99,102,241,0.28); }
        .as-seat-box { background: #f8fafc; border: 1.5px solid #f1f3f9; border-radius: 14px; padding: 16px; }
        .as-legend { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; margin-bottom: 16px; }
        .as-legend-items { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
        .as-legend-dot { display: flex; align-items: center; gap: 6px; font-size: 12px; color: #6b7280; }
        .as-dot { width: 12px; height: 12px; border-radius: 3px; }
        .as-dot-green { background: #10b981; } .as-dot-red { background: #f87171; } .as-dot-indigo { background: #6366f1; }
        .as-seat-count { font-size: 12px; font-weight: 600; color: #6b7280; }
        .as-actions { display: flex; gap: 12px; justify-content: flex-end; flex-wrap: wrap; margin-top: 24px; }
        .as-btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 12px 24px; border-radius: 13px; font-size: 14px; font-weight: 700; cursor: pointer; border: none; outline: none; transition: all 0.17s ease; font-family: inherit; letter-spacing: -0.1px; }
        .as-btn:active { transform: scale(0.97); }
        .as-btn-ghost { background: #fff; color: #6b7280; border: 1.5px solid #e5e7eb; }
        .as-btn-ghost:hover { background: #f8fafc; border-color: #c7d2fe; color: #4338ca; }
        .as-btn-primary { background: linear-gradient(135deg, #6366f1, #818cf8); color: #fff; box-shadow: 0 4px 14px rgba(99,102,241,0.3); }
        .as-btn-primary:hover { background: linear-gradient(135deg, #4f46e5, #6366f1); box-shadow: 0 6px 18px rgba(99,102,241,0.4); transform: translateY(-1px); }
        .as-btn-primary:disabled { background: #e5e7eb; color: #9ca3af; box-shadow: none; transform: none; cursor: not-allowed; }
        .as-spin { animation: spin 0.8s linear infinite; display: flex; }
        .as-footer-note { text-align: center; font-size: 12px; color: #9ca3af; margin-top: 20px; padding-bottom: 8px; }
        .as-footer-note span { color: #ef4444; }
        @keyframes slideDown { from { opacity: 0; transform: translateY(-14px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes slideInLeft { from { opacity: 0; transform: translateX(-12px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      <div className={`as-page${mounted ? " mounted" : ""}`}>
        <div className="as-wrap">
          <div className="as-header">
            <div className="as-header-icon">📚</div>
            <div className="as-header-text">
              <h1>New Student Admission</h1>
              <p>
                Details fill karein, login account aur seat allocation automatic
                map ho jaega
              </p>
            </div>
          </div>

          {success && (
            <div className="as-banner as-banner-success">
              <div className="as-banner-inner">
                <div className="as-banner-check">
                  <svg
                    width="14"
                    height="14"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M4.5 12.75l6 6 9-13.5"
                    />
                  </svg>
                </div>
                <div>
                  <p className="as-banner-title">Student register ho gaya!</p>
                  <p className="as-banner-sub">
                    Auth credentials aur dashboard path correctly sync ho chuke
                    hain.
                  </p>
                </div>
              </div>
              {savedStudentId && (
                <button
                  className="as-banner-btn"
                  onClick={() => navigate(`/students/${savedStudentId}`)}
                >
                  Profile dekhein →
                </button>
              )}
            </div>
          )}

          {errors.submit && (
            <div className="as-banner as-banner-error">
              <div className="as-banner-inner">
                <span style={{ fontSize: 13 }}>{errors.submit}</span>
              </div>
            </div>
          )}

          <div className="as-card">
            {/* Section 1: Credentials Integration */}
            <div className="as-section">
              <div className="as-section-heading">
                <div className="as-section-icon">🔐</div>
                <div>
                  <p className="as-section-title">
                    1. Student Login Account Setup
                  </p>
                  <p className="as-section-sub">
                    Student ka email aur temporary password fill karein
                  </p>
                </div>
              </div>
              <div className="as-grid">
                <Field
                  label="Login Email ID"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="jaise rahul@gmail.com"
                  required
                  error={errors.email}
                  icon={
                    <svg
                      width="15"
                      height="15"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.9"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
                      />
                    </svg>
                  }
                />
                <Field
                  label="Security Password"
                  name="password"
                  value={form.password}
                  onChange={handleChange}
                  placeholder="Minimum 6 characters"
                  required
                  error={errors.password}
                  icon={
                    <svg
                      width="15"
                      height="15"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.9"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
                      />
                    </svg>
                  }
                />
              </div>
            </div>

            <div className="as-divider" />

            {/* Section 2: Personal Info */}
            <div className="as-section">
              <div className="as-section-heading">
                <div className="as-section-icon">👤</div>
                <div>
                  <p className="as-section-title">2. Personal Info</p>
                  <p className="as-section-sub">
                    Student ki basic profiling data
                  </p>
                </div>
              </div>
              <div className="as-grid">
                <Field
                  label="Student ka Naam"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  placeholder="Rahul Kumar"
                  required
                  error={errors.name}
                />
                <Field
                  label="Phone Number"
                  name="phone"
                  value={form.phone}
                  type="tel"
                  onChange={handleChange}
                  onBlur={handleBlur}
                  placeholder="9876543210"
                  required
                  error={errors.phone}
                />
                <div className="as-col-full">
                  <Field
                    label="Aadhaar Number"
                    name="aadhaar"
                    value={form.aadhaar}
                    onChange={handleChange}
                    placeholder="XXXX XXXX XXXX"
                    error={errors.aadhaar}
                  />
                </div>
              </div>
            </div>

            <div className="as-divider" />

            {/* Section 3: Fee & Seat */}
            <div className="as-section">
              <div className="as-grid">
                <div>
                  <Field
                    label="Monthly Fee (₹)"
                    name="feeAmount"
                    value={form.feeAmount}
                    type="number"
                    onChange={handleChange}
                    placeholder="800"
                    error={errors.feeAmount}
                  />
                  <div className="as-chips">
                    {[500, 700, 800, 1000, 1200].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        className={`as-chip${form.feeAmount === String(amt) ? " active" : ""}`}
                        onClick={() =>
                          setForm((p) => ({ ...p, feeAmount: String(amt) }))
                        }
                      >
                        ₹{amt}
                      </button>
                    ))}
                  </div>
                </div>
                <Field
                  label="Seat Number (1–30)"
                  name="seatNumber"
                  value={form.seatNumber}
                  type="number"
                  onChange={handleChange}
                  placeholder="5"
                  required
                  error={errors.seatNumber}
                />
                <Field
                  label="Start Date"
                  name="startDate"
                  value={form.startDate}
                  type="date"
                  onChange={handleChange}
                />
                <Field
                  label="End Date"
                  name="endDate"
                  value={form.endDate}
                  type="date"
                  onChange={handleChange}
                  error={errors.endDate}
                />
              </div>
            </div>

            <div className="as-divider" />

            {/* Shift */}
            <div className="as-section">
              <p className="as-label">Shift chunein</p>
              <ShiftSelector
                value={form.shift}
                onChange={(val) => setForm({ ...form, shift: val })}
              />
            </div>

            <div className="as-divider" />

            {/* Seat Layout */}
            <div className="as-section">
              <SeatLayout
                totalSeats={30}
                occupiedSeats={occupiedSeats}
                selectedSeat={Number(form.seatNumber)}
                onSelect={(seat) =>
                  setForm((prev) => ({ ...prev, seatNumber: String(seat) }))
                }
              />
            </div>
          </div>

          <div className="as-actions">
            <button
              type="button"
              className="as-btn as-btn-ghost"
              onClick={handleClear}
            >
              Form Clear
            </button>
            <button
              type="button"
              className="as-btn as-btn-primary"
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading ? "Creating Account & Saving..." : "Student Save Karo"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function Field({
  label,
  name,
  value,
  onChange,
  onBlur,
  placeholder,
  type = "text",
  required,
  error,
  hint,
  valid,
  icon,
}) {
  return (
    <div className="as-field">
      <label className="as-label">
        {label} {required && <span className="as-label-req">*</span>}
      </label>
      <div className="as-input-wrap">
        {icon && <span className="as-input-icon">{icon}</span>}
        <input
          type={type}
          name={name}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          placeholder={placeholder}
          className={`as-input ${!icon ? " no-icon" : ""} ${error ? " error" : ""}`}
        />
      </div>
      {error && <p className="as-error-msg">{error}</p>}
      {hint && !error && <p className="as-hint">{hint}</p>}
    </div>
  );
}
