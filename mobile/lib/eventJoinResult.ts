// A join result can contain a membership resource. Its generic `id` is NOT an
// event id. Only explicitly named event references identify the joined event.
const object = (value: unknown): Record<string, any> =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {};
const id = (value: unknown): string =>
  (typeof value === 'string' || typeof value === 'number') && String(value).trim() !== '0'
    ? String(value).trim() : '';

export function normalizeEventJoinResponse(response: unknown) {
  const outer = object(response);
  const body = object(outer.data);
  const sources = [object(body.data), body, outer];
  const memberships = sources.map(source => object(source.membership));
  const events = [...sources, ...memberships].map(source => object(source.event));
  const eventId = [...sources, ...memberships]
    .map(source => id(source.event_id) || id(source.eventId)).find(Boolean)
    ?? events.map(event => id(event.id)).find(Boolean) ?? '';
  const event = events.find(event => !!eventId && id(event.id) === eventId);
  const membershipIdValue = sources
    .map(source => id(source.membership_id) || id(source.member_id)).find(Boolean)
    ?? memberships.map(membership => id(membership.id)).find(Boolean);
  const membershipId = membershipIdValue && Number.isFinite(Number(membershipIdValue))
    ? Number(membershipIdValue) : undefined;
  const autoCheckedIn = sources.some(source =>
    source.auto_checked_in === true || source.auto_checked_in === 1 ||
    source.auto_checked_in === 'true' || source.auto_checked_in === '1');
  const message = sources.map(source => source.message).find(value => typeof value === 'string');
  return { eventId, event, membershipId, autoCheckedIn,
    message: message ?? 'Successfully joined event!' };
}
