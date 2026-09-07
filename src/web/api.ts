import type { AiConnectionInput, DashboardData, DeliveryRecord, EmailDraft, SmtpConnectionInput } from '../shared/types';

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json', ...init?.headers } });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({ error: `HTTP ${response.status}` })) as { error?: string };
    throw new Error(payload.error ?? '请求失败');
  }
  return response.status === 204 ? undefined as T : response.json() as Promise<T>;
}

const post = <T>(url: string, body?: unknown) => request<T>(url, { method: 'POST', body: JSON.stringify(body ?? {}) });

export const api = {
  dashboard: () => request<DashboardData>('/api/dashboard'),
  connectAi: (payload: AiConnectionInput) => post<DashboardData>('/api/ai/connect', payload),
  uploadProfile: (payload: unknown) => post<DashboardData>('/api/profile', payload),
  updateProfile: (payload: unknown) => request<DashboardData>('/api/profile', { method: 'PATCH', body: JSON.stringify(payload) }),
  discover: (query: string) => post<{ jobs: DashboardData['jobs']; filtered: number; dashboard: DashboardData }>('/api/jobs/discover', { query, limit: 10 }),
  loadDemo: () => post<DashboardData>('/api/jobs/demo'),
  connectSmtp: (payload: SmtpConnectionInput) => post<DashboardData>('/api/smtp/connect', payload),
  confirm: (jobId: string, draft: EmailDraft) => post<{ token: string }>(`/api/jobs/${encodeURIComponent(jobId)}/confirmation`, draft),
  send: (jobId: string, token: string, draft: EmailDraft) => post<DeliveryRecord>(`/api/jobs/${encodeURIComponent(jobId)}/send`, { token, draft }),
  clear: () => request<void>('/api/data', { method: 'DELETE' }),
};
