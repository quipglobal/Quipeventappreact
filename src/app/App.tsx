import React, { useState, Component, ErrorInfo, ReactNode } from 'react';
import { AppProvider, useApp } from '@/app/context/AppContext';
import { ThemeProvider, useTheme } from '@/app/context/ThemeContext';
import { SplashScreen } from '@/app/components/SplashScreen';
import { WelcomeScreen } from '@/app/components/WelcomeScreen';
import { HomePage } from '@/app/components/HomePage';
import { AgendaPage } from '@/app/components/AgendaPage';
import { EngagePage } from '@/app/components/EngagePage';
import { SponsorsListPage } from '@/app/components/SponsorsListPage';
import { SurveysListPage } from '@/app/components/SurveysListPage';
import { PollsListPage } from '@/app/components/PollsListPage';
import { ChallengesPage } from '@/app/components/ChallengesPage';
import { LeaderboardPage } from '@/app/components/LeaderboardPage';
import { ProfilePage } from '@/app/components/ProfilePage';
import { BottomNav } from '@/app/components/BottomNav';

// ─── Types ─────────────────────────────────────────────────────────────────────
type Screen = 'splash' | 'welcome' | 'main';
type Page =
  | 'home' | 'agenda' | 'engage'
  | 'engage-sponsors' | 'engage-surveys' | 'engage-polls'
  | 'engage-challenges' | 'engage-audience'
  | 'leaderboard' | 'profile' | 'attendees' | 'booth';

// ─── Error Boundary ─────────────────────────────────────────────────────────
interface EBState { hasError: boolean; message: string }
class AppErrorBoundary extends Component<{ children: ReactNode }, EBState> {
  state: EBState = { hasError: false, message: '' };
  static getDerivedStateFromError(e: Error): EBState { return { hasError: true, message: e.message }; }
  componentDidCatch(e: Error, info: ErrorInfo) { console.error('[AppErrorBoundary]', e, info); }
  render() {
    if (this.state.hasError) return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: '#07070F' }}>
        <div className="rounded-3xl p-8 max-w-sm w-full text-center" style={{ background: '#111120', border: '1px solid rgba(255,255,255,0.1)' }}>
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(239,68,68,0.15)' }}>
            <svg className="w-7 h-7" style={{ color: '#f87171' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          </div>
          <h2 style={{ color: '#fff', fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Something went wrong</h2>
          <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, marginBottom: 24 }}>{this.state.message}</p>
          <button onClick={() => { this.setState({ hasError: false, message: '' }); window.location.reload(); }}
            className="w-full py-3 rounded-xl font-medium text-white"
            style={{ background: 'linear-gradient(135deg,#7c3aed,#4f46e5)' }}>
            Reload App
          </button>
        </div>
      </div>
    );
    return this.props.children;
  }
}

// ─── AppContent ─────────────────────────────────────────────────────────────
function AppContent() {
  const [screen, setScreen] = useState<Screen>('splash');
  const [activePage, setActivePage] = useState<Page>('home');
  const { user, hasJoinedEvent } = useApp();
  const { t, isDark } = useTheme();

  const handleNavigate = (page: string) => setActivePage(page as Page);

  const PlaceholderPage: React.FC<{ title: string; desc: string; onBack: () => void }> = ({ title, desc, onBack }) => (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: t.bgPage }}>
      <div className="rounded-3xl p-8 max-w-md text-center" style={{ background: t.surface, boxShadow: t.shadow, border: `1px solid ${t.border}` }}>
        <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: t.accentBg }}>
          <svg className="w-8 h-8" style={{ color: t.accent }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
        <h2 style={{ color: t.text, fontSize: 22, fontWeight: 700, marginBottom: 8 }}>{title}</h2>
        <p style={{ color: t.textSec, fontSize: 14, marginBottom: 24 }}>{desc}</p>
        <button onClick={onBack} className="px-6 py-3 rounded-xl font-medium text-white"
          style={{ background: 'linear-gradient(135deg,#7c3aed,#4f46e5)' }}>
          Go Back
        </button>
      </div>
    </div>
  );

  const renderPage = () => {
    switch (activePage) {
      case 'home':            return <HomePage onNavigate={handleNavigate} />;
      case 'agenda':          return <AgendaPage />;
      case 'engage':          return <EngagePage onNavigate={handleNavigate} />;
      case 'engage-sponsors': return <SponsorsListPage onBack={() => setActivePage('engage')} />;
      case 'engage-surveys':  return <SurveysListPage  onBack={() => setActivePage('engage')} />;
      case 'engage-polls':    return <PollsListPage     onBack={() => setActivePage('engage')} />;
      case 'engage-challenges':return <ChallengesPage  onBack={() => setActivePage('engage')} />;
      case 'engage-audience': return <PlaceholderPage title="Networking" desc="Connect with other attendees — coming soon!" onBack={() => setActivePage('engage')} />;
      case 'leaderboard':     return <LeaderboardPage />;
      case 'profile':         return <ProfilePage />;
      case 'attendees':       return <PlaceholderPage title="Attendee Leads" desc="View and manage attendees who checked in at your booth." onBack={() => setActivePage('home')} />;
      case 'booth':           return <PlaceholderPage title="Sponsor Booth" desc="Manage your booth profile and promotional materials." onBack={() => setActivePage('home')} />;
      default:                return <HomePage onNavigate={handleNavigate} />;
    }
  };

  const showBottomNav = !activePage.startsWith('engage-') && !['attendees', 'booth'].includes(activePage);
  const mainTabs = ['home', 'agenda', 'engage', 'leaderboard', 'profile', 'attendees', 'booth'];
  const isMainTab = mainTabs.includes(activePage);

  return (
    <div style={{ minHeight: '100svh', background: isDark ? '#000' : '#e8e4f5', fontFamily: 'Inter,sans-serif' }}>
      {screen === 'splash' && <SplashScreen onComplete={() => setScreen('welcome')} />}
      {screen === 'welcome' && <WelcomeScreen onLogin={() => setScreen('main')} />}

      {screen === 'main' && user && (
        <div className="mx-auto relative overflow-hidden" style={{ maxWidth: 430, minHeight: '100svh', background: t.bgPage }}>
          {renderPage()}
          {showBottomNav && isMainTab && (
            <BottomNav activeTab={activePage} onTabChange={handleNavigate} userRole={user.role} />
          )}
        </div>
      )}
    </div>
  );
}

// ─── Root App ────────────────────────────────────────────────────────────────
function App() {
  return (
    <AppErrorBoundary>
      <ThemeProvider>
        <AppProvider>
          <AppContent />
        </AppProvider>
      </ThemeProvider>
    </AppErrorBoundary>
  );
}

export default App;
