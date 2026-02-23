import React, { useState, useEffect } from 'react';
import { QrCode, Type, User, Save, X, Search, ScanLine } from 'lucide-react';
import { useTheme } from '@/app/context/ThemeContext';
import { useApp } from '@/app/context/AppContext';
import { motion, AnimatePresence } from 'motion/react';

export const SponsorScannerPage: React.FC = () => {
  const { t } = useTheme();
  const { saveLead } = useApp();
  
  const [mode, setMode] = useState<'scan' | 'manual'>('scan');
  const [manualCode, setManualCode] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  
  // Scanned Data State
  const [scannedData, setScannedData] = useState<{ code: string; name: string; title: string; company: string } | null>(null);
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Simulate scanning
  useEffect(() => {
    let timeout: any;
    if (mode === 'scan' && !scannedData) {
      setIsScanning(true);
      // Simulate finding a code after 3 seconds
      timeout = setTimeout(() => {
        handleCodeDetected('ATT-8492');
      }, 3000);
    } else {
      setIsScanning(false);
    }
    return () => clearTimeout(timeout);
  }, [mode, scannedData]);

  const handleCodeDetected = (code: string) => {
    setIsScanning(false);
    // Mock user lookup
    setScannedData({
      code,
      name: 'Sarah Chen',
      title: 'Product Designer',
      company: 'Stripe'
    });
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualCode.length < 3) return;
    handleCodeDetected(manualCode.toUpperCase());
  };

  const handleSave = () => {
    if (!scannedData) return;
    setIsSaving(true);
    setTimeout(() => {
      saveLead({
        code: scannedData.code,
        name: scannedData.name,
        company: scannedData.company,
        title: scannedData.title,
        notes
      });
      setIsSaving(false);
      resetScanner();
    }, 800);
  };

  const resetScanner = () => {
    setScannedData(null);
    setNotes('');
    setManualCode('');
    setMode('scan');
  };

  return (
    <div className="min-h-screen pb-24 relative flex flex-col" style={{ background: t.bgPage }}>
      {/* Header */}
      <div className="sticky top-0 z-30 px-6 py-4 backdrop-blur-md border-b flex items-center justify-between"
         style={{ background: 'rgba(7,7,15,0.85)', borderColor: t.border }}>
         <h1 className="text-lg font-bold" style={{ color: t.text }}>Lead Retrieval</h1>
         <div className="flex bg-gray-800/50 rounded-lg p-1 border border-white/10">
           <button 
             onClick={() => setMode('scan')}
             className={`p-2 rounded-md transition-all ${mode === 'scan' ? 'bg-violet-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}>
             <QrCode size={18} />
           </button>
           <button 
             onClick={() => setMode('manual')}
             className={`p-2 rounded-md transition-all ${mode === 'manual' ? 'bg-violet-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}>
             <Type size={18} />
           </button>
         </div>
      </div>

      <div className="flex-1 flex flex-col relative overflow-hidden">
        {scannedData ? (
          // ─── LEAD DETAILS FORM ───────────────────────────────────────────
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex-1 p-6 flex flex-col"
          >
            <div className="flex items-start justify-between mb-6">
              <h2 className="text-2xl font-bold" style={{ color: t.text }}>Lead Details</h2>
              <button onClick={resetScanner} className="p-2 rounded-full hover:bg-white/5" style={{ color: t.textMuted }}>
                <X size={20} />
              </button>
            </div>

            <div className="rounded-2xl p-5 mb-6" style={{ background: t.surface, border: `1px solid ${t.border}` }}>
               <div className="flex items-center gap-4 mb-4">
                 <div className="w-16 h-16 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-2xl font-bold text-white">
                   {scannedData.name.charAt(0)}
                 </div>
                 <div>
                   <h3 className="text-lg font-bold" style={{ color: t.text }}>{scannedData.name}</h3>
                   <p className="text-sm font-medium" style={{ color: t.textSec }}>{scannedData.title}</p>
                   <p className="text-sm" style={{ color: t.textMuted }}>{scannedData.company}</p>
                 </div>
               </div>
               <div className="px-3 py-1.5 rounded bg-white/5 inline-block text-xs font-mono tracking-wider" style={{ color: t.textSec }}>
                 ID: {scannedData.code}
               </div>
            </div>

            <div className="flex-1">
              <label className="block text-xs font-bold uppercase tracking-wider mb-2" style={{ color: t.textSec }}>Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add conversation notes, interests, or follow-up items..."
                className="w-full h-40 p-4 rounded-xl resize-none outline-none transition-all focus:ring-2 ring-violet-500/50"
                style={{ 
                  background: t.surface, 
                  border: `1px solid ${t.border}`, 
                  color: t.text 
                }}
              />
            </div>

            <button
              onClick={handleSave}
              disabled={isSaving}
              className="w-full py-4 rounded-xl font-bold text-white shadow-lg mt-6 flex items-center justify-center gap-2 relative overflow-hidden"
              style={{ background: t.accent }}
            >
              {isSaving ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Saving Lead...</span>
                </>
              ) : (
                <>
                  <Save size={20} />
                  <span>Save Lead</span>
                </>
              )}
            </button>
          </motion.div>
        ) : (
          // ─── SCANNER / INPUT VIEW ────────────────────────────────────────
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
             <AnimatePresence mode="wait">
               {mode === 'scan' ? (
                 <motion.div 
                   key="scan"
                   initial={{ opacity: 0, scale: 0.9 }}
                   animate={{ opacity: 1, scale: 1 }}
                   exit={{ opacity: 0, scale: 0.9 }}
                   className="w-full max-w-xs aspect-square rounded-3xl border-2 border-white/20 relative overflow-hidden mb-8"
                 >
                    {/* Simulated Camera Feed */}
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <p className="text-white/40 text-xs font-mono">CAMERA FEED MOCK</p>
                    </div>
                    
                    {/* Scanner Overlay */}
                    <div className="absolute inset-0">
                      <div className="absolute top-0 left-0 w-full h-1 bg-green-500 shadow-[0_0_20px_rgba(34,197,94,0.8)] animate-[scan_2s_linear_infinite]" />
                      <div className="absolute inset-0 border-[40px] border-black/60" />
                      <div className="absolute inset-8 border-2 border-white/30 rounded-xl" />
                      {/* Corner markers */}
                      <div className="absolute top-8 left-8 w-6 h-6 border-t-2 border-l-2 border-green-400 rounded-tl-lg" />
                      <div className="absolute top-8 right-8 w-6 h-6 border-t-2 border-r-2 border-green-400 rounded-tr-lg" />
                      <div className="absolute bottom-8 left-8 w-6 h-6 border-b-2 border-l-2 border-green-400 rounded-bl-lg" />
                      <div className="absolute bottom-8 right-8 w-6 h-6 border-b-2 border-r-2 border-green-400 rounded-br-lg" />
                    </div>
                 </motion.div>
               ) : (
                 <motion.div 
                   key="manual"
                   initial={{ opacity: 0, y: 20 }}
                   animate={{ opacity: 1, y: 0 }}
                   exit={{ opacity: 0, y: -20 }}
                   className="w-full max-w-sm"
                 >
                   <div className="w-20 h-20 rounded-2xl bg-violet-500/10 flex items-center justify-center mx-auto mb-6 border border-violet-500/20">
                     <Type size={32} className="text-violet-400" />
                   </div>
                   <h2 className="text-xl font-bold mb-2" style={{ color: t.text }}>Enter Badge Code</h2>
                   <p className="text-sm mb-8" style={{ color: t.textSec }}>
                     Type the 6-digit alphanumeric code found on the attendee's badge.
                   </p>
                   <form onSubmit={handleManualSubmit} className="space-y-4">
                     <input
                       type="text"
                       placeholder="e.g. A84-9X2"
                       value={manualCode}
                       onChange={(e) => setManualCode(e.target.value)}
                       className="w-full h-14 text-center text-xl font-mono tracking-widest uppercase rounded-xl border bg-transparent focus:ring-2 ring-violet-500 outline-none transition-all"
                       style={{ 
                         borderColor: t.border, 
                         color: t.text,
                         background: t.inputBg 
                       }}
                       autoFocus
                     />
                     <button
                       type="submit"
                       disabled={manualCode.length < 3}
                       className="w-full py-4 rounded-xl font-bold text-white shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                       style={{ background: t.accent }}
                     >
                       Find Attendee
                     </button>
                   </form>
                 </motion.div>
               )}
             </AnimatePresence>

             {mode === 'scan' && (
               <p className="text-sm font-medium animate-pulse" style={{ color: t.textSec }}>
                 Scanning for attendee badge...
               </p>
             )}
          </div>
        )}
      </div>

      <style>{`
        @keyframes scan {
          0% { top: 0; }
          100% { top: 100%; }
        }
      `}</style>
    </div>
  );
};
