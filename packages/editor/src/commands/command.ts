import type { World } from '@rgm/engine';
import type { ProjectFile } from '../project/projectModel';

/** Ein rückgängig machbarer Schritt. `bytes` schätzt den Speicher, den der Schritt festhält. */
export interface Command<C> {
  readonly label: string;
  readonly bytes: number;
  do(ctx: C): void;
  undo(ctx: C): void;
}

export interface DocCtx {
  world: World;
  project: ProjectFile;
}

export const TILE_RECORD_BYTES = 96;
export const MIN_COMMAND_BYTES = 64;

/** Speicherschätzung für n festgehaltene Kachel-Datensätze. */
export function recordBytes(n: number): number {
  return Math.max(MIN_COMMAND_BYTES, TILE_RECORD_BYTES * n);
}
