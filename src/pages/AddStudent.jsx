// src/pages/AddStudent.jsx
import { useState, useEffect } from "react";
import {
  collection,
  addDoc,
  getDocs,
  updateDoc,
  doc,
} from "firebase/firestore";
import { db } from "../firebase";
import { useNavigate } from "react-router-dom";
import ShiftSelector from "../components/ShiftSelector";
import SeatLayout from "../components/SeatLayout";
import QRCode from "qrcode";

export default function AddStudent() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: "",
    phone: "",
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
      const studentData = {
        ...form,
        aadhaar: form.aadhaar.replace(/\s/g, ""),
        seatNumber: Number(form.seatNumber),
        feeAmount: Number(form.feeAmount),
        photoURL: "",
        status: "active",
        createdAt: new Date().toISOString(),
      };

      const docRef = await addDoc(collection(db, "students"), studentData);

      const qrData = JSON.stringify({
        id: docRef.id,
        name: form.name,
        seat: form.seatNumber,
        shift: form.shift,
      });
      const qrDataURL = await QRCode.toDataURL(qrData, {
        width: 300,
        margin: 2,
        color: { dark: "#1e1b4b", light: "#ffffff" },
      });

      await updateDoc(doc(db, "students", docRef.id), {
        qrURL: qrDataURL,
        qrData,
      });

      setSavedStudentId(docRef.id);
      setSuccess(true);
      setOccupiedSeats((prev) => [...prev, Number(form.seatNumber)]);
      setForm({
        name: "",
        phone: "",
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
        submit: "Student save karne mein error aaya. Dobara try karo.",
      });
    }
    setLoading(false);
  };

  const handleClear = () => {
    setForm({
      name: "",
      phone: "",
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
        /* ── Reset & Base ── */
        .as-page {
          min-height: 100vh;
          background: #f0f2f8;
          padding: 32px 16px 48px;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          opacity: 0;
          transform: translateY(18px);
          transition: opacity 0.5s ease, transform 0.5s ease;
        }
        .as-page.mounted {
          opacity: 1;
          transform: translateY(0);
        }
        .as-wrap {
          max-width: 720px;
          margin: 0 auto;
        }

        /* ── Page Header ── */
        .as-header {
          display: flex;
          align-items: center;
          gap: 14px;
          margin-bottom: 28px;
          animation: slideDown 0.45s cubic-bezier(.22,1,.36,1) both;
        }
        .as-header-icon {
          width: 44px;
          height: 44px;
          border-radius: 14px;
          background: linear-gradient(135deg, #6366f1, #818cf8);
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 14px rgba(99,102,241,0.35);
          flex-shrink: 0;
        }
        .as-header-icon svg { color: #fff; }
        .as-header-text h1 {
          font-size: 22px;
          font-weight: 800;
          color: #1e1b4b;
          letter-spacing: -0.4px;
          margin: 0 0 2px;
        }
        .as-header-text p {
          font-size: 13px;
          color: #6b7280;
          margin: 0;
        }

        /* ── Banners ── */
        .as-banner {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 14px 18px;
          border-radius: 14px;
          margin-bottom: 20px;
          animation: slideInLeft 0.35s cubic-bezier(.22,1,.36,1) both;
        }
        .as-banner-success {
          background: #ecfdf5;
          border: 1.5px solid #a7f3d0;
          color: #065f46;
        }
        .as-banner-error {
          background: #fef2f2;
          border: 1.5px solid #fecaca;
          color: #991b1b;
        }
        .as-banner-inner { display: flex; align-items: center; gap: 12px; }
        .as-banner-check {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: #10b981;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .as-banner-check svg { color: #fff; }
        .as-banner-title { font-size: 13px; font-weight: 700; margin: 0 0 1px; }
        .as-banner-sub { font-size: 12px; color: #059669; margin: 0; }
        .as-banner-btn {
          background: #d1fae5;
          border: none;
          color: #065f46;
          font-size: 12px;
          font-weight: 700;
          padding: 7px 14px;
          border-radius: 9px;
          cursor: pointer;
          white-space: nowrap;
          transition: background 0.15s;
        }
        .as-banner-btn:hover { background: #a7f3d0; }

        /* ── Card ── */
        .as-card {
          background: #fff;
          border-radius: 20px;
          border: 1.5px solid #e5e7eb;
          box-shadow: 0 2px 20px rgba(99,102,241,0.06), 0 1px 4px rgba(0,0,0,0.04);
          overflow: hidden;
          margin-bottom: 20px;
        }

        /* ── Section ── */
        .as-section {
          padding: 24px 24px;
          animation: fadeUp 0.4s cubic-bezier(.22,1,.36,1) both;
        }
        .as-section-heading {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          margin-bottom: 20px;
        }
        .as-section-icon {
          width: 30px;
          height: 30px;
          border-radius: 9px;
          background: #eef2ff;
          border: 1.5px solid #c7d2fe;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #6366f1;
          flex-shrink: 0;
          margin-top: 1px;
        }
        .as-section-title {
          font-size: 14px;
          font-weight: 800;
          color: #1e1b4b;
          margin: 0 0 2px;
        }
        .as-section-sub {
          font-size: 12px;
          color: #9ca3af;
          margin: 0;
        }
        .as-divider {
          height: 1px;
          background: #f1f3f9;
          margin: 0 24px;
        }

        /* ── Grid ── */
        .as-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }
        .as-col-full { grid-column: 1 / -1; }
        @media (max-width: 560px) {
          .as-grid { grid-template-columns: 1fr; }
          .as-col-full { grid-column: 1; }
        }

        /* ── Field ── */
        .as-field { display: flex; flex-direction: column; gap: 6px; }
        .as-label {
          font-size: 11px;
          font-weight: 700;
          color: #6b7280;
          text-transform: uppercase;
          letter-spacing: 0.6px;
        }
        .as-label-req { color: #ef4444; margin-left: 2px; }
        .as-input-wrap { position: relative; }
        .as-input-icon {
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          color: #9ca3af;
          pointer-events: none;
          display: flex;
          align-items: center;
        }
        .as-input {
          width: 100%;
          box-sizing: border-box;
          border-radius: 12px;
          border: 1.5px solid #e5e7eb;
          background: #fafbff;
          color: #1e1b4b;
          font-size: 14px;
          padding: 10px 12px 10px 38px;
          outline: none;
          transition: border-color 0.18s, box-shadow 0.18s, background 0.18s;
          font-family: inherit;
        }
        .as-input.no-icon { padding-left: 12px; }
        .as-input:hover:not(:focus) { border-color: #c7d2fe; background: #f5f7ff; }
        .as-input:focus { border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99,102,241,0.12); background: #fff; }
        .as-input.error { border-color: #fca5a5; background: #fff8f8; }
        .as-input.error:focus { border-color: #ef4444; box-shadow: 0 0 0 3px rgba(239,68,68,0.1); }
        .as-input.valid { border-color: #6ee7b7; background: #f0fdf4; }
        .as-input-tick {
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          color: #10b981;
          display: flex;
        }
        .as-error-msg {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 11.5px;
          color: #ef4444;
          font-weight: 500;
        }
        .as-hint { font-size: 11.5px; color: #9ca3af; }

        /* ── Fee Chips ── */
        .as-chips { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
        .as-chip {
          padding: 5px 12px;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          border: 1.5px solid #e5e7eb;
          background: #f8fafc;
          color: #6b7280;
          transition: all 0.15s ease;
        }
        .as-chip:hover { border-color: #a5b4fc; color: #6366f1; background: #eef2ff; }
        .as-chip.active { background: #6366f1; color: #fff; border-color: #6366f1; box-shadow: 0 2px 8px rgba(99,102,241,0.28); }

        /* ── QR Info ── */
        .as-qr-info {
          margin: 0 24px 24px;
          background: linear-gradient(135deg, #eef2ff, #f5f3ff);
          border: 1.5px solid #c7d2fe;
          border-radius: 14px;
          padding: 14px 16px;
          display: flex;
          align-items: center;
          gap: 14px;
        }
        .as-qr-icon {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          background: #c7d2fe;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #4338ca;
          flex-shrink: 0;
        }
        .as-qr-title { font-size: 12px; font-weight: 700; color: #4338ca; margin: 0 0 2px; }
        .as-qr-sub { font-size: 11.5px; color: #6366f1; margin: 0; }

        /* ── Seat Legend ── */
        .as-seat-box {
          background: #f8fafc;
          border: 1.5px solid #f1f3f9;
          border-radius: 14px;
          padding: 16px;
        }
        .as-legend {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 10px;
          margin-bottom: 16px;
        }
        .as-legend-items { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
        .as-legend-dot {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          color: #6b7280;
        }
        .as-dot {
          width: 12px;
          height: 12px;
          border-radius: 3px;
        }
        .as-dot-green { background: #10b981; }
        .as-dot-red { background: #f87171; }
        .as-dot-indigo { background: #6366f1; }
        .as-seat-count { font-size: 12px; font-weight: 600; color: #6b7280; }

        /* ── Submit Buttons ── */
        .as-actions {
          display: flex;
          gap: 12px;
          justify-content: flex-end;
          flex-wrap: wrap;
          margin-top: 24px;
        }
        .as-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 12px 24px;
          border-radius: 13px;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          border: none;
          outline: none;
          transition: all 0.17s ease;
          font-family: inherit;
          letter-spacing: -0.1px;
        }
        .as-btn:active { transform: scale(0.97); }
        .as-btn-ghost {
          background: #fff;
          color: #6b7280;
          border: 1.5px solid #e5e7eb;
        }
        .as-btn-ghost:hover { background: #f8fafc; border-color: #c7d2fe; color: #4338ca; }
        .as-btn-primary {
          background: linear-gradient(135deg, #6366f1, #818cf8);
          color: #fff;
          box-shadow: 0 4px 14px rgba(99,102,241,0.3);
        }
        .as-btn-primary:hover { background: linear-gradient(135deg, #4f46e5, #6366f1); box-shadow: 0 6px 18px rgba(99,102,241,0.4); transform: translateY(-1px); }
        .as-btn-primary:disabled { background: #e5e7eb; color: #9ca3af; box-shadow: none; transform: none; cursor: not-allowed; }
        .as-spin {
          animation: spin 0.8s linear infinite;
          display: flex;
        }
        .as-footer-note {
          text-align: center;
          font-size: 12px;
          color: #9ca3af;
          margin-top: 20px;
          padding-bottom: 8px;
        }
        .as-footer-note span { color: #ef4444; }

        /* ── Animations ── */
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-14px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideInLeft {
          from { opacity: 0; transform: translateX(-12px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>

      <div className={`as-page${mounted ? " mounted" : ""}`}>
        <div className="as-wrap">
          {/* Header */}
          <div className="as-header">
            <div className="as-header-icon">
              <svg
                width="22"
                height="22"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.3"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 4.5v15m7.5-7.5h-15"
                />
              </svg>
            </div>
            <div className="as-header-text">
              <h1>New Student</h1>
              <p>Details bharo aur seat assign karo</p>
            </div>
          </div>

          {/* Success Banner */}
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
                    QR code generate hokar save ho gaya.
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

          {/* Submit Error */}
          {errors.submit && (
            <div className="as-banner as-banner-error">
              <div className="as-banner-inner">
                <svg
                  width="18"
                  height="18"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z"
                  />
                </svg>
                <span style={{ fontSize: 13 }}>{errors.submit}</span>
              </div>
            </div>
          )}

          {/* Main Card */}
          <div className="as-card">
            {/* Personal Info */}
            <div className="as-section" style={{ animationDelay: "0.05s" }}>
              <div className="as-section-heading">
                <div className="as-section-icon">
                  <svg
                    width="16"
                    height="16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.9"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0"
                    />
                  </svg>
                </div>
                <div>
                  <p className="as-section-title">Personal Info</p>
                  <p className="as-section-sub">Student ki basic details</p>
                </div>
              </div>
              <div className="as-grid">
                <Field
                  label="Student ka Naam"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  placeholder="jaise Rahul Kumar"
                  required
                  error={errors.name}
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
                        d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0"
                      />
                    </svg>
                  }
                />
                <Field
                  label="Phone Number"
                  name="phone"
                  value={form.phone}
                  type="tel"
                  onChange={handleChange}
                  onBlur={handleBlur}
                  placeholder="jaise 9876543210"
                  required
                  error={errors.phone}
                  valid={
                    !errors.phone &&
                    form.phone.length === 10 &&
                    /^[6-9]\d{9}$/.test(form.phone)
                  }
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
                        d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z"
                      />
                    </svg>
                  }
                />
                <div className="as-col-full">
                  <Field
                    label="Aadhaar Number"
                    name="aadhaar"
                    value={form.aadhaar}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    placeholder="XXXX XXXX XXXX"
                    error={errors.aadhaar}
                    hint="12-digit Aadhaar — securely store hoga"
                    valid={
                      !errors.aadhaar &&
                      form.aadhaar.replace(/\s/g, "").length === 12
                    }
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
                          d="M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5zm6-10.125a1.875 1.875 0 11-3.75 0 1.875 1.875 0 013.75 0zm1.294 6.336a6.721 6.721 0 01-3.17.789 6.721 6.721 0 01-3.168-.789 3.376 3.376 0 016.338 0z"
                        />
                      </svg>
                    }
                  />
                </div>
              </div>
            </div>

            <div className="as-divider" />

            {/* Fee & Seat */}
            <div className="as-section" style={{ animationDelay: "0.1s" }}>
              <div className="as-section-heading">
                <div className="as-section-icon">
                  <svg
                    width="16"
                    height="16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.9"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z"
                    />
                  </svg>
                </div>
                <div>
                  <p className="as-section-title">Fee aur Seat</p>
                </div>
              </div>
              <div className="as-grid">
                <div>
                  <Field
                    label="Monthly Fee (₹)"
                    name="feeAmount"
                    value={form.feeAmount}
                    type="number"
                    onChange={handleChange}
                    placeholder="jaise 800"
                    error={errors.feeAmount}
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
                          d="M15 8.25H9m6 3H9m3 6l-3-3h1.5a3 3 0 100-6M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                    }
                  />
                  <div className="as-chips">
                    {[500, 700, 800, 1000, 1200].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        className={`as-chip${form.feeAmount === String(amt) ? " active" : ""}`}
                        onClick={() =>
                          setForm((prev) => ({
                            ...prev,
                            feeAmount: String(amt),
                          }))
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
                  placeholder="jaise 5"
                  required
                  error={errors.seatNumber}
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
                        d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z"
                      />
                    </svg>
                  }
                />
                <Field
                  label="Start Date"
                  name="startDate"
                  value={form.startDate}
                  type="date"
                  onChange={handleChange}
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
                        d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75"
                      />
                    </svg>
                  }
                />
                <Field
                  label="End Date"
                  name="endDate"
                  value={form.endDate}
                  type="date"
                  onChange={handleChange}
                  error={errors.endDate}
                  hint="Start date se +1 month auto-set"
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
                        d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  }
                />
              </div>
            </div>

            <div className="as-divider" />

            {/* Shift */}
            <div className="as-section" style={{ animationDelay: "0.15s" }}>
              <div className="as-section-heading">
                <div className="as-section-icon">
                  <svg
                    width="16"
                    height="16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.9"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <div>
                  <p className="as-section-title">Shift chunein</p>
                </div>
              </div>
              {errors.shift && (
                <p className="as-error-msg" style={{ marginBottom: 8 }}>
                  {errors.shift}
                </p>
              )}
              <ShiftSelector
                value={form.shift}
                onChange={(val) => setForm({ ...form, shift: val })}
              />
            </div>

            <div className="as-divider" />

            {/* Seat Layout */}
            <div className="as-section" style={{ animationDelay: "0.2s" }}>
              <div className="as-section-heading">
                <div className="as-section-icon">
                  <svg
                    width="16"
                    height="16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.9"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z"
                    />
                  </svg>
                </div>
                <div>
                  <p className="as-section-title">Seat Layout</p>
                  <p className="as-section-sub">
                    Green seat tap karke select karo
                  </p>
                </div>
              </div>
              <div className="as-seat-box">
                <div className="as-legend">
                  <div className="as-legend-items">
                    <span className="as-legend-dot">
                      <span className="as-dot as-dot-green" />
                      Available
                    </span>
                    <span className="as-legend-dot">
                      <span className="as-dot as-dot-red" />
                      Occupied
                    </span>
                    <span className="as-legend-dot">
                      <span className="as-dot as-dot-indigo" />
                      Selected
                    </span>
                  </div>
                  <span className="as-seat-count">
                    {30 - occupiedSeats.length} seats free
                  </span>
                </div>
                <SeatLayout
                  totalSeats={30}
                  occupiedSeats={occupiedSeats}
                  selectedSeat={Number(form.seatNumber)}
                  onSelect={(seat) => {
                    setForm((prev) => ({ ...prev, seatNumber: String(seat) }));
                    setErrors((prev) => ({ ...prev, seatNumber: "" }));
                  }}
                />
              </div>
            </div>

            {/* QR Info */}
            <div className="as-qr-info">
              <div className="as-qr-icon">
                <svg
                  width="18"
                  height="18"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z"
                  />
                </svg>
              </div>
              <div>
                <p className="as-qr-title">
                  QR Code auto-generate hoga save karte waqt
                </p>
                <p className="as-qr-sub">
                  Unique QR code create hokar store ho jaega — Attendance
                  scanner mein use karo.
                </p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="as-actions">
            <button
              type="button"
              className="as-btn as-btn-ghost"
              onClick={handleClear}
            >
              Form Clear Karo
            </button>
            <button
              type="button"
              className="as-btn as-btn-primary"
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="as-spin">
                    <svg width="16" height="16" fill="none" viewBox="0 0 24 24">
                      <circle
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                        style={{ opacity: 0.25 }}
                      />
                      <path
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                        style={{ opacity: 0.75 }}
                      />
                    </svg>
                  </span>
                  Save ho raha hai...
                </>
              ) : (
                <>
                  <svg
                    width="16"
                    height="16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 3.75H6.912a2.25 2.25 0 00-2.15 1.588L2.35 13.177a2.25 2.25 0 00-.1.661V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18v-4.162c0-.224-.034-.447-.1-.661L19.24 5.338a2.25 2.25 0 00-2.15-1.588H15M2.25 13.5h3.86a2.25 2.25 0 012.012 1.244l.256.512a2.25 2.25 0 002.013 1.244h3.218a2.25 2.25 0 002.013-1.244l.256-.512a2.25 2.25 0 012.013-1.244h3.859M12 3v8.25m0 0l-3-3m3 3l3-3"
                    />
                  </svg>
                  Student Save Karo
                </>
              )}
            </button>
          </div>

          <p className="as-footer-note">
            <span>*</span> wale fields zaruri hain
          </p>
        </div>
      </div>
    </>
  );
}

/* ── Field Component ── */
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
        {label}
        {required && <span className="as-label-req">*</span>}
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
          min={type === "number" ? 0 : undefined}
          className={`as-input${!icon ? " no-icon" : ""}${error ? " error" : ""}${valid && !error ? " valid" : ""}`}
        />
        {valid && !error && (
          <span className="as-input-tick">
            <svg
              width="15"
              height="15"
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
          </span>
        )}
      </div>
      {error && (
        <p className="as-error-msg">
          <svg width="11" height="11" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
          {error}
        </p>
      )}
      {hint && !error && <p className="as-hint">{hint}</p>}
    </div>
  );
}
