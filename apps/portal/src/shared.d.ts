// Type shims for the shared (plain-JS) floor-plan renderer imported via @shared.
declare module '@shared/floorplan/index.js' {
  import type { ComponentType, PointerEvent, Ref } from 'react';

  export interface CanvasTable {
    id: string;
    number: number;
    capacity: number;
    shape: string;
    position: { x: number; y: number };
    size: { width: number; height: number };
    tags?: string[];
  }
  export interface CanvasElement {
    id: string;
    type: string;
    position: { x: number; y: number };
    size: { width: number; height: number };
    rotation: number;
    metadata: Record<string, unknown>;
  }

  export interface FloorPlanCanvasProps {
    elements?: CanvasElement[];
    tables?: CanvasTable[];
    background?: string | null;
    getTableStatus?: (table: CanvasTable) => string;
    onTableClick?: (table: CanvasTable) => void;
    onTableHover?: (table: CanvasTable | null) => void;
    hoveredTableId?: string | null;
    selectedTableId?: string | null;
    tooltipFor?: ((table: CanvasTable) => string) | null;
    editable?: boolean;
    selectedElementId?: string | null;
    onElementPointerDown?: (e: PointerEvent, element: CanvasElement) => void;
    onCanvasPointerDown?: (e: PointerEvent) => void;
    svgRef?: Ref<SVGSVGElement> | null;
  }

  export const FloorPlanCanvas: ComponentType<FloorPlanCanvasProps>;
  export const PALETTE: { type: string; label: string; icon: string }[];
  export const VIEWBOX_WIDTH: number;
  export const VIEWBOX_HEIGHT: number;
  export const TABLE_COLORS: Record<string, string>;
  export const ELEMENT_STYLES: Record<string, { fill: string; stroke: string; text: string }>;
  export function toPxX(x: number): number;
  export function toPxY(y: number): number;
  export function toRelX(px: number): number;
  export function toRelY(py: number): number;
}
