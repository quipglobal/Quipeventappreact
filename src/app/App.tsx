import React, {
  useState, lazy, Suspense,
  Component, type ErrorInfo, type ReactNode,
} from 'react';
import { AppProvider, useApp } from '@/app/context/AppContext';
import { usePreloader } from '@/app/hooks/usePreloader';
import { ThemeProvider, useTheme } from '@/app/context/ThemeContext';
import { Bell, LayoutGrid } from 'lucide-react';

// ─── Core chrome: always bundled synchronously ────────────────────────────────
import { SplashScreen }      from '@/app/components/SplashScreen';
import { WelcomeScreen }     from '@/app/components/WelcomeScreen';
import { EventJoinPage }     from '@/app/components/EventJoinPage';
import { BottomNav }         from '@/app/components/BottomNav';
import { SideMenu }          from '@/app/components/SideMenu';
import { BadgeActionButtons } from '@/app/components/BadgeActionButtons';

// ─── Helper: lazy-load a named export ────────────────────────────────────────
// React.lazy() requires a default export; this adapts named exports so we
// don't have to touch every component file.
function lazyPage<M extends Record<string, React.ComponentType<any>>>(
  importFn: () => Promise<M>,
  name: keyof M,
): React.LazyExoticComponent<M[typeof name]> {
  return lazy(() =>
    importFn().then((m) => ({ default: m[name] as React.ComponentType<any> })),
  );
}

// ─── Lazy page chunks ─────────────────────────────────────────────────────────
// Each import() becomes a separate JS chunk loaded on first navigation.
// The preloader (usePreloader) ensures data is cached before the user arrives.
const HomePage          = lazyPage(() => import('@/app/components/HomePage'),           'HomePage');
const AgendaPage        = lazyPage(() => import('@/app/components/AgendaPage'),         'AgendaPage');
const EngagePage        = lazyPage(() => import('@/app/components/EngagePage'),         'EngagePage');
const EventsPage        = lazyPage(() => import('@/app/components/EventsPage'),         'EventsPage');
const EventDashboardPage= lazyPage(() => import('@/app/components/EventDashboardPage'),'EventDashboardPage');
const SponsorsListPage  = lazyPage(() => import('@/app/components/SponsorsListPage'),   'SponsorsListPage');
const SurveysListPage   = lazyPage(() => import('@/app/components/SurveysListPage'),   'SurveysListPage');
const PollsListPage     = lazyPage(() => import('@/app/components/PollsListPage'),      'PollsListPage');
const ChallengesPage    = lazyPage(() => import('@/app/components/ChallengesPage'),     'ChallengesPage');
const LeaderboardPage   = lazyPage(() => import('@/app/components/LeaderboardPage'),    'LeaderboardPage');
const ProfilePage       = lazyPage(() => import('@/app/components/ProfilePage'),        'ProfilePage');
const EditProfilePage   = lazyPage(() => import('@/app/components/EditProfilePage'),    'EditProfilePage');
const SponsorScannerPage= lazyPage(() => import('@/app/components/SponsorScannerPage'),'SponsorScannerPage');
const GiveawaysPage     = lazyPage(() => import('@/app/components/GiveawaysPage'),      'GiveawaysPage');
const AudiencePage      = lazyPage(() => import('@/app/components/AudiencePage'),       'AudiencePage');
const LeadsPage         = lazyPage(() => import('@/app/components/LeadsPage'),          'LeadsPage');
const SponsorEventPage  = lazyPage(() => import('@/app/components/SponsorEventPage'),   'SponsorEventPage');
const SponsorDrawPage   = lazyPage(() => import('@/app/components/SponsorDrawPage'),    'SponsorDrawPage');
const SponsorGiveawaysPage = lazyPage(() => import('@/app/components/SponsorGiveawaysPage'), 'SponsorGiveawaysPage');
const MyBadgePage       = lazyPage(() => import('@/app/components/MyBadgePage'),        'MyBadgePage');
const MeetingsPage      = lazyPage(() => import('@/app/components/MeetingsPage'),       'MeetingsPage');
const SpeakersPage      = lazyPage(() => import('@/app/components/SpeakersPage'),       'SpeakersPage');

