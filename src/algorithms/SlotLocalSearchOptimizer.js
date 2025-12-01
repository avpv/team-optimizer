// src/algorithms/SlotLocalSearchOptimizer.js

import IOptimizer from '../core/IOptimizer.js';
import { cloneSlotTeams } from '../utils/teamSlotUtils.js';
import { performUniversalSlotSwap, performAdaptiveSlotSwap } from '../utils/slotSwapOperations.js';
import { evaluateSlotSolution } from '../utils/slotEvaluationUtils.js';

/**
 * Slot-Based Local Search Optimizer
 *
 * Performs greedy hill-climbing to refine an existing solution.
 * Much faster than old version due to:
 * - Instant cloning (just copy {playerId, position})
 * - No validation overhead (duplicates impossible)
 * - Direct swaps without safety checks
 *
 * Use this for final polishing of solutions from other algorithms.
 */
class SlotLocalSearchOptimizer extends IOptimizer {
    constructor(config, adaptiveParams) {
        super(config);
        this.adaptiveParams = adaptiveParams;
        this.stats = {
            iterations: 0,
            improvements: 0
        };
    }

    /**
     * Solve using Local Search (greedy hill climbing)
     * @param {Object} problemContext - Problem context
     * @param {Array<Array<{playerId, position}>>} problemContext.initialSolution - Initial slot-based solution
     * @param {Object} problemContext.composition - Position composition
     * @param {Array<string>} problemContext.positions - Available positions
     * @param {Object} problemContext.playerPool - PlayerPool instance
     * @param {Object} problemContext.positionWeights - Position weights
     * @returns {Promise<Array<Array<{playerId, position}>>>} Best solution found
     */
    async solve(problemContext) {
        const {
            initialSolution,
            composition,
            positions,
            playerPool,
            positionWeights
        } = problemContext;

        try {
            let current = cloneSlotTeams(initialSolution);
            let currentScore = evaluateSlotSolution(current, playerPool, positionWeights);

            for (let iter = 0; iter < this.config.iterations; iter++) {
                this.stats.iterations = iter + 1;

                // Create neighbor by making one swap
                const neighbor = cloneSlotTeams(current);
                const iterationProgress = iter / this.config.iterations;

                // Use adaptive swap 70% of the time for better balance improvements
                // Use random swap 30% of the time for exploration
                if (Math.random() < 0.7) {
                    performAdaptiveSlotSwap(neighbor, positions, playerPool, this.adaptiveParams);
                } else {
                    performUniversalSlotSwap(neighbor, positions, playerPool, this.adaptiveParams);
                }

                const neighborScore = evaluateSlotSolution(neighbor, playerPool, positionWeights);

                // Accept only improvements (greedy hill climbing)
                if (neighborScore < currentScore) {
                    current = neighbor;
                    currentScore = neighborScore;
                    this.stats.improvements++;
                }

                // Yield control periodically
                if (iter % 100 === 0) await new Promise(resolve => setTimeout(resolve, 1));
            }

            return current;
        } catch (error) {
            console.error('SlotLocalSearch: Error during optimization:', error);
            // For local search, if it fails, just return the initial solution
            return cloneSlotTeams(initialSolution);
        }
    }

    getStatistics() {
        return this.stats;
    }
}

export default SlotLocalSearchOptimizer;
