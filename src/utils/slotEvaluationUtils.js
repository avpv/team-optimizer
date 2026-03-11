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
 * Evaluate solution quality (lower is better) - slot-based, FULL metrics.
 *
 * Optimizes 6 components (merged from the original 7):
 * 1. Base balance: stdDev + maxDiff (overall team strength variance)
 * 2. Position consistency: per-position rating variance between teams
 * 3. Fairness: top-player distribution across teams
 * 4. Role balance: importance-weighted (weight²) strength variance
 * 5. Depth: backup player quality (subtracted — higher is better)
 *
 * @param {Array<Array<{playerId, position}>>} teams - Slot-based teams
 * @param {Object} playerPool - PlayerPool instance
 * @param {Object} positionWeights - Position weights
 * @param {Object} composition - Position composition (e.g. {S:1, OH:2, MB:2, L:1})
 * @param {Object} params - Evaluation parameters (weights)
 * @returns {number} Quality score (lower is better)
 */
export function evaluateSlotSolution(teams, playerPool, positionWeights, composition = null, params = {}) {
    const {
        varianceWeight = 0.5,
        positionConsistencyWeight = 0.4,
        fairnessWeight = 0.3,
        roleBalanceWeight = 0.15,
        depthWeight = 0.05,
        topPlayerPercent = 0.2
    } = params;

    // 1. Base balance (~60 ops)
    const balance = calculateSlotTeamBalance(teams, playerPool, positionWeights);
    let score = balance.difference + balance.standardDeviation * varianceWeight;

    // 2. Position consistency (~140 ops)
    if (positionConsistencyWeight > 0 && composition) {
        score += calculateSlotPositionConsistency(teams, playerPool, composition, positionWeights)
                 * positionConsistencyWeight;
    }

    // 3. Fairness (~200 ops)
    if (fairnessWeight > 0) {
        score += calculateSlotFairness(teams, playerPool, positionWeights, topPlayerPercent)
                 * fairnessWeight;
    }

    // 4. Role balance (~30 ops)
    if (roleBalanceWeight > 0) {
        score += calculateSlotRoleBalance(teams, playerPool, positionWeights)
                 * roleBalanceWeight;
    }

    // 5. Depth (~200 ops, only for positions with 2+ players)
    if (depthWeight > 0 && composition) {
        score -= calculateSlotDepth(teams, playerPool, composition, positionWeights)
                 * depthWeight;
    }

    return score;
}

/**
 * Per-position rating variance between teams (lower is better).
 * Ensures each position is balanced, not just total team strength.
 */
function calculateSlotPositionConsistency(teams, playerPool, composition, positionWeights) {
    let totalWeightedVariance = 0;
    let totalWeight = 0;

    for (const [position, count] of Object.entries(composition)) {
        if (!count) continue;
        const weight = positionWeights[position] || 1.0;

        const teamAvgs = teams.map(team => {
            const slots = team.filter(s => s.position === position);
            if (slots.length === 0) return 0;
            const sum = slots.reduce((s, slot) =>
                s + playerPool.getPlayerRating(slot.playerId, position), 0);
            return sum / slots.length;
        });

        const avg = teamAvgs.reduce((a, b) => a + b, 0) / teams.length;
        const variance = teamAvgs.reduce((s, v) => s + (v - avg) ** 2, 0) / teams.length;
        totalWeightedVariance += variance * weight;
        totalWeight += weight;
    }

    return totalWeight > 0 ? Math.sqrt(totalWeightedVariance / totalWeight) : 0;
}

/**
 * Top-player distribution fairness (lower is better).
 * Measures variance in top-player count across teams from ideal equal distribution.
 */
function calculateSlotFairness(teams, playerPool, positionWeights, topPercent) {
    const allRatings = [];
    teams.forEach((team, teamIdx) => team.forEach(slot => {
        const rating = playerPool.getPlayerRating(slot.playerId, slot.position);
        const weight = positionWeights[slot.position] || 1.0;
        allRatings.push({ teamIdx, weightedRating: rating * weight });
    }));

    if (allRatings.length === 0) return 0;

    allRatings.sort((a, b) => b.weightedRating - a.weightedRating);
    const topCount = Math.max(1, Math.ceil(allRatings.length * topPercent));

    const topPerTeam = new Array(teams.length).fill(0);
    allRatings.slice(0, topCount).forEach(r => topPerTeam[r.teamIdx]++);

    const ideal = topCount / teams.length;
    const variance = topPerTeam.reduce((s, c) => s + (c - ideal) ** 2, 0) / teams.length;
    return Math.sqrt(variance) * 100;
}

/**
 * Importance-weighted (weight²) strength variance (lower is better).
 * Higher-weight positions contribute quadratically more to imbalance detection.
 */
function calculateSlotRoleBalance(teams, playerPool, positionWeights) {
    const teamScores = teams.map(team => {
        const roleScore = team.reduce((sum, slot) => {
            const rating = playerPool.getPlayerRating(slot.playerId, slot.position);
            const weight = positionWeights[slot.position] || 1.0;
            return sum + rating * weight * weight;
        }, 0);
        return roleScore / (team.length || 1);
    });

    const avg = teamScores.reduce((a, b) => a + b, 0) / teams.length;
    const variance = teamScores.reduce((s, v) => s + (v - avg) ** 2, 0) / teams.length;
    return Math.sqrt(variance);
}

/**
 * Backup player quality (higher is better — returned as positive, subtracted by caller).
 * For positions with 2+ players, measures average quality of non-best players.
 */
function calculateSlotDepth(teams, playerPool, composition, positionWeights) {
    const teamDepths = teams.map(team => {
        let depthSum = 0;
        let posCount = 0;

        for (const [position, count] of Object.entries(composition)) {
            if (!count || count <= 1) continue;

            const slots = team.filter(s => s.position === position);
            if (slots.length <= 1) continue;

            const ratings = slots.map(s =>
                playerPool.getPlayerRating(s.playerId, position)
            ).sort((a, b) => b - a);

            const depthRatings = ratings.slice(1);
            const avgDepth = depthRatings.reduce((a, b) => a + b, 0) / depthRatings.length;
            const weight = positionWeights[position] || 1.0;
            depthSum += avgDepth * weight;
            posCount++;
        }

        return posCount > 0 ? depthSum / posCount : 0;
    });

    const avg = teamDepths.reduce((a, b) => a + b, 0) / teams.length;
    return avg;
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
 * @param {Object} composition - Position composition (optional)
 * @returns {number} Negative if solution1 is better, positive if solution2 is better
 */
export function compareSlotSolutions(solution1, solution2, playerPool, positionWeights, composition = null) {
    const score1 = evaluateSlotSolution(solution1, playerPool, positionWeights, composition);
    const score2 = evaluateSlotSolution(solution2, playerPool, positionWeights, composition);
    return score1 - score2;
}
