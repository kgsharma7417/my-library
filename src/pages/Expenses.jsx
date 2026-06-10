// src/pages/Expenses.jsx
// Ye page admin ko library ke kharche add karne deta hai
// Jaise: Electricity bill, WiFi, Rent, Water, etc.
// Har expense Firebase mein save hota hai
// Finance page par automatically is data se net profit calculate hoti hai

import { useEffect, useState } from "react";
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
} from "firebase/firestore";
import { db } from "../firebase";

// Expense categories — dropdown mein ye options honge
const CATEGORIES = [
  "Electricity",
  "WiFi/Internet",
  "Rent",
  "Water",
  "Maintenance",
  "Salary",
  "Stationery",
  "Other",
];

export default function Expenses() {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form state — naya expense add karne ke liye
  const [form, setForm] = useState({
    category: "Electricity",
    description: "",
    amount: "",
    date: new Date().toISOString().slice(0, 10), // aaj ki date default
  });

  useEffect(() => {
    fetchExpenses();
  }, []);

  // Firebase se saare expenses fetch karo
  const fetchExpenses = async () => {
    const snap = await getDocs(collection(db, "expenses"));
    const data = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      // Date ke hisaab se sort karo — nayi pehle
      .sort((a, b) => new Date(b.date) - new Date(a.date));
    setExpenses(data);
    setLoading(false);
  };

  // Form field change handler
  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    // spread operator se baaki fields same rehti hain
    // sirf jo field change hui woh update hoti hai
  };

  // Naya expense Firebase mein save karo
  const handleSubmit = async () => {
    if (!form.description || !form.amount || !form.date) {
      alert("Saari fields fill karo!");
      return;
    }
    setSaving(true);
    try {
      await addDoc(collection(db, "expenses"), {
        ...form,
        amount: Number(form.amount), // string se number mein convert
        createdAt: new Date().toISOString(),
      });
      // Form reset karo
      setForm({
        category: "Electricity",
        description: "",
        amount: "",
        date: new Date().toISOString().slice(0, 10),
      });
      fetchExpenses(); // list refresh karo
    } catch (err) {
      alert("Error: " + err.message);
    }
    setSaving(false);
  };

  // Expense delete karna
  // doc(db, "expenses", id) = specific document ka reference
  // deleteDoc = wo document delete karo
  const handleDelete = async (id) => {
    if (!confirm("Ye expense delete karna chahte ho?")) return;
    await deleteDoc(doc(db, "expenses", id));
    // Local state se bhi hatao — Firebase call na karo dobara
    setExpenses(expenses.filter((e) => e.id !== id));
  };

  // Monthly total calculate karna
  const currentMonth = new Date().toISOString().slice(0, 7);
  const monthlyTotal = expenses
    .filter((e) => e.date?.slice(0, 7) === currentMonth)
    .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  return (
    <div style={{ maxWidth: "900px", margin: "30px auto", padding: "0 16px" }}>
      <h2 style={{ color: "#1e293b", marginBottom: "6px" }}>
        💸 Expense Tracker
      </h2>
      <p style={{ color: "#64748b", marginBottom: "24px" }}>
        Library ke saare kharche yahan record karo
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1.5fr",
          gap: "24px",
        }}
      >
        {/* Left: Add Expense Form */}
        <div
          style={{
            background: "white",
            borderRadius: "14px",
            padding: "24px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.07)",
            height: "fit-content",
          }}
        >
          <h3 style={{ margin: "0 0 20px", color: "#1e293b" }}>
            ➕ Add Expense
          </h3>

          {/* Category Dropdown */}
          <div style={{ marginBottom: "14px" }}>
            <label style={labelStyle}>Category</label>
            <select
              name="category"
              value={form.category}
              onChange={handleChange}
              style={inputStyle}
            >
              {/* CATEGORIES array se automatically options render honge */}
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div style={{ marginBottom: "14px" }}>
            <label style={labelStyle}>Description</label>
            <input
              type="text"
              name="description"
              value={form.description}
              onChange={handleChange}
              placeholder="e.g. June ka bijli bill"
              style={inputStyle}
            />
          </div>

          {/* Amount */}
          <div style={{ marginBottom: "14px" }}>
            <label style={labelStyle}>Amount (₹)</label>
            <input
              type="number"
              name="amount"
              value={form.amount}
              onChange={handleChange}
              placeholder="e.g. 1500"
              style={inputStyle}
            />
          </div>

          {/* Date */}
          <div style={{ marginBottom: "20px" }}>
            <label style={labelStyle}>Date</label>
            <input
              type="date"
              name="date"
              value={form.date}
              onChange={handleChange}
              style={inputStyle}
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={saving}
            style={{
              width: "100%",
              background: saving ? "#94a3b8" : "#6366f1",
              color: "white",
              border: "none",
              padding: "12px",
              borderRadius: "10px",
              fontSize: "15px",
              fontWeight: "bold",
              cursor: saving ? "not-allowed" : "pointer",
            }}
          >
            {saving ? "Saving..." : "💾 Save Expense"}
          </button>
        </div>

        {/* Right: Expenses List */}
        <div>
          {/* Monthly Summary Card */}
          <div
            style={{
              background: "linear-gradient(135deg, #ef4444, #dc2626)",
              borderRadius: "14px",
              padding: "20px",
              color: "white",
              marginBottom: "20px",
            }}
          >
            <div style={{ fontSize: "13px", opacity: 0.85 }}>
              This Month's Total Expenses
            </div>
            <div
              style={{ fontSize: "32px", fontWeight: "800", marginTop: "4px" }}
            >
              ₹{monthlyTotal.toLocaleString("en-IN")}
            </div>
            <div style={{ fontSize: "12px", opacity: 0.75, marginTop: "4px" }}>
              {
                expenses.filter((e) => e.date?.slice(0, 7) === currentMonth)
                  .length
              }{" "}
              entries
            </div>
          </div>

          {/* Expenses List */}
          <div style={{ maxHeight: "420px", overflowY: "auto" }}>
            {loading ? (
              <p style={{ color: "#94a3b8" }}>Loading...</p>
            ) : expenses.length === 0 ? (
              <p
                style={{
                  color: "#94a3b8",
                  textAlign: "center",
                  padding: "20px",
                }}
              >
                Koi expense nahi mila. Pehla expense add karo!
              </p>
            ) : (
              expenses.map((expense) => (
                <div
                  key={expense.id}
                  style={{
                    background: "white",
                    borderRadius: "12px",
                    padding: "14px 16px",
                    marginBottom: "10px",
                    boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "12px",
                  }}
                >
                  <div style={{ flex: 1 }}>
                    {/* Category badge */}
                    <span
                      style={{
                        background: "#fee2e2",
                        color: "#991b1b",
                        padding: "2px 8px",
                        borderRadius: "8px",
                        fontSize: "11px",
                        fontWeight: "bold",
                      }}
                    >
                      {expense.category}
                    </span>
                    <div
                      style={{
                        fontWeight: "600",
                        marginTop: "4px",
                        fontSize: "14px",
                      }}
                    >
                      {expense.description}
                    </div>
                    <div style={{ color: "#94a3b8", fontSize: "12px" }}>
                      📅 {expense.date}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    {/* Amount */}
                    <div
                      style={{
                        fontSize: "18px",
                        fontWeight: "800",
                        color: "#ef4444",
                      }}
                    >
                      ₹{Number(expense.amount).toLocaleString("en-IN")}
                    </div>
                    {/* Delete button */}
                    <button
                      onClick={() => handleDelete(expense.id)}
                      style={{
                        background: "none",
                        border: "none",
                        color: "#94a3b8",
                        cursor: "pointer",
                        fontSize: "12px",
                        marginTop: "4px",
                      }}
                    >
                      🗑 Delete
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const labelStyle = {
  display: "block",
  marginBottom: "6px",
  fontWeight: "600",
  color: "#374151",
  fontSize: "13px",
};

const inputStyle = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: "8px",
  border: "1.5px solid #e2e8f0",
  fontSize: "14px",
  boxSizing: "border-box",
  outline: "none",
};
