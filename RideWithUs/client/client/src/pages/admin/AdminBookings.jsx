import React, { useEffect, useState, useCallback } from "react";
import { adminAPI } from "../../services/api";
import { format } from "date-fns";
import toast from "react-hot-toast";

const STATUS_CLASSES = {
  pending: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20",
  confirmed: "text-green-400  bg-green-400/10  border-green-400/20",
  started: "text-blue-400   bg-blue-400/10   border-blue-400/20",
  completed: "text-gray-400   bg-gray-400/10   border-gray-400/20",
  cancelled: "text-red-400    bg-red-400/10    border-red-400/20",
  refunded: "text-purple-400 bg-purple-400/10 border-purple-400/20",
};

const PAYMENT_CLASSES = {
  paid: "text-green-400  bg-green-400/10",
  pending: "text-yellow-400 bg-yellow-400/10",
  refunded: "text-purple-400 bg-purple-400/10",
  failed: "text-red-400    bg-red-400/10",
};

const STATUSES = [
  "pending",
  "confirmed",
  "started",
  "completed",
  "cancelled",
  "refunded",
];

export default function AdminBookings() {
  const [bookings, setBookings] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);

  const LIMIT = 20;

  const load = useCallback(() => {
    setLoading(true);
    adminAPI
      .getBookings({ status, page, limit: LIMIT })
      .then(({ data }) => {
        setBookings(data.bookings || []);
        setTotal(data.total || 0);
      })
      .catch(() => toast.error("Failed to load bookings"))
      .finally(() => setLoading(false));
  }, [status, page]);

  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    setPage(1);
  }, [status]);

  const totalPages = Math.ceil(total / LIMIT);

  // Revenue from completed/paid bookings shown in this filtered view
  const visibleRevenue = bookings
    .filter((b) => b.payment?.status === "paid")
    .reduce((sum, b) => sum + (b.totalAmount || 0), 0);

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="font-display text-2xl font-bold text-purple-400">
            All Bookings
          </h1>
          <p className="text-gray-500 text-sm">
            {total.toLocaleString("en-IN")} total bookings
          </p>
        </div>
        {visibleRevenue > 0 && (
          <div className="text-right">
            <p className="text-xs text-gray-500 uppercase tracking-wider">
              Paid (this view)
            </p>
            <p className="font-display text-lg font-bold text-orange-400">
              ₹{visibleRevenue.toLocaleString("en-IN")}
            </p>
          </div>
        )}
      </div>

      {/* Filter */}
      <div className="flex gap-2 mb-5 flex-wrap">
        <button
          onClick={() => setStatus("")}
          className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${
            status === ""
              ? "bg-purple-500/10 border-purple-500/20 text-purple-400"
              : "bg-gray-900 border-gray-700 text-gray-500 hover:text-gray-300"
          }`}
        >
          All
        </button>
        {STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-all capitalize ${
              status === s
                ? `${STATUS_CLASSES[s]} border-current`
                : "bg-gray-900 border-gray-700 text-gray-500 hover:text-gray-300"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(8)].map((_, i) => (
            <div
              key={i}
              className="bg-gray-900 border border-gray-800 rounded-xl h-14 animate-pulse"
            />
          ))}
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          {/* Header row */}
          <div className="grid grid-cols-[2fr_1.5fr_1.5fr_1fr_1fr_1fr] gap-3 px-4 py-3 border-b border-gray-800 text-xs text-gray-500 uppercase tracking-wider">
            <span>Route</span>
            <span>Passenger</span>
            <span>Driver</span>
            <span>Amount</span>
            <span>Payment</span>
            <span>Status</span>
          </div>

          {bookings.length === 0 ? (
            <p className="text-center text-gray-600 py-10">No bookings found</p>
          ) : (
            bookings.map((b) => (
              <div
                key={b._id}
                className="grid grid-cols-[2fr_1.5fr_1.5fr_1fr_1fr_1fr] gap-3 px-4 py-3 border-b border-gray-800 last:border-0 items-center hover:bg-gray-800/30 transition-colors"
              >
                {/* Route */}
                <div className="min-w-0">
                  <p className="text-xs text-gray-300 truncate">
                    {b.ride?.origin?.address?.split(",")[0] || "—"}
                  </p>
                  <p className="text-xs text-gray-600 truncate">
                    → {b.ride?.destination?.address?.split(",")[0] || "—"}
                  </p>
                  {b.ride?.departureTime && (
                    <p className="text-xs text-gray-700 mt-0.5">
                      {format(new Date(b.ride.departureTime), "MMM d, h:mm a")}
                    </p>
                  )}
                </div>

                {/* Passenger */}
                <div className="min-w-0">
                  <p className="text-xs text-gray-300 truncate">
                    {b.passenger?.name || "—"}
                  </p>
                  <p className="text-xs text-gray-600 truncate">
                    {b.passenger?.phone}
                  </p>
                </div>

                {/* Driver */}
                <div className="min-w-0">
                  <p className="text-xs text-gray-300 truncate">
                    {b.driver?.name || "—"}
                  </p>
                  <p className="text-xs text-gray-600 truncate">
                    {b.driver?.phone}
                  </p>
                </div>

                {/* Amount */}
                <p className="text-sm font-display font-bold text-orange-400">
                  ₹{b.totalAmount?.toLocaleString("en-IN")}
                </p>

                {/* Payment status */}
                <span
                  className={`text-xs px-2 py-0.5 rounded-md inline-block capitalize ${
                    PAYMENT_CLASSES[b.payment?.status] ||
                    PAYMENT_CLASSES.pending
                  }`}
                >
                  {b.payment?.status || "pending"}
                </span>

                {/* Booking status */}
                <span
                  className={`text-xs px-2 py-1 rounded-md border inline-block capitalize ${
                    STATUS_CLASSES[b.status] || STATUS_CLASSES.pending
                  }`}
                >
                  {b.status}
                </span>
              </div>
            ))
          )}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-5">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="text-xs px-3 py-2 rounded-lg bg-gray-900 border border-gray-700 text-gray-400 hover:bg-gray-800 disabled:opacity-40 transition-all"
          >
            ← Prev
          </button>
          <span className="text-xs text-gray-500">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="text-xs px-3 py-2 rounded-lg bg-gray-900 border border-gray-700 text-gray-400 hover:bg-gray-800 disabled:opacity-40 transition-all"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
