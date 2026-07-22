import { request } from '@/lib/apiClient';
import type { ApiResponse } from '@/lib/api/types';

export interface CompanyLookup {
  id: number;
  name: string;
}

export async function listAllCompanies(): Promise<ApiResponse<CompanyLookup[]>> {
  const res = await request<any>('/api/v1/companies?per_page=300');
  if (!res.success) {
    return {
      success: false,
      error: res.error ?? { code: 'FETCH_FAILED', message: 'Failed to load companies' },
    };
  }
  const body = res.data as any;
  const raw: any[] = Array.isArray(body)
    ? body
    : Array.isArray(body?.data)
      ? body.data
      : Array.isArray(body?.data?.data)
        ? body.data.data
        : [];
  const list: CompanyLookup[] = raw
    .map((c: any) => ({ id: Number(c.id), name: String(c.name ?? '') }))
    .filter((c) => c.id && c.name);
  list.sort((a, b) => a.name.localeCompare(b.name));
  return { success: true, data: list };
}
