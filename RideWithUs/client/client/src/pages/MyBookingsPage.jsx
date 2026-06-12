import React, { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { bookingsAPI } from "../services/api";
import socketService from "../services/socket";
import { useAuth } from "../context/AuthContext";
import { format, differenceInHours } from "date-fns";
import toast from "react-hot-toast";

// ── Status badge colours ──────────────────────────────────────────
const STATUS_CLASSES = {
  pending:   "bg-yellow-500/10 text-yellow-400  border-yellow-500/20",
  confirmed: "bg-green-500/10  text-green-400   border-green-500/20",
  started:   "bg-blue-500/10   text-blue-400    border-blue-500/20",
  completed: "bg-gray-500/10   text-gray-400    border-gray-500/20",
  cancelled: "bg-red-500/10    text-red-400     border-red-500/20",
  refunded:  "bg-purple-500/10 text-purple-400  border-purple-500/20",
  denied:    "bg-orange-500/10 text-orange-400  border-orange-500/20",
};

// Human-readable label for booking status
const STATUS_LABEL = {
  pending:   "Pending",
  confirmed: "Confirmed",
  started:   "In Progress",
  completed: "Completed",
  cancelled: "Cancelled",
  refunded:  "Refunded",
  denied:    "Request Denied",
};

// ── Cancellation policy helper ────────────────────────────────────
function getCancellationPolicy(booking) {
  if (!["pending", "confirmed"].includes(booking.status)) return null;
  const dept = booking.ride?.departureTime;
  if (!dept) return null;
  const hoursLeft = differenceInHours(new Date(dept), new Date());
  if (hoursLeft >= 24)
    return {
      type: "free",
      label: "Free cancellation",
      detail: `${hoursLeft}h left · full refund if paid`,
    };
  if (hoursLeft >= 1)
    return {
      type: "partial",
      label: "Late cancellation",
      detail: "Within 24h of departure · no refund",
    };
  return { type: "none", label: "Non-refundable", detail: "Ride starts soon" };
}

const POLICY_COLORS = {
  free: "text-green-400 border-green-500/20 bg-green-500/5",
  partial: "text-yellow-400 border-yellow-500/20 bg-yellow-500/5",
  none: "text-red-400 border-red-500/20 bg-red-500/5",
};

export default function MyBookingsPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState("passenger");
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(null); // bookingId being actioned
  const [denyId, setDenyId] = useState(null); // booking id for deny modal
  const [denyNote, setDenyNote] = useState("");

  // ── Data fetching ──────────────────────────────────────────────
  const load = useCallback(() => {
    setLoading(true);
    const fn = tab === "passenger" ? bookingsAPI.getMy : bookingsAPI.getDriver;
    fn()
      .then(({ data }) => setBookings(data.bookings || []))
      .catch(() => toast.error("Failed to load bookings"))
      .finally(() => setLoading(false));
  }, [tab]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const refresh = (data) => {
      if (data?.message) toast(data.message, { icon: "📣" });
      load();
    };
    const handlePayDone = (data) => {
      toast.success(data?.message || "Payment confirmed! Ride complete 🎉");
      load();
    };

    const handleRazorpayPaid = (data) => {
      toast.success(data?.message || "Passenger paid via Razorpay! 💳");
      load();
    };
    const events = [
      "booking:new",
      "booking:accepted",
      "booking:denied",
      "booking:cancelled",
      "booking:statusChange",
    ];
    events.forEach((e) => socketService.on(e, refresh));
    socketService.on("booking:paymentDone", handlePayDone);
    socketService.on("booking:paid", handleRazorpayPaid);
    return () => {
      events.forEach((e) => socketService.off(e, refresh));
      socketService.off("booking:paymentDone", handlePayDone);
      socketService.off("booking:paid", handleRazorpayPaid);
    };
  }, [load]);

  const act = async (bookingId, apiFn, successMsg) => {
    setActing(bookingId);
    try {
      await apiFn();
      toast.success(successMsg);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || "Action failed");
    } finally {
      setActing(null);
    }
  };

  const handleAccept = (id) =>
    act(id, () => bookingsAPI.accept(id), "Booking accepted ✓");
  const handlePayDone = (id) => {
    if (
      !window.confirm(
        "Mark payment received? This completes the ride for both users.",
      )
    )
      return;
    act(
      id,
      () => bookingsAPI.markPaymentDone(id),
      "Payment done! Ride completed ✓",
    );
  };
  const handleCancel = (id, departureTime) => {
    const hoursLeft = departureTime
      ? differenceInHours(new Date(departureTime), new Date())
      : 999;
    const warn =
      hoursLeft < 24
        ? "⚠️ This is within 24h of departure — no refund applies.\n\nCancel anyway?"
        : "Cancel this booking? Seats will be restored.";
    if (!window.confirm(warn)) return;
    act(id, () => bookingsAPI.cancel(id), "Booking cancelled");
  };
  const handleDenySubmit = () => {
    if (!denyId) return;
    act(
      denyId,
      () => bookingsAPI.deny(denyId, denyNote || "Driver declined"),
      "Booking denied",
    );
    setDenyId(null);
    setDenyNote("");
  };

  const getRideInfo = (b) => {
    const r = b.ride;
    if (!r) return { from: "—", to: "—", dateStr: "—" };
    return {
      from: r.origin?.address?.split(",")[0] || "—",
      to: r.destination?.address?.split(",")[0] || "—",
      dateStr: r.departureTime
        ? format(new Date(r.departureTime), "EEE, MMM d · h:mm a")
        : "—",
    };
  };

  const DenyModal = () => (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <div className="w-full max-w-sm bg-gray-900 border border-gray-700 rounded-2xl p-6 shadow-2xl">
        <h3 className="font-display text-base font-semibold text-gray-100 mb-3">
          Deny Booking
        </h3>
        <textarea
          value={denyNote}
          onChange={(e) => setDenyNote(e.target.value)}
          placeholder="Reason for declining (optional)…"
          rows={3}
          className="w-full bg-gray-950 border border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-200 focus:outline-none focus:border-orange-500 placeholder-gray-600 resize-none mb-4"
        />
        <div className="flex gap-2">
          <button
            onClick={() => {
              setDenyId(null);
              setDenyNote("");
            }}
            className="flex-1 py-2.5 rounded-xl text-sm border border-gray-700 text-gray-400 hover:bg-gray-800 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleDenySubmit}
            className="flex-1 py-2.5 rounded-xl text-sm bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-all"
          >
            Deny Request
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {denyId && <DenyModal />}

      <div className="max-w-3xl mx-auto px-4 py-6">
        <h1 className="font-display text-2xl font-bold text-gray-100 mb-5">
          My Bookings
        </h1>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-xl p-1 mb-5 w-fit">
          {[
            ["passenger", "As Passenger"],
            ["driver", "As Driver"],
          ].map(([v, l]) => (
            <button
              key={v}
              onClick={() => setTab(v)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                tab === v
                  ? "bg-orange-500 text-white"
                  : "text-gray-400 hover:text-gray-200"
              }`}
            >
              {l}
            </button>
          ))}
        </div>

        {tab === "passenger" && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-5">
            <p className="text-xs text-gray-400 font-medium mb-1.5">
              📋 Cancellation Policy
            </p>
            <div className="space-y-1 text-xs text-gray-500">
              <p>
                • <span className="text-green-400">Free cancellation</span> —
                more than 24h before departure
              </p>
              <p>
                • <span className="text-yellow-400">No refund</span> — within
                24h of departure
              </p>
              <p>
                • <span className="text-red-400">No refund</span> — after ride
                has started
              </p>
            </div>
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-gray-900 border border-gray-800 rounded-xl h-40 animate-pulse"
              />
            ))}
          </div>
        ) : bookings.length === 0 ? (
          <div className="text-center py-14 bg-gray-900 border border-gray-800 rounded-2xl">
            <div className="text-4xl mb-3">
              {tab === "passenger" ? "🎫" : "🚗"}
            </div>
            <p className="text-gray-400 font-medium">
              {tab === "passenger" ? "No bookings yet" : "No ride requests yet"}
            </p>
            <div className="mt-2">
              {tab === "passenger" ? (
                <Link
                  to="/find"
                  className="text-orange-400 hover:underline text-sm"
                >
                  Find a ride →
                </Link>
              ) : (
                <Link
                  to="/create"
                  className="text-orange-400 hover:underline text-sm"
                >
                  Offer a ride →
                </Link>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {bookings.map((b) => {
              const { from, to, dateStr } = getRideInfo(b);
              const person = tab === "passenger" ? b.driver : b.passenger;
              const rideId = b.ride?._id || b.ride;
              const isActing = acting === b._id;
              const policy =
                tab === "passenger" ? getCancellationPolicy(b) : null;
              const paid = b.payment?.status === "paid";

              return (
                <div
                  key={b._id}
                  className="bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-gray-700 transition-colors"
                >
                  {/* Header row */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-200 truncate">
                        {from} → {to}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">{dateStr}</p>
                    </div>
                    <span
                      className={`text-xs px-2.5 py-1 rounded-lg border font-medium flex-shrink-0 ${STATUS_CLASSES[b.status] || STATUS_CLASSES.pending}`}
                    >
                      {STATUS_LABEL[b.status] || b.status}
                    </span>
                  </div>

                  {/* Person row */}
                  <div className="flex items-center gap-2 mb-3 pb-3 border-b border-gray-800">
                    <div className="w-7 h-7 rounded-full bg-gray-700 flex items-center justify-center text-xs font-semibold text-gray-300 flex-shrink-0">
                      {person?.name?.charAt(0)?.toUpperCase() || "?"}
                    </div>
                    <span className="text-xs text-gray-500">
                      {tab === "passenger" ? "Driver" : "Passenger"}:
                    </span>
                    <span className="text-xs text-gray-300">
                      {person?.name || "—"}
                    </span>
                    <span className="text-xs text-gray-600 hidden sm:inline">
                      {person?.phone}
                    </span>
                    {tab === "passenger" && person?.rating?.average > 0 && (
                      <span className="ml-auto text-xs text-yellow-400">
                        ★ {person.rating.average.toFixed(1)}
                      </span>
                    )}
                  </div>

                  {/* Meta row */}
                  <div className="flex items-center gap-3 mb-3 flex-wrap">
                    <span className="text-xs text-gray-500">
                      🪑 {b.seatsBooked} seat{b.seatsBooked > 1 ? "s" : ""}
                    </span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-md border ${
                        paid
                          ? "bg-green-500/10 text-green-400 border-green-500/20"
                          : "bg-yellow-500/10 text-yellow-400 border-yellow-500/20"
                      }`}
                    >
                       {paid ? "Paid" : "Payment pending"}
                    </span>
                    <span className="ml-auto font-display text-base font-bold text-orange-400">
                      ₹{b.totalAmount}
                    </span>
                  </div>

                  {/* Cancellation policy badge (passenger only) */}
                  {policy && (
                    <div
                      className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border mb-3 ${POLICY_COLORS[policy.type]}`}
                    >
                      <span>
                        {policy.type === "free"
                          ? "✓"
                          : policy.type === "partial"
                            ? "⚠️"
                            : "✗"}
                      </span>
                      <span className="font-medium">{policy.label}</span>
                      <span className="text-gray-600 ml-1">
                        {policy.detail}
                      </span>
                    </div>
                  )}

                  {/* Cancellation note */}
                  {b.status === "denied" && (
                    <div className="text-xs text-orange-400/70 bg-orange-500/5 border border-orange-500/15 rounded-lg px-3 py-2 mb-3">
                      ✗ Driver declined your request
                      {b.cancellationNote && b.cancellationNote !== "Driver declined your request" && (
                        <span className="text-gray-500 ml-1">— {b.cancellationNote}</span>
                      )}
                      <span className="text-gray-600 block mt-0.5">You can book this ride again if seats are available.</span>
                    </div>
                  )}
                  {b.status === "cancelled" && b.cancellationNote && (
                    <div className="text-xs text-gray-600 bg-gray-800/50 rounded-lg px-3 py-2 mb-3">
                      Cancelled by {b.cancelledBy} — {b.cancellationNote}
                    </div>
                  )}

                  {/* ── DRIVER ACTIONS ── */}
                  {tab === "driver" && (
                    <div className="flex gap-2 flex-wrap">
                      {b.status === "pending" && (
                        <>
                          <button
                            onClick={() => handleAccept(b._id)}
                            disabled={isActing}
                            className="flex-1 text-xs bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white px-3 py-2 rounded-lg font-medium transition-all"
                          >
                            {isActing ? "…" : "✓ Accept"}
                          </button>
                          <button
                            onClick={() => setDenyId(b._id)}
                            disabled={isActing}
                            className="flex-1 text-xs bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 px-3 py-2 rounded-lg transition-all"
                          >
                            ✗ Deny
                          </button>
                        </>
                      )}
                      {b.status === "confirmed" && !paid && (
                        <button
                          onClick={() => handlePayDone(b._id)}
                          disabled={isActing}
                          className="text-xs bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-medium transition-all"
                        >
                          {isActing ? "Processing…" : "💰 Mark Cash Received"}
                        </button>
                      )}
                      {["pending", "confirmed", "started"].includes(
                        b.status,
                      ) && (
                        <Link
                          to={`/chat/${b._id}`}
                          className="text-xs bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 text-blue-400 px-3 py-2 rounded-lg transition-all"
                        >
                          💬 Chat
                        </Link>
                      )}
                      {b.status === "completed" && (
                        <span className="text-xs text-green-400 flex items-center gap-1">
                          ✓ Ride completed · Payment received
                        </span>
                      )}
                    </div>
                  )}

                  {/* ── PASSENGER ACTIONS ── */}
                  {tab === "passenger" && (
                    <div className="flex gap-2 flex-wrap">
                      <Link
                        to={`/bookings/${b._id}`}
                        className="text-xs bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-200 px-3 py-1.5 rounded-lg transition-all"
                      >
                        View Details
                      </Link>
                      {["confirmed", "started"].includes(b.status) &&
                        rideId && (
                          <Link
                            to={`/track/${rideId}`}
                            className="text-xs bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 text-blue-400 px-3 py-1.5 rounded-lg transition-all"
                          >
                            📡 Track
                          </Link>
                        )}
                      {["pending", "confirmed"].includes(b.status) && (
                        <>
                          <Link
                            to={`/chat/${b._id}`}
                            className="text-xs bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/20 text-orange-400 px-3 py-1.5 rounded-lg transition-all"
                          >
                            💬 Chat
                          </Link>
                          <button
                            onClick={() =>
                              handleCancel(b._id, b.ride?.departureTime)
                            }
                            disabled={isActing}
                            className="text-xs border border-red-900 text-red-400 hover:bg-red-900/20 px-3 py-1.5 rounded-lg transition-all disabled:opacity-50"
                          >
                            {isActing ? "…" : "Cancel"}
                          </button>
                        </>
                      )}
                      {b.status === "pending" && (
                        <span className="text-xs text-yellow-400 flex items-center">
                          ⏳ Waiting for driver
                        </span>
                      )}
                      {b.status === "denied" && b.ride?._id && (
                        <a
                          href={`/rides/${b.ride._id}`}
                          className="text-xs bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/20 text-orange-400 px-3 py-1.5 rounded-lg transition-all"
                        >
                           Book Again
                        </a>
                      )}
                      {/* Pay button inline */}
                      {!paid &&
                        !["cancelled", "refunded", "denied"].includes(b.status) && (
                          <Link
                            to={`/pay/${b._id}`}
                            className="text-xs bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/20 text-orange-400 px-3 py-1.5 rounded-lg transition-all"
                          >
                            💳 Pay
                          </Link>
                        )}
                      {b.status === "completed" && !b.rating?.score && (
                        <Link
                          to={`/bookings/${b._id}?rate=1`}
                          className="text-xs bg-yellow-500/10 hover:bg-yellow-500/20 border border-yellow-500/20 text-yellow-400 px-3 py-1.5 rounded-lg transition-all"
                        >
                          ⭐ Rate Ride
                        </Link>
                      )}
                      {b.status === "completed" && b.rating?.score && (
                        <span className="text-xs text-yellow-400 flex items-center gap-1">
                          ★ Rated {b.rating.score}/5
                        </span>
                      )}
                      {paid && b.status === "completed" && (
                        <span className="text-xs text-green-400">
                          ✓ Complete
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
