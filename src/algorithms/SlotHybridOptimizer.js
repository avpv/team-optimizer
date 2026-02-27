// src/algorithms/SlotHybridOptimizer.js

import IOptimizer from '../core/IOptimizer.js';
import { cloneSlotTeams, hashSlotSolution } from '../utils/teamSlotUtils.js';
import { performUniversalSlotSwap, performAdaptiveSlotSwap } from '../utils/slotSwapOperations.js';
import { evaluateSlotSolution } from '../utils/slotEvaluationUtils.js';
import { createRandomSlotSolution } from '../utils/slotSolutionGenerators.js';

/**
 * Slot-Based Hybrid Optimizer
 *
 * Combines three complementary optimization strategies:
 *
 * Phase 1: Genetic Algorithm (Global Exploration)
 *   - Wide exploration of solution space
 *   - Population-based diversity
 *   - Good for escaping local minima
 *
 * Phase 2: Tabu Search (Focused Exploitation)
 *   - Intensified search in promising regions
 *   - Memory-based avoidance of cycles
 *   - Good for local optimization
 *
 * Phase 3: Local Search (Final Polishing)
 *   - Greedy hill-climbing refinement
 *   - Ensures local optimum
 *
 * Advantages with slot structure:
 * - All phases benefit from instant cloning
 * - No validation overhead in any phase
 * - Faster hashing for tabu list
 * - Lower memory usage throughout
 */
class SlotHybridOptimizer extends IOptimizer {
    constructor(config, adaptiveParams) {
        super(config);
        this.adaptiveParams = adaptiveParams;
        this.stats = {
            phase1Iterations: 0,
            phase1Improvements: 0,
            phase2Iterations: 0,
            phase2Improvements: 0,
            phase3Iterations: 0,
            phase3Improvements: 0,
            totalImprovements: 0,
            bestPhase: null
        };
    }

    /**
     * Solve using hybrid three-phase approach
     * @param {Object} problemContext - Problem context
     * @param {Array<Array<{playerId, position}>>} problemContext.initialSolution - Initial solution
     * @param {Object} problemContext.composition - Position composition
     * @param {number} problemContext.teamCount - Number of teams
     * @param {Object} problemContext.playerPool - PlayerPool instance
     * @param {Array<string>} problemContext.positions - Available positions
     * @param {Object} problemContext.positionWeights - Position weights
     * @returns {Promise<Array<Array<{playerId, position}>>>} Best solution found
     */
    async solve(problemContext) {
        const {
            initialSolution,
            composition,
            teamCount,
            playerPool,
            positions,
            positionWeights
        } = problemContext;

        try {
            // Handle initial solution (single solution or population)
            let currentSolution;
            if (Array.isArray(initialSolution[0]) && initialSolution[0][0] &&
                typeof initialSolution[0][0] === 'object' && 'playerId' in initialSolution[0][0]) {
                // Single solution
                currentSolution = cloneSlotTeams(initialSolution);
            } else {
                // Population - take first
                currentSolution = cloneSlotTeams(initialSolution[0]);
            }

            let bestSolution = cloneSlotTeams(currentSolution);
            let bestScore = evaluateSlotSolution(bestSolution, playerPool, positionWeights);

            // Phase 1: Genetic Algorithm - Global Exploration
            const phase1Result = await this.phase1GeneticAlgorithm(
                problemContext,
                currentSolution,
                bestScore
            );

            if (phase1Result.score < bestScore) {
                bestSolution = phase1Result.solution;
                bestScore = phase1Result.score;
                this.stats.bestPhase = 'Genetic Algorithm';
            }

            // Phase 2: Tabu Search - Focused Exploitation
            const phase2Result = await this.phase2TabuSearch(
                problemContext,
                bestSolution,
                bestScore
            );

            if (phase2Result.score < bestScore) {
                bestSolution = phase2Result.solution;
                bestScore = phase2Result.score;
                this.stats.bestPhase = 'Tabu Search';
            }

            // Phase 3: Local Search - Final Polishing
            const phase3Result = await this.phase3LocalSearch(
                problemContext,
                bestSolution,
                bestScore
            );

            if (phase3Result.score < bestScore) {
                bestSolution = phase3Result.solution;
                bestScore = phase3Result.score;
                if (this.stats.bestPhase !== 'Tabu Search' && this.stats.bestPhase !== 'Genetic Algorithm') {
                    this.stats.bestPhase = 'Local Search';
                }
            }

            return bestSolution;

        } catch (error) {
            return initialSolution;
        }
    }

