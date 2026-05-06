import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { setEventId } from '@/lib/eventStore';
import { resetVideoFeedsFlag } from '@/lib/api/feed';

const EVENT_KEY = 'cxo_current_event_id';

interface EventContextValue {
  currentEventId: string | null;
  setCurrentEventId: (id: string | null) => void;
}

const EventContext = createContext<EventContextValue | undefined>(undefined);

export function useEvent(): EventContextValue {
  const ctx = useContext(EventContext);
  if (!ctx) throw new Error('useEvent must be used within EventProvider');
  return ctx;
}

export function EventProvider({ children }: { children: React.ReactNode }) {
  const [currentEventId, setCurrentEventIdState] = useState<string | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(EVENT_KEY).then((id) => {
      if (id) {
        setCurrentEventIdState(id);
        setEventId(id);
      }
    }).catch(() => {});
  }, []);

  const setCurrentEventId = useCallback((id: string | null) => {
    setCurrentEventIdState(id);
    setEventId(id);
    // Reset session-scoped NOT_IMPLEMENTED flags whenever the event
    // changes. Without this, the first event the user visits in a
    // session permanently decides whether the route is "available"
    // for every subsequent event — so e.g. an Austin 404 would make
    // LA's videos invisible too.
    resetVideoFeedsFlag();
    if (id) {
      AsyncStorage.setItem(EVENT_KEY, id).catch(() => {});
    } else {
      AsyncStorage.removeItem(EVENT_KEY).catch(() => {});
    }
  }, []);

  return (
    <EventContext.Provider value={{ currentEventId, setCurrentEventId }}>
      {children}
    </EventContext.Provider>
  );
}
