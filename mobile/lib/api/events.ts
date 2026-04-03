import { request, USE_MOCK } from '@/lib/apiClient';
import { getEventId } from '@/lib/eventStore';
import type { ApiResponse, Event, Session } from '@/lib/api/types';

const delay = (ms = 600) => new Promise<void>((r) => setTimeout(r, ms));

const MOCK_EVENTS: Event[] = [
  { id: 'evt-1', name: 'CXO Tech Summit 2026', code: 'CXOSUMMIT26', startDate: '2026-01-16', endDate: '2026-01-18', location: 'San Francisco, CA', description: 'The premier executive tech conference for CTOs, CIOs, and technology leaders shaping the future.', status: 'live' },
  { id: 'evt-3', name: 'DevCon Winter 2026', code: 'DEVCON26', startDate: '2026-02-20', endDate: '2026-02-22', location: 'Austin, TX', description: 'The annual developer conference bringing together engineers, architects, and product builders.', status: 'upcoming' },
  { id: 'evt-2', name: 'StartupX Conference 2025', code: 'STARTUPX25', startDate: '2025-11-10', endDate: '2025-11-12', location: 'New York, NY', description: 'Where the next generation of startups meets the investors building tomorrow.', status: 'past' },
];

const MOCK_SESSIONS: Session[] = [
  { id: 's1', title: 'Opening Keynote: The Future of AI', speaker: 'Dr. Sarah Chen', speakerTitle: 'Chief AI Officer', speakerCompany: 'TechCorp Solutions', track: 'Keynote', room: 'Main Hall', day: 1, startTime: '09:00', endTime: '10:00', accentColor: '#7c3aed', description: 'An exploration of how AI is fundamentally reshaping every industry vertical, with practical case studies from Fortune 500 companies.', tags: ['AI', 'Strategy', 'Keynote'] },
  { id: 's2', title: 'Scaling Engineering Teams in a Remote World', speaker: 'Marcus Johnson', speakerTitle: 'CTO', speakerCompany: 'InnovateLab', track: 'Engineering', room: 'Room A', day: 1, startTime: '10:30', endTime: '11:30', accentColor: '#06b6d4', description: 'Practical strategies for building and maintaining high-performance engineering teams across time zones.', tags: ['Engineering', 'Leadership', 'Remote'] },
  { id: 's3', title: 'UX Research That Actually Influences Product', speaker: 'Priya Patel', speakerTitle: 'VP Design', speakerCompany: 'DesignFlow', track: 'Design', room: 'Room B', day: 1, startTime: '11:45', endTime: '12:30', accentColor: '#ec4899', description: 'How to bridge the gap between user research insights and product decisions that stick.', tags: ['UX', 'Design', 'Product'] },
  { id: 's4', title: 'ML Applications in Enterprise Products', speaker: 'Elena Rodriguez', speakerTitle: 'Head of ML', speakerCompany: 'QuantumLeap AI', track: 'AI/ML', room: 'Main Hall', day: 1, startTime: '14:00', endTime: '15:00', accentColor: '#10b981', description: 'Real-world ML use cases that moved from prototype to production and delivered measurable ROI.', tags: ['ML', 'Enterprise', 'AI'] },
  { id: 's5', title: 'Building a Culture of Innovation', speaker: 'Jordan Kim', speakerTitle: 'CEO', speakerCompany: 'GrowthOS', track: 'Leadership', room: 'Room A', day: 1, startTime: '15:15', endTime: '16:00', accentColor: '#f59e0b', description: 'What separates organizations that innovate consistently from those that talk about it.', tags: ['Culture', 'Innovation', 'Leadership'] },
  { id: 's6', title: 'The Future of Cloud Infrastructure', speaker: 'David Park', speakerTitle: 'VP Engineering', speakerCompany: 'CloudNine Systems', track: 'Engineering', room: 'Room B', day: 1, startTime: '16:15', endTime: '17:00', accentColor: '#06b6d4', description: 'Multi-cloud, edge computing, and what comes after Kubernetes.', tags: ['Cloud', 'Infrastructure', 'Engineering'] },
  { id: 's7', title: 'Cybersecurity in the AI Era', speaker: 'Amara Nwosu', speakerTitle: 'CISO', speakerCompany: 'SecureNet', track: 'Security', room: 'Main Hall', day: 2, startTime: '09:00', endTime: '10:00', accentColor: '#ef4444', description: 'New attack surfaces, AI-powered threats, and how security teams are fighting back.', tags: ['Security', 'AI', 'Risk'] },
  { id: 's8', title: 'Product-Led Growth Strategies', speaker: 'Tomás Reyes', speakerTitle: 'CPO', speakerCompany: 'PLG Ventures', track: 'Product', room: 'Room A', day: 2, startTime: '10:30', endTime: '11:30', accentColor: '#8b5cf6', description: 'Building products that sell themselves — a deep dive into PLG mechanics that scale.', tags: ['Product', 'Growth', 'Strategy'] },
  { id: 's9', title: 'Sustainable Tech: Beyond the Buzzwords', speaker: 'Lena Fischer', speakerTitle: 'Chief Sustainability Officer', speakerCompany: 'GreenTech Global', track: 'Sustainability', room: 'Room B', day: 2, startTime: '11:45', endTime: '12:30', accentColor: '#10b981', description: 'Practical frameworks for reducing your tech stack\'s carbon footprint while improving efficiency.', tags: ['Sustainability', 'ESG', 'Strategy'] },
  { id: 's10', title: 'Closing Keynote: What\'s Next', speaker: 'Aisha Kamara', speakerTitle: 'Founder & CEO', speakerCompany: 'Nexus Labs', track: 'Keynote', room: 'Main Hall', day: 2, startTime: '16:00', endTime: '17:00', accentColor: '#7c3aed', description: 'A visionary look at the technology trends that will define the next decade.', tags: ['Keynote', 'Future', 'Technology'] },
];

