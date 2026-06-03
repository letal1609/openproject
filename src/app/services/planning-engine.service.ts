import { Injectable, inject } from '@angular/core';
import { Absence, PlanningChange, PlanningResult, PlanningRevision, PlanningTriggerEvent, Resource, Sprint, SprintPlanningSlot, SprintTask, Task, TaskDependency } from '../models/domain.models';
import { CapacityService, eachWorkday } from './capacity.service';
import { DependencyService } from './dependency.service';
import { PriorityResolutionService } from './priority-resolution.service';
import { ScoringService } from './scoring.service';

@Injectable({ providedIn: 'root' })
export class PlanningEngineService {
  private scoring = inject(ScoringService); private priority = inject(PriorityResolutionService); private deps = inject(DependencyService); private capacity = inject(CapacityService);
  replan(input: { tasks: Task[]; resources: Resource[]; absences: Absence[]; sprints: Sprint[]; dependencies: TaskDependency[]; trigger: PlanningTriggerEvent; previousSprintTasks?: SprintTask[] }): PlanningResult {
    const revisionId = crypto.randomUUID(); const activeSprints = [...input.sprints].filter((s) => s.status === 'ACTIVE' || s.status === 'DRAFT').sort((a,b) => a.startDate.localeCompare(b.startDate));
    const resources = input.resources.filter((r) => r.active); const changes: PlanningChange[] = []; const planned: SprintTask[] = []; const slots: SprintPlanningSlot[] = []; const unplannedTasks: Task[] = [];
    const previousByTask = new Map((input.previousSprintTasks ?? []).map((st) => [st.taskId, st]));
    const candidates = input.tasks.map((t) => this.scoring.scoreTask(t)).filter((t) => !['DONE','CLOSED','CANCELLED'].includes(t.statusNormalized));
    const sorted = this.deps.sortByDependencies(this.priority.resolve(candidates), input.dependencies);
    const ordered = this.priority.resolve(sorted.orderedTasks);
    const capacityBySprint = new Map(activeSprints.map((s) => [s.id, this.capacity.availableHoursByResource(resources, s, input.absences)]));
    for (const task of ordered) {
      if (task.locked || task.statusNormalized === 'IN_PROGRESS' || task.manuallyAdjusted) { unplannedTasks.push({ ...task, planningStatus: task.locked ? 'LOCKED' : 'CANNOT_PLAN', unplannedReason: task.locked ? 'tâche verrouillée' : 'tâche en cours ou modifiée manuellement' }); continue; }
      if (task.dependencyStatus === 'CYCLIC_DEPENDENCY') { unplannedTasks.push({ ...task, planningStatus: 'CYCLIC_DEPENDENCY', unplannedReason: 'dépendance circulaire' }); continue; }
      if (this.deps.hasUnfinishedPredecessor(task, input.tasks, input.dependencies)) { unplannedTasks.push({ ...task, planningStatus: 'WAITING_PREDECESSOR', dependencyStatus: 'WAITING_PREDECESSOR', unplannedReason: 'prédécesseur non terminé' }); continue; }
      const hours = task.remainingHours ?? task.estimatedHours ?? 0; if (hours <= 0) { unplannedTasks.push({ ...task, planningStatus: 'CANNOT_PLAN', unplannedReason: 'pas de durée estimée' }); continue; }
      if (!task.siloId && !task.siloName) { unplannedTasks.push({ ...task, planningStatus: 'CANNOT_PLAN', unplannedReason: 'pas de silo' }); continue; }
      const allocation = this.findCapacity(hours, activeSprints, resources, capacityBySprint, task);
      if (!allocation) { unplannedTasks.push({ ...task, planningStatus: 'CANNOT_PLAN', unplannedReason: resources.length ? 'capacité insuffisante ou ressource indisponible' : 'pas de ressource disponible' }); continue; }
      const now = new Date().toISOString(); const sprintTask: SprintTask = { id: previousByTask.get(task.id)?.id ?? crypto.randomUUID(), sprintId: allocation.sprint.id, taskId: task.id, siloId: task.siloId ?? task.siloName, assigneeId: allocation.resource.id, estimatedHours: hours, plannedHours: allocation.days.reduce((s,d) => s + d.hours, 0), remainingHours: Math.max(0, hours - allocation.days.reduce((s,d) => s + d.hours, 0)), plannedStartDate: allocation.days[0]?.date, plannedEndDate: allocation.days.at(-1)?.date, score: task.effectivePriorityScore, status: task.statusNormalized, planningOrigin: 'AUTO', planningStatus: 'AUTO_PLANNED', locked: false, manuallyAdjusted: false, carriedOver: Boolean(previousByTask.get(task.id) && previousByTask.get(task.id)!.sprintId !== allocation.sprint.id), createdAt: previousByTask.get(task.id)?.createdAt ?? now, updatedAt: now };
      planned.push(sprintTask); allocation.days.forEach((d) => slots.push({ id: crypto.randomUUID(), sprintId: allocation.sprint.id, sprintTaskId: sprintTask.id, taskId: task.id, resourceId: allocation.resource.id, siloId: sprintTask.siloId, date: d.date, plannedHours: d.hours, generatedBy: 'AUTO_PLANNING' }));
      const prev = previousByTask.get(task.id); if (!prev || prev.sprintId !== sprintTask.sprintId || prev.assigneeId !== sprintTask.assigneeId || prev.plannedStartDate !== sprintTask.plannedStartDate) changes.push({ id: crypto.randomUUID(), revisionId, taskId: task.id, oldSprintId: prev?.sprintId, newSprintId: sprintTask.sprintId, oldAssigneeId: prev?.assigneeId, newAssigneeId: sprintTask.assigneeId, oldStartDate: prev?.plannedStartDate, newStartDate: sprintTask.plannedStartDate, oldEndDate: prev?.plannedEndDate, newEndDate: sprintTask.plannedEndDate, reason: input.trigger });
    }
    const revision: PlanningRevision = { id: revisionId, revisionDate: new Date().toISOString(), triggerEvent: input.trigger, description: `Replanification dynamique (${input.trigger})`, impactedTaskIds: changes.map((c) => c.taskId), impactedSprintIds: [...new Set(changes.map((c) => c.newSprintId).filter(Boolean) as string[])], changesCount: changes.length };
    return { revision, sprintTasks: planned, slots, unplannedTasks, changes };
  }
  private findCapacity(hours: number, sprints: Sprint[], resources: Resource[], capacityBySprint: Map<string, Map<string, Map<string, number>>>, task: Task) {
    for (const sprint of sprints) for (const resource of resources) { if (task.assigneeName && !resource.fullName.toLowerCase().includes(task.assigneeName.toLowerCase().split(/[ ,;]/)[0])) continue; let remaining = hours; const days: { date: string; hours: number }[] = []; const caps = capacityBySprint.get(sprint.id)?.get(resource.id); if (!caps) continue; for (const date of eachWorkday(sprint.startDate, sprint.endDate)) { const available = caps.get(date) ?? 0; if (available <= 0) continue; const used = Math.min(available, remaining); caps.set(date, available - used); days.push({ date, hours: used }); remaining -= used; if (remaining <= 0) return { sprint, resource, days }; } days.forEach((d) => caps.set(d.date, (caps.get(d.date) ?? 0) + d.hours)); }
    return null;
  }
}
