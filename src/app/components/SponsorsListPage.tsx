import React, { useState } from 'react';
import { ArrowLeft, MapPin, ExternalLink, QrCode, CheckCircle, FileDown, Calendar, X } from 'lucide-react';
import { useApp } from '@/app/context/AppContext';
import { useTheme } from '@/app/context/ThemeContext';
import { mockSponsors } from '@/app/data/mockData';

interface SponsorsListPageProps { onBack: () => void; }

export const SponsorsListPage: React.FC<SponsorsListPageProps> = ({ onBack }) => {
  const { metSponsors, setMetSponsors, addPoints, gamificationConfig } = useApp();
  const { t } = useTheme();
  const [selectedSponsor, setSelectedSponsor] = useState<string | null>(null);
  const [showCheckInModal, setShowCheckInModal] = useState(false);
  const [checkInCode, setCheckInCode] = useState('');

  const handleCheckIn = (sponsorId: string) => {
    if (!metSponsors.includes(sponsorId)) {
      setMetSponsors([...metSponsors, sponsorId]);
      addPoints(gamificationConfig.pointActions.sponsorCheckIn, 'Sponsor check-in complete!');
      setShowCheckInModal(false);
      setCheckInCode('');
    }
  };

  const tierMeta: Record<string, { grad: string; dot: string }> = {
    Platinum: { grad: 'linear-gradient(135deg,#94a3b8,#64748b)', dot: '#94a3b8' },
    Gold:     { grad: 'linear-gradient(135deg,#f59e0b,#d97706)', dot: '#f59e0b' },
    Silver:   { grad: 'linear-gradient(135deg,#9ca3af,#6b7280)', dot: '#9ca3af' },
  };
  const sponsorsByTier = {
    Platinum: mockSponsors.filter(s => s.tier === 'Platinum'),
    Gold:     mockSponsors.filter(s => s.tier === 'Gold'),
    Silver:   mockSponsors.filter(s => s.tier === 'Silver'),
  };
  const GRAD = 'linear-gradient(135deg,#f97316,#ef4444)';
  const selectedSponsorData = selectedSponsor ? mockSponsors.find(s => s.id === selectedSponsor) : null;

  if (selectedSponsorData) {
    const hasMet = metSponsors.includes(selectedSponsorData.id);
    const tm = tierMeta[selectedSponsorData.tier] ?? tierMeta.Silver;
    return (
      <div className="min-h-screen pb-20" style={{ background: t.bgPage }}>
        <div className="sticky top-0 z-10 px-5 pt-12 pb-4" style={{ background: t.surface, borderBottom: `1px solid ${t.border}` }}>
          <button onClick={() => setSelectedSponsor(null)}><ArrowLeft style={{ width: 24, height: 24, color: t.text }} /></button>
        </div>
        <div className="px-5 pt-5 pb-6" style={{ background: t.surface, borderBottom: `1px solid ${t.border}` }}>
          <div className="flex items-start gap-4 mb-4">
            <img src={selectedSponsorData.logo} alt={selectedSponsorData.name} className="w-20 h-20 rounded-2xl" style={{ border: `1px solid ${t.border}` }} />
            <div>
              <h1 style={{ color: t.text, fontSize: 22, fontWeight: 800, marginBottom: 6 }}>{selectedSponsorData.name}</h1>
              <span className="px-3 py-1 rounded-full text-white text-sm font-bold" style={{ background: tm.grad }}>{selectedSponsorData.tier} Sponsor</span>
            </div>
          </div>
          <p style={{ color: t.textSec, fontSize: 14, fontStyle: 'italic', marginBottom: 12 }}>{selectedSponsorData.tagline}</p>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5"><MapPin style={{ width: 14, height: 14, color: t.textMuted }} /><span style={{ color: t.textSec, fontSize: 13 }}>Booth {selectedSponsorData.booth}</span></div>
            <div className="flex items-center gap-1.5"><ExternalLink style={{ width: 14, height: 14, color: t.textMuted }} /><span style={{ color: t.textSec, fontSize: 13 }}>{selectedSponsorData.website}</span></div>
          </div>
        </div>
        <div className="px-5 py-5" style={{ borderBottom: `1px solid ${t.border}` }}>
          <div className="grid grid-cols-2 gap-3">
            {selectedSponsorData.meetingEnabled && (
              <button onClick={() => !hasMet && setShowCheckInModal(true)} disabled={hasMet}
                className="py-3 rounded-xl font-semibold flex items-center justify-center gap-2"
                style={{ background: hasMet ? t.successBg : 'linear-gradient(135deg,#7c3aed,#4f46e5)', color: hasMet ? t.successText : '#fff' }}>
                {hasMet ? <><CheckCircle style={{ width: 18, height: 18 }} />Checked In</> : <><QrCode style={{ width: 18, height: 18 }} />Check In (+{gamificationConfig.pointActions.sponsorCheckIn})</>}
              </button>
            )}
            {selectedSponsorData.appointmentEnabled && (
              <button className="py-3 rounded-xl font-semibold flex items-center justify-center gap-2"
                style={{ background: t.surface2, border: `1.5px solid ${t.borderAcc}`, color: t.accentSoft }}>
                <Calendar style={{ width: 18, height: 18 }} />Book Meeting
              </button>
            )}
          </div>
        </div>
        <div className="px-5 py-5">
          <h2 style={{ color: t.text, fontSize: 16, fontWeight: 700, marginBottom: 10 }}>About</h2>
          <p style={{ color: t.textSec, fontSize: 14, lineHeight: 1.6 }}>{selectedSponsorData.description}</p>
          {selectedSponsorData.resources.length > 0 && (
            <div className="mt-5">
              <h2 style={{ color: t.text, fontSize: 16, fontWeight: 700, marginBottom: 10 }}>Resources</h2>
              <div className="space-y-2">
                {selectedSponsorData.resources.map(r => (
                  <button key={r.id} className="w-full flex items-center justify-between p-4 rounded-xl transition-all"
                    style={{ background: t.surface, border: `1px solid ${t.border}` }}>
                    <div className="flex items-center gap-3"><FileDown style={{ width: 18, height: 18, color: t.accentSoft }} /><span style={{ color: t.text, fontSize: 14, fontWeight: 600 }}>{r.title}</span></div>
                    <ExternalLink style={{ width: 15, height: 15, color: t.textMuted }} />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        {showCheckInModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)' }}>
            <div className="w-full max-w-sm rounded-3xl p-6" style={{ background: t.surface, border: `1px solid ${t.border}` }}>
              <div className="flex items-center justify-between mb-5">
                <h3 style={{ color: t.text, fontSize: 20, fontWeight: 700 }}>Check In</h3>
                <button onClick={() => setShowCheckInModal(false)} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: t.surface2 }}>
                  <X style={{ width: 15, height: 15, color: t.textSec }} />
                </button>
              </div>
              <div className="w-40 h-40 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background: t.surface2 }}>
                <QrCode style={{ width: 64, height: 64, color: t.emptyIcon }} />
              </div>
              <p style={{ color: t.textMuted, fontSize: 13, textAlign: 'center', marginBottom: 12 }}>or enter code manually</p>
              <input type="text" value={checkInCode} onChange={e => setCheckInCode(e.target.value)} placeholder="Enter code"
                className="w-full px-4 py-3 rounded-xl outline-none text-center mb-4"
                style={{ background: t.inputBg, border: `1.5px solid ${t.inputBorder}`, color: t.text, fontSize: 18, fontFamily: 'monospace' }} />
              <button onClick={() => handleCheckIn(selectedSponsorData.id)}
                className="w-full py-3 rounded-xl font-semibold text-white"
                style={{ background: 'linear-gradient(135deg,#7c3aed,#4f46e5)' }}>
                Confirm Check-In
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20" style={{ background: t.bgPage }}>
      <div className="sticky top-0 z-10 px-5 pt-12 pb-6 text-white" style={{ background: GRAD }}>
        <button onClick={onBack} className="mb-3"><ArrowLeft style={{ width: 22, height: 22, color: '#fff' }} /></button>
        <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.03em' }}>Sponsors & Companies</h1>
        <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13, marginTop: 4 }}>Connect to earn +{gamificationConfig.pointActions.sponsorCheckIn} points per check-in</p>
      </div>
      <div className="px-5 py-5 space-y-6">
        {(Object.entries(sponsorsByTier) as [string, typeof mockSponsors][]).map(([tier, sponsors]) => {
          if (!sponsors.length) return null;
          const tm2 = tierMeta[tier] ?? tierMeta.Silver;
          return (
            <div key={tier}>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-3 h-3 rounded-full" style={{ background: tm2.dot }} />
                <h2 style={{ color: t.text, fontSize: 16, fontWeight: 700 }}>{tier} Sponsors</h2>
              </div>
              <div className="space-y-3">
                {sponsors.map(sponsor => {
                  const hasMet = metSponsors.includes(sponsor.id);
                  return (
                    <button key={sponsor.id} onClick={() => setSelectedSponsor(sponsor.id)}
                      className="w-full rounded-2xl p-5 text-left hover:opacity-90 transition-all"
                      style={{ background: t.surface, boxShadow: t.shadow, border: `1px solid ${t.border}` }}>
                      <div className="flex items-start gap-4">
                        <img src={sponsor.logo} alt={sponsor.name} className="w-14 h-14 rounded-xl flex-shrink-0" style={{ border: `1px solid ${t.border}` }} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <h3 style={{ color: t.text, fontSize: 15, fontWeight: 700 }}>{sponsor.name}</h3>
                            {hasMet && <CheckCircle style={{ width: 18, height: 18, color: t.successText, flexShrink: 0 }} />}
                          </div>
                          <p style={{ color: t.textSec, fontSize: 13, marginBottom: 6 }}>{sponsor.tagline}</p>
                          <div className="flex items-center gap-1.5"><MapPin style={{ width: 12, height: 12, color: t.textMuted }} /><span style={{ color: t.textMuted, fontSize: 12 }}>Booth {sponsor.booth}</span></div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};