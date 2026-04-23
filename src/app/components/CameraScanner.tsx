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
  const { t, isDark } = useTheme();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const scannerRef = useRef<QrScanner | null>(null);
  const detectedRef = useRef(false);
  const onCodeDetectedRef = useRef(onCodeDetected);
  const [state, setState] = useState<ScannerState>('requesting');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [attempt, setAttempt] = useState(0);

  // Keep the latest callback in a ref so the scanner effect doesn't
  // tear down + restart the camera on every parent re-render.
  useEffect(() => {
    onCodeDetectedRef.current = onCodeDetected;
  }, [onCodeDetected]);

  useEffect(() => {
    let cancelled = false;
    detectedRef.current = false;

    const start = async () => {
      if (!videoRef.current) return;
      setState('requesting');
      setErrorMsg('');

      try {
        const scanner = new QrScanner(
          videoRef.current,
          (result) => {
            if (detectedRef.current) return;
            const code = (result?.data ?? '').trim();
            if (!code) return;
            detectedRef.current = true;
            try { scanner.stop(); } catch { /* noop */ }
            onCodeDetectedRef.current(code);
          },
          {
            preferredCamera: 'environment',
            highlightScanRegion: false,
            highlightCodeOutline: false,
            maxScansPerSecond: 8,
          },
        );
        scannerRef.current = scanner;
        await scanner.start();
        if (!cancelled) setState('streaming');
      } catch (err) {
        if (cancelled) return;
        const name = (err as { name?: string })?.name ?? '';
        const msg = (err as { message?: string })?.message ?? String(err);
        if (name === 'NotAllowedError' || /permission/i.test(msg)) {
          setState('denied');
          setErrorMsg('Camera access was blocked. Allow camera permission to scan badges.');
        } else if (name === 'NotFoundError' || /no.*camera/i.test(msg)) {
          setState('error');
          setErrorMsg('No camera was detected on this device.');
        } else {
          setState('error');
          setErrorMsg(msg || 'Could not start the camera.');
        }
      }
    };

    void start();

    return () => {
      cancelled = true;
      const s = scannerRef.current;
      if (s) {
        try { s.stop(); } catch { /* noop */ }
        try { s.destroy(); } catch { /* noop */ }
      }
      scannerRef.current = null;
    };
  }, [attempt]);

  const retry = () => setAttempt(a => a + 1);

  return (
    <div className="w-full max-w-xs aspect-square rounded-3xl border-2 relative overflow-hidden mb-8"
      style={{ borderColor: 'rgba(255,255,255,0.15)', background: '#000' }}>
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover"
        playsInline
        muted
        style={{ display: state === 'streaming' ? 'block' : 'none' }}
      />

      {state === 'requesting' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2"
          style={{ background: isDark ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.25)' }}>
          <Camera size={28} style={{ color: 'rgba(255,255,255,0.7)' }} />
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, fontFamily: 'monospace' }}>
            REQUESTING CAMERA…
          </p>
        </div>
      )}

      {(state === 'denied' || state === 'error') && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-5 text-center"
          style={{ background: 'rgba(0,0,0,0.78)' }}>
          <AlertTriangle size={28} style={{ color: '#fbbf24' }} />
          <p style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>
            {state === 'denied' ? 'Camera access required' : 'Camera unavailable'}
          </p>
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, lineHeight: 1.4 }}>
            {errorMsg}
          </p>
          <div className="flex gap-2 mt-1">
            <button
              onClick={retry}
              className="px-3 py-1.5 rounded-lg active:scale-[0.97] transition-transform"
              style={{ background: t.accent, color: '#fff', fontSize: 12, fontWeight: 700 }}
            >
              Retry
            </button>
            <button
              onClick={onSwitchToManual}
              className="px-3 py-1.5 rounded-lg active:scale-[0.97] transition-transform flex items-center gap-1"
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

      {/* Scanner Overlay (always visible while streaming) */}
      {state === 'streaming' && (
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-0 w-full h-1 bg-green-500 shadow-[0_0_20px_rgba(34,197,94,0.8)] animate-[scan_2s_linear_infinite]" />
          <div className="absolute inset-0 border-[40px]" style={{ borderColor: 'rgba(0,0,0,0.55)' }} />
          <div className="absolute inset-8 border-2 rounded-xl" style={{ borderColor: 'rgba(255,255,255,0.25)' }} />
          <div className="absolute top-8 left-8 w-6 h-6 border-t-2 border-l-2 border-green-400 rounded-tl-lg" />
          <div className="absolute top-8 right-8 w-6 h-6 border-t-2 border-r-2 border-green-400 rounded-tr-lg" />
          <div className="absolute bottom-8 left-8 w-6 h-6 border-b-2 border-l-2 border-green-400 rounded-bl-lg" />
          <div className="absolute bottom-8 right-8 w-6 h-6 border-b-2 border-r-2 border-green-400 rounded-br-lg" />
        </div>
      )}
    </div>
  );
};
