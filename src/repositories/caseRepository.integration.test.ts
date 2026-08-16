import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  startPostgresTestContainer,
  stopPostgresTestContainer,
  PostgresTestContext
} from '../testUtils/postgresTestContainer.js';
import { addCaseNote, createCase, getCaseById, listCaseNotes, listCases, updateCase } from './caseRepository.js';

describe('caseRepository (integration)', () => {
  let ctx: PostgresTestContext;

  beforeAll(async () => {
    ctx = await startPostgresTestContainer();
  }, 120_000);

  afterAll(async () => {
    await stopPostgresTestContainer(ctx);
  });

  it('creates a case, adds a note, and transitions status', async () => {
    const created = await createCase(ctx.pool, {
      title: 'Structuring on structurer-1',
      accountIds: ['structurer-1'],
      alertIds: [],
      assignedTo: undefined
    });
    expect(created.status).toBe('open');

    const note = await addCaseNote(ctx.pool, created.id, 'analyst', 'Reviewed subgraph, escalating.');
    expect(note.body).toBe('Reviewed subgraph, escalating.');

    const notes = await listCaseNotes(ctx.pool, created.id);
    expect(notes).toHaveLength(1);

    const updated = await updateCase(ctx.pool, created.id, { status: 'in_review', assignedTo: 'analyst-2' });
    expect(updated?.status).toBe('in_review');
    expect(updated?.assignedTo).toBe('analyst-2');

    const fetched = await getCaseById(ctx.pool, created.id);
    expect(fetched?.status).toBe('in_review');

    const openCases = await listCases(ctx.pool, 'open');
    expect(openCases.find((c) => c.id === created.id)).toBeUndefined();

    const inReviewCases = await listCases(ctx.pool, 'in_review');
    expect(inReviewCases.find((c) => c.id === created.id)).toBeDefined();
  });
});
