/**
 * Events API Client
 * ─────────────────────────────────────────────────────────────────────────────
 * Typed functions for event listing, event detail, and joining events.
 * The mock layer simulates real API responses; swap in real fetch calls when
 * the backend is wired by replacing the mock blocks below.
 *
 * API CONTRACT (planned):
 *   GET  /events                      ?status=live|upcoming|past  → ListEventsResponse
 *   GET  /events/:id                                               → EventDetailResponse
 *   POST /events/join                 { code: string }            → JoinEventResponse
 */

import { BASE_URL } from './authClient';

// ─── Types ────────────────────────────────────────────────────────────────────

export type EventStatus = 'live' | 'upcoming' | 'past';
export type EventCategory = 'conference' | 'workshop' | 'webinar' | 'meetup' | 'hackathon' | 'summit';

export interface OrganizerEvent {
  id: string;
  title: string;
  organizer: string;
  cover: string;
  status: EventStatus;
  category: EventCategory;
  dates: string;
  dateRange: { start: string; end: string };
  location: string;
  isVirtual: boolean;
  attendees: number;
  capacity: number;
  description: string;
  tags: string[];
  speakers: number;
  sessions: number;
  isFeatured?: boolean;
  isRegistered?: boolean;
  price?: string;
}

export interface ListEventsResponse {
  success: boolean;
  data?: OrganizerEvent[];
  error?: { message: string };
}

export interface EventDetailResponse {
  success: boolean;
  data?: OrganizerEvent;
  error?: { message: string };
}

export interface JoinEventResponse {
  success: boolean;
  data?: { eventId: string; message: string };
  error?: { code: string; message: string };
}

// ─── Mock data ────────────────────────────────────────────────────────────────

