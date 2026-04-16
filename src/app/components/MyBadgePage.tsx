import React, { useRef, useCallback } from 'react';
import { QrCode, Download, Share2 } from 'lucide-react';
import { useApp } from '@/app/context/AppContext';
import { useTheme } from '@/app/context/ThemeContext';
import { QRCodeCanvas } from 'qrcode.react';

export const MyBadgePage: React.FC = () => {
  const { user, eventConfig, showToast } = useApp();
  const { t, isDark } = useTheme();
  const qrRef = useRef<HTMLDivElement>(null);

  if (!user) return null;

  const qrPayload = JSON.stringify({
    id: user.id,
    badge_code: user.badgeCode ?? '',
    event: eventConfig?.code ?? '',
  });

  const initials = user.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const handleDownload = useCallback(() => {
    const canvas = qrRef.current?.querySelector('canvas');
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = 'my-badge-qr.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
    showToast('Badge saved!');
  }, [showToast]);

  const handleShare = useCallback(async () => {
    const canvas = qrRef.current?.querySelector('canvas');
    if (!canvas) return;
    if (navigator.share && navigator.canShare) {
      try {
        canvas.toBlob(async (blob) => {
          if (!blob) return;
          const file = new File([blob], 'my-badge-qr.png', { type: 'image/png' });
          await navigator.share({ title: 'My Event Badge', files: [file] });
        });
      } catch {
        navigator.clipboard?.writeText(qrPayload);
        showToast('Badge data copied!');
      }
    } else {
      navigator.clipboard?.writeText(qrPayload);
      showToast('Badge data copied!');
    }
  }, [qrPayload, showToast]);

  return (
    <div
      className="min-h-screen pb-24 flex flex-col"
      style={{ background: t.bgPage }}
    >
      {/* ── Page Header ─────────────────────────────────────────────── */}
      <div
        className="sticky top-0 z-30 px-5 py-3.5 backdrop-blur-md border-b flex items-center gap-3"
        style={{
          background: isDark ? 'rgba(7,7,15,0.85)' : 'rgba(255,255,255,0.9)',
          borderColor: t.border,
        }}
      >
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)' }}
        >
          <QrCode size={16} color="#fff" />
        </div>
        <div>
          <h1 style={{ color: t.text, fontSize: 17, fontWeight: 800, lineHeight: 1 }}>
            My Badge
          </h1>
          <p style={{ color: t.textMuted, fontSize: 11, marginTop: 2 }}>
            Show this QR to be scanned
          </p>
        </div>
      </div>

      {/* ── Badge Card ───────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-8">
        <div
          className="w-full max-w-xs rounded-3xl overflow-hidden"
          style={{
            background: isDark
              ? 'linear-gradient(180deg, #1a1a2e 0%, #16162a 100%)'
              : 'linear-gradient(180deg, #ffffff 0%, #f5f3ff 100%)',
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(124,58,237,0.15)'}`,
            boxShadow: isDark
              ? '0 24px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(124,58,237,0.1)'
              : '0 24px 60px rgba(124,58,237,0.12)',
          }}
        >
          {/* Card top gradient bar */}
          <div
            className="h-1.5 w-full"
            style={{ background: 'linear-gradient(90deg, #7c3aed, #4f46e5, #ec4899)' }}
          />

          <div className="px-6 pt-6 pb-5">
            {/* Avatar + Name */}
            <div className="flex items-center gap-4 mb-6">
              <div
                className="w-14 h-14 rounded-2xl overflow-hidden flex-shrink-0"
                style={{
                  border: `2px solid ${isDark ? 'rgba(124,58,237,0.3)' : 'rgba(124,58,237,0.2)'}`,
                }}
              >
                {user.avatar ? (
                  <img
                    src={user.avatar}
                    alt={user.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div
                    className="w-full h-full flex items-center justify-center"
                    style={{ background: 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)' }}
                  >
                    <span className="text-white font-bold text-lg">{initials}</span>
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p style={{ color: t.text, fontSize: 16, fontWeight: 800, lineHeight: 1.2 }}>
                  {user.name}
                </p>
                {user.title && (
                  <p style={{ color: t.textSec, fontSize: 12, marginTop: 3, lineHeight: 1.3 }}>
                    {user.title}
                  </p>
                )}
                {user.company && (
                  <p style={{ color: t.textMuted, fontSize: 11, marginTop: 2 }}>
                    {user.company}
                  </p>
                )}
              </div>
            </div>

            {/* QR Code */}
            <div
              ref={qrRef}
              className="rounded-2xl p-5 flex items-center justify-center mb-5"
              style={{
                background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(124,58,237,0.04)',
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(124,58,237,0.12)'}`,
              }}
            >
              <div className="relative flex items-center justify-center">
                <QRCodeCanvas
                  value={qrPayload}
                  size={190}
                  bgColor="transparent"
                  fgColor={isDark ? '#ffffff' : '#1a1a2e'}
                  level="M"
                  marginSize={0}
                />
                {/* Centre logo overlay */}
                <div
                  className="absolute w-10 h-10 rounded-xl flex items-center justify-center shadow-lg"
                  style={{
                    background: 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)',
                    boxShadow: '0 2px 10px rgba(124,58,237,0.5)',
                  }}
                >
                  <span className="text-white font-bold text-xs">{initials}</span>
                </div>
              </div>
            </div>

            {/* Badge code pill */}
            {user.badgeCode && (
              <div className="flex items-center justify-center mb-1">
                <div
                  className="px-4 py-1.5 rounded-full"
                  style={{
                    background: isDark ? 'rgba(124,58,237,0.15)' : 'rgba(124,58,237,0.08)',
                    border: `1px solid ${isDark ? 'rgba(124,58,237,0.25)' : 'rgba(124,58,237,0.15)'}`,
                  }}
                >
                  <span
                    style={{
                      color: '#7c3aed',
                      fontSize: 13,
                      fontWeight: 700,
                      fontFamily: 'monospace',
                      letterSpacing: '0.12em',
                    }}
                  >
                    {user.badgeCode}
                  </span>
                </div>
              </div>
            )}

            {/* Event name */}
            {eventConfig?.name && (
              <p
                className="text-center"
                style={{ color: t.textMuted, fontSize: 11, marginTop: 6 }}
              >
                {eventConfig.name}
              </p>
            )}
          </div>

          {/* Action buttons */}
          <div
            className="px-6 py-4 flex gap-3"
            style={{
              borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
            }}
          >
            <button
              onClick={handleDownload}
              className="flex-1 py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.97]"
              style={{
                background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                color: t.text,
                fontSize: 13,
                fontWeight: 600,
                border: `1px solid ${t.border}`,
              }}
            >
              <Download size={15} />
              Save
            </button>
            <button
              onClick={handleShare}
              className="flex-1 py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.97]"
              style={{
                background: 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)',
                color: '#fff',
                fontSize: 13,
                fontWeight: 600,
                boxShadow: '0 4px 16px rgba(124,58,237,0.35)',
              }}
            >
              <Share2 size={15} />
              Share
            </button>
          </div>
        </div>

        {/* Help text */}
        <p
          className="text-center mt-6 px-8"
          style={{ color: t.textMuted, fontSize: 12, lineHeight: 1.6 }}
        >
          Let others scan this QR code to connect with you at the event.
        </p>
      </div>
    </div>
  );
};
