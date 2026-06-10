// src/pages/Dashboard.jsx
import { useEffect, useState } from "react";
import { collection, getDocs, doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import SeatLayout from "../components/SeatLayout";

const SHIFT_CONFIG = {
  morning: {
    label: "Morning",
    icon: (
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
          d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z"
        />
      </svg>
    ),
    bg: "bg-amber-50",
    border: "border-amber-200",
    text: "text-amber-700",
    accent: "bg-amber-500",
    badge: "bg-amber-100 text-amber-800",
    stat: "from-amber-500 to-orange-400",
    dot: "bg-amber-400",
  },
  evening: {
    label: "Evening",
    icon: (
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
          d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z"
        />
      </svg>
    ),
    bg: "bg-sky-50",
    border: "border-sky-200",
    text: "text-sky-700",
    accent: "bg-sky-500",
    badge: "bg-sky-100 text-sky-800",
    stat: "from-sky-500 to-blue-400",
    dot: "bg-sky-400",
  },
  fullday: {
    label: "Full Day",
    icon: (
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
          d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18"
        />
      </svg>
    ),
    bg: "bg-violet-50",
    border: "border-violet-200",
    text: "text-violet-700",
    accent: "bg-violet-500",
    badge: "bg-violet-100 text-violet-800",
    stat: "from-violet-500 to-purple-400",
    dot: "bg-violet-400",
  },
};

export default function Dashboard() {
  const [students, setStudents] = useState([]);
  const [filterShift, setFilterShift] = useState("all");
  const [totalSeats, setTotalSeats] = useState(30);
  const [editingSeats, setEditingSeats] = useState(false);
  const [seatInput, setSeatInput] = useState("30");
  const [seatError, setSeatError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const snap = await getDocs(collection(db, "students"));
      setStudents(snap.docs.map((d) => ({ id: d.id, ...d.data() })));

      // Fetch saved seat config
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
  }, []);

  const handleSeatSave = async () => {
    const val = parseInt(seatInput);
    const occupied = students.length;
    if (isNaN(val) || val < 1) {
      setSeatError("Please enter a valid number.");
      return;
    }
    if (val < occupied) {
      setSeatError(
        `Can't set less than ${occupied} — you have ${occupied} active students.`,
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
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full border-4 border-indigo-200 border-t-indigo-600 animate-spin" />
          <p className="text-sm text-slate-500 font-medium">
            Loading dashboard...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-5xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        {/* ── Header ── */}
        <div className="flex items-center justify-between mb-7 flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
              <span className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center">
                <svg
                  className="w-4 h-4 text-white"
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
              Library Dashboard
            </h1>
            <p className="text-sm text-slate-500 mt-0.5 ml-10">
              Live overview of students &amp; seats
            </p>
          </div>

          {/* Total Seats Config */}
          <div className="flex items-center gap-2">
            {editingSeats ? (
              <div className="flex items-center gap-2">
                <div className="flex flex-col">
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      value={seatInput}
                      onChange={(e) => {
                        setSeatInput(e.target.value);
                        setSeatError("");
                      }}
                      className="w-20 px-3 py-1.5 text-sm rounded-lg border border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-200 text-slate-800"
                      min={1}
                      max={200}
                      placeholder="Seats"
                    />
                    <button
                      onClick={handleSeatSave}
                      className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-colors"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => {
                        setEditingSeats(false);
                        setSeatInput(String(totalSeats));
                        setSeatError("");
                      }}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-500 text-xs font-semibold hover:bg-slate-100 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                  {seatError && (
                    <p className="text-xs text-red-500 mt-1">{seatError}</p>
                  )}
                </div>
              </div>
            ) : (
              <button
                onClick={() => setEditingSeats(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-600 text-xs font-semibold hover:bg-slate-50 hover:border-slate-300 transition-all"
              >
                <svg
                  className="w-3.5 h-3.5"
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
                {totalSeats} Total Seats
              </button>
            )}
          </div>
        </div>

        {/* ── Stat Cards ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
          <StatCard
            label="Total Students"
            value={students.length}
            sub={`of ${totalSeats} seats`}
            gradient="from-indigo-500 to-indigo-400"
            icon={
              <svg
                className="w-5 h-5"
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
            sub="students"
            gradient={SHIFT_CONFIG.morning.stat}
            icon={SHIFT_CONFIG.morning.icon}
          />
          <StatCard
            label="Evening"
            value={shiftCount("evening")}
            sub="students"
            gradient={SHIFT_CONFIG.evening.stat}
            icon={SHIFT_CONFIG.evening.icon}
          />
          <StatCard
            label="Full Day"
            value={shiftCount("fullday")}
            sub="students"
            gradient={SHIFT_CONFIG.fullday.stat}
            icon={SHIFT_CONFIG.fullday.icon}
          />
          <StatCard
            label="Seats Free"
            value={freeSeats}
            sub={`${occupancyPct}% full`}
            gradient="from-emerald-500 to-teal-400"
            icon={
              <svg
                className="w-5 h-5"
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
              <div className="mt-2 w-full bg-white/30 rounded-full h-1.5 overflow-hidden">
                <div
                  className="h-full bg-white/80 rounded-full transition-all duration-700"
                  style={{ width: `${occupancyPct}%` }}
                />
              </div>
            }
          />
        </div>

        {/* ── Seat Map ── */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm mb-6 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.8}
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
                <h2 className="text-sm font-bold text-slate-800">
                  Live Seat Map
                </h2>
                <p className="text-xs text-slate-500">
                  {occupiedSeats.length} occupied · {freeSeats} available
                </p>
              </div>
            </div>
            {/* Legend */}
            <div className="flex items-center gap-3 flex-wrap">
              <LegendDot color="bg-emerald-500" label="Available" />
              <LegendDot color="bg-red-400" label="Occupied" />
            </div>
          </div>
          <div className="p-4 sm:p-5">
            <SeatLayout totalSeats={totalSeats} occupiedSeats={occupiedSeats} />
          </div>
        </div>

        {/* ── Student Table ── */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.8}
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
                <h2 className="text-sm font-bold text-slate-800">
                  Student List
                </h2>
                <p className="text-xs text-slate-500">
                  {filtered.length} students shown
                </p>
              </div>
            </div>

            {/* Shift Filter Pills */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {["all", "morning", "evening", "fullday"].map((s) => {
                const active = filterShift === s;
                const cfg = SHIFT_CONFIG[s];
                return (
                  <button
                    key={s}
                    onClick={() => setFilterShift(s)}
                    className={`
                      flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-150
                      ${
                        active
                          ? s === "all"
                            ? "bg-indigo-600 text-white shadow-sm"
                            : `${cfg.accent} text-white shadow-sm`
                          : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                      }
                    `}
                  >
                    {s !== "all" && (
                      <span className={active ? "text-white" : cfg.text}>
                        {cfg.icon}
                      </span>
                    )}
                    {s === "all" ? "All" : cfg.label}
                    <span
                      className={`
                      text-[10px] px-1.5 py-0.5 rounded-full font-bold
                      ${active ? "bg-white/25 text-white" : "bg-white text-slate-500"}
                    `}
                    >
                      {s === "all" ? students.length : shiftCount(s)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Table — desktop */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  {[
                    "Student",
                    "Phone",
                    "Shift",
                    "Seat",
                    "End Date",
                    "Status",
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map((s) => (
                  <tr
                    key={s.id}
                    className="hover:bg-slate-50 transition-colors group"
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xs flex-shrink-0">
                          {s.name?.charAt(0)?.toUpperCase() || "?"}
                        </div>
                        <span className="font-semibold text-slate-800">
                          {s.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-slate-500">{s.phone}</td>
                    <td className="px-5 py-3.5">
                      <ShiftBadge shift={s.shift} />
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 px-2.5 py-1 rounded-lg text-xs font-semibold">
                        <svg
                          className="w-3 h-3"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2}
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5"
                          />
                        </svg>
                        {s.seatNumber}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-slate-500 text-xs">
                      {s.endDate || "—"}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-100 px-2.5 py-1 rounded-full text-xs font-semibold">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        Active
                      </span>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-16 text-center">
                      <div className="flex flex-col items-center gap-2 text-slate-400">
                        <svg
                          className="w-10 h-10 opacity-40"
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
                        <p className="text-sm font-medium">No students found</p>
                        <p className="text-xs">Try a different shift filter</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Card List — mobile */}
          <div className="sm:hidden divide-y divide-slate-100">
            {filtered.map((s) => (
              <div key={s.id} className="px-4 py-3.5 flex items-start gap-3">
                <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-sm flex-shrink-0 mt-0.5">
                  {s.name?.charAt(0)?.toUpperCase() || "?"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-slate-800 text-sm truncate">
                      {s.name}
                    </p>
                    <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-0.5 rounded-full text-xs font-semibold flex-shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      Active
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">{s.phone}</p>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <ShiftBadge shift={s.shift} />
                    <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-600 px-2 py-0.5 rounded-lg text-xs font-semibold">
                      Seat {s.seatNumber}
                    </span>
                    {s.endDate && (
                      <span className="text-xs text-slate-400">
                        Until {s.endDate}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="py-14 text-center text-slate-400">
                <p className="text-sm font-medium">No students found</p>
              </div>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-slate-400 mt-6 pb-4">
          {students.length} registered · {freeSeats} seats available ·{" "}
          {totalSeats} total capacity
        </p>
      </div>
    </div>
  );
}

/* ─── Sub-components ─────────────────────────────────────── */

function StatCard({ label, value, sub, gradient, icon, extraSlot }) {
  return (
    <div
      className={`bg-gradient-to-br ${gradient} rounded-2xl p-4 text-white shadow-sm flex flex-col gap-1 col-span-1`}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-white/70 text-xs font-semibold uppercase tracking-wide">
          {label}
        </span>
        <span className="opacity-80">{icon}</span>
      </div>
      <span className="text-3xl font-bold tracking-tight leading-none">
        {value}
      </span>
      <span className="text-white/70 text-xs font-medium">{sub}</span>
      {extraSlot}
    </div>
  );
}

function ShiftBadge({ shift }) {
  const cfg = SHIFT_CONFIG[shift];
  if (!cfg) return <span className="text-xs text-slate-400">{shift}</span>;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.badge}`}
    >
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

function LegendDot({ color, label }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className={`w-2.5 h-2.5 rounded-sm ${color}`} />
      <span className="text-xs text-slate-500">{label}</span>
    </div>
  );
}
