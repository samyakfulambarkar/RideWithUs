import React, { useEffect, useState } from "react";
import { adminAPI } from "../../services/api";
import { format } from "date-fns";
import toast from "react-hot-toast";

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const load = () => {
    setLoading(true);
    adminAPI
      .getUsers({ search })
      .then(({ data }) => setUsers(data.users))
      .catch(() => toast.error("Failed to load users"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [search]);

  const handleToggle = async (user) => {
    try {
      if (user.isActive) {
        await adminAPI.deactivateUser(user._id);
        toast.success(`${user.name} deactivated`);
      } else {
        await adminAPI.activateUser(user._id);
        toast.success(`${user.name} activated`);
      }
      setUsers((prev) =>
        prev.map((u) =>
          u._id === user._id ? { ...u, isActive: !u.isActive } : u,
        ),
      );
    } catch {
      toast.error("Failed to update user");
    }
  };

  const handleMakeAdmin = async (user) => {
    if (!window.confirm(`Promote ${user.name} to admin?`)) return;
    try {
      await adminAPI.makeAdmin(user._id);
      setUsers((prev) =>
        prev.map((u) => (u._id === user._id ? { ...u, role: "admin" } : u)),
      );
      toast.success(`${user.name} is now an admin`);
    } catch {
      toast.error("Failed to promote user");
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <h1 className="font-display text-2xl font-bold text-purple-400 mb-5">
        Manage Users
      </h1>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by name or phone..."
        className="w-full max-w-sm bg-gray-900 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-gray-300 focus:outline-none focus:border-purple-500 placeholder-gray-600 mb-5"
      />

      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="bg-gray-900 border border-gray-800 rounded-xl h-16 animate-pulse"
            />
          ))}
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="grid grid-cols-[2fr_1.5fr_1fr_1fr_1fr_auto] gap-3 px-4 py-3 border-b border-gray-800 text-xs text-gray-500 uppercase tracking-wider">
            <span>Name</span>
            <span>Phone</span>
            <span>Role</span>
            <span>Joined</span>
            <span>Status</span>
            <span>Actions</span>
          </div>

          {users.length === 0 ? (
            <p className="text-center text-gray-600 py-8">No users found</p>
          ) : (
            users.map((u) => (
              <div
                key={u._id}
                className="grid grid-cols-[2fr_1.5fr_1fr_1fr_1fr_auto] gap-3 px-4 py-3 border-b border-gray-800 last:border-0 items-center hover:bg-gray-800/30 transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-full bg-gray-700 flex items-center justify-center text-xs font-semibold text-gray-300 flex-shrink-0">
                    {u.name?.charAt(0).toUpperCase()}
                  </div>
                  <p className="text-sm text-gray-300 truncate">{u.name}</p>
                </div>
                <p className="text-sm text-gray-500">{u.phone}</p>
                <span
                  className={`text-xs px-2 py-1 rounded-md inline-block ${
                    u.role === "admin"
                      ? "bg-purple-500/10 text-purple-400"
                      : "bg-gray-700 text-gray-400"
                  }`}
                >
                  {u.role}
                </span>
                <p className="text-xs text-gray-600">
                  {u.createdAt
                    ? format(new Date(u.createdAt), "MMM d, yy")
                    : "—"}
                </p>
                <span
                  className={`text-xs ${u.isActive ? "text-green-400" : "text-red-400"}`}
                >
                  {u.isActive ? "Active" : "Inactive"}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleToggle(u)}
                    className={`text-xs border px-2 py-1 rounded-lg transition-all ${
                      u.isActive
                        ? "border-red-900 text-red-400 hover:bg-red-900/20"
                        : "border-green-900 text-green-400 hover:bg-green-900/20"
                    }`}
                  >
                    {u.isActive ? "Deactivate" : "Activate"}
                  </button>
                  {u.role !== "admin" && (
                    <button
                      onClick={() => handleMakeAdmin(u)}
                      className="text-xs border border-purple-900 text-purple-400 hover:bg-purple-900/20 px-2 py-1 rounded-lg transition-all"
                    >
                      Make Admin
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
