const express = require('express');
const router = express.Router();
const {
  sendMessage, getMessages, getConversations,
} = require('../controllers/messageController');
const { protect } = require('../middleware/auth');

router.post('/', protect, sendMessage);
router.get('/conversations', protect, getConversations);
router.get('/:bookingId', protect, getMessages);

module.exports = router;
