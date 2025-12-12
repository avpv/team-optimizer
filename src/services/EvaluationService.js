/**
 * EvaluationService - Handles solution evaluation and scoring
 * Evaluates team balance, strength distribution, and position-level fairness
 * Enhanced with advanced metrics: fairness, consistency, depth, and role balance
 */

import { calculateSimpleTeamStrength } from '../utils/evaluationUtils.js';
import {
    calculateFairnessMetric,
    calculateConsistencyMetric,
    calculateDepthMetric,
    calculateRoleBalanceMetric,
    calculateAdvancedMetrics,
    calculateCombinedAdvancedScore
} from '../utils/advancedMetrics.js';
import { hashSolution } from '../utils/solutionUtils.js';

class EvaluationService {
    /**
     * @param {Object} activityConfig - Activity-specific configuration
     * @param {Object} adaptiveParameters - Adaptive parameters for evaluation
     * @param {Function} customEvaluationFn - Optional custom evaluation function
     */
    constructor(activityConfig, adaptiveParameters = {}, customEvaluationFn = null) {
        this.activityConfig = activityConfig;
        this.adaptiveParameters = {
            // Basic weights
            varianceWeight: 0.5,
            positionBalanceWeight: 0.3,

            // Advanced metrics weights
            fairnessWeight: 0.4,
            consistencyWeight: 0.3,
            depthWeight: 0.1,
            roleBalanceWeight: 0.2,

            // Advanced metrics options
            useAdvancedMetrics: true,
            topPlayerPercent: 0.2,

            // Cache settings
            enableCache: true,
            maxCacheSize: 10000,

            ...adaptiveParameters
        };
        this.customEvaluationFn = customEvaluationFn;

        // Cache for composition (set by optimizer)
        this.composition = null;

        // Evaluation cache for performance optimization
        this.evaluationCache = new Map();
        this.cacheHits = 0;
        this.cacheMisses = 0;
    }

    /**
     * Evaluate solution quality (lower is better)
     * Uses position-weighted ratings for more accurate team balance
     * Enhanced with advanced metrics when enabled
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

        // Check cache if enabled
        if (this.adaptiveParameters.enableCache) {
            const hash = hashSolution(teams);
            if (this.evaluationCache.has(hash)) {
                this.cacheHits++;
                return this.evaluationCache.get(hash);
            }
            this.cacheMisses++;
        }

        // Calculate team strengths using weighted ratings
        const teamStrengths = teams.map(team => {
            if (!Array.isArray(team)) return 0;
            return calculateSimpleTeamStrength(team, this.activityConfig.positionWeights);
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

        // Base score: balance + variance penalty + position imbalance penalty
        let score = balance +
                    Math.sqrt(variance) * this.adaptiveParameters.varianceWeight +
                    positionImbalance * this.adaptiveParameters.positionBalanceWeight;

        // Add advanced metrics if enabled
        if (this.adaptiveParameters.useAdvancedMetrics && this.composition) {
            const advancedMetrics = calculateAdvancedMetrics(
                teams,
                this.composition,
                this.activityConfig.positionWeights,
                {
                    topPlayerPercent: this.adaptiveParameters.topPlayerPercent,
                    includeFairness: this.adaptiveParameters.fairnessWeight > 0,
                    includeConsistency: this.adaptiveParameters.consistencyWeight > 0,
                    includeDepth: this.adaptiveParameters.depthWeight > 0,
                    includeRoleBalance: this.adaptiveParameters.roleBalanceWeight > 0
                }
            );

            const advancedScore = calculateCombinedAdvancedScore(advancedMetrics, {
                fairnessWeight: this.adaptiveParameters.fairnessWeight,
                consistencyWeight: this.adaptiveParameters.consistencyWeight,
                depthWeight: this.adaptiveParameters.depthWeight,
                roleBalanceWeight: this.adaptiveParameters.roleBalanceWeight
            });

            score += advancedScore;
        }

        // Store in cache if enabled
        if (this.adaptiveParameters.enableCache) {
            const hash = hashSolution(teams);
            this.evaluationCache.set(hash, score);

            // Limit cache size to prevent memory issues
            if (this.evaluationCache.size > this.adaptiveParameters.maxCacheSize) {
                // Remove oldest entries (first 10% of cache)
                const entriesToRemove = Math.floor(this.adaptiveParameters.maxCacheSize * 0.1);
                const iterator = this.evaluationCache.keys();
                for (let i = 0; i < entriesToRemove; i++) {
                    const key = iterator.next().value;
                    this.evaluationCache.delete(key);
                }
            }
        }

        return score;
    }

    /**
     * Clear evaluation cache
     */
    clearCache() {
        this.evaluationCache.clear();
        this.cacheHits = 0;
        this.cacheMisses = 0;
    }

