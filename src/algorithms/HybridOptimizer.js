// src/algorithms/HybridOptimizer.js

import IOptimizer from '../core/IOptimizer.js';
import { cloneTeams, hashSolution } from '../utils/solutionUtils.js';
import { performUniversalSwap } from '../utils/swapOperations.js';
import { performIntelligentSwap } from '../utils/advancedSwapOperations.js';
import { createRandomSolution } from '../utils/solutionGenerators.js';

/**
 * Hybrid Optimizer - Combines multiple optimization strategies
 *
 * Phase 1: Genetic Algorithm (Global Exploration)
 *   - Explores solution space widely
 *   - Uses population-based approach
 *   - Good for escaping local minima
 *
 * Phase 2: Tabu Search (Focused Exploitation)
 *   - Intensifies search in promising regions
 *   - Uses memory to avoid revisiting solutions
 *   - Good for local optimization
 *
 * Phase 3: Local Search (Final Polishing)
 *   - Greedy hill-climbing for final refinement
 *   - Ensures local optimum
 */
class HybridOptimizer extends IOptimizer {
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
     * @returns {Promise<Array>} Best solution found
     */
    async solve(problemContext) {
        const {
            initialSolution,
            composition,
            teamCount,
            playersByPosition,
            positions,
            evaluateFn
        } = problemContext;

        try {
            let currentSolution = Array.isArray(initialSolution[0])
                ? cloneTeams(initialSolution[0])
                : cloneTeams(initialSolution);

            let bestSolution = cloneTeams(currentSolution);
            let bestScore = evaluateFn(bestSolution);

            console.log('[HybridOptimizer] Starting optimization');
            console.log(`[HybridOptimizer] Initial score: ${bestScore.toFixed(2)}`);

            // Phase 1: Genetic Algorithm - Global Exploration
            console.log('[HybridOptimizer] Phase 1: Genetic Algorithm (Global Exploration)');
            const phase1Result = await this.phase1GeneticAlgorithm(
                problemContext,
                currentSolution,
                bestScore
            );

            if (phase1Result.score < bestScore) {
                bestSolution = phase1Result.solution;
                bestScore = phase1Result.score;
                this.stats.bestPhase = 'Genetic Algorithm';
                console.log(`[HybridOptimizer] Phase 1 improved to: ${bestScore.toFixed(2)}`);
            }

            // Phase 2: Tabu Search - Focused Exploitation
            console.log('[HybridOptimizer] Phase 2: Tabu Search (Focused Exploitation)');
            const phase2Result = await this.phase2TabuSearch(
                problemContext,
                bestSolution,
                bestScore
            );

            if (phase2Result.score < bestScore) {
                bestSolution = phase2Result.solution;
                bestScore = phase2Result.score;
                this.stats.bestPhase = 'Tabu Search';
                console.log(`[HybridOptimizer] Phase 2 improved to: ${bestScore.toFixed(2)}`);
            }

            // Phase 3: Local Search - Final Polishing
            console.log('[HybridOptimizer] Phase 3: Local Search (Final Polishing)');
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
                console.log(`[HybridOptimizer] Phase 3 improved to: ${bestScore.toFixed(2)}`);
            }

            console.log(`[HybridOptimizer] Final score: ${bestScore.toFixed(2)}`);
            console.log(`[HybridOptimizer] Best improvement from: ${this.stats.bestPhase || 'Initial Solution'}`);

            return bestSolution;

        } catch (error) {
            console.error('[HybridOptimizer] Error during optimization:', error);
            return initialSolution;
        }
    }

    /**
     * Phase 1: Genetic Algorithm for global exploration
     */
    async phase1GeneticAlgorithm(problemContext, initialSolution, initialScore) {
        const { composition, teamCount, playersByPosition, positions, evaluateFn } = problemContext;
        const config = this.config.phase1 || {
            populationSize: 15,
            generations: 100,
            mutationRate: 0.3,
            crossoverRate: 0.7,
            elitismCount: 2,
            tournamentSize: 3
        };

        // Initialize population
        let population = [cloneTeams(initialSolution)];
        while (population.length < config.populationSize) {
            population.push(createRandomSolution(composition, teamCount, playersByPosition));
        }

        let bestSolution = cloneTeams(initialSolution);
        let bestScore = initialScore;

        for (let gen = 0; gen < config.generations; gen++) {
            this.stats.phase1Iterations++;

            // Evaluate population
            const scored = population.map(individual => ({
                teams: individual,
                score: evaluateFn(individual)
            })).sort((a, b) => a.score - b.score);

            // Track best
            if (scored[0].score < bestScore) {
                bestSolution = cloneTeams(scored[0].teams);
                bestScore = scored[0].score;
                this.stats.phase1Improvements++;
                this.stats.totalImprovements++;
            }

            // Create new population
            const newPopulation = scored.slice(0, config.elitismCount).map(s => cloneTeams(s.teams));

            while (newPopulation.length < config.populationSize) {
                const parent1 = this.tournamentSelection(scored, config.tournamentSize);

                if (Math.random() < config.crossoverRate) {
                    const parent2 = this.tournamentSelection(scored, config.tournamentSize);
                    const child = this.crossover(parent1, parent2, composition);
                    newPopulation.push(child);
                } else {
                    newPopulation.push(cloneTeams(parent1));
                }
            }

            // Mutation with intelligent swaps
            for (let i = config.elitismCount; i < newPopulation.length; i++) {
                if (Math.random() < config.mutationRate) {
                    // Use intelligent swap 60% of time, universal swap 40%
                    if (Math.random() < 0.6) {
                        performIntelligentSwap(newPopulation[i], positions, composition, this.adaptiveParams);
                    } else {
                        performUniversalSwap(newPopulation[i], positions, this.adaptiveParams);
                    }
                }
            }

            population = newPopulation;

            // Periodic yield to prevent blocking
            if (gen % 20 === 0) {
                await new Promise(resolve => setTimeout(resolve, 0));
            }
        }

        return { solution: bestSolution, score: bestScore };
    }

    /**
     * Phase 2: Tabu Search for focused exploitation
     */
    async phase2TabuSearch(problemContext, initialSolution, initialScore) {
        const { composition, positions, evaluateFn } = problemContext;
        const config = this.config.phase2 || {
            iterations: 3000,
            tabuTenure: 50,
            neighborhoodSize: 15,
            diversificationFrequency: 500
        };

        let currentSolution = cloneTeams(initialSolution);
        let currentScore = initialScore;
        let bestSolution = cloneTeams(initialSolution);
        let bestScore = initialScore;

        const tabuList = new Set();
        let iterationsSinceImprovement = 0;

        for (let iter = 0; iter < config.iterations; iter++) {
            this.stats.phase2Iterations++;

            // Generate neighborhood using intelligent swaps
            const neighbors = [];
            for (let n = 0; n < config.neighborhoodSize; n++) {
                const neighbor = cloneTeams(currentSolution);

                // Use intelligent swaps
                performIntelligentSwap(neighbor, positions, composition, this.adaptiveParams);

                const hash = hashSolution(neighbor);
                if (!tabuList.has(hash)) {
                    neighbors.push({
                        solution: neighbor,
                        score: evaluateFn(neighbor),
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
                    bestSolution = cloneTeams(currentSolution);
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
                // Perform several random swaps to escape
                for (let i = 0; i < 5; i++) {
                    performUniversalSwap(currentSolution, positions, this.adaptiveParams);
                }
                currentScore = evaluateFn(currentSolution);
                iterationsSinceImprovement = 0;
                tabuList.clear();
            }

            // Periodic yield
            if (iter % 100 === 0) {
                await new Promise(resolve => setTimeout(resolve, 0));
            }
        }

        return { solution: bestSolution, score: bestScore };
    }

    /**
     * Phase 3: Local Search for final polishing
     */
    async phase3LocalSearch(problemContext, initialSolution, initialScore) {
        const { composition, positions, evaluateFn } = problemContext;
        const config = this.config.phase3 || {
            iterations: 1000,
            neighborhoodSize: 10
        };

        let currentSolution = cloneTeams(initialSolution);
        let currentScore = initialScore;

        for (let iter = 0; iter < config.iterations; iter++) {
            this.stats.phase3Iterations++;

            let improved = false;

            // Try multiple neighbors
            for (let n = 0; n < config.neighborhoodSize; n++) {
                const neighbor = cloneTeams(currentSolution);

                // Use intelligent swaps for final polishing
                performIntelligentSwap(neighbor, positions, composition, this.adaptiveParams);

                const neighborScore = evaluateFn(neighbor);

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
                await new Promise(resolve => setTimeout(resolve, 0));
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
     * Simple crossover - combine two parent solutions
     */
    crossover(parent1, parent2, composition) {
        const child = cloneTeams(parent1);

        // Randomly swap some teams from parent2
        for (let i = 0; i < child.length; i++) {
            if (Math.random() < 0.5 && parent2[i]) {
                child[i] = parent2[i].map(player => ({ ...player }));
            }
        }

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

export default HybridOptimizer;
