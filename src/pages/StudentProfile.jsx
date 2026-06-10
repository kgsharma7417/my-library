// src/pages/StudentProfile.jsx
import { useState, useEffect, useRef } from "react";
import { doc, getDoc, updateDoc, deleteDoc } from "firebase/firestore";
import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import { db, storage } from "../firebase";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import QRCode from "qrcode";
import ShiftSelector from "../components/ShiftSelector";

export default function StudentProfile() {
  const navigate = useNavigate();

  const { user } = useAuth();
  useEffect(() => {
    const fetchStudentId = async () => {
      if (!user?.uid) return;

      try {
        const userSnap = await getDoc(doc(db, "users", user.uid));

        if (userSnap.exists()) {
          const data = userSnap.data();

          setId(data.studentId);
        }
      } catch (e) {
        console.error(e);
      }
    };

    fetchStudentId();
  }, [user]);

  const [id, setId] = useState(null);
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

  useEffect(() => {
    if (!id) return;

    setMounted(true);

    fetchStudent();
  }, [id]);

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
    } catch (e) {
      showToast("Failed to load student.", "error");
    }
    setLoading(false);
  };

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

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
    } catch (e) {
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
    } catch (e) {
      showToast("Failed to delete student.", "error");
      setDeleting(false);
      setShowDeleteModal(false);
    }
  };

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
          text: `Seat ${student.seatNumber} — ${student.shift} shift`,
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

  const daysLeft = student?.endDate
    ? Math.max(
        0,
        Math.ceil((new Date(student.endDate) - new Date()) / 86400000),
      )
    : null;

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

  return (
    <div
      className={`min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8 transition-all duration-500 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"}`}
    >
      <div className="mx-auto max-w-3xl">
        {/* Toast */}
        {toast && (
          <div
            className={`fixed top-4 right-4 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg text-sm font-medium animate-slide-in-right ${
              toast.type === "error"
                ? "bg-red-50 border border-red-200 text-red-700"
                : "bg-emerald-50 border border-emerald-200 text-emerald-700"
            }`}
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

        {/* Back + Actions Header */}
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
                  {saving ? (
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
                  ) : null}
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Profile Hero Card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-5 animate-fade-up">
          <div className="px-5 py-6 sm:px-6 flex items-start gap-5">
            {/* Avatar */}
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
                {student.status === "active" && (
                  <>
                    <span className="text-slate-400 text-xs">•</span>
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                      Active
                    </span>
                  </>
                )}
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-3 gap-3 mt-4">
                <StatBox
                  label="Monthly Fee"
                  value={`₹${student.feeAmount || 0}`}
                />
                <StatBox
                  label="Days Left"
                  value={daysLeft !== null ? daysLeft : "—"}
                  warn={daysLeft !== null && daysLeft <= 7}
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {/* Left — Details Card */}
          <div
            className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden animate-fade-up"
            style={{ animationDelay: "0.05s" }}
          >
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
                    max={30}
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
                      className={`mt-0.5 text-sm font-medium ${daysLeft !== null && daysLeft <= 7 ? "text-red-600" : "text-slate-700"}`}
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

          {/* Right — QR Card */}
          <div
            className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden animate-fade-up"
            style={{ animationDelay: "0.1s" }}
          >
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
        </div>
      </div>

      {/* Delete Confirm Modal */}
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
                {deleting ? (
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
                ) : null}
                {deleting ? "Deleting…" : "Yes, Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fade-in-down { from { opacity:0; transform:translateY(-10px) } to { opacity:1; transform:translateY(0) } }
        @keyframes fade-up { from { opacity:0; transform:translateY(16px) } to { opacity:1; transform:translateY(0) } }
        @keyframes slide-in-right { from { opacity:0; transform:translateX(20px) } to { opacity:1; transform:translateX(0) } }
        @keyframes fade-in { from { opacity:0 } to { opacity:1 } }
        @keyframes scale-in { from { opacity:0; transform:scale(0.95) } to { opacity:1; transform:scale(1) } }
        .animate-fade-in-down { animation: fade-in-down 0.35s ease both; }
        .animate-fade-up { animation: fade-up 0.4s ease both; }
        .animate-slide-in-right { animation: slide-in-right 0.3s ease both; }
        .animate-fade-in { animation: fade-in 0.2s ease both; }
        .animate-scale-in { animation: scale-in 0.25s ease both; }
      `}</style>
    </div>
  );
}

function StatBox({ label, value, warn }) {
  return (
    <div className="bg-slate-50 rounded-xl px-3 py-2.5 text-center">
      <p className="text-xs text-slate-400 font-medium">{label}</p>
      <p
        className={`text-base font-bold mt-0.5 ${warn ? "text-red-500" : "text-slate-800"}`}
      >
        {value}
      </p>
    </div>
  );
}
