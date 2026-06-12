import React, { useEffect, useState } from "react";
import {
  useParams,
  useSearchParams,
  Link,
  useNavigate,
} from "react-router-dom";
import { bookingsAPI, paymentsAPI } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { format } from "date-fns";
import toast from "react-hot-toast";

// ── Star component ─────────────────────────────────────────────────
const Star = ({ filled, interactive, onClick, onMouseEnter }) => (
  <button
    onClick={interactive ? onClick : undefined}
    onMouseEnter={interactive ? onMouseEnter : undefined}
    disabled={!interactive}
    className={[
      "text-3xl transition-all leading-none",
      interactive
        ? "cursor-pointer hover:scale-110 active:scale-95"
        : "cursor-default",
      filled
        ? "text-yellow-400 drop-shadow-[0_0_4px_rgba(251,191,36,0.6)]"
        : "text-gray-700",
      interactive && !filled ? "hover:text-yellow-300" : "",
    ].join(" ")}
    aria-label={`${filled ? "Filled" : "Empty"} star`}
  >
    ★
  </button>
);

// ── Razorpay loader ────────────────────────────────────────────────
const loadRazorpay = () =>
  new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });

const STATUS_COLORS = {
  pending:   "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
  confirmed: "text-green-400  bg-green-500/10  border-green-500/20",
  started:   "text-orange-400 bg-orange-500/10 border-orange-500/20",
  completed: "text-blue-400   bg-blue-500/10   border-blue-500/20",
  cancelled: "text-red-400    bg-red-500/10    border-red-500/20",
  refunded:  "text-purple-400 bg-purple-500/10 border-purple-500/20",
  denied:    "text-orange-400 bg-orange-500/10 border-orange-500/20",
};

const STATUS_LABEL = {
  pending:   "Pending",
  confirmed: "Confirmed",
  started:   "In Progress",
  completed: "Completed",
  cancelled: "Cancelled",
  refunded:  "Refunded",
  denied:    "Request Denied",
};

