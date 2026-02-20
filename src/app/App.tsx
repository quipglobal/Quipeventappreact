import React, { useState, Component, ErrorInfo, ReactNode } from 'react';
import { AppProvider, useApp } from '@/app/context/AppContext';
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
  | 'home'
  | 'agenda'
  | 'engage'
  | 'engage-sponsors'
  | 'engage-surveys'
  | 'engage-polls'
  | 'engage-challenges'
  | 'engage-audience'
  | 'leaderboard'
  | 'profile'
  | 'attendees'
  | 'booth';

// ─── Error Boundary ─────────────────────────────────────────────────────────
interface ErrorBoundaryState { hasError: boolean; message: string }
class AppErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, message: '' };
  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, message: error.message };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[AppErrorBoundary]', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-purple-50 p-6">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-xl">
            <div className="w-14 h-14 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Something went wrong</h2>
            <p className="text-sm text-gray-500 mb-6">{this.state.message}</p>
            <button
              onClick={() => { this.setState({ hasError: false, message: '' }); window.location.reload(); }}
              className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-medium"
            >
              Reload App
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// ─── AppContent — consumes context (must be inside AppProvider) ─────────────
function AppContent() {
  const [screen, setScreen] = useState<Screen>('splash');
  const [activePage, setActivePage] = useState<Page>('home');
  const { user } = useApp();

  const handleNavigate = (page: string) => {
    setActivePage(page as Page);
  };

  const renderPage = () => {
    switch (activePage) {
      case 'home':
        return <HomePage onNavigate={handleNavigate} />;
      case 'agenda':
        return <AgendaPage />;
      case 'engage':
        return <EngagePage onNavigate={handleNavigate} />;
      case 'engage-sponsors':
        return <SponsorsListPage onBack={() => setActivePage('engage')} />;
      case 'engage-surveys':
        return <SurveysListPage onBack={() => setActivePage('engage')} />;
      case 'engage-polls':
        return <PollsListPage onBack={() => setActivePage('engage')} />;
      case 'engage-challenges':
        return <ChallengesPage onBack={() => setActivePage('engage')} />;
      case 'engage-audience':
        return (
          <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
            <div className="bg-white rounded-3xl p-8 max-w-md text-center shadow-xl">
              <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Networking Coming Soon</h2>
              <p className="text-gray-600 mb-4">
                This module is currently disabled. Connect with other attendees will be available soon!
              </p>
              <button
                onClick={() => setActivePage('engage')}
                className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-medium hover:from-indigo-700 hover:to-purple-700 transition-all"
              >
                Back to Engage
              </button>
            </div>
          </div>
        );
      case 'leaderboard':
        return <LeaderboardPage />;
      case 'profile':
        return <ProfilePage />;
      case 'attendees':
        return (
          <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
            <div className="bg-white rounded-3xl p-8 max-w-md text-center shadow-xl">
              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Attendee Leads</h2>
              <p className="text-gray-600 mb-4">View and manage attendees who have checked in at your booth.</p>
              <button
                onClick={() => setActivePage('home')}
                className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-medium hover:from-purple-700 hover:to-pink-700 transition-all"
              >
                Back to Home
              </button>
            </div>
          </div>
        );
      case 'booth':
        return (
          <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
            <div className="bg-white rounded-3xl p-8 max-w-md text-center shadow-xl">
              <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Sponsor Booth</h2>
              <p className="text-gray-600 mb-4">Manage your booth profile, resources, and promotional materials.</p>
              <button
                onClick={() => setActivePage('home')}
                className="px-6 py-3 bg-gradient-to-r from-orange-600 to-red-600 text-white rounded-xl font-medium hover:from-orange-700 hover:to-red-700 transition-all"
              >
                Back to Home
              </button>
            </div>
          </div>
        );
      default:
        return <HomePage onNavigate={handleNavigate} />;
    }
  };

  const showBottomNav =
    !activePage.startsWith('engage-') && !['attendees', 'booth'].includes(activePage);
  const mainTabs = ['home', 'agenda', 'engage', 'leaderboard', 'profile', 'attendees', 'booth'];
  const isMainTab = mainTabs.includes(activePage);

  return (
    <div className="min-h-screen bg-gray-50">
      {screen === 'splash' && (
        <SplashScreen onComplete={() => setScreen('welcome')} />
      )}

      {screen === 'welcome' && (
        <WelcomeScreen onLogin={() => setScreen('main')} />
      )}

      {screen === 'main' && user && (
        <div className="max-w-md mx-auto bg-white min-h-screen relative">
          {renderPage()}
          {showBottomNav && isMainTab && (
            <BottomNav
              activeTab={activePage}
              onTabChange={handleNavigate}
              userRole={user.role}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ─── Root App — AppProvider wraps AppContent ────────────────────────────────
function App() {
  return (
    <AppErrorBoundary>
      <AppProvider>
        <AppContent />
      </AppProvider>
    </AppErrorBoundary>
  );
}

export default App;
