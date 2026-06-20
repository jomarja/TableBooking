import type { Restaurant, ResourceMode, TableModel } from '../types';

/** Current resource-management mode (defaults to Floor Plan). */
export function getResourceMode(r: Restaurant | null | undefined): ResourceMode {
  return r?.reservationRules?.resourceMode === 'RESOURCE_LIST' ? 'RESOURCE_LIST' : 'FLOOR_PLAN';
}

/** Display label for a table/resource: the custom resource name if set
 *  (Resource List mode), otherwise the floor-plan "Table N". */
export function resourceLabel(
  r: Restaurant | null | undefined,
  t: Pick<TableModel, 'id' | 'number'>,
): string {
  const name = r?.reservationRules?.resourceMeta?.[t.id]?.name?.trim();
  return name || `Table ${t.number}`;
}
