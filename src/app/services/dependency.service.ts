import { Injectable } from '@angular/core';
import { Task, TaskDependency } from '../models/domain.models';

export interface DependencySortResult { orderedTasks: Task[]; cyclicTaskIds: string[]; invalidDependencyIds: string[]; }
@Injectable({ providedIn: 'root' })
export class DependencyService {
  sortByDependencies(tasks: Task[], dependencies: TaskDependency[]): DependencySortResult {
    const taskIds = new Set(tasks.map((t) => t.id)); const incoming = new Map<string, Set<string>>(); const outgoing = new Map<string, Set<string>>(); const invalidDependencyIds: string[] = [];
    tasks.forEach((t) => { incoming.set(t.id, new Set()); outgoing.set(t.id, new Set()); });
    dependencies.forEach((d) => { if (!taskIds.has(d.predecessorTaskId) || !taskIds.has(d.successorTaskId)) { invalidDependencyIds.push(d.id); return; } incoming.get(d.successorTaskId)!.add(d.predecessorTaskId); outgoing.get(d.predecessorTaskId)!.add(d.successorTaskId); });
    const ready = [...tasks.filter((t) => incoming.get(t.id)!.size === 0).map((t) => t.id)]; const orderedIds: string[] = [];
    while (ready.length) { const id = ready.shift()!; orderedIds.push(id); outgoing.get(id)!.forEach((succ) => { incoming.get(succ)!.delete(id); if (incoming.get(succ)!.size === 0) ready.push(succ); }); }
    const cyclicTaskIds = tasks.map((t) => t.id).filter((id) => !orderedIds.includes(id)); const byId = new Map(tasks.map((t) => [t.id, t]));
    const orderedTasks = [...orderedIds, ...cyclicTaskIds].map((id) => byId.get(id)!).map((task) => cyclicTaskIds.includes(task.id) ? { ...task, dependencyStatus: 'CYCLIC_DEPENDENCY' as const } : task);
    return { orderedTasks, cyclicTaskIds, invalidDependencyIds };
  }
  hasUnfinishedPredecessor(task: Task, tasks: Task[], dependencies: TaskDependency[]): boolean { const done = new Set(['DONE','CLOSED','CANCELLED']); return dependencies.filter((d) => d.successorTaskId === task.id).some((d) => { const pred = tasks.find((t) => t.id === d.predecessorTaskId); return pred && !done.has(pred.statusNormalized); }); }
}
