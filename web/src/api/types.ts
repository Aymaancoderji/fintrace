export interface Alert {
  id: string;
  ruleName: string;
  score: number;
  accountIds: string[];
  transactionIds: string[];
  details: Record<string, unknown>;
  createdAt: string;
}

export type CaseStatus = 'open' | 'in_review' | 'closed';

export interface Case {
  id: string;
  title: string;
  status: CaseStatus;
  assignedTo: string | null;
  accountIds: string[];
  alertIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CaseNote {
  id: string;
  caseId: string;
  author: string;
  body: string;
  createdAt: string;
}

export interface CaseDetail extends Case {
  notes: CaseNote[];
}

export interface RiskScore {
  accountId: string;
  score: number;
  contributingRules: Record<string, number>;
  updatedAt: string;
}

export interface AccountDetail {
  id: string;
  createdAt: string;
  entityId: string | null;
  entityName: string | null;
}

export interface TransactionDetail {
  id: string;
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  currency: string;
  timestamp: string;
}

export interface SubgraphNode {
  id: string;
  labels: string[];
  properties: Record<string, unknown>;
}

export interface SubgraphEdge {
  id: string;
  type: string;
  fromId: string;
  toId: string;
}

export interface Subgraph {
  nodes: SubgraphNode[];
  edges: SubgraphEdge[];
}

export interface DetectionRunSummaryEntry {
  rule: string;
  alertsCreated: number;
}
