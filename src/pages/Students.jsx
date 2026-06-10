// src/pages/Students.jsx
import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import StudentQRCard from "../components/StudentQRCard";

// Ye page sabhi registered students ki list dikhata hai
// Har student ka QR card bhi show hota hai
// Admin yahan se kisi bhi student ka QR dekh/print kar sakta hai

export default function Students() {
  const [students, setStudents] = useState([]);
  const [search, setSearch] = useState(""); // search filter ke liye
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStudents = async () => {
      // Firebase ke "students" collection se saare documents fetch karo
      const snapshot = await getDocs(collection(db, "students"));
      const data = snapshot.docs.map((doc) => ({
        id: doc.id, // Firebase auto-generated unique ID
        ...doc.data(), // baaki saari fields (name, phone, shift etc.)
      }));
      setStudents(data);
      setLoading(false);
    };
    fetchStudents();
  }, []); // [] matlab sirf ek baar run ho jab page load ho

  // Search filter — name ya phone se dhundho
  const filtered = students.filter(
    (s) =>
      s.name?.toLowerCase().includes(search.toLowerCase()) ||
      s.phone?.includes(search),
  );

  return (
    <div style={{ maxWidth: "1100px", margin: "30px auto", padding: "0 16px" }}>
      <h2 style={{ color: "#1e293b", marginBottom: "6px" }}>👥 All Students</h2>
      <p style={{ color: "#64748b", marginBottom: "20px" }}>
        {students.length} registered students — QR cards for attendance
      </p>

      {/* Search bar */}
      <input
        type="text"
        placeholder="🔍 Search by name or phone..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{
          width: "100%",
          maxWidth: "400px",
          padding: "10px 16px",
          borderRadius: "10px",
          border: "1.5px solid #e2e8f0",
          fontSize: "15px",
          marginBottom: "24px",
          boxSizing: "border-box",
        }}
      />

      {loading ? (
        <p style={{ color: "#94a3b8" }}>Loading students...</p>
      ) : (
        // Saare QR cards grid mein dikhao
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "20px",
          }}
        >
          {filtered.map((student) => (
            // Har student ke liye ek QR card component render karo
            <StudentQRCard key={student.id} student={student} />
          ))}
          {filtered.length === 0 && (
            <p style={{ color: "#94a3b8" }}>No students found.</p>
          )}
        </div>
      )}
    </div>
  );
}
