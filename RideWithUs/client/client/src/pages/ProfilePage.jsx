import React, { useEffect, useState } from "react";
import { usersAPI } from "../services/api";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";

export default function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const [stats, setStats] = useState(null);
  const [form, setForm] = useState({
    name: user?.name || "",
    profilePhoto: "",
  });
  const [vehicle, setVehicle] = useState({
    type: "",
    model: "",
    registration: "",
    color: "",
  });
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState("profile"); // 'profile' | 'vehicle' | 'stats'

  useEffect(() => {
    usersAPI
      .getStats()
      .then(({ data }) => setStats(data.stats))
      .catch(console.error);
    usersAPI
      .getProfile()
      .then(({ data }) => {
        setForm({
          name: data.user.name,
          profilePhoto: data.user.profilePhoto || "",
        });
        if (data.user.vehicle) setVehicle(data.user.vehicle);
      })
      .catch(console.error);
  }, []);

  const handleSaveProfile = async () => {
    try {
      setSaving(true);
      await usersAPI.updateProfile({ name: form.name });
      await refreshUser();
      toast.success("Profile updated");
    } catch {
      toast.error("Update failed");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveVehicle = async () => {
    try {
      setSaving(true);
      await usersAPI.updateVehicle(vehicle);
      toast.success("Vehicle info saved");
    } catch {
      toast.error("Update failed");
    } finally {
      setSaving(false);
    }
  };

  const inputCls =
    "w-full bg-gray-950 border border-gray-700 rounded-xl px-4 py-3 text-gray-100 text-sm focus:outline-none focus:border-orange-500 placeholder-gray-600 transition-colors";
  const Field = ({ label, children }) => (
    <div>
      <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1.5">
        {label}
      </label>
      {children}
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <div className="w-16 h-16 rounded-full bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-2xl font-display font-bold text-orange-400">
          {user?.name?.charAt(0).toUpperCase()}
        </div>
        <div>
          <h1 className="font-display text-xl font-bold text-gray-100">
            {user?.name}
          </h1>
          <p className="text-gray-500 text-sm">{user?.phone}</p>
          <div className="flex items-center gap-2 mt-1">
            <span
              className={`text-xs px-2 py-0.5 rounded-md ${user?.role === "admin" ? "bg-purple-500/10 text-purple-400" : "bg-gray-800 text-gray-400"}`}
            >
              {user?.role}
            </span>
            {user?.isVerified && (
              <span className="text-xs text-green-400">✓ Verified</span>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-xl p-1 mb-5 w-fit">
        {[
          ["profile", "Profile"],
          ["vehicle", "Vehicle"],
          ["stats", "Stats"],
        ].map(([val, label]) => (
          <button
            key={val}
            onClick={() => setTab(val)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === val
                ? "bg-orange-500 text-white"
                : "text-gray-400 hover:text-gray-200"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Profile tab */}
      {tab === "profile" && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4">
          <Field label="Full Name">
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className={inputCls}
            />
          </Field>
          <Field label="Mobile Number">
            <input
              value={user?.phone}
              disabled
              className={inputCls + " opacity-50 cursor-not-allowed"}
            />
          </Field>
          <Field label="Rating">
            <div className="bg-gray-950 border border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-300">
              ★ {user?.rating?.average?.toFixed(1) || "—"} (
              {user?.rating?.count || 0} reviews)
            </div>
          </Field>
          <button
            onClick={handleSaveProfile}
            disabled={saving}
            className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-medium py-3 rounded-xl transition-all text-sm"
          >
            {saving ? "Saving..." : "Save Profile"}
          </button>
        </div>
      )}

      {/* Vehicle tab */}
      {tab === "vehicle" && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4">
          <Field label="Vehicle Type">
            <div className="grid grid-cols-2 gap-3">
              {[
                ["bike", "🏍 2-Wheeler"],
                ["car", "🚗 4-Wheeler"],
              ].map(([val, label]) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setVehicle((v) => ({ ...v, type: val }))}
                  className={`py-3 rounded-xl text-sm font-medium border transition-all ${
                    vehicle.type === val
                      ? "border-orange-500 bg-orange-500/10 text-orange-400"
                      : "border-gray-700 bg-gray-950 text-gray-400 hover:border-gray-600"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Vehicle Model">
            <input
              value={vehicle.model}
              onChange={(e) =>
                setVehicle((v) => ({ ...v, model: e.target.value }))
              }
              placeholder="e.g. Honda Activa / Swift Dzire"
              className={inputCls}
            />
          </Field>
          <Field label="Registration Number">
            <input
              value={vehicle.registration}
              onChange={(e) =>
                setVehicle((v) => ({
                  ...v,
                  registration: e.target.value.toUpperCase(),
                }))
              }
              placeholder="e.g. MH12AB1234"
              className={inputCls}
            />
          </Field>
          <Field label="Color">
            <input
              value={vehicle.color}
              onChange={(e) =>
                setVehicle((v) => ({ ...v, color: e.target.value }))
              }
              placeholder="e.g. White"
              className={inputCls}
            />
          </Field>
          <button
            onClick={handleSaveVehicle}
            disabled={saving}
            className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-medium py-3 rounded-xl transition-all text-sm"
          >
            {saving ? "Saving..." : "Save Vehicle Info"}
          </button>
        </div>
      )}

      {/* Stats tab */}
      {tab === "stats" && (
        <div className="space-y-3">
          {stats ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                {[
                  {
                    label: "Rides Offered",
                    value: stats.totalRidesOffered,
                    color: "text-orange-400",
                  },
                  {
                    label: "Rides Booked",
                    value: stats.totalRidesBooked,
                    color: "text-blue-400",
                  },
                  {
                    label: "Total Earned",
                    value: `₹${stats.totalEarned?.toLocaleString("en-IN")}`,
                    color: "text-green-400",
                  },
                  {
                    label: "Avg Rating",
                    value: `${stats.rating?.average?.toFixed(1) || "—"} ★`,
                    color: "text-yellow-400",
                  },
                ].map(({ label, value, color }) => (
                  <div
                    key={label}
                    className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center"
                  >
                    <p className={`font-display text-2xl font-bold ${color}`}>
                      {value}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">{label}</p>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="bg-gray-900 border border-gray-800 rounded-xl p-4 h-20 animate-pulse"
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
