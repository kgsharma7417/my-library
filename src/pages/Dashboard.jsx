// src/pages/Dashboard.jsx
import { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  doc,
  getDoc,
  setDoc,
  query,
  where,
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext"; // 👈 ADDED
import SeatLayout from "../components/SeatLayout";

const SHIFT_CONFIG = {
  morning: {
    label: "Morning",
    icon: (
      <svg
        className="w-4 h-4"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.5}
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z"
        />
      </svg>
    ),
    bg: "bg-amber-50/60 backdrop-blur-md",
    border: "border-amber-100",
    text: "text-amber-700",
    accent:
      "bg-gradient-to-r from-amber-500 to-orange-500 shadow-lg shadow-orange-500/20",
    badge: "bg-amber-50 text-amber-700 border border-amber-200/60",
    stat: "from-amber-500 via-orange-500 to-amber-600",
    shadow: "shadow-orange-500/10",
  },
  evening: {
    label: "Evening",
    icon: (
      <svg
        className="w-4 h-4"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.5}
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z"
        />
      </svg>
    ),
    bg: "bg-sky-50/60 backdrop-blur-md",
    border: "border-sky-100",
    text: "text-sky-700",
    accent:
      "bg-gradient-to-r from-sky-500 to-indigo-500 shadow-lg shadow-indigo-500/20",
    badge: "bg-sky-50 text-sky-700 border border-sky-200/60",
    stat: "from-sky-500 via-blue-500 to-indigo-600",
    shadow: "shadow-indigo-500/10",
  },
  fullday: {
    label: "Full Day",
    icon: (
      <svg
        className="w-4 h-4"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.5}
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18"
        />
      </svg>
    ),
    bg: "bg-violet-50/60 backdrop-blur-md",
    border: "border-violet-100",
    text: "text-violet-700",
    accent:
      "bg-gradient-to-r from-violet-500 to-purple-500 shadow-lg shadow-purple-500/20",
    badge: "bg-violet-50 text-violet-700 border border-violet-200/60",
    stat: "from-violet-500 via-purple-500 to-fuchsia-600",
    shadow: "shadow-purple-500/10",
  },
};

