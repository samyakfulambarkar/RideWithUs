import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { adminAPI } from "../../services/api";
import toast from "react-hot-toast";

// ── Commission config (adjust as needed) ─────────────────────────
const COMMISSION_RATE = 0.05; // 5% platform fee

// ── Sub-components ────────────────────────────────────────────────
const StatCard = ({ label, value, color, sub, icon }) => (
  <div className="bg-red-900 border border-gray-800 rounded-xl p-5 hover:border-gray-700 transition-colors">
    <div className="flex items-start justify-between mb-1">
      <p className="text-xs text-gray-500 uppercase tracking-wider">{label}</p>
      {icon && <span className="text-lg">{icon}</span>}
    </div>
    <p className={`font-display text-2xl font-bold ${color}`}>{value}</p>
    {sub && <p className="text-xs text-gray-600 mt-1">{sub}</p>}
  </div>
);

const MiniBar = ({ label, count, total, color }) => {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-gray-500 capitalize">{label}</span>
        <span className="text-gray-400">
          {count} <span className="text-gray-600">({pct}%)</span>
        </span>
      </div>
      <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${color} transition-all duration-700`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
};

const STATUS_BAR_COLORS = {
  pending: "bg-yellow-500",
  confirmed: "bg-green-500",
  started: "bg-blue-500",
  completed: "bg-purple-500",
  cancelled: "bg-red-500",
  refunded: "bg-gray-500",
};

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [revenue, setRevenue] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([adminAPI.getDashboard(), adminAPI.getRevenue()])
      .then(([dash, rev]) => {
        setData(dash.data.dashboard);
        setRevenue(rev.data.monthly || []);
      })
      .catch(() => toast.error("Failed to load dashboard"))
      .finally(() => setLoading(false));
  }, []);

  if (loading)
    return (
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <div
              key={i}
              className="bg-gray-900 border border-gray-800 rounded-xl p-5 animate-pulse h-24"
            />
          ))}
        </div>
      </div>
    );

  // ── Commission calculations ──────────────────────────────────
  const totalRevenue = data?.totalRevenue || 0;
  const commissionEarned = Math.round(totalRevenue * COMMISSION_RATE);
  const driverEarnings = totalRevenue - commissionEarned;

  // Monthly chart max for bar height scaling
  const maxMonthly = revenue?.length
    ? Math.max(...revenue.map((m) => m.total), 1)
    : 1;

  const MONTH_NAMES = [
    "",
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  const totalBookings = Object.values(
    data?.bookingStatusBreakdown || {},
  ).reduce((a, v) => a + v, 0);

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-purple-400">
            Admin Dashboard
          </h1>
          <p className="text-gray-500 text-sm">RideWithUs platform overview</p>
        </div>
        <div className="flex gap-2">
          <Link
            to="/admin/rides"
            className="bg-gray-800 border border-gray-700 text-gray-200 px-4 py-2 rounded-lg text-sm hover:bg-gray-700 transition-all"
          >
            Manage Rides
          </Link>
          <Link
            to="/admin/bookings"
            className="bg-gray-800 border border-gray-700 text-gray-200 px-4 py-2 rounded-lg text-sm hover:bg-gray-700 transition-all"
          >
            Manage Bookings
          </Link>
          <Link
            to="/admin/users"
            className="bg-gray-800 border border-gray-700 text-gray-200 px-4 py-2 rounded-lg text-sm hover:bg-gray-700 transition-all"
          >
            Manage Users
          </Link>
        </div>
      </div>

      {data && (
        <>
          {/* ── Core stats ── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <StatCard
              label="Total Users"
              value={data.totalUsers?.toLocaleString("en-IN")}
              color="text-purple-400"
              sub={`+${data.newUsersThisMonth} this month`}
              icon="👥"
            />
            <StatCard
              label="Total Rides"
              value={data.totalRides?.toLocaleString("en-IN")}
              color="text-orange-400"
              sub={`+${data.newRidesThisMonth} this month`}
              icon="🗺️"
            />
            <StatCard
              label="Total Bookings"
              value={data.totalBookings?.toLocaleString("en-IN")}
              color="text-blue-400"
              icon="🎫"
            />
            <StatCard
              label="Active Rides"
              value={data.activeRides}
              color="text-green-400"
              sub="scheduled + active + started"
              icon="🟢"
            />
          </div>

          {/* ── Commission & Revenue panel ── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {/* GMV */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">
                Total GMV
              </p>
              <p className="font-display text-3xl font-bold text-orange-400">
                ₹{totalRevenue.toLocaleString("en-IN")}
              </p>
              <p className="text-xs text-gray-600 mt-1">
                Gross payment collected
              </p>
            </div>

            {/* Commission earned */}
            <div className="bg-gray-900 border border-purple-500/20 rounded-xl p-5">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-gray-500 uppercase tracking-wider">
                  Platform Commission
                </p>
                <span className="text-xs bg-purple-500/10 text-purple-400 border border-purple-500/20 px-2 py-0.5 rounded-md">
                  {(COMMISSION_RATE * 100).toFixed(0)}%
                </span>
              </div>
              <p className="font-display text-3xl font-bold text-purple-400">
                ₹{commissionEarned.toLocaleString("en-IN")}
              </p>
              <p className="text-xs text-gray-600 mt-1">Revenue to platform</p>
            </div>

            {/* Driver earnings */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">
                Driver Earnings
              </p>
              <p className="font-display text-3xl font-bold text-green-400">
                ₹{driverEarnings.toLocaleString("en-IN")}
              </p>
              <p className="text-xs text-gray-600 mt-1">After platform fee</p>
            </div>
          </div>

          {/* ── Vehicle breakdown + Booking status ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {/* Vehicle mix */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h2 className="font-display text-sm font-semibold text-gray-300 mb-4">
                Vehicle Mix
              </h2>
              <div className="space-y-3">
                <MiniBar
                  label="🏍 Bike"
                  count={data.vehicleBreakdown?.bike || 0}
                  total={
                    (data.vehicleBreakdown?.bike || 0) +
                    (data.vehicleBreakdown?.car || 0)
                  }
                  color="bg-blue-500"
                />
                <MiniBar
                  label="🚗 Car"
                  count={data.vehicleBreakdown?.car || 0}
                  total={
                    (data.vehicleBreakdown?.bike || 0) +
                    (data.vehicleBreakdown?.car || 0)
                  }
                  color="bg-green-500"
                />
              </div>
            </div>

            {/* Booking status breakdown */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h2 className="font-display text-sm font-semibold text-gray-300 mb-4">
                Booking Statuses
              </h2>
              <div className="space-y-3">
                {Object.entries(data.bookingStatusBreakdown || {}).map(
                  ([status, count]) => (
                    <MiniBar
                      key={status}
                      label={status}
                      count={count}
                      total={totalBookings}
                      color={STATUS_BAR_COLORS[status] || "bg-gray-500"}
                    />
                  ),
                )}
              </div>
            </div>
          </div>

          {/* ── Monthly revenue chart ── */}
          {revenue && revenue.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h2 className="font-display text-sm font-semibold text-gray-300 mb-5">
                Monthly Revenue (last 6 months)
              </h2>
              <div className="flex items-end gap-3 h-32">
                {revenue.map((m) => {
                  const heightPct = (m.total / maxMonthly) * 100;
                  return (
                    <div
                      key={`${m._id.year}-${m._id.month}`}
                      className="flex flex-col items-center gap-1 flex-1"
                    >
                      <span className="text-xs text-gray-600">
                        ₹{(m.total / 1000).toFixed(1)}k
                      </span>
                      <div
                        className="w-full bg-orange-500/30 hover:bg-orange-500/50 rounded-t-md transition-all cursor-default"
                        style={{ height: `${Math.max(heightPct, 4)}%` }}
                        title={`₹${m.total.toLocaleString("en-IN")} · ${m.count} bookings`}
                      />
                      <span className="text-xs text-gray-600">
                        {MONTH_NAMES[m._id.month]}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
