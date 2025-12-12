// src/algorithms/SlotTabuSearchOptimizer.js

import IOptimizer from '../core/IOptimizer.js';
import { cloneSlotTeams, hashSlotSolution } from '../utils/teamSlotUtils.js';
import { performUniversalSlotSwap, performAdaptiveSlotSwap } from '../utils/slotSwapOperations.js';
import { evaluateSlotSolution } from '../utils/slotEvaluationUtils.js';

/**
 * Slot-Based Tabu Search Optimizer
 *
 * Uses memory structures to avoid cycling and encourage exploration.
 * Benefits of slot-based structure:
 * - Much faster hashing (just IDs, not full objects)
 * - Instant cloning for neighborhood generation
 * - No duplicate validation overhead
 *
 * Key features:
 * - Tabu list to prevent cycling back to recent solutions
 * - Aspiration criterion to override tabu if solution is best so far
 * - Periodic diversification to escape local minima
 * - Adaptive restart when stagnating
 */
class SlotTabuSearchOptimizer extends IOptimizer {
    constructor(config, adaptiveParams) {
        super(config);
        this.adaptiveParams = adaptiveParams;
        this.stats = {
            iterations: 0,
            improvements: 0
        };
    }

    /**
     * Solve using Tabu Search
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
            let bestScore = evaluateSlotSolution(best, playerPool, positionWeights);

            const tabuSet = new Set(); // O(1) lookup
            const tabuQueue = []; // FIFO removal
            let iterationSinceImprovement = 0;

            for (let iter = 0; iter < this.config.iterations; iter++) {
                this.stats.iterations = iter + 1;

                // Generate neighborhood
                const neighbors = this.generateNeighborhood(
                    current,
                    composition,
                    positions,
                    playerPool,
                    positionWeights,
                    this.config.neighborCount,
                    iter,
                    iterationSinceImprovement
                );

                let bestNeighbor = null;
                let bestNeighborScore = Infinity;
                let bestNonTabuNeighbor = null;
                let bestNonTabuScore = Infinity;

                // Find best neighbor (considering tabu list and aspiration criterion)
                for (const neighbor of neighbors) {
                    const hash = hashSlotSolution(neighbor);
                    const score = evaluateSlotSolution(neighbor, playerPool, positionWeights);
                    const isTabu = tabuSet.has(hash);

                    // Track best non-tabu neighbor as fallback
                    if (!isTabu && score < bestNonTabuScore) {
                        bestNonTabuNeighbor = neighbor;
                        bestNonTabuScore = score;
                    }

                    // Aspiration criterion: accept tabu if better than global best
                    if ((!isTabu || score < bestScore) && score < bestNeighborScore) {
                        bestNeighbor = neighbor;
                        bestNeighborScore = score;
                    }
                }

                // If all neighbors are tabu and worse than bestScore,
                // accept the best non-tabu neighbor to prevent getting stuck
                if (bestNeighbor === null && bestNonTabuNeighbor !== null) {
                    bestNeighbor = bestNonTabuNeighbor;
                    bestNeighborScore = bestNonTabuScore;
                }

                if (bestNeighbor) {
                    current = bestNeighbor;
                    const currentScore = bestNeighborScore;
                    const currentHash = hashSlotSolution(current);

                    // Add to tabu set and queue
                    tabuSet.add(currentHash);
                    tabuQueue.push(currentHash);

                    // Remove oldest if exceeds tenure
                    if (tabuQueue.length > this.config.tabuTenure) {
                        const oldHash = tabuQueue.shift();
                        tabuSet.delete(oldHash);
                    }

                    if (currentScore < bestScore) {
                        best = cloneSlotTeams(current);
                        bestScore = currentScore;
                        iterationSinceImprovement = 0;
                        this.stats.improvements++;
                    } else {
                        iterationSinceImprovement++;
                    }
                } else {
                    // Force diversification if stuck
                    iterationSinceImprovement++;
                }

                // Periodic diversification to escape local minima
                if (iter > 0 && iter % this.config.diversificationFrequency === 0) {
                    current = cloneSlotTeams(best);
                    // Perform multiple swaps for strong diversification
                    const swapCount = Math.max(3, Math.floor(current[0].length / 2));
                    for (let i = 0; i < swapCount; i++) {
                        performUniversalSlotSwap(current, positions, playerPool, this.adaptiveParams);
                    }
                    // Partially clear tabu structures (keep 50%)
                    const keepCount = Math.floor(this.config.tabuTenure / 2);
                    while (tabuQueue.length > keepCount) {
                        const oldHash = tabuQueue.shift();
                        tabuSet.delete(oldHash);
                    }
                    iterationSinceImprovement = 0;
                }

                // Restart on long stagnation
                if (iterationSinceImprovement > 500) {
                    current = cloneSlotTeams(best);
                    for (let i = 0; i < 5; i++) {
                        performUniversalSlotSwap(current, positions, playerPool, this.adaptiveParams);
                    }
                    iterationSinceImprovement = 0;
                }

                // Yield control periodically
                if (iter % 500 === 0) await new Promise(resolve => setTimeout(resolve, 1));
            }

            return best;
        } catch (error) {
            throw error;
        }
    }

    /**
     * Generate neighborhood of solutions
     * @param {Array<Array<{playerId, position}>>} teams - Current solution
     * @param {Object} composition - Position composition
     * @param {Array<string>} positions - Available positions
     * @param {Object} playerPool - PlayerPool instance
     * @param {Object} positionWeights - Position weights
     * @param {number} size - Neighborhood size
     * @param {number} iter - Current iteration (for adaptive behavior)
     * @param {number} iterationSinceImprovement - Iterations without improvement
     * @returns {Array<Array<Array<{playerId, position}>>>} Array of neighbor solutions
     */
    generateNeighborhood(teams, composition, positions, playerPool, positionWeights, size, iter = 0, iterationSinceImprovement = 0) {
        const iterationProgress = iter / this.config.iterations;
        const isStagnating = iterationSinceImprovement > 100;

        return Array.from({ length: size }, () => {
            const neighbor = cloneSlotTeams(teams);

            // Use adaptive swaps 60% of time, random swaps 40% for diversity
            // Increase randomness when stagnating
            const adaptiveProbability = isStagnating ? 0.4 : 0.6;

            if (Math.random() < adaptiveProbability) {
                performAdaptiveSlotSwap(neighbor, positions, playerPool, this.adaptiveParams);
            } else {
                performUniversalSlotSwap(neighbor, positions, playerPool, this.adaptiveParams);
            }

            return neighbor;
        });
    }

    getStatistics() {
        return this.stats;
    }
}

export default SlotTabuSearchOptimizer;
