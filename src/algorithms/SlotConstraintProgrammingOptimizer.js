// src/algorithms/SlotConstraintProgrammingOptimizer.js

import IOptimizer from '../core/IOptimizer.js';
import { createSmartSlotSolution } from '../utils/slotSolutionGenerators.js';
import { evaluateSlotSolution } from '../utils/slotEvaluationUtils.js';

/**
 * Slot-Based Constraint Programming Optimizer
 *
 * Uses backtracking with forward checking to construct valid, balanced solutions.
 * Unlike other algorithms, CP doesn't mutate — it constructs from scratch.
 *
 * Key constraints:
 * 1. Each player assigned exactly once (AllDifferent)
 * 2. Each team has correct position composition
 * 3. Players only assigned to positions they can play
 *
 * Forward checking: after each assignment, prune domains of future variables
 * by removing the assigned player. If any future variable's domain becomes
 * empty, backtrack immediately (fail-fast).
 *
 * Variable ordering: MRV (Minimum Remaining Values) — assign the variable
 * with the smallest domain first, reducing branching factor.
 *
 * Value ordering: balance-aware — prefer players that equalize team strength.
 */
class SlotConstraintProgrammingOptimizer extends IOptimizer {
    constructor(config) {
        super(config);
        this.stats = {
            iterations: 0,
            improvements: 0,
            backtracks: 0,
            conflicts: 0,
            pruned: 0
        };
    }

    /**
     * Solve using Constraint Programming
     */
    async solve(problemContext) {
        const {
            composition,
            teamCount,
            playerPool,
            positionWeights
        } = problemContext;

        try {
            const attempts = Math.min(5, Math.ceil(this.config.maxBacktracks / 3000));
            let bestSolution = null;
            let bestScore = Infinity;

            for (let attempt = 0; attempt < attempts; attempt++) {
                const variables = this.buildCPVariables(composition, teamCount, playerPool);

                // Sort by MRV (smallest domain first) for first attempt;
                // add randomization for subsequent attempts
                if (attempt === 0) {
                    variables.sort((a, b) => a.domain.length - b.domain.length);
                } else {
                    // Partially randomize while keeping scarce positions early
                    variables.sort((a, b) => {
                        const da = a.domain.length + Math.random() * 3;
                        const db = b.domain.length + Math.random() * 3;
                        return da - db;
                    });
                }

                const attemptStats = { backtracks: 0, conflicts: 0, pruned: 0 };

                const solution = await this.backtrackWithFC(
                    variables, teamCount, playerPool, positionWeights, attemptStats
                );

                this.stats.backtracks += attemptStats.backtracks;
                this.stats.conflicts += attemptStats.conflicts;
                this.stats.pruned += attemptStats.pruned;

                if (solution) {
                    const score = evaluateSlotSolution(solution, playerPool, positionWeights, composition);
                    if (score < bestScore) {
                        bestSolution = solution;
                        bestScore = score;
                        this.stats.improvements++;
                    }
                }

                if (attempt % 2 === 0) await new Promise(resolve => setTimeout(resolve, 1));
            }

            if (!bestSolution) {
                bestSolution = createSmartSlotSolution(composition, teamCount, playerPool);
            }

            return bestSolution;
        } catch (error) {
            return createSmartSlotSolution(composition, teamCount, playerPool);
        }
    }

    /**
     * Build CP variables with initial domains
     */
    buildCPVariables(composition, teamCount, playerPool) {
        const variables = [];

        for (let teamIdx = 0; teamIdx < teamCount; teamIdx++) {
            Object.entries(composition).forEach(([position, count]) => {
                for (let slot = 0; slot < count; slot++) {
                    const eligiblePlayerIds = playerPool.getPlayerIdsForPosition(position);
                    variables.push({
                        teamIndex: teamIdx,
                        position: position,
                        domain: [...eligiblePlayerIds],
                        assignment: null
                    });
                }
            });
        }

        return variables;
    }

