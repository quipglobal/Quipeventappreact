import React from 'react';
import { QrCode, ScanLine } from 'lucide-react';

interface BadgeActionButtonsProps {
  onNavigate: (page: string) => void;
  activePage: string;
}

export const BadgeActionButtons: React.FC<BadgeActionButtonsProps> = ({ onNavigate, activePage }) => {
  const isBadgeActive = activePage === 'my-badge';
  const isScanActive  = activePage === 'scan';

  return (
    <div className="mt-2">
      <div className="flex items-center gap-2">

        {/* ── My Badge ── */}
        <button
          onClick={() => onNavigate('my-badge')}
          className="flex-1 flex items-center justify-center gap-2 rounded-xl transition-all active:scale-[0.96]"
          style={{
            padding: '8px 12px',
            background: isBadgeActive
              ? 'linear-gradient(135deg, #9333ea 0%, #6366f1 100%)'
              : 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)',
            boxShadow: isBadgeActive
              ? '0 0 0 2px rgba(167,139,250,0.5), 0 8px 28px rgba(124,58,237,0.65)'
              : '0 6px 22px rgba(124,58,237,0.55)',
          }}
        >
          <QrCode size={15} color="#fff" strokeWidth={2.3} />
          <span style={{ color: '#fff', fontSize: 12, fontWeight: 700, letterSpacing: '0.01em', whiteSpace: 'nowrap' }}>
            My Badge
          </span>
        </button>

        {/* ── Scan Badge ── */}
        <button
          onClick={() => onNavigate('scan')}
          className="flex-1 flex items-center justify-center gap-2 rounded-xl transition-all active:scale-[0.96]"
          style={{
            padding: '8px 12px',
            background: isScanActive
              ? 'linear-gradient(135deg, #9333ea 0%, #6366f1 100%)'
              : 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)',
            boxShadow: isScanActive
              ? '0 0 0 2px rgba(167,139,250,0.5), 0 8px 28px rgba(124,58,237,0.65)'
              : '0 6px 22px rgba(124,58,237,0.55)',
          }}
        >
          <ScanLine size={15} color="#fff" strokeWidth={2.3} />
          <span style={{ color: '#fff', fontSize: 12, fontWeight: 700, letterSpacing: '0.01em', whiteSpace: 'nowrap' }}>
            Scan Badge
          </span>
        </button>

      </div>
    </div>
  );
};
