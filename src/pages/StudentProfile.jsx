// src/pages/StudentProfile.jsx
import { useState, useEffect, useRef } from "react";
import {
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
} from "firebase/firestore";
import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import { db, storage } from "../firebase";
import { useNavigate, useParams } from "react-router-dom";
import QRCode from "qrcode";
import ShiftSelector from "../components/ShiftSelector";

// ─── Helpers ───────────────────────────────────────────
const shiftLabel = {
  morning: "Morning",
  afternoon: "Afternoon",
  evening: "Evening",
  fullday: "Full Day",
};
const shiftColor = {
  morning: "bg-amber-50 text-amber-700 border-amber-200",
  afternoon: "bg-sky-50 text-sky-700 border-sky-200",
  evening: "bg-violet-50 text-violet-700 border-violet-200",
  fullday: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

function addMonths(dateStr, months) {
  // endDate ko months extend karo
  const base = dateStr ? new Date(dateStr) : new Date();
  // agar date already expire ho gayi hai toh aaj se count karo
  const start = base < new Date() ? new Date() : base;
  start.setMonth(start.getMonth() + months);
  return start.toISOString().slice(0, 10);
}

// ─── Main Component ────────────────────────────────────
export default function StudentProfile() {
  const navigate = useNavigate();
  const { id } = useParams();
  const photoInputRef = useRef(null);

  const [student, setStudent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [qrDataURL, setQrDataURL] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [errors, setErrors] = useState({});
  const [toast, setToast] = useState(null);
  const [mounted, setMounted] = useState(false);

  // Renewal states
  const [showRenewModal, setShowRenewModal] = useState(false);
  const [renewMonths, setRenewMonths] = useState(1);
  const [renewAmount, setRenewAmount] = useState("");
  const [renewNote, setRenewNote] = useState("");
  const [renewLoading, setRenewLoading] = useState(false);

  // Payment history
  const [payments, setPayments] = useState([]);
  const [payTab, setPayTab] = useState("details"); // "details" | "payments"

  useEffect(() => {
    if (!id) return;
    setMounted(true);
    fetchStudent();
    fetchPayments();
  }, [id]);

  // ── Data Fetching ──────────────────────────────────────
  const fetchStudent = async () => {
    setLoading(true);
    try {
      const snap = await getDoc(doc(db, "students", id));
      if (!snap.exists()) {
        navigate("/students");
        return;
      }
      const data = { id: snap.id, ...snap.data() };
      setStudent(data);
      setForm(data);
      if (data.qrData) {
        const url = await QRCode.toDataURL(data.qrData, {
          width: 280,
          margin: 2,
          color: { dark: "#1e1b4b", light: "#ffffff" },
        });
        setQrDataURL(url);
      }
    } catch {
      showToast("Failed to load student.", "error");
    }
    setLoading(false);
  };

  const fetchPayments = async () => {
    try {
      const q = query(
        collection(db, "students", id, "payments"),
        orderBy("paidAt", "desc"),
      );
      const snap = await getDocs(q);
      setPayments(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch {
      /* silent */
    }
  };

  // ── Utilities ──────────────────────────────────────────
  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  // ── Form Handlers ──────────────────────────────────────
  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === "aadhaar") {
      const cleaned = value.replace(/\D/g, "").slice(0, 12);
      const formatted = cleaned.replace(/(\d{4})(?=\d)/g, "$1 ").trim();
      setForm((prev) => ({ ...prev, aadhaar: formatted }));
      return;
    }
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      showToast("Photo must be under 5MB", "error");
      return;
    }
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const validate = () => {
    const e = {};
    if (!form.name?.trim()) e.name = "Name is required";
    if (!form.phone?.trim()) e.phone = "Phone is required";
    else if (!/^[6-9]\d{9}$/.test(form.phone))
      e.phone = "Enter a valid 10-digit mobile number";
    return e;
  };

  const handleSave = async () => {
    const errs = validate();
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }
    setSaving(true);
    try {
      let photoURL = form.photoURL || "";
      if (photoFile) {
        const sRef = ref(
          storage,
          `students/photos/${Date.now()}_${photoFile.name}`,
        );
        await uploadBytes(sRef, photoFile);
        photoURL = await getDownloadURL(sRef);
      }
      const updatedData = {
        ...form,
        aadhaar: (form.aadhaar || "").replace(/\s/g, ""),
        seatNumber: Number(form.seatNumber),
        feeAmount: Number(form.feeAmount),
        photoURL,
        updatedAt: new Date().toISOString(),
      };
      await updateDoc(doc(db, "students", id), updatedData);
      setStudent({ ...updatedData, id });
      setPhotoFile(null);
      setPhotoPreview(null);
      setEditing(false);
      showToast("Student updated successfully!");
    } catch {
      showToast("Failed to save changes.", "error");
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      if (student.photoURL) {
        try {
          await deleteObject(ref(storage, student.photoURL));
        } catch (_) {}
      }
      await deleteDoc(doc(db, "students", id));
      navigate("/students", { state: { deleted: student.name } });
    } catch {
      showToast("Failed to delete student.", "error");
      setDeleting(false);
      setShowDeleteModal(false);
    }
  };

  // ── Renewal Handler ────────────────────────────────────
  const handleRenew = async () => {
    if (
      !renewAmount ||
      isNaN(Number(renewAmount)) ||
      Number(renewAmount) <= 0
    ) {
      showToast("Please enter a valid amount.", "error");
      return;
    }
    setRenewLoading(true);
    try {
      const newEndDate = addMonths(student.endDate, renewMonths);

      // 1. Payment record — student ke subcollection mein save karo
      await addDoc(collection(db, "students", id, "payments"), {
        amount: Number(renewAmount),
        months: renewMonths,
        note: renewNote.trim(),
        paidAt: new Date().toISOString(),
        prevEndDate: student.endDate || null,
        newEndDate,
      });

      // 2. Global payments collection mein bhi save karo (Finance page ke liye)
      await addDoc(collection(db, "payments"), {
        studentId: id,
        studentName: student.name,
        seatNumber: student.seatNumber,
        shift: student.shift,
        amount: Number(renewAmount),
        months: renewMonths,
        note: renewNote.trim(),
        paidAt: new Date().toISOString(),
        type: "renewal",
      });

      // 3. Student ka endDate + status update karo
      await updateDoc(doc(db, "students", id), {
        endDate: newEndDate,
        status: "active",
        updatedAt: new Date().toISOString(),
      });

      // 4. Local state update
      setStudent((prev) => ({
        ...prev,
        endDate: newEndDate,
        status: "active",
      }));
      setForm((prev) => ({ ...prev, endDate: newEndDate, status: "active" }));

      await fetchPayments();
      setShowRenewModal(false);
      setRenewMonths(1);
      setRenewAmount("");
      setRenewNote("");
      showToast(
        `✅ Renewed for ${renewMonths} month${renewMonths > 1 ? "s" : ""}! New end: ${newEndDate}`,
      );
    } catch (e) {
      showToast("Renewal failed: " + e.message, "error");
    }
    setRenewLoading(false);
  };

  // ── QR Handlers ────────────────────────────────────────
  const handleShareQR = async () => {
    if (!qrDataURL) return;
    const blob = await (await fetch(qrDataURL)).blob();
    const file = new File([blob], `${student.name}_QR.png`, {
      type: "image/png",
    });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: `${student.name}'s Attendance QR`,
        });
        return;
      } catch (_) {}
    }
    const link = document.createElement("a");
    link.href = qrDataURL;
    link.download = `${student.name}_QR.png`;
    link.click();
    showToast("QR code downloaded!");
  };

  const handleWhatsApp = () => {
    const msg = encodeURIComponent(
      `Hi ${student.name}! Your library QR code is attached.\nSeat: ${student.seatNumber} | Shift: ${student.shift}\nPlease save this for attendance.`,
    );
    window.open(`https://wa.me/91${student.phone}?text=${msg}`, "_blank");
  };

  // ── Derived Values ─────────────────────────────────────
  const daysLeft = student?.endDate
    ? Math.ceil((new Date(student.endDate) - new Date()) / 86400000)
    : null;

  const isExpired = daysLeft !== null && daysLeft < 0;
  const isExpiringSoon = daysLeft !== null && daysLeft >= 0 && daysLeft <= 7;

  const previewEndDate = showRenewModal
    ? addMonths(student?.endDate, renewMonths)
    : null;

  // ── Loading ────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-500">Loading profile...</p>
        </div>
      </div>
    );
  }
  if (!student) return null;

  // ─────────────────────────────────────────────────────
  return (
    <div
      className={`min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8 transition-all duration-500 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"}`}
    >
      <div className="mx-auto max-w-3xl">
        {/* ── Toast ── */}
        {toast && (
          <div
            className={`fixed top-4 right-4 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg text-sm font-medium animate-slide-in-right ${toast.type === "error" ? "bg-red-50 border border-red-200 text-red-700" : "bg-emerald-50 border border-emerald-200 text-emerald-700"}`}
          >
            {toast.type === "error" ? (
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            ) : (
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.5}
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4.5 12.75l6 6 9-13.5"
                />
              </svg>
            )}
            {toast.msg}
          </div>
        )}

        {/* ── Back + Actions ── */}
        <div className="flex items-center justify-between mb-6 animate-fade-in-down">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"
              />
            </svg>
            Back
          </button>
          <div className="flex items-center gap-2">
            {!editing ? (
              <>
                {/* ── RENEW BUTTON ── */}
                <button
                  onClick={() => {
                    setRenewAmount(String(student.feeAmount || ""));
                    setShowRenewModal(true);
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 active:scale-95 transition-all duration-150"
                >
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2.2}
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
                    />
                  </svg>
                  Renew
                </button>
                <button
                  onClick={() => setEditing(true)}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 active:scale-95 transition-all duration-150"
                >
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125"
                    />
                  </svg>
                  Edit
                </button>
                <button
                  onClick={() => setShowDeleteModal(true)}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold text-red-600 bg-red-50 border border-red-200 hover:bg-red-100 active:scale-95 transition-all duration-150"
                >
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
                    />
                  </svg>
                  Delete
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => {
                    setEditing(false);
                    setForm(student);
                    setPhotoFile(null);
                    setPhotoPreview(null);
                    setErrors({});
                  }}
                  className="px-3.5 py-2 rounded-xl text-sm font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 active:scale-95 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 active:scale-95 transition-all"
                >
                  {saving && (
                    <svg
                      className="w-3.5 h-3.5 animate-spin"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      />
                    </svg>
                  )}
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </>
            )}
          </div>
        </div>

        {/* ── Expired Banner ── */}
        {isExpired && (
          <div className="mb-4 flex items-center justify-between gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-2xl animate-fade-up">
            <div className="flex items-center gap-2.5">
              <span className="text-lg">⚠️</span>
              <div>
                <p className="text-sm font-bold text-red-700">
                  Subscription Expired
                </p>
                <p className="text-xs text-red-500">
                  {Math.abs(daysLeft)} din pehle expire hua — {student.endDate}
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                setRenewAmount(String(student.feeAmount || ""));
                setShowRenewModal(true);
              }}
              className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-red-500 hover:bg-red-600 active:scale-95 transition-all"
            >
              <svg
                className="w-3 h-3"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.5}
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
                />
              </svg>
              Abhi Renew Karo
            </button>
          </div>
        )}

        {/* ── Expiring Soon Banner ── */}
        {isExpiringSoon && !isExpired && (
          <div className="mb-4 flex items-center justify-between gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-2xl animate-fade-up">
            <div className="flex items-center gap-2.5">
              <span className="text-lg">🔔</span>
              <div>
                <p className="text-sm font-bold text-amber-700">
                  Subscription Jald Expire Hogi
                </p>
                <p className="text-xs text-amber-600">
                  Sirf {daysLeft} din bacha hai — {student.endDate} ko expire
                  hogi
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                setRenewAmount(String(student.feeAmount || ""));
                setShowRenewModal(true);
              }}
              className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-amber-700 bg-amber-100 border border-amber-300 hover:bg-amber-200 active:scale-95 transition-all"
            >
              Renew Karo
            </button>
          </div>
        )}

        {/* ── Profile Hero Card ── */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-5 animate-fade-up">
          <div className="px-5 py-6 sm:px-6 flex items-start gap-5">
            {/* Photo */}
            <div className="relative flex-shrink-0">
              <div className="w-20 h-20 rounded-2xl overflow-hidden bg-indigo-100 border-2 border-indigo-100">
                {photoPreview || student.photoURL ? (
                  <img
                    src={photoPreview || student.photoURL}
                    alt={student.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-indigo-600 font-bold text-2xl">
                    {student.name?.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              {editing && (
                <>
                  <button
                    onClick={() => photoInputRef.current?.click()}
                    className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-indigo-600 border-2 border-white flex items-center justify-center hover:bg-indigo-700 transition-colors"
                  >
                    <svg
                      className="w-3 h-3 text-white"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2.5}
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487z"
                      />
                    </svg>
                  </button>
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handlePhotoChange}
                  />
                </>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              {editing ? (
                <input
                  name="name"
                  value={form.name || ""}
                  onChange={handleChange}
                  className={`w-full text-lg font-bold text-slate-800 bg-transparent border-b-2 outline-none pb-0.5 mb-1 transition-colors ${errors.name ? "border-red-400" : "border-indigo-300 focus:border-indigo-600"}`}
                />
              ) : (
                <h1 className="text-xl font-bold text-slate-800 truncate">
                  {student.name}
                </h1>
              )}
              {errors.name && (
                <p className="text-xs text-red-500 mb-1">{errors.name}</p>
              )}
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${shiftColor[student.shift] || shiftColor.morning}`}
                >
                  {shiftLabel[student.shift] || student.shift}
                </span>
                <span className="text-slate-400 text-xs">•</span>
                <span className="text-sm text-slate-500">
                  Seat {student.seatNumber}
                </span>
                {/* Status badge */}
                <span className="text-slate-400 text-xs">•</span>
                {isExpired ? (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />
                    Expired
                  </span>
                ) : isExpiringSoon ? (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block animate-pulse" />
                    Expiring Soon
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                    Active
                  </span>
                )}
              </div>
              <div className="grid grid-cols-3 gap-3 mt-4">
                <StatBox
                  label="Monthly Fee"
                  value={`₹${student.feeAmount || 0}`}
                />
                <StatBox
                  label="Days Left"
                  value={
                    daysLeft !== null
                      ? isExpired
                        ? `${Math.abs(daysLeft)}d ago`
                        : daysLeft
                      : "—"
                  }
                  warn={isExpired}
                  positive={daysLeft !== null && !isExpired && !isExpiringSoon}
                />
                <StatBox
                  label="Joined"
                  value={
                    student.createdAt
                      ? new Date(student.createdAt).toLocaleDateString(
                          "en-IN",
                          { day: "numeric", month: "short" },
                        )
                      : "—"
                  }
                />
              </div>
            </div>
          </div>
        </div>

        {/* ── Tab Bar ── */}
        <div className="flex gap-1 bg-white border border-slate-200 rounded-2xl p-1.5 mb-5 shadow-sm">
          {[
            { id: "details", label: "Details", icon: "📋" },
            {
              id: "payments",
              label: `History (${payments.length})`,
              icon: "💳",
            },
            { id: "qr", label: "QR Code", icon: "⬛" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setPayTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 ${payTab === tab.id ? "bg-indigo-600 text-white shadow-md" : "text-slate-500 hover:bg-slate-50"}`}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* ═══════════════════════════════════════════════
            TAB: DETAILS
        ═══════════════════════════════════════════════ */}
        {payTab === "details" && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden animate-fade-up">
            <div className="px-5 py-4 border-b border-slate-100">
              <h2 className="text-sm font-bold text-slate-800">
                Student Details
              </h2>
            </div>
            <div className="px-5 py-4 space-y-4">
              {/* Phone */}
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                  Phone
                </label>
                {editing ? (
                  <div className="mt-1">
                    <input
                      name="phone"
                      type="tel"
                      value={form.phone || ""}
                      onChange={handleChange}
                      className={`w-full rounded-xl border text-slate-800 text-sm px-3 py-2 outline-none transition-all ${errors.phone ? "border-red-300 focus:ring-2 focus:ring-red-100" : "border-slate-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50"}`}
                    />
                    {errors.phone && (
                      <p className="text-xs text-red-500 mt-1">
                        {errors.phone}
                      </p>
                    )}
                  </div>
                ) : (
                  <a
                    href={`tel:${student.phone}`}
                    className="mt-0.5 block text-sm font-medium text-indigo-600 hover:text-indigo-700"
                  >
                    {student.phone}
                  </a>
                )}
              </div>

              {/* Aadhaar */}
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                  Aadhaar
                </label>
                {editing ? (
                  <input
                    name="aadhaar"
                    value={form.aadhaar || ""}
                    onChange={handleChange}
                    placeholder="XXXX XXXX XXXX"
                    className="mt-1 w-full rounded-xl border border-slate-200 text-slate-800 text-sm px-3 py-2 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 transition-all"
                  />
                ) : (
                  <p className="mt-0.5 text-sm text-slate-700 font-mono tracking-wider">
                    {student.aadhaar ? (
                      `XXXX XXXX ${student.aadhaar.slice(-4)}`
                    ) : (
                      <span className="text-slate-400 font-sans">
                        Not added
                      </span>
                    )}
                  </p>
                )}
              </div>

              {/* Seat */}
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                  Seat Number
                </label>
                {editing ? (
                  <input
                    name="seatNumber"
                    type="number"
                    value={form.seatNumber || ""}
                    onChange={handleChange}
                    min={1}
                    max={200}
                    className="mt-1 w-full rounded-xl border border-slate-200 text-slate-800 text-sm px-3 py-2 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 transition-all"
                  />
                ) : (
                  <p className="mt-0.5 text-sm text-slate-700">
                    Seat {student.seatNumber}
                  </p>
                )}
              </div>

              {/* Shift */}
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                  Shift
                </label>
                {editing ? (
                  <div className="mt-2">
                    <ShiftSelector
                      value={form.shift}
                      onChange={(v) => setForm((p) => ({ ...p, shift: v }))}
                      compact
                    />
                  </div>
                ) : (
                  <p className="mt-0.5 text-sm text-slate-700">
                    {shiftLabel[student.shift] || student.shift}
                  </p>
                )}
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                    Start Date
                  </label>
                  {editing ? (
                    <input
                      name="startDate"
                      type="date"
                      value={form.startDate || ""}
                      onChange={handleChange}
                      className="mt-1 w-full rounded-xl border border-slate-200 text-slate-800 text-sm px-3 py-2 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 transition-all"
                    />
                  ) : (
                    <p className="mt-0.5 text-sm text-slate-700">
                      {student.startDate || "—"}
                    </p>
                  )}
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                    End Date
                  </label>
                  {editing ? (
                    <input
                      name="endDate"
                      type="date"
                      value={form.endDate || ""}
                      onChange={handleChange}
                      className="mt-1 w-full rounded-xl border border-slate-200 text-slate-800 text-sm px-3 py-2 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 transition-all"
                    />
                  ) : (
                    <p
                      className={`mt-0.5 text-sm font-medium ${isExpired ? "text-red-600" : isExpiringSoon ? "text-amber-600" : "text-slate-700"}`}
                    >
                      {student.endDate || "—"}
                    </p>
                  )}
                </div>
              </div>

              {/* Fee */}
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                  Monthly Fee
                </label>
                {editing ? (
                  <input
                    name="feeAmount"
                    type="number"
                    value={form.feeAmount || ""}
                    onChange={handleChange}
                    min={0}
                    className="mt-1 w-full rounded-xl border border-slate-200 text-slate-800 text-sm px-3 py-2 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 transition-all"
                  />
                ) : (
                  <p className="mt-0.5 text-sm text-slate-700 font-semibold">
                    ₹{student.feeAmount || 0}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════
            TAB: PAYMENT HISTORY
        ═══════════════════════════════════════════════ */}
        {payTab === "payments" && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden animate-fade-up">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-800">
                  Payment History
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Saare renewal records
                </p>
              </div>
              <button
                onClick={() => {
                  setRenewAmount(String(student.feeAmount || ""));
                  setShowRenewModal(true);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 active:scale-95 transition-all"
              >
                + New Renewal
              </button>
            </div>
            <div className="divide-y divide-slate-100">
              {payments.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-12 text-slate-400">
                  <span className="text-4xl">💳</span>
                  <p className="text-sm font-semibold">
                    Koi payment record nahi
                  </p>
                  <p className="text-xs">Pehli renewal karein!</p>
                </div>
              ) : (
                payments.map((p, i) => (
                  <div
                    key={p.id}
                    className="px-5 py-4 flex items-start gap-3"
                    style={{ animationDelay: `${i * 0.05}s` }}
                  >
                    <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <svg
                        className="w-4 h-4 text-emerald-600"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z"
                        />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-bold text-slate-800">
                          ₹{p.amount.toLocaleString("en-IN")}
                        </p>
                        <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-100">
                          {p.months} month{p.months > 1 ? "s" : ""}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <p className="text-xs text-slate-400">
                          {new Date(p.paidAt).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </p>
                        {p.newEndDate && (
                          <>
                            <span className="text-slate-300">•</span>
                            <p className="text-xs text-slate-500">
                              Renewed till{" "}
                              <span className="font-semibold text-slate-700">
                                {p.newEndDate}
                              </span>
                            </p>
                          </>
                        )}
                      </div>
                      {p.note && (
                        <p className="text-xs text-slate-400 mt-1 italic">
                          "{p.note}"
                        </p>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
            {/* Total summary */}
            {payments.length > 0 && (
              <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-500">
                  {payments.length} payments total
                </p>
                <p className="text-sm font-bold text-slate-800">
                  Total: ₹
                  {payments
                    .reduce((s, p) => s + (p.amount || 0), 0)
                    .toLocaleString("en-IN")}
                </p>
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════
            TAB: QR CODE
        ═══════════════════════════════════════════════ */}
        {payTab === "qr" && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden animate-fade-up">
            <div className="px-5 py-4 border-b border-slate-100">
              <h2 className="text-sm font-bold text-slate-800">
                Attendance QR Code
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Scan at entry to mark attendance
              </p>
            </div>
            <div className="px-5 py-5 flex flex-col items-center">
              {qrDataURL ? (
                <>
                  <div className="w-48 h-48 rounded-2xl overflow-hidden border border-slate-100 bg-white p-2 mb-4">
                    <img
                      src={qrDataURL}
                      alt="QR Code"
                      className="w-full h-full"
                    />
                  </div>
                  <p className="text-xs text-slate-500 mb-4 text-center">
                    ID:{" "}
                    <span className="font-mono text-slate-700">
                      {id.slice(0, 8)}…
                    </span>
                  </p>
                  <div className="w-full flex flex-col gap-2">
                    <button
                      onClick={handleShareQR}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] transition-all"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z"
                        />
                      </svg>
                      Share / Download QR
                    </button>
                    <button
                      onClick={handleWhatsApp}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 active:scale-[0.98] transition-all"
                    >
                      <svg
                        className="w-4 h-4"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                      >
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
                        <path d="M12 0C5.373 0 0 5.373 0 12c0 2.124.554 4.118 1.525 5.847L.057 23.57a.75.75 0 00.918.919l5.82-1.488A11.948 11.948 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22.5a10.46 10.46 0 01-5.399-1.497l-.386-.228-4.003 1.024 1.053-3.9-.252-.4A10.463 10.463 0 011.5 12C1.5 6.21 6.21 1.5 12 1.5S22.5 6.21 22.5 12 17.79 22.5 12 22.5z" />
                      </svg>
                      Send via WhatsApp
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-slate-400">
                  <svg
                    className="w-12 h-12 mb-3 text-slate-200"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.2}
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5z"
                    />
                  </svg>
                  <p className="text-sm">No QR code yet</p>
                  <p className="text-xs mt-1">Re-save student to generate</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════
          RENEWAL MODAL
      ══════════════════════════════════════════════════ */}
      {showRenewModal && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 animate-fade-in"
          style={{ background: "rgba(15,23,42,0.5)" }}
        >
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-md animate-scale-in overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 pt-6 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center">
                  <svg
                    className="w-5 h-5 text-emerald-600"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2.2}
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
                    />
                  </svg>
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">
                    Subscription Renew Karo
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {student.name} · Seat {student.seatNumber}
                  </p>
                </div>
              </div>
            </div>

            <div className="px-6 py-5 space-y-5">
              {/* Duration Selector */}
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 block">
                  Duration Select Karo
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[1, 3, 6, 12].map((m) => (
                    <button
                      key={m}
                      onClick={() => setRenewMonths(m)}
                      className={`py-2.5 rounded-xl text-sm font-bold border transition-all active:scale-95 ${renewMonths === m ? "bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/20" : "bg-slate-50 text-slate-600 border-slate-200 hover:border-indigo-300 hover:bg-indigo-50"}`}
                    >
                      {m}M
                    </button>
                  ))}
                </div>
              </div>

              {/* Amount */}
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 block">
                  Payment Amount (₹)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">
                    ₹
                  </span>
                  <input
                    type="number"
                    value={renewAmount}
                    onChange={(e) => setRenewAmount(e.target.value)}
                    placeholder={String(student.feeAmount || "")}
                    className="w-full pl-7 pr-4 py-3 rounded-xl border border-slate-200 text-slate-800 font-bold text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 transition-all"
                  />
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Monthly fee: ₹{student.feeAmount || 0} → {renewMonths} month =
                  ₹
                  {((student.feeAmount || 0) * renewMonths).toLocaleString(
                    "en-IN",
                  )}{" "}
                  expected
                </p>
              </div>

              {/* Note */}
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 block">
                  Note (optional)
                </label>
                <input
                  type="text"
                  value={renewNote}
                  onChange={(e) => setRenewNote(e.target.value)}
                  placeholder="e.g. Cash payment, UPI, discount..."
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 transition-all"
                />
              </div>

              {/* Preview Card */}
              <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl p-4">
                <p className="text-xs font-bold text-emerald-700 uppercase tracking-wide mb-2">
                  Preview
                </p>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-emerald-600">Current end date</p>
                    <p className="text-sm font-bold text-slate-700">
                      {student.endDate || "Not set"}
                    </p>
                  </div>
                  <svg
                    className="w-5 h-5 text-emerald-400"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M17.25 8.25L21 12m0 0l-3.75 3.75M21 12H3"
                    />
                  </svg>
                  <div className="text-right">
                    <p className="text-xs text-emerald-600">New end date</p>
                    <p className="text-sm font-bold text-emerald-700">
                      {previewEndDate}
                    </p>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-emerald-200 flex items-center justify-between">
                  <p className="text-xs text-emerald-600">Duration</p>
                  <p className="text-sm font-bold text-emerald-700">
                    {renewMonths} month{renewMonths > 1 ? "s" : ""} extension
                  </p>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 pb-6 flex gap-3">
              <button
                onClick={() => {
                  setShowRenewModal(false);
                  setRenewNote("");
                }}
                className="flex-1 py-3 rounded-xl text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors active:scale-95"
              >
                Cancel
              </button>
              <button
                onClick={handleRenew}
                disabled={renewLoading || !renewAmount}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-all active:scale-95"
              >
                {renewLoading ? (
                  <svg
                    className="w-4 h-4 animate-spin"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                ) : (
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2.5}
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M4.5 12.75l6 6 9-13.5"
                    />
                  </svg>
                )}
                {renewLoading ? "Processing..." : "Confirm Renewal"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Modal ── */}
      {showDeleteModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
          style={{ background: "rgba(15,23,42,0.45)" }}
        >
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-sm p-6 animate-scale-in">
            <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-6 h-6 text-red-500"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.8}
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
                />
              </svg>
            </div>
            <h3 className="text-base font-bold text-slate-800 text-center">
              Delete student?
            </h3>
            <p className="text-sm text-slate-500 text-center mt-1.5">
              <span className="font-semibold text-slate-700">
                {student.name}
              </span>{" "}
              will be permanently removed. This cannot be undone.
            </p>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-red-500 hover:bg-red-600 disabled:bg-red-300 transition-colors"
              >
                {deleting && (
                  <svg
                    className="w-3.5 h-3.5 animate-spin"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                )}
                {deleting ? "Deleting…" : "Yes, Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Animations ── */}
      <style>{`
        @keyframes fade-in-down  { from { opacity:0; transform:translateY(-10px) } to { opacity:1; transform:translateY(0) } }
        @keyframes fade-up       { from { opacity:0; transform:translateY(16px)  } to { opacity:1; transform:translateY(0) } }
        @keyframes slide-in-right{ from { opacity:0; transform:translateX(20px)  } to { opacity:1; transform:translateX(0) } }
        @keyframes fade-in       { from { opacity:0 }                              to { opacity:1 } }
        @keyframes scale-in      { from { opacity:0; transform:scale(0.95) }       to { opacity:1; transform:scale(1) } }
        .animate-fade-in-down  { animation: fade-in-down  0.35s ease both; }
        .animate-fade-up       { animation: fade-up       0.4s  ease both; }
        .animate-slide-in-right{ animation: slide-in-right 0.3s ease both; }
        .animate-fade-in       { animation: fade-in       0.2s  ease both; }
        .animate-scale-in      { animation: scale-in      0.25s ease both; }
      `}</style>
    </div>
  );
}

// ── StatBox ────────────────────────────────────────────
function StatBox({ label, value, warn, positive }) {
  return (
    <div className="bg-slate-50 rounded-xl px-3 py-2.5 text-center">
      <p className="text-xs text-slate-400 font-medium">{label}</p>
      <p
        className={`text-base font-bold mt-0.5 ${warn ? "text-red-500" : positive ? "text-emerald-600" : "text-slate-800"}`}
      >
        {value}
      </p>
    </div>
  );
}
