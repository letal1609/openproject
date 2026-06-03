import { describe, expect, it } from 'vitest';
import { Task, TaskDependency } from '../models/domain.models';
import { DependencyService } from '../services/dependency.service';
import { detectImportTypeByHeaders } from '../services/import-detection.service';
import { calculateBusinessPriorityScore, calculatePlanifiabilityFactor, getPriorityLevel } from '../services/scoring.service';
import { TaskMappingService } from '../services/task-mapping.service';
import { cleanGlpiId, normalizePriority, normalizeStatus, parseDateValue, splitGlpiMultiValue } from '../utils/date-normalization';

describe('import detection', () => {
  it('détecte ClickUp Backlog', () => expect(detectImportTypeByHeaders('backlog.xlsx', ['Tasks'], ['Task ID','Task Name','Status','Score impact'])).toBe('CLICKUP_BACKLOG'));
  it('détecte ClickUp Sprint', () => expect(detectImportTypeByHeaders('sprint.xlsx', ['Tasks'], ['Task ID','Task Name','Status','Objectif du Sprint','[TIS] En cours'])).toBe('CLICKUP_SPRINT'));
  it('détecte GLPI CSV', () => expect(detectImportTypeByHeaders('glpi.csv', [], ['ID','Titre','Statut','Priorité'])).toBe('GLPI_CSV'));
});

describe('normalisation utilitaire', () => {
  it('parse une date Excel serial', () => expect(parseDateValue(46108, 'CLICKUP')?.startsWith('2026-03-')).toBe(true));
  it('parse une date GLPI dd-MM-yyyy HH:mm', () => expect(parseDateValue('03-06-2026 09:54', 'GLPI')).toBe('2026-06-03T09:54:00.000Z'));
  it('nettoie un ID GLPI avec espaces', () => expect(cleanGlpiId('3 840')).toBe('3840'));
  it('split les valeurs GLPI séparées par br', () => expect(splitGlpiMultiValue('AKUE Josias Hermann<br>MBAYE babacar')).toEqual(['AKUE Josias Hermann','MBAYE babacar']));
  it('normalise priorité ClickUp', () => expect(normalizePriority('CLICKUP', 'URGENT')).toBe('CRITICAL'));
  it('normalise priorité GLPI', () => expect(normalizePriority('GLPI', 'Très haute')).toBe('CRITICAL'));
  it('normalise statut ClickUp', () => expect(normalizeStatus('CLICKUP', 'PRET POUR DEPLOIEMENT')).toBe('READY_FOR_DEPLOYMENT'));
  it('normalise statut GLPI', () => expect(normalizeStatus('GLPI', 'En cours (Attribué)')).toBe('IN_PROGRESS'));
});

describe('mapping', () => {
  it('exclut les headers répétés ClickUp', () => expect(new TaskMappingService().isValidClickUpTask({ 'Task ID': 'Task ID', 'Task Name': 'Task Name', Status: 'Status' })).toBe(false));
  it('exclut les lignes de groupe ClickUp', () => expect(new TaskMappingService().isValidClickUpTask({ 'Task ID': 'x', 'Task Name': 'Groupe', Status: '', 'Task Type': 'group' })).toBe(false));
  it('importe une ligne ClickUp valide', () => expect(new TaskMappingService().mapClickUp({ 'Task ID': 'CU-1', 'Task Name': 'Faire', Status: 'NOUVEAU', service: 'Projets', Priority: 'HIGH' }, 'CLICKUP_BACKLOG')?.title).toBe('Faire'));
  it('importe une ligne GLPI valide', () => expect(new TaskMappingService().mapGlpi({ ID: '3 840', Titre: 'Incident', Statut: 'Nouveau', Priorité: 'Haute' })?.externalId).toBe('3840'));
});

describe('scoring', () => {
  it('calcule le score métier pondéré', () => expect(calculateBusinessPriorityScore({ businessImpact: 100, regulatoryUrgency: 100, vipRequest: 100, userValue: 100, riskReduction: 100, projectMaturity: 100, costComplexity: 100, resourceAvailability: 100 })).toBe(100));
  it('calcule le score effectif via planifiabilité', () => expect(calculatePlanifiabilityFactor({ businessImpact: 0, regulatoryUrgency: 0, vipRequest: 0, userValue: 0, riskReduction: 0, projectMaturity: 50, costComplexity: 50, resourceAvailability: 50 })).toBeCloseTo(0.62));
  it('force HIGH minimal pour urgence réglementaire', () => expect(getPriorityLevel(30, { regulatoryUrgency: 100 })).toBe('HIGH'));
  it('force HIGH minimal pour demande VIP sponsorisée', () => expect(getPriorityLevel(30, { vipRequest: 100 })).toBe('HIGH'));
});

describe('dépendances', () => {
  const mk = (id: string, statusNormalized: Task['statusNormalized'] = 'TODO') => ({ id, title: id, statusNormalized, source: 'MANUAL', importType: 'UNKNOWN', externalId: id, displayExternalId: id, priorityNormalized: 'MEDIUM', importedAt: '', metadata: {}, locked: false, manuallyAdjusted: false, prioritization: {} as any, automaticPriorityScore: 0, effectivePriorityScore: 0, priorityLevel: 'LOW', manualPriorityEnabled: false, predecessorTaskIds: [], successorTaskIds: [], dependencyStatus: 'NONE' } as Task);
  it('place les prédécesseurs avant les successeurs', () => { const result = new DependencyService().sortByDependencies([mk('b'), mk('a')], [{ id: 'd', predecessorTaskId: 'a', successorTaskId: 'b', type: 'FINISH_TO_START', mandatory: true, createdAt: '' }]); expect(result.orderedTasks.map((t) => t.id).indexOf('a')).toBeLessThan(result.orderedTasks.map((t) => t.id).indexOf('b')); });
  it('détecte une dépendance circulaire', () => { const deps: TaskDependency[] = [{ id: '1', predecessorTaskId: 'a', successorTaskId: 'b', type: 'FINISH_TO_START', mandatory: true, createdAt: '' }, { id: '2', predecessorTaskId: 'b', successorTaskId: 'a', type: 'FINISH_TO_START', mandatory: true, createdAt: '' }]; expect(new DependencyService().sortByDependencies([mk('a'), mk('b')], deps).cyclicTaskIds.sort()).toEqual(['a','b']); });
  it('bloque la planification active si prédécesseur non terminé', () => expect(new DependencyService().hasUnfinishedPredecessor(mk('b'), [mk('a'), mk('b')], [{ id: 'd', predecessorTaskId: 'a', successorTaskId: 'b', type: 'FINISH_TO_START', mandatory: true, createdAt: '' }])).toBe(true));
});
