/**
 * Evaluation Utilities for Resolved Teams
 *
 * These functions work with RESOLVED team structures (after PlayerPool.resolveTeams).
 * Resolved teams contain player objects with:
 * - assignedPosition: The position the player is assigned to
 * - positionRating: The player's rating for that position
 *
 * This is separate from slotEvaluationUtils.js which works with slot-based structures
 * during optimization ({playerId, position}).
 */

/**
 * Get player's rating (for resolved team player)
 * @param {Object} player - Resolved player object with assignedPosition and positionRating
 * @param {string} position - Optional position override (if not provided, uses assignedPosition)
 * @returns {number} Player rating
 */
export function getPlayerRating(player, position = null) {
    // If position is explicitly provided, use it
    if (position) {
        return player.ratings?.[position] || 1500;
    }

    // For resolved players, use the already-calculated positionRating
    if (player.positionRating !== undefined) {
        return player.positionRating;
    }

    // Fallback: calculate from ratings and assignedPosition
    const assignedPos = player.assignedPosition || player.positions?.[0];
    if (assignedPos && player.ratings?.[assignedPos]) {
        return player.ratings[assignedPos];
    }

    // Default rating
    return 1500;
}

/**
 * Calculate simple team strength (for resolved team)
 * @param {Array<Object>} team - Resolved team (array of player objects with assignedPosition)
 * @param {Object} positionWeights - Position weights from config
 * @returns {number} Team strength
 */
export function calculateSimpleTeamStrength(team, positionWeights = {}) {
    if (!Array.isArray(team) || team.length === 0) {
        return 0;
    }

    let totalStrength = 0;

    team.forEach(player => {
        const rating = getPlayerRating(player);
        const position = player.assignedPosition || player.positions?.[0];
        const weight = positionWeights[position] || 1.0;
        totalStrength += rating * weight;
    });

    return totalStrength;
}

/**
 * Calculate team strength with optional detailed mode
 * @param {Array<Object>} team - Resolved team
 * @param {Object} positionWeights - Position weights from config
 * @param {boolean} detailed - If true, returns detailed statistics
 * @returns {number|Object} Team strength or detailed stats object
 */
export function calculateTeamStrength(team, positionWeights = {}, detailed = false) {
    if (detailed) {
        const stats = calculateTeamStrengthDetailed(team, positionWeights);
        // Add averageWeightedRating for compatibility with advancedValidation.js
        return {
            ...stats,
            averageWeightedRating: team.length > 0 ? stats.weightedRating / team.length : 0
        };
    }
    return calculateSimpleTeamStrength(team, positionWeights);
}

/**
 * Calculate detailed team strength with ratings breakdown
 * @param {Array<Object>} team - Resolved team
 * @param {Object} positionWeights - Position weights from config
 * @returns {{weightedRating: number, unweightedRating: number, positionBreakdown: Object}}
 */
export function calculateTeamStrengthDetailed(team, positionWeights = {}) {
    if (!Array.isArray(team) || team.length === 0) {
        return {
            weightedRating: 0,
            unweightedRating: 0,
            positionBreakdown: {}
        };
    }

    let weightedRating = 0;
    let unweightedRating = 0;
    const positionBreakdown = {};

    team.forEach(player => {
        const rating = getPlayerRating(player);
        const position = player.assignedPosition || player.positions?.[0];
        const weight = positionWeights[position] || 1.0;

        weightedRating += rating * weight;
        unweightedRating += rating;

        if (!positionBreakdown[position]) {
            positionBreakdown[position] = {
                count: 0,
                totalRating: 0,
                averageRating: 0,
                weight: weight
            };
        }

        positionBreakdown[position].count++;
        positionBreakdown[position].totalRating += rating;
    });

    // Calculate averages
    Object.keys(positionBreakdown).forEach(pos => {
        const data = positionBreakdown[pos];
        data.averageRating = data.totalRating / data.count;
    });

    return {
        weightedRating,
        unweightedRating,
        positionBreakdown
    };
}

