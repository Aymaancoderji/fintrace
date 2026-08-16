import neo4j from 'neo4j-driver';

export function toNumber(value: unknown): number {
  if (neo4j.isInt(value)) {
    return value.toNumber();
  }
  return value as number;
}
