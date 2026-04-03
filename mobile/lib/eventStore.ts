let _eventId: string | null = null;

export function setEventId(id: string | null): void {
  _eventId = id;
}

export function getEventId(): string | null {
  return _eventId;
}
