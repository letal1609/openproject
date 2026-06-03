import { Injectable } from '@angular/core';
import { Absence, Resource, Sprint } from '../models/domain.models';
const dayMs = 86400000;
export function eachWorkday(start: string, end: string): string[] { const days: string[] = []; for (let t = new Date(start).setHours(12,0,0,0); t <= new Date(end).setHours(12,0,0,0); t += dayMs) { const d = new Date(t); if (d.getDay() !== 0 && d.getDay() !== 6) days.push(d.toISOString().slice(0,10)); } return days; }
@Injectable({ providedIn: 'root' })
export class CapacityService {
  isAbsent(resourceId: string, date: string, absences: Absence[]): boolean { return absences.some((a) => a.resourceId === resourceId && date >= a.startDate && date <= a.endDate); }
  availableHoursByResource(resources: Resource[], sprint: Sprint, absences: Absence[]): Map<string, Map<string, number>> { const result = new Map<string, Map<string, number>>(); const days = eachWorkday(sprint.startDate, sprint.endDate); resources.filter((r) => r.active).forEach((r) => { const caps = new Map<string, number>(); days.forEach((d) => caps.set(d, this.isAbsent(r.id, d, absences) ? 0 : r.dailyCapacityHours)); result.set(r.id, caps); }); return result; }
}
