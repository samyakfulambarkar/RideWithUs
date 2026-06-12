import React, { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import {
  GoogleMap,
  Marker,
  Polyline,
  useJsApiLoader,
} from "@react-google-maps/api";
import { ridesAPI } from "../services/api";
import socketService from "../services/socket";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";

const MAP_CONTAINER = { width: "100%", height: "360px" };
const MAP_OPTIONS = {
  disableDefaultUI: false,
  zoomControl: true,
  styles: [
    { elementType: "geometry", stylers: [{ color: "#1d2535" }] },
    { elementType: "labels.text.fill", stylers: [{ color: "#8ec3b9" }] },
    {
      featureType: "road",
      elementType: "geometry",
      stylers: [{ color: "#304a7d" }],
    },
    {
      featureType: "water",
      elementType: "geometry",
      stylers: [{ color: "#17263c" }],
    },
  ],
};

export default function TrackRidePage() {
  const { rideId } = useParams();
  const { user } = useAuth();
  const [ride, setRide] = useState(null);
  const [driverPos, setDriverPos] = useState(null);
  const [rideStatus, setRideStatus] = useState("");
  const [map, setMap] = useState(null);

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: process.env.REACT_APP_GOOGLE_MAPS_KEY,
  });

  useEffect(() => {
    ridesAPI
      .getById(rideId)
      .then(({ data }) => {
        setRide(data.ride);
        setRideStatus(data.ride.status);
        if (data.ride.currentLocation?.coordinates?.[0]) {
          const [lng, lat] = data.ride.currentLocation.coordinates;
          setDriverPos({ lat, lng });
        }
      })
      .catch(() => toast.error("Ride not found"));
  }, [rideId]);

  useEffect(() => {
    socketService.joinRide(rideId);

    socketService.on("driver:location", ({ lat, lng }) => {
      setDriverPos({ lat, lng });
    });

    socketService.on("ride:statusUpdate", ({ status }) => {
      setRideStatus(status);
      toast(`Ride status: ${status}`, { icon: "📡" });
    });

    return () => {
      socketService.leaveRide(rideId);
    };
  }, [rideId]);

  const startSharingLocation = useCallback(() => {
    if (!navigator.geolocation) return toast.error("Geolocation not supported");
    const watchId = navigator.geolocation.watchPosition(
      ({ coords }) => {
        const { latitude: lat, longitude: lng } = coords;
        socketService.sendLocation(rideId, lat, lng);
        ridesAPI.updateLocation(rideId, lat, lng).catch(console.error);
        setDriverPos({ lat, lng });
      },
      (err) => toast.error("Location error: " + err.message),
      { enableHighAccuracy: true, maximumAge: 2000 },
    );
    toast.success("Sharing live location");
    return () => navigator.geolocation.clearWatch(watchId);
  }, [rideId]);

  const isDriver = ride && ride.driver?._id === user?._id;

  const origin = ride?.origin?.coordinates
    ? { lat: ride.origin.coordinates[1], lng: ride.origin.coordinates[0] }
    : null;
  const destination = ride?.destination?.coordinates
    ? {
        lat: ride.destination.coordinates[1],
        lng: ride.destination.coordinates[0],
      }
    : null;

  const statusColor = {
    scheduled: "text-blue-400",
    active: "text-green-400",
    started: "text-orange-400",
    completed: "text-gray-400",
    cancelled: "text-red-400",
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <h1 className="font-display text-2xl font-bold text-gray-100 mb-5">
        Live Tracking
      </h1>

      <div className="rounded-2xl overflow-hidden border border-gray-800 mb-5">
        {isLoaded && origin ? (
          <GoogleMap
            mapContainerStyle={MAP_CONTAINER}
            center={driverPos || origin}
            zoom={13}
            options={MAP_OPTIONS}
            onLoad={setMap}
          >
            {origin && (
              <Marker position={origin} label={{ text: "A", color: "#fff" }} />
            )}
            {destination && (
              <Marker
                position={destination}
                label={{ text: "B", color: "#fff" }}
              />
            )}
            {driverPos && (
              <Marker
                position={driverPos}
                icon={{
                  path: window.google?.maps?.SymbolPath?.CIRCLE,
                  scale: 10,
                  fillColor: "#f97316",
                  fillOpacity: 1,
                  strokeColor: "#ffffff",
                  strokeWeight: 2,
                }}
              />
            )}
          </GoogleMap>
        ) : (
          <div className="h-80 bg-gray-900 flex items-center justify-center text-gray-600">
            {isLoaded ? "Loading ride..." : "Loading map..."}
          </div>
        )}
      </div>

      {ride && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            {[
              {
                label: "Status",
                value: rideStatus,
                cls: statusColor[rideStatus],
              },
              { label: "Distance", value: `${ride.distanceKm} km` },
              { label: "Duration", value: `~${ride.durationMins} min` },
              {
                label: "Vehicle",
                value: ride.vehicleType === "bike" ? "🏍 Bike" : "🚗 Car",
              },
            ].map(({ label, value, cls }) => (
              <div
                key={label}
                className="bg-gray-900 border border-gray-800 rounded-xl p-3 text-center"
              >
                <div
                  className={`font-display text-base font-bold ${cls || "text-orange-400"}`}
                >
                  {value}
                </div>
                <div className="text-xs text-gray-500 mt-1">{label}</div>
              </div>
            ))}
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex flex-col items-center gap-1">
                <div className="w-2.5 h-2.5 rounded-full bg-orange-500" />
                <div className="w-px h-6 bg-gray-700" />
                <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
              </div>
              <div className="space-y-3">
                <p className="text-sm text-gray-300">{ride.origin?.address}</p>
                <p className="text-sm text-gray-300">
                  {ride.destination?.address}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <span>Driver:</span>
              <span className="text-gray-300 font-medium">
                {ride.driver?.name}
              </span>
              <span className="text-yellow-400">
                ★ {ride.driver?.rating?.average?.toFixed(1) || "—"}
              </span>
            </div>
          </div>

          {isDriver && (
            <div className="bg-orange-500/5 border border-orange-500/20 rounded-xl p-4">
              <p className="text-sm text-orange-400 font-medium mb-3">
                Driver Controls
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={startSharingLocation}
                  className="bg-orange-500 hover:bg-orange-600 text-white text-sm px-4 py-2 rounded-lg transition-all"
                >
                  📡 Start Sharing Location
                </button>
                {["started", "completed"].map((s) => (
                  <button
                    key={s}
                    onClick={async () => {
                      await ridesAPI.updateStatus(rideId, s);
                      socketService.updateRideStatus(rideId, s);
                      setRideStatus(s);
                      toast.success(`Ride ${s}`);
                    }}
                    className="bg-gray-800 hover:bg-gray-700 text-gray-200 text-sm px-4 py-2 rounded-lg border border-gray-700 capitalize transition-all"
                  >
                    Mark as {s}
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
