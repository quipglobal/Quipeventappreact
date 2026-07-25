import React, { useEffect, useRef, useState } from 'react';
import QrScanner from 'qr-scanner';
import { Camera, AlertTriangle, Type } from 'lucide-react';
import { useTheme } from '@/app/context/ThemeContext';

type ScannerState = 'requesting' | 'streaming' | 'denied' | 'error';

interface CameraScannerProps {
  onCodeDetected: (code: string) => void;
  onSwitchToManual: () => void;
}

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
        const msg = (err as { message?: string })?.message ?? String(err);
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
    <div
      className="relative mb-8"
      style={{
        width: '100%',
        maxWidth: 280,
        aspectRatio: '1 / 1',
        borderRadius: 24,
        border: '2px solid rgba(255,255,255,0.15)',
        background: '#000',
        overflow: 'hidden',
        // Force the container into its own GPU compositing layer.
        // On iOS/Android WebKit, overflow:hidden + border-radius clips
        // the video on the CPU path — forcing translateZ(0) moves both
        // the container and video onto the GPU, fixing the black-frame bug.
        transform: 'translateZ(0)',
        WebkitTransform: 'translateZ(0)',
      }}
    >
      {/*
        The <video> element must NEVER have its display, opacity, or
        visibility controlled by React after qr-scanner has been attached —
        the library overwrites those styles internally to prevent Safari
        from pausing playback. We let it sit here permanently and use
        z-indexed overlays to show UI states on top of it.

        transform:translateZ(0) forces GPU compositing on iOS/Android WebKit,
        which is required for camera streams to render (without it the video
        layer can appear as a solid black rectangle).
      */}
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover"
        playsInline
        autoPlay
        muted
        style={{
          transform: 'translateZ(0)',
          WebkitTransform: 'translateZ(0)',
        }}
      />

      {/* ── Requesting camera ── */}
      {state === 'requesting' && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center gap-3"
          style={{ zIndex: 10, background: 'rgba(0,0,0,0.82)' }}
        >
          <Camera size={32} style={{ color: 'rgba(255,255,255,0.65)' }} />
          <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 12, fontFamily: 'monospace', letterSpacing: '0.08em' }}>
            REQUESTING CAMERA…
          </p>
        </div>
      )}

      {/* ── Permission denied / error ── */}
      {(state === 'denied' || state === 'error') && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-5 text-center"
          style={{ zIndex: 10, background: 'rgba(0,0,0,0.9)' }}
        >
          <AlertTriangle size={28} style={{ color: '#fbbf24' }} />
          <p style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>
            {state === 'denied' ? 'Camera access required' : 'Camera unavailable'}
          </p>
          <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 11, lineHeight: 1.5 }}>
            {errorMsg}
          </p>
          <div className="flex gap-2 mt-1">
            <button
              onClick={() => setAttempt(a => a + 1)}
              className="px-3 py-1.5 rounded-lg transition-transform active:scale-95"
              style={{ background: t.accent, color: '#fff', fontSize: 12, fontWeight: 700 }}
            >
              Retry
            </button>
            <button
              onClick={onSwitchToManual}
              className="px-3 py-1.5 rounded-lg flex items-center gap-1 transition-transform active:scale-95"
              style={{
                background: 'rgba(255,255,255,0.1)',
                color: '#fff',
                border: '1px solid rgba(255,255,255,0.2)',
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              <Type size={12} /> Manual
            </button>
          </div>
        </div>
      )}

      {/* ── Live scanning overlay (corner brackets + scan line) ── */}
      {state === 'streaming' && (
        <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 10 }}>
          {/* Animated scan line */}
          <div
            className="absolute left-0 w-full h-0.5 bg-green-400"
            style={{
              boxShadow: '0 0 12px 2px rgba(34,197,94,0.8)',
              animation: 'scanLine 2s linear infinite',
            }}
          />
          {/* Dark vignette border */}
          <div className="absolute inset-0 border-[36px]" style={{ borderColor: 'rgba(0,0,0,0.5)' }} />
          {/* Target box */}
          <div className="absolute inset-9 border border-white/20 rounded-xl" />
          {/* Corner brackets */}
          <div className="absolute top-9 left-9 w-5 h-5 border-t-2 border-l-2 border-green-400 rounded-tl-md" />
          <div className="absolute top-9 right-9 w-5 h-5 border-t-2 border-r-2 border-green-400 rounded-tr-md" />
          <div className="absolute bottom-9 left-9 w-5 h-5 border-b-2 border-l-2 border-green-400 rounded-bl-md" />
          <div className="absolute bottom-9 right-9 w-5 h-5 border-b-2 border-r-2 border-green-400 rounded-br-md" />
        </div>
      )}
    </div>
  );
};
