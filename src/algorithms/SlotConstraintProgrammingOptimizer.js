// src/algorithms/SlotConstraintProgrammingOptimizer.js

import IOptimizer from '../core/IOptimizer.js';
import { createSmartSlotSolution } from '../utils/slotSolutionGenerators.js';
import { evaluateSlotSolution } from '../utils/slotEvaluationUtils.js';

/**
 * Slot-Based Constraint Programming Optimizer
 *
 * Uses backtracking with constraint propagation to construct valid solutions.
 * Unlike other algorithms, CP doesn't mutate - it constructs from scratch.
 *
 * Key constraints:
 * 1. Each player assigned exactly once (AllDifferent)
 * 2. Each team has correct position composition
 * 3. Players only assigned to positions they can play
 *
 * Advantages with slot structure:
 * - Constraints naturally enforced (ID-based assignment)
 * - Fast constraint checking (Set operations on IDs)
 * - Domain pruning more efficient
 */
class SlotConstraintProgrammingOptimizer extends IOptimizer {
    constructor(config) {
        super(config);
        this.stats = {
            iterations: 0,
            improvements: 0,
            backtracks: 0,
            conflicts: 0
        };
    }

    /**
     * Solve using Constraint Programming
     * @param {Object} problemContext - Problem context
     * @param {Object} problemContext.composition - Position composition
     * @param {number} problemContext.teamCount - Number of teams
     * @param {Object} problemContext.playerPool - PlayerPool instance
     * @param {Object} problemContext.positionWeights - Position weights
     * @returns {Promise<Array<Array<{playerId, position}>>>} Best solution found
     */
    async solve(problemContext) {
        const {
            composition,
            teamCount,
            playerPool,
            positionWeights
        } = problemContext;

        try {
            // Build constraint model
            const variables = this.buildCPVariables(composition, teamCount, playerPool);

            // Try multiple attempts with different variable orderings
            const attempts = Math.min(3, Math.ceil(this.config.maxBacktracks / 4000));
            let bestSolution = null;
            let bestScore = Infinity;

            for (let attempt = 0; attempt < attempts; attempt++) {
                // Shuffle variables for diversity
                if (attempt > 0) {
                    this.shuffleArray(variables);
                }

                // Reset stats for this attempt
                const attemptStats = { backtracks: 0, conflicts: 0 };

                // Try to find solution using backtracking
                const solution = await this.cpBacktrackingSearch(
                    variables,
                    composition,
                    teamCount,
                    playerPool,
                    attemptStats
                );

                this.stats.backtracks += attemptStats.backtracks;
                this.stats.conflicts += attemptStats.conflicts;

                if (solution) {
                    const score = evaluateSlotSolution(solution, playerPool, positionWeights);

                    if (score < bestScore) {
                        bestSolution = solution;
                        bestScore = score;
                        this.stats.improvements++;
                    }
                }

                // Yield control periodically
                if (attempt % 10 === 0) await new Promise(resolve => setTimeout(resolve, 1));
            }

            // Fallback to smart construction if no solution found
            if (!bestSolution) {
                console.warn(`SlotCP: No solution found after ${this.stats.backtracks} backtracks, using smart construction`);
                bestSolution = createSmartSlotSolution(composition, teamCount, playerPool);
            }

            return bestSolution;
        } catch (error) {
            console.error('SlotCP: Error during optimization:', error);
            return createSmartSlotSolution(composition, teamCount, playerPool);
        }
    }

    /**
     * Build CP variables: each position slot needs a player assignment
     * @param {Object} composition - Position composition
     * @param {number} teamCount - Number of teams
     * @param {Object} playerPool - PlayerPool instance
     * @returns {Array} Variables with domains
     */
    buildCPVariables(composition, teamCount, playerPool) {
        const variables = [];

        // For each team and position slot, we need to assign a player
        for (let teamIdx = 0; teamIdx < teamCount; teamIdx++) {
            Object.entries(composition).forEach(([position, count]) => {
                for (let slot = 0; slot < count; slot++) {
                    const eligiblePlayerIds = playerPool.getPlayerIdsForPosition(position);

                    variables.push({
                        id: `team${teamIdx}_${position}_${slot}`,
                        teamIndex: teamIdx,
                        position: position,
                        slotIndex: slot,
                        domain: [...eligiblePlayerIds], // Copy for domain pruning
                        assignment: null
                    });
                }
            });
        }

        return variables;
    }

    /**
     * Backtracking search with constraint propagation
     * @param {Array} variables - CP variables
     * @param {Object} composition - Position composition
     * @param {number} teamCount - Number of teams
     * @param {Object} playerPool - PlayerPool instance
     * @param {Object} stats - Statistics tracker
     * @returns {Array<Array<{playerId, position}>>|null} Solution or null
     */
    async cpBacktrackingSearch(variables, composition, teamCount, playerPool, stats) {
        const usedPlayerIds = new Set();
        const teams = Array.from({ length: teamCount }, () => []);

        return await this.backtrack(0, variables, usedPlayerIds, teams, stats);
    }

    /**
     * Recursive backtracking
     * @param {number} varIndex - Current variable index
     * @param {Array} variables - All variables
     * @param {Set} usedPlayerIds - Already assigned player IDs
     * @param {Array} teams - Current team assignments
     * @param {Object} stats - Statistics tracker
     * @returns {Array|null} Solution or null
     */
    async backtrack(varIndex, variables, usedPlayerIds, teams, stats) {
        // Base case: all variables assigned
        if (varIndex >= variables.length) {
            return teams;
        }

        // Check if we exceeded backtrack limit
        if (stats.backtracks > this.config.maxBacktracks) {
            return null;
        }

        const variable = variables[varIndex];

        // Try each value in domain
        for (const playerId of variable.domain) {
            // Check constraint: player not already used
            if (usedPlayerIds.has(playerId)) {
                stats.conflicts++;
                continue;
            }

            // Assign variable
            variable.assignment = playerId;
            usedPlayerIds.add(playerId);
            teams[variable.teamIndex].push({
                playerId: playerId,
                position: variable.position
            });

            // Recursively assign next variable
            const result = await this.backtrack(
                varIndex + 1,
                variables,
                usedPlayerIds,
                teams,
                stats
            );

            if (result !== null) {
                return result; // Solution found
            }

            // Backtrack
            stats.backtracks++;
            variable.assignment = null;
            usedPlayerIds.delete(playerId);
            teams[variable.teamIndex].pop();

            // Yield control occasionally during deep backtracking
            if (stats.backtracks % 1000 === 0) {
                await new Promise(resolve => setTimeout(resolve, 1));
            }
        }

        // No valid assignment found for this variable
        return null;
    }

    /**
     * Shuffle array in place (for variable ordering diversity)
     * @param {Array} array - Array to shuffle
     */
    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }

    getStatistics() {
        return this.stats;
    }
}

export default SlotConstraintProgrammingOptimizer;
