import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";

const NavLink = ({ to, children, onClick }) => {
  const { pathname } = useLocation();
  const active = pathname === to || pathname.startsWith(to + "/");
  return (
    <Link
      to={to}
      onClick={onClick}
      className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
        active
          ? "bg-orange-500/10 text-orange-400"
          : "text-gray-400 hover:text-gray-200 hover:bg-gray-800"
      }`}
    >
      {children}
    </Link>
  );
};

export default function Navbar() {
  const { user, isAdmin, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const handleLogout = () => {
    logout();
    toast.success("Logged out");
    navigate("/login");
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-gray-900 border-b border-gray-800 h-16">
      <div className="max-w-7xl mx-auto px-4 h-full flex items-center justify-between">
        {/* Logo */}
        <Link
          to="/"
          className="font-display font-bold text-xl text-orange-500 tracking-tight"
        >
          Ride<span className="text-gray-100">WithUs</span>
        </Link>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-1">
          <NavLink to="/">Home</NavLink>
          <NavLink to="/find">Find Ride</NavLink>
          <NavLink to="/create">Offer Ride</NavLink>
          <NavLink to="/bookings">My Bookings</NavLink>
          <NavLink to="/chat">Chat</NavLink>
          {isAdmin && (
            <NavLink to="/admin">
              <span className="text-purple-400">Admin</span>
            </NavLink>
          )}
        </div>

        {/* Right — profile */}
        <div className="hidden md:flex items-center gap-3">
          <Link
            to="/profile"
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
          >
            <div className="w-8 h-8 rounded-full bg-orange-500/20 border border-orange-500/30 flex items-center justify-center text-orange-400 text-sm font-semibold">
              {user?.name?.charAt(0).toUpperCase()}
            </div>
            <span className="text-sm text-gray-300">
              {user?.name?.split(" ")[0]}
            </span>
          </Link>
          <button
            onClick={handleLogout}
            className="px-3 py-1.5 text-sm text-gray-400 hover:text-red-400 border border-gray-700 hover:border-red-900 rounded-lg transition-all"
          >
            Logout
          </button>
        </div>

        {/* Mobile hamburger */}
        <button
          onClick={() => setOpen(!open)}
          className="md:hidden text-gray-400 hover:text-gray-200 p-1"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            {open ? (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            ) : (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            )}
          </svg>
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden bg-gray-900 border-t border-gray-800 px-4 pb-4 flex flex-col gap-1">
          {[
            ["/", "Home"],
            ["/find", "Find Ride"],
            ["/create", "Offer Ride"],
            ["/bookings", "My Bookings"],
            ["/chat", "Chat"],
          ].map(([to, label]) => (
            <NavLink key={to} to={to} onClick={() => setOpen(false)}>
              {label}
            </NavLink>
          ))}
          {isAdmin && (
            <NavLink to="/admin" onClick={() => setOpen(false)}>
              Admin
            </NavLink>
          )}
          <NavLink to="/profile" onClick={() => setOpen(false)}>
            Profile
          </NavLink>
          <button
            onClick={handleLogout}
            className="text-left px-3 py-2 text-sm text-red-400 hover:bg-red-900/10 rounded-lg"
          >
            Logout
          </button>
        </div>
      )}
    </nav>
  );
}
