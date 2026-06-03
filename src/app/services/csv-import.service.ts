import { Injectable, inject } from '@angular/core';
import Papa from 'papaparse';
import { ImportPreview } from '../models/domain.models';
import { ImportDetectionService } from './import-detection.service';

@Injectable({ providedIn: 'root' })
export class CsvImportService {
  private detection = inject(ImportDetectionService);
  async parse(file: File): Promise<ImportPreview> {
    const text = await file.text();
    const parsed = Papa.parse<Record<string, unknown>>(text.replace(/^\uFEFF/, ''), { header: true, delimiter: ';', skipEmptyLines: 'greedy', transformHeader: (h) => h.replace(/^\uFEFF/, '').trim() });
    const rows = parsed.data.filter((row) => Object.values(row).some((v) => String(v ?? '').trim()));
    const headers = rows.length ? Object.keys(rows[0]) : [];
    const type = this.detection.detectImportType(file, { rows, headers });
    return { type, rows, totalRows: rows.length, recognizedColumns: headers.filter((h) => ['ID','Titre','Statut','Priorité'].includes(h)), unknownColumns: headers.filter((h) => !['ID','Titre','Statut','Priorité'].includes(h)) };
  }
}