function normalizeSession(raw: any): Session {
  return {
    id: String(raw.id),
    title: raw.title ?? raw.name ?? '',
    speaker: raw.speaker ?? raw.speaker_name ?? raw.presenter ?? '',
    speakerTitle: raw.speaker_title ?? raw.speakerTitle ?? raw.presenter_title ?? '',
    speakerCompany: raw.speaker_company ?? raw.speakerCompany ?? raw.presenter_company ?? '',
    track: raw.track ?? raw.category ?? '',
    room: raw.room ?? raw.location ?? raw.venue ?? '',
    day: Number(raw.day ?? raw.day_number ?? 1),
    startTime: raw.start_time ?? raw.startTime ?? '',
    endTime: raw.end_time ?? raw.endTime ?? '',
    accentColor: raw.accent_color ?? raw.accentColor ?? '#7c3aed',
    description: raw.description ?? '',
    tags: Array.isArray(raw.tags) ? raw.tags : [],
  };
}

export async function listEvents(): Promise<ApiResponse<Event[]>> {
  if (USE_MOCK) {
    await delay();
    return { success: true, data: MOCK_EVENTS };
  }
  return request<Event[]>('/api/v1/events');
}

export async function getEvent(id: string): Promise<ApiResponse<Event>> {
  if (USE_MOCK) {
    await delay();
    const event = MOCK_EVENTS.find((e) => e.id === id || e.code === id);
    if (!event) return { success: false, error: { code: 'NOT_FOUND', message: 'Event not found' } };
    return { success: true, data: event };
  }
  return request<Event>(`/api/v1/events/${id}`);
}

export async function joinEventByCode(code: string): Promise<ApiResponse<Event>> {
  if (USE_MOCK) {
    await delay(1000);
    const event = MOCK_EVENTS.find((e) => e.code === code.toUpperCase());
    if (!event) throw new Error(`No event found for code "${code.toUpperCase()}"`);
    return { success: true, data: event };
  }
  return request<Event>('/api/v1/events/join', { method: 'POST', body: JSON.stringify({ code }) });
}

export async function listSessions(filters?: { day?: number; track?: string }): Promise<ApiResponse<Session[]>> {
  if (USE_MOCK) {
    await delay();
    let sessions = MOCK_SESSIONS;
    if (filters?.day) sessions = sessions.filter((s) => s.day === filters.day);
    if (filters?.track) sessions = sessions.filter((s) => s.track === filters.track);
    return { success: true, data: sessions };
  }
  const eventId = getEventId();
  if (!eventId) return { success: true, data: MOCK_SESSIONS };
  const params = new URLSearchParams();
  if (filters?.day) params.set('day', String(filters.day));
  if (filters?.track) params.set('track', filters.track);
  const query = params.toString() ? `?${params.toString()}` : '';
  const res = await request<any>(`/api/v1/events/${eventId}/mobile-agenda${query}`);
  if (!res.success) return res as ApiResponse<Session[]>;
  const raw: any[] = Array.isArray(res.data) ? res.data : (res.data?.data ?? res.data?.agenda ?? []);
  return { success: true, data: raw.map(normalizeSession) };
}

export async function getSession(id: string): Promise<ApiResponse<Session>> {
  if (USE_MOCK) {
    await delay(400);
    const session = MOCK_SESSIONS.find((s) => s.id === id);
    if (!session) return { success: false, error: { code: 'NOT_FOUND', message: 'Session not found' } };
    return { success: true, data: session };
  }
  return request<Session>(`/api/v1/sessions/${id}`);
}

export async function bookmarkSession(sessionId: string, bookmarked: boolean): Promise<ApiResponse<{ bookmarked: boolean }>> {
  if (USE_MOCK) {
    await delay(300);
    return { success: true, data: { bookmarked } };
  }
  return request<{ bookmarked: boolean }>('/api/v1/sessions/bookmark', {
    method: 'POST',
    body: JSON.stringify({ sessionId, bookmarked }),
  });
}
