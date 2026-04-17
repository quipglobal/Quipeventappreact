import React, { useState, Component, ErrorInfo, ReactNode } from 'react';
import { AppProvider, useApp } from '@/app/context/AppContext';
import { ThemeProvider, useTheme } from '@/app/context/ThemeContext';
import { SplashScreen } from '@/app/components/SplashScreen';
import { WelcomeScreen } from '@/app/components/WelcomeScreen';
import { EventJoinPage } from '@/app/components/EventJoinPage';
import { HomePage } from '@/app/components/HomePage';
import { AgendaPage } from '@/app/components/AgendaPage';
import { EngagePage } from '@/app/components/EngagePage';
import { EventsPage } from '@/app/components/EventsPage';
import { SponsorsListPage } from '@/app/components/SponsorsListPage';
import { SurveysListPage } from '@/app/components/SurveysListPage';
import { PollsListPage } from '@/app/components/PollsListPage';
import { ChallengesPage } from '@/app/components/ChallengesPage';
import { LeaderboardPage } from '@/app/components/LeaderboardPage';
import { ProfilePage } from '@/app/components/ProfilePage';
import { EditProfilePage } from '@/app/components/EditProfilePage';
import { SponsorScannerPage } from '@/app/components/SponsorScannerPage';
import { EventDashboardPage } from '@/app/components/EventDashboardPage';
import { GiveawaysPage } from '@/app/components/GiveawaysPage';
import { AudiencePage } from '@/app/components/AudiencePage';
import { LeadsPage } from '@/app/components/LeadsPage';
import { SponsorEventPage } from '@/app/components/SponsorEventPage';
import { SponsorDrawPage } from '@/app/components/SponsorDrawPage';
import { SponsorGiveawaysPage } from '@/app/components/SponsorGiveawaysPage';
import { BottomNav } from '@/app/components/BottomNav';
import { SideMenu } from '@/app/components/SideMenu';
import { MyBadgePage } from '@/app/components/MyBadgePage';
import { BadgeActionButtons } from '@/app/components/BadgeActionButtons';
import { MeetingsPage } from '@/app/components/MeetingsPage';
import { Bell, Search, MessageCircle, LayoutGrid } from 'lucide-react';

type Screen = 'splash' | 'welcome' | 'event-join' | 'main';
type Page =
  | 'home' | 'agenda' | 'events' | 'event-dashboard' | 'engage'
  | 'engage-sponsors' | 'engage-surveys' | 'engage-polls'
  | 'engage-challenges' | 'engage-audience' | 'engage-giveaways'
  | 'leaderboard' | 'profile' | 'edit-profile' | 'attendees' | 'leads' | 'booth' | 'scan'
  | 'my-badge' | 'sponsor-event' | 'sponsor-draw' | 'sponsor-giveaways' | 'partners' | 'meetings';

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

const pagesWithGlobalHeader = ['home', 'engage-audience', 'engage', 'agenda', 'partners', 'leaderboard', 'events', 'event-dashboard', 'meetings', 'scan', 'attendees', 'leads', 'my-badge', 'sponsor-giveaways'];

