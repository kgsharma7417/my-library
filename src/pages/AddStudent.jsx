// src/pages/AddStudent.jsx
import { useState, useEffect, useRef } from "react";
import {
  collection,
  addDoc,
  getDocs,
  updateDoc,
  doc,
} from "firebase/firestore";
import { db } from "../firebase";

const CLOUD_NAME = "dz7vbpney";
const UPLOAD_PRESET = "YOUR_UPLOAD_PRESET"; // 👈 apna unsigned preset naam yahan daalo

async function uploadToCloudinary(file, folder = "students/photos") {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", UPLOAD_PRESET);
  formData.append("folder", folder);
  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
    { method: "POST", body: formData },
  );
  if (!res.ok) throw new Error("Cloudinary upload failed");
  const data = await res.json();
  return data.secure_url;
}
import { useNavigate } from "react-router-dom";
import ShiftSelector from "../components/ShiftSelector";
import SeatLayout from "../components/SeatLayout";
import QRCode from "qrcode";

export default function AddStudent() {
  const navigate = useNavigate();
  const photoInputRef = useRef(null);

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
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [occupiedSeats, setOccupiedSeats] = useState([]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [savedStudentId, setSavedStudentId] = useState(null);
  const [errors, setErrors] = useState({});
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const fetchSeats = async () => {
      const snapshot = await getDocs(collection(db, "students"));
      const seats = snapshot.docs.map((doc) => doc.data().seatNumber);
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

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setErrors((prev) => ({ ...prev, photo: "Photo must be under 5MB" }));
      return;
    }
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
    setErrors((prev) => ({ ...prev, photo: "" }));
  };

  const handleBlur = (e) => {
    const { name } = e.target;
    const partial = {};
    if (name === "phone" && form.phone) {
      if (!/^[6-9]\d{9}$/.test(form.phone))
        partial.phone = "Enter a valid 10-digit mobile number";
    }
    if (name === "aadhaar" && form.aadhaar) {
      const digits = form.aadhaar.replace(/\s/g, "");
      if (digits.length !== 12) partial.aadhaar = "Aadhaar must be 12 digits";
    }
    if (Object.keys(partial).length)
      setErrors((prev) => ({ ...prev, ...partial }));
  };

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = "Student name is required";
    if (!form.phone.trim()) e.phone = "Phone number is required";
    else if (!/^[6-9]\d{9}$/.test(form.phone))
      e.phone = "Enter a valid 10-digit mobile number";
    if (form.aadhaar) {
      const digits = form.aadhaar.replace(/\s/g, "");
      if (digits.length !== 12) e.aadhaar = "Aadhaar must be 12 digits";
    }
    if (!form.seatNumber) e.seatNumber = "Please select a seat";
    else if (occupiedSeats.includes(Number(form.seatNumber)))
      e.seatNumber = `Seat ${form.seatNumber} is already taken`;
    if (!form.shift) e.shift = "Please select a shift";
    if (form.feeAmount && Number(form.feeAmount) <= 0)
      e.feeAmount = "Enter a valid fee amount";
    if (form.startDate && form.endDate && form.endDate < form.startDate)
      e.endDate = "End date cannot be before start date";
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
      let photoURL = "";
      if (photoFile) {
        photoURL = await uploadToCloudinary(photoFile, "students/photos");
      }

      const studentData = {
        ...form,
        aadhaar: form.aadhaar.replace(/\s/g, ""),
        seatNumber: Number(form.seatNumber),
        feeAmount: Number(form.feeAmount),
        photoURL,
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

      const qrBlob = await (await fetch(qrDataURL)).blob();
      const qrFile = new File([qrBlob], `${docRef.id}.png`, {
        type: "image/png",
      });
      const qrURL = await uploadToCloudinary(qrFile, "students/qrcodes");

      await updateDoc(doc(db, "students", docRef.id), { qrURL, qrData });

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
      setPhotoFile(null);
      setPhotoPreview(null);
      setErrors({});
      setTimeout(() => setSuccess(false), 6000);
    } catch (err) {
      console.error(err);
      setErrors({ submit: "Failed to save student. Please try again." });
    }
    setLoading(false);
  };

  return (
    <div
      className={`min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8 transition-opacity duration-500 ${
        mounted ? "opacity-100" : "opacity-0"
      }`}
    >
      <div className="mx-auto max-w-3xl">
        {/* Header */}
        <div className="mb-8 animate-fade-in-down">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center shadow-sm">
              <svg
                className="w-5 h-5 text-white"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.2}
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 4.5v15m7.5-7.5h-15"
                />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-slate-800 tracking-tight">
              Add New Student
            </h1>
          </div>
          <p className="text-sm text-slate-500 ml-12">
            Fill in the details to register a student and assign a seat.
          </p>
        </div>

        {/* Success Banner */}
        {success && (
          <div className="mb-6 flex items-center justify-between gap-3 bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3.5 rounded-xl animate-slide-in">
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
                <svg
                  className="w-3.5 h-3.5 text-white"
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
              </div>
              <div>
                <p className="font-semibold text-sm">
                  Student registered successfully!
                </p>
                <p className="text-xs text-emerald-600 mt-0.5">
                  QR code generated and saved to Firebase.
                </p>
              </div>
            </div>
            {savedStudentId && (
              <button
                onClick={() => navigate(`/students/${savedStudentId}`)}
                className="flex-shrink-0 text-xs font-semibold text-emerald-700 bg-emerald-100 hover:bg-emerald-200 px-3 py-1.5 rounded-lg transition-colors"
              >
                View Profile →
              </button>
            )}
          </div>
        )}

        {/* Submit Error */}
        {errors.submit && (
          <div className="mb-6 flex items-center gap-3 bg-red-50 border border-red-200 text-red-700 px-4 py-3.5 rounded-xl text-sm animate-slide-in">
            <svg
              className="w-5 h-5 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z"
              />
            </svg>
            {errors.submit}
          </div>
        )}

        {/* Main Card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {/* ── Photo Upload Section ── */}
          <div className="px-5 py-5 sm:px-6 sm:py-6">
            <SectionHeading
              icon={CameraIcon}
              title="Student Photo"
              subtitle="Optional — JPG or PNG, max 5 MB"
            />
            <div className="mt-5 flex items-center gap-5">
              <button
                type="button"
                onClick={() => photoInputRef.current?.click()}
                className="relative w-20 h-20 rounded-2xl border-2 border-dashed border-slate-200 hover:border-indigo-300 bg-slate-50 hover:bg-indigo-50 transition-all duration-200 flex items-center justify-center overflow-hidden group flex-shrink-0"
              >
                {photoPreview ? (
                  <img
                    src={photoPreview}
                    alt="Preview"
                    className="w-full h-full object-cover rounded-2xl"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-1 text-slate-400 group-hover:text-indigo-400 transition-colors">
                    <svg
                      className="w-6 h-6"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={1.5}
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z"
                      />
                    </svg>
                    <span className="text-[10px] font-medium">Upload</span>
                  </div>
                )}
                {photoPreview && (
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl flex items-center justify-center">
                    <span className="text-white text-[10px] font-semibold">
                      Change
                    </span>
                  </div>
                )}
              </button>
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoChange}
              />
              <div>
                {photoPreview ? (
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-700">
                      {photoFile?.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setPhotoFile(null);
                        setPhotoPreview(null);
                      }}
                      className="text-xs text-red-500 hover:text-red-600 font-medium"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">
                    Click to upload a photo
                  </p>
                )}
                {errors.photo && (
                  <p className="text-xs text-red-500 mt-1">{errors.photo}</p>
                )}
                <p className="text-xs text-slate-400 mt-1">
                  Recommended: square crop, clear face
                </p>
              </div>
            </div>
          </div>

          <Divider />

          {/* ── Personal Info Section ── */}
          <div className="px-5 py-5 sm:px-6 sm:py-6">
            <SectionHeading icon={PersonIcon} title="Personal Information" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-5">
              <Field
                label="Student Name"
                name="name"
                value={form.name}
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder="e.g. Rahul Kumar"
                required
                error={errors.name}
                icon={
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.8}
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
                    />
                  </svg>
                }
              />
              <Field
                label="Phone Number"
                name="phone"
                value={form.phone}
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder="e.g. 9876543210"
                required
                error={errors.phone}
                type="tel"
                success={
                  !errors.phone &&
                  form.phone.length === 10 &&
                  /^[6-9]\d{9}$/.test(form.phone)
                }
                icon={
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.8}
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
              <div className="sm:col-span-2">
                <Field
                  label="Aadhaar Number"
                  name="aadhaar"
                  value={form.aadhaar}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  placeholder="XXXX XXXX XXXX"
                  error={errors.aadhaar}
                  hint="12-digit Aadhaar — stored securely"
                  success={
                    !errors.aadhaar &&
                    form.aadhaar.replace(/\s/g, "").length === 12
                  }
                  icon={
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={1.8}
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

          <Divider />

          {/* ── Fee & Seat Section ── */}
          <div className="px-5 py-5 sm:px-6 sm:py-6">
            <SectionHeading icon={FeeIcon} title="Fee & Seat Details" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-5">
              <div>
                <Field
                  label="Monthly Fee (₹)"
                  name="feeAmount"
                  value={form.feeAmount}
                  onChange={handleChange}
                  placeholder="e.g. 800"
                  type="number"
                  error={errors.feeAmount}
                  icon={
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={1.8}
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
                {/* Fee quick-select chips */}
                <div className="flex gap-2 mt-2 flex-wrap">
                  {[500, 700, 800, 1000, 1200].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() =>
                        setForm((prev) => ({ ...prev, feeAmount: String(amt) }))
                      }
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all duration-150 ${
                        form.feeAmount === String(amt)
                          ? "bg-indigo-600 text-white"
                          : "bg-slate-100 text-slate-600 hover:bg-indigo-50 hover:text-indigo-600"
                      }`}
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
                onChange={handleChange}
                placeholder="e.g. 5"
                type="number"
                required
                error={errors.seatNumber}
                icon={
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.8}
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
                onChange={handleChange}
                type="date"
                icon={
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.8}
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"
                    />
                  </svg>
                }
              />
              <Field
                label="End Date (Subscription)"
                name="endDate"
                value={form.endDate}
                onChange={handleChange}
                type="date"
                error={errors.endDate}
                hint="Auto-set to +1 month from start"
                icon={
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.8}
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

          <Divider />

          {/* ── Shift Section ── */}
          <div className="px-5 py-5 sm:px-6 sm:py-6">
            <SectionHeading icon={ShiftIcon} title="Select Shift" />
            {errors.shift && (
              <p className="mt-1 text-xs text-red-500">{errors.shift}</p>
            )}
            <div className="mt-4">
              <ShiftSelector
                value={form.shift}
                onChange={(val) => setForm({ ...form, shift: val })}
              />
            </div>
          </div>

          <Divider />

          {/* ── Seat Layout Section ── */}
          <div className="px-5 py-5 sm:px-6 sm:py-6">
            <SectionHeading
              icon={SeatIcon}
              title="Seat Layout"
              subtitle="Tap a green seat to select"
            />
            <div className="mt-4 bg-slate-50 rounded-xl p-4 border border-slate-100">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <div className="flex items-center gap-4 flex-wrap">
                  <LegendDot color="bg-emerald-500" label="Available" />
                  <LegendDot color="bg-red-400" label="Occupied" />
                  <LegendDot color="bg-indigo-500" label="Selected" />
                </div>
                <span className="text-xs font-medium text-slate-500">
                  {30 - occupiedSeats.length} seats available
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

          {/* ── QR Info Banner ── */}
          <div className="mx-5 mb-5 sm:mx-6 sm:mb-6 bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
              <svg
                className="w-4 h-4 text-indigo-600"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.8}
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6.75 6.75h.75v.75h-.75v-.75zM6.75 16.5h.75v.75h-.75v-.75zM16.5 6.75h.75v.75h-.75v-.75zM13.5 13.5h.75v.75h-.75v-.75zM13.5 19.5h.75v.75h-.75v-.75zM19.5 13.5h.75v.75h-.75v-.75zM19.5 19.5h.75v.75h-.75v-.75zM16.5 16.5h.75v.75h-.75v-.75z"
                />
              </svg>
            </div>
            <div>
              <p className="text-xs font-semibold text-indigo-700">
                QR Code auto-generated on save
              </p>
              <p className="text-xs text-indigo-500 mt-0.5">
                A unique QR code will be created and stored — use it in the
                Attendance scanner.
              </p>
            </div>
          </div>
        </div>

        {/* Submit Buttons */}
        <div className="mt-6 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center sm:justify-end">
          <button
            type="button"
            onClick={() => {
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
              setPhotoFile(null);
              setPhotoPreview(null);
              setErrors({});
            }}
            className="order-2 sm:order-1 px-5 py-3 rounded-xl text-sm font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 active:scale-[0.98] transition-all duration-150"
          >
            Clear Form
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="order-1 sm:order-2 flex items-center justify-center gap-2.5 px-7 py-3 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed active:scale-[0.98] shadow-sm transition-all duration-150"
          >
            {loading ? (
              <>
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
                Saving...
              </>
            ) : (
              <>
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2.2}
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 3.75H6.912a2.25 2.25 0 00-2.15 1.588L2.35 13.177a2.25 2.25 0 00-.1.661V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18v-4.162c0-.224-.034-.447-.1-.661L19.24 5.338a2.25 2.25 0 00-2.15-1.588H15M2.25 13.5h3.86a2.25 2.25 0 012.012 1.244l.256.512a2.25 2.25 0 002.013 1.244h3.218a2.25 2.25 0 002.013-1.244l.256-.512a2.25 2.25 0 012.013-1.244h3.859M12 3v8.25m0 0l-3-3m3 3l3-3"
                  />
                </svg>
                Save Student
              </>
            )}
          </button>
        </div>

        <p className="text-center text-xs text-slate-400 mt-6 pb-4">
          All fields marked with <span className="text-red-400">*</span> are
          required
        </p>
      </div>

      <style>{`
        @keyframes fade-in-down {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slide-in {
          from { opacity: 0; transform: translateX(-8px); }
          to { opacity: 1; transform: translateX(0); }
        }
        .animate-fade-in-down { animation: fade-in-down 0.4s ease both; }
        .animate-slide-in { animation: slide-in 0.3s ease both; }
      `}</style>
    </div>
  );
}

/* ─── Field ─────────────────────────────────────────────── */
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
  success,
  icon,
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold text-slate-600 tracking-wide uppercase">
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      <div className="relative">
        {icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
            {icon}
          </div>
        )}
        <input
          type={type}
          name={name}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          placeholder={placeholder}
          min={type === "number" ? 0 : undefined}
          className={`
            w-full rounded-xl border bg-white text-slate-800 text-sm placeholder:text-slate-400
            transition-all duration-150 outline-none
            ${icon ? "pl-9 pr-8 py-2.5" : "px-3.5 py-2.5"}
            ${
              error
                ? "border-red-300 focus:border-red-400 focus:ring-2 focus:ring-red-100"
                : success
                  ? "border-emerald-300 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-50"
                  : "border-slate-200 hover:border-slate-300 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50"
            }
          `}
        />
        {success && !error && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-500">
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
          </div>
        )}
      </div>
      {error && (
        <p className="flex items-center gap-1 text-xs text-red-500">
          <svg
            className="w-3 h-3 flex-shrink-0"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
          {error}
        </p>
      )}
      {hint && !error && <p className="text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

function SectionHeading({ icon: Icon, title, subtitle }) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 w-7 h-7 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 flex-shrink-0">
        <Icon />
      </div>
      <div>
        <h2 className="text-sm font-bold text-slate-800">{title}</h2>
        {subtitle && (
          <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
        )}
      </div>
    </div>
  );
}

function Divider() {
  return <div className="h-px bg-slate-100 mx-5 sm:mx-6" />;
}

function LegendDot({ color, label }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className={`w-3 h-3 rounded-sm ${color}`} />
      <span className="text-xs text-slate-500">{label}</span>
    </div>
  );
}

/* ─── Icons ──────────────────────────────────────────────── */
function CameraIcon() {
  return (
    <svg
      className="w-4 h-4"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z"
      />
    </svg>
  );
}
function PersonIcon() {
  return (
    <svg
      className="w-4 h-4"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
      />
    </svg>
  );
}
function FeeIcon() {
  return (
    <svg
      className="w-4 h-4"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z"
      />
    </svg>
  );
}
function ShiftIcon() {
  return (
    <svg
      className="w-4 h-4"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}
function SeatIcon() {
  return (
    <svg
      className="w-4 h-4"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z"
      />
    </svg>
  );
}
