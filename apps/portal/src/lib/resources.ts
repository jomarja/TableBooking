import type { Restaurant, ResourceMode, TableModel } from '../types';

/** Current resource-management mode (defaults to Floor Plan). */
export function getResourceMode(r: Restaurant | null | undefined): ResourceMode {
  return r?.reservationRules?.resourceMode === 'RESOURCE_LIST' ? 'RESOURCE_LIST' : 'FLOOR_PLAN';
}

/** Display label for a table. Always "Table N" (the table's own number) so the
 *  label matches the floor plan, scheduler, and customer app everywhere. Tables
 *  are numbered automatically; custom names are no longer used. */
export function resourceLabel(
  _r: Restaurant | null | undefined,
  t: Pick<TableModel, 'id' | 'number'>,
): string {
  return `Table ${t.number}`;
}
