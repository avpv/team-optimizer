// src/algorithms/SlotSimulatedAnnealingOptimizer.js

import IOptimizer from '../core/IOptimizer.js';
import { cloneSlotTeams } from '../utils/teamSlotUtils.js';
import { performUniversalSlotSwap, performAdaptiveSlotSwap } from '../utils/slotSwapOperations.js';
import { evaluateSlotSolution } from '../utils/slotEvaluationUtils.js';

/**
 * Slot-Based Simulated Annealing Optimizer
 *
 * Probabilistically accepts worse solutions to escape local minima.
 * Temperature gradually decreases, reducing acceptance of worse solutions over time.
 *
 * Key features:
 * - High initial temperature for exploration
 * - Gradual cooling for exploitation
 * - Reheating mechanism to escape deep local minima
 * - Acceptance probability: exp(-delta / temperature)
 *
 * Advantages with slot structure:
 * - Instant cloning for neighbor generation
 * - No validation overhead
 * - Faster evaluation
 */
class SlotSimulatedAnnealingOptimizer extends IOptimizer {
    constructor(config, adaptiveParams) {
        super(config);
        this.adaptiveParams = adaptiveParams;
        this.stats = {
            iterations: 0,
            improvements: 0,
            temperature: config.initialTemperature
        };
    }

    /**
     * Solve using Simulated Annealing
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
            let best = cloneSlotTeams(current);
            let currentScore = evaluateSlotSolution(current, playerPool, positionWeights);
            let bestScore = currentScore;
            let temp = this.config.initialTemperature;
            let iterationSinceImprovement = 0;

            for (let iter = 0; iter < this.config.iterations; iter++) {
                this.stats.iterations = iter + 1;
                this.stats.temperature = temp;

                // Generate neighbor
                const neighbor = cloneSlotTeams(current);

                // Adaptive swap selection based on temperature
                const normalizedTemp = temp / this.config.initialTemperature;
                const iterationProgress = iter / this.config.iterations;

                // High temperature -> more exploration (random swaps)
                // Low temperature -> more exploitation (adaptive swaps)
                const adaptiveProbability = 0.3 + (1 - normalizedTemp) * 0.5; // 0.3 to 0.8

                if (Math.random() < adaptiveProbability) {
                    performAdaptiveSlotSwap(neighbor, positions, playerPool, this.adaptiveParams);
                } else {
                    performUniversalSlotSwap(neighbor, positions, playerPool, this.adaptiveParams);
                }

                const neighborScore = evaluateSlotSolution(neighbor, playerPool, positionWeights);
                const delta = neighborScore - currentScore;

                // Track if we found an improvement
                let foundImprovement = false;

                // Accept if better, or probabilistically if worse
                if (delta < 0 || Math.random() < Math.exp(-delta / temp)) {
                    current = neighbor;
                    currentScore = neighborScore;

                    if (neighborScore < bestScore) {
                        best = cloneSlotTeams(neighbor);
                        bestScore = neighborScore;
                        foundImprovement = true;
                        this.stats.improvements++;
                    }
                }

                // Update stagnation counter
                if (foundImprovement) {
                    iterationSinceImprovement = 0;
                } else {
                    iterationSinceImprovement++;
                }

                // Cool down temperature
                temp *= this.config.coolingRate;

                // Reheat if enabled and stagnating
                if (this.config.reheatEnabled && iterationSinceImprovement > this.config.reheatIterations) {
                    temp = this.config.reheatTemperature;
                    iterationSinceImprovement = 0;
                }

                // Yield control periodically
                if (iter % 5000 === 0) await new Promise(resolve => setTimeout(resolve, 1));
            }

            return best;
        } catch (error) {
            throw error;
        }
    }

    getStatistics() {
        return this.stats;
    }
}

export default SlotSimulatedAnnealingOptimizer;
