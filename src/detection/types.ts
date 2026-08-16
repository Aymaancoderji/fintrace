import { Session } from 'neo4j-driver';

export interface AlertCandidate {
  ruleName: string;
  score: number;
  accountIds: string[];
  transactionIds: string[];
  details: Record<string, unknown>;
}

export interface DetectionRule {
  name: string;
  description: string;
  run(session: Session): Promise<AlertCandidate[]>;
}

export interface Alert extends AlertCandidate {
  id: string;
  createdAt: Date;
}
