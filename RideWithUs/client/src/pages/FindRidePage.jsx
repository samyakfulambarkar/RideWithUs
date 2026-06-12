import React, { useState, useRef, useCallback } from "react";
import { ridesAPI } from "../services/api";
import toast from "react-hot-toast";
import RideCard from "../components/RideCard";

const GMAPS_KEY = process.env.REACT_APP_GOOGLE_MAPS_KEY;
const today = new Date().toISOString().split("T")[0];

let gmapsLoaded = false;
let gmapsCallbacks = [];
const loadGMaps = (cb) => {
  if (window.google?.maps?.places) {
    cb();
    return;
  }
  gmapsCallbacks.push(cb);
  if (gmapsLoaded) return;
  gmapsLoaded = true;
  window.__gmapsReady = () => {
    gmapsCallbacks.forEach((f) => f());
    gmapsCallbacks = [];
  };
  const s = document.createElement("script");
  s.src = `https://maps.googleapis.com/maps/api/js?key=${GMAPS_KEY}&libraries=places&callback=__gmapsReady`;
  s.async = true;
  s.defer = true;
  document.head.appendChild(s);
};

const useGMapsInput = (inputRef) => {
  const acRef = useRef(null);
  const initAC = useCallback(() => {
    if (!inputRef.current || acRef.current) return;
    acRef.current = new window.google.maps.places.Autocomplete(
      inputRef.current,
      {
        componentRestrictions: { country: "in" },
        fields: ["formatted_address", "geometry", "name"],
      },
    );
  }, [inputRef]);

  React.useEffect(() => {
    if (GMAPS_KEY) loadGMaps(initAC);
  }, [initAC]);

  return acRef;
};

const formatDuration = (mins) => {
  if (!mins) return "";
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60),
    m = mins % 60;
  return m > 0 ? `${h} hr ${m} min` : `${h} hr`;
};

export default function FindRidePage() {
  const [date, setDate] = useState(today);
  const [seats, setSeats] = useState(1);
  const [rides, setRides] = useState([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fromRef = useRef(null);
  const toRef = useRef(null);
  useGMapsInput(fromRef);
  useGMapsInput(toRef);

  const handleSearch = async (e) => {
    e.preventDefault();
    setError("");
    const from = fromRef.current?.value?.trim();
    const to = toRef.current?.value?.trim();
    if (!from) return toast.error("Enter pickup location");
    if (!to) return toast.error("Enter destination");
    if (!date) return toast.error("Select a date");

    try {
      setLoading(true);
      const { data } = await ridesAPI.search({
        originAddress: from,
        destinationAddress: to,
        date,
        seats,
      });
      setRides(data.rides || []);
      setSearched(true);
      if (!data.rides?.length)
        toast("No rides found. Try different date or city.", { icon: "🔍" });
    } catch (err) {
      const msg =
        err.response?.data?.message || "Search failed. Please try again.";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <h1 className="font-display text-2xl font-bold text-gray-100 mb-5">
        Find a Ride
      </h1>

      <form
        onSubmit={handleSearch}
        className="bg-gray-900 border border-gray-800 rounded-2xl p-5 mb-6 space-y-3"
      >
        <div>
          <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1.5">
            Pickup Location
          </label>
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600 text-sm">
            
            </span>
            <input
              ref={fromRef}
              className="w-full bg-gray-950 border border-gray-700 rounded-xl pl-9 pr-4 py-3 text-gray-100 text-sm focus:outline-none focus:border-orange-500 placeholder-gray-600"
              placeholder="e.g. Pune Railway Station, Pune"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1.5">
            Destination
          </label>
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600 text-sm">
              
            </span>
            <input
              ref={toRef}
              className="w-full bg-gray-950 border border-gray-700 rounded-xl pl-9 pr-4 py-3 text-gray-100 text-sm focus:outline-none focus:border-orange-500 placeholder-gray-600"
              placeholder="e.g. Bandra Station, Mumbai"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1.5">
              Date
            </label>
            <input
              type="date"
              value={date}
              min={today}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-gray-950 border border-gray-700 rounded-xl px-4 py-3 text-gray-100 text-sm focus:outline-none focus:border-orange-500"
              required
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1.5">
              Seats Needed
            </label>
            <select
              value={seats}
              onChange={(e) => setSeats(Number(e.target.value))}
              className="w-full bg-gray-950 border border-gray-700 rounded-xl px-4 py-3 text-gray-100 text-sm focus:outline-none focus:border-orange-500"
            >
              {[1, 2, 3, 4].map((n) => (
                <option key={n} value={n}>
                  {n} Seat{n > 1 ? "s" : ""}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-medium py-3 rounded-xl transition-all text-sm"
        >
          {loading ? "Searching..." : "🔍 Search Rides"}
        </button>
      </form>

      {searched && (
        <>
          <h2 className="font-display text-base font-semibold text-gray-300 mb-3">
            {rides.length} ride{rides.length !== 1 ? "s" : ""} found
          </h2>
          {rides.length > 0 ? (
            <div className="space-y-3">
              {rides.map((ride) => (
                <RideCard
                  key={ride._id}
                  ride={ride}
                  formatDuration={formatDuration}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 bg-gray-900 border border-gray-800 rounded-2xl">
              <div className="text-4xl mb-3">😕</div>
              <p className="text-gray-400 font-medium">
                No rides found for this route
              </p>
              <p className="text-gray-600 text-sm mt-1">
                Try a nearby city or a different date
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
