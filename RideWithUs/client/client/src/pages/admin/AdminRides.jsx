import React, { useEffect, useState, useCallback } from "react";
import { adminAPI } from "../../services/api";
import { format } from "date-fns";
import toast from "react-hot-toast";

const STATUS_CLASSES = {
  scheduled: "text-blue-400  bg-blue-400/10  border-blue-400/20",
  active: "text-green-400 bg-green-400/10 border-green-400/20",
  started: "text-orange-400 bg-orange-400/10 border-orange-400/20",
  completed: "text-gray-400  bg-gray-400/10  border-gray-400/20",
  cancelled: "text-red-400   bg-red-400/10   border-red-400/20",
};

export default function AdminRides() {
  const [rides, setRides] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(null); // id being deleted
  const [filter, setFilter] = useState({ vehicleType: "", status: "" });
  const [page, setPage] = useState(1);

  const LIMIT = 20;

  // ── Load rides ──────────────────────────────────────────────
  const load = useCallback(() => {
    setLoading(true);
    adminAPI
      .getRides({ ...filter, page, limit: LIMIT })
      .then(({ data }) => {
        setRides(data.rides || []);
        setTotal(data.total || 0);
      })
      .catch(() => toast.error("Failed to load rides"))
      .finally(() => setLoading(false));
  }, [filter, page]);

  useEffect(() => {
    load();
  }, [load]);

  // Reset to page 1 when filter changes
  useEffect(() => {
    setPage(1);
  }, [filter]);

  // ── Delete ride ──────────────────────────────────────────────
  // BUG FIX: The original code did a filter on ride._id but the delete API
  // was receiving the wrong id in certain cases due to stale closures.
  // Fix: capture the id explicitly, do optimistic remove, roll back on error,
  // and compare strictly with === not loose equality.
  const handleDelete = async (id, driverName) => {
    if (
      !window.confirm(
        `Delete ride by ${driverName || "unknown driver"}?\n\nThis will cancel all pending/confirmed bookings for this ride.`,
      )
    )
      return;

    // Snapshot current state for rollback
    const prev = [...rides];

    // Optimistic removal — use strict === string comparison
    setRides((current) => current.filter((r) => String(r._id) !== String(id)));
    setDeleting(id);

    try {
      await adminAPI.deleteRide(id);
      toast.success("Ride deleted and bookings cancelled");
    } catch (err) {
      // Roll back — restore the snapshot
      setRides(prev);
      toast.error(err.response?.data?.message || "Failed to delete ride");
    } finally {
      setDeleting(null);
    }
  };

  // ── Pagination ───────────────────────────────────────────────
  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-5">
        <h1 className="font-display text-2xl font-bold text-purple-400">
          Manage Rides
        </h1>
        <span className="text-xs text-gray-500">
          {total.toLocaleString("en-IN")} total
        </span>
      </div>

      {/* ── Filters ── */}
      <div className="flex gap-3 mb-5 flex-wrap">
        <select
          value={filter.vehicleType}
          onChange={(e) =>
            setFilter((f) => ({ ...f, vehicleType: e.target.value }))
          }
          className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-purple-500"
        >
          <option value="">All Vehicles</option>
          <option value="bike">🏍 Bike</option>
          <option value="car">🚗 Car</option>
        </select>
        <select
          value={filter.status}
          onChange={(e) => setFilter((f) => ({ ...f, status: e.target.value }))}
          className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-purple-500"
        >
          <option value="">Active (excl. cancelled)</option>
          {["scheduled", "active", "started", "completed", "cancelled"].map(
            (s) => (
              <option key={s} value={s} className="capitalize">
                {s}
              </option>
            ),
          )}
        </select>
        {(filter.vehicleType || filter.status) && (
          <button
            onClick={() => setFilter({ vehicleType: "", status: "" })}
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            Clear filters ×
          </button>
        )}
      </div>

      {/* ── Table ── */}
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
          {/* Table header */}
          <div className="grid grid-cols-[2fr_1.5fr_1fr_1fr_1fr_auto] gap-3 px-4 py-3 border-b border-gray-800 text-xs text-gray-500 uppercase tracking-wider">
            <span>Route</span>
            <span>Driver</span>
            <span>Type</span>
            <span>Departure</span>
            <span>Status</span>
            <span>Action</span>
          </div>

          {rides.length === 0 ? (
            <p className="text-center text-gray-600 py-10">
              No rides found
              {(filter.vehicleType || filter.status) && (
                <button
                  onClick={() => setFilter({ vehicleType: "", status: "" })}
                  className="block mx-auto mt-2 text-orange-400 hover:underline text-xs"
                >
                  Clear filters
                </button>
              )}
            </p>
          ) : (
            rides.map((ride) => {
              const isDeleting = deleting === String(ride._id);
              return (
                <div
                  key={ride._id}
                  className={`grid grid-cols-[2fr_1.5fr_1fr_1fr_1fr_auto] gap-3 px-4 py-3 border-b border-gray-800 last:border-0 items-center transition-all ${
                    isDeleting
                      ? "opacity-40 pointer-events-none"
                      : "hover:bg-gray-800/30"
                  }`}
                >
                  {/* Route */}
                  <div className="min-w-0">
                    <p className="text-sm text-gray-300 truncate">
                      {ride.origin?.address?.split(",")[0]}
                    </p>
                    <p className="text-xs text-gray-600 truncate">
                      → {ride.destination?.address?.split(",")[0]}
                    </p>
                  </div>

                  {/* Driver */}
                  <div className="min-w-0">
                    <p className="text-sm text-gray-400 truncate">
                      {ride.driver?.name || "—"}
                    </p>
                    <p className="text-xs text-gray-600 truncate">
                      {ride.driver?.phone || ""}
                    </p>
                  </div>

                  {/* Vehicle type */}
                  <span
                    className={`text-xs px-2 py-1 rounded-md border inline-block ${
                      ride.vehicleType === "bike"
                        ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                        : "bg-green-500/10 text-green-400 border-green-500/20"
                    }`}
                  >
                    {ride.vehicleType === "bike" ? "🏍 Bike" : "🚗 Car"}
                  </span>

                  {/* Date */}
                  <p className="text-xs text-gray-500">
                    {ride.departureTime
                      ? format(new Date(ride.departureTime), "MMM d, h:mm a")
                      : "—"}
                  </p>

                  {/* Status */}
                  <span
                    className={`text-xs px-2 py-1 rounded-md border inline-block capitalize ${
                      STATUS_CLASSES[ride.status] ||
                      "text-gray-400 bg-gray-400/10 border-gray-400/20"
                    }`}
                  >
                    {ride.status}
                  </span>

                  {/* Delete action */}
                  <button
                    onClick={() =>
                      handleDelete(String(ride._id), ride.driver?.name)
                    }
                    disabled={isDeleting || !!deleting}
                    className="text-xs border border-red-900 text-red-400 hover:bg-red-900/20 px-2 py-1 rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                  >
                    {isDeleting ? "…" : "Delete"}
                  </button>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ── Pagination ── */}
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
