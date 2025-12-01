/**
 * Team Optimizer Library
 * Universal team balancing for any activity
 *
 * @module team-optimizer
 * @author avpv
 * @license MIT
 */

// Core - Slot-based Architecture (v2.0)
export { default as TeamOptimizerService } from './core/SlotTeamOptimizerService.js';
export { default as PlayerPool } from './core/PlayerPool.js';
export { default as IOptimizer } from './core/IOptimizer.js';

// Services
export { default as ValidationService } from './services/ValidationService.js';
export { default as EvaluationService } from './services/EvaluationService.js';
export { default as SolutionOrganizer } from './services/SolutionOrganizer.js';

// Algorithms - Slot-based (v2.0)
export { default as GeneticAlgorithmOptimizer } from './algorithms/SlotGeneticAlgorithmOptimizer.js';
export { default as TabuSearchOptimizer } from './algorithms/SlotTabuSearchOptimizer.js';
export { default as SimulatedAnnealingOptimizer } from './algorithms/SlotSimulatedAnnealingOptimizer.js';
export { default as AntColonyOptimizer } from './algorithms/SlotAntColonyOptimizer.js';
export { default as ConstraintProgrammingOptimizer } from './algorithms/SlotConstraintProgrammingOptimizer.js';
export { default as LocalSearchOptimizer } from './algorithms/SlotLocalSearchOptimizer.js';
export { default as HybridOptimizer } from './algorithms/SlotHybridOptimizer.js';

// Utils - Slot-based (v2.0)
export * from './utils/slotSolutionGenerators.js';
export * from './utils/solutionUtils.js';
export * from './utils/slotSwapOperations.js';
export * from './utils/teamSlotUtils.js';
export * from './utils/slotEvaluationUtils.js';
export * from './utils/configHelpers.js';
export { default as WarningTracker, warningTracker } from './utils/warningTracker.js';
