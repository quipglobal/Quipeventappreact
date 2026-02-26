import React, { useState } from 'react';
import { Bell, Search, ArrowRight, Calendar, MapPin, Ticket, X, ScanLine, QrCode, Building2, ChevronRight } from 'lucide-react';
import { useApp } from '@/app/context/AppContext';
import { useTheme } from '@/app/context/ThemeContext';
import { SwitchEventModal } from '@/app/components/SwitchEventModal';
import { SocialFeed } from '@/app/components/feed/SocialFeed';
import { motion, AnimatePresence } from 'motion/react';

interface HomePageProps { onNavigate: (page: string) => void; }

export const HomePage: React.FC<HomePageProps> = ({ onNavigate }) => {
  const { user, eventConfig, hasJoinedEvent, joinEvent, showToast } = useApp();
  const { t } = useTheme();
  const [switchModalOpen, setSwitchModalOpen] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  
  // Join Flow States
  const [showCodeInput, setShowCodeInput] = useState(false);
  const [eventCode, setEventCode] = useState('');
  const [showScanner, setShowScanner] = useState(false);
  
  if (!user) return null;

  const handleJoinClick = () => {
    // If user is already registered in the "audience list" (mocked via isRegistered prop), join immediately
    if (user.isRegistered) {
      performJoin();
    } else {
      // Otherwise, show code input UI
      setShowCodeInput(true);
    }
  };

  const performJoin = () => {
    setIsJoining(true);
    // Simulate API call
    setTimeout(() => {
      joinEvent();
      setIsJoining(false);
      setShowCodeInput(false);
    }, 1500);
  };

  const handleSubmitCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (eventCode.length < 4) {
      showToast('Invalid event code');
      return;
    }
    // Simulate code validation
    performJoin();
  };

  const handleScan = () => {
    setShowScanner(true);
    // Simulate scanning delay then success
    setTimeout(() => {
      setShowScanner(false);
      performJoin();
    }, 2000);
  };

  return (
    <div className="min-h-screen" style={{ background: t.bgPage }}>
      {/* Cinematic Header with Blur/Glass effect */}
      <div className="sticky top-0 z-50 px-4 pt-4 pb-2 backdrop-blur-md border-b"
        style={{ 
          background: 'rgba(7,7,15,0.85)', 
          borderColor: t.border 
        }}>
        <div className="flex items-center justify-between mb-3">
          {/* User Profile / Greeting */}
          <div className="flex items-center gap-3">
             <div className="w-9 h-9 rounded-full overflow-hidden border cursor-pointer" 
                  onClick={() => onNavigate('profile')}
                  style={{ borderColor: t.borderAcc }}>
                {user.avatar ? (
                  <img src={user.avatar} alt="Me" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-violet-600 text-white font-bold text-sm">
                    {user.name.charAt(0)}
                  </div>
                )}
             </div>
             <div>
               <h1 className="text-sm font-bold leading-none mb-1" style={{ color: t.text }}>Hi, {user.name.split(' ')[0]} 👋</h1>
               <div className="flex items-center gap-1 text-[10px]" style={{ color: t.textSec }}>
                  <span className="font-medium px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-400">
                    {user.points} pts
                  </span>
                  <span>•</span>
                  <span>{user.tier} Tier</span>
               </div>
             </div>
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setSwitchModalOpen(true)}
              className="w-9 h-9 rounded-full flex items-center justify-center transition-colors"
              style={{ background: t.surface, border: `1px solid ${t.border}` }}>
              <div className="relative">
                <Ticket size={16} color={t.text} />
              </div>
            </button>
            <button className="w-9 h-9 rounded-full flex items-center justify-center transition-colors"
              style={{ background: t.surface, border: `1px solid ${t.border}` }}>
              <Search size={16} color={t.text} />
            </button>
            <button className="w-9 h-9 rounded-full flex items-center justify-center transition-colors relative"
              style={{ background: t.surface, border: `1px solid ${t.border}` }}>
              <Bell size={16} color={t.text} />
              <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-[#111120]" />
            </button>
          </div>
        </div>
      </div>

      {/* Join Event Banner (Inline) */}
      <AnimatePresence>
        {!hasJoinedEvent && (
          <motion.div 
            initial={{ opacity: 0, height: 0, marginBottom: 0 }}
            animate={{ opacity: 1, height: 'auto', marginBottom: 16 }}
            exit={{ opacity: 0, height: 0, marginBottom: 0 }}
            className="px-4 pt-4 overflow-hidden"
          >
            <div className="relative rounded-3xl overflow-hidden shadow-2xl transition-all duration-300">
              {/* Background */}
              <div className="absolute inset-0">
                <img 
                  src="https://images.unsplash.com/photo-1573339887617-d674bc961c31?ixlib=rb-1.2.1&auto=format&fit=crop&w=1080&q=80" 
                  alt="Event" 
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0" style={{ background: 'linear-gradient(to right, rgba(7,7,15,0.95), rgba(7,7,15,0.6))' }} />
              </div>

              {/* Content */}
              <div className="relative p-5">
                {!showCodeInput ? (
                  // STANDARD JOIN VIEW
                  <div className="flex flex-col items-start gap-4">
                    <div>
                      <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md mb-2 border backdrop-blur-sm"
                        style={{ background: 'rgba(124,58,237,0.2)', borderColor: 'rgba(124,58,237,0.3)' }}>
                        <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                        <span className="text-[10px] font-bold text-white uppercase tracking-wider">Happening Now</span>
                      </div>
                      <h2 className="text-xl font-black text-white leading-tight mb-1">{eventConfig.name}</h2>
                      <div className="flex items-center gap-3 text-white/70 text-xs">
                        <span className="flex items-center gap-1"><Calendar size={12} /> {eventConfig.dates}</span>
                        <span className="flex items-center gap-1"><MapPin size={12} /> {eventConfig.location}</span>
                      </div>
                    </div>

                    <div className="w-full flex items-center justify-between gap-4 mt-1">
                      <div className="flex -space-x-2">
                          {[1,2,3].map(i => (
                            <div key={i} className="w-7 h-7 rounded-full border-2 border-[#111120] bg-gray-600 overflow-hidden">
                              <img src={`https://i.pravatar.cc/100?img=${i+10}`} alt="Attendee" className="w-full h-full object-cover" />
                            </div>
                          ))}
                          <div className="w-7 h-7 rounded-full border-2 border-[#111120] bg-gray-800 flex items-center justify-center text-[9px] font-bold text-white">
                            +1k
                          </div>
                      </div>

                      <button 
                        onClick={handleJoinClick}
                        disabled={isJoining}
                        className="flex-1 max-w-[140px] py-2.5 rounded-xl font-bold text-xs text-white shadow-lg flex items-center justify-center gap-2 transition-transform active:scale-95"
                        style={{ background: t.accent }}>
                          {isJoining ? (
                            <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          ) : (
                            <>
                              <span>Join Now</span>
                              <ArrowRight size={14} />
                            </>
                          )}
                      </button>
                    </div>
                  </div>
                ) : (
                  // CODE INPUT VIEW
                  <motion.div 
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex flex-col gap-4"
                  >
                    <div className="flex items-center justify-between">
                      <h2 className="text-lg font-bold text-white">Enter Event Code</h2>
                      <button onClick={() => setShowCodeInput(false)} className="p-1 rounded-full bg-white/10 text-white hover:bg-white/20">
                        <X size={16} />
                      </button>
                    </div>
                    
                    <p className="text-xs text-white/70 leading-relaxed">
                      You are not on the guest list. Please enter the code from your invitation or scan the QR code at the venue.
                    </p>

                    <form onSubmit={handleSubmitCode} className="flex gap-2">
                       <input 
                         type="text" 
                         placeholder="e.g. 8492"
                         value={eventCode}
                         onChange={(e) => setEventCode(e.target.value)}
                         className="flex-1 bg-white/10 border border-white/20 rounded-xl px-4 py-2 text-white placeholder:text-white/30 outline-none focus:border-violet-500 transition-colors font-mono text-center tracking-widest uppercase"
                       />
                       <button 
                         type="submit"
                         disabled={!eventCode || isJoining}
                         className="px-4 py-2 rounded-xl font-bold text-sm text-white shadow-lg transition-transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                         style={{ background: t.accent }}>
                         {isJoining ? '...' : <ArrowRight size={18} />}
                       </button>
                    </form>

                    <div className="relative flex items-center justify-center">
                       <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/10"></div></div>
                       <span className="relative bg-[#1a1a2e] px-2 text-[10px] text-white/40 uppercase font-bold">Or</span>
                    </div>

                    <button 
                      onClick={handleScan}
                      className="w-full py-3 rounded-xl border border-white/20 bg-white/5 flex items-center justify-center gap-2 text-white font-medium hover:bg-white/10 transition-colors">
                      <QrCode size={18} />
                      <span>Scan QR Code</span>
                    </button>
                  </motion.div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sponsor Quick Event Info Card */}
      {user.role === 'sponsor' && (
        <div className="px-4 pt-3 pb-1">
          <button
            onClick={() => onNavigate('sponsor-event')}
            className="w-full rounded-2xl p-4 text-left active:scale-[0.98] transition-all relative overflow-hidden"
            style={{ background: 'linear-gradient(135deg,#312e81,#4f46e5)', boxShadow: '0 4px 24px rgba(79,70,229,0.2)' }}
          >
            <div className="absolute -top-8 -right-8 w-28 h-28 rounded-full opacity-15"
              style={{ background: 'radial-gradient(circle, #c4b5fd, transparent 70%)' }} />
            <div className="relative z-10 flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(255,255,255,0.12)' }}>
                <Building2 style={{ width: 20, height: 20, color: '#c4b5fd' }} />
              </div>
              <div className="flex-1 min-w-0">
                <p style={{ color: '#fff', fontSize: 14, fontWeight: 800 }}>{eventConfig.name}</p>
                <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11 }}>
                  {eventConfig.dates} · {eventConfig.location}
                </p>
              </div>
              <ChevronRight style={{ width: 18, height: 18, color: 'rgba(255,255,255,0.4)' }} />
            </div>
          </button>
        </div>
      )}

      {/* Main Social Feed */}
      <SocialFeed onNavigate={onNavigate} />

      {/* Mock Scanner Overlay */}
      <AnimatePresence>
        {showScanner && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center"
          >
             <div className="absolute top-0 left-0 w-full p-6 flex justify-end">
               <button onClick={() => setShowScanner(false)} className="p-2 rounded-full bg-black/50 text-white">
                 <X size={24} />
               </button>
             </div>
             <div className="w-64 h-64 border-2 border-white/50 rounded-3xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-green-500 shadow-[0_0_20px_rgba(34,197,94,0.8)] animate-[scan_2s_linear_infinite]" />
                <div className="w-full h-full bg-white/5 animate-pulse" />
             </div>
             <p className="text-white/70 mt-8 text-sm font-medium">Align QR code within the frame</p>
          </motion.div>
        )}
      </AnimatePresence>

      <SwitchEventModal isOpen={switchModalOpen} onClose={() => setSwitchModalOpen(false)} />
      
      <style>{`
        @keyframes scan {
          0% { top: 0; }
          100% { top: 100%; }
        }
      `}</style>
    </div>
  );
};