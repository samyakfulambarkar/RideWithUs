const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { sendOTP, verifyOTP } = require('../config/twilio');

// ── Helper: generate JWT ─────────────────────────────────────────
const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE || '7d' });

const formatPhone = (phone) => {
  // Accepts 10-digit or +91 prefixed
  if (phone.startsWith('+91')) return phone;
  if (phone.startsWith('91') && phone.length === 12) return `+${phone}`;
  return `+91${phone}`;
};
exports.sendOTPHandler = async (req, res) => {
  try {
    const { phone, name } = req.body;

    if (!phone) {
      return res.status(400).json({ success: false, message: 'Phone number is required' });
    }

    const formattedPhone = formatPhone(phone.trim());

    // Validate Indian mobile format
    const phoneRegex = /^\+91[6-9]\d{9}$/;
    if (!phoneRegex.test(formattedPhone)) {
      return res.status(400).json({
        success: false,
        message: 'Enter a valid Indian mobile number (10 digits starting with 6-9)',
      });
    }

    // Check if user exists
    let user = await User.findOne({ phone: formattedPhone });
    const isNewUser = !user;

    if (isNewUser && !name) {
      return res.status(400).json({
        success: false,
        message: 'Name is required for new users',
        isNewUser: true,
      });
    }

    // Send OTP via Twilio
    await sendOTP(formattedPhone);

    res.json({
      success: true,
      message: `OTP sent to ${formattedPhone}`,
      isNewUser,
      phone: formattedPhone,
    });
  } catch (error) {
    console.error('Send OTP Error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to send OTP. Please try again.' });
  }
};

exports.verifyOTPHandler = async (req, res) => {
  try {
    const { phone, code, name } = req.body;

    if (!phone || !code) {
      return res.status(400).json({ success: false, message: 'Phone and OTP code are required' });
    }

    const formattedPhone = formatPhone(phone.trim());

    // Verify via Twilio
    const isValid = await verifyOTP(formattedPhone, code.trim());

    if (!isValid) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
    }

    // Upsert user
    let user = await User.findOne({ phone: formattedPhone });

    if (!user) {
      if (!name) {
        return res.status(400).json({ success: false, message: 'Name is required for signup' });
      }
      user = await User.create({ phone: formattedPhone, name: name.trim(), isVerified: true });
    } else {
      user.isVerified = true;
      user.lastLoginAt = new Date();
      await user.save();
    }

    const token = signToken(user._id);

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        phone: user.phone,
        role: user.role,
        isVerified: user.isVerified,
        rating: user.rating,
        vehicle: user.vehicle,
        profilePhoto: user.profilePhoto,
      },
    });
  } catch (error) {
    console.error('Verify OTP Error:', error.message);
    res.status(500).json({ success: false, message: 'Verification failed. Please try again.' });
  }
};

exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-__v');
    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
