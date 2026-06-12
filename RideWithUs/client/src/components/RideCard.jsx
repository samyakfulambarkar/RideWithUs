import React from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";

const formatDuration = (mins) => {
  if (!mins || mins === 0) return "";
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60),
    m = mins % 60;
  return m > 0 ? `${h} hr ${m} min` : `${h} hr`;
};

export default function RideCard({ ride }) {
  if (!ride?._id) return null;
  const isBike = ride.vehicleType === "bike";
  const driverName = ride.driver?.name || "Driver";
  const rating = ride.driver?.rating?.average;

  return (
    <div className="bg-gray-900 border border-gray-800 hover:border-orange-500/30 rounded-xl p-4 transition-all">
      {/* Top row */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div
            className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0 ${
              isBike
                ? "bg-blue-500/10 text-blue-400"
                : "bg-green-500/10 text-green-400"
            }`}
          >
            {driverName.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-medium text-gray-200 leading-tight">
              {driverName}
            </p>
            <p className="text-xs text-yellow-400 leading-tight">
              {rating ? `★ ${rating.toFixed(1)}` : "★ New driver"}
            </p>
          </div>
        </div>
        <div className="text-right">
          <span className="font-display text-lg font-bold text-orange-400">
            ₹{ride.pricePerSeat}
          </span>
          <span className="text-xs text-gray-500 ml-1">/ seat</span>
        </div>
      </div>

      {/* Route */}
      <div className="flex items-center gap-2.5 mb-3">
        <div className="flex flex-col items-center gap-1 flex-shrink-0">
          <div className="w-2 h-2 rounded-full bg-orange-500" />
          <div className="w-px h-4 bg-gray-700" />
          <div className="w-2 h-2 rounded-full bg-blue-500" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-gray-200 truncate">
            {ride.origin?.address || "—"}
          </p>
          <p className="text-sm text-gray-400 truncate mt-1">
            {ride.destination?.address || "—"}
          </p>
        </div>
      </div>

      {/* Badges */}
      <div className="flex items-center gap-2 flex-wrap">
        <span
          className={`text-xs px-2 py-1 rounded-md font-medium border ${
            isBike
              ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
              : "bg-green-500/10 text-green-400 border-green-500/20"
          }`}
        >
          {isBike ? "🏍 Bike" : "🚗 Car"}
        </span>

        <span className="text-xs px-2 py-1 rounded-md bg-orange-500/10 text-orange-400 border border-orange-500/20">
          🪑 {ride.availableSeats} seat{ride.availableSeats !== 1 ? "s" : ""}{" "}
          left
        </span>

        {ride.departureTime && (
          <span className="text-xs px-2 py-1 rounded-md bg-purple-500/10 text-purple-400 border border-purple-500/20">
            ⏰ {format(new Date(ride.departureTime), "MMM d · h:mm a")}
          </span>
        )}

        {(ride.distanceKm > 0 || ride.durationMins > 0) && (
          <span className="text-xs text-gray-600">
            {ride.distanceKm > 0 && `${ride.distanceKm} km`}
            {ride.distanceKm > 0 && ride.durationMins > 0 && " · "}
            {ride.durationMins > 0 && formatDuration(ride.durationMins)}
          </span>
        )}

        {ride.distanceToPickupKm && Number(ride.distanceToPickupKm) > 0 && (
          <span className="text-xs text-gray-600">
            📍 {ride.distanceToPickupKm} km pickup
          </span>
        )}

        <Link
          to={`/rides/${ride._id}`}
          className="ml-auto bg-orange-500 hover:bg-orange-600 text-white text-xs px-4 py-1.5 rounded-lg font-medium transition-all"
        >
          View & Book
        </Link>
      </div>
    </div>
  );
}
