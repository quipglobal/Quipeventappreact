import { User } from '@/app/context/AppContext';

export interface Story {
  id: string;
  user: {
    name: string;
    avatar: string;
    isLive?: boolean;
  };
  image?: string;
  hasUnseen?: boolean;
}

export interface Comment {
  id: string;
  user: {
    name: string;
    avatar: string;
  };
  text: string;
  timestamp: string;
}

export interface FeedPost {
  id: string;
  type: 'post';
  user: {
    name: string;
    title: string;
    avatar: string;
  };
  content: string;
  image?: string;
  timestamp: string;
  likes: number;
  comments: Comment[];
  shares: number;
  isLiked?: boolean;
}

export interface FeedPollOption {
  id: string;
  text: string;
  votes: number;
}

export interface FeedPoll {
  id: string;
  type: 'poll';
  question: string;
  options: FeedPollOption[];
  totalVotes: number;
  timestamp: string;
  hasVoted?: boolean;
  userVotedOptionId?: string;
}

export type FeedItem = FeedPost | FeedPoll;

export const mockStories: Story[] = [
  {
    id: 's1',
    user: { name: 'Sarah Chen', avatar: 'https://images.unsplash.com/photo-1655249481446-25d575f1c054?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwcm9mZXNzaW9uYWwlMjBwcm9maWxlJTIwcG9ydHJhaXQlMjB3b21hbnxlbnwxfHx8fDE3NzE1MzA0MjV8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral', isLive: true },
    hasUnseen: true,
  },
  {
    id: 's2',
    user: { name: 'Tech Summit', avatar: 'https://images.unsplash.com/photo-1644088379091-d574269d422f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhYnN0cmFjdCUyMHRlY2hub2xvZ3klMjBiYWNrZ3JvdW5kfGVufDF8fHx8MTc3MTUyODg4Mnww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral' },
    hasUnseen: true,
    image: 'https://images.unsplash.com/photo-1573339887617-d674bc961c31?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjb25mZXJlbmNlJTIwc3RhZ2UlMjBsaWdodGluZ3xlbnwxfHx8fDE3NzE1NjExNzB8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
  },
  {
    id: 's3',
    user: { name: 'David Kim', avatar: 'https://images.unsplash.com/photo-1649433658557-54cf58577c68?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwcm9mZXNzaW9uYWwlMjBwcm9maWxlJTIwcG9ydHJhaXQlMjBtYW58ZW58MXx8fHwxNzcxNTU2MTkyfDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral' },
    hasUnseen: false,
  },
  {
    id: 's4',
    user: { name: 'Elena Rodriguez', avatar: 'https://images.unsplash.com/photo-1760611656007-f767a8082758?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtb2Rlcm4lMjBvZmZpY2UlMjBtZWV0aW5nfGVufDF8fHx8MTc3MTU1NDgyM3ww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral' },
    hasUnseen: true,
  },
  {
    id: 's5',
    user: { name: 'Mark Johnson', avatar: 'https://images.unsplash.com/photo-1560439514-4e9645039924?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxuZXR3b3JraW5nJTIwZXZlbnQlMjBjcm93ZHxlbnwxfHx8fDE3NzE1NDk1OTh8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral' },
    hasUnseen: false,
  },
];

export const mockFeedItems: FeedItem[] = [
  {
    id: 'p1',
    type: 'post',
    user: {
      name: 'Jessica Williams',
      title: 'Product Designer at Stripe',
      avatar: 'https://images.unsplash.com/photo-1655249481446-25d575f1c054?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwcm9mZXNzaW9uYWwlMjBwcm9maWxlJTIwcG9ydHJhaXQlMjB3b21hbnxlbnwxfHx8fDE3NzE1MzA0MjV8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
    },
    content: "Just landed at the venue! The stage setup for the opening keynote is absolutely incredible. Who else is excited for the AI panel later today? 🚀✨ #TechSummit2026",
    image: 'https://images.unsplash.com/photo-1573339887617-d674bc961c31?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjb25mZXJlbmNlJTIwc3RhZ2UlMjBsaWdodGluZ3xlbnwxfHx8fDE3NzE1NjExNzB8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
    timestamp: '2m ago',
    likes: 42,
    comments: [
      { id: 'c1', user: { name: 'Alex M.', avatar: '' }, text: 'See you there!', timestamp: '1m ago' }
    ],
    shares: 5,
    isLiked: false,
  },
  {
    id: 'poll1',
    type: 'poll',
    question: "Which topic are you most excited about for tomorrow's sessions?",
    options: [
      { id: 'opt1', text: 'Generative AI in Design', votes: 145 },
      { id: 'opt2', text: 'Sustainable Tech', votes: 89 },
      { id: 'opt3', text: 'Web3 & Decentralization', votes: 62 },
      { id: 'opt4', text: 'Future of Remote Work', votes: 112 },
    ],
    totalVotes: 408,
    timestamp: '1h ago',
    hasVoted: false,
  },
  {
    id: 'p2',
    type: 'post',
    user: {
      name: 'Michael Chen',
      title: 'CTO at StartupX',
      avatar: 'https://images.unsplash.com/photo-1649433658557-54cf58577c68?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwcm9mZXNzaW9uYWwlMjBwcm9maWxlJTIwcG9ydHJhaXQlMjBtYW58ZW58MXx8fHwxNzcxNTU2MTkyfDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
    },
    content: "Great discussion at the networking lunch. It's inspiring to see so many innovators in one room. Connecting with like-minded people is what these events are all about! 🤝",
    timestamp: '3h ago',
    likes: 128,
    comments: [],
    shares: 12,
    isLiked: true,
  },
  {
    id: 'p3',
    type: 'post',
    user: {
      name: 'Sarah Jenkins',
      title: 'Marketing Director',
      avatar: 'https://images.unsplash.com/photo-1760611656007-f767a8082758?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtb2Rlcm4lMjBvZmZpY2UlMjBtZWV0aW5nfGVufDF8fHx8MTc3MTU1NDgyM3ww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
    },
    content: "Don't miss the workshop on 'Brand Storytelling' starting in 15 mins in Room B! We have some exclusive swag for early arrivals! 🎁",
    timestamp: '4h ago',
    likes: 56,
    comments: [],
    shares: 8,
    isLiked: false,
  },
];
