// src/components/ProtectedRoute.jsx
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function AdminRoute({ children }) {
  // 1. AuthContext se loading state bhi nikalo
  const { user, role, loading } = useAuth();

  // 2. Jab tak session check ho raha hai, tab tak loader dikhao
  if (loading) {
    return (
      <div
        style={{
          color: "#707e94",
          padding: "40px",
          textAlign: "center",
          fontWeight: "600",
        }}
      >
        Verifying Credentials...
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (role !== "admin") return <Navigate to="/student-home" replace />;

  return children;
}

export function StudentRoute({ children }) {
  const { user, role, loading } = useAuth();

  if (loading) {
    return (
      <div
        style={{
          color: "#707e94",
          padding: "40px",
          textAlign: "center",
          fontWeight: "600",
        }}
      >
        Verifying Credentials...
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (role !== "student") return <Navigate to="/dashboard" replace />;

  return children;
}
