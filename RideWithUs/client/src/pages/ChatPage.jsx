import React, { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "react-router-dom";
import { messagesAPI } from "../services/api";
import socketService from "../services/socket";
import { useAuth } from "../context/AuthContext";
import { format } from "date-fns";
import toast from "react-hot-toast";

export default function ChatPage() {
  const { bookingId: paramBookingId } = useParams();
  const { user } = useAuth();
  const [convos, setConvos] = useState([]);
  const [active, setActive] = useState(paramBookingId || null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [typing, setTyping] = useState(false);
  const [otherUser, setOtherUser] = useState(null);
  const [receiverId, setReceiverId] = useState(null);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const bottomRef = useRef(null);
  const typingTimer = useRef(null);
  const activeRef = useRef(active);
  activeRef.current = active;

  const loadConvos = useCallback(() => {
    messagesAPI
      .getConversations()
      .then(({ data }) => {
        setConvos(data.conversations || []);
        if (!active && data.conversations?.length > 0) {
          setActive(String(data.conversations[0].bookingId));
        }
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    loadConvos();
  }, [loadConvos]);

  useEffect(() => {
    if (!active) return;

    setLoadingMsgs(true);
    setMessages([]);
    const convo = convos.find((c) => String(c.bookingId) === String(active));
    if (convo) {
      setOtherUser(convo.otherUser);
      const otherId = convo.otherUser?._id;
      setReceiverId(otherId);
    }

    messagesAPI
      .getHistory(active)
      .then(({ data }) => setMessages(data.messages || []))
      .catch(() => toast.error("Could not load messages"))
      .finally(() => setLoadingMsgs(false));

    socketService.joinBooking(active);

    const handleNew = (msg) => {
      if (String(msg.bookingId) !== String(activeRef.current)) return;
      setMessages((prev) => {
        const already = prev.some(
          (m) =>
            (m._id && m._id === msg._id) ||
            (m.fromSocket &&
              m.text === msg.text &&
              Math.abs(new Date(m.createdAt) - new Date(msg.createdAt)) <
                2000 &&
              String(m.sender?._id) === String(msg.sender?._id)),
        );
        if (already) return prev;
        return [...prev, msg];
      });
      loadConvos();
    };

    const handleTypingStart = ({ userId }) => {
      if (userId !== user._id) setTyping(true);
    };
    const handleTypingStop = ({ userId }) => {
      if (userId !== user._id) setTyping(false);
    };

    socketService.on("message:new", handleNew);
    socketService.on("typing:start", handleTypingStart);
    socketService.on("typing:stop", handleTypingStop);

    return () => {
      socketService.leaveBooking(active);
      socketService.off("message:new", handleNew);
      socketService.off("typing:start", handleTypingStart);
      socketService.off("typing:stop", handleTypingStop);
    };
  }, [active, convos.length]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    if (!text.trim() || !active) return;
    const msgText = text.trim();
    setText("");

    socketService.sendMessage(active, msgText, receiverId);
    messagesAPI.send({ bookingId: active, text: msgText }).catch(console.error);
    socketService.typingStop(active);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
      return;
    }
    socketService.typingStart(active);
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(
      () => socketService.typingStop(active),
      1500,
    );
  };

  const isMine = (msg) => {
    const senderId = msg.sender?._id || msg.sender;
    return String(senderId) === String(user._id);
  };

  const selectConvo = (bookingId) => {
    setActive(String(bookingId));
    setMessages([]);
    setTyping(false);
  };

  return (
    <div
      className="max-w-4xl mx-auto px-4 py-6 flex gap-4"
      style={{ height: "calc(100vh - 80px)" }}
    >
      <div className="w-64 flex-shrink-0 bg-gray-900 border border-gray-800 rounded-2xl flex flex-col overflow-hidden">
        <div className="p-4 border-b border-gray-800">
          <h2 className="font-display text-sm font-semibold text-gray-300">
            Conversations
          </h2>
        </div>
        <div className="flex-1 overflow-y-auto">
          {convos.length === 0 ? (
            <p className="text-center text-gray-600 text-xs p-4 mt-4">
              No conversations yet.
              <br />
              Book a ride to start chatting.
            </p>
          ) : (
            convos.map((c) => (
              <button
                key={String(c.bookingId)}
                onClick={() => selectConvo(c.bookingId)}
                className={`w-full text-left p-3 flex items-center gap-3 transition-colors border-b border-gray-800 last:border-0 ${
                  String(active) === String(c.bookingId)
                    ? "bg-gray-800"
                    : "hover:bg-gray-800/50"
                }`}
              >
                <div className="w-8 h-8 rounded-full bg-orange-500/10 text-orange-400 flex items-center justify-center text-sm font-semibold flex-shrink-0">
                  {c.otherUser?.name?.charAt(0)?.toUpperCase() || "?"}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-gray-200 truncate">
                    {c.otherUser?.name || "User"}
                  </p>
                  <p className="text-xs text-gray-600 truncate">
                    {c.lastMessage?.text || "Start chatting"}
                  </p>
                </div>
                {c.unreadCount > 0 && (
                  <span className="bg-orange-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0 font-medium">
                    {c.unreadCount}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      </div>


      {active ? (
        <div className="flex-1 bg-gray-900 border border-gray-800 rounded-2xl flex flex-col overflow-hidden min-w-0">
          {/* Header */}
          <div className="p-4 border-b border-gray-800 flex items-center gap-3 flex-shrink-0">
            <div className="w-9 h-9 rounded-full bg-orange-500/10 text-orange-400 flex items-center justify-center font-semibold text-sm">
              {otherUser?.name?.charAt(0)?.toUpperCase() || "?"}
            </div>
            <div>
              <p className="text-sm font-medium text-gray-200">
                {otherUser?.name || "Chat"}
              </p>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                <p className="text-xs text-green-400">
                  Online · End-to-end secure
                </p>
              </div>
            </div>
          </div>

        
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {loadingMsgs ? (
              <div className="flex justify-center items-center h-full">
                <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : messages.length === 0 ? (
              <div className="flex justify-center items-center h-full">
                <p className="text-gray-600 text-sm">
                  No messages yet. Say hello! 👋
                </p>
              </div>
            ) : (
              messages.map((msg, i) => {
                const mine = isMine(msg);
                return (
                  <div
                    key={msg._id || i}
                    className={`flex ${mine ? "justify-end" : "justify-start"}`}
                  >
                    {!mine && (
                      <div className="w-6 h-6 rounded-full bg-gray-700 flex items-center justify-center text-xs mr-2 flex-shrink-0 mt-1">
                        {(msg.sender?.name || otherUser?.name || "?")
                          .charAt(0)
                          .toUpperCase()}
                      </div>
                    )}
                    <div
                      className={`max-w-xs lg:max-w-sm px-4 py-2.5 rounded-2xl text-sm ${
                        mine
                          ? "bg-orange-500 text-white rounded-br-sm"
                          : "bg-gray-800 text-gray-200 rounded-bl-sm"
                      }`}
                    >
                      {!mine && (
                        <p className="text-xs font-medium mb-1 opacity-70">
                          {msg.sender?.name || otherUser?.name}
                        </p>
                      )}
                      <p className="leading-relaxed break-words">{msg.text}</p>
                      <p
                        className={`text-xs mt-1 ${mine ? "text-orange-200" : "text-gray-500"}`}
                      >
                        {msg.createdAt
                          ? format(new Date(msg.createdAt), "h:mm a")
                          : "now"}
                      </p>
                    </div>
                  </div>
                );
              })
            )}

            {typing && (
              <div className="flex justify-start items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-gray-700 flex items-center justify-center text-xs flex-shrink-0">
                  {(otherUser?.name || "?").charAt(0).toUpperCase()}
                </div>
                <div className="bg-gray-800 px-4 py-2.5 rounded-2xl rounded-bl-sm">
                  <div className="flex gap-1 items-center h-4">
                    {[0, 0.2, 0.4].map((d) => (
                      <div
                        key={d}
                        className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce"
                        style={{ animationDelay: `${d}s` }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="p-3 border-t border-gray-800 flex gap-2 flex-shrink-0">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message... (Enter to send)"
              className="flex-1 bg-gray-950 border border-gray-700 rounded-xl px-4 py-2.5 text-gray-100 text-sm focus:outline-none focus:border-orange-500 placeholder-gray-600"
            />
            <button
              onClick={handleSend}
              disabled={!text.trim()}
              className="bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-all"
            >
              Send
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center bg-gray-900 border border-gray-800 rounded-2xl">
          <div className="text-center">
            <div className="text-5xl mb-3">💬</div>
            <p className="text-gray-400 font-medium">Select a conversation</p>
            <p className="text-gray-600 text-sm mt-1">
              Book a ride to start chatting with your driver
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
