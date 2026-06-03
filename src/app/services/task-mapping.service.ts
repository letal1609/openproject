import { Injectable } from '@angular/core';
import { ImportType, Task, TaskSource } from '../models/domain.models';
import { cleanGlpiId, cleanText, normalizePriority, normalizeStatus, parseDateValue, splitGlpiMultiValue, toHours } from '../utils/date-normalization';
import { createDefaultPrioritization, ScoringService } from './scoring.service';

const CLICKUP_MAPPED = new Set(['Task Type','Task ID','Task Name','Parent ID','Parent Name','Parent URL','Status','Task Content','Assignee','Priority','Latest Comment','Due Date','Start Date','Date Created','Date Updated','Date Closed','Date Done','Created By','Space','Folder','List','Lists','Sprints','Time Estimate','Points Estimate','Direction demandeur','service','Item Type','Taux d’évolution','progression']);
const GLPI_MAPPED = new Set(['ID','Titre','Demandeur - Demandeur','Attribué à - Groupe de techniciens','Attribué à - Technicien','Date d’ouverture','Date de clôture','Statut','Dernière modification','Catégorie','Date de résolution','Suivis - Description','Priorité','TTR']);
function val(row: Record<string, unknown>, name: string, placeholder = true): string | null { return cleanText(row[name], placeholder); }
function metadata(row: Record<string, unknown>, mapped: Set<string>): Record<string, unknown> { return Object.fromEntries(Object.entries(row).filter(([k]) => !mapped.has(k))); }
function id(prefix: string, sourceId: string): string { return `${prefix}-${sourceId || crypto.randomUUID()}`.replace(/[^a-zA-Z0-9_-]/g, '-'); }
@Injectable({ providedIn: 'root' })
export class TaskMappingService {
  private scoring = new ScoringService();
  mapRows(type: ImportType, rows: Record<string, unknown>[]): Task[] { return rows.map((row) => type === 'GLPI_CSV' ? this.mapGlpi(row) : this.mapClickUp(row, type)).filter((task): task is Task => Boolean(task)); }
  isValidClickUpTask(row: Record<string, unknown>): boolean {
    const taskId = val(row, 'Task ID', false); const title = val(row, 'Task Name', false); const taskType = val(row, 'Task Type');
    if (!taskId || !title || taskId === 'Task ID' || title === 'Task Name') return false;
    if (/^(list|folder|space|group)$/i.test(taskType ?? '')) return false;
    return true;
  }
  mapClickUp(row: Record<string, unknown>, importType: ImportType): Task | null {
    if (!this.isValidClickUpTask(row)) return null;
    const service = val(row, 'service') ?? val(row, 'Direction demandeur') ?? val(row, 'Folder') ?? val(row, 'List') ?? 'Sans silo';
    const estimatedHours = toHours(row['Time Estimate']) ?? toHours(row['Points Estimate']);
    const p = createDefaultPrioritization({ businessImpactScore: Number(row['Score impact'] ?? row['Impact (1-5)'] ?? 50), regulatoryUrgencyScore: Number(row['Score urgence réglementaire'] ?? 0), userValueScore: Number(row['Score valeur ajoutée client / utilisateur'] ?? 50), riskReductionScore: Number(row['Score réduction de risque'] ?? 50), projectMaturityScore: Number(row['Score maturité'] ?? 50), estimatedCostComplexityScore: Number(row['Score coût estimé'] ?? 50), resourceAvailabilityScore: Number(row['Score disponibilité des ressources'] ?? 50), vipRequestScore: /DG|CODIR|VIP|Leadership/i.test(String(row['Leadership Request'] ?? '')) ? 100 : 0 });
    const base: Task = { id: id('clickup', val(row,'Task ID',false)!), source: 'CLICKUP', importType, externalId: val(row,'Task ID',false)!, displayExternalId: val(row,'Task ID',false)!, title: val(row,'Task Name',false)!, description: val(row,'Task Content'), taskType: val(row,'Task Type'), type: val(row,'Item Type'), siloId: service, siloName: service, assigneeName: val(row,'Assignee'), assigneeNames: val(row,'Assignee')?.split(',').map((x) => x.trim()).filter(Boolean) ?? [], statusRaw: val(row,'Status',false), statusNormalized: normalizeStatus('CLICKUP', row['Status']), priorityRaw: val(row,'Priority'), priorityNormalized: normalizePriority('CLICKUP', row['Priority']), estimatedHours, remainingHours: estimatedHours, startDate: parseDateValue(row['Start Date'], 'CLICKUP'), dueDate: parseDateValue(row['Due Date'], 'CLICKUP'), createdAtSource: parseDateValue(row['Date Created'], 'CLICKUP'), updatedAtSource: parseDateValue(row['Date Updated'], 'CLICKUP'), closedAtSource: parseDateValue(row['Date Closed'], 'CLICKUP'), doneAtSource: parseDateValue(row['Date Done'], 'CLICKUP'), importedAt: new Date().toISOString(), parentExternalId: val(row,'Parent ID',false), parentName: val(row,'Parent Name'), parentUrl: val(row,'Parent URL',false), sprintNames: val(row,'Sprints',false), metadata: metadata(row, CLICKUP_MAPPED), locked: false, manuallyAdjusted: false, prioritization: p, automaticPriorityScore: 0, effectivePriorityScore: 0, priorityLevel: 'LOW', manualPriorityEnabled: false, predecessorTaskIds: [], successorTaskIds: [], dependencyStatus: 'NONE' };
    return this.scoring.scoreTask(base);
  }
  mapGlpi(row: Record<string, unknown>): Task | null {
    const externalId = cleanGlpiId(row['ID']); const title = val(row,'Titre',false); if (!externalId || !title) return null;
    const group = val(row, 'Attribué à - Groupe de techniciens', false); const silo = val(row,'Catégorie') ?? group ?? 'Support GLPI';
    const base: Task = { id: id('glpi', externalId), source: 'GLPI', importType: 'GLPI_CSV', externalId, displayExternalId: val(row,'ID',false) ?? externalId, title, requesterName: val(row,'Demandeur - Demandeur', false), assigneeName: val(row,'Attribué à - Technicien', false), assignmentGroup: group, assigneeNames: splitGlpiMultiValue(row['Attribué à - Technicien']), assignmentGroups: splitGlpiMultiValue(row['Attribué à - Groupe de techniciens']), statusRaw: val(row,'Statut',false), statusNormalized: normalizeStatus('GLPI', row['Statut']), priorityRaw: val(row,'Priorité'), priorityNormalized: normalizePriority('GLPI', row['Priorité']), category: val(row,'Catégorie') } as unknown as Task;
    Object.assign(base, { source: 'GLPI' as TaskSource, importType: 'GLPI_CSV' as ImportType, siloId: silo, siloName: silo, description: val(row,'Suivis - Description', false), createdAtSource: parseDateValue(row['Date d’ouverture'], 'GLPI'), updatedAtSource: parseDateValue(row['Dernière modification'], 'GLPI'), closedAtSource: parseDateValue(row['Date de clôture'], 'GLPI'), resolvedAtSource: parseDateValue(row['Date de résolution'], 'GLPI'), dueDate: parseDateValue(row['TTR'], 'GLPI'), type: 'GLPI_TICKET', estimatedHours: 4, remainingHours: 4, importedAt: new Date().toISOString(), metadata: metadata(row, GLPI_MAPPED), locked: false, manuallyAdjusted: false, prioritization: createDefaultPrioritization(), automaticPriorityScore: 0, effectivePriorityScore: 0, priorityLevel: 'LOW', manualPriorityEnabled: false, predecessorTaskIds: [], successorTaskIds: [], dependencyStatus: 'NONE' });
    return this.scoring.scoreTask(base);
  }
}
