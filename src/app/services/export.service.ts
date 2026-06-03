import { Injectable } from '@angular/core';
@Injectable({ providedIn: 'root' })
export class ExportService { downloadJson(fileName: string, data: unknown): void { const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = fileName; a.click(); URL.revokeObjectURL(url); } }
