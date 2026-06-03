import { Injectable } from '@angular/core';
import Dexie, { Table } from 'dexie';
import { Absence, ImportError, ImportSession, PlanningChange, PlanningRevision, Resource, Sprint, SprintPlanningSlot, SprintTask, Task, TaskDependency, WorkSilo } from '../models/domain.models';

export class AppDatabase extends Dexie {
  tasks!: Table<Task, string>; workSilos!: Table<WorkSilo, string>; resources!: Table<Resource, string>; absences!: Table<Absence, string>; sprints!: Table<Sprint, string>; sprintTasks!: Table<SprintTask, string>; sprintPlanningSlots!: Table<SprintPlanningSlot, string>; planningRevisions!: Table<PlanningRevision, string>; planningChanges!: Table<PlanningChange, string>; importSessions!: Table<ImportSession, string>; importErrors!: Table<ImportError, string>; taskDependencies!: Table<TaskDependency, string>;
  constructor() { super('projectflow-dsi-db'); this.version(1).stores({ tasks: 'id, source, importType, externalId, siloId, statusNormalized, priorityNormalized, dueDate', workSilos: 'id, name, active', resources: 'id, fullName, active', absences: 'id, resourceId, startDate, endDate', sprints: 'id, status, startDate, endDate', sprintTasks: 'id, sprintId, taskId, siloId, assigneeId, planningOrigin, planningStatus', sprintPlanningSlots: 'id, sprintId, taskId, resourceId, siloId, date', planningRevisions: 'id, revisionDate, triggerEvent', planningChanges: 'id, revisionId, taskId', importSessions: 'id, importDate, importType, source, status', importErrors: 'id, importSessionId, rowNumber', taskDependencies: 'id, predecessorTaskId, successorTaskId' }); }
}
@Injectable({ providedIn: 'root' })
export class AppDbService {
  readonly db = new AppDatabase();
  async snapshot() { const [tasks, workSilos, resources, absences, sprints, sprintTasks, slots, revisions, changes, dependencies] = await Promise.all([this.db.tasks.toArray(), this.db.workSilos.toArray(), this.db.resources.toArray(), this.db.absences.toArray(), this.db.sprints.toArray(), this.db.sprintTasks.toArray(), this.db.sprintPlanningSlots.toArray(), this.db.planningRevisions.toArray(), this.db.planningChanges.toArray(), this.db.taskDependencies.toArray()]); return { tasks, workSilos, resources, absences, sprints, sprintTasks, slots, revisions, changes, dependencies }; }
  async clearAll(): Promise<void> { await this.db.transaction('rw', this.db.tables, async () => Promise.all(this.db.tables.map((t) => t.clear()))); }
}
