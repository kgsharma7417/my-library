// src/pages/Attendance.jsx
import { useEffect, useRef, useState } from "react";
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  Timestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import { Html5Qrcode } from "html5-qrcode";

// Ye page webcam se QR code scan karta hai
// Scan hone par student ID milti hai
// Firebase mein check karta hai ki aaj already attendance hai ya nahi
// Agar nahi hai toh nayi entry save karta hai

export default function Attendance() {
  const [scanning, setScanning] = useState(false); // camera on/off
  const [lastScanned, setLastScanned] = useState(null); // last successful scan
  const [message, setMessage] = useState(""); // success/error message
  const [todayAttendance, setTodayAttendance] = useState([]); // aaj ki list
  const qrRef = useRef(null); // scanner instance ko store karne ke liye
  const scannerDivId = "qr-reader"; // HTML div ka ID jahan camera render hoga

  // Page load hone par aaj ki attendance fetch karo
  useEffect(() => {
    fetchTodayAttendance();
  }, []);

  // Aaj ki attendance Firebase se fetch karna
  const fetchTodayAttendance = async () => {
    // Aaj ke din ka start aur end time calculate karo
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    // Firebase query — sirf aaj ke records lao
    const q = query(
      collection(db, "attendance"),
      where("timestamp", ">=", Timestamp.fromDate(startOfDay)),
      where("timestamp", "<=", Timestamp.fromDate(endOfDay)),
    );
    const snap = await getDocs(q);
    setTodayAttendance(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  };

  // Camera start karna
  const startScanner = async () => {
    setScanning(true);
    setMessage("");

    // Html5Qrcode library — browser ka camera access karta hai
    const html5QrCode = new Html5Qrcode(scannerDivId);
    qrRef.current = html5QrCode; // ref mein save karo taaki baad mein band kar sakein

    try {
      await html5QrCode.start(
        { facingMode: "environment" }, // rear camera prefer karo (mobile par)
        { fps: 10, qrbox: { width: 250, height: 250 } }, // scanner box ka size
        onScanSuccess, // QR milne par ye function call hoga
        () => {}, // scan fail hone par kuch mat karo (silent)
      );
    } catch (err) {
      setMessage("❌ Camera access denied. Please allow camera permission.");
      setScanning(false);
    }
  };

  // QR successfully scan hone par
  const onScanSuccess = async (studentId) => {
    // Pehle scanner band karo — ek baar scan kaafi hai
    if (qrRef.current) {
      await qrRef.current.stop();
      setScanning(false);
    }

    try {
      // Firebase mein student ka record dhundho us ID se
      const studentSnap = await getDocs(collection(db, "students"));
      const student = studentSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .find((s) => s.id === studentId);

      if (!student) {
        setMessage("❌ Student not found! Invalid QR code.");
        return;
      }

      // Check karo ki aaj pehle se attendance hai ya nahi
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const alreadyMarked = todayAttendance.find(
        (a) => a.studentId === studentId && a.timestamp?.toDate() >= startOfDay,
      );

      if (alreadyMarked) {
        setMessage(
          `⚠️ ${student.name} ki attendance aaj already mark ho chuki hai!`,
        );
        setLastScanned(student);
        return;
      }

      // Naya attendance record Firebase mein save karo
      await addDoc(collection(db, "attendance"), {
        studentId: student.id,
        studentName: student.name,
        shift: student.shift,
        seatNumber: student.seatNumber,
        timestamp: Timestamp.now(), // current time
        date: new Date().toLocaleDateString("en-IN"), // readable date
      });

      setLastScanned(student);
      setMessage(`✅ Attendance marked for ${student.name}!`);
      fetchTodayAttendance(); // list refresh karo
    } catch (err) {
      setMessage("❌ Error marking attendance: " + err.message);
    }
  };

  // Camera band karna
  const stopScanner = async () => {
    if (qrRef.current) {
      await qrRef.current.stop();
      qrRef.current = null;
    }
    setScanning(false);
  };

  return (
    <div style={{ maxWidth: "900px", margin: "30px auto", padding: "0 16px" }}>
      <h2 style={{ color: "#1e293b", marginBottom: "6px" }}>
        📷 QR Attendance
      </h2>
      <p style={{ color: "#64748b", marginBottom: "24px" }}>
        Student ka QR code scan karo — attendance automatically save hogi
      </p>

      <div
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}
      >
        {/* Left: Scanner */}
        <div>
          {/* Ye div html5-qrcode camera render karega */}
          <div
            id={scannerDivId}
            style={{
              width: "100%",
              minHeight: "280px",
              background: "#0f172a",
              borderRadius: "14px",
              overflow: "hidden",
              marginBottom: "16px",
            }}
          />

          {/* Start/Stop buttons */}
          {!scanning ? (
            <button onClick={startScanner} style={btnStyle("#6366f1")}>
              📷 Start Camera Scanner
            </button>
          ) : (
            <button onClick={stopScanner} style={btnStyle("#ef4444")}>
              ⏹ Stop Scanner
            </button>
          )}

          {/* Success/Error message */}
          {message && (
            <div
              style={{
                marginTop: "16px",
                padding: "12px 16px",
                borderRadius: "10px",
                background: message.startsWith("✅")
                  ? "#dcfce7"
                  : message.startsWith("⚠️")
                    ? "#fef3c7"
                    : "#fee2e2",
                color: message.startsWith("✅")
                  ? "#166534"
                  : message.startsWith("⚠️")
                    ? "#92400e"
                    : "#991b1b",
                fontWeight: "bold",
                fontSize: "14px",
              }}
            >
              {message}
            </div>
          )}

          {/* Last scanned student info */}
          {lastScanned && (
            <div
              style={{
                marginTop: "16px",
                background: "white",
                borderRadius: "12px",
                padding: "16px",
                boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
              }}
            >
              <div style={{ fontWeight: "bold", fontSize: "16px" }}>
                {lastScanned.name}
              </div>
              <div style={{ color: "#64748b", fontSize: "13px" }}>
                📱 {lastScanned.phone} &nbsp;|&nbsp; 🪑 Seat{" "}
                {lastScanned.seatNumber}
              </div>
            </div>
          )}
        </div>

        {/* Right: Aaj ki attendance list */}
        <div>
          <h3 style={{ margin: "0 0 16px", color: "#1e293b" }}>
            📋 Today's Attendance ({todayAttendance.length})
          </h3>
          <div style={{ maxHeight: "400px", overflowY: "auto" }}>
            {todayAttendance.length === 0 ? (
              <p style={{ color: "#94a3b8" }}>Abhi tak koi attendance nahi.</p>
            ) : (
              todayAttendance.map((a) => (
                <div
                  key={a.id}
                  style={{
                    background: "white",
                    borderRadius: "10px",
                    padding: "12px 16px",
                    marginBottom: "8px",
                    boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: "bold", fontSize: "14px" }}>
                      {a.studentName}
                    </div>
                    <div style={{ color: "#64748b", fontSize: "12px" }}>
                      🪑 {a.seatNumber} | {a.shift}
                    </div>
                  </div>
                  <div style={{ fontSize: "12px", color: "#94a3b8" }}>
                    {a.timestamp
                      ?.toDate()
                      .toLocaleTimeString("en-IN", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
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

const btnStyle = (bg) => ({
  background: bg,
  color: "white",
  border: "none",
  padding: "12px 24px",
  borderRadius: "10px",
  fontSize: "15px",
  fontWeight: "bold",
  cursor: "pointer",
  width: "100%",
});