    /**
     * Phase 1: Genetic Algorithm for global exploration
     */
    async phase1GeneticAlgorithm(problemContext, initialSolution, initialScore) {
        const { composition, teamCount, playerPool, positions, positionWeights } = problemContext;
        const config = this.config.phase1 || {
            populationSize: 15,
            generations: 100,
            mutationRate: 0.3,
            crossoverRate: 0.7,
            elitismCount: 2,
            tournamentSize: 3
        };

        // Initialize population
        let population = [cloneSlotTeams(initialSolution)];
        while (population.length < config.populationSize) {
            population.push(createRandomSlotSolution(composition, teamCount, playerPool));
        }

        let bestSolution = cloneSlotTeams(initialSolution);
        let bestScore = initialScore;

        for (let gen = 0; gen < config.generations; gen++) {
            this.stats.phase1Iterations++;

            // Evaluate population
            const scored = population.map(individual => ({
                teams: individual,
                score: evaluateSlotSolution(individual, playerPool, positionWeights)
            })).sort((a, b) => a.score - b.score);

            // Track best
            if (scored[0].score < bestScore) {
                bestSolution = cloneSlotTeams(scored[0].teams);
                bestScore = scored[0].score;
                this.stats.phase1Improvements++;
                this.stats.totalImprovements++;
            }

            // Create new population with elitism
            const newPopulation = scored.slice(0, config.elitismCount).map(s => cloneSlotTeams(s.teams));

            while (newPopulation.length < config.populationSize) {
                const parent1 = this.tournamentSelection(scored, config.tournamentSize);

                if (Math.random() < config.crossoverRate) {
                    const parent2 = this.tournamentSelection(scored, config.tournamentSize);
                    const child = this.slotCrossover(parent1, parent2, composition, playerPool);
                    newPopulation.push(child);
                } else {
                    newPopulation.push(cloneSlotTeams(parent1));
                }
            }

            // Mutation
            for (let i = config.elitismCount; i < newPopulation.length; i++) {
                if (Math.random() < config.mutationRate) {
                    // More random swaps during exploration
                    performUniversalSlotSwap(newPopulation[i], positions, playerPool, this.adaptiveParams);
                }
            }

            population = newPopulation;

            // Periodic yield
            if (gen % 20 === 0) {
                await new Promise(resolve => setTimeout(resolve, 1));
            }
        }

        return { solution: bestSolution, score: bestScore };
    }

    /**
     * Phase 2: Tabu Search for focused exploitation
     */
    async phase2TabuSearch(problemContext, initialSolution, initialScore) {
        const { composition, playerPool, positions, positionWeights } = problemContext;
        const config = this.config.phase2 || {
            iterations: 3000,
            tabuTenure: 50,
            neighborhoodSize: 15,
            diversificationFrequency: 500
        };

        let currentSolution = cloneSlotTeams(initialSolution);
        let currentScore = initialScore;
        let bestSolution = cloneSlotTeams(initialSolution);
        let bestScore = initialScore;

        const tabuList = new Set();
        let iterationsSinceImprovement = 0;

        for (let iter = 0; iter < config.iterations; iter++) {
            this.stats.phase2Iterations++;

            // Generate neighborhood using adaptive swaps
            const neighbors = [];
            for (let n = 0; n < config.neighborhoodSize; n++) {
                const neighbor = cloneSlotTeams(currentSolution);

                // Use adaptive swaps for exploitation
                performAdaptiveSlotSwap(neighbor, positions, playerPool, this.adaptiveParams);

                const hash = hashSlotSolution(neighbor);
                if (!tabuList.has(hash)) {
                    neighbors.push({
                        solution: neighbor,
                        score: evaluateSlotSolution(neighbor, playerPool, positionWeights),
                        hash
                    });
                }
            }

            if (neighbors.length === 0) continue;

            // Sort by score
            neighbors.sort((a, b) => a.score - b.score);
            const bestNeighbor = neighbors[0];

            // Accept best non-tabu neighbor (or aspiration criterion)
            if (bestNeighbor.score < bestScore || !tabuList.has(bestNeighbor.hash)) {
                currentSolution = bestNeighbor.solution;
                currentScore = bestNeighbor.score;

                // Add to tabu list
                tabuList.add(bestNeighbor.hash);
                if (tabuList.size > config.tabuTenure) {
                    const firstItem = tabuList.values().next().value;
                    tabuList.delete(firstItem);
                }

                // Update best
                if (currentScore < bestScore) {
                    bestSolution = cloneSlotTeams(currentSolution);
                    bestScore = currentScore;
                    this.stats.phase2Improvements++;
                    this.stats.totalImprovements++;
                    iterationsSinceImprovement = 0;
                } else {
                    iterationsSinceImprovement++;
                }
            }

            // Diversification if stuck
            if (iterationsSinceImprovement > config.diversificationFrequency) {
                for (let i = 0; i < 5; i++) {
                    performUniversalSlotSwap(currentSolution, positions, playerPool, this.adaptiveParams);
                }
                currentScore = evaluateSlotSolution(currentSolution, playerPool, positionWeights);
                iterationsSinceImprovement = 0;
                tabuList.clear();
            }

            // Periodic yield
            if (iter % 100 === 0) {
                await new Promise(resolve => setTimeout(resolve, 1));
            }
        }

        return { solution: bestSolution, score: bestScore };
    }

