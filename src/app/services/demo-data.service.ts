import { Injectable, inject } from '@angular/core';
import { Absence, Resource, Sprint, Task, TaskDependency, WorkSilo } from '../models/domain.models';
import { AppDbService } from './app-db.service';
import { createDefaultPrioritization } from './scoring.service';
import { PlanningEngineService } from './planning-engine.service';

function now() { return new Date().toISOString(); }
@Injectable({ providedIn: 'root' })
export class DemoDataService {
  private db = inject(AppDbService); private planner = inject(PlanningEngineService);
  async load(): Promise<void> {
    await this.db.clearAll();
    const silos: WorkSilo[] = ['Incidents','Projets','Audit','Paramétrage','Demandes métier','Support GLPI','CODIR'].map((name, i) => ({ id: name, name, description: `Silo ${name}`, priority: i + 1, dailyCapacityPercent: 100, sprintCapacityPercent: 100, minimumDailyHours: 2, maxWorkInProgress: 5, active: true }));
    const resources: Resource[] = ['Elom','Taliou','Olivier','Hermann'].map((fullName) => ({ id: fullName, fullName, role: 'DSI', dailyCapacityHours: 6, weeklyCapacityHours: 30, active: true }));
    const sprints: Sprint[] = [{ id: 'sprint-1', name: 'Sprint Appli 202601', startDate: '2026-06-03', endDate: '2026-06-16', status: 'ACTIVE', goal: 'Stabilisation et priorités CODIR', totalCapacityHours: 240, planifiableCapacityHours: 210, bufferCapacityHours: 30, createdAt: now(), updatedAt: now() }, { id: 'sprint-2', name: 'Sprint Appli 202602', startDate: '2026-06-17', endDate: '2026-06-30', status: 'DRAFT', goal: 'Suite backlog DSI', totalCapacityHours: 240, planifiableCapacityHours: 210, bufferCapacityHours: 30, createdAt: now(), updatedAt: now() }];
    const tasks: Task[] = [
      task('clickup-1','CLICKUP','Paramétrage monétique réglementaire','CODIR',20,'URGENT',100,100,100,50,'Hermann'),
      task('clickup-2','CLICKUP','Développement API reporting crédit','Projets',32,'HIGH',100,0,60,50,'Olivier'),
      task('clickup-3','CLICKUP','Documentation exploitabilité batch','Audit',8,'NORMAL',50,0,0,100,'Taliou'),
      task('glpi-3840','GLPI','Incident GLPI monétique VIP','Support GLPI',6,'Très haute',100,0,60,100,'Elom'),
      task('glpi-3841','GLPI','Demande métier extraction trimestrielle','Demandes métier',10,'Moyenne',50,0,0,50,'Taliou'),
      task('clickup-4','CLICKUP','Recette utilisateur reporting','Projets',16,'NORMAL',50,0,0,50,'Olivier')
    ];
    const absences: Absence[] = [{ id: 'absence-hermann', resourceId: 'Hermann', startDate: '2026-06-10', endDate: '2026-06-11', reason: 'REUNION', comment: 'Mission CODIR' }];
    const dependencies: TaskDependency[] = [{ id: 'dep-dev-recette', predecessorTaskId: 'clickup-2', successorTaskId: 'clickup-4', type: 'FINISH_TO_START', mandatory: true, createdAt: now() }];
    const result = this.planner.replan({ tasks, resources, absences, sprints, dependencies, trigger: 'DEMO_DATA_LOADED' });
    await this.db.db.transaction('rw', this.db.db.tables, async () => { await this.db.db.workSilos.bulkPut(silos); await this.db.db.resources.bulkPut(resources); await this.db.db.sprints.bulkPut(sprints); await this.db.db.tasks.bulkPut([...tasks, ...result.unplannedTasks]); await this.db.db.absences.bulkPut(absences); await this.db.db.taskDependencies.bulkPut(dependencies); await this.db.db.sprintTasks.bulkPut(result.sprintTasks); await this.db.db.sprintPlanningSlots.bulkPut(result.slots); await this.db.db.planningRevisions.put(result.revision); await this.db.db.planningChanges.bulkPut(result.changes); });
  }
}
function task(id: string, source: 'CLICKUP'|'GLPI', title: string, silo: string, hours: number, priorityRaw: string, impact: number, regulatory: number, vip: number, resourceAvail: number, assignee: string): Task { const p = createDefaultPrioritization({ businessImpactScore: impact, regulatoryUrgencyScore: regulatory, vipRequestScore: vip, resourceAvailabilityScore: resourceAvail }); return { id, source, importType: source === 'GLPI' ? 'GLPI_CSV' : 'CLICKUP_BACKLOG', externalId: id, displayExternalId: id, title, siloId: silo, siloName: silo, assigneeName: assignee, assigneeNames: [assignee], statusRaw: 'NOUVEAU', statusNormalized: 'TODO', priorityRaw, priorityNormalized: priorityRaw === 'URGENT' || priorityRaw === 'Très haute' ? 'CRITICAL' : priorityRaw === 'HIGH' ? 'HIGH' : 'MEDIUM', estimatedHours: hours, remainingHours: hours, importedAt: now(), metadata: {}, locked: false, manuallyAdjusted: false, prioritization: p, automaticPriorityScore: p.totalPriorityScore, effectivePriorityScore: p.totalPriorityScore, priorityLevel: p.totalPriorityScore >= 80 ? 'CRITICAL' : p.totalPriorityScore >= 60 ? 'HIGH' : 'MEDIUM', manualPriorityEnabled: false, predecessorTaskIds: [], successorTaskIds: [], dependencyStatus: 'NONE' }; }
