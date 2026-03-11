// src/algorithms/SlotAntColonyOptimizer.js

import IOptimizer from '../core/IOptimizer.js';
import { cloneSlotTeams } from '../utils/teamSlotUtils.js';
import { evaluateSlotSolution } from '../utils/slotEvaluationUtils.js';

/**
 * Slot-Based Ant Colony Optimizer
 *
 * Inspired by foraging behavior of ants using pheromone trails.
 * Ants construct solutions probabilistically based on:
 * - Pheromones (learned from previous good solutions)
 * - Heuristic information (player ratings)
 *
 * Key features:
 * - Constructs solutions from scratch (no mutation)
 * - Pheromone evaporation prevents premature convergence
 * - Elitist strategy reinforces best solutions
 * - Naturally diverse (each ant explores differently)
 *
 * Advantages with slot structure:
 * - Faster solution construction (just store IDs)
 * - Instant pheromone updates (keyed by playerId)
 * - No duplicate checking needed during construction
 */
class SlotAntColonyOptimizer extends IOptimizer {
    constructor(config) {
        super(config);
        this.stats = {
            iterations: 0,
            improvements: 0
        };
    }

    /**
     * Solve using Ant Colony Optimization
     * @param {Object} problemContext - Problem context
     * @param {Object} problemContext.composition - Position composition
     * @param {number} problemContext.teamCount - Number of teams
     * @param {Object} problemContext.playerPool - PlayerPool instance
     * @param {Array<string>} problemContext.positions - Available positions
     * @param {Object} problemContext.positionWeights - Position weights
     * @returns {Promise<Array<Array<{playerId, position}>>>} Best solution found
     */
    async solve(problemContext) {
        const {
            composition,
            teamCount,
            playerPool,
            positions,
            positionWeights
        } = problemContext;

        try {
            // Initialize pheromone matrix: Map<playerId, Array<pheromone per team>>
            const allPlayerIds = playerPool.getAllPlayers().map(p => p.id);
            const pheromones = new Map();
            allPlayerIds.forEach(playerId => {
                pheromones.set(playerId, Array(teamCount).fill(1.0));
            });

            let globalBest = null;
            let globalBestScore = Infinity;

            for (let iter = 0; iter < this.config.iterations; iter++) {
                this.stats.iterations = iter + 1;
                const iterationSolutions = [];

                // Each ant constructs a solution
                for (let ant = 0; ant < this.config.antCount; ant++) {
                    const solution = this.constructAntSolution(
                        composition,
                        teamCount,
                        playerPool,
                        pheromones,
                        positionWeights
                    );

                    const score = evaluateSlotSolution(solution, playerPool, positionWeights, composition);
                    iterationSolutions.push({ solution, score });

                    if (score < globalBestScore) {
                        globalBest = cloneSlotTeams(solution);
                        globalBestScore = score;
                        this.stats.improvements++;
                    }
                }

                // Evaporate pheromones
                pheromones.forEach((teamPheromones) => {
                    for (let t = 0; t < teamCount; t++) {
                        teamPheromones[t] *= (1 - this.config.evaporationRate);
                    }
                });

                // Deposit pheromones from all solutions
                iterationSolutions.forEach(({ solution, score }) => {
                    const deposit = this.config.pheromoneDeposit / (1 + score);
                    solution.forEach((team, teamIndex) => {
                        team.forEach(slot => {
                            const teamPheromones = pheromones.get(slot.playerId);
                            if (teamPheromones) {
                                teamPheromones[teamIndex] += deposit;
                            }
                        });
                    });
                });

                // Elitist strategy: extra pheromones for global best
                if (globalBest) {
                    const elitistDeposit = this.config.pheromoneDeposit * this.config.elitistWeight / (1 + globalBestScore);
                    globalBest.forEach((team, teamIndex) => {
                        team.forEach(slot => {
                            const teamPheromones = pheromones.get(slot.playerId);
                            if (teamPheromones) {
                                teamPheromones[teamIndex] += elitistDeposit;
                            }
                        });
                    });
                }

                // Yield control periodically
                if (iter % 10 === 0) await new Promise(resolve => setTimeout(resolve, 1));
            }

            // If no solution found, create a fallback
            if (!globalBest) {
                const { createRandomSlotSolution } = await import('../utils/slotSolutionGenerators.js');
                globalBest = createRandomSlotSolution(composition, teamCount, playerPool);
            }

            return globalBest;
        } catch (error) {
            throw error;
        }
    }

