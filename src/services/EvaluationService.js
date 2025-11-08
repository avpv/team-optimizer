/**
 * EvaluationService - Handles solution evaluation and scoring
 * Evaluates team balance, strength distribution, and position-level fairness
 */

import { calculateSimpleTeamStrength } from '../utils/evaluationUtils.js';

class EvaluationService {
    /**
     * @param {Object} sportConfig - Sport-specific configuration
     * @param {Object} adaptiveParameters - Adaptive parameters for evaluation
     * @param {Function} customEvaluationFn - Optional custom evaluation function
     */
    constructor(sportConfig, adaptiveParameters = {}, customEvaluationFn = null) {
        this.sportConfig = sportConfig;
        this.adaptiveParameters = {
            varianceWeight: 0.5,
            positionBalanceWeight: 0.3,
            ...adaptiveParameters
        };
        this.customEvaluationFn = customEvaluationFn;
    }

    /**
     * Evaluate solution quality (lower is better)
     * Uses position-weighted ratings for more accurate team balance
     * @param {Array} teams - Solution to evaluate
     * @returns {number} Quality score (lower is better)
     */
    evaluateSolution(teams) {
        // Use custom evaluation function if provided
        if (this.customEvaluationFn) {
            return this.customEvaluationFn(teams, this);
        }

        // Default evaluation
        if (!teams || !Array.isArray(teams) || teams.length === 0) {
            return Infinity;
        }

        // Calculate team strengths using weighted ratings
        const teamStrengths = teams.map(team => {
            if (!Array.isArray(team)) return 0;
            return calculateSimpleTeamStrength(team, this.sportConfig.positionWeights);
        });

        // Check for invalid strengths
        if (teamStrengths.some(isNaN)) {
            return Infinity;
        }

        // Overall team balance (difference between strongest and weakest)
        const balance = Math.max(...teamStrengths) - Math.min(...teamStrengths);

        // Variance in team strengths (penalizes uneven distribution)
        const avg = teamStrengths.reduce((a, b) => a + b, 0) / teamStrengths.length;
        const variance = teamStrengths.reduce((sum, s) => sum + Math.pow(s - avg, 2), 0) / teamStrengths.length;

        // Position-level balance with position weights applied
        const positionImbalance = this.calculatePositionImbalance(teams);

        // Combined score: balance + variance penalty + position imbalance penalty
        return balance +
               Math.sqrt(variance) * this.adaptiveParameters.varianceWeight +
               positionImbalance * this.adaptiveParameters.positionBalanceWeight;
    }

    /**
     * Calculate imbalance at position level
     * Ensures each position is fairly distributed across teams
     * @param {Array} teams - Teams to evaluate
     * @returns {number} Position imbalance score
     */
    calculatePositionImbalance(teams) {
        let totalImbalance = 0;

        Object.keys(this.sportConfig.positions).forEach(position => {
            const positionWeight = this.sportConfig.positionWeights[position] || 1.0;

            // Calculate strength for this position in each team
            const positionStrengths = teams.map(team =>
                team.filter(p => p.assignedPosition === position)
                    .reduce((sum, p) => sum + (p.positionRating * positionWeight), 0)
            );

            // Only calculate imbalance if position has players and varies across teams
            if (positionStrengths.length > 1 && positionStrengths.some(s => s > 0)) {
                const positionBalance = Math.max(...positionStrengths) - Math.min(...positionStrengths);
                totalImbalance += positionBalance;
            }
        });

        return totalImbalance;
    }

    /**
     * Calculate team strength
     * @param {Array} team - Team to evaluate
     * @returns {number} Team strength
     */
    calculateTeamStrength(team) {
        return calculateSimpleTeamStrength(team, this.sportConfig.positionWeights);
    }

    /**
     * Update adaptive parameters
     * @param {Object} newParameters - New parameters to merge
     */
    updateParameters(newParameters) {
        this.adaptiveParameters = {
            ...this.adaptiveParameters,
            ...newParameters
        };
    }
}

export default EvaluationService;
