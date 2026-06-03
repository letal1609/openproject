import { Injectable, inject } from '@angular/core';
import * as XLSX from 'xlsx';
import { ImportPreview } from '../models/domain.models';
import { ImportDetectionService } from './import-detection.service';

@Injectable({ providedIn: 'root' })
export class ExcelImportService {
  private detection = inject(ImportDetectionService);
  async parse(file: File): Promise<ImportPreview> {
    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type: 'array', cellDates: true });
    const sheetName = wb.SheetNames.find((s) => s.toLowerCase() === 'tasks') ?? wb.SheetNames[0];
    const rawRows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sheetName], { header: 1, raw: true, defval: '' });
    const headerIndex = this.detection.findHeaderRow(rawRows);
    if (headerIndex < 0) return { type: 'UNKNOWN', rows: [], totalRows: rawRows.length, recognizedColumns: [], unknownColumns: [] };
    const headers = rawRows[headerIndex].map((h) => String(h ?? '').trim());
    const rows = rawRows.slice(headerIndex + 1).map((line) => Object.fromEntries(headers.map((h, i) => [h, line[i]]))).filter((row) => Object.values(row).some((v) => String(v ?? '').trim()));
    const type = this.detection.detectImportType(file, { SheetNames: wb.SheetNames, headers, rows });
    const known = new Set(['Task ID','Task Name','Status','Task Type','Parent ID','Parent Name','Parent URL','Task Content','Assignee','Priority','Latest Comment','Due Date','Start Date','Date Created','Date Updated','Date Closed','Date Done','Created By','Space','Folder','List','Lists','Sprints','Time Estimate','Points Estimate','Direction demandeur','service','Item Type','Objectif du Sprint','État du Sprint','Taux d’évolution','progression']);
    return { type, rows, totalRows: rows.length, recognizedColumns: headers.filter((h) => known.has(h) || h.startsWith('[TIS]') || h.startsWith('Score')), unknownColumns: headers.filter((h) => !(known.has(h) || h.startsWith('[TIS]') || h.startsWith('Score'))) };
  }
}