export default function BookingDetailPage() {
  const { id } = useParams();
  const [sp] = useSearchParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [hoverStar, setHoverStar] = useState(0); // hover preview
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [showRate, setShowRate] = useState(sp.get("rate") === "1");
  const [paying, setPaying] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    bookingsAPI
      .getById(id)
      .then(({ data }) => setBooking(data.booking))
      .catch(() => toast.error("Booking not found"))
      .finally(() => setLoading(false));

    if (sp.get("payment") === "success")
      toast.success("Payment successful! Ride confirmed. 🎉");
    if (sp.get("payment") === "cancelled")
      toast.error("Payment was cancelled.");
  }, [id]);
  const handlePay = async () => {
    try {
      setPaying(true);
      const sdkLoaded = await loadRazorpay();
      if (!sdkLoaded) {
        toast.error("Failed to load Razorpay SDK.");
        return;
      }

      const { data } = await paymentsAPI.createOrder(booking._id);
      if (!data.success) throw new Error(data.message);

      const rzp = new window.Razorpay({
        key: data.keyId,
        amount: data.amount,
        currency: data.currency,
        name: "RideWithUs",
        description: `${booking.ride?.origin?.address?.split(",")[0]} → ${booking.ride?.destination?.address?.split(",")[0]}`,
        order_id: data.orderId,
        prefill: { name: user?.name || "", contact: user?.phone || "" },
        theme: { color: "#f97316" },
        modal: {
          ondismiss: () => {
            setPaying(false);
            toast("Payment cancelled.", { icon: "ℹ️" });
          },
        },
        handler: async (response) => {
          try {
            const verify = await paymentsAPI.verifyPayment({
              bookingId: booking._id,
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            });
            if (verify.data.success) {
              toast.success("Payment confirmed! 🎉");
              setBooking((prev) => ({
                ...prev,
                status: "confirmed",
                payment: { ...prev.payment, status: "paid" },
              }));
            } else {
              throw new Error("Verification failed");
            }
          } catch {
            toast.error("Verification failed. Contact support.");
          } finally {
            setPaying(false);
          }
        },
      });

      rzp.on("payment.failed", (resp) => {
        toast.error(`Payment failed: ${resp.error.description}`);
        setPaying(false);
      });

      rzp.open();
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not start payment");
      setPaying(false);
    }
  };

  const handleRate = async () => {
    if (!rating) return toast.error("Please select a star rating");
    try {
      setSubmitting(true);
      await bookingsAPI.rate(id, { score: rating, comment });
      toast.success("Rating submitted! Thank you 🙏");
      setShowRate(false);
      setBooking((prev) => ({
        ...prev,
        rating: { score: rating, comment, ratedAt: new Date() },
      }));
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not submit rating");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async () => {
    if (!window.confirm("Cancel this booking? Seats will be restored.")) return;
    try {
      setCancelling(true);
      await bookingsAPI.cancel(id);
      toast.success("Booking cancelled");
      setBooking((prev) => ({ ...prev, status: "cancelled" }));
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not cancel");
    } finally {
      setCancelling(false);
    }
  };

  if (loading)
    return (
      <div className="max-w-xl mx-auto px-4 py-6 space-y-4">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="bg-gray-900 border border-gray-800 rounded-2xl animate-pulse"
            style={{ height: i === 0 ? 80 : 120 }}
          />
        ))}
      </div>
    );

  if (!booking)
    return (
      <div className="text-center py-16 text-gray-500">
        Booking not found.{" "}
        <Link to="/bookings" className="text-orange-400 hover:underline">
          Back to bookings
        </Link>
      </div>
    );

  const isPassenger = booking.passenger?._id?.toString() === user?._id?.toString();
  const paid = booking.payment?.status === "paid";
  const canPay =
    isPassenger && !paid && !["cancelled", "refunded", "denied"].includes(booking.status);
  const canCancel =
    isPassenger && ["pending", "confirmed"].includes(booking.status);

  return (
    <div className="max-w-xl mx-auto px-4 py-6 space-y-4">
      {/* ── Page header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="text-gray-500 hover:text-gray-300 text-lg leading-none"
          >
            ←
          </button>
          <h1 className="font-display text-xl font-bold text-gray-100">
            Booking Details
          </h1>
        </div>
        <span
          className={`text-xs px-2.5 py-1 rounded-lg border font-medium ${STATUS_COLORS[booking.status] || STATUS_COLORS.pending}`}
        >
          {STATUS_LABEL[booking.status] || booking.status}
        </span>
      </div>

      {/* ── Route card ── */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
        <div className="flex items-start gap-3 mb-4">
          <div className="flex flex-col items-center gap-1 mt-1 flex-shrink-0">
            <div className="w-2.5 h-2.5 rounded-full bg-orange-500" />
            <div className="w-px h-8 bg-gray-700" />
            <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
          </div>
          <div className="space-y-3 min-w-0">
            <p className="text-sm text-gray-200 leading-tight">
              {booking.ride?.origin?.address}
            </p>
            <p className="text-sm text-gray-200 leading-tight">
              {booking.ride?.destination?.address}
            </p>
          </div>
        </div>
        {booking.ride?.departureTime && (
          <p className="text-xs text-gray-500">
            {format(
              new Date(booking.ride.departureTime),
              "EEEE, MMMM d · h:mm a",
            )}
          </p>
        )}
        {booking.ride?.distanceKm && (
          <p className="text-xs text-gray-600 mt-1">
            {booking.ride.distanceKm} km · ~{booking.ride.durationMins} min
          </p>
        )}
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 grid grid-cols-2 gap-4">
        {[
          { label: "Driver", person: booking.driver },
          { label: "Passenger", person: booking.passenger },
        ].map(({ label, person }) => (
          <div key={label}>
            <p className="text-xs text-gray-500 mb-2">{label}</p>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center text-sm font-semibold text-gray-300 flex-shrink-0">
                {person?.name?.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-sm text-gray-200 truncate">{person?.name}</p>
                <p className="text-xs text-gray-600 truncate">
                  {person?.phone}
                </p>
              </div>
            </div>
            {label === "Driver" && person?.rating?.average > 0 && (
              <p className="text-xs text-yellow-400 mt-1.5 ml-10">
                ★ {person.rating.average.toFixed(1)}
                <span className="text-gray-600 ml-1">
                  ({person.rating.count})
                </span>
              </p>
            )}
          </div>
        ))}
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
        <div className="space-y-2 mb-4">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Seats booked</span>
            <span className="text-gray-200">{booking.seatsBooked}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Vehicle</span>
            <span className="text-gray-200 capitalize">
              {booking.ride?.vehicleType === "bike" ? "🏍 Bike" : "🚗 Car"}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Payment</span>
            <span className={paid ? "text-green-400" : "text-yellow-400"}>
              {paid ? "✓ Paid" : booking.payment?.status || "Pending"}
            </span>
          </div>
        </div>
        <div className="flex justify-between border-t border-gray-800 pt-3">
          <span className="text-gray-400 font-medium">Total</span>
          <span className="font-display text-2xl font-bold text-orange-400">
            ₹{booking.totalAmount}
          </span>
        </div>
      </div>

      {canPay && (
        <button
          onClick={handlePay}
          disabled={paying}
          className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white font-semibold py-3.5 rounded-2xl transition-all text-sm flex items-center justify-center gap-2 shadow-lg shadow-orange-500/20"
        >
          {paying ? (
            <>
              <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              Opening Razorpay…
            </>
          ) : (
            <>💳 Pay ₹{booking.totalAmount} via Razorpay</>
          )}
        </button>
      )}

      {/* ── Quick actions ── */}
      <div className="flex gap-2 flex-wrap">
        {["confirmed", "started"].includes(booking.status) && (
          <>
            <Link
              to={`/track/${booking.ride?._id}`}
              className="flex-1 text-center bg-blue-500/10 border border-blue-500/20 text-blue-400 py-2.5 rounded-xl text-sm hover:bg-blue-500/20 transition-all"
            >
               Track Ride
            </Link>
            <Link
              to={`/chat/${booking._id}`}
              className="flex-1 text-center bg-orange-500/10 border border-orange-500/20 text-orange-400 py-2.5 rounded-xl text-sm hover:bg-orange-500/20 transition-all"
            >
              💬 Chat
            </Link>
          </>
        )}
        {canCancel && (
          <button
            onClick={handleCancel}
            disabled={cancelling}
            className="text-xs border border-red-900 text-red-400 hover:bg-red-900/20 px-4 py-2.5 rounded-xl transition-all disabled:opacity-50"
          >
            {cancelling ? "Cancelling…" : "Cancel Booking"}
          </button>
        )}
      </div>

      {booking.status === "denied" && (
        <div className="bg-orange-500/5 border border-orange-500/15 rounded-xl p-4">
          <p className="text-xs text-orange-400 font-medium mb-1">✗ Request Denied by Driver</p>
          {booking.cancellationNote && booking.cancellationNote !== "Driver declined your request" && (
            <p className="text-xs text-gray-500">Reason: {booking.cancellationNote}</p>
          )}
          {booking.ride?._id && (
            <a
              href={`/rides/${booking.ride._id}`}
              className="inline-block mt-2 text-xs text-orange-400 hover:underline"
            >
               Book this ride again →
            </a>
          )}
        </div>
      )}
      {booking.status === "cancelled" && booking.cancellationNote && (
        <div className="bg-red-500/5 border border-red-500/15 rounded-xl p-4">
          <p className="text-xs text-red-400 font-medium mb-1">Cancelled</p>
          <p className="text-xs text-gray-500">
            By {booking.cancelledBy} — {booking.cancellationNote}
          </p>
        </div>
      )}

      {booking.status === "completed" && isPassenger && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          {booking.rating?.score ? (
            <div>
              <p className="text-sm font-medium text-gray-300 mb-3">
                Your Rating
              </p>
              <div className="flex gap-0.5 mb-2">
                {[1, 2, 3, 4, 5].map((n) => (
                  <Star key={n} filled={n <= booking.rating.score} />
                ))}
              </div>
              {booking.rating.comment && (
                <p className="text-sm text-gray-500 italic mt-2">
                  "{booking.rating.comment}"
                </p>
              )}
              {booking.rating.ratedAt && (
                <p className="text-xs text-gray-700 mt-2">
                  Rated{" "}
                  {format(new Date(booking.rating.ratedAt), "MMM d, yyyy")}
                </p>
              )}
            </div>
          ) : showRate ? (
            <div>
              <p className="text-sm font-medium text-gray-200 mb-4">
                Rate your experience
              </p>

              <div
                className="flex gap-0.5 mb-1"
                onMouseLeave={() => setHoverStar(0)}
              >
                {[1, 2, 3, 4, 5].map((n) => (
                  <Star
                    key={n}
                    filled={n <= (hoverStar || rating)}
                    interactive
                    onClick={() => setRating(n)}
                    onMouseEnter={() => setHoverStar(n)}
                  />
                ))}
              </div>
              <p className="text-xs text-gray-600 mb-4 h-4">
                {(hoverStar || rating) === 1 && "Poor"}
                {(hoverStar || rating) === 2 && "Fair"}
                {(hoverStar || rating) === 3 && "Good"}
                {(hoverStar || rating) === 4 && "Great"}
                {(hoverStar || rating) === 5 && "Excellent!"}
              </p>

              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Share your experience (optional)…"
                rows={3}
                className="w-full bg-gray-950 border border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-200 focus:outline-none focus:border-orange-500 placeholder-gray-600 resize-none mb-3"
              />

              <div className="flex gap-2">
                <button
                  onClick={() => setShowRate(false)}
                  className="flex-1 py-2.5 rounded-xl text-sm border border-gray-700 text-gray-400 hover:bg-gray-800 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRate}
                  disabled={submitting || !rating}
                  className="flex-2 flex-grow-[2] bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-medium transition-all"
                >
                  {submitting ? "Submitting…" : "Submit Rating"}
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowRate(true)}
              className="w-full bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 py-3 rounded-xl text-sm hover:bg-yellow-500/20 transition-all flex items-center justify-center gap-2"
            >
              <span className="text-lg">⭐</span>
              Rate this ride
            </button>
          )}
        </div>
      )}
    </div>
  );
}