// ─── Page skeleton (Suspense fallback) ───────────────────────────────────────
// Shows while a lazy chunk is downloading. Matches the dark theme and
// disappears in <100ms for preloaded chunks on a good connection.
const PageSkeleton: React.FC = () => (
  <div className="animate-pulse p-4 pt-5 space-y-4" style={{ minHeight: '70vh' }}>
    <div className="h-36 rounded-3xl" style={{ background: 'rgba(255,255,255,0.05)' }} />
    <div className="h-5 rounded-full w-2/3" style={{ background: 'rgba(255,255,255,0.05)' }} />
    <div className="h-4 rounded-full w-1/2" style={{ background: 'rgba(255,255,255,0.04)' }} />
    <div className="space-y-3 pt-2">
      {[0, 1, 2].map(i => (
        <div key={i} className="h-20 rounded-2xl" style={{ background: 'rgba(255,255,255,0.04)' }} />
      ))}
    </div>
  </div>
);

// ─── Chunk-error detection ────────────────────────────────────────────────────
function isChunkError(e: Error): boolean {
  const text = (e.name + ' ' + e.message).toLowerCase();
  return (
    text.includes('chunkloaderror') ||
    text.includes('failed to fetch') ||
    text.includes('dynamically imported') ||
    text.includes('loading chunk') ||
    text.includes('failed to load module script') ||
    text.includes('importing a module script failed')
  );
}

// ─── Page-level error boundary ────────────────────────────────────────────────
// Wraps only the page content area so the header / bottom-nav stay visible.
// key={activePage} in the JSX below resets this boundary on every navigation,
// so a page that failed won't block the next one.
interface PEBState { hasError: boolean; isChunk: boolean; }
class PageErrorBoundary extends Component<
  { children: ReactNode; onGoHome: () => void },
  PEBState
