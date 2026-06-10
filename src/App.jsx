import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { AdminRoute, StudentRoute } from "./components/ProtectedRoute";
import Navbar from "./components/Navbar";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import AddStudent from "./pages/AddStudent";
import Attendance from "./pages/Attendance";
import Students from "./pages/Students";
import StudentProfile from "./pages/StudentProfile";
import Defaulters from "./pages/Defaulters";
import Finance from "./pages/Finance";
import Expenses from "./pages/Expenses";
import Reminders from "./pages/Reminders";
import StudentHome from "./pages/StudentHome";

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<Login />} />

          {/* Admin only — Navbar andar render hogi */}
          <Route
            path="/dashboard"
            element={
              <AdminRoute>
                <Navbar />
                <Dashboard />
              </AdminRoute>
            }
          />
          <Route
            path="/students"
            element={
              <AdminRoute>
                <Navbar />
                <Students />
              </AdminRoute>
            }
          />
          <Route
            path="/students/:id"
            element={
              <AdminRoute>
                <Navbar />
                <StudentProfile />
              </AdminRoute>
            }
          />
          <Route
            path="/add-student"
            element={
              <AdminRoute>
                <Navbar />
                <AddStudent />
              </AdminRoute>
            }
          />
          <Route
            path="/attendance"
            element={
              <AdminRoute>
                <Navbar />
                <Attendance />
              </AdminRoute>
            }
          />
          <Route
            path="/reminders"
            element={
              <AdminRoute>
                <Navbar />
                <Reminders />
              </AdminRoute>
            }
          />
          <Route
            path="/defaulters"
            element={
              <AdminRoute>
                <Navbar />
                <Defaulters />
              </AdminRoute>
            }
          />
          <Route
            path="/finance"
            element={
              <AdminRoute>
                <Navbar />
                <Finance />
              </AdminRoute>
            }
          />
          <Route
            path="/expenses"
            element={
              <AdminRoute>
                <Navbar />
                <Expenses />
              </AdminRoute>
            }
          />

          {/* Student only */}
          <Route
            path="/student-home"
            element={
              <StudentRoute>
                <StudentHome />
              </StudentRoute>
            }
          />

          {/* Default */}
          <Route path="/" element={<Navigate to="/login" />} />
          <Route path="*" element={<Navigate to="/login" />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
