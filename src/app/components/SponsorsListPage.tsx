import React, { useState } from 'react';
import { ArrowLeft, MapPin, ExternalLink, QrCode, CheckCircle, FileDown, Users, Calendar, X, Check } from 'lucide-react';
import { useApp } from '@/app/context/AppContext';
import { mockSponsors } from '@/app/data/mockData';

interface SponsorsListPageProps {
  onBack: () => void;
}

export const SponsorsListPage: React.FC<SponsorsListPageProps> = ({ onBack }) => {
  const { metSponsors, setMetSponsors, addPoints, gamificationConfig } = useApp();
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

  const tierColors: Record<string, { bg: string; border: string; text: string }> = {
    Platinum: { bg: 'bg-slate-100', border: 'border-slate-300', text: 'text-slate-700' },
    Gold: { bg: 'bg-amber-100', border: 'border-amber-300', text: 'text-amber-700' },
    Silver: { bg: 'bg-gray-200', border: 'border-gray-300', text: 'text-gray-700' },
  };

  const sponsorsByTier = {
    Platinum: mockSponsors.filter(s => s.tier === 'Platinum'),
    Gold: mockSponsors.filter(s => s.tier === 'Gold'),
    Silver: mockSponsors.filter(s => s.tier === 'Silver'),
  };

  const selectedSponsorData = selectedSponsor ? mockSponsors.find(s => s.id === selectedSponsor) : null;

  if (selectedSponsorData) {
    const hasMet = metSponsors.includes(selectedSponsorData.id);
    const tierColor = tierColors[selectedSponsorData.tier];

    return (
      <div className="min-h-screen bg-gray-50 pb-20">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 pt-12 pb-4 sticky top-0 z-10">
          <button onClick={() => setSelectedSponsor(null)} className="mb-4">
            <ArrowLeft className="w-6 h-6 text-gray-900" />
          </button>
        </div>

        {/* Sponsor Header */}
        <div className="bg-white px-6 pt-6 pb-8 border-b border-gray-200">
          <div className="flex items-start gap-4 mb-4">
            <img
              src={selectedSponsorData.logo}
              alt={selectedSponsorData.name}
              className="w-20 h-20 rounded-2xl shadow-md"
            />
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-900 mb-2">{selectedSponsorData.name}</h1>
              <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${tierColor.bg} ${tierColor.text} ${tierColor.border} border`}>
                {selectedSponsorData.tier} Sponsor
              </span>
            </div>
          </div>
          <p className="text-gray-700 italic mb-4">{selectedSponsorData.tagline}</p>
          
          {/* Quick Info */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="w-4 h-4 text-gray-500" />
              <span className="text-gray-600">Booth {selectedSponsorData.booth}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <ExternalLink className="w-4 h-4 text-gray-500" />
              <span className="text-gray-600">{selectedSponsorData.website}</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="px-6 py-6 bg-white border-b border-gray-200">
          <div className="grid grid-cols-2 gap-3">
            {selectedSponsorData.meetingEnabled && (
              <button
                onClick={() => setShowCheckInModal(true)}
                disabled={hasMet}
                className={`py-3 rounded-xl font-medium flex items-center justify-center gap-2 transition-all ${
                  hasMet
                    ? 'bg-emerald-100 text-emerald-700 cursor-not-allowed'
                    : 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-700 hover:to-purple-700'
                }`}
              >
                {hasMet ? (
                  <>
                    <CheckCircle className="w-5 h-5" />
                    <span>Checked In</span>
                  </>
                ) : (
                  <>
                    <QrCode className="w-5 h-5" />
                    <span>Check In (+{gamificationConfig.pointActions.sponsorCheckIn})</span>
                  </>
                )}
              </button>
            )}
            {selectedSponsorData.appointmentEnabled && (
              <button className="py-3 rounded-xl font-medium flex items-center justify-center gap-2 bg-white border-2 border-indigo-600 text-indigo-600 hover:bg-indigo-50 transition-all">
                <Calendar className="w-5 h-5" />
                <span>Book Meeting</span>
              </button>
            )}
          </div>
        </div>

        {/* About */}
        <div className="px-6 py-6">
          <h2 className="text-lg font-bold text-gray-900 mb-3">About</h2>
          <p className="text-gray-700 leading-relaxed">{selectedSponsorData.description}</p>
        </div>

        {/* Resources */}
        {selectedSponsorData.resources.length > 0 && (
          <div className="px-6 py-6 border-t border-gray-200">
            <h2 className="text-lg font-bold text-gray-900 mb-3">Resources</h2>
            <div className="space-y-2">
              {selectedSponsorData.resources.map((resource) => (
                <button
                  key={resource.id}
                  className="w-full flex items-center justify-between p-4 bg-white border border-gray-200 rounded-xl hover:border-indigo-300 hover:bg-indigo-50 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <FileDown className="w-5 h-5 text-indigo-600" />
                    <span className="font-medium text-gray-900">{resource.title}</span>
                  </div>
                  <ExternalLink className="w-4 h-4 text-gray-400" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Check-in Modal */}
        {showCheckInModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-6">
            <div className="bg-white rounded-3xl p-6 w-full max-w-sm">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-900">Check In</h3>
                <button
                  onClick={() => setShowCheckInModal(false)}
                  className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-all"
                >
                  <X className="w-5 h-5 text-gray-600" />
                </button>
              </div>

              <div className="mb-6">
                <div className="w-48 h-48 bg-gray-100 rounded-2xl mx-auto mb-4 flex items-center justify-center">
                  <QrCode className="w-24 h-24 text-gray-400" />
                  <p className="absolute text-sm text-gray-500 mt-32">Scan QR at booth</p>
                </div>
                <p className="text-center text-sm text-gray-600 mb-4">or enter code manually</p>
                <input
                  type="text"
                  value={checkInCode}
                  onChange={(e) => setCheckInCode(e.target.value)}
                  placeholder="Enter code"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-center text-lg font-mono"
                />
              </div>

              <button
                onClick={() => handleCheckIn(selectedSponsorData.id)}
                className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-3 rounded-xl font-medium hover:from-indigo-700 hover:to-purple-700 transition-all"
              >
                Confirm Check-In
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-gradient-to-br from-orange-600 to-red-600 px-6 pt-12 pb-8 text-white sticky top-0 z-10">
        <button onClick={onBack} className="mb-4">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-2xl font-bold mb-1">Sponsors & Companies</h1>
        <p className="text-white/90 text-sm">Connect with sponsors to earn +{gamificationConfig.pointActions.sponsorCheckIn} points</p>
      </div>

      {/* Sponsors by Tier */}
      <div className="px-6 py-6 space-y-8">
        {Object.entries(sponsorsByTier).map(([tier, sponsors]) => {
          if (sponsors.length === 0) return null;
          const tierColor = tierColors[tier];

          return (
            <div key={tier}>
              <div className="flex items-center gap-2 mb-4">
                <div className={`w-3 h-3 rounded-full ${tierColor.bg} ${tierColor.border} border-2`} />
                <h2 className="text-lg font-bold text-gray-900">{tier} Sponsors</h2>
              </div>

              <div className="space-y-3">
                {sponsors.map((sponsor) => {
                  const hasMet = metSponsors.includes(sponsor.id);
                  return (
                    <button
                      key={sponsor.id}
                      onClick={() => setSelectedSponsor(sponsor.id)}
                      className="w-full bg-white rounded-2xl shadow-md p-5 hover:shadow-lg transition-all text-left"
                    >
                      <div className="flex items-start gap-4 mb-3">
                        <img
                          src={sponsor.logo}
                          alt={sponsor.name}
                          className="w-16 h-16 rounded-xl"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <h3 className="font-bold text-gray-900">{sponsor.name}</h3>
                            {hasMet && (
                              <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                            )}
                          </div>
                          <p className="text-sm text-gray-600 mb-2">{sponsor.tagline}</p>
                          <div className="flex items-center gap-3 text-xs text-gray-500">
                            <div className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              <span>Booth {sponsor.booth}</span>
                            </div>
                          </div>
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
