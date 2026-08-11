import React, { useEffect, useRef, useState } from 'react';
import QrScanner from 'qr-scanner';
import { Camera, AlertTriangle, Type } from 'lucide-react';
import { useTheme } from '@/app/context/ThemeContext';

type ScannerState = 'requesting' | 'streaming' | 'denied' | 'error';

interface CameraScannerProps {
  onCodeDetected: (code: string) => void;
  onSwitchToManual: () => void;
}

// Half-size of the clear scan zone in pixels — the QR code needs to
// fit inside this square for the scanner to detect it reliably.
const SCAN_HALF = 100; // → 200 × 200 px square

export const CameraScanner: React.FC<CameraScannerProps> = ({
  onCodeDetected,
  onSwitchToManual,
}) => {
  const { t } = useTheme();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const scannerRef = useRef<QrScanner | null>(null);
  const detectedRef = useRef(false);
  const onCodeRef = useRef(onCodeDetected);
  const [state, setState] = useState<ScannerState>('requesting');
  const [errorMsg, setErrorMsg] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => { onCodeRef.current = onCodeDetected; }, [onCodeDetected]);

  useEffect(() => {
    let cancelled = false;
    detectedRef.current = false;
    setState('requesting');
    setErrorMsg('');

    // Brief delay so the <video> element is fully committed to the DOM
    // and has non-zero layout dimensions before qr-scanner reads them
    // for scan-region calculation.
    // eslint-disable-next-line local/no-raw-timers -- UI-only: waits for <video> layout before QR scanner init, no auth gate needed
    const tid = window.setTimeout(async () => {
      if (cancelled || !videoRef.current) return;

      try {
        const scanner = new QrScanner(
          videoRef.current,
          (result) => {
            if (detectedRef.current) return;
            // result is QrScanner.ScanResult when returnDetailedScanResult:true
            const code = (
              typeof result === 'string' ? result : (result as { data?: string }).data ?? ''
            ).trim();
            if (!code) return;
            detectedRef.current = true;
            try { scanner.stop(); } catch { /* noop */ }
            onCodeRef.current(code);
          },
          {
            preferredCamera: 'environment',
            highlightScanRegion: false,
            highlightCodeOutline: false,
            maxScansPerSecond: 8,
            returnDetailedScanResult: true,
          },
        );
        scannerRef.current = scanner;
        await scanner.start();
        if (!cancelled) setState('streaming');
      } catch (err: unknown) {
        if (cancelled) return;
        const name = (err as { name?: string })?.name ?? '';
        const msg  = (err as { message?: string })?.message ?? String(err);
        if (
          name === 'NotAllowedError' ||
          /permission/i.test(msg) ||
          /denied/i.test(msg) ||
          /not allowed/i.test(msg)
        ) {
          setState('denied');
          setErrorMsg('Camera access was blocked. Allow camera permission then tap Retry.');
        } else if (
          name === 'NotFoundError' ||
          /no.*camera/i.test(msg) ||
          /could not start/i.test(msg) ||
          /constraint/i.test(msg)
        ) {
          setState('error');
          setErrorMsg('No camera found. Use the Manual Entry option below.');
        } else {
          setState('error');
          setErrorMsg(msg || 'Camera could not start. Try Manual Entry.');
        }
      }
    }, 80);

    return () => {
      cancelled = true;
      clearTimeout(tid);
      const s = scannerRef.current;
      scannerRef.current = null;
      if (s) {
        try { s.stop(); } catch { /* noop */ }
        try { s.destroy(); } catch { /* noop */ }
      }
    };
  }, [attempt]);

  return (
    // Fills the parent container — parent is responsible for its own size.
    // transform:translateZ(0) forces GPU compositing on iOS/Android WebKit,
    // which is required for camera streams to render correctly (without it
    // the video layer can appear as a solid black rectangle).
    <div
      className="absolute inset-0"
      style={{
        background: '#000',
        transform: 'translateZ(0)',
        WebkitTransform: 'translateZ(0)',
        overflow: 'hidden',
      }}
    >
      {/* Keyframe for the scan-line animation scoped inside this element */}
      <style>{`
        @keyframes cxo-scan-line {
          0%   { transform: translateX(-50%) translateY(0); opacity: 1; }
          90%  { opacity: 1; }
          100% { transform: translateX(-50%) translateY(${SCAN_HALF * 2}px); opacity: 0; }
        }
        @keyframes cxo-pulse-ring {
          0%   { transform: scale(1);   opacity: 0.6; }
          100% { transform: scale(1.8); opacity: 0; }
        }
      `}</style>

      {/*
        The <video> element must NEVER have its display, opacity, or
        visibility controlled by React after qr-scanner has been attached —
        the library overwrites those styles internally to prevent Safari
        from pausing playback. We let it sit here permanently and use
        z-indexed overlays to show UI states on top of it.
      */}
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover"
        playsInline
        autoPlay
        muted
        style={{ transform: 'translateZ(0)', WebkitTransform: 'translateZ(0)' }}
      />

      {/* ── Requesting camera ─────────────────────────────────────── */}
      {state === 'requesting' && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center gap-4"
          style={{ zIndex: 10, background: 'rgba(7,7,20,0.92)' }}
        >
          {/* Pulsing ring animation */}
          <div className="relative flex items-center justify-center" style={{ width: 80, height: 80 }}>
            <div
              className="absolute w-20 h-20 rounded-full"
              style={{ background: 'rgba(124,58,237,0.35)', animation: 'cxo-pulse-ring 1.6s ease-out infinite' }}
            />
            <div
              className="absolute w-20 h-20 rounded-full"
              style={{ background: 'rgba(124,58,237,0.2)', animation: 'cxo-pulse-ring 1.6s ease-out 0.5s infinite' }}
            />
            <div
              className="relative w-14 h-14 rounded-full flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg,rgba(124,58,237,0.6),rgba(99,102,241,0.6))', border: '1px solid rgba(167,139,250,0.5)' }}
            >
              <Camera size={24} color="#c4b5fd" />
            </div>
          </div>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: 600, letterSpacing: '0.02em' }}>
            Starting camera…
          </p>
        </div>
      )}

      {/* ── Permission denied / error ─────────────────────────────── */}
      {(state === 'denied' || state === 'error') && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-8 text-center"
          style={{ zIndex: 10, background: 'rgba(7,7,20,0.92)' }}
        >
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.35)' }}
          >
            <AlertTriangle size={28} color="#fbbf24" />
          </div>
          <div>
            <p style={{ color: '#fff', fontSize: 15, fontWeight: 700, marginBottom: 6 }}>
              {state === 'denied' ? 'Camera access required' : 'Camera unavailable'}
            </p>
            <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12, lineHeight: 1.6 }}>
              {errorMsg}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setAttempt(a => a + 1)}
              className="px-5 py-2.5 rounded-xl transition-transform active:scale-95"
              style={{ background: t.accent, color: '#fff', fontSize: 13, fontWeight: 700 }}
            >
              Retry
            </button>
            <button
              onClick={onSwitchToManual}
              className="px-4 py-2.5 rounded-xl flex items-center gap-1.5 transition-transform active:scale-95"
              style={{
                background: 'rgba(255,255,255,0.1)',
                color: '#fff',
                border: '1px solid rgba(255,255,255,0.18)',
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              <Type size={13} /> Manual
            </button>
          </div>
        </div>
      )}

      {/* ── Live scanning overlay ─────────────────────────────────── */}
      {state === 'streaming' && (
        <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 10 }}>
          {/*
            Vignette: four dark rectangles surround the transparent scan zone.
            50% ± SCAN_HALF positions the edges of the clear square.
          */}
          {/* Top dark strip */}
          <div
            className="absolute inset-x-0 top-0"
            style={{ height: `calc(50% - ${SCAN_HALF}px)`, background: 'rgba(0,0,0,0.58)' }}
          />
          {/* Bottom dark strip */}
          <div
            className="absolute inset-x-0 bottom-0"
            style={{ top: `calc(50% + ${SCAN_HALF}px)`, background: 'rgba(0,0,0,0.58)' }}
          />
          {/* Left dark strip */}
          <div
            className="absolute left-0"
            style={{
              top: `calc(50% - ${SCAN_HALF}px)`,
              bottom: `calc(50% - ${SCAN_HALF}px)`,
              width: `calc(50% - ${SCAN_HALF}px)`,
              background: 'rgba(0,0,0,0.58)',
            }}
          />
          {/* Right dark strip */}
          <div
            className="absolute right-0"
            style={{
              top: `calc(50% - ${SCAN_HALF}px)`,
              bottom: `calc(50% - ${SCAN_HALF}px)`,
              left: `calc(50% + ${SCAN_HALF}px)`,
              background: 'rgba(0,0,0,0.58)',
            }}
          />

          {/* Scan zone outline */}
          <div
            className="absolute rounded-2xl"
            style={{
              width: SCAN_HALF * 2,
              height: SCAN_HALF * 2,
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              border: '1px solid rgba(255,255,255,0.22)',
            }}
          />

          {/* Corner brackets — top-left */}
          <div className="absolute" style={{ top: `calc(50% - ${SCAN_HALF}px)`, left: `calc(50% - ${SCAN_HALF}px)`, width: 22, height: 22, borderTop: '2.5px solid #4ade80', borderLeft: '2.5px solid #4ade80', borderRadius: '6px 0 0 0' }} />
          {/* top-right */}
          <div className="absolute" style={{ top: `calc(50% - ${SCAN_HALF}px)`, left: `calc(50% + ${SCAN_HALF - 22}px)`, width: 22, height: 22, borderTop: '2.5px solid #4ade80', borderRight: '2.5px solid #4ade80', borderRadius: '0 6px 0 0' }} />
          {/* bottom-left */}
          <div className="absolute" style={{ top: `calc(50% + ${SCAN_HALF - 22}px)`, left: `calc(50% - ${SCAN_HALF}px)`, width: 22, height: 22, borderBottom: '2.5px solid #4ade80', borderLeft: '2.5px solid #4ade80', borderRadius: '0 0 0 6px' }} />
          {/* bottom-right */}
          <div className="absolute" style={{ top: `calc(50% + ${SCAN_HALF - 22}px)`, left: `calc(50% + ${SCAN_HALF - 22}px)`, width: 22, height: 22, borderBottom: '2.5px solid #4ade80', borderRight: '2.5px solid #4ade80', borderRadius: '0 0 6px 0' }} />

          {/* Animated scan line — runs top-to-bottom inside the scan zone */}
          <div
            style={{
              position: 'absolute',
              width: SCAN_HALF * 2,
              height: 2,
              top: `calc(50% - ${SCAN_HALF}px)`,
              left: '50%',
              transform: `translateX(-50%)`,
              background: 'linear-gradient(90deg, transparent 0%, #4ade80 40%, #4ade80 60%, transparent 100%)',
              boxShadow: '0 0 10px 2px rgba(74,222,128,0.65)',
              animation: `cxo-scan-line 2s linear infinite`,
            }}
          />
        </div>
      )}
    </div>
  );
};
