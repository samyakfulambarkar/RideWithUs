import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { AuthProvider, useAuth } from "./context/AuthContext";

// Pages
import LoginPage from "./pages/LoginPage";
import HomePage from "./pages/HomePage";
import FindRidePage from "./pages/FindRidePage";
import CreateRidePage from "./pages/CreateRidePage";
import RideDetailPage from "./pages/RideDetailPage";
import MyBookingsPage from "./pages/MyBookingsPage";
import BookingDetailPage from "./pages/BookingDetailPage";
import PaymentPage from "./pages/PaymentPage";
import ChatPage from "./pages/ChatPage";
import TrackRidePage from "./pages/TrackRidePage";
import ProfilePage from "./pages/ProfilePage";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminRides from "./pages/admin/AdminRides";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminBookings from "./pages/admin/AdminBookings";

import Navbar from "./components/Navbar";

const PrivateRoute = ({ children }) => {
  const { isLoggedIn, loading } = useAuth();
  if (loading) return <FullPageLoader />;
  return isLoggedIn ? children : <Navigate to="/login" replace />;
};

const AdminRoute = ({ children }) => {
  const { isLoggedIn, isAdmin, loading } = useAuth();
  if (loading) return <FullPageLoader />;
  if (!isLoggedIn) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;
  return children;
};

const PublicRoute = ({ children }) => {
  const { isLoggedIn } = useAuth();
  return isLoggedIn ? <Navigate to="/" replace /> : children;
};

const FullPageLoader = () => (
  <div className="min-h-screen bg-gray-950 flex items-center justify-center">
    <div className="text-center">
      <div className="w-10 h-10 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
      <p className="text-gray-400 text-sm">Loading RideWithUs...</p>
    </div>
  </div>
);

const AppLayout = ({ children }) => {
  const { isLoggedIn } = useAuth();
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {isLoggedIn && <Navbar />}
      <main className={isLoggedIn ? "pt-16" : ""}>{children}</main>
    </div>
  );
};

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppLayout>
          <Routes>
            <Route
              path="/login"
              element={
                <PublicRoute>
                  <LoginPage />
                </PublicRoute>
              }
            />

            <Route
              path="/"
              element={
                <PrivateRoute>
                  <HomePage />
                </PrivateRoute>
              }
            />
            <Route
              path="/find"
              element={
                <PrivateRoute>
                  <FindRidePage />
                </PrivateRoute>
              }
            />
            <Route
              path="/create"
              element={
                <PrivateRoute>
                  <CreateRidePage />
                </PrivateRoute>
              }
            />
            <Route
              path="/rides/:id"
              element={
                <PrivateRoute>
                  <RideDetailPage />
                </PrivateRoute>
              }
            />
            <Route
              path="/bookings"
              element={
                <PrivateRoute>
                  <MyBookingsPage />
                </PrivateRoute>
              }
            />
            <Route
              path="/bookings/:id"
              element={
                <PrivateRoute>
                  <BookingDetailPage />
                </PrivateRoute>
              }
            />
            <Route
              path="/pay/:id"
              element={
                <PrivateRoute>
                  <PaymentPage />
                </PrivateRoute>
              }
            />
            <Route
              path="/chat"
              element={
                <PrivateRoute>
                  <ChatPage />
                </PrivateRoute>
              }
            />
            <Route
              path="/chat/:bookingId"
              element={
                <PrivateRoute>
                  <ChatPage />
                </PrivateRoute>
              }
            />
            <Route
              path="/track/:rideId"
              element={
                <PrivateRoute>
                  <TrackRidePage />
                </PrivateRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <PrivateRoute>
                  <ProfilePage />
                </PrivateRoute>
              }
            />

            {/* Admin */}
            <Route
              path="/admin"
              element={
                <AdminRoute>
                  <AdminDashboard />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/rides"
              element={
                <AdminRoute>
                  <AdminRides />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/users"
              element={
                <AdminRoute>
                  <AdminUsers />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/bookings"
              element={
                <AdminRoute>
                  <AdminBookings />
                </AdminRoute>
              }
            />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AppLayout>

        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: "#1e293b",
              color: "#f1f5f9",
              border: "1px solid #334155",
              fontFamily: "DM Sans",
            },
            success: {
              iconTheme: { primary: "#4ade80", secondary: "#1e293b" },
            },
            error: { iconTheme: { primary: "#f87171", secondary: "#1e293b" } },
          }}
        />
      </AuthProvider>
    </BrowserRouter>
  );
}
