import React, { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ridesAPI, bookingsAPI } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { format } from "date-fns";
import toast from "react-hot-toast";

export default function RideDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [ride,        setRide]        = useState(null);
  const [bookings,    setBookings]    = useState([]);
  const [seats,       setSeats]       = useState(1);
  const [isBooking,   setIsBooking]   = useState(false);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState("");
  const [cancelling,  setCancelling]  = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason,    setCancelReason]    = useState("");

  useEffect(() => {
    if (!id) return;
    ridesAPI
      .getById(id)
      .then(({ data }) => {
        setRide(data.ride);
        setBookings(data.bookings || []);
      })
      .catch((err) => {
        setError(err.response?.data?.message || "Ride not found");
        toast.error("Could not load ride details");
      })
      .finally(() => setLoading(false));
  }, [id]);

  const handleBook = async () => {
    try {
      setIsBooking(true);
      const { data } = await bookingsAPI.create({ rideId: ride._id, seatsBooked: seats });
      toast.success("Ride booked! Driver has been notified 🎉");
      navigate(`/bookings/${data.booking._id}`);
    } catch (err) {
      toast.error(err.response?.data?.message || "Booking failed");
    } finally {
      setIsBooking(false);
    }
  };

  const handleCancelRide = async () => {
    if (!cancelReason.trim()) {
      toast.error("Please enter a reason for cancellation");
      return;
    }
    try {
      setCancelling(true);
      await ridesAPI.cancel(id, cancelReason.trim());
      toast.success("Ride cancelled. Passengers have been notified.");
      setRide((prev) => ({ ...prev, status: "cancelled" }));
      setShowCancelModal(false);
      setCancelReason("");
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not cancel ride");
    } finally {
      setCancelling(false);
    }
  };

  if (loading)
    return (
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        <div className="bg-gray-900 border border-gray-800 rounded-2xl h-48 animate-pulse" />
        <div className="bg-gray-900 border border-gray-800 rounded-2xl h-64 animate-pulse" />
      </div>
    );

  if (error || !ride)
    return (
      <div className="max-w-2xl mx-auto px-4 py-6 text-center">
        <div className="text-4xl mb-3">🚫</div>
        <p className="text-gray-400 mb-4">{error || "Ride not found"}</p>
        <Link to="/" className="text-orange-400 hover:underline">← Back to Home</Link>
      </div>
    );

  const isDriver  = ride.driver?._id?.toString() === user?._id?.toString();
  const isFull    = ride.availableSeats === 0;
  const canBook   = !isDriver && ["scheduled", "active"].includes(ride.status) && !isFull;
  const canCancel = isDriver && ["scheduled", "active"].includes(ride.status);

  const activePassengers = bookings.filter((b) => !["cancelled"].includes(b.status));

  return (
    <>
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm px-4">
          <div className="w-full max-w-sm bg-gray-900 border border-gray-700 rounded-2xl p-6 shadow-2xl">
            <h3 className="font-display text-base font-semibold text-gray-100 mb-1">
              Cancel Ride
            </h3>
            <p className="text-xs text-gray-500 mb-4">
              All {activePassengers.length} booked passenger{activePassengers.length !== 1 ? "s" : ""} will be notified and seats refunded.
            </p>
            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Reason for cancellation (required)…"
              rows={3}
              className="w-full bg-gray-950 border border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-200 focus:outline-none focus:border-red-500 placeholder-gray-600 resize-none mb-4"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={() => { setShowCancelModal(false); setCancelReason(""); }}
                className="flex-1 py-2.5 rounded-xl text-sm border border-gray-700 text-gray-400 hover:bg-gray-800 transition-all"
              >
                Keep Ride
              </button>
              <button
                onClick={handleCancelRide}
                disabled={cancelling || !cancelReason.trim()}
                className="flex-1 py-2.5 rounded-xl text-sm bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 transition-all disabled:opacity-50"
              >
                {cancelling ? "Cancelling…" : "Confirm Cancel"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <button
            onClick={() => navigate(-1)}
            className="text-gray-500 hover:text-gray-300 text-sm flex items-center gap-1"
          >
            ← Back
          </button>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-5 pb-5 border-b border-gray-800">
            <div className="w-12 h-12 rounded-full bg-orange-500/10 text-orange-400 flex items-center justify-center text-lg font-semibold flex-shrink-0">
              {ride.driver?.name?.charAt(0)?.toUpperCase() || "?"}
            </div>
            <div className="flex-1">
              <p className="font-medium text-gray-200">{ride.driver?.name || "Driver"}</p>
              <p className="text-sm text-yellow-400">
                ★ {ride.driver?.rating?.average?.toFixed(1) || "New"}
                <span className="text-gray-600 ml-1">({ride.driver?.rating?.count || 0} reviews)</span>
              </p>
            </div>
            <span
              className={`text-xs px-2.5 py-1 rounded-lg font-medium capitalize border ${
                ride.status === "scheduled"
                  ? "bg-green-500/10 text-green-400 border-green-500/20"
                  : ride.status === "active"
                  ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                  : ride.status === "started"
                  ? "bg-orange-500/10 text-orange-400 border-orange-500/20"
                  : ride.status === "cancelled"
                  ? "bg-red-500/10 text-red-400 border-red-500/20"
                  : "bg-gray-500/10 text-gray-400 border-gray-500/20"
              }`}
            >
              {ride.status}
            </span>
          </div>

          {/* Route */}
          <div className="flex items-start gap-3 mb-5">
            <div className="flex flex-col items-center gap-1 mt-1 flex-shrink-0">
              <div className="w-3 h-3 rounded-full bg-orange-500" />
              <div className="w-px h-10 bg-gray-700" />
              <div className="w-3 h-3 rounded-full bg-blue-500" />
            </div>
            <div className="space-y-3 min-w-0 flex-1">
              <div>
                <p className="text-sm font-medium text-gray-200">{ride.origin?.address}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {ride.departureTime
                    ? format(new Date(ride.departureTime), "EEEE, MMMM d · h:mm a")
                    : "—"}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-200">{ride.destination?.address}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {ride.distanceKm > 0
                    ? `~${ride.distanceKm} km · ${ride.durationMins} min`
                    : "Distance N/A"}
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-5 pb-5 border-b border-gray-800">
            <div className="bg-gray-950 rounded-xl p-3 text-center">
              <p className="text-sm font-semibold text-orange-400">₹{ride.pricePerSeat}</p>
              <p className="text-xs text-gray-500 mt-1">Per Seat</p>
            </div>
            <div className="bg-gray-950 rounded-xl p-3 text-center">
              <p className="text-sm font-semibold text-gray-200">
                {ride.availableSeats}/{ride.totalSeats}
              </p>
              <p className="text-xs text-gray-500 mt-1">Seats Left</p>
            </div>
            <div className="bg-gray-950 rounded-xl p-3 text-center">
              <p className="text-sm font-semibold text-gray-200">
                {ride.vehicleType === "bike" ? "🏍 Bike" : "🚗 Car"}
              </p>
              <p className="text-xs text-gray-500 mt-1">Vehicle</p>
            </div>
          </div>

          {ride.vehicleInfo?.model && (
            <div className="flex gap-3 text-sm text-gray-500 mb-5 pb-5 border-b border-gray-800 flex-wrap">
              <span>🚗 {ride.vehicleInfo.model}</span>
              {ride.vehicleInfo.registration && <span>· {ride.vehicleInfo.registration}</span>}
              {ride.vehicleInfo.color && <span>· {ride.vehicleInfo.color}</span>}
            </div>
          )}

          {/* Notes */}
          {ride.notes && (
            <div className="mb-5 pb-5 border-b border-gray-800 p-3 bg-gray-800/40 rounded-xl">
              <p className="text-xs text-gray-500 mb-1">Driver Note</p>
              <p className="text-sm text-gray-300">{ride.notes}</p>
            </div>
          )}

          {canBook && (
            <div className="flex items-end gap-3 flex-wrap">
              <div>
                <label className="text-xs text-gray-500 block mb-1.5">Seats to book</label>
                <select
                  value={seats}
                  onChange={(e) => setSeats(Number(e.target.value))}
                  className="bg-gray-950 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-gray-200 focus:outline-none focus:border-orange-500"
                >
                  {Array.from({ length: ride.availableSeats }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>{n} Seat{n > 1 ? "s" : ""}</option>
                  ))}
                </select>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1.5">Total amount</p>
                <p className="font-display text-xl font-bold text-orange-400">
                  ₹{ride.pricePerSeat * seats}
                </p>
              </div>
              <button
                onClick={handleBook}
                disabled={isBooking}
                className="ml-auto bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white font-medium px-8 py-2.5 rounded-xl transition-all text-sm"
              >
                {isBooking ? "Booking…" : "✓ Book Now"}
              </button>
            </div>
          )}

          {isDriver && (
            <div className="space-y-2">
              <Link
                to={`/track/${ride._id}`}
                className="flex items-center justify-center gap-2 bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500/20 py-2.5 rounded-xl text-sm transition-all"
              >
                📡 Live Tracking Panel
              </Link>

              {canCancel && (
                <button
                  onClick={() => setShowCancelModal(true)}
                  className="w-full flex items-center justify-center gap-2 bg-red-500/5 border border-red-500/20 text-red-400 hover:bg-red-500/15 py-2.5 rounded-xl text-sm transition-all"
                >
                  🚫 Cancel This Ride
                </button>
              )}

              {ride.status === "cancelled" && (
                <div className="bg-red-500/5 border border-red-500/15 rounded-xl px-4 py-3 text-center">
                  <p className="text-xs text-red-400 font-medium">Ride cancelled</p>
                  <p className="text-xs text-gray-600 mt-0.5">All bookings have been cancelled</p>
                </div>
              )}

              <p className="text-center text-xs text-gray-600">You are the driver of this ride</p>
            </div>
          )}

          {!canBook && !isDriver && ride.status === "cancelled" && (
            <p className="text-center text-red-400 text-sm py-2 bg-red-500/5 rounded-xl">
              This ride has been cancelled.
            </p>
          )}
          {!canBook && !isDriver && isFull && ride.status !== "cancelled" && (
            <p className="text-center text-yellow-400 text-sm py-2 bg-yellow-500/5 rounded-xl">
              This ride is fully booked.
            </p>
          )}
          {!canBook && !isDriver && ride.status === "completed" && (
            <p className="text-center text-gray-500 text-sm py-2">
              This ride has been completed.
            </p>
          )}
        </div>
        {isDriver && bookings.length > 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
            <h2 className="font-display text-sm font-semibold text-gray-300 mb-4">
              Passengers ({bookings.length})
            </h2>
            <div className="space-y-3">
              {bookings.map((b) => (
                <div key={b._id} className="flex items-center gap-3 p-3 bg-gray-800/40 rounded-xl">
                  <div className="w-8 h-8 rounded-full bg-blue-500/10 text-blue-400 flex items-center justify-center text-sm font-semibold flex-shrink-0">
                    {b.passenger?.name?.charAt(0)?.toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-gray-200">{b.passenger?.name}</p>
                    <p className="text-xs text-gray-500">
                      {b.passenger?.phone} · {b.seatsBooked} seat{b.seatsBooked > 1 ? "s" : ""}
                    </p>
                  </div>
                  <span
                    className={`text-xs px-2 py-1 rounded-md capitalize font-medium ${
                      b.status === "confirmed"
                        ? "bg-green-500/10 text-green-400"
                        : b.status === "pending"
                        ? "bg-yellow-500/10 text-yellow-400"
                        : b.status === "cancelled"
                        ? "bg-red-500/10 text-red-400"
                        : "bg-gray-500/10 text-gray-400"
                    }`}
                  >
                    {b.status}
                  </span>
                  <span className="text-sm font-semibold text-orange-400">₹{b.totalAmount}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