export default function Dashboard() {
  const { user } = useAuth(); // 👈 ADDED — admin ka uid milega

  const [students, setStudents] = useState([]);
  const [filterShift, setFilterShift] = useState("all");
  const [totalSeats, setTotalSeats] = useState(30);
  const [editingSeats, setEditingSeats] = useState(false);
  const [seatInput, setSeatInput] = useState("30");
  const [seatError, setSeatError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return; // 👈 ADDED — user load hone ka wait karo

    const fetchData = async () => {
      setLoading(true);

      // ✅ CHANGED — pehle getDocs(collection(db,"students")) tha
      // Ab sirf is admin ke students fetch honge
      const q = query(
        collection(db, "students"),
        where("adminId", "==", user.uid),
      );
      const snap = await getDocs(q);
      setStudents(snap.docs.map((d) => ({ id: d.id, ...d.data() })));

      try {
        const cfgDoc = await getDoc(doc(db, "config", "library"));
        if (cfgDoc.exists() && cfgDoc.data().totalSeats) {
          const saved = cfgDoc.data().totalSeats;
          setTotalSeats(saved);
          setSeatInput(String(saved));
        }
      } catch (_) {}

      setLoading(false);
    };

    fetchData();
  }, [user]); // 👈 CHANGED — user dependency add ki

  const handleSeatSave = async () => {
    const val = parseInt(seatInput);
    const occupied = students.length;
    if (isNaN(val) || val < 1) {
      setSeatError("Please enter a valid number.");
      return;
    }
    if (val < occupied) {
      setSeatError(
        `Can't set less than ${occupied} — active students present.`,
      );
      return;
    }
    if (val > 200) {
      setSeatError("Maximum 200 seats allowed.");
      return;
    }
    setTotalSeats(val);
    setEditingSeats(false);
    setSeatError("");
    try {
      await setDoc(
        doc(db, "config", "library"),
        { totalSeats: val },
        { merge: true },
      );
    } catch (_) {}
  };

  const occupiedSeats = students.map((s) => s.seatNumber);
  const freeSeats = totalSeats - occupiedSeats.length;
  const occupancyPct =
    totalSeats > 0 ? Math.round((occupiedSeats.length / totalSeats) * 100) : 0;

  const filtered =
    filterShift === "all"
      ? students
      : students.filter((s) => s.shift === filterShift);
  const shiftCount = (shift) =>
    students.filter((s) => s.shift === shift).length;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50/50 flex items-center justify-center backdrop-blur-sm">
        <div className="flex flex-col items-center gap-4 p-8 rounded-3xl bg-white border border-slate-100 shadow-2xl shadow-slate-100">
          <div className="relative w-12 h-12">
            <div className="absolute inset-0 rounded-full border-4 border-indigo-100" />
            <div className="absolute inset-0 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin" />
          </div>
          <p className="text-sm text-slate-500 font-semibold tracking-wide animate-pulse">
            Syncing System Data...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-slate-50 via-slate-100/70 to-zinc-50 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* ── Header ── */}
        <div className="flex items-center justify-between mb-8 flex-wrap gap-4 bg-white/40 backdrop-blur-md p-4 rounded-2xl border border-white/60 shadow-sm shadow-slate-100">
          <div className="flex items-center gap-3.5">
            <span className="w-11 h-11 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-600/20 transform hover:rotate-6 transition-all duration-300">
              <svg
                className="w-5 h-5 text-white"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.2}
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"
                />
              </svg>
            </span>
            <div>
              <h1 className="text-2xl font-black text-slate-800 tracking-tight">
                Library Dashboard
              </h1>
              <p className="text-xs font-semibold text-slate-400 mt-0.5 tracking-wide uppercase">
                Real-Time Operations Panel
              </p>
            </div>
          </div>

          {/* Config Controls */}
          <div className="flex items-center gap-2">
            {editingSeats ? (
              <div className="flex flex-col items-end bg-white p-2 rounded-xl border border-slate-200/80 shadow-lg transition-all duration-300">
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={seatInput}
                    onChange={(e) => {
                      setSeatInput(e.target.value);
                      setSeatError("");
                    }}
                    className="w-20 px-2.5 py-1.5 text-sm font-bold rounded-lg border border-indigo-200 focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 text-slate-800 transition-all"
                    min={1}
                    max={200}
                  />
                  <button
                    onClick={handleSeatSave}
                    className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 active:scale-95 transition-all"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => {
                      setEditingSeats(false);
                      setSeatInput(String(totalSeats));
                      setSeatError("");
                    }}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-500 text-xs font-semibold hover:bg-slate-50 active:scale-95 transition-all"
                  >
                    Cancel
                  </button>
                </div>
                {seatError && (
                  <p className="text-[11px] text-red-500 font-medium mt-1 mr-1">
                    {seatError}
                  </p>
                )}
              </div>
            ) : (
              <button
                onClick={() => setEditingSeats(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200/80 bg-white/80 backdrop-blur-sm text-slate-700 text-xs font-bold shadow-sm hover:shadow-md hover:border-slate-300 hover:-translate-y-0.5 active:scale-95 transition-all duration-300"
              >
                <svg
                  className="w-4 h-4 text-slate-400 group-hover:rotate-45 transition-transform"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 011.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.56.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.893.149c-.425.07-.765.383-.93.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 01-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.397.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 01-.12-1.45l.527-.737c.25-.35.273-.806.108-1.204-.165-.397-.505-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.108-1.204l-.526-.738a1.125 1.125 0 01.12-1.45l.773-.773a1.125 1.125 0 011.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
                Capacity Setup ({totalSeats})
              </button>
            )}
          </div>
        </div>

        {/* ── Stat Cards Grid ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
          <StatCard
            label="Total Students"
            value={students.length}
            sub={`of ${totalSeats} structural seats`}
            gradient="from-indigo-600 via-indigo-700 to-purple-800"
            shadow="shadow-indigo-600/20"
            icon={
              <svg
                className="w-5 h-5 text-indigo-200"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z"
                />
              </svg>
            }
          />
          <StatCard
            label="Morning"
            value={shiftCount("morning")}
            sub="active rosters"
            gradient={SHIFT_CONFIG.morning.stat}
            shadow={SHIFT_CONFIG.morning.shadow}
            icon={SHIFT_CONFIG.morning.icon}
          />
          <StatCard
            label="Evening"
            value={shiftCount("evening")}
            sub="active rosters"
            gradient={SHIFT_CONFIG.evening.stat}
            shadow={SHIFT_CONFIG.evening.shadow}
            icon={SHIFT_CONFIG.evening.icon}
          />
          <StatCard
            label="Full Day"
            value={shiftCount("fullday")}
            sub="active rosters"
            gradient={SHIFT_CONFIG.fullday.stat}
            shadow={SHIFT_CONFIG.fullday.shadow}
            icon={SHIFT_CONFIG.fullday.icon}
          />
          <StatCard
            label="Seats Free"
            value={freeSeats}
            sub={`${occupancyPct}% real occupancy`}
            gradient="from-emerald-500 via-teal-600 to-cyan-700"
            shadow="shadow-emerald-600/20"
            icon={
              <svg
                className="w-5 h-5 text-emerald-200"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z"
                />
              </svg>
            }
            extraSlot={
              <div className="mt-3 w-full bg-black/15 rounded-full h-2 p-[2px] overflow-hidden backdrop-blur-sm border border-white/10">
                <div
                  className="h-full bg-gradient-to-r from-teal-200 to-white rounded-full transition-all duration-1000 cubic-bezier(0.4,_0,_0.2,_1)"
                  style={{ width: `${occupancyPct}%` }}
                />
              </div>
            }
          />
        </div>

        {/* ── Live Seat Map ── */}
        <div className="bg-white rounded-2xl border border-slate-200/70 shadow-xl shadow-slate-200/30 mb-8 overflow-hidden transform hover:border-slate-300/80 transition-all duration-300">
          <div className="px-6 py-4 bg-slate-50/50 backdrop-blur-sm border-b border-slate-100 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-inner">
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z"
                  />
                </svg>
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-800 tracking-tight">
                  Live Library Spatial Grid
                </h2>
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mt-0.5">
                  {occupiedSeats.length} occupied · {freeSeats} unassigned
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4 bg-white/80 border border-slate-200/60 px-3 py-1.5 rounded-xl shadow-sm">
              <LegendDot
                color="bg-emerald-500 ring-4 ring-emerald-500/10"
                label="Available"
              />
              <LegendDot
                color="bg-red-400 ring-4 ring-red-400/10"
                label="Occupied"
              />
            </div>
          </div>
          <div className="p-6 bg-gradient-to-b from-white via-slate-50/20 to-white">
            <SeatLayout totalSeats={totalSeats} occupiedSeats={occupiedSeats} />
          </div>
        </div>

        {/* ── Student Registry Table ── */}
        <div className="bg-white rounded-2xl border border-slate-200/70 shadow-xl shadow-slate-200/30 overflow-hidden transform hover:border-slate-300/80 transition-all duration-300">
          <div className="px-6 py-4 bg-slate-50/50 backdrop-blur-sm border-b border-slate-100 flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-inner">
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
                  />
                </svg>
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-800 tracking-tight">
                  Student Roster
                </h2>
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mt-0.5">
                  Displaying {filtered.length} Indexed Nodes
                </p>
              </div>
            </div>

            {/* Shift Filter Pills */}
            <div className="flex items-center gap-1.5 bg-slate-100/80 p-1 rounded-xl border border-slate-200/40 backdrop-blur-sm">
              {["all", "morning", "evening", "fullday"].map((s) => {
                const active = filterShift === s;
                const cfg = SHIFT_CONFIG[s];
                return (
                  <button
                    key={s}
                    onClick={() => setFilterShift(s)}
                    className={`
                      flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-300 ease-out active:scale-95
                      ${
                        active
                          ? s === "all"
                            ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/10"
                            : `${cfg.accent} text-white`
                          : "text-slate-600 hover:bg-white hover:text-slate-800"
                      }
                    `}
                  >
                    {s !== "all" && (
                      <span className={active ? "text-white" : "opacity-70"}>
                        {cfg.icon}
                      </span>
                    )}
                    {s === "all" ? "All Shifts" : cfg.label}
                    <span
                      className={`
                        text-[10px] px-1.5 py-0.5 rounded-md font-black tracking-wide ml-0.5 transition-all
                        ${active ? "bg-white/20 text-white" : "bg-slate-200/60 text-slate-600"}
                      `}
                    >
                      {s === "all" ? students.length : shiftCount(s)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Desktop Table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50/60 text-slate-400 font-bold border-b border-slate-100">
                  {[
                    "Student Identity",
                    "Contact Node",
                    "Assigned Shift",
                    "Spatial Desk",
                    "Terminus Date",
                    "Operational Status",
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-6 py-4 text-left text-[11px] font-bold uppercase tracking-wider"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100/60 bg-white">
                {filtered.map((s) => (
                  <tr
                    key={s.id}
                    className="hover:bg-slate-50/70 transition-all duration-200 ease-in-out group"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100/60 flex items-center justify-center text-indigo-600 font-extrabold text-sm shadow-sm group-hover:scale-105 transition-transform duration-300">
                          {s.name?.charAt(0)?.toUpperCase() || "?"}
                        </div>
                        <span className="font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">
                          {s.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap font-medium text-slate-500 tracking-wide">
                      {s.phone}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <ShiftBadge shift={s.shift} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5 bg-slate-50 border border-slate-200/50 text-slate-700 px-2.5 py-1 rounded-lg text-xs font-bold shadow-sm">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                        Desk {s.seatNumber}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap font-semibold text-slate-500 text-xs tracking-wider">
                      {s.endDate || "—"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5 bg-emerald-50/60 text-emerald-700 border border-emerald-200/60 px-3 py-1 rounded-full text-xs font-bold shadow-sm shadow-emerald-500/5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Active Node
                      </span>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && <EmptyStateRow colSpan={6} />}
              </tbody>
            </table>
          </div>

          {/* Mobile Layout */}
          <div className="sm:hidden divide-y divide-slate-100 bg-white">
            {filtered.map((s) => (
              <div
                key={s.id}
                className="p-4 flex items-start gap-3 hover:bg-slate-50/40 transition-colors"
              >
                <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100/60 flex items-center justify-center text-indigo-600 font-black text-sm flex-shrink-0 mt-0.5 shadow-sm">
                  {s.name?.charAt(0)?.toUpperCase() || "?"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-bold text-slate-800 text-sm truncate">
                      {s.name}
                    </p>
                    <span className="inline-flex items-center gap-1 bg-emerald-50/60 text-emerald-700 border border-emerald-200/40 px-2.5 py-0.5 rounded-full text-[10px] font-bold flex-shrink-0">
                      <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
                      Active
                    </span>
                  </div>
                  <p className="text-xs font-medium text-slate-400 mt-0.5 tracking-wide">
                    {s.phone}
                  </p>
                  <div className="flex items-center gap-2 mt-3 flex-wrap">
                    <ShiftBadge shift={s.shift} />
                    <span className="inline-flex items-center gap-1 bg-slate-50 border border-slate-200/60 px-2 py-0.5 rounded-lg text-[11px] font-bold text-slate-600">
                      Desk {s.seatNumber}
                    </span>
                    {s.endDate && (
                      <span className="text-[11px] font-semibold text-slate-400 ml-auto bg-slate-100 px-2 py-0.5 rounded">
                        Till {s.endDate}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="py-14 text-center text-slate-400 bg-slate-50/30">
                <p className="text-xs font-bold uppercase tracking-wider">
                  No Student Footprint Found
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-[11px] font-bold uppercase tracking-widest text-slate-400 mt-8 pb-4">
          Metric Echo: {students.length} Allocated · {freeSeats} Available ·{" "}
          {totalSeats} Absolute Bounds
        </p>
      </div>
    </div>
  );
}

/* ─── Sub-components ─────────────────────────────────── */

function StatCard({ label, value, sub, gradient, shadow, icon, extraSlot }) {
  return (
    <div
      className={`bg-gradient-to-br ${gradient} ${shadow} rounded-2xl p-5 text-white shadow-xl flex flex-col gap-1 transform hover:-translate-y-1 hover:scale-[1.02] transition-all duration-300 ease-out group relative overflow-hidden`}
    >
      <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
      <div className="flex items-center justify-between mb-1.5 relative z-10">
        <span className="text-white/60 text-[10px] font-bold uppercase tracking-widest">
          {label}
        </span>
        <span className="opacity-40 group-hover:opacity-90 group-hover:scale-110 transition-all duration-300 transform">
          {icon}
        </span>
      </div>
      <span className="text-3xl font-black tracking-tight leading-none relative z-10 drop-shadow-sm">
        {value}
      </span>
      <span className="text-white/60 text-[11px] font-semibold tracking-wide mt-1 relative z-10">
        {sub}
      </span>
      {extraSlot}
    </div>
  );
}

function ShiftBadge({ shift }) {
  const cfg = SHIFT_CONFIG[shift];
  if (!cfg)
    return <span className="text-xs text-slate-400 font-bold">{shift}</span>;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-transform duration-200 ${cfg.badge}`}
    >
      <span className="opacity-70">{cfg.icon}</span>
      {cfg.label}
    </span>
  );
}

function LegendDot({ color, label }) {
  return (
    <div className="flex items-center gap-2">
      <div className={`w-2 h-2 rounded-full ${color}`} />
      <span className="text-xs font-bold text-slate-600 tracking-wide">
        {label}
      </span>
    </div>
  );
}

function EmptyStateRow({ colSpan }) {
  return (
    <tr>
      <td colSpan={colSpan} className="py-20 text-center bg-slate-50/10">
        <div className="flex flex-col items-center gap-2.5 text-slate-400 animate-fade-in">
          <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 border border-slate-200/40 shadow-inner">
            <svg
              className="w-5 h-5 opacity-60"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z"
              />
            </svg>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
              No Roster Footprints Found
            </p>
            <p className="text-[11px] text-slate-400 font-medium mt-0.5">
              Modify the active operational filter bounds above.
            </p>
          </div>
        </div>
      </td>
    </tr>
  );
}
