import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ReactFlow, Background, Controls, MiniMap, Node, Edge, MarkerType } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { getAccountRisk, getAccountSubgraph } from '../api/endpoints';
import { RiskScore, Subgraph, SubgraphNode } from '../api/types';
import { ApiError } from '../api/client';
import { ErrorMessage, Loading } from '../components/StatusMessage';
import { ScoreBadge } from '../components/ScoreBadge';

const RING_SPACING = 220;

function layout(subgraph: Subgraph, centerId: string): { nodes: Node[]; edges: Edge[] } {
  const adjacency = new Map<string, Set<string>>();
  for (const n of subgraph.nodes) adjacency.set(n.id, new Set());
  for (const e of subgraph.edges) {
    adjacency.get(e.fromId)?.add(e.toId);
    adjacency.get(e.toId)?.add(e.fromId);
  }

  const distance = new Map<string, number>([[centerId, 0]]);
  const queue = [centerId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    const d = distance.get(current)!;
    for (const neighbor of adjacency.get(current) ?? []) {
      if (!distance.has(neighbor)) {
        distance.set(neighbor, d + 1);
        queue.push(neighbor);
      }
    }
  }

  const ringMembers = new Map<number, string[]>();
  for (const n of subgraph.nodes) {
    const d = distance.get(n.id) ?? 1;
    const ring = ringMembers.get(d) ?? [];
    ring.push(n.id);
    ringMembers.set(d, ring);
  }

  const positions = new Map<string, { x: number; y: number }>();
  for (const [ring, ids] of ringMembers) {
    const radius = ring * RING_SPACING;
    ids.forEach((id, i) => {
      if (ring === 0) {
        positions.set(id, { x: 0, y: 0 });
        return;
      }
      const angle = (2 * Math.PI * i) / ids.length;
      positions.set(id, { x: radius * Math.cos(angle), y: radius * Math.sin(angle) });
    });
  }

  const nodes: Node[] = subgraph.nodes.map((n) => {
    const isAccount = n.labels.includes('Account');
    const isCenter = n.id === centerId;
    const sublabel = isAccount ? undefined : formatTransactionSublabel(n);
    return {
      id: n.id,
      position: positions.get(n.id) ?? { x: 0, y: 0 },
      // Explicit dimensions so the MiniMap (which needs measured size up front) renders
      // nodes on the first paint instead of waiting on React Flow's async ResizeObserver pass.
      width: isAccount ? 110 : 70,
      height: isAccount ? 36 : 40,
      data: { label: sublabel ? `${n.id}\n${sublabel}` : n.id },
      className: [isAccount ? 'node-account' : 'node-transaction', isCenter ? 'node-center' : '']
        .filter(Boolean)
        .join(' ')
    };
  });

  const edges: Edge[] = subgraph.edges.map((e) => ({
    id: e.id,
    source: e.fromId,
    target: e.toId,
    label: e.type,
    markerEnd: { type: MarkerType.ArrowClosed },
    className: 'graph-edge'
  }));

  return { nodes, edges };
}

function formatTransactionSublabel(node: SubgraphNode): string {
  const amount = node.properties.amount;
  const currency = node.properties.currency;
  if (typeof amount === 'number' && typeof currency === 'string') {
    return `${currency} ${amount.toLocaleString()}`;
  }
  return '';
}

export function AccountSubgraphPage() {
  const { accountId } = useParams<{ accountId: string }>();
  const navigate = useNavigate();
  const [depth, setDepth] = useState(2);
  const [subgraph, setSubgraph] = useState<Subgraph | null>(null);
  const [risk, setRisk] = useState<RiskScore | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<SubgraphNode | null>(null);

  useEffect(() => {
    if (!accountId) return;
    setError(null);
    setSubgraph(null);
    setSelectedNode(null);

    getAccountSubgraph(accountId, depth)
      .then(setSubgraph)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load subgraph.'));

    getAccountRisk(accountId)
      .then(setRisk)
      .catch(() => setRisk(null)); // no risk score yet is a normal, unscored state
  }, [accountId, depth]);

  const { nodes, edges } = useMemo(
    () => (subgraph && accountId ? layout(subgraph, accountId) : { nodes: [], edges: [] }),
    [subgraph, accountId]
  );

  if (!accountId) return null;

  return (
    <div className="subgraph-page">
      <div className="page-header">
        <h1>
          Account <code>{accountId}</code>
        </h1>
        <div className="subgraph-controls">
          {risk && <ScoreBadge score={risk.score} />}
          <label className="field-inline">
            <span>Depth</span>
            <select value={depth} onChange={(e) => setDepth(Number(e.target.value))}>
              {[1, 2, 3, 4, 5].map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {error && <ErrorMessage message={error} />}
      {!error && !subgraph && <Loading label="Loading subgraph…" />}

      {subgraph && (
        <div className="subgraph-layout">
          <div className="graph-canvas">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodeClick={(_, node) => {
                const found = subgraph.nodes.find((n) => n.id === node.id) ?? null;
                setSelectedNode(found);
              }}
              fitView
            >
              <Background />
              <Controls />
              <MiniMap
                pannable
                zoomable
                nodeColor={(node) => (node.className?.includes('node-account') ? '#5b8cff' : '#3a4258')}
                maskColor="rgba(15, 20, 32, 0.6)"
              />
            </ReactFlow>
          </div>

          <aside className="detail-panel">
            <h2>Details</h2>
            {selectedNode ? (
              <>
                <div className="detail-row">
                  <span className="detail-label">ID</span>
                  <span>{selectedNode.id}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Type</span>
                  <span>{selectedNode.labels.join(', ')}</span>
                </div>
                {Object.entries(selectedNode.properties)
                  .filter(([key]) => key !== 'id')
                  .map(([key, value]) => (
                    <div className="detail-row" key={key}>
                      <span className="detail-label">{key}</span>
                      <span>{String(value)}</span>
                    </div>
                  ))}
                {selectedNode.labels.includes('Account') && selectedNode.id !== accountId && (
                  <button
                    type="button"
                    className="btn-link"
                    onClick={() => navigate(`/accounts/${encodeURIComponent(selectedNode.id)}/subgraph`)}
                  >
                    Recenter on this account
                  </button>
                )}
              </>
            ) : (
              <p className="hint">Click a node to see its details.</p>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