    /**
     * Backtracking with forward checking.
     * After each assignment, removes the assigned player from all future
     * variables' domains. If any domain becomes empty → fail-fast.
     */
    async backtrackWithFC(variables, teamCount, playerPool, positionWeights, stats) {
        const teams = Array.from({ length: teamCount }, () => []);
        const domainStack = []; // Stack of domain snapshots for undo

        const solve = async (varIndex) => {
            if (varIndex >= variables.length) {
                return true; // All assigned
            }
            if (stats.backtracks > this.config.maxBacktracks) {
                return false;
            }

            const variable = variables[varIndex];

            // Value ordering: sort domain by balance heuristic
            const orderedDomain = this.orderDomainByBalance(
                variable, teams, playerPool, positionWeights
            );

            for (const playerId of orderedDomain) {
                // Assign
                variable.assignment = playerId;
                teams[variable.teamIndex].push({
                    playerId: playerId,
                    position: variable.position
                });

                // Forward check: prune future domains
                const pruneResult = this.forwardCheck(varIndex, playerId, variables);

                if (pruneResult.feasible) {
                    stats.pruned += pruneResult.pruned;

                    if (await solve(varIndex + 1)) {
                        return true;
                    }
                } else {
                    stats.conflicts++;
                }

                // Undo: restore domains and assignment
                this.undoForwardCheck(pruneResult.removedFrom, playerId, variables);
                variable.assignment = null;
                teams[variable.teamIndex].pop();
                stats.backtracks++;

                if (stats.backtracks % 1000 === 0) {
                    await new Promise(resolve => setTimeout(resolve, 1));
                }
            }

            return false;
        };

        const success = await solve(0);
        return success ? teams : null;
    }

    /**
     * Forward checking: remove assigned playerId from all unassigned variables' domains.
     * Returns { feasible, pruned, removedFrom } where removedFrom tracks which
     * variables were affected (for undo).
     */
    forwardCheck(currentIndex, playerId, variables) {
        const removedFrom = [];
        let pruned = 0;

        for (let i = currentIndex + 1; i < variables.length; i++) {
            if (variables[i].assignment !== null) continue;

            const domain = variables[i].domain;
            const idx = domain.indexOf(playerId);
            if (idx !== -1) {
                domain.splice(idx, 1);
                removedFrom.push(i);
                pruned++;

                // Domain wipeout → infeasible
                if (domain.length === 0) {
                    // Undo what we just pruned before reporting infeasible
                    for (const vi of removedFrom) {
                        variables[vi].domain.push(playerId);
                    }
                    return { feasible: false, pruned: 0, removedFrom: [] };
                }
            }
        }

        return { feasible: true, pruned, removedFrom };
    }

    /**
     * Undo forward checking by restoring removed values
     */
    undoForwardCheck(removedFrom, playerId, variables) {
        for (const vi of removedFrom) {
            variables[vi].domain.push(playerId);
        }
    }

    /**
     * Order domain values by balance heuristic: prefer players that equalize
     * team strength toward the average.
     */
    orderDomainByBalance(variable, teams, playerPool, positionWeights) {
        const teamIdx = variable.teamIndex;
        const position = variable.position;
        const weight = positionWeights[position] || 1.0;

        // Current team strengths
        const strengths = teams.map(team =>
            team.reduce((sum, s) => {
                const r = playerPool.getPlayerRating(s.playerId, s.position);
                const w = positionWeights[s.position] || 1.0;
                return sum + r * w;
            }, 0)
        );
        const avgStrength = strengths.reduce((a, b) => a + b, 0) / teams.length;
        const myStrength = strengths[teamIdx];

        // Score each candidate: lower distance from average = better
        return [...variable.domain].sort((a, b) => {
            const rA = playerPool.getPlayerRating(a, position) * weight;
            const rB = playerPool.getPlayerRating(b, position) * weight;
            const distA = Math.abs(myStrength + rA - avgStrength);
            const distB = Math.abs(myStrength + rB - avgStrength);
            return distA - distB;
        });
    }

    getStatistics() {
        return this.stats;
    }
}

export default SlotConstraintProgrammingOptimizer;
