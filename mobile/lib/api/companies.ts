import { request } from '@/lib/apiClient';
import type { ApiResponse } from '@/lib/api/types';

export interface CompanyLookup {
  id: number;
  name: string;
}

/**
 * Fetches ALL companies by paginating through every page the backend returns.
 * Uses per_page=500 per call; follows `data.last_page` from Laravel pagination.
 */
export async function listAllCompanies(): Promise<ApiResponse<CompanyLookup[]>> {
  const all: CompanyLookup[] = [];
  const perPage = 500;
  let page = 1;

  while (true) {
    const res = await request<any>(`/api/v1/companies?per_page=${perPage}&page=${page}`);
    if (!res.success) {
      if (all.length > 0) break;
      return {
        success: false,
        error: res.error ?? { code: 'FETCH_FAILED', message: 'Failed to load companies' },
      };
    }

    const body = res.data as any;
    const paginator: any = body?.data ?? body;
    const raw: any[] = Array.isArray(paginator?.data)
      ? paginator.data
      : Array.isArray(body?.data)
      ? body.data
      : Array.isArray(body)
      ? body
      : [];

    const lastPage: number = Number(
      paginator?.last_page ?? paginator?.meta?.last_page ?? body?.last_page ?? 1,
    );

    for (const c of raw) {
      const id = Number(c.id);
      const name = String(c.name ?? '');
      if (id && name) all.push({ id, name });
    }

    if (page >= lastPage || raw.length < perPage) break;
    page++;
  }

  all.sort((a, b) => a.name.localeCompare(b.name));

  const seen = new Set<number>();
  const unique = all.filter(c => {
    if (seen.has(c.id)) return false;
    seen.add(c.id);
    return true;
  });

  return { success: true, data: unique };
}
