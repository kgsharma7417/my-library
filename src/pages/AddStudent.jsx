// src/pages/AddStudent.jsx
import { useState, useEffect } from "react";
import { collection, addDoc, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import ShiftSelector from "../components/ShiftSelector";
import SeatLayout from "../components/SeatLayout";

export default function AddStudent() {
  const [form, setForm] = useState({
    name: "",
    phone: "",
    shift: "morning",
    seatNumber: "",
    feeAmount: "",
    startDate: "",
    endDate: "",
  });
  const [occupiedSeats, setOccupiedSeats] = useState([]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // Firebase se occupied seats fetch karo
  useEffect(() => {
    const fetchSeats = async () => {
      const snapshot = await getDocs(collection(db, "students"));
      const seats = snapshot.docs.map((doc) => doc.data().seatNumber);
      setOccupiedSeats(seats.filter(Boolean).map(Number));
    };
    fetchSeats();
  }, []);

  const handleChange = (e) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async () => {
    if (!form.name || !form.phone || !form.seatNumber || !form.shift) {
      alert("Please fill all required fields!");
      return;
    }
    if (occupiedSeats.includes(Number(form.seatNumber))) {
      alert(`Seat ${form.seatNumber} already occupied! Please choose another.`);
      return;
    }
    setLoading(true);
    try {
      await addDoc(collection(db, "students"), {
        ...form,
        seatNumber: Number(form.seatNumber),
        feeAmount: Number(form.feeAmount),
        status: "active",
        createdAt: new Date().toISOString(),
      });
      setSuccess(true);
      setForm({
        name: "",
        phone: "",
        shift: "morning",
        seatNumber: "",
        feeAmount: "",
        startDate: "",
        endDate: "",
      });
      setOccupiedSeats([...occupiedSeats, Number(form.seatNumber)]);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      alert("Error saving student: " + err.message);
    }
    setLoading(false);
  };

  return (
    <div style={{ maxWidth: "860px", margin: "30px auto", padding: "0 16px" }}>
      <h2 style={{ color: "#1e293b", marginBottom: "6px" }}>
        ➕ Add New Student
      </h2>
      <p style={{ color: "#64748b", marginBottom: "24px" }}>
        Fill details and assign shift + seat
      </p>

      {success && (
        <div
          style={{
            background: "#dcfce7",
            color: "#166534",
            padding: "12px 16px",
            borderRadius: "8px",
            marginBottom: "20px",
            fontWeight: "bold",
          }}
        >
          ✅ Student added successfully!
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "16px",
          marginBottom: "20px",
        }}
      >
        <Field
          label="Student Name *"
          name="name"
          value={form.name}
          onChange={handleChange}
          placeholder="e.g. Rahul Kumar"
        />
        <Field
          label="Phone Number *"
          name="phone"
          value={form.phone}
          onChange={handleChange}
          placeholder="e.g. 9876543210"
        />
        <Field
          label="Monthly Fee (₹)"
          name="feeAmount"
          value={form.feeAmount}
          onChange={handleChange}
          placeholder="e.g. 800"
          type="number"
        />
        <Field
          label="Seat Number (1-30) *"
          name="seatNumber"
          value={form.seatNumber}
          onChange={handleChange}
          placeholder="e.g. 5"
          type="number"
        />
        <Field
          label="Start Date"
          name="startDate"
          value={form.startDate}
          onChange={handleChange}
          type="date"
        />
        <Field
          label="End Date (Subscription)"
          name="endDate"
          value={form.endDate}
          onChange={handleChange}
          type="date"
        />
      </div>

      <div style={{ marginBottom: "24px" }}>
        <label style={labelStyle}>Select Shift *</label>
        <ShiftSelector
          value={form.shift}
          onChange={(val) => setForm({ ...form, shift: val })}
        />
      </div>

      <div
        style={{
          background: "#f8fafc",
          borderRadius: "12px",
          padding: "20px",
          marginBottom: "24px",
        }}
      >
        <h3 style={{ margin: "0 0 16px", color: "#1e293b" }}>
          🪑 Seat Layout — Select a green seat
        </h3>
        <SeatLayout totalSeats={30} occupiedSeats={occupiedSeats} />
      </div>

      <button
        onClick={handleSubmit}
        disabled={loading}
        style={{
          background: loading ? "#94a3b8" : "#6366f1",
          color: "white",
          border: "none",
          padding: "14px 32px",
          borderRadius: "10px",
          fontSize: "16px",
          fontWeight: "bold",
          cursor: loading ? "not-allowed" : "pointer",
        }}
      >
        {loading ? "Saving..." : "💾 Save Student"}
      </button>
    </div>
  );
}

const labelStyle = {
  display: "block",
  marginBottom: "8px",
  fontWeight: "600",
  color: "#374151",
  fontSize: "14px",
};

function Field({ label, name, value, onChange, placeholder, type = "text" }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        style={{
          width: "100%",
          padding: "10px 14px",
          borderRadius: "8px",
          border: "1.5px solid #e2e8f0",
          fontSize: "15px",
          outline: "none",
          boxSizing: "border-box",
        }}
      />
    </div>
  );
}
