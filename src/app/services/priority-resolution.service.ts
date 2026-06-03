import { Injectable } from '@angular/core';
import { Task } from '../models/domain.models';
@Injectable({ providedIn: 'root' })
export class PriorityResolutionService {
  resolve(tasks: Task[]): Task[] { return [...tasks].sort((a, b) => { if (a.manualPriorityEnabled || b.manualPriorityEnabled) return (a.manualPriorityRank ?? 999999) - (b.manualPriorityRank ?? 999999) || b.effectivePriorityScore - a.effectivePriorityScore; return b.effectivePriorityScore - a.effectivePriorityScore || b.automaticPriorityScore - a.automaticPriorityScore; }).map((t, i) => ({ ...t, effectivePriorityRank: i + 1 })); }
  applyManualOrder(allTasks: Task[], visibleOrderedIds: string[]): Task[] { const rankById = new Map(visibleOrderedIds.map((id, index) => [id, index + 1])); return allTasks.map((task) => rankById.has(task.id) ? { ...task, manualPriorityRank: rankById.get(task.id)!, manualPriorityEnabled: true, manuallyAdjusted: true } : task); }
}
