import React, { useState, useRef, useCallback } from 'react';
import { QrCode, X, Share2, Download } from 'lucide-react';
import { useApp } from '@/app/context/AppContext';
import { useTheme } from '@/app/context/ThemeContext';
import { motion, AnimatePresence } from 'motion/react';
import { QRCodeCanvas } from 'qrcode.react';

export const MyQrCodeButton: React.FC = () => {
  const { user, eventConfig, showToast } = useApp();
  const { t, isDark } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const qrRef = useRef<HTMLDivElement>(null);

  const qrPayload = user ? JSON.stringify({ id: user.id, event: eventConfig?.code || '' }) : '';

  const handleDownload = useCallback(() => {
    const canvas = qrRef.current?.querySelector('canvas');
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = 'my-qr-code.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
    showToast('QR code saved!');
  }, [showToast]);

  const handleShare = useCallback(async () => {
    const canvas = qrRef.current?.querySelector('canvas');
    if (!canvas) return;

    if (navigator.share && navigator.canShare) {
      try {
        canvas.toBlob(async (blob) => {
          if (!blob) return;
          const file = new File([blob], 'my-qr-code.png', { type: 'image/png' });
          await navigator.share({ title: 'My Event QR Code', files: [file] });
        });
      } catch {
        fallbackCopy();
      }
    } else {
      fallbackCopy();
    }
  }, []);

  const fallbackCopy = () => {
    if (user) {
      navigator.clipboard?.writeText(qrPayload);
      showToast('QR data copied to clipboard!');
    }
  };

  if (!user) return null;

  return (
    <>
      <div
        className="fixed bottom-0 left-0 right-0 z-50 pointer-events-none"
        style={{ maxWidth: 430, margin: '0 auto' }}
      >
        <button
          onClick={() => setIsOpen(true)}
          className="pointer-events-auto absolute flex items-center justify-center rounded-full shadow-lg active:scale-95 transition-transform"
          style={{
            bottom: 78,
            right: 16,
            width: 52,
            height: 52,
            background: 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)',
            boxShadow: '0 4px 20px rgba(124, 58, 237, 0.45)',
          }}
        >
          <QrCode size={22} color="#fff" />
        </button>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[100] flex items-center justify-center px-6"
            style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
            onClick={() => setIsOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.85, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.85, y: 30 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="w-full max-w-xs rounded-3xl overflow-hidden"
              style={{
                background: isDark
                  ? 'linear-gradient(180deg, #1a1a2e 0%, #16162a 100%)'
                  : 'linear-gradient(180deg, #ffffff 0%, #f5f3ff 100%)',
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
                boxShadow: '0 25px 60px rgba(0,0,0,0.4)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="relative px-6 pt-5 pb-4">
                <button
                  onClick={() => setIsOpen(false)}
                  className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center transition-colors"
                  style={{ background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }}
                >
                  <X size={16} color={t.textSec} />
                </button>

                <div className="text-center mb-5">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-3"
                    style={{ background: 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)' }}
                  >
                    <QrCode size={20} color="#fff" />
                  </div>
                  <h2 style={{ color: t.text, fontSize: 18, fontWeight: 700 }}>My QR Code</h2>
                  <p style={{ color: t.textSec, fontSize: 12, marginTop: 4 }}>
                    Show this to partners for a quick scan
                  </p>
                </div>

                <div
                  ref={qrRef}
                  className="rounded-2xl p-5 flex items-center justify-center mx-auto"
                  style={{
                    background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(124,58,237,0.04)',
                    border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(124,58,237,0.1)'}`,
                  }}
                >
                  <div className="relative flex items-center justify-center">
                    <QRCodeCanvas
                      value={qrPayload}
                      size={200}
                      bgColor="transparent"
                      fgColor={isDark ? '#ffffff' : '#1a1a2e'}
                      level="M"
                      marginSize={0}
                      imageSettings={{
                        src: '',
                        height: 0,
                        width: 0,
                        excavate: false,
                      }}
                    />
                    <div
                      className="absolute w-10 h-10 rounded-lg flex items-center justify-center"
                      style={{
                        background: 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)',
                        boxShadow: '0 2px 8px rgba(124,58,237,0.4)',
                      }}
                    >
                      <span className="text-white font-bold text-xs">
                        {user.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="text-center mt-4 mb-2">
                  <p style={{ color: t.text, fontSize: 15, fontWeight: 700 }}>{user.name}</p>
                  <p style={{ color: t.textSec, fontSize: 12, marginTop: 2 }}>
                    {user.title} · {user.company}
                  </p>
                  {eventConfig?.name && (
                    <div
                      className="inline-flex items-center gap-1.5 mt-3 px-3 py-1 rounded-full"
                      style={{
                        background: isDark ? 'rgba(124,58,237,0.15)' : 'rgba(124,58,237,0.08)',
                        color: '#7c3aed',
                        fontSize: 11,
                        fontWeight: 600,
                      }}
                    >
                      {eventConfig.name}
                    </div>
                  )}
                </div>
              </div>

              <div
                className="px-6 py-4 flex gap-3"
                style={{ borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}` }}
              >
                <button
                  onClick={handleDownload}
                  className="flex-1 py-2.5 rounded-xl flex items-center justify-center gap-2 transition-colors active:scale-[0.97]"
                  style={{
                    background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                    color: t.text,
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                >
                  <Download size={15} />
                  Save
                </button>
                <button
                  onClick={handleShare}
                  className="flex-1 py-2.5 rounded-xl flex items-center justify-center gap-2 transition-colors active:scale-[0.97]"
                  style={{
                    background: 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)',
                    color: '#fff',
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                >
                  <Share2 size={15} />
                  Share
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
