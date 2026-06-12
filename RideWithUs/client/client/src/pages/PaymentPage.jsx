import React, { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { bookingsAPI, paymentsAPI } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { format } from "date-fns";
import toast from "react-hot-toast";

const loadRazorpayScript = () =>
  new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });

export default function PaymentPage() {
  const { id: bookingId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    bookingsAPI
      .getById(bookingId)
      .then(({ data }) => setBooking(data.booking))
      .catch(() => toast.error("Booking not found"))
      .finally(() => setLoading(false));
  }, [bookingId]);

  const handlePay = async () => {
    try {
      setPaying(true);

      const sdkLoaded = await loadRazorpayScript();
      if (!sdkLoaded) {
        toast.error("Failed to load payment SDK. Check your internet.");
        return;
      }

      let data;
      try {
        const res = await paymentsAPI.createOrder(bookingId);
        data = res.data;
      } catch (orderErr) {
        const msg = orderErr.response?.data?.message || orderErr.message || "Failed to create payment order";
        toast.error(msg);
        setPaying(false);
        return;
      }
      if (!data.success) {
        toast.error(data.message || "Could not create payment order");
        setPaying(false);
        return;
      }

      const { orderId, amount, currency, keyId } = data;

      const rzp = new window.Razorpay({
        key: keyId,
        amount, 
        currency,
        name: "RideWithUs",
        description: `${booking?.ride?.origin?.address?.split(",")[0]} → ${booking?.ride?.destination?.address?.split(",")[0]}`,
        order_id: orderId,
        prefill: {
          name: user?.name || "",
          contact: user?.phone || "",
        },
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
              bookingId,
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            });
            if (verify.data.success) {
              toast.success("Payment successful! Ride confirmed 🎉");
              setPaying(false);
              navigate(`/bookings/${bookingId}?payment=success`);
            } else {
              throw new Error("Verification failed");
            }
          } catch {
            toast.error("Payment verification failed. Contact support.");
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
      toast.error(
        err.response?.data?.message || err.message || "Payment failed",
      );
      setPaying(false);
    }
  };

  if (loading)
    return (
      <div className="max-w-md mx-auto px-4 py-8 space-y-4">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="bg-gray-900 border border-gray-800 rounded-2xl h-28 animate-pulse"
          />
        ))}
      </div>
    );

  if (!booking)
    return (
      <div className="text-center py-16 text-gray-500">
        Booking not found.{" "}
        <Link to="/bookings" className="text-orange-400">
          Back
        </Link>
      </div>
    );

  if (booking.payment?.status === "paid")
    return (
      <div className="max-w-md mx-auto px-4 py-8 text-center">
        <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-8">
          <div className="text-5xl mb-4">✅</div>
          <h2 className="font-display text-xl font-bold text-green-400 mb-2">
            Already Paid
          </h2>
          <p className="text-gray-400 text-sm mb-5">
            This booking has already been paid for.
          </p>
          <Link
            to={`/bookings/${bookingId}`}
            className="text-orange-400 hover:underline text-sm"
          >
            View booking →
          </Link>
        </div>
      </div>
    );

  const ride = booking.ride;

  return (
    <div className="max-w-md mx-auto px-4 py-8 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <Link
          to={`/bookings/${bookingId}`}
          className="text-gray-500 hover:text-gray-300"
        >
          ←
        </Link>
        <h1 className="font-display text-xl font-bold text-gray-100">
          Complete Payment
        </h1>
      </div>

      {/* Route summary */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
        <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">
          Ride Details
        </p>
        <div className="flex items-start gap-3">
          <div className="flex flex-col items-center gap-1 mt-1 flex-shrink-0">
            <div className="w-2.5 h-2.5 rounded-full bg-orange-500" />
            <div className="w-px h-7 bg-gray-700" />
            <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
          </div>
          <div className="space-y-2">
            <p className="text-sm text-gray-200">{ride?.origin?.address}</p>
            <p className="text-sm text-gray-200">
              {ride?.destination?.address}
            </p>
          </div>
        </div>
        {ride?.departureTime && (
          <p className="text-xs text-gray-500 mt-3">
            {format(new Date(ride.departureTime), "EEEE, MMMM d · h:mm a")}
          </p>
        )}
      </div>

      {/* Driver */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
        <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">
          Your Driver
        </p>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center text-base font-bold text-gray-300">
            {booking.driver?.name?.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-medium text-gray-200">
              {booking.driver?.name}
            </p>
            <p className="text-xs text-gray-500">{booking.driver?.phone}</p>
          </div>
          {booking.driver?.rating?.average > 0 && (
            <span className="ml-auto text-xs text-yellow-400">
              ★ {booking.driver.rating.average.toFixed(1)}
            </span>
          )}
        </div>
      </div>

      {/* Pricing breakdown */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-3">
        <p className="text-xs text-gray-500 uppercase tracking-wider">
          Price Breakdown
        </p>
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">
            Price per seat × {booking.seatsBooked}
          </span>
          <span className="text-gray-200">
            ₹{ride?.pricePerSeat} × {booking.seatsBooked}
          </span>
        </div>
        {ride?.distanceKm && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Distance</span>
            <span className="text-gray-400">{ride.distanceKm} km</span>
          </div>
        )}
        <div className="flex justify-between border-t border-gray-800 pt-3">
          <span className="font-medium text-gray-300">Total</span>
          <span className="font-display text-2xl font-bold text-orange-400">
            ₹{booking.totalAmount}
          </span>
        </div>
      </div>

      {/* Cancellation policy notice */}
      <div className="bg-yellow-500/5 border border-yellow-500/15 rounded-xl p-4">
        <p className="text-xs text-yellow-400/80 font-medium mb-1">
          ⚠️ Cancellation Policy
        </p>
        <p className="text-xs text-gray-500 leading-relaxed">
          Cancel <strong className="text-gray-400">24 hours before</strong>{" "}
          departure for a full refund. Cancellations within 24 hours may not be
          refunded. No-show after ride starts — no refund.
        </p>
      </div>

      {/* Pay button */}
      <button
        onClick={handlePay}
        disabled={paying}
        className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-4 rounded-2xl transition-all text-base flex items-center justify-center gap-2 shadow-lg shadow-orange-500/20"
      >
        {paying ? (
          <>
            <span className="inline-block w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            Opening Razorpay...
          </>
        ) : (
          <>💳 Pay ₹{booking.totalAmount} via Razorpay</>
        )}
      </button>

      <p className="text-center text-xs text-gray-600">
        Secured by Razorpay · UPI, Cards, Net Banking, Wallets accepted
      </p>
    </div>
  );
}
