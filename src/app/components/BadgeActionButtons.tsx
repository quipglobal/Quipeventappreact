import React from 'react';
import { QrCode, ScanLine } from 'lucide-react';
import { useTheme } from '@/app/context/ThemeContext';

interface BadgeActionButtonsProps {
  onNavigate: (page: string) => void;
  activePage: string;
}

export const BadgeActionButtons: React.FC<BadgeActionButtonsProps> = ({ onNavigate, activePage }) => {
  const { isDark } = useTheme();

  const isBadgeActive = activePage === 'my-badge';
  const isScanActive  = activePage === 'scan';

  return (
    <div
      className="fixed left-0 right-0 z-50 pointer-events-none max-w-[430px] mx-auto"
      style={{ bottom: 76 }}
    >
      <div className="flex items-center justify-center gap-2.5 px-4 pointer-events-auto">
        {/* ── My Badge ── */}
        <button
          onClick={() => onNavigate('my-badge')}
          className="flex items-center gap-1.5 px-4 py-2 rounded-full transition-all active:scale-95 shadow-lg"
          style={{
            background: isBadgeActive
              ? 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)'
              : isDark
                ? 'rgba(26,26,46,0.92)'
                : 'rgba(255,255,255,0.92)',
            border: `1.5px solid ${isBadgeActive ? 'transparent' : isDark ? 'rgba(124,58,237,0.3)' : 'rgba(124,58,237,0.2)'}`,
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            boxShadow: isBadgeActive
              ? '0 4px 20px rgba(124,58,237,0.45)'
              : isDark
                ? '0 4px 16px rgba(0,0,0,0.4)'
                : '0 4px 16px rgba(0,0,0,0.12)',
          }}
        >
          <QrCode
            size={15}
            style={{ color: isBadgeActive ? '#fff' : '#7c3aed' }}
            strokeWidth={2.2}
          />
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '0.01em',
              color: isBadgeActive ? '#fff' : '#7c3aed',
            }}
          >
            My Badge
          </span>
        </button>

        {/* ── Scan Badge ── */}
        <button
          onClick={() => onNavigate('scan')}
          className="flex items-center gap-1.5 px-4 py-2 rounded-full transition-all active:scale-95 shadow-lg"
          style={{
            background: isScanActive
              ? 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)'
              : isDark
                ? 'rgba(26,26,46,0.92)'
                : 'rgba(255,255,255,0.92)',
            border: `1.5px solid ${isScanActive ? 'transparent' : isDark ? 'rgba(124,58,237,0.3)' : 'rgba(124,58,237,0.2)'}`,
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            boxShadow: isScanActive
              ? '0 4px 20px rgba(124,58,237,0.45)'
              : isDark
                ? '0 4px 16px rgba(0,0,0,0.4)'
                : '0 4px 16px rgba(0,0,0,0.12)',
          }}
        >
          <ScanLine
            size={15}
            style={{ color: isScanActive ? '#fff' : '#7c3aed' }}
            strokeWidth={2.2}
          />
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '0.01em',
              color: isScanActive ? '#fff' : '#7c3aed',
            }}
          >
            Scan Badge
          </span>
        </button>
      </div>
    </div>
  );
};
