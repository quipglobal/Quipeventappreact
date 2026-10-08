// Platform-independent membership resolution, shared by mobile and web.
export interface EventIdentity { id?: string | number; email?: string }
interface Response {
  success: boolean;
  data?: unknown;
  error?: { code?: string; message: string };
}
export interface MembershipResult {
  success: boolean;
  data?: { is_member: boolean; role: string | null };
  error?: { code: string; message: string };
}
const object = (value: unknown): Record<string, any> =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {};
const truth = (value: unknown) => value === true || value === 1 || value === '1' || value === 'true';
const blocked = (value: unknown) =>
  ['inactive', 'revoked', 'removed', 'rejected', 'banned', 'suspended', 'cancelled', 'pending', 'blocked']
    .includes(String(value ?? '').toLowerCase());

export function membershipRole(raw: Record<string, any>): 'sponsor' | 'attendee' {
  const roles = [raw.role, ...(Array.isArray(raw.roles) ? raw.roles : [])]
    .map(r => String(typeof r === 'object' ? r?.name ?? '' : r ?? '').toLowerCase().replace(/[\s-]+/g, '_'));
  return roles.some(r => ['sponsor', 'sponsor_rep', 'sponsor_representative', 'exhibitor', 'exhibitor_rep'].includes(r))
    ? 'sponsor' : 'attendee';
}

export async function resolveEventMembership(
  access: Response,
  identity: EventIdentity | undefined,
  fetchMembers: (page: number) => Promise<Response>,
  fetchAttendees?: (page: number) => Promise<Response>,
): Promise<MembershipResult> {
  const outer = object(access.data ?? access);
  const raw = object(outer.data ?? outer);
  const membership = object(raw.membership);
  if (access.success && (blocked(raw.status) || blocked(membership.status))) {
    return { success: true, data: { is_member: false, role: null } };
  }
  if (access.success && (
    truth(raw.is_member) || truth(raw.has_access) || truth(raw.is_registered) ||
    (raw.membership_id != null && String(raw.membership_id) !== '' && String(raw.membership_id) !== '0') ||
    (membership.id != null && String(membership.id) !== '' && String(membership.id) !== '0')
  )) {
    const roles = { ...raw, ...membership };
    return { success: true, data: { is_member: true, role:
      roles.role || roles.roles ? membershipRole(roles) : null } };
  }

  // A role alone, the public event list, and local join history are NOT
  // authorization. Confirm this account in the authenticated event roster.
  if (identity?.id || identity?.email) {
    let completedRoster = false;
    for (const fetchRoster of [fetchMembers, fetchAttendees]) {
      if (!fetchRoster) continue;
      for (let page = 1; page <= 20; page++) {
      const res = await fetchRoster(page);
      if (!res.success) break;
      const body = res.data ?? res;
      const outerList = object(body);
      const paginator = object(outerList.data ?? outerList);
      const list: unknown[] | undefined = Array.isArray(body) ? body
        : Array.isArray(outerList.data) ? outerList.data
        : Array.isArray(paginator.data) ? paginator.data
        : Array.isArray(paginator.members) ? paginator.members
        : Array.isArray(paginator.attendees) ? paginator.attendees : undefined;
      if (!list) break;
      const me = list.map(object).find(row => {
        const account = object(row.user);
        const userId = row.user_id ?? account.id ?? row.id;
        const email = String(row.email ?? account.email ?? '').trim().toLowerCase();
        return (identity.id != null && String(userId) === String(identity.id)) ||
          (!!identity.email && email === identity.email.trim().toLowerCase());
      });
      if (me) {
        const active = !blocked(me.status) && !blocked(object(me.membership).status);
        return { success: true, data: { is_member: active, role: active
          ? membershipRole({ ...me, ...object(me.membership) }) : null } };
      }
      const lastPage = Number(paginator.last_page ?? object(outerList.meta).last_page);
      if ((lastPage > 0 && page >= lastPage) || (!lastPage && list.length < 100)) {
        completedRoster = true;
        break;
      }
      }
    }
    if (completedRoster) {
      return { success: true, data: { is_member: false, role: null } };
    }
  }
  if (access.success && (raw.is_member === false || raw.is_member === 0 || raw.is_member === 'false' || raw.has_access === false)) {
    return { success: true, data: { is_member: false, role: null } };
  }
  return { success: false, error: {
    code: 'ACCESS_UNAVAILABLE',
    message: 'We could not verify your event access. Please try again; your event key may still be valid.',
  } };
}
