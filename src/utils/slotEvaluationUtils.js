/**
 * Slot-Based Evaluation Utilities
 *
 * Evaluation functions for the new slot-based team structure.
 * Works with PlayerPool to resolve player information.
 */

/**
 * Calculate simple team strength (slot-based)
 * @param {Array<{playerId, position}>} team - Slot-based team
 * @param {Object} playerPool - PlayerPool instance
 * @param {Object} positionWeights - Position weights
 * @returns {number} Team strength
 */
export function calculateSlotTeamStrength(team, playerPool, positionWeights) {
    let totalStrength = 0;

    team.forEach(slot => {
        const rating = playerPool.getPlayerRating(slot.playerId, slot.position);
        const weight = positionWeights[slot.position] || 1.0;
        totalStrength += rating * weight;
    });

    return totalStrength;
}

/**
 * Calculate detailed team strength with ratings breakdown
 * @param {Array<{playerId, position}>} team - Slot-based team
 * @param {Object} playerPool - PlayerPool instance
 * @param {Object} positionWeights - Position weights
 * @returns {{weightedRating: number, unweightedRating: number, positionBreakdown: Object}}
 */
export function calculateSlotTeamStrengthDetailed(team, playerPool, positionWeights) {
    let weightedRating = 0;
    let unweightedRating = 0;
    const positionBreakdown = {};

    team.forEach(slot => {
        const rating = playerPool.getPlayerRating(slot.playerId, slot.position);
        const weight = positionWeights[slot.position] || 1.0;

        weightedRating += rating * weight;
        unweightedRating += rating;

        if (!positionBreakdown[slot.position]) {
            positionBreakdown[slot.position] = {
                count: 0,
                totalRating: 0,
                averageRating: 0,
                weight: weight
            };
        }

        positionBreakdown[slot.position].count++;
        positionBreakdown[slot.position].totalRating += rating;
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
 * Calculate team balance metrics (slot-based)
 * @param {Array<Array<{playerId, position}>>} teams - Slot-based teams
 * @param {Object} playerPool - PlayerPool instance
 * @param {Object} positionWeights - Position weights
 * @returns {{teamStrengths: Array, average: number, standardDeviation: number, difference: number}}
 */
export function calculateSlotTeamBalance(teams, playerPool, positionWeights) {
    const teamStrengths = teams.map(team =>
        calculateSlotTeamStrength(team, playerPool, positionWeights)
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
 * Evaluate solution quality (lower is better) - slot-based
 * @param {Array<Array<{playerId, position}>>} teams - Slot-based teams
 * @param {Object} playerPool - PlayerPool instance
 * @param {Object} positionWeights - Position weights
 * @param {Object} params - Evaluation parameters
 * @returns {number} Quality score (lower is better)
 */
export function evaluateSlotSolution(teams, playerPool, positionWeights, params = {}) {
    const {
        varianceWeight = 0.5,
        fairnessWeight = 0.3,
        consistencyWeight = 0.2
    } = params;

    const balance = calculateSlotTeamBalance(teams, playerPool, positionWeights);

    // Variance component (lower is better)
    const varianceScore = balance.standardDeviation * varianceWeight;

    // Difference component (lower is better)
    const differenceScore = balance.difference;

    // Combined score
    const totalScore = varianceScore + differenceScore;

    return totalScore;
}

/**
 * Get player rating from slot
 * @param {{playerId, position}} slot - Team slot
 * @param {Object} playerPool - PlayerPool instance
 * @returns {number} Player rating
 */
export function getSlotPlayerRating(slot, playerPool) {
    return playerPool.getPlayerRating(slot.playerId, slot.position);
}

/**
 * Calculate position-level statistics (slot-based)
 * @param {Array<Array<{playerId, position}>>} teams - Slot-based teams
 * @param {Object} playerPool - PlayerPool instance
 * @param {Object} positionWeights - Position weights
 * @returns {Object} Position statistics by position code
 */
export function calculateSlotPositionStatistics(teams, playerPool, positionWeights) {
    const positionStats = {};

    teams.forEach(team => {
        team.forEach(slot => {
            const position = slot.position;
            const rating = playerPool.getPlayerRating(slot.playerId, position);

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
 * Compare two solutions (slot-based)
 * @param {Array<Array<{playerId, position}>>} solution1 - First solution
 * @param {Array<Array<{playerId, position}>>} solution2 - Second solution
 * @param {Object} playerPool - PlayerPool instance
 * @param {Object} positionWeights - Position weights
 * @returns {number} Negative if solution1 is better, positive if solution2 is better
 */
export function compareSlotSolutions(solution1, solution2, playerPool, positionWeights) {
    const score1 = evaluateSlotSolution(solution1, playerPool, positionWeights);
    const score2 = evaluateSlotSolution(solution2, playerPool, positionWeights);
    return score1 - score2;
}
