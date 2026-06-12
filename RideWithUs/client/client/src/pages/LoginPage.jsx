import React, { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { authAPI } from "../services/api";
import { useAuth } from "../context/AuthContext";

const STEPS = { PHONE: "phone", OTP: "otp" };

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState(STEPS.PHONE);
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [isNew, setIsNew] = useState(false);
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const otpRefs = useRef([]);

  const handleSendOTP = async (e) => {
    e.preventDefault();
    if (phone.replace(/\D/g, "").length < 10) {
      return toast.error("Enter a valid 10-digit mobile number");
    }
    try {
      setLoading(true);
      const { data } = await authAPI.sendOTP({
        phone,
        name: name || undefined,
      });
      setIsNew(data.isNewUser);
      if (data.isNewUser && !name) {
        return toast.error("Please enter your name for new registration");
      }
      setStep(STEPS.OTP);
      toast.success(`OTP sent to +91 ${phone}`);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (val, idx) => {
    if (!/^\d?$/.test(val)) return;
    const next = [...otp];
    next[idx] = val;
    setOtp(next);
    if (val && idx < 5) otpRefs.current[idx + 1]?.focus();
  };

  const handleOtpKeyDown = (e, idx) => {
    if (e.key === "Backspace" && !otp[idx] && idx > 0) {
      otpRefs.current[idx - 1]?.focus();
    }
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    const code = otp.join("");
    if (code.length < 6) return toast.error("Enter the complete 6-digit OTP");
    try {
      setLoading(true);
      const { data } = await authAPI.verifyOTP({
        phone,
        code,
        name: name || undefined,
      });
      login(data.user, data.token);
      toast.success(`Welcome, ${data.user.name}! 🎉`);
      navigate("/");
    } catch (err) {
      toast.error(err.response?.data?.message || "Invalid OTP");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="font-display text-4xl font-bold text-orange-500">
            RideWithUs
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Smart commuting for India 🇮🇳
          </p>
        </div>

        <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6">
          {step === STEPS.PHONE && (
            <form onSubmit={handleSendOTP}>
              <h2 className="font-display text-xl font-semibold text-gray-100 mb-1">
                Get started
              </h2>
              <p className="text-gray-500 text-sm mb-5">
                We'll send an OTP to verify
              </p>

              {isNew && (
                <div className="mb-4">
                  <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1.5">
                    Full Name
                  </label>
                  <input
                    className="w-full bg-gray-950 border border-gray-700 rounded-xl px-4 py-3 text-gray-100 text-sm focus:outline-none focus:border-orange-500 placeholder-gray-600 transition-colors"
                    placeholder="Amit Sharma"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
              )}

              <div className="mb-4">
                <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1.5">
                  Mobile Number
                </label>
                <div className="flex gap-2">
                  <div className="bg-gray-950 border border-gray-700 rounded-xl px-3 py-3 text-gray-500 text-sm whitespace-nowrap">
                    +91
                  </div>
                  <input
                    className="flex-1 bg-gray-950 border border-gray-700 rounded-xl px-4 py-3 text-gray-100 text-sm focus:outline-none focus:border-orange-500 placeholder-gray-600 transition-colors"
                    placeholder="9xxxxxxxxx"
                    type="tel"
                    maxLength={10}
                    value={phone}
                    onChange={(e) =>
                      setPhone(e.target.value.replace(/\D/g, ""))
                    }
                  />
                </div>
              </div>

              {!isNew && (
                <div className="mb-5">
                  <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1.5">
                    Full Name{" "}
                    <span className="text-gray-600">(new users only)</span>
                  </label>
                  <input
                    className="w-full bg-gray-950 border border-gray-700 rounded-xl px-4 py-3 text-gray-100 text-sm focus:outline-none focus:border-orange-500 placeholder-gray-600 transition-colors"
                    placeholder="Leave blank if existing user"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-green-500 hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-3 rounded-xl transition-all text-sm"
              >
                {loading ? "Sending OTP..." : "Send OTP"}
              </button>

              <p className="text-center text-xs text-gray-600 mt-4">
                By continuing, you agree to our Terms & Privacy Policy
              </p>
            </form>
          )}

          {step === STEPS.OTP && (
            <form onSubmit={handleVerifyOTP}>
              <h2 className="font-display text-xl font-semibold text-gray-100 mb-1">
                Enter OTP
              </h2>
              <p className="text-gray-500 text-sm mb-6">
                Sent to{" "}
                <span className="text-orange-400 font-medium">+91 {phone}</span>
              </p>

              <div className="flex gap-2 justify-center mb-6">
                {otp.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={(el) => (otpRefs.current[idx] = el)}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(e.target.value, idx)}
                    onKeyDown={(e) => handleOtpKeyDown(e, idx)}
                    className="w-11 h-13 bg-gray-950 border border-gray-700 rounded-xl text-center text-xl font-display font-semibold text-gray-100 focus:outline-none focus:border-orange-500 transition-colors"
                    style={{ height: "52px" }}
                    autoFocus={idx === 0}
                  />
                ))}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-medium py-3 rounded-xl transition-all text-sm mb-3"
              >
                {loading ? "Verifying..." : "Verify & Login"}
              </button>

              <button
                type="button"
                onClick={() => {
                  setStep(STEPS.PHONE);
                  setOtp(["", "", "", "", "", ""]);
                }}
                className="w-full text-gray-500 hover:text-gray-300 text-sm py-2 transition-colors"
              >
                ← Change number
              </button>
            </form>
            
          )}
          <footer className="text-gray-400  mb-6" >Currently this is free api(Twilio) used service then only few numbers are verified and only these numbers will get OTPs</footer>

        </div>
      </div>
    </div>
  );
}