/**
 * Calculate team balance metrics (for resolved teams)
 * @param {Array<Array<Object>>} teams - Array of resolved teams
 * @param {Object} positionWeights - Position weights from config
 * @returns {{teamStrengths: Array, average: number, standardDeviation: number, difference: number}}
 */
export function calculateTeamBalance(teams, positionWeights = {}) {
    if (!Array.isArray(teams) || teams.length === 0) {
        return {
            teamStrengths: [],
            average: 0,
            standardDeviation: 0,
            difference: 0,
            maxStrength: 0,
            minStrength: 0
        };
    }

    const teamStrengths = teams.map(team =>
        calculateSimpleTeamStrength(team, positionWeights)
    );

    const average = teamStrengths.reduce((sum, strength) => sum + strength, 0) / teamStrengths.length;

    const squaredDiffs = teamStrengths.map(strength => Math.pow(strength - average, 2));
    const variance = squaredDiffs.reduce((sum, diff) => sum + diff, 0) / teamStrengths.length;
    const standardDeviation = Math.sqrt(variance);

    const maxStrength = Math.max(...teamStrengths);
    const minStrength = Math.min(...teamStrengths);
    const difference = maxStrength - minStrength;

    return {
        teamStrengths,
        average,
        standardDeviation,
        difference,
        maxStrength,
        minStrength
    };
}

/**
 * Calculate position-level statistics (for resolved teams)
 * @param {Array<Array<Object>>} teams - Array of resolved teams
 * @param {Object} positionWeights - Position weights from config
 * @returns {Object} Position statistics by position code
 */
export function calculatePositionStatistics(teams, positionWeights = {}) {
    const positionStats = {};

    teams.forEach(team => {
        team.forEach(player => {
            const position = player.assignedPosition || player.positions?.[0];
            const rating = getPlayerRating(player);

            if (!positionStats[position]) {
                positionStats[position] = {
                    ratings: [],
                    teams: []
                };
            }

            positionStats[position].ratings.push(rating);
            positionStats[position].teams.push(team);
        });
    });

    // Calculate statistics for each position
    Object.keys(positionStats).forEach(position => {
        const stats = positionStats[position];
        const ratings = stats.ratings;

        stats.average = ratings.reduce((sum, r) => sum + r, 0) / ratings.length;
        stats.min = Math.min(...ratings);
        stats.max = Math.max(...ratings);
        stats.count = ratings.length;

        // Calculate variance
        const squaredDiffs = ratings.map(r => Math.pow(r - stats.average, 2));
        stats.variance = squaredDiffs.reduce((sum, diff) => sum + diff, 0) / ratings.length;
        stats.standardDeviation = Math.sqrt(stats.variance);
    });

    return positionStats;
}

/**
 * Evaluate solution quality (lower is better) - for resolved teams
 * @param {Array<Array<Object>>} teams - Array of resolved teams
 * @param {Object} positionWeights - Position weights from config
 * @param {Object} params - Evaluation parameters
 * @returns {number} Quality score (lower is better)
 */
export function evaluateSolution(teams, positionWeights = {}, params = {}) {
    const {
        varianceWeight = 0.5,
        fairnessWeight = 0.3,
        consistencyWeight = 0.2
    } = params;

    const balance = calculateTeamBalance(teams, positionWeights);

    // Variance component (lower is better)
    const varianceScore = balance.standardDeviation * varianceWeight;

    // Difference component (lower is better)
    const differenceScore = balance.difference;

    // Combined score
    const totalScore = varianceScore + differenceScore;

    return totalScore;
}

/**
 * Compare two solutions (for resolved teams)
 * @param {Array<Array<Object>>} solution1 - First solution
 * @param {Array<Array<Object>>} solution2 - Second solution
 * @param {Object} positionWeights - Position weights from config
 * @returns {number} Negative if solution1 is better, positive if solution2 is better
 */
export function compareSolutions(solution1, solution2, positionWeights = {}) {
    const score1 = evaluateSolution(solution1, positionWeights);
    const score2 = evaluateSolution(solution2, positionWeights);
    return score1 - score2;
}
