import neo4j, { Node, Relationship, Session } from 'neo4j-driver';
import { hopRange } from '../utils/cypher.js';

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

export const MAX_SUBGRAPH_DEPTH = 5;

/** Bounds the payload for a user-driven traversal that can fan out exponentially. */
export const MAX_SUBGRAPH_EDGES = 2_000;

export function clampDepth(depth: number): number {
  return Math.min(Math.max(1, Math.trunc(depth) || 1), MAX_SUBGRAPH_DEPTH);
}

export async function getAccountSubgraph(
  session: Session,
  accountId: string,
  depth: number
): Promise<Subgraph | undefined> {
  const boundedDepth = clampDepth(depth);

  // Deduplicates in the database rather than returning whole paths: collect(path)
  // ships every node and relationship once per path that touches it, which grows
  // exponentially with depth on a dense account. Unwinding relationships and
  // collecting DISTINCT makes the payload O(edges) instead.
  //
  // The UNWIND yields no rows when the account has no neighbours (OPTIONAL MATCH
  // gives a null path); the bare aggregations still emit a single row of empty
  // lists, which is what distinguishes an isolated account from a missing one.
  const cypher = `
    MATCH (center:Account {id: $accountId})
    CALL {
      WITH center
      OPTIONAL MATCH path = (center)-[:SENT|RECEIVED_BY${hopRange(1, boundedDepth)}]-(other)
      UNWIND CASE WHEN path IS NULL THEN [] ELSE relationships(path) END AS rel
      RETURN collect(DISTINCT other) AS others, collect(DISTINCT rel)[0..$maxEdges] AS rels
    }
    RETURN center, others, rels
  `;

  const result = await session.run(cypher, { accountId, maxEdges: neo4j.int(MAX_SUBGRAPH_EDGES) });
  if (result.records.length === 0) {
    return undefined;
  }

  const record = result.records[0];
  const center = record.get('center') as Node;
  const others = record.get('others') as Node[];
  const rels = record.get('rels') as Relationship[];

  const byElementId = new Map<string, SubgraphNode>();
  for (const node of [center, ...others]) {
    byElementId.set(node.elementId, {
      id: String(node.properties.id),
      labels: node.labels,
      properties: node.properties
    });
  }

  const edges: SubgraphEdge[] = [];
  const referenced = new Set<string>([center.elementId]);

  for (const rel of rels) {
    const from = byElementId.get(rel.startNodeElementId);
    const to = byElementId.get(rel.endNodeElementId);
    if (!from || !to) continue;

    referenced.add(rel.startNodeElementId);
    referenced.add(rel.endNodeElementId);
    edges.push({ id: rel.elementId, type: rel.type, fromId: from.id, toId: to.id });
  }

  // Keep only nodes an edge actually reaches, so a truncated edge list can't
  // leave orphan nodes floating in the rendered graph.
  const nodes = [...referenced].map((elementId) => byElementId.get(elementId)!).filter(Boolean);

  return { nodes, edges };
}
