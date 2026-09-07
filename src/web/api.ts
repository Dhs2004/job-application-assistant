import type { AutomationSettings, DashboardData, DeliveryRecord, EmailDraft } from '../shared/types';

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json', ...init?.headers } });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({ error: `HTTP ${response.status}` })) as { error?: string };
    throw new Error(payload.error ?? '请求失败');
  }
  return response.status === 204 ? undefined as T : response.json() as Promise<T>;
}

export const api = {
  dashboard: () => request<DashboardData>('/api/dashboard'),
  uploadProfile: (payload: unknown) => request<DashboardData>('/api/profile', { method: 'POST', body: JSON.stringify(payload) }),
  updateProfile: (payload: unknown) => request<DashboardData>('/api/profile', { method: 'PATCH', body: JSON.stringify(payload) }),
  loadSamples: () => request<DashboardData>('/api/jobs/sample', { method: 'POST' }),
  importFeed: (url: string) => request<{ imported: number; dashboard: DashboardData }>('/api/jobs/feed', { method: 'POST', body: JSON.stringify({ url }) }),
  draft: (jobId: string) => request<EmailDraft>(`/api/jobs/${encodeURIComponent(jobId)}/draft`),
  testMail: (recipient: string) => request<DashboardData>('/api/mail/test', { method: 'POST', body: JSON.stringify({ recipient }) }),
  saveAutomation: (settings: Omit<AutomationSettings, 'smtpTested'>) => request<DashboardData>('/api/automation', { method: 'PUT', body: JSON.stringify(settings) }),
  runAutomation: () => request<{ sent: number; skipped: number }>('/api/automation/run', { method: 'POST' }),
  send: (jobId: string, draft: EmailDraft) => request<DeliveryRecord>(`/api/jobs/${encodeURIComponent(jobId)}/send`, { method: 'POST', body: JSON.stringify(draft) }),
  clear: () => request<void>('/api/data', { method: 'DELETE' }),
};
