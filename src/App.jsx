// src/App.jsx
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import Dashboard from "./pages/Dashboard";
import AddStudent from "./pages/AddStudent";
import Attendance from "./pages/Attendance";
import Students from "./pages/Students";
import Defaulters from "./pages/Defaulters";
import Finance from "./pages/Finance";
import Expenses from "./pages/Expenses";
import Reminders from "./pages/Reminders"; // NEW

function App() {
  return (
    <BrowserRouter>
      <Navbar />
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/add-student" element={<AddStudent />} />
        <Route path="/students" element={<Students />} />
        <Route path="/attendance" element={<Attendance />} />
        <Route path="/defaulters" element={<Defaulters />} />
        <Route path="/finance" element={<Finance />} />
        <Route path="/expenses" element={<Expenses />} />
        <Route path="/reminders" element={<Reminders />} /> {/* NEW */}
      </Routes>
    </BrowserRouter>
  );
}

export default App;
