import { useAuth } from "../context/AuthContext";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";
import { useNavigate } from "react-router-dom";

export default function StudentHome() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/login");
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f0f2f8",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "Inter, sans-serif",
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 20,
          padding: "32px 28px",
          border: "1.5px solid #e5e7eb",
          textAlign: "center",
          maxWidth: 360,
          width: "100%",
        }}
      >
        <div style={{ fontSize: 40, marginBottom: 12 }}>📚</div>
        <h2 style={{ color: "#1e1b4b", fontWeight: 800, margin: "0 0 6px" }}>
          Student Dashboard
        </h2>
        <p style={{ color: "#9ca3af", fontSize: 13, margin: "0 0 20px" }}>
          {user?.email}
        </p>
        <button
          onClick={handleLogout}
          style={{
            padding: "10px 24px",
            borderRadius: 12,
            border: "1.5px solid #e5e7eb",
            background: "#fff",
            color: "#ef4444",
            fontWeight: 700,
            cursor: "pointer",
            fontSize: 14,
            fontFamily: "inherit",
          }}
        >
          Logout
        </button>
      </div>
    </div>
  );
}