    /**
     * Construct a solution using ant colony principles
     * @param {Object} composition - Position composition
     * @param {number} teamCount - Number of teams
     * @param {Object} playerPool - PlayerPool instance
     * @param {Map} pheromones - Pheromone matrix
     * @returns {Array<Array<{playerId, position}>>} Constructed solution
     */
    constructAntSolution(composition, teamCount, playerPool, pheromones, positionWeights = {}) {
        const teams = Array.from({ length: teamCount }, () => []);
        const usedIds = new Set();

        // Pre-calculate target strength per team (total / teamCount)
        const totalStrength = playerPool.getAllPlayers().reduce((sum, p) => {
            const bestPos = p.positions?.[0];
            if (!bestPos) return sum;
            const rating = p.ratings?.[bestPos] || 1500;
            const weight = positionWeights[bestPos] || 1.0;
            return sum + rating * weight;
        }, 0);
        const targetStrength = totalStrength / teamCount;

        // Sort positions by scarcity: scarcer positions first to avoid running out of players
        const positionOrder = Object.entries(composition)
            .filter(([, count]) => count && count > 0)
            .map(([pos, count]) => {
                const totalNeeded = count * teamCount;
                const available = playerPool.getPlayerIdsForPosition(pos).length;
                const scarcity = available / totalNeeded; // Lower = scarcer
                return [pos, count, scarcity];
            })
            .sort((a, b) => a[2] - b[2]); // Scarce positions first

        positionOrder.forEach(([position, neededCount]) => {
            // Get available player IDs for this position, prefer specialists
            let availablePlayerIds = playerPool.getPlayerIdsForPosition(position)
                .filter(id => !usedIds.has(id));

            // Sort: specialists first (fewer positions = higher priority)
            availablePlayerIds.sort((a, b) => {
                const playerA = playerPool.getPlayer(a);
                const playerB = playerPool.getPlayer(b);
                return (playerA?.positions?.length || 1) - (playerB?.positions?.length || 1);
            });

            for (let teamIdx = 0; teamIdx < teamCount; teamIdx++) {
                for (let slot = 0; slot < neededCount; slot++) {
                    // Refresh available list (some may have been used for other teams)
                    availablePlayerIds = availablePlayerIds.filter(id => !usedIds.has(id));
                    if (availablePlayerIds.length === 0) break;

                    // Calculate probabilities based on pheromones and balance heuristic
                    const probabilities = this.calculateAntProbabilities(
                        availablePlayerIds,
                        teamIdx,
                        position,
                        playerPool,
                        pheromones,
                        teams,
                        positionWeights,
                        targetStrength
                    );

                    // Select player based on probabilities
                    const selectedPlayerId = this.rouletteWheelSelection(
                        availablePlayerIds,
                        probabilities
                    );

                    // Add slot to team
                    teams[teamIdx].push({
                        playerId: selectedPlayerId,
                        position: position
                    });
                    usedIds.add(selectedPlayerId);
                }
            }
        });

        return teams;
    }

    /**
     * Calculate selection probabilities for ant colony.
     * Heuristic prefers players that EQUALIZE team strength toward the target,
     * not just strong players (which would stack all stars on one team).
     *
     * @param {Array<number>} playerIds - Available player IDs
     * @param {number} teamIndex - Current team index
     * @param {string} position - Position being filled
     * @param {Object} playerPool - PlayerPool instance
     * @param {Map} pheromones - Pheromone matrix
     * @param {Array<Array<{playerId, position}>>} teams - Current partial teams
     * @param {Object} positionWeights - Position weights
     * @param {number} targetStrength - Target strength per team
     * @returns {Array<number>} Probabilities for each player
     */
    calculateAntProbabilities(playerIds, teamIndex, position, playerPool, pheromones, teams, positionWeights, targetStrength) {
        const probabilities = [];
        let totalProbability = 0;

        const weight = positionWeights[position] || 1.0;

        // Current team strength (overall)
        const currentStrength = teams[teamIndex].reduce((sum, s) => {
            const r = playerPool.getPlayerRating(s.playerId, s.position);
            const w = positionWeights[s.position] || 1.0;
            return sum + r * w;
        }, 0);

        // Current position-level strength for this team vs others
        const posStrengths = teams.map(team => {
            const slots = team.filter(s => s.position === position);
            return slots.reduce((sum, s) =>
                sum + playerPool.getPlayerRating(s.playerId, position), 0);
        });
        const avgPosStrength = posStrengths.reduce((a, b) => a + b, 0) / Math.max(1, teams.length);

        playerIds.forEach(playerId => {
            const teamPheromones = pheromones.get(playerId) || Array(10).fill(1.0);
            const pheromone = teamPheromones[teamIndex] || 1.0;

            const rating = playerPool.getPlayerRating(playerId, position);

            // Heuristic 1: overall team strength → target
            const afterStrength = currentStrength + rating * weight;
            const overallH = 1 / (1 + Math.abs(afterStrength - targetStrength) / 100);

            // Heuristic 2: position-level balance — prefer players that keep
            // this team's position strength close to the cross-team average
            const afterPosStrength = posStrengths[teamIndex] + rating;
            const posH = 1 / (1 + Math.abs(afterPosStrength - avgPosStrength - rating / teams.length) / 50);

            // Combined: 60% overall balance + 40% position-level balance
            const heuristic = overallH * 0.6 + posH * 0.4;

            const probability = Math.pow(pheromone, this.config.alpha) *
                              Math.pow(heuristic, this.config.beta);
            probabilities.push(probability);
            totalProbability += probability;
        });

        return probabilities.map(p =>
            totalProbability > 0 ? p / totalProbability : 1 / playerIds.length
        );
    }

    /**
     * Roulette wheel selection
     * @param {Array<number>} playerIds - Available player IDs
     * @param {Array<number>} probabilities - Selection probabilities
     * @returns {number} Selected player ID
     */
    rouletteWheelSelection(playerIds, probabilities) {
        const random = Math.random();
        let cumulative = 0;

        for (let i = 0; i < playerIds.length; i++) {
            cumulative += probabilities[i];
            if (random <= cumulative) {
                return playerIds[i];
            }
        }

        return playerIds[playerIds.length - 1]; // Fallback
    }

    getStatistics() {
        return this.stats;
    }
}

export default SlotAntColonyOptimizer;
