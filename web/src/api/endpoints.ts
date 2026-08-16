import { apiFetch, setToken } from './client';
import {
  AccountDetail,
  Alert,
  Case,
  CaseDetail,
  CaseNote,
  CaseStatus,
  DetectionRunSummaryEntry,
  RiskScore,
  Subgraph,
  TransactionDetail
} from './types';

export async function login(username: string, password: string): Promise<void> {
  const { token } = await apiFetch<{ token: string }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password })
  });
  setToken(token);
}

export function listAlerts(params: { rule?: string; limit?: number; offset?: number } = {}) {
  const query = new URLSearchParams();
  if (params.rule) query.set('rule', params.rule);
  if (params.limit) query.set('limit', String(params.limit));
  if (params.offset) query.set('offset', String(params.offset));
  const qs = query.toString();
  return apiFetch<{ alerts: Alert[]; limit: number; offset: number }>(`/alerts${qs ? `?${qs}` : ''}`);
}

export function runDetection() {
  return apiFetch<{ summary: DetectionRunSummaryEntry[]; alertCount: number }>('/detection/run', {
    method: 'POST'
  });
}

export function getAccount(id: string) {
  return apiFetch<AccountDetail>(`/accounts/${encodeURIComponent(id)}`);
}

export function getAccountSubgraph(id: string, depth: number) {
  return apiFetch<Subgraph>(`/accounts/${encodeURIComponent(id)}/subgraph?depth=${depth}`);
}

export function getAccountRisk(id: string) {
  return apiFetch<RiskScore>(`/accounts/${encodeURIComponent(id)}/risk`);
}

export function listTopRisk(limit = 20) {
  return apiFetch<{ scores: RiskScore[] }>(`/accounts/risk?limit=${limit}`);
}

export function getTransaction(id: string) {
  return apiFetch<TransactionDetail>(`/transactions/${encodeURIComponent(id)}`);
}

export function listCases(params: { status?: CaseStatus; limit?: number; offset?: number } = {}) {
  const query = new URLSearchParams();
  if (params.status) query.set('status', params.status);
  if (params.limit) query.set('limit', String(params.limit));
  if (params.offset) query.set('offset', String(params.offset));
  const qs = query.toString();
  return apiFetch<{ cases: Case[]; limit: number; offset: number }>(`/cases${qs ? `?${qs}` : ''}`);
}

export function getCase(id: string) {
  return apiFetch<CaseDetail>(`/cases/${encodeURIComponent(id)}`);
}

export function createCase(input: { title: string; accountIds?: string[]; alertIds?: string[]; assignedTo?: string }) {
  return apiFetch<Case>('/cases', { method: 'POST', body: JSON.stringify(input) });
}

export function updateCase(id: string, input: { status?: CaseStatus; assignedTo?: string }) {
  return apiFetch<Case>(`/cases/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(input) });
}

export function addCaseNote(id: string, body: string) {
  return apiFetch<CaseNote>(`/cases/${encodeURIComponent(id)}/notes`, {
    method: 'POST',
    body: JSON.stringify({ body })
  });
}
