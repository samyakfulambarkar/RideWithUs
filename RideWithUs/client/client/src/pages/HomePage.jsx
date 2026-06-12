import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ridesAPI } from "../services/api";
import { useAuth } from "../context/AuthContext";
import socketService from "../services/socket";
import RideCard from "../components/RideCard";
import { format } from "date-fns";
import toast from "react-hot-toast";

const formatDuration = (mins) => {
  if (!mins) return "";
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60),
    m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
};

export default function HomePage() {
  const { user } = useAuth();
  const [rides, setRides] = useState([]);
  const [myRides, setMyRides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notif, setNotif] = useState(0);

  useEffect(() => {
    ridesAPI
      .getAll({ limit: 8 })
      .then(({ data }) => setRides(data.rides || []))
      .catch(() => {})
      .finally(() => setLoading(false));

    ridesAPI
      .getMy()
      .then(({ data }) => {
        const upcoming = (data.rides || []).filter(
          (r) =>
            ["scheduled", "active"].includes(r.status) &&
            new Date(r.departureTime) > new Date(),
        );
        setMyRides(upcoming);
      })
      .catch(() => {});

    const handleNewBooking = (data) => {
      setNotif((n) => n + 1);
      toast(
        `📣 New booking from ${data.passenger?.name}! ₹${data.totalAmount}`,
        { duration: 6000 },
      );
    };
    const handleAccepted = (data) => {
      toast.success(data?.message || "Booking confirmed!");
    };
    const handleDenied = (data) => {
      toast.error(`Booking denied: ${data?.reason || ""}`);
    };
    const handlePayDone = (data) => {
      toast.success(data?.message || "Payment complete!");
    };

    const handleRideCancelled = (data) => {
      // Remove the cancelled ride from the available rides list in real-time
      setRides((prev) => prev.filter((r) => String(r._id) !== String(data.rideId)));
      setMyRides((prev) => prev.filter((r) => String(r._id) !== String(data.rideId)));
    };
    const handleRazorpayPaid = (data) => {
      toast.success(data?.message || "Payment received!");
    };

    socketService.on("booking:new", handleNewBooking);
    socketService.on("booking:accepted", handleAccepted);
    socketService.on("booking:denied", handleDenied);
    socketService.on("booking:paymentDone", handlePayDone);
    socketService.on("booking:paid", handleRazorpayPaid);
    socketService.on("ride:cancelled", handleRideCancelled);
    return () => {
      socketService.off("booking:new", handleNewBooking);
      socketService.off("booking:accepted", handleAccepted);
      socketService.off("booking:denied", handleDenied);
      socketService.off("booking:paymentDone", handlePayDone);
      socketService.off("booking:paid", handleRazorpayPaid);
      socketService.off("ride:cancelled", handleRideCancelled);
    };
  }, []);

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="max-w-5xl mx-auto  px-4 py-6">
      <div className="relative  border border-gray-800 rounded-2xl p-8 mb-6 overflow-hidden">
        <div className="absolute top-0 right-0 w-72 h-72 bg-orange-500/5 rounded-full -translate-y-1/3 translate-x-1/3 pointer-events-none" />
        <p className="text-gray-500 text-sm mb-1">
          {hour < 12
            ? "Good morning"
            : hour < 17
              ? "Good afternoon"
              : "Good evening"}{" "}
          👋
        </p>
        <h1 className="font-display text-3xl font-bold text-gray-100 mb-2">
          Hello,{" "}
          <span className="text-orange-400">{user?.name?.split(" ")[0]}</span>
        </h1>
        <p className="text-gray-500 text-sm mb-6">
          Where are you headed today?
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            to="/find"
            className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-2.5 rounded-xl font-medium text-sm transition-all"
          >
             Find a Ride
          </Link>
          <Link
            to="/create"
            className="bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-200 px-6 py-2.5 rounded-xl font-medium text-sm transition-all"
          >
             Offer a Ride
          </Link>
          <Link
            to="/bookings"
            className="bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-200 px-6 py-2.5 rounded-xl font-medium text-sm transition-all flex items-center gap-2"
          >
             My Bookings
            {notif > 0 && (
              <span className="bg-orange-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                {notif}
              </span>
            )}
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Rides Listed", value: "4+", color: "text-orange-400" },
          { label: "Active Users", value: "10+", color: "text-green-400" },
          { label: "Cities", value: "50+", color: "text-blue-400" },
          { label: "Avg Rating", value: "4.8 ★", color: "text-yellow-400" },
        ].map(({ label, value, color }) => (
          <div
            key={label}
            className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center"
          >
            <div className={`font-display text-xl font-bold ${color}`}>
              {value}
            </div>
            <div className="text-xs text-gray-500 mt-1">{label}</div>
          </div>
        ))}
      </div>

      {myRides.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display text-lg font-semibold text-gray-100">
               Your Upcoming Rides
            </h2>
            <Link
              to="/bookings?tab=driver"
              className="text-orange-400 hover:text-orange-300 text-sm"
            >
              View requests →
            </Link>
          </div>
          <div className="space-y-3">
            {myRides.map((ride) => (
              <Link
                key={ride._id}
                to={`/rides/${ride._id}`}
                className="block bg-gray-900 border border-gray-800 hover:border-orange-500/40 rounded-xl p-4 transition-all"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-200 truncate">
                      {ride.origin?.address?.split(",")[0]} →{" "}
                      {ride.destination?.address?.split(",")[0]}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {ride.departureTime
                        ? format(
                            new Date(ride.departureTime),
                            "EEE, MMM d · h:mm a",
                          )
                        : "—"}
                    </p>
                  </div>
                  <span className="text-xs px-2.5 py-1 rounded-lg bg-green-500/10 text-green-400 border border-green-500/20 font-medium ml-2 flex-shrink-0 capitalize">
                    {ride.status}
                  </span>
                </div>
                <div className="flex gap-3 text-xs text-gray-500 flex-wrap">
                  <span>
                    {ride.vehicleType === "bike" ? "🏍" : "🚗"}{" "}
                    {ride.vehicleType}
                  </span>
                  <span>
                    🪑 {ride.availableSeats}/{ride.totalSeats} seats
                  </span>
                  <span> ₹{ride.pricePerSeat}/seat</span>
                  {ride.distanceKm > 0 && (
                    <span>
                      {ride.distanceKm} km ·{" "}
                      {formatDuration(ride.durationMins)}
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-lg font-semibold text-gray-100">
          Available Rides
        </h2>
        <Link
          to="/find"
          className="text-orange-400 hover:text-orange-300 text-sm"
        >
          Search →
        </Link>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-gray-900 border border-gray-800 rounded-xl h-28 animate-pulse"
            />
          ))}
        </div>
      ) : rides.length > 0 ? (
        <div className="space-y-3">
          {rides.map((ride) => (
            <RideCard key={ride._id} ride={ride} />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-gray-900 border border-gray-800 rounded-2xl">
          <div className="text-4xl mb-3"></div>
          <p className="text-gray-400">No rides available right now.</p>
          <Link
            to="/create"
            className="text-orange-400 text-sm hover:underline mt-2 inline-block"
          >
            Be the first to offer one!
          </Link>
        </div>
      )}
    </div>
  );
}
