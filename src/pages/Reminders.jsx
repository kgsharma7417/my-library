// src/pages/Reminders.jsx
// Ye page 3 categories mein students dikhata hai:
// 1. "3 Din Mein Expire" — jinki subscription 3 din mein khatam hogi
// 2. "Kal Expire" — jinki kal khatam hogi
// 3. "Aaj Expire" — jinki aaj khatam ho rahi hai
// Har student ko WhatsApp par appropriate message bheja ja sakta hai
// dayjs library se date calculations aasan hain

import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import dayjs from "dayjs";

export default function Reminders() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  // Track karo ki kisko message bheja ja chuka hai (local state)
  const [sent, setSent] = useState({});

  useEffect(() => {
    fetchStudents();
  }, []);

  const fetchStudents = async () => {
    const snap = await getDocs(collection(db, "students"));
    setStudents(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    setLoading(false);
  };

  const today = dayjs(); // aaj ki date dayjs object mein

  // ── Students ko 3 buckets mein sort karo ──────────────────────

  // Bucket 1: Aaj se exactly 3 din baad expire honge
  // dayjs diff() = do dates ka difference calculate karta hai
  const expireIn3Days = students.filter((s) => {
    if (!s.endDate) return false;
    const diff = dayjs(s.endDate).diff(today, "day");
    return diff === 3; // exactly 3 din baad
  });

  // Bucket 2: Kal expire honge (1 din baad)
  const expireIn1Day = students.filter((s) => {
    if (!s.endDate) return false;
    const diff = dayjs(s.endDate).diff(today, "day");
    return diff === 1; // exactly kal
  });

  // Bucket 3: Aaj expire ho rahe hain ya kal (0 ya -1 din)
  const expireToday = students.filter((s) => {
    if (!s.endDate) return false;
    const diff = dayjs(s.endDate).diff(today, "day");
    return diff === 0 || diff === -1; // aaj ya kal tak
  });

  // ── WhatsApp message templates ────────────────────────────────
  // type = "3days" | "1day" | "today"
  // Har type ke liye alag message text hai
  const sendWhatsApp = (student, type) => {
    let msg = "";

    if (type === "3days") {
      msg =
        `Hello ${student.name}! 📚\n\n` +
        `LibraryPro reminder: Aapki library membership ` +
        `*3 din mein expire hone wali hai* (${student.endDate}).\n\n` +
        `Kripya jald renew karein taaki aapki seat (No. ${student.seatNumber}) safe rahe.\n\n` +
        `Dhanyawaad! 🙏`;
    } else if (type === "1day") {
      msg =
        `Hello ${student.name}! ⚠️\n\n` +
        `*Urgent Reminder:* Aapki library membership ` +
        `*kal expire ho rahi hai* (${student.endDate}).\n\n` +
        `Aaj hi renew karein — seat No. ${student.seatNumber} hold hai abhi tak.\n\n` +
        `LibraryPro 📚`;
    } else {
      msg =
        `Hello ${student.name}! 🚨\n\n` +
        `*Final Alert:* Aapki library membership *aaj expire ho rahi hai*.\n\n` +
        `Renew na karne par aapka access block ho jayega aur ` +
        `seat No. ${student.seatNumber} release kar di jayegi.\n\n` +
        `Abhi contact karein. — LibraryPro 📚`;
    }

    // encodeURIComponent = special characters (+, spaces etc.) ko URL-safe banata hai
    const encoded = encodeURIComponent(msg);
    window.open(`https://wa.me/91${student.phone}?text=${encoded}`, "_blank");

    // Is student ko "sent" mark karo UI mein
    setSent((prev) => ({ ...prev, [student.id + type]: true }));
  };

  // ── Ek section render karna (reusable) ───────────────────────
  const ReminderSection = ({ title, color, students, type, icon }) => (
    <div
      style={{
        background: "white",
        borderRadius: "14px",
        padding: "20px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
        marginBottom: "24px",
        borderTop: `4px solid ${color}`,
      }}
    >
      {/* Section header */}
      <h3 style={{ margin: "0 0 16px", color: "#1e293b" }}>
        {icon} {title}
        <span
          style={{
            marginLeft: "10px",
            fontSize: "14px",
            fontWeight: "normal",
            color: color,
          }}
        >
          ({students.length} students)
        </span>
      </h3>

      {students.length === 0 ? (
        <p style={{ color: "#94a3b8", fontSize: "14px" }}>
          ✅ Is category mein koi student nahi.
        </p>
      ) : (
        students.map((student) => {
          const wasSent = sent[student.id + type]; // message bheja ja chuka hai?
          return (
            <div
              key={student.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "12px",
                padding: "14px 0",
                borderBottom: "1px solid #f1f5f9",
              }}
            >
              <div>
                <div style={{ fontWeight: "bold", fontSize: "15px" }}>
                  {student.name}
                </div>
                <div
                  style={{
                    color: "#64748b",
                    fontSize: "13px",
                    marginTop: "3px",
                  }}
                >
                  📱 {student.phone} &nbsp;|&nbsp; 🪑 Seat {student.seatNumber}{" "}
                  &nbsp;|&nbsp; 📅 Expires: {student.endDate}
                </div>
              </div>

              {/* WhatsApp button */}
              <button
                onClick={() => sendWhatsApp(student, type)}
                style={{
                  // Bheja ja chuka hai toh grey, warna green
                  background: wasSent ? "#94a3b8" : "#25d366",
                  color: "white",
                  border: "none",
                  padding: "9px 18px",
                  borderRadius: "10px",
                  fontSize: "13px",
                  fontWeight: "bold",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                {wasSent ? "✅ Sent" : "📲 Send WhatsApp"}
              </button>
            </div>
          );
        })
      )}
    </div>
  );

  if (loading) return <p style={{ padding: "30px" }}>Loading...</p>;

  // Total pending reminders count
  const totalPending =
    expireIn3Days.length + expireIn1Day.length + expireToday.length;

  return (
    <div style={{ maxWidth: "900px", margin: "30px auto", padding: "0 16px" }}>
      <h2 style={{ color: "#1e293b", marginBottom: "6px" }}>
        🔔 Reminder Center
      </h2>
      <p style={{ color: "#64748b", marginBottom: "24px" }}>
        Subscription expire hone wale students ko WhatsApp reminders bhejo
      </p>

      {/* Summary banner */}
      <div
        style={{
          background:
            totalPending > 0
              ? "linear-gradient(135deg, #f59e0b, #d97706)"
              : "linear-gradient(135deg, #22c55e, #16a34a)",
          borderRadius: "14px",
          padding: "20px 24px",
          color: "white",
          marginBottom: "28px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "12px",
        }}
      >
        <div>
          <div style={{ fontSize: "28px", fontWeight: "800" }}>
            {totalPending} Reminders Pending
          </div>
          <div style={{ opacity: 0.85, fontSize: "14px", marginTop: "4px" }}>
            {expireIn3Days.length} in 3 days &nbsp;·&nbsp;
            {expireIn1Day.length} tomorrow &nbsp;·&nbsp;
            {expireToday.length} today/overdue
          </div>
        </div>
        <div style={{ fontSize: "48px" }}>{totalPending > 0 ? "⚠️" : "🎉"}</div>
      </div>

      {/* 3 Reminder Sections */}
      <ReminderSection
        title="3 Din Mein Expire"
        color="#f59e0b"
        icon="🟡"
        students={expireIn3Days}
        type="3days"
      />
      <ReminderSection
        title="Kal Expire Hoga"
        color="#f97316"
        icon="🟠"
        students={expireIn1Day}
        type="1day"
      />
      <ReminderSection
        title="Aaj Expire / Overdue"
        color="#ef4444"
        icon="🔴"
        students={expireToday}
        type="today"
      />
    </div>
  );
}
