import React, { useState, useRef, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ridesAPI } from "../services/api";
import toast from "react-hot-toast";

const GMAPS_KEY = process.env.REACT_APP_GOOGLE_MAPS_KEY;

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

  window.__gmapsReady2 = () => {
    gmapsCallbacks.forEach((f) => f());
    gmapsCallbacks = [];
  };

  const s = document.createElement("script");
  s.src = `https://maps.googleapis.com/maps/api/js?key=${GMAPS_KEY}&libraries=places&callback=__gmapsReady2`;
  s.async = true;
  s.defer = true;
  document.head.appendChild(s);
};

export default function CreateRidePage() {
  const navigate = useNavigate();

  const [vehicleType, setVehicleType] = useState("car");

  const [form, setForm] = useState({
    departureTime: "",
    totalSeats: 2,
    pricePerSeat: "",
    notes: "",
  });

  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");

  const [loading, setLoading] = useState(false);

  const fromRef = useRef(null);
  const toRef = useRef(null);


  const initAC = useCallback(() => {
    [fromRef, toRef].forEach((ref) => {
      if (ref.current && !ref.current._autocomplete) {
        const ac = new window.google.maps.places.Autocomplete(ref.current, {
          componentRestrictions: { country: "in" },
          fields: ["formatted_address", "geometry", "name"],
        });

        ref.current._autocomplete = ac;

        ac.addListener("place_changed", () => {
          const place = ac.getPlace();
          if (place?.formatted_address) {
            if (ref === fromRef) setOrigin(place.formatted_address);
            if (ref === toRef) setDestination(place.formatted_address);
          }
        });
      }
    });
  }, []);

  useEffect(() => {
    loadGMaps(initAC);
  }, [initAC]);

  const handle = (f) => (e) => setForm((p) => ({ ...p, [f]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();

    const originAddress = origin.trim();
    const destinationAddress = destination.trim();

    if (!originAddress) return toast.error("Enter start location");
    if (!destinationAddress) return toast.error("Enter destination");
    if (originAddress === destinationAddress)
      return toast.error("Start and destination cannot be same");

    if (!form.departureTime) return toast.error("Select departure time");

    if (!form.pricePerSeat || Number(form.pricePerSeat) < 1)
      return toast.error("Enter valid price");

    try {
      setLoading(true);

      const { data } = await ridesAPI.create({
        vehicleType,
        originAddress,
        destinationAddress,
        departureTime: form.departureTime,
        totalSeats: Number(form.totalSeats),
        pricePerSeat: Number(form.pricePerSeat),
        notes: form.notes,
      });

      toast.success("Ride posted successfully!");
      navigate(`/rides/${data.ride._id}`);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to post ride");
    } finally {
      setLoading(false);
    }
  };

  const ic =
    "w-full bg-gray-950 border border-gray-700 rounded-xl px-4 py-3 text-gray-100 text-sm focus:outline-none focus:border-orange-500 ";

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold text-white mb-5">Offer a Ride</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-xs text-gray-500 uppercase mb-2 block">
            Vehicle Type
          </label>

          <div className="grid grid-cols-2 gap-3">
            {[
              ["bike", "🏍", "2-Wheeler"],
              ["car", "🚗", "4-Wheeler"],
            ].map(([v, icon, label]) => (
              <button
                key={v}
                type="button"
                onClick={() => {
                  setVehicleType(v);
                  setForm((f) => ({
                    ...f,
                    totalSeats: v === "bike" ? 1 : 2,
                  }));
                }}
                className={`py-3 px-4 rounded-xl border ${
                  vehicleType === v
                    ? "border-orange-500 bg-orange-500/10 text-orange-400"
                    : "border-gray-700 bg-gray-950 text-gray-400"
                }`}
              >
                {icon} {label}
              </button>
            ))}
          </div>
        </div>

        <input
          ref={fromRef}
          value={origin}
          onChange={(e) => setOrigin(e.target.value)}
          placeholder="Start location"
          className={ic}
        />

        <input
          ref={toRef}
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
          placeholder= "Destination"
          className={ic}
        />

        <input
          type="datetime-local"
          value={form.departureTime}
          onChange={handle("departureTime")}
          className={ic}
        />

        <select
          value={form.totalSeats}
          onChange={handle("totalSeats")}
          className={ic}
        >
          {(vehicleType === "bike" ? [1] : [1, 2, 3, 4]).map((n) => (
            <option key={n} value={n}>
              {n} Seat{n > 1 ? "s" : ""}
            </option>
          ))}
        </select>

        <input
          type="number"
          value={form.pricePerSeat}
          onChange={(e) =>
            setForm((f) => ({ ...f, pricePerSeat: e.target.value }))
          }
          placeholder="Price per seat"
          className={ic}
        />

        <textarea
          value={form.notes}
          onChange={handle("notes")}
          rows={2}
          maxLength={300}
          placeholder="Optional notes for passengers (max 300 chars)"
          className={ic}
        />
        {form.notes.length > 250 && (
          <p className="text-xs text-gray-500 text-right -mt-2">
            {300 - form.notes.length} chars left
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-xl"
        >
          {loading ? "Posting..." : " Post Ride"}
        </button>
      </form>
    </div>
  );
}
