import React, { useEffect, useState } from 'react';
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { useApp } from '@/app/context/AppContext';
import { useTheme } from '@/app/context/ThemeContext';
import { getMyBadgeApi, type BadgeData } from '@/app/api/badgeClient';

export const MyBadgePage: React.FC = () => {
  const { user, eventConfig } = useApp();
  const { isDark } = useTheme();

  const [badge, setBadge] = useState<BadgeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBadge = async () => {
    setLoading(true);
    setError(null);
    const res = await getMyBadgeApi();
    if (res.success && res.data) {
      setBadge(res.data);
    } else {
      setError(res.error ?? 'Could not load badge');
    }
    setLoading(false);
  };

  useEffect(() => { fetchBadge(); }, []);

  const initials = (badge?.name ?? user?.name ?? '')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const eventBg = eventConfig?.backgroundURL;
  const eventName = badge?.event_name ?? eventConfig?.name ?? 'Event';

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center pt-20 pb-28 px-6"
      style={{
        background: eventBg
          ? `linear-gradient(160deg,rgba(10,5,30,0.92) 0%,rgba(30,10,60,0.85) 100%),url(${eventBg}) center/cover no-repeat fixed`
          : isDark
            ? 'linear-gradient(160deg,#0c0918 0%,#130d2e 50%,#0a0715 100%)'
            : 'linear-gradient(160deg,#1e1b4b 0%,#312e81 50%,#1e1b4b 100%)',
      }}
    >

      {/* ── Loading ─────────────────────────────────────────────────────── */}
      {loading && (
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{ background: 'rgba(124,58,237,0.2)', border: '1px solid rgba(124,58,237,0.3)' }}>
            <Loader2 size={28} color="#a78bfa" className="animate-spin" />
          </div>
          <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13 }}>Loading your badge…</p>
        </div>
      )}

      {/* ── Error ───────────────────────────────────────────────────────── */}
      {!loading && error && (
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <AlertCircle size={28} color="#f87171" />
          </div>
          <p style={{ color: '#f87171', fontSize: 14, fontWeight: 600 }}>Badge unavailable</p>
          <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12 }}>{error}</p>
          <button
            onClick={fetchBadge}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl transition-all active:scale-[0.97]"
            style={{ background: 'rgba(124,58,237,0.25)', border: '1px solid rgba(124,58,237,0.3)', color: '#c4b5fd', fontSize: 13, fontWeight: 600 }}>
            <RefreshCw size={14} />
            Try Again
          </button>
        </div>
      )}

      {/* ── Badge Card ──────────────────────────────────────────────────── */}
      {!loading && badge && (
        <div
          className="w-full max-w-[320px]"
          style={{
            boxShadow: '0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.08)',
            borderRadius: 28,
          }}
        >
          {/* ─ Event banner ─ */}
          <div
            className="relative flex flex-col px-5 overflow-hidden"
            style={{
              height: 160,
              borderRadius: '28px 28px 0 0',
              background: eventBg
                ? `url(${eventBg}) center/cover no-repeat`
                : 'linear-gradient(135deg,#7c3aed 0%,#4f46e5 55%,#6366f1 100%)',
            }}
          >
            {/* dark gradient overlay so text is always readable */}
            <div className="absolute inset-0"
              style={{ background: 'linear-gradient(to bottom, rgba(10,5,30,0.25) 0%, rgba(10,5,30,0.80) 100%)' }} />

            {/* lanyard hole */}
            <div className="absolute top-3.5 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full z-10"
              style={{ background: 'rgba(0,0,0,0.5)', border: '2px solid rgba(255,255,255,0.3)' }} />

            {/* Event label + name — pinned to bottom */}
            <div className="relative z-10 mt-auto pb-14 pl-1">
              <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.18em', marginBottom: 3 }}>
                Event Pass
              </p>
              <p style={{ color: '#fff', fontSize: 15, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.25 }}>
                {eventName}
              </p>
            </div>
          </div>

          {/* ─ White body ─ (no overflow-hidden so avatar can float freely) */}
          <div
            className="bg-white px-6 pb-6 flex flex-col items-center"
            style={{ borderRadius: '0 0 28px 28px', paddingTop: 0 }}
          >
            {/* Avatar — floats above the white section into the banner */}
            <div
              className="w-20 h-20 rounded-2xl overflow-hidden flex-shrink-0"
              style={{
                border: '3px solid #ffffff',
                boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
                marginTop: -40,
                marginBottom: 10,
              }}
            >
              {badge.avatar ? (
                <img src={badge.avatar} alt={badge.name} className="w-full h-full object-cover" />
              ) : (
                <div
                  className="w-full h-full flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg,#7c3aed 0%,#4f46e5 100%)' }}
                >
                  <span style={{ color: '#fff', fontSize: 28, fontWeight: 800 }}>{initials}</span>
                </div>
              )}
            </div>

            {/* Name */}
            <p style={{ color: '#0f0f1a', fontSize: 20, fontWeight: 800, letterSpacing: '-0.03em', textAlign: 'center', lineHeight: 1.1, marginBottom: 4 }}>
              {badge.name}
            </p>

            {/* Title + Company */}
            {(badge.title || badge.company) && (
              <div className="flex flex-col items-center gap-0.5 mb-5">
                {badge.title && (
                  <p style={{ color: '#7c3aed', fontSize: 12, fontWeight: 700, textAlign: 'center' }}>
                    {badge.title}
                  </p>
                )}
                {badge.company && (
                  <p style={{ color: '#6b7280', fontSize: 11, textAlign: 'center' }}>
                    {badge.company}
                  </p>
                )}
              </div>
            )}

            {/* Divider */}
            <div className="w-full h-px mb-5" style={{ background: 'linear-gradient(90deg,transparent,rgba(124,58,237,0.15),transparent)' }} />

            {/* QR Code */}
            <div
              className="rounded-2xl p-4 flex items-center justify-center mb-5"
              style={{
                background: '#f5f3ff',
                border: '1px solid rgba(124,58,237,0.12)',
              }}
            >
              <QRCodeCanvas
                value={badge.qr_content}
                size={180}
                bgColor="transparent"
                fgColor="#1a0540"
                level="M"
                marginSize={0}
              />
            </div>

            {/* Badge code */}
            {badge.badge_code && (
              <div
                className="px-5 py-2 rounded-full"
                style={{
                  background: 'rgba(124,58,237,0.08)',
                  border: '1px solid rgba(124,58,237,0.15)',
                }}
              >
                <span style={{ color: '#7c3aed', fontSize: 14, fontWeight: 700, fontFamily: 'monospace', letterSpacing: '0.12em' }}>
                  {badge.badge_code}
                </span>
              </div>
            )}

            {/* Scan hint */}
            <p style={{ color: '#9ca3af', fontSize: 10, marginTop: 10, textAlign: 'center', letterSpacing: '0.02em' }}>
              Scan to connect at the event
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
