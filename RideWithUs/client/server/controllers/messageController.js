const Message = require('../models/Message');
const Booking = require('../models/Booking');

exports.sendMessage = async (req, res) => {
  try {
    const { bookingId, text } = req.body;
    if (!bookingId || !text) return res.status(400).json({ success: false, message: 'bookingId and text required' });

    const booking = await Booking.findById(bookingId);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    const isParticipant = [booking.passenger.toString(), booking.driver.toString()].includes(req.user._id.toString());
    if (!isParticipant) return res.status(403).json({ success: false, message: 'Not authorised' });

    const receiverId = booking.passenger.toString() === req.user._id.toString() ? booking.driver : booking.passenger;

    const message = await Message.create({
      booking: bookingId, sender: req.user._id, receiver: receiverId, text: text.trim(),
    });
    await message.populate('sender', 'name profilePhoto');

    res.status(201).json({ success: true, message });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getMessages = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const booking = await Booking.findById(bookingId);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    const isParticipant = [booking.passenger.toString(), booking.driver.toString()].includes(req.user._id.toString());
    if (!isParticipant && req.user.role !== 'admin') return res.status(403).json({ success: false, message: 'Not authorised' });

    const messages = await Message.find({ booking: bookingId })
      .populate('sender', 'name profilePhoto')
      .sort({ createdAt: 1 });

    // Mark received messages as read
    await Message.updateMany(
      { booking: bookingId, receiver: req.user._id, isRead: false },
      { isRead: true, readAt: new Date() }
    );
    res.json({ success: true, count: messages.length, messages });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getConversations = async (req, res) => {
  try {
    const bookings = await Booking.find({
      $or: [{ passenger: req.user._id }, { driver: req.user._id }],
      status: { $in: ['pending', 'confirmed', 'started', 'completed'] },
    })
      .populate('ride', 'origin destination departureTime')
      .populate('passenger', 'name profilePhoto')
      .populate('driver', 'name profilePhoto');

    const conversations = await Promise.all(bookings.map(async b => {
      const lastMsg = await Message.findOne({ booking: b._id }).sort({ createdAt: -1 }).select('text createdAt isRead sender');
      const unread = await Message.countDocuments({ booking: b._id, receiver: req.user._id, isRead: false });
      const otherUser = b.passenger._id.toString() === req.user._id.toString() ? b.driver : b.passenger;
      return { bookingId: b._id, ride: b.ride, otherUser, lastMessage: lastMsg || null, unreadCount: unread, bookingStatus: b.status };
    }));

    conversations.sort((a, b) => {
      const at = a.lastMessage ? new Date(a.lastMessage.createdAt) : 0;
      const bt = b.lastMessage ? new Date(b.lastMessage.createdAt) : 0;
      return bt - at;
    });
    res.json({ success: true, conversations });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
