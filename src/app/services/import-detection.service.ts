import { Injectable } from '@angular/core';
import { ImportType } from '../models/domain.models';

export const GLPI_COLUMNS = ['ID', 'Titre', 'Statut', 'Priorité'];
export const CLICKUP_HEADER_MARKERS = ['Task ID', 'Task Name', 'Status'];
export const CLICKUP_BACKLOG_SCORING_COLUMNS = ['Impact', 'Impact (1-5)', 'Urgence réglementaire', 'Valeur ajoute client / utilisateur', 'Score impact', 'Score urgence réglementaire', 'Maturité de la demande'];
export const CLICKUP_SPRINT_COLUMNS = ['Objectif du Sprint', 'État du Sprint', '[TIS] Nouveau', '[TIS] En cours', '[TIS] Termine'];
export function headerNames(rows: Record<string, unknown>[]): string[] { return rows.length ? Object.keys(rows[0]) : []; }
export function detectImportTypeByHeaders(fileName: string, sheetNames: string[], headers: string[]): ImportType {
  const ext = fileName.toLowerCase().split('.').pop() ?? '';
  const has = (name: string) => headers.some((h) => h.trim().toLowerCase() === name.toLowerCase());
  if (ext === 'csv' && GLPI_COLUMNS.every(has)) return 'GLPI_CSV';
  if (['xlsx', 'xls'].includes(ext) && sheetNames.some((s) => s.toLowerCase() === 'tasks') && ['Task ID', 'Task Name'].every(has)) {
    if (headers.some((h) => CLICKUP_SPRINT_COLUMNS.some((c) => h.toLowerCase() === c.toLowerCase() || h.startsWith('[TIS]')))) return 'CLICKUP_SPRINT';
    if (headers.some((h) => CLICKUP_BACKLOG_SCORING_COLUMNS.some((c) => h.toLowerCase() === c.toLowerCase()))) return 'CLICKUP_BACKLOG';
    return 'CLICKUP_BACKLOG';
  }
  return 'UNKNOWN';
}
@Injectable({ providedIn: 'root' })
export class ImportDetectionService {
  detectImportType(file: File, parsedWorkbookOrRows: { SheetNames?: string[]; headers?: string[]; rows?: Record<string, unknown>[] }): ImportType {
    const headers = parsedWorkbookOrRows.headers ?? (parsedWorkbookOrRows.rows ? headerNames(parsedWorkbookOrRows.rows) : []);
    return detectImportTypeByHeaders(file.name, parsedWorkbookOrRows.SheetNames ?? [], headers);
  }
  findHeaderRow(rows: unknown[][], markers = CLICKUP_HEADER_MARKERS): number {
    return rows.findIndex((row) => markers.every((marker) => row.map((cell) => String(cell ?? '').trim()).includes(marker)));
  }
}
