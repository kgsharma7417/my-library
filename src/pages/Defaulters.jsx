// src/pages/Defaulters.jsx
import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";

// Ye page un students ko filter karta hai
// jinki subscription end date aaj se pehle ki hai
// yani jo already expire ho chuke hain aur abhi tak renew nahi kiya

export default function Defaulters() {
  const [defaulters, setDefaulters] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDefaulters = async () => {
      const snapshot = await getDocs(collection(db, "students"));
      const today = new Date();
      today.setHours(0, 0, 0, 0); // aaj ke din ka start

      const expired = snapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .filter((student) => {
          if (!student.endDate) return false; // agar end date nahi hai toh skip
          const end = new Date(student.endDate);
          return end < today; // end date aaj se pehle hai → defaulter
        });

      setDefaulters(expired);
      setLoading(false);
    };
    fetchDefaulters();
  }, []);

  // WhatsApp par warning message bhejna
  // window.open se WhatsApp Web/App khulta hai pre-filled message ke saath
  const sendWhatsApp = (student) => {
    const daysOverdue = Math.floor(
      (new Date() - new Date(student.endDate)) / (1000 * 60 * 60 * 24),
    );
    const msg = encodeURIComponent(
      `Hello ${student.name}! 📚\n\n` +
        `LibraryPro se reminder hai ki aapki library membership ` +
        `${daysOverdue} din pehle expire ho gayi thi (${student.endDate}).\n\n` +
        `Kripya jald se jald renew karein warna aapki seat (No. ${student.seatNumber}) ` +
        `kisi aur ko de di jayegi.\n\nDhanyawaad! 🙏`,
    );
    // WhatsApp ka direct link — phone number se message bhejo
    window.open(`https://wa.me/91${student.phone}?text=${msg}`, "_blank");
  };

  // Days calculate karna kitne din se overdue hai
  const getDaysOverdue = (endDate) => {
    const diff = new Date() - new Date(endDate);
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  };

  return (
    <div style={{ maxWidth: "900px", margin: "30px auto", padding: "0 16px" }}>
      <h2 style={{ color: "#1e293b", marginBottom: "6px" }}>
        ⚠️ Defaulters List
      </h2>
      <p style={{ color: "#64748b", marginBottom: "24px" }}>
        {defaulters.length} students ki subscription expire ho chuki hai
      </p>

      {loading ? (
        <p style={{ color: "#94a3b8" }}>Loading...</p>
      ) : defaulters.length === 0 ? (
        <div
          style={{
            background: "#dcfce7",
            color: "#166534",
            padding: "20px",
            borderRadius: "12px",
            textAlign: "center",
            fontWeight: "bold",
          }}
        >
          🎉 Koi defaulter nahi hai! Sab up-to-date hain.
        </div>
      ) : (
        <div>
          {defaulters.map((student) => (
            <div
              key={student.id}
              style={{
                background: "white",
                borderRadius: "12px",
                padding: "18px 20px",
                marginBottom: "12px",
                boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "12px",
                borderLeft: "4px solid #ef4444", // red border = danger indicator
              }}
            >
              <div>
                <div style={{ fontWeight: "bold", fontSize: "16px" }}>
                  {student.name}
                </div>
                <div
                  style={{
                    color: "#64748b",
                    fontSize: "13px",
                    marginTop: "4px",
                  }}
                >
                  📱 {student.phone} &nbsp;|&nbsp; 🪑 Seat {student.seatNumber}{" "}
                  &nbsp;|&nbsp;
                  {student.shift}
                </div>
                <div style={{ marginTop: "6px" }}>
                  {/* Kitne din pehle expire hua */}
                  <span
                    style={{
                      background: "#fee2e2",
                      color: "#991b1b",
                      padding: "3px 10px",
                      borderRadius: "12px",
                      fontSize: "12px",
                      fontWeight: "bold",
                    }}
                  >
                    🔴 {getDaysOverdue(student.endDate)} din overdue
                  </span>
                  <span
                    style={{
                      marginLeft: "8px",
                      color: "#94a3b8",
                      fontSize: "12px",
                    }}
                  >
                    Expired: {student.endDate}
                  </span>
                </div>
              </div>

              {/* WhatsApp button — click karo aur directly message jayega */}
              <button
                onClick={() => sendWhatsApp(student)}
                style={{
                  background: "#25d366",
                  color: "white",
                  border: "none",
                  padding: "10px 20px",
                  borderRadius: "10px",
                  fontSize: "14px",
                  fontWeight: "bold",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                📲 WhatsApp Warning
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