> {
  state: PEBState = { hasError: false, isChunk: false };

  static getDerivedStateFromError(e: Error): PEBState {
    return { hasError: true, isChunk: isChunkError(e) };
  }

  componentDidCatch(e: Error, info: ErrorInfo) {
    console.error('[PageErrorBoundary]', e, info);
  }

  retry = () => this.setState({ hasError: false, isChunk: false });

  render() {
    if (!this.state.hasError) return this.props.children;

    // Chunk (network) error — let the user retry without a full page reload
    if (this.state.isChunk) {
      return (
        <div className="flex flex-col items-center justify-center text-center px-6 py-20" style={{ minHeight: '60vh' }}>
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5"
            style={{ background: 'rgba(251,191,36,0.12)' }}>
            <svg className="w-7 h-7" style={{ color: '#fbbf24' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.14 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
            </svg>
          </div>
          <h2 style={{ color: '#fff', fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
            Connection issue
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, marginBottom: 28, maxWidth: 260 }}>
            This page couldn't load. Check your network and tap Retry.
          </p>
          <button
            onClick={this.retry}
            className="px-7 py-3 rounded-xl font-semibold text-white text-sm"
            style={{ background: 'linear-gradient(135deg,#7c3aed,#4f46e5)' }}>
            Retry
          </button>
        </div>
      );
    }

    // Generic page error — offer to go back to home
    return (
      <div className="flex flex-col items-center justify-center text-center px-6 py-20" style={{ minHeight: '60vh' }}>
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5"
          style={{ background: 'rgba(239,68,68,0.12)' }}>
          <svg className="w-7 h-7" style={{ color: '#f87171' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
        </div>
        <h2 style={{ color: '#fff', fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Page error</h2>
        <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, marginBottom: 28, maxWidth: 260 }}>
          Something went wrong on this page. Your session is still active.
        </p>
        <button
          onClick={() => { this.retry(); this.props.onGoHome(); }}
          className="px-7 py-3 rounded-xl font-semibold text-white text-sm"
          style={{ background: 'linear-gradient(135deg,#7c3aed,#4f46e5)' }}>
          Go to Home
        </button>
      </div>
    );
  }
}

// ─── Outer error boundary (whole-app crash safety net) ───────────────────────
interface EBState { hasError: boolean; isChunk: boolean; message: string }
class AppErrorBoundary extends Component<{ children: ReactNode }, EBState> {
  state: EBState = { hasError: false, isChunk: false, message: '' };

  static getDerivedStateFromError(e: Error): EBState {
    return { hasError: true, isChunk: isChunkError(e), message: e.message };
  }

  componentDidCatch(e: Error, info: ErrorInfo) {
    console.error('[AppErrorBoundary]', e, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    const { isChunk, message } = this.state;
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: '#07070F' }}>
        <div className="rounded-3xl p-8 max-w-sm w-full text-center"
          style={{ background: '#111120', border: '1px solid rgba(255,255,255,0.1)' }}>
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: isChunk ? 'rgba(251,191,36,0.12)' : 'rgba(239,68,68,0.15)' }}>
            {isChunk ? (
              <svg className="w-7 h-7" style={{ color: '#fbbf24' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.14 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
              </svg>
            ) : (
              <svg className="w-7 h-7" style={{ color: '#f87171' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
            )}
          </div>
          <h2 style={{ color: '#fff', fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
            {isChunk ? 'Connection issue' : 'Something went wrong'}
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, marginBottom: 24 }}>
            {isChunk
              ? 'The app couldn\'t load a resource. Check your network and reload.'
              : message}
          </p>
          <button
            onClick={() => { this.setState({ hasError: false, isChunk: false, message: '' }); window.location.reload(); }}
            className="w-full py-3 rounded-xl font-medium text-white"
            style={{ background: 'linear-gradient(135deg,#7c3aed,#4f46e5)' }}>
            {isChunk ? 'Reload & Retry' : 'Reload App'}
          </button>
        </div>
      </div>
    );
  }
}

// ─── Page routing ─────────────────────────────────────────────────────────────
type Screen = 'splash' | 'welcome' | 'event-join' | 'main';
type Page =
  | 'home' | 'agenda' | 'events' | 'event-dashboard' | 'engage'
  | 'engage-sponsors' | 'engage-surveys' | 'engage-polls'
  | 'engage-challenges' | 'engage-audience' | 'engage-giveaways'
  | 'leaderboard' | 'profile' | 'edit-profile' | 'attendees' | 'leads' | 'booth' | 'scan'
  | 'my-badge' | 'sponsor-event' | 'sponsor-draw' | 'sponsor-giveaways' | 'partners' | 'meetings' | 'speakers';

const pagesWithGlobalHeader = [
  'home', 'engage-audience', 'engage', 'agenda', 'partners', 'leaderboard',
  'events', 'event-dashboard', 'meetings', 'scan', 'attendees', 'leads',
  'my-badge', 'sponsor-giveaways', 'speakers',
];

function AppContent() {
  const [screen, setScreen]     = useState<Screen>('splash');
  const [activePage, setActivePage] = useState<Page>('home');
  const [moreOpen, setMoreOpen] = useState(false);
  const { user, sessionRestored, hasJoinedEvent, connectionRequests, conversations, eventConfig } = useApp();
  usePreloader(eventConfig?.eventId, hasJoinedEvent);
  const { t, isDark } = useTheme();

  const handleSplashComplete = React.useCallback(() => setScreen('welcome'), []);

  React.useEffect(() => {
    if (!sessionRestored) return;
    if (screen === 'splash') return;
    if (user && screen === 'welcome') setScreen('event-join');
  }, [sessionRestored, user, screen]);

  const unreadCount =
    connectionRequests.filter(r => r.direction === 'incoming' && r.status === 'pending').length +
    conversations.reduce((sum, c) =>
      sum + c.messages.filter(m => m.senderId !== (user?.id || 'current-user') && !m.read).length, 0);

  const handleNavigate = (page: string) => setActivePage(page as Page);
  const handleJoinEvent    = () => { setActivePage('home');           setScreen('main'); };
  const handleViewDashboard = () => { setActivePage('event-dashboard'); setScreen('main'); };

  const PlaceholderPage: React.FC<{ title: string; desc: string; onBack: () => void }> = ({ title, desc, onBack }) => (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: t.bgPage }}>
      <div className="rounded-3xl p-8 max-w-md text-center"
        style={{ background: t.surface, boxShadow: t.shadow, border: `1px solid ${t.border}` }}>
        <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
          style={{ background: t.accentBg }}>
          <svg className="w-8 h-8" style={{ color: t.accent }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
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
      case 'home':             return <HomePage onNavigate={handleNavigate} />;
      case 'agenda':           return <AgendaPage />;
      case 'events':           return <HomePage onNavigate={handleNavigate} />;
      case 'event-dashboard':  return <EventDashboardPage onNavigate={handleNavigate} onBack={() => setActivePage('home')} />;
      case 'engage':           return <EngagePage onNavigate={handleNavigate} />;
      case 'engage-sponsors':  return <SponsorsListPage variant="reviews" onBack={() => setActivePage('engage')} />;
      case 'engage-surveys':   return <SurveysListPage  onBack={() => setActivePage('engage')} />;
      case 'engage-polls':     return <PollsListPage     onBack={() => setActivePage('engage')} />;
      case 'engage-challenges':return <ChallengesPage    onBack={() => setActivePage('engage')} />;
      case 'engage-audience':  return <AudiencePage />;
      case 'engage-giveaways': return <GiveawaysPage onBack={() => setActivePage('home')} />;
      case 'leaderboard':      return <LeaderboardPage />;
      case 'profile':          return <ProfilePage onEdit={() => setActivePage('edit-profile')} />;
      case 'edit-profile':     return <EditProfilePage onBack={() => setActivePage('profile')} />;
      case 'partners':         return <SponsorsListPage variant="listing" />;
      case 'attendees':        return <LeadsPage onNavigateToDraw={user?.role === 'sponsor' ? () => setActivePage('sponsor-draw') : undefined} onNavigateToScan={() => setActivePage('scan')} />;
      case 'leads':            return <LeadsPage onNavigateToDraw={user?.role === 'sponsor' ? () => setActivePage('sponsor-draw') : undefined} onNavigateToScan={() => setActivePage('scan')} />;
      case 'my-badge':         return <MyBadgePage />;
      case 'booth':            return <PlaceholderPage title="Sponsor Booth" desc="Manage your booth profile and promotional materials." onBack={() => setActivePage('home')} />;
      case 'scan':             return <SponsorScannerPage />;
      case 'sponsor-event':    return <SponsorEventPage onBack={() => setActivePage('home')} onNavigate={handleNavigate} />;
      case 'sponsor-draw':     return <SponsorDrawPage onBack={() => setActivePage('attendees')} />;
      case 'sponsor-giveaways':return <SponsorGiveawaysPage />;
      case 'meetings':         return <MeetingsPage />;
      case 'speakers':         return <SpeakersPage />;
      default:                 return <HomePage onNavigate={handleNavigate} />;
    }
  };

  const showBottomNav = (() => {
    if (activePage.startsWith('engage-') && activePage !== 'engage-audience') return false;
    if (['booth', 'sponsor-event', 'sponsor-draw', 'edit-profile'].includes(activePage)) return false;
    return true;
  })();

  const mainTabs = [
    'home', 'events', 'event-dashboard', 'agenda', 'engage', 'leaderboard',
    'profile', 'attendees', 'leads', 'my-badge', 'booth', 'scan',
    'engage-audience', 'sponsor-event', 'sponsor-draw', 'sponsor-giveaways',
    'partners', 'meetings', 'speakers',
  ];
  const isMainTab = mainTabs.includes(activePage);
  const showGlobalHeader = pagesWithGlobalHeader.includes(activePage);

  return (
    <div style={{ minHeight: '100svh', background: isDark ? '#000' : '#e8e4f5', fontFamily: 'Inter,sans-serif' }}>
      {screen === 'splash' && <SplashScreen onComplete={handleSplashComplete} />}
      {screen === 'welcome' && <WelcomeScreen onLogin={() => setScreen('event-join')} />}

      {screen === 'event-join' && user && (
        <div className="mx-auto relative overflow-hidden"
          style={{ maxWidth: 430, minHeight: '100svh', background: t.bgPage }}>
          <EventJoinPage onJoinEvent={handleJoinEvent} onViewDashboard={handleViewDashboard} />
        </div>
      )}

      {screen === 'main' && user && (
        <div className="mx-auto relative overflow-hidden"
          style={{ maxWidth: 430, minHeight: '100svh', background: t.bgPage }}>

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
                  <button onClick={() => setScreen('event-join')}
                    className="w-9 h-9 rounded-full flex items-center justify-center transition-colors"
                    title="Back to events"
                    style={{ background: t.surface, border: `1px solid ${t.border}` }}>
                    <LayoutGrid size={16} color={t.text} />
                  </button>
                  <button className="w-9 h-9 rounded-full flex items-center justify-center transition-colors relative"
                    style={{ background: t.surface, border: `1px solid ${t.border}` }}>
                    <Bell size={16} color={t.text} />
                    <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-red-500 rounded-full border-2"
                      style={{ borderColor: isDark ? '#111120' : '#fff' }} />
                  </button>
                </div>
              </div>
              <BadgeActionButtons onNavigate={handleNavigate} activePage={activePage} />
            </div>
          )}

          {/*
            PageErrorBoundary key={activePage}: resets automatically on every
            navigation so a failed page never blocks the next one.

            Suspense: shows PageSkeleton while the lazy chunk downloads.
            For preloaded pages (cache warm) this is typically invisible (<100ms).
          */}
          <PageErrorBoundary key={activePage} onGoHome={() => setActivePage('home')}>
            <Suspense fallback={<PageSkeleton />}>
              {renderPage()}
            </Suspense>
          </PageErrorBoundary>

          {showBottomNav && isMainTab && (
            <BottomNav
              activeTab={activePage}
              onTabChange={handleNavigate}
              onOpenMore={() => setMoreOpen(true)}
              isMoreOpen={moreOpen}
            />
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
