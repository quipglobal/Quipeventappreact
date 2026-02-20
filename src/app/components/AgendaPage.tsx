import React, { useState } from 'react';
import { Clock, MapPin, Users, Bookmark, Search, Filter, ChevronDown, Tag } from 'lucide-react';
import { useApp } from '@/app/context/AppContext';
import { mockSessions } from '@/app/data/mockData';

export const AgendaPage: React.FC = () => {
  const { bookmarkedSessions, toggleBookmark } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDay, setSelectedDay] = useState('all');
  const [selectedTrack, setSelectedTrack] = useState('all');
  const [selectedType, setSelectedType] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState<'all' | 'bookmarked'>('all');

  const days = ['All Days', 'Day 1', 'Day 2', 'Day 3'];
  const tracks = ['All Tracks', 'Keynote', 'AI & ML', 'Sustainability', 'Startups'];
  const types = ['All Types', 'Keynote', 'Workshop', 'Panel', 'Competition'];

  const filteredSessions = mockSessions.filter(session => {
    const matchesSearch = session.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         session.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTrack = selectedTrack === 'all' || session.track === selectedTrack;
    const matchesType = selectedType === 'all' || session.type === selectedType;
    const matchesView = viewMode === 'all' || bookmarkedSessions.includes(session.id);
    
    return matchesSearch && matchesTrack && matchesType && matchesView;
  });

  return (
    <div className="pb-20 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 px-6 pt-12 pb-6 text-white sticky top-0 z-10">
        <h1 className="text-2xl font-bold mb-4">Event Agenda</h1>
        
        {/* Search Bar */}
        <div className="relative mb-4">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search sessions..."
            className="w-full pl-12 pr-4 py-3 rounded-xl text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-white/50"
          />
        </div>

        {/* View Toggle & Filter Button */}
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-white/20 backdrop-blur-sm rounded-xl p-1 flex">
            <button
              onClick={() => setViewMode('all')}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                viewMode === 'all' ? 'bg-white text-indigo-600' : 'text-white'
              }`}
            >
              All Sessions
            </button>
            <button
              onClick={() => setViewMode('bookmarked')}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                viewMode === 'bookmarked' ? 'bg-white text-indigo-600' : 'text-white'
              }`}
            >
              My Agenda
            </button>
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="bg-white/20 backdrop-blur-sm p-3 rounded-xl hover:bg-white/30 transition-all"
          >
            <Filter className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="bg-white border-b border-gray-200 px-6 py-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-2">Track</label>
            <select
              value={selectedTrack}
              onChange={(e) => setSelectedTrack(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {tracks.map(track => (
                <option key={track} value={track === 'All Tracks' ? 'all' : track}>
                  {track}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-2">Type</label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {types.map(type => (
                <option key={type} value={type === 'All Types' ? 'all' : type}>
                  {type}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Sessions List */}
      <div className="px-6 py-6">
        {filteredSessions.length === 0 ? (
          <div className="text-center py-12">
            <Bookmark className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-gray-900 mb-2">
              {viewMode === 'bookmarked' ? 'No Bookmarked Sessions' : 'No Sessions Found'}
            </h3>
            <p className="text-gray-600 text-sm">
              {viewMode === 'bookmarked' 
                ? 'Start bookmarking sessions to build your personal agenda'
                : 'Try adjusting your filters or search query'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredSessions.map((session) => {
              const isBookmarked = bookmarkedSessions.includes(session.id);
              return (
                <div
                  key={session.id}
                  className="bg-white rounded-2xl shadow-md p-5 hover:shadow-lg transition-all"
                >
                  {/* Time & Room */}
                  <div className="flex items-center gap-2 mb-3">
                    <div className="bg-indigo-100 rounded-lg px-3 py-1.5 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-indigo-600" />
                      <span className="text-sm font-bold text-indigo-600">
                        {session.startTime} - {session.endTime}
                      </span>
                    </div>
                    <div className="bg-gray-100 rounded-lg px-3 py-1.5 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-gray-600" />
                      <span className="text-sm font-medium text-gray-600">{session.room}</span>
                    </div>
                  </div>

                  {/* Title & Bookmark */}
                  <div className="flex items-start gap-3 mb-2">
                    <h3 className="flex-1 font-bold text-gray-900">{session.title}</h3>
                    <button
                      onClick={() => toggleBookmark(session.id)}
                      className={`p-2 rounded-lg transition-all ${
                        isBookmarked
                          ? 'bg-yellow-100 text-yellow-600'
                          : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                      }`}
                    >
                      <Bookmark className={`w-5 h-5 ${isBookmarked ? 'fill-current' : ''}`} />
                    </button>
                  </div>

                  {/* Speaker */}
                  {session.speakers.length > 0 && (
                    <div className="flex items-center gap-2 mb-3">
                      <img
                        src={session.speakers[0].avatar}
                        alt={session.speakers[0].name}
                        className="w-8 h-8 rounded-full"
                      />
                      <div className="text-sm">
                        <p className="font-medium text-gray-900">{session.speakers[0].name}</p>
                        <p className="text-gray-500">{session.speakers[0].title}</p>
                      </div>
                    </div>
                  )}

                  {/* Description */}
                  <p className="text-sm text-gray-600 mb-3">{session.description}</p>

                  {/* Tags */}
                  <div className="flex flex-wrap gap-2">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-purple-100 text-purple-700 rounded-lg text-xs font-medium">
                      <Tag className="w-3 h-3" />
                      {session.track}
                    </span>
                    {session.tags.slice(0, 2).map((tag) => (
                      <span
                        key={tag}
                        className="px-2.5 py-1 bg-gray-100 text-gray-700 rounded-lg text-xs font-medium"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>

                  {/* Session Actions */}
                  {(session.pollId || session.surveyId) && (
                    <div className="mt-3 pt-3 border-t border-gray-200 flex items-center gap-2">
                      {session.pollId && (
                        <div className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-medium">
                          📊 Live Poll Available
                        </div>
                      )}
                      {session.surveyId && (
                        <div className="px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-lg text-xs font-medium">
                          📝 Session Survey
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