const MOCK_EVENTS: OrganizerEvent[] = [
  {
    id: 'ev-1',
    title: 'Tech Summit 2026',
    organizer: 'TechConnect Global',
    cover: 'https://images.unsplash.com/photo-1762968269894-1d7e1ce8894e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx0ZWNoJTIwY29uZmVyZW5jZSUyMHN0YWdlJTIwYXVkaWVuY2V8ZW58MXx8fHwxNzcxODMyNDc5fDA&ixlib=rb-4.1.0&q=80&w=1080',
    status: 'live',
    category: 'conference',
    dates: 'Jan 16–18, 2026',
    dateRange: { start: '2026-01-16', end: '2026-01-18' },
    location: 'San Francisco, CA',
    isVirtual: false,
    attendees: 2400,
    capacity: 3000,
    description: 'The premier technology conference connecting innovators, developers, and industry leaders for three days of keynotes, workshops, and networking.',
    tags: ['AI', 'Cloud', 'Startups', 'Sustainability'],
    speakers: 48,
    sessions: 36,
    isFeatured: true,
    isRegistered: true,
    price: 'Free',
  },
  {
    id: 'ev-2',
    title: 'AI & Machine Learning Masterclass',
    organizer: 'TechConnect Global',
    cover: 'https://images.unsplash.com/photo-1691026336764-f24456f76e03?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxBSSUyMHN1bW1pdCUyMGtleW5vdGUlMjBzcGVha2VyfGVufDF8fHx8MTc3MTgzMjQ4MHww&ixlib=rb-4.1.0&q=80&w=1080',
    status: 'upcoming',
    category: 'workshop',
    dates: 'Feb 10–11, 2026',
    dateRange: { start: '2026-02-10', end: '2026-02-11' },
    location: 'Online',
    isVirtual: true,
    attendees: 850,
    capacity: 1500,
    description: 'A two-day intensive workshop on building production-grade ML pipelines, LLM fine-tuning, and responsible AI deployment.',
    tags: ['AI', 'Machine Learning', 'LLMs', 'Hands-on'],
    speakers: 12,
    sessions: 8,
    price: '$99',
  },
  {
    id: 'ev-3',
    title: 'Global Hackathon: Build for Good',
    organizer: 'TechConnect Global',
    cover: 'https://images.unsplash.com/photo-1625335534303-a3c1a3744694?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzdGFydHVwJTIwaGFja2F0aG9uJTIwd29ya3Nob3B8ZW58MXx8fHwxNzcxODMyNDc5fDA&ixlib=rb-4.1.0&q=80&w=1080',
    status: 'upcoming',
    category: 'hackathon',
    dates: 'Mar 1–3, 2026',
    dateRange: { start: '2026-03-01', end: '2026-03-03' },
    location: 'Hybrid — SF + Online',
    isVirtual: false,
    attendees: 320,
    capacity: 500,
    description: '48-hour hackathon focused on building technology solutions for social impact. Open to all skill levels with $50K in prizes.',
    tags: ['Hackathon', 'Social Impact', 'Open Source'],
    speakers: 6,
    sessions: 4,
    isFeatured: true,
    price: 'Free',
  },
  {
    id: 'ev-4',
    title: 'GreenTech Innovation Forum',
    organizer: 'TechConnect Global',
    cover: 'https://images.unsplash.com/photo-1763543007050-4dac73ffc67f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzdXN0YWluYWJpbGl0eSUyMGdyZWVuJTIwdGVjaCUyMGlubm92YXRpb258ZW58MXx8fHwxNzcxODMyNDgxfDA&ixlib=rb-4.1.0&q=80&w=1080',
    status: 'upcoming',
    category: 'summit',
    dates: 'Apr 22–23, 2026',
    dateRange: { start: '2026-04-22', end: '2026-04-23' },
    location: 'Austin, TX',
    isVirtual: false,
    attendees: 180,
    capacity: 800,
    description: 'A two-day summit exploring sustainability in tech — from carbon-neutral data centers to circular electronics and ESG compliance.',
    tags: ['Sustainability', 'CleanTech', 'ESG'],
    speakers: 22,
    sessions: 16,
    price: '$149',
  },
  {
    id: 'ev-5',
    title: 'Product & Design Leadership',
    organizer: 'TechConnect Global',
    cover: 'https://images.unsplash.com/photo-1763630730206-2c3a5d6c82d1?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxkZXNpZ24lMjBjb25mZXJlbmNlJTIwY3JlYXRpdmUlMjB3b3Jrc2hvcHxlbnwxfHx8fDE3NzE4MzI0ODJ8MA&ixlib=rb-4.1.0&q=80&w=1080',
    status: 'upcoming',
    category: 'conference',
    dates: 'May 15–16, 2026',
    dateRange: { start: '2026-05-15', end: '2026-05-16' },
    location: 'New York, NY',
    isVirtual: false,
    attendees: 0,
    capacity: 600,
    description: 'Where product managers and design leaders come together to share frameworks, case studies, and strategies for building world-class products.',
    tags: ['Product', 'Design', 'Leadership', 'UX'],
    speakers: 18,
    sessions: 14,
    price: '$199',
  },
  {
    id: 'ev-6',
    title: 'DevOps & Platform Engineering Summit',
    organizer: 'TechConnect Global',
    cover: 'https://images.unsplash.com/photo-1517309561013-16f6e4020305?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxkZXZlbG9wZXIlMjBwcm9ncmFtbWluZyUyMGNvbW11bml0eSUyMGdyb3VwfGVufDF8fHx8MTc3MTgzMjQ4NXww&ixlib=rb-4.1.0&q=80&w=1080',
    status: 'upcoming',
    category: 'summit',
    dates: 'Jun 5–6, 2026',
    dateRange: { start: '2026-06-05', end: '2026-06-06' },
    location: 'Online',
    isVirtual: true,
    attendees: 0,
    capacity: 2000,
    description: 'Deep-dive into platform engineering, Kubernetes, CI/CD pipelines, and the future of developer experience.',
    tags: ['DevOps', 'Kubernetes', 'Platform', 'CI/CD'],
    speakers: 24,
    sessions: 20,
    price: 'Free',
  },
  {
    id: 'ev-7',
    title: 'Women in Tech Leadership Mixer',
    organizer: 'TechConnect Global',
    cover: 'https://images.unsplash.com/photo-1768508949307-044ec3c1836a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxidXNpbmVzcyUyMG5ldHdvcmtpbmclMjBldmVudCUyMGNvY2t0YWlsfGVufDF8fHx8MTc3MTgyMjM3Mnww&ixlib=rb-4.1.0&q=80&w=1080',
    status: 'past',
    category: 'meetup',
    dates: 'Dec 8, 2025',
    dateRange: { start: '2025-12-08', end: '2025-12-08' },
    location: 'San Francisco, CA',
    isVirtual: false,
    attendees: 210,
    capacity: 250,
    description: 'An evening of networking, mentorship, and inspiration celebrating women leaders shaping the future of technology.',
    tags: ['Networking', 'Diversity', 'Leadership'],
    speakers: 5,
    sessions: 3,
    price: 'Free',
  },
  {
    id: 'ev-8',
    title: 'Cloud Security Webinar Series',
    organizer: 'TechConnect Global',
    cover: 'https://images.unsplash.com/photo-1758598306845-8630d064a244?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx2aXJ0dWFsJTIwd2ViaW5hciUyMG9ubGluZSUyMHByZXNlbnRhdGlvbnxlbnwxfHx8fDE3NzE4MzI0ODJ8MA&ixlib=rb-4.1.0&q=80&w=1080',
    status: 'past',
    category: 'webinar',
    dates: 'Nov 12–14, 2025',
    dateRange: { start: '2025-11-12', end: '2025-11-14' },
    location: 'Online',
    isVirtual: true,
    attendees: 1050,
    capacity: 1500,
    description: 'Three-part webinar series covering zero-trust architecture, cloud-native security, and incident response best practices.',
    tags: ['Security', 'Cloud', 'Zero Trust'],
    speakers: 8,
    sessions: 3,
    price: 'Free',
  },
];