    /**
     * Get cache statistics
     * @returns {Object} Cache statistics
     */
    getCacheStats() {
        const total = this.cacheHits + this.cacheMisses;
        return {
            hits: this.cacheHits,
            misses: this.cacheMisses,
            size: this.evaluationCache.size,
            hitRate: total > 0 ? (this.cacheHits / total * 100).toFixed(2) + '%' : '0%'
        };
    }

    /**
     * Calculate imbalance at position level
     * Ensures each position is fairly distributed across teams
     * @param {Array} teams - Teams to evaluate
     * @returns {number} Position imbalance score
     */
    calculatePositionImbalance(teams) {
        let totalImbalance = 0;

        Object.keys(this.activityConfig.positions).forEach(position => {
            const positionWeight = this.activityConfig.positionWeights[position] || 1.0;

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
        return calculateSimpleTeamStrength(team, this.activityConfig.positionWeights);
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

    /**
     * Set composition for advanced metrics calculation
     * @param {Object} composition - Position composition
     */
    setComposition(composition) {
        this.composition = composition;
    }

    /**
     * Get detailed evaluation with all metrics
     * @param {Array} teams - Teams to evaluate
     * @returns {Object} Detailed evaluation metrics
     */
    getDetailedEvaluation(teams) {
        if (!teams || !Array.isArray(teams) || teams.length === 0) {
            return null;
        }

        const teamStrengths = teams.map(team => {
            if (!Array.isArray(team)) return 0;
            return calculateSimpleTeamStrength(team, this.activityConfig.positionWeights);
        });

        const balance = Math.max(...teamStrengths) - Math.min(...teamStrengths);
        const avg = teamStrengths.reduce((a, b) => a + b, 0) / teamStrengths.length;
        const variance = teamStrengths.reduce((sum, s) => sum + Math.pow(s - avg, 2), 0) / teamStrengths.length;
        const positionImbalance = this.calculatePositionImbalance(teams);

        const evaluation = {
            score: this.evaluateSolution(teams),
            balance,
            variance,
            standardDeviation: Math.sqrt(variance),
            positionImbalance,
            teamStrengths,
            average: avg
        };

        // Add advanced metrics if enabled
        if (this.adaptiveParameters.useAdvancedMetrics && this.composition) {
            evaluation.advancedMetrics = calculateAdvancedMetrics(
                teams,
                this.composition,
                this.activityConfig.positionWeights,
                {
                    topPlayerPercent: this.adaptiveParameters.topPlayerPercent
                }
            );
        }

        return evaluation;
    }

    /**
     * Calculate fairness metric (for external use)
     * @param {Array} teams - Teams to evaluate
     * @returns {Object} Fairness metrics
     */
    calculateFairness(teams) {
        return calculateFairnessMetric(
            teams,
            this.activityConfig.positionWeights,
            this.adaptiveParameters.topPlayerPercent
        );
    }

    /**
     * Calculate consistency metric (for external use)
     * @param {Array} teams - Teams to evaluate
     * @returns {Object} Consistency metrics
     */
    calculateConsistency(teams) {
        if (!this.composition) {
            return null;
        }
        return calculateConsistencyMetric(
            teams,
            this.composition,
            this.activityConfig.positionWeights
        );
    }
}

export default EvaluationService;