    /**
     * Phase 3: Local Search for final polishing
     */
    async phase3LocalSearch(problemContext, initialSolution, initialScore) {
        const { playerPool, positions, positionWeights } = problemContext;
        const config = this.config.phase3 || {
            iterations: 1000,
            neighborhoodSize: 10
        };

        let currentSolution = cloneSlotTeams(initialSolution);
        let currentScore = initialScore;

        for (let iter = 0; iter < config.iterations; iter++) {
            this.stats.phase3Iterations++;

            let improved = false;

            // Try multiple neighbors
            for (let n = 0; n < config.neighborhoodSize; n++) {
                const neighbor = cloneSlotTeams(currentSolution);

                // Very focused adaptive swaps for final polishing
                performAdaptiveSlotSwap(neighbor, positions, playerPool, this.adaptiveParams);

                const neighborScore = evaluateSlotSolution(neighbor, playerPool, positionWeights);

                if (neighborScore < currentScore) {
                    currentSolution = neighbor;
                    currentScore = neighborScore;
                    improved = true;
                    this.stats.phase3Improvements++;
                    this.stats.totalImprovements++;
                    break;
                }
            }

            // If no improvement found, stop early
            if (!improved) {
                break;
            }

            // Periodic yield
            if (iter % 50 === 0) {
                await new Promise(resolve => setTimeout(resolve, 1));
            }
        }

        return { solution: currentSolution, score: currentScore };
    }

    /**
     * Tournament selection for genetic algorithm
     */
    tournamentSelection(scoredPopulation, tournamentSize) {
        const tournament = [];
        for (let i = 0; i < tournamentSize; i++) {
            const idx = Math.floor(Math.random() * scoredPopulation.length);
            tournament.push(scoredPopulation[idx]);
        }
        tournament.sort((a, b) => a.score - b.score);
        return tournament[0].teams;
    }

    /**
     * Slot-based crossover - combine two parent solutions
     */
    slotCrossover(parent1, parent2, composition, playerPool) {
        const child = [];
        const usedIds = new Set();

        // Take teams alternately from parents
        for (let i = 0; i < parent1.length; i++) {
            const sourceParent = Math.random() < 0.5 ? parent1 : parent2;
            const sourceTeam = sourceParent[i];

            const childTeam = [];
            sourceTeam.forEach(slot => {
                if (!usedIds.has(slot.playerId)) {
                    childTeam.push({
                        playerId: slot.playerId,
                        position: slot.position
                    });
                    usedIds.add(slot.playerId);
                }
            });

            child.push(childTeam);
        }

        // Fill missing slots from remaining players
        const allPlayerIds = playerPool.getAllPlayers().map(p => p.id);
        const remainingIds = allPlayerIds.filter(id => !usedIds.has(id));

        // Sort: specialists first so multi-position players stay flexible
        remainingIds.sort((a, b) => {
            const playerA = playerPool.getPlayer(a);
            const playerB = playerPool.getPlayer(b);
            return (playerA?.positions?.length || 1) - (playerB?.positions?.length || 1);
        });

        remainingIds.forEach(playerId => {
            const player = playerPool.getPlayer(playerId);
            if (!player || !player.positions || player.positions.length === 0) return;

            let placed = false;

            // Try ALL positions the player can play, not just the first one
            for (const position of player.positions) {
                const neededCount = composition[position] || 0;
                if (neededCount === 0) continue;

                for (let i = 0; i < child.length; i++) {
                    const currentCount = child[i].filter(s => s.position === position).length;
                    if (currentCount < neededCount) {
                        child[i].push({ playerId, position });
                        placed = true;
                        break;
                    }
                }
                if (placed) break;
            }

            // Last resort: add to smallest incomplete team
            if (!placed) {
                const teamSize = Object.values(composition).reduce((sum, c) => sum + c, 0);
                let smallestTeam = null;
                let smallestSize = Infinity;
                for (let i = 0; i < child.length; i++) {
                    if (child[i].length < teamSize && child[i].length < smallestSize) {
                        smallestSize = child[i].length;
                        smallestTeam = child[i];
                    }
                }
                if (smallestTeam) {
                    smallestTeam.push({ playerId, position: player.positions[0] });
                }
            }
        });

        return child;
    }

    /**
     * Get optimizer statistics
     */
    getStatistics() {
        return {
            ...this.stats,
            totalIterations: this.stats.phase1Iterations + this.stats.phase2Iterations + this.stats.phase3Iterations
        };
    }
}

export default SlotHybridOptimizer;
