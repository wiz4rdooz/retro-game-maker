import { t } from '../strings/de';
import { IconBucket, IconCube, IconCursor, IconEraser, IconPencil, IconPipette, type IconComponent } from '../ui/icons';
import { EraseTool } from './eraseTool';
import { EyedropperTool } from './eyedropperTool';
import { PaintTool } from './paintTool';
import type { Tool, ToolContext, ToolPointer } from './tool';

export type ToolId = 'paint' | 'block' | 'select' | 'fill' | 'eyedropper' | 'erase';

export const TOOL_KEYS: Record<ToolId, string> = {
  paint: 'b',
  block: 'k',
  select: 'a',
  fill: 'g',
  eyedropper: 'i',
  erase: 'e',
};

export interface ToolInfo {
  id: ToolId;
  name: string;
  key: string;
  icon: IconComponent;
  /** Trennstrich vor diesem Werkzeug in der Leiste. */
  groupStart?: boolean;
}

export const TOOLS: readonly ToolInfo[] = [
  { id: 'paint', name: t.werkzeug.paint, key: TOOL_KEYS.paint, icon: IconPencil },
  { id: 'block', name: t.werkzeug.block, key: TOOL_KEYS.block, icon: IconCube },
  { id: 'select', name: t.werkzeug.select, key: TOOL_KEYS.select, icon: IconCursor },
  { id: 'fill', name: t.werkzeug.fill, key: TOOL_KEYS.fill, icon: IconBucket, groupStart: true },
  { id: 'eyedropper', name: t.werkzeug.eyedropper, key: TOOL_KEYS.eyedropper, icon: IconPipette },
  { id: 'erase', name: t.werkzeug.erase, key: TOOL_KEYS.erase, icon: IconEraser },
];

/** Werkzeug zur Taste (ohne Strg/Alt), sonst null. */
export function toolForKey(key: string): ToolId | null {
  const k = key.toLowerCase();
  for (const tool of TOOLS) if (tool.key === k) return tool.id;
  return null;
}

/** Platzhalter für Werkzeuge, die noch folgen (Block, Auswählen, Füllen). */
class PendingTool implements Tool {
  constructor(readonly id: ToolId) {}
  pointerDown(_p: ToolPointer, c: ToolContext): void {
    c.notify(t.status.folgt);
  }
  pointerMove(): void {}
  pointerUp(): void {}
  key(): boolean {
    return false;
  }
}

/** Neues Werkzeug-Objekt zur id. */
export function createTool(id: ToolId): Tool {
  switch (id) {
    case 'paint':
      return new PaintTool();
    case 'eyedropper':
      return new EyedropperTool();
    case 'erase':
      return new EraseTool();
    default:
      return new PendingTool(id);
  }
}