function AppContent() {
  const [screen, setScreen] = useState<Screen>('splash');
  const [activePage, setActivePage] = useState<Page>('home');
  const [moreOpen, setMoreOpen] = useState(false);
  const { user, sessionRestored, hasJoinedEvent, connectionRequests, conversations } = useApp();
  const { t, isDark } = useTheme();

  React.useEffect(() => {
    if (!sessionRestored) return;
    if (screen === 'splash') return;
    if (user && screen === 'welcome') {
      setScreen('event-join');
    }
  }, [sessionRestored, user, screen]);

  const unreadCount = connectionRequests.filter(r => r.direction === 'incoming' && r.status === 'pending').length
    + conversations.reduce((sum, c) => sum + c.messages.filter(m => m.senderId !== (user?.id || 'current-user') && !m.read).length, 0);

  const handleNavigate = (page: string) => setActivePage(page as Page);

  const handleJoinEvent = () => {
    setActivePage('home');
    setScreen('main');
  };

  const handleViewDashboard = () => {
    setActivePage('event-dashboard');
    setScreen('main');
  };

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
      case 'events':          return <HomePage onNavigate={handleNavigate} />;
      case 'event-dashboard': return <EventDashboardPage onNavigate={handleNavigate} onBack={() => setActivePage('home')} />;
      case 'engage':          return <EngagePage onNavigate={handleNavigate} />;
      case 'engage-sponsors': return <SponsorsListPage onBack={() => setActivePage('engage')} />;
      case 'engage-surveys':  return <SurveysListPage  onBack={() => setActivePage('engage')} />;
      case 'engage-polls':    return <PollsListPage     onBack={() => setActivePage('engage')} />;
      case 'engage-challenges':return <ChallengesPage  onBack={() => setActivePage('engage')} />;
      case 'engage-audience': return <AudiencePage />;
      case 'engage-giveaways':return <GiveawaysPage onBack={() => setActivePage('home')} />;
      case 'leaderboard':     return <LeaderboardPage />;
      case 'profile':         return <ProfilePage onEdit={() => setActivePage('edit-profile')} />;
      case 'edit-profile':    return <EditProfilePage onBack={() => setActivePage('profile')} />;
      case 'partners':        return <SponsorsListPage />;
      case 'attendees':       return <LeadsPage onNavigateToDraw={() => setActivePage('sponsor-draw')} onNavigateToScan={() => setActivePage('scan')} />;
      case 'leads':           return <LeadsPage onNavigateToDraw={() => setActivePage('sponsor-draw')} onNavigateToScan={() => setActivePage('scan')} />;
      case 'my-badge':        return <MyBadgePage />;
      case 'booth':           return <PlaceholderPage title="Sponsor Booth" desc="Manage your booth profile and promotional materials." onBack={() => setActivePage('home')} />;
      case 'scan':            return <SponsorScannerPage />;
      case 'sponsor-event':   return <SponsorEventPage onBack={() => setActivePage('home')} onNavigate={handleNavigate} />;
      case 'sponsor-draw':    return <SponsorDrawPage onBack={() => setActivePage('attendees')} />;
      case 'sponsor-giveaways': return <SponsorGiveawaysPage />;
      case 'meetings':        return <MeetingsPage />;
      default:                return <HomePage onNavigate={handleNavigate} />;
    }
  };

  const showBottomNav = (() => {
    if (activePage.startsWith('engage-') && activePage !== 'engage-audience') return false;
    if (['booth', 'sponsor-event', 'sponsor-draw', 'edit-profile'].includes(activePage)) return false;
    return true;
  })();

  const mainTabs = ['home', 'events', 'event-dashboard', 'agenda', 'engage', 'leaderboard', 'profile', 'attendees', 'leads', 'my-badge', 'booth', 'scan', 'engage-audience', 'sponsor-event', 'sponsor-draw', 'sponsor-giveaways', 'partners', 'meetings'];
  const isMainTab = mainTabs.includes(activePage);

  const showGlobalHeader = pagesWithGlobalHeader.includes(activePage);

  return (
    <div style={{ minHeight: '100svh', background: isDark ? '#000' : '#e8e4f5', fontFamily: 'Inter,sans-serif' }}>
      {screen === 'splash' && <SplashScreen onComplete={() => setScreen('welcome')} />}
      {screen === 'welcome' && <WelcomeScreen onLogin={() => setScreen('event-join')} />}

      {screen === 'event-join' && user && (
        <div className="mx-auto relative overflow-hidden" style={{ maxWidth: 430, minHeight: '100svh', background: t.bgPage }}>
          <EventJoinPage
            onJoinEvent={handleJoinEvent}
            onViewDashboard={handleViewDashboard}
          />
        </div>
      )}

      {screen === 'main' && user && (
        <div className="mx-auto relative overflow-hidden" style={{ maxWidth: 430, minHeight: '100svh', background: t.bgPage }}>
          {showGlobalHeader && (
            <div className="sticky top-0 z-50 px-4 pt-4 pb-2 backdrop-blur-md border-b"
              style={{
                background: isDark ? 'rgba(7,7,15,0.85)' : 'rgba(255,255,255,0.9)',
                borderColor: t.border,
              }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full overflow-hidden border cursor-pointer"
                    onClick={() => handleNavigate('profile')}
                    style={{ borderColor: t.borderAcc }}>
                    {user.avatar ? (
                      <img src={user.avatar} alt="Me" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-violet-600 text-white font-bold text-sm">
                        {user.name.charAt(0)}
                      </div>
                    )}
                  </div>
                  <div>
                    <h1 className="text-sm font-bold leading-none mb-1" style={{ color: t.text }}>
                      Hi, {user.name.split(' ')[0]}
                    </h1>
                    <div className="flex items-center gap-1 text-[10px]" style={{ color: t.textSec }}>
                      <span className="font-medium px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-400">
                        {user.points} pts
                      </span>
                      <span>·</span>
                      <span>{user.tier} Tier</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setScreen('event-join')}
                    className="w-9 h-9 rounded-full flex items-center justify-center transition-colors"
                    title="Back to events"
                    style={{ background: t.surface, border: `1px solid ${t.border}` }}>
                    <LayoutGrid size={16} color={t.text} />
                  </button>
                  <button className="w-9 h-9 rounded-full flex items-center justify-center transition-colors"
                    style={{ background: t.surface, border: `1px solid ${t.border}` }}>
                    <Search size={16} color={t.text} />
                  </button>
                  <button
                    onClick={() => handleNavigate('meetings')}
                    className="w-9 h-9 rounded-full flex items-center justify-center transition-colors relative"
                    style={{
                      background: activePage === 'meetings'
                        ? 'linear-gradient(135deg, #7c3aed, #4f46e5)'
                        : t.surface,
                      border: activePage === 'meetings' ? 'none' : `1px solid ${t.border}`,
                    }}>
                    <MessageCircle size={16} color={activePage === 'meetings' ? '#fff' : t.text} />
                    {unreadCount > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 bg-red-500 rounded-full border-2 flex items-center justify-center"
                        style={{ borderColor: isDark ? '#111120' : '#fff', fontSize: 9, fontWeight: 700, color: '#fff' }}>
                        {unreadCount}
                      </span>
                    )}
                  </button>
                  <button className="w-9 h-9 rounded-full flex items-center justify-center transition-colors relative"
                    style={{ background: t.surface, border: `1px solid ${t.border}` }}>
                    <Bell size={16} color={t.text} />
                    <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-red-500 rounded-full border-2"
                      style={{ borderColor: isDark ? '#111120' : '#fff' }} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {renderPage()}

          {showBottomNav && isMainTab && (
            <>
              <BadgeActionButtons onNavigate={handleNavigate} activePage={activePage} />
              <BottomNav
                activeTab={activePage}
                onTabChange={handleNavigate}
                onOpenMore={() => setMoreOpen(true)}
                isMoreOpen={moreOpen}
              />
            </>
          )}

          <SideMenu
            open={moreOpen}
            onClose={() => setMoreOpen(false)}
            onNavigate={handleNavigate}
            onSwitchEvents={() => setScreen('event-join')}
            unreadCount={unreadCount}
          />
        </div>
      )}
    </div>
  );
}

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
