import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  ArrowLeft, Check, X, Clock, Send, MessageCircle,
  UserPlus, UserCheck, UserX, ChevronRight, Circle,
} from 'lucide-react';
import { useApp } from '@/app/context/AppContext';
import { useTheme } from '@/app/context/ThemeContext';
import { motion, AnimatePresence } from 'motion/react';
import type { ConnectionRequest, Conversation } from '@/app/context/AppContext';
import {
  listMeetingRequests,
  sendMeetingRequest,
  acceptMeetingRequest,
  declineMeetingRequest,
} from '@/app/api/meetingsClient';

type Tab = 'requests' | 'messages';

const formatTime = (date: Date): string => {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
};

const RequestCard: React.FC<{
  req: ConnectionRequest;
  onAccept: (id: string) => void;
  onDecline: (id: string) => void;
}> = ({ req, onAccept, onDecline }) => {
  const { t } = useTheme();
  const isIncoming = req.direction === 'incoming';
  const isPending = req.status === 'pending';

  const statusBadge = () => {
    if (req.status === 'accepted') {
      return (
        <span className="flex items-center gap-1 px-2.5 py-1 rounded-full" style={{ background: t.successBg, color: t.successText, fontSize: 11, fontWeight: 700 }}>
          <UserCheck style={{ width: 12, height: 12 }} /> Accepted
        </span>
      );
    }
    if (req.status === 'declined') {
      return (
        <span className="flex items-center gap-1 px-2.5 py-1 rounded-full" style={{ background: t.errorBg, color: t.errorText, fontSize: 11, fontWeight: 700 }}>
          <UserX style={{ width: 12, height: 12 }} /> Declined
        </span>
      );
    }
    if (!isIncoming) {
      return (
        <span className="flex items-center gap-1 px-2.5 py-1 rounded-full" style={{ background: t.warningBg, color: t.warningText, fontSize: 11, fontWeight: 700 }}>
          <Clock style={{ width: 12, height: 12 }} /> Pending
        </span>
      );
    }
    return null;
  };

  const displayUser = isIncoming ? req.fromUser : { id: req.toUserId, name: 'Attendee', title: '', company: '', avatar: `https://ui-avatars.com/api/?name=A&background=6366f1&color=fff` };

  return (
    <div className="rounded-2xl p-4 mb-3 transition-all" style={{ background: t.surface, border: `1px solid ${t.border}`, boxShadow: t.shadow }}>
      <div className="flex items-start gap-3">
        <div className="relative flex-shrink-0">
          <div className="w-12 h-12 rounded-xl overflow-hidden" style={{ border: `2px solid ${t.border}` }}>
            <img src={displayUser.avatar} alt={displayUser.name} className="w-full h-full object-cover" />
          </div>
          {isIncoming ? (
            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#7c3aed,#4f46e5)' }}>
              <UserPlus style={{ width: 10, height: 10, color: '#fff' }} />
            </div>
          ) : (
            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center" style={{ background: t.surface2, border: `1px solid ${t.border}` }}>
              <Send style={{ width: 9, height: 9, color: t.textSec }} />
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h4 className="truncate" style={{ color: t.text, fontSize: 14, fontWeight: 700 }}>{displayUser.name}</h4>
              {displayUser.title && (
                <p className="truncate" style={{ color: t.textSec, fontSize: 12, marginTop: 1 }}>
                  {displayUser.title}{displayUser.company ? ` · ${displayUser.company}` : ''}
                </p>
              )}
            </div>
            <div className="flex-shrink-0 flex items-center gap-2">
              {statusBadge()}
              <span style={{ color: t.textMuted, fontSize: 11 }}>{formatTime(req.timestamp)}</span>
            </div>
          </div>

          {req.message && (
            <p className="mt-2 px-3 py-2 rounded-xl" style={{ background: t.surface2, color: t.textSec, fontSize: 12, lineHeight: 1.5, border: `1px solid ${t.borderSub}` }}>
              "{req.message}"
            </p>
          )}

          {isIncoming && isPending && (
            <div className="flex items-center gap-2 mt-3">
              <button
                onClick={() => onAccept(req.id)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl transition-all active:scale-[0.97]"
                style={{ background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', color: '#fff' }}
              >
                <Check style={{ width: 14, height: 14 }} />
                <span style={{ fontSize: 12, fontWeight: 700 }}>Accept</span>
              </button>
              <button
                onClick={() => onDecline(req.id)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl transition-all active:scale-[0.97]"
                style={{ background: t.surface2, border: `1px solid ${t.border}`, color: t.textSec }}
              >
                <X style={{ width: 14, height: 14 }} />
                <span style={{ fontSize: 12, fontWeight: 700 }}>Decline</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const ConversationRow: React.FC<{
  conv: Conversation;
  onOpen: (id: string) => void;
}> = ({ conv, onOpen }) => {
  const { t } = useTheme();
  const { user } = useApp();
  const lastMsg = conv.messages[conv.messages.length - 1];
  const currentUserId = user?.id || 'current-user';
  const unreadCount = conv.messages.filter(m => !m.read && m.senderId !== currentUserId).length;

  return (
    <button
      onClick={() => onOpen(conv.id)}
      className="w-full flex items-center gap-3 p-4 rounded-2xl mb-2 transition-all active:scale-[0.98]"
      style={{ background: t.surface, border: `1px solid ${t.border}`, boxShadow: t.shadow }}
    >
      <div className="relative flex-shrink-0">
        <div className="w-12 h-12 rounded-xl overflow-hidden" style={{ border: `2px solid ${unreadCount > 0 ? '#7c3aed' : t.border}` }}>
          <img src={conv.participant.avatar} alt={conv.participant.name} className="w-full h-full object-cover" />
        </div>
        {unreadCount > 0 && (
          <div className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full flex items-center justify-center px-1" style={{ background: 'linear-gradient(135deg,#7c3aed,#4f46e5)' }}>
            <span style={{ color: '#fff', fontSize: 10, fontWeight: 800 }}>{unreadCount}</span>
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0 text-left">
        <div className="flex items-center justify-between gap-2">
          <h4 className="truncate" style={{ color: t.text, fontSize: 14, fontWeight: unreadCount > 0 ? 800 : 600 }}>{conv.participant.name}</h4>
          <span style={{ color: unreadCount > 0 ? '#a78bfa' : t.textMuted, fontSize: 11, fontWeight: unreadCount > 0 ? 700 : 400, flexShrink: 0 }}>
            {lastMsg ? formatTime(lastMsg.timestamp) : ''}
          </span>
        </div>
        {lastMsg && (
          <p className="truncate mt-0.5" style={{ color: unreadCount > 0 ? t.text : t.textSec, fontSize: 12, fontWeight: unreadCount > 0 ? 600 : 400 }}>
            {lastMsg.senderId === currentUserId ? 'You: ' : ''}{lastMsg.text}
          </p>
        )}
        <p className="truncate mt-0.5" style={{ color: t.textMuted, fontSize: 11 }}>
          {conv.participant.title}{conv.participant.company ? ` · ${conv.participant.company}` : ''}
        </p>
      </div>

      <ChevronRight style={{ width: 16, height: 16, color: t.textMuted, flexShrink: 0 }} />
    </button>
  );
};

const ChatDetailView: React.FC<{
  conversation: Conversation;
  onBack: () => void;
}> = ({ conversation, onBack }) => {
  const { t, isDark } = useTheme();
  const { sendMessage, user } = useApp();
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const currentUserId = user?.id || 'current-user';

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation.messages.length]);

  const handleSend = () => {
    const trimmed = inputText.trim();
    if (!trimmed) return;
    sendMessage(conversation.id, trimmed);
    setInputText('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: '100%' }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: '100%' }}
      transition={{ type: 'spring', damping: 28, stiffness: 300 }}
      className="absolute inset-0 z-50 flex flex-col"
      style={{ background: t.bgPage }}
    >
      <div className="flex items-center gap-3 px-4 py-3" style={{ background: t.surface, borderBottom: `1px solid ${t.border}`, backdropFilter: 'blur(20px)' }}>
        <button onClick={onBack} className="p-1.5 rounded-xl transition-all active:scale-90" style={{ background: t.surface2 }}>
          <ArrowLeft style={{ width: 18, height: 18, color: t.text }} />
        </button>
        <div className="w-9 h-9 rounded-lg overflow-hidden flex-shrink-0" style={{ border: `2px solid ${t.border}` }}>
          <img src={conversation.participant.avatar} alt={conversation.participant.name} className="w-full h-full object-cover" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="truncate" style={{ color: t.text, fontSize: 14, fontWeight: 700 }}>{conversation.participant.name}</h4>
          <p className="truncate" style={{ color: t.textSec, fontSize: 11 }}>
            {conversation.participant.title}{conversation.participant.company ? ` · ${conversation.participant.company}` : ''}
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {conversation.messages.map((msg) => {
          const isMine = msg.senderId === currentUserId;
          return (
            <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
              <div
                className="max-w-[80%] px-3.5 py-2.5 rounded-2xl"
                style={{
                  background: isMine
                    ? 'linear-gradient(135deg,#7c3aed,#4f46e5)'
                    : t.surface,
                  border: isMine ? 'none' : `1px solid ${t.border}`,
                  borderBottomRightRadius: isMine ? 6 : 16,
                  borderBottomLeftRadius: isMine ? 16 : 6,
                }}
              >
                <p style={{ color: isMine ? '#fff' : t.text, fontSize: 13, lineHeight: 1.5 }}>{msg.text}</p>
                <p className="mt-1" style={{ color: isMine ? 'rgba(255,255,255,0.5)' : t.textMuted, fontSize: 10, textAlign: isMine ? 'right' : 'left' }}>
                  {formatTime(msg.timestamp)}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      <div className="px-4 py-3" style={{ background: t.surface, borderTop: `1px solid ${t.border}` }}>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            className="flex-1 px-4 py-2.5 rounded-xl outline-none transition-all"
            style={{
              background: t.inputBg,
              border: `1px solid ${t.inputBorder}`,
              color: t.text,
              fontSize: 13,
            }}
          />
          <button
            onClick={handleSend}
            disabled={!inputText.trim()}
            className="w-10 h-10 rounded-xl flex items-center justify-center transition-all active:scale-90"
            style={{
              background: inputText.trim() ? 'linear-gradient(135deg,#7c3aed,#4f46e5)' : t.surface2,
              opacity: inputText.trim() ? 1 : 0.5,
            }}
          >
            <Send style={{ width: 16, height: 16, color: inputText.trim() ? '#fff' : t.textMuted }} />
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export const MeetingsPage: React.FC = () => {
  const { t, isDark } = useTheme();
  const { user, connectionRequests, conversations, acceptConnection, declineConnection, markConversationRead, setConnectionRequests } = useApp();
  const [activeTab, setActiveTab] = useState<Tab>('requests');
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleOpenChat = (convId: string) => {
    setActiveChatId(convId);
    markConversationRead(convId);
  };

  const fetchRequests = useCallback(async () => {
    const res = await listMeetingRequests();
    if (res.success && res.data) {
      setConnectionRequests(prev => {
        const serverIds = new Set(res.data!.map(r => r.id));
        const localOnly = prev.filter(r => !serverIds.has(r.id));
        return [...localOnly, ...res.data!];
      });
    }
  }, [setConnectionRequests]);

  // Gate the initial fetch + 30s poll on having an authenticated user.
  // Without this gate, the screen would fire `GET /meetings` every 30s
  // even after sign-out (the auth handler nulls the user before the page
  // reload completes), 401-ing each time and burning unauthenticated
  // quota. Re-keying on `user?.id` tears the interval down on sign-out
  // and re-arms it cleanly on re-login.
  useEffect(() => {
    if (!user?.id) return;
    fetchRequests();
    pollIntervalRef.current = setInterval(fetchRequests, 30000);
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [fetchRequests, user?.id]);

  const handleAccept = async (requestId: string) => {
    const res = await acceptMeetingRequest(requestId);
    if (res.success) {
      acceptConnection(requestId);
    }
  };

  const handleDecline = async (requestId: string) => {
    const res = await declineMeetingRequest(requestId);
    if (res.success) {
      declineConnection(requestId);
    }
  };

  const incomingPending = connectionRequests.filter(r => r.direction === 'incoming' && r.status === 'pending');
  const outgoingPending = connectionRequests.filter(r => r.direction === 'outgoing' && r.status === 'pending');
  const history = connectionRequests.filter(r => r.status === 'accepted' || r.status === 'declined');

  const activeChat = conversations.find(c => c.id === activeChatId);

  const myId = user?.id || 'current-user';
  const unreadTotal = conversations.reduce((sum, c) => {
    return sum + c.messages.filter(m => !m.read && m.senderId !== myId).length;
  }, 0);

  const tabs: { id: Tab; label: string; badge?: number }[] = [
    { id: 'requests', label: 'Requests', badge: incomingPending.length || undefined },
    { id: 'messages', label: 'Messages', badge: unreadTotal || undefined },
  ];

  return (
    <div className="relative min-h-screen pb-24" style={{ background: t.bgPage }}>
      <AnimatePresence>
        {activeChat && (
          <ChatDetailView
            key={activeChat.id}
            conversation={activeChat}
            onBack={() => setActiveChatId(null)}
          />
        )}
      </AnimatePresence>

      <div className="px-5 pt-4 pb-3">
        <h1 style={{ color: t.text, fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em' }}>
          Meetings
        </h1>
        <p style={{ color: t.textSec, fontSize: 13, marginTop: 2 }}>
          Connection requests & conversations
        </p>
      </div>

      <div className="px-5 mb-4">
        <div className="flex gap-1 p-1 rounded-xl" style={{ background: t.surface, border: `1px solid ${t.border}` }}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg transition-all"
              style={{
                background: activeTab === tab.id ? 'linear-gradient(135deg,#7c3aed,#4f46e5)' : 'transparent',
                color: activeTab === tab.id ? '#fff' : t.textSec,
                fontWeight: activeTab === tab.id ? 700 : 500,
                fontSize: 13,
              }}
            >
              {tab.label}
              {tab.badge !== undefined && tab.badge > 0 && (
                <span
                  className="min-w-[18px] h-[18px] rounded-full flex items-center justify-center px-1"
                  style={{
                    background: activeTab === tab.id ? 'rgba(255,255,255,0.25)' : 'linear-gradient(135deg,#7c3aed,#4f46e5)',
                    color: '#fff',
                    fontSize: 10,
                    fontWeight: 800,
                  }}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'requests' ? (
          <motion.div
            key="requests"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="px-5"
          >
            {incomingPending.length > 0 && (
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: t.accentBg }}>
                    <UserPlus style={{ width: 12, height: 12, color: t.accentSoft }} />
                  </div>
                  <h3 style={{ color: t.text, fontSize: 13, fontWeight: 700 }}>Incoming Requests</h3>
                  <span className="ml-auto px-2 py-0.5 rounded-full" style={{ background: t.accentBg, color: t.accentSoft, fontSize: 11, fontWeight: 700 }}>
                    {incomingPending.length}
                  </span>
                </div>
                {incomingPending.map(req => (
                  <RequestCard key={req.id} req={req} onAccept={handleAccept} onDecline={handleDecline} />
                ))}
              </div>
            )}

            {outgoingPending.length > 0 && (
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: t.warningBg }}>
                    <Send style={{ width: 12, height: 12, color: t.warningText }} />
                  </div>
                  <h3 style={{ color: t.text, fontSize: 13, fontWeight: 700 }}>Sent Requests</h3>
                  <span className="ml-auto px-2 py-0.5 rounded-full" style={{ background: t.warningBg, color: t.warningText, fontSize: 11, fontWeight: 700 }}>
                    {outgoingPending.length}
                  </span>
                </div>
                {outgoingPending.map(req => (
                  <RequestCard key={req.id} req={req} onAccept={handleAccept} onDecline={handleDecline} />
                ))}
              </div>
            )}

            {history.length > 0 && (
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: t.surface2 }}>
                    <Clock style={{ width: 12, height: 12, color: t.textSec }} />
                  </div>
                  <h3 style={{ color: t.text, fontSize: 13, fontWeight: 700 }}>History</h3>
                </div>
                {history.map(req => (
                  <RequestCard key={req.id} req={req} onAccept={handleAccept} onDecline={handleDecline} />
                ))}
              </div>
            )}

            {incomingPending.length === 0 && outgoingPending.length === 0 && history.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: t.surface2 }}>
                  <UserPlus style={{ width: 28, height: 28, color: t.emptyIcon }} />
                </div>
                <p style={{ color: t.textSec, fontSize: 14, fontWeight: 600 }}>No connection requests yet</p>
                <p style={{ color: t.textMuted, fontSize: 12, marginTop: 4 }}>Visit the Audience tab to connect with attendees</p>
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="messages"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="px-5"
          >
            {conversations.length > 0 ? (
              conversations
                .sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime())
                .map(conv => (
                  <ConversationRow key={conv.id} conv={conv} onOpen={handleOpenChat} />
                ))
            ) : (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: t.surface2 }}>
                  <MessageCircle style={{ width: 28, height: 28, color: t.emptyIcon }} />
                </div>
                <p style={{ color: t.textSec, fontSize: 14, fontWeight: 600 }}>No conversations yet</p>
                <p style={{ color: t.textMuted, fontSize: 12, marginTop: 4 }}>Accept a connection request to start chatting</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
