import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { useTheme } from '@/app/context/ThemeContext';

interface DataStateProps {
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  loadingRows?: number;
  className?: string;
}

function SkeletonCard({ t }: { t: any }) {
  return (
    <div
      className="rounded-2xl p-5 animate-pulse"
      style={{ background: t.surface, border: `1px solid ${t.border}` }}
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-full" style={{ background: t.surface2 }} />
        <div className="flex-1 space-y-2">
          <div className="h-3 rounded-full w-1/2" style={{ background: t.surface2 }} />
          <div className="h-2.5 rounded-full w-1/3" style={{ background: t.surface2 }} />
        </div>
      </div>
      <div className="space-y-2">
        <div className="h-3 rounded-full w-full" style={{ background: t.surface2 }} />
        <div className="h-3 rounded-full w-5/6" style={{ background: t.surface2 }} />
        <div className="h-3 rounded-full w-3/4" style={{ background: t.surface2 }} />
      </div>
    </div>
  );
}

export const DataState: React.FC<DataStateProps> = ({
  loading = false,
  error = null,
  onRetry,
  loadingRows = 3,
  className = '',
}) => {
  const { t } = useTheme();

  if (loading) {
    return (
      <div className={`space-y-4 ${className}`}>
        {Array.from({ length: loadingRows }).map((_, i) => (
          <SkeletonCard key={i} t={t} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={`flex flex-col items-center justify-center py-16 px-6 text-center ${className}`}
      >
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
          style={{ background: 'rgba(239,68,68,0.12)' }}
        >
          <AlertCircle style={{ width: 28, height: 28, color: '#ef4444' }} />
        </div>
        <h3 style={{ color: t.text, fontSize: 16, fontWeight: 700, marginBottom: 6 }}>
          Something went wrong
        </h3>
        <p style={{ color: t.textSec, fontSize: 13, lineHeight: 1.5, marginBottom: 20, maxWidth: 260 }}>
          {error}
        </p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold active:scale-[0.97] transition-transform"
            style={{ background: t.accentBg, color: t.accentSoft }}
          >
            <RefreshCw style={{ width: 15, height: 15 }} />
            Try Again
          </button>
        )}
      </div>
    );
  }

  return null;
};