const delay = (ms = 700) => new Promise<void>(res => setTimeout(res, ms));

// ─── API Methods ──────────────────────────────────────────────────────────────

/**
 * GET /events
 * Returns a list of events, optionally filtered by status.
 */
export async function listEventsApi(status?: EventStatus): Promise<ListEventsResponse> {
  await delay();

  /* ── Real implementation ────────────────────────────────────────────────
  const params = status ? `?status=${status}` : '';
  const token = localStorage.getItem('auth_token');
  const res = await fetch(`${BASE_URL}/events${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json() as Promise<ListEventsResponse>;
  ─────────────────────────────────────────────────────────────────────── */

  const data = status ? MOCK_EVENTS.filter(e => e.status === status) : MOCK_EVENTS;
  return { success: true, data };
}

/**
 * GET /events/:id
 * Returns a single event's full details.
 */
export async function getEventApi(id: string): Promise<EventDetailResponse> {
  await delay(500);

  /* ── Real implementation ────────────────────────────────────────────────
  const token = localStorage.getItem('auth_token');
  const res = await fetch(`${BASE_URL}/events/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json() as Promise<EventDetailResponse>;
  ─────────────────────────────────────────────────────────────────────── */

  const event = MOCK_EVENTS.find(e => e.id === id);
  if (!event) return { success: false, error: { message: 'Event not found' } };
  return { success: true, data: event };
}

/**
 * POST /events/join
 * Join an event by access code. Returns the matched event id on success.
 */
export async function joinEventByCodeApi(code: string): Promise<JoinEventResponse> {
  await delay(800);

  /* ── Real implementation ────────────────────────────────────────────────
  const token = localStorage.getItem('auth_token');
  const res = await fetch(`${BASE_URL}/events/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ code }),
  });
  return res.json() as Promise<JoinEventResponse>;
  ─────────────────────────────────────────────────────────────────────── */

  if (code.toUpperCase() === 'TECH2026') {
    return { success: true, data: { eventId: 'ev-1', message: 'Successfully joined Tech Summit 2026!' } };
  }
  return { success: false, error: { code: 'INVALID_CODE', message: 'Invalid event code. Please try again.' } };
}
