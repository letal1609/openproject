import { Injectable } from '@angular/core';
import { PrioritizationScores, Task, TaskPriorityLevel, TaskPrioritization } from '../models/domain.models';

export const PRIORITY_OPTIONS = {
  businessImpact: [{ label: 'impact fort sur métier critique', score: 100 }, { label: 'impact moyen sur service support', score: 50 }, { label: 'impact mineur', score: 10 }],
  regulatoryUrgency: [{ label: 'exigence réglementaire avec deadline', score: 100 }, { label: 'anticipation ou recommandation', score: 50 }, { label: 'non réglementaire', score: 0 }],
  vipRequest: [{ label: 'demande DG / CODIR / sponsor stratégique avec échéance explicite', score: 100 }, { label: 'demande direction / métier sensible / forte visibilité interne', score: 60 }, { label: 'demande standard', score: 0 }],
  userValue: [{ label: 'transformation majeure', score: 100 }, { label: 'amélioration notable', score: 50 }, { label: 'cosmétique', score: 10 }],
  riskReduction: [{ label: 'réduction d’un risque majeur avéré', score: 100 }, { label: 'prévention ou amélioration', score: 50 }, { label: 'pas d’impact direct', score: 0 }],
  projectMaturity: [{ label: 'prêt à démarrer : spécifications validées', score: 100, factor: 1 }, { label: 'en cours de cadrage', score: 50, factor: 0.6 }, { label: 'seulement une idée', score: 10, factor: 0.2 }],
  estimatedCostComplexity: [{ label: 'faible coût / rapide', score: 100, factor: 1 }, { label: 'coût ou complexité modérée', score: 50, factor: 0.7 }, { label: 'lourd ou incertain', score: 10, factor: 0.4 }],
  resourceAvailability: [{ label: 'ressources prêtes', score: 100, factor: 1 }, { label: 'partiellement disponible ou sous conditions', score: 50, factor: 0.6 }, { label: 'indisponibles', score: 0, factor: 0.1 }]
} as const;

export function calculateBusinessPriorityScore(scores: PrioritizationScores): number {
  return Math.round(scores.businessImpact * 0.22 + scores.regulatoryUrgency * 0.18 + scores.vipRequest * 0.15 + scores.userValue * 0.13 + scores.riskReduction * 0.13 + scores.projectMaturity * 0.08 + scores.costComplexity * 0.06 + scores.resourceAvailability * 0.05);
}
export function getPriorityLevel(score: number, scores?: Partial<PrioritizationScores>): TaskPriorityLevel {
  let level: TaskPriorityLevel = score >= 80 ? 'CRITICAL' : score >= 60 ? 'HIGH' : score >= 40 ? 'MEDIUM' : 'LOW';
  if ((scores?.regulatoryUrgency ?? 0) >= 100 || (scores?.vipRequest ?? 0) >= 100) {
    if (level === 'LOW' || level === 'MEDIUM') level = 'HIGH';
  }
  return level;
}
export function calculatePlanifiabilityFactor(scores: PrioritizationScores): number {
  const maturity = scores.projectMaturity >= 100 ? 1 : scores.projectMaturity >= 50 ? 0.6 : 0.2;
  const availability = scores.resourceAvailability >= 100 ? 1 : scores.resourceAvailability >= 50 ? 0.6 : 0.1;
  const complexity = scores.costComplexity >= 100 ? 1 : scores.costComplexity >= 50 ? 0.7 : 0.4;
  return maturity * 0.5 + availability * 0.3 + complexity * 0.2;
}
export function createDefaultPrioritization(partial: Partial<TaskPrioritization> = {}): TaskPrioritization {
  const base: TaskPrioritization = { businessImpact: 'impact moyen sur service support', regulatoryUrgency: 'non réglementaire', vipRequest: 'demande standard', userValue: 'amélioration notable', riskReduction: 'prévention ou amélioration', projectMaturity: 'en cours de cadrage', estimatedCostComplexity: 'coût ou complexité modérée', resourceAvailability: 'partiellement disponible ou sous conditions', businessImpactScore: 50, regulatoryUrgencyScore: 0, vipRequestScore: 0, userValueScore: 50, riskReductionScore: 50, projectMaturityScore: 50, estimatedCostComplexityScore: 50, resourceAvailabilityScore: 50, totalPriorityScore: 0 };
  const p = { ...base, ...partial };
  p.totalPriorityScore = calculateBusinessPriorityScore({ businessImpact: p.businessImpactScore, regulatoryUrgency: p.regulatoryUrgencyScore, vipRequest: p.vipRequestScore, userValue: p.userValueScore, riskReduction: p.riskReductionScore, projectMaturity: p.projectMaturityScore, costComplexity: p.estimatedCostComplexityScore, resourceAvailability: p.resourceAvailabilityScore });
  return p;
}
@Injectable({ providedIn: 'root' })
export class ScoringService {
  readonly options = PRIORITY_OPTIONS;
  scoreTask(task: Task): Task {
    const p = createDefaultPrioritization(task.prioritization);
    const scores: PrioritizationScores = { businessImpact: p.businessImpactScore, regulatoryUrgency: p.regulatoryUrgencyScore, vipRequest: p.vipRequestScore, userValue: p.userValueScore, riskReduction: p.riskReductionScore, projectMaturity: p.projectMaturityScore, costComplexity: p.estimatedCostComplexityScore, resourceAvailability: p.resourceAvailabilityScore };
    const automaticPriorityScore = calculateBusinessPriorityScore(scores);
    const effectivePriorityScore = Math.round(automaticPriorityScore * calculatePlanifiabilityFactor(scores));
    return { ...task, prioritization: p, automaticPriorityScore, effectivePriorityScore, priorityLevel: getPriorityLevel(automaticPriorityScore, scores) };
  }
}
