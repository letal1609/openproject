import { NormalizedPriority, NormalizedStatus, TaskSource } from '../models/domain.models';

export function cleanText(value: unknown, removeNumericPlaceholders = true): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).replace(/^\uFEFF/, '').trim();
  if (!text) return null;
  if (removeNumericPlaceholders && /^\d+(?:[.,]\d+)?\.?$/.test(text) && ['71', '97'].includes(text.replace('.', ''))) return null;
  return text;
}

export function excelSerialToIso(serial: number): string | null {
  if (!Number.isFinite(serial) || serial <= 0) return null;
  const utcDays = Math.floor(serial - 25569);
  const utcValue = utcDays * 86400;
  const fractionalDay = serial - Math.floor(serial);
  const seconds = Math.round(fractionalDay * 86400);
  return new Date((utcValue + seconds) * 1000).toISOString();
}

export function parseDateValue(value: unknown, source: TaskSource | 'CLICKUP' | 'GLPI'): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
  if (typeof value === 'number') return excelSerialToIso(value);
  const raw = cleanText(value, false);
  if (!raw) return null;
  if (/^\d+(\.\d+)?$/.test(raw)) return excelSerialToIso(Number(raw));
  const glpi = raw.match(/^(\d{2})-(\d{2})-(\d{4})\s+(\d{2}):(\d{2})$/);
  if (source === 'GLPI' && glpi) {
    const [, dd, mm, yyyy, hh, min] = glpi;
    return new Date(Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd), Number(hh), Number(min))).toISOString();
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export function normalizeStatus(source: TaskSource | 'CLICKUP' | 'GLPI', statusRaw: unknown): NormalizedStatus {
  const value = cleanText(statusRaw, false)?.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') ?? '';
  if (!value) return 'UNKNOWN';
  if (['NOUVEAU', 'NEW', 'A DEMARRER'].includes(value)) return 'TODO';
  if (value.includes('EN COURS')) return 'IN_PROGRESS';
  if (value.includes('ATTENTE')) return 'WAITING';
  if (value.includes('TEST')) return 'TESTING';
  if (value.includes('REVUE')) return 'REVIEW';
  if (value.includes('DOCUMENTATION')) return 'DOCUMENTATION';
  if (value.includes('PRET POUR DEPLOIEMENT')) return 'READY_FOR_DEPLOYMENT';
  if (value.includes('TERMINE') || value.includes('RESOLU')) return 'DONE';
  if (value.includes('CLOTURE') || value === 'CLOS') return 'CLOSED';
  if (value.includes('NON PRISE EN COMPTE') || value.includes('CANCEL')) return 'CANCELLED';
  return 'UNKNOWN';
}

export function normalizePriority(source: TaskSource | 'CLICKUP' | 'GLPI', priorityRaw: unknown, defaultPriority: NormalizedPriority = 'MEDIUM'): NormalizedPriority {
  const value = cleanText(priorityRaw)?.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') ?? '';
  if (!value) return defaultPriority;
  if (['URGENT', 'TRES HAUTE', 'CRITICAL'].includes(value)) return 'CRITICAL';
  if (['HIGH', 'HAUTE'].includes(value)) return 'HIGH';
  if (['NORMAL', 'MOYENNE', 'MEDIUM'].includes(value)) return 'MEDIUM';
  if (['LOW', 'BASSE'].includes(value)) return 'LOW';
  return defaultPriority;
}

export function cleanGlpiId(id: unknown): string { return cleanText(id, false)?.replace(/\s+/g, '') ?? ''; }
export function splitGlpiMultiValue(value: unknown): string[] {
  const text = cleanText(value, false);
  if (!text) return [];
  return text.split(/<br\s*\/?>(?:\s*)?/i).map((item) => item.trim()).filter(Boolean);
}
export function toHours(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Math.max(0, value > 1000 ? Math.round(value / 3600) : value);
  const text = String(value).trim().replace(',', '.');
  const match = text.match(/(\d+(?:\.\d+)?)/);
  if (!match) return null;
  const num = Number(match[1]);
  if (/min/i.test(text)) return Math.round((num / 60) * 10) / 10;
  if (/d|jour/i.test(text)) return num * 8;
  return num;
}
