/**
 * Advanced Metrics for Team Optimization
 * Provides fairness, consistency, and other advanced evaluation metrics
 */

import { getPlayerRating, calculateTeamStrength } from './evaluationUtils.js';

/**
 * Calculate fairness metric - measures how evenly top players are distributed
 * Lower is better (0 = perfect distribution)
 * @param {Array} teams - Array of teams
 * @param {Object} positionWeights - Position weights for rating calculation
 * @param {number} topPlayerPercent - Percentage of top players to consider (default: 0.2 = top 20%)
 * @returns {Object} Fairness metrics
 */
export function calculateFairnessMetric(teams, positionWeights = {}, topPlayerPercent = 0.2) {
    // Collect all players from all teams
    const allPlayers = teams.flat();

    if (allPlayers.length === 0) {
        return {
            fairnessScore: 0,
            topPlayerCount: 0,
            distributionVariance: 0,
            details: {}
        };
    }

    // Get weighted ratings for all players
    const playerRatings = allPlayers.map(player => {
        const position = player.assignedPosition || player.positions?.[0];
        const rating = getPlayerRating(player, position);
        const weight = positionWeights[position] || 1.0;
        return {
            player,
            rating,
            weightedRating: rating * weight
        };
    });

    // Sort by weighted rating (highest first)
    playerRatings.sort((a, b) => b.weightedRating - a.weightedRating);

    // Determine how many top players to consider
    const topPlayerCount = Math.max(1, Math.ceil(allPlayers.length * topPlayerPercent));
    const topPlayers = playerRatings.slice(0, topPlayerCount);

    // Count top players per team
    const topPlayersPerTeam = teams.map((team, teamIdx) => {
        const topPlayerIds = new Set(topPlayers.map(tp => tp.player.id));
        const count = team.filter(p => topPlayerIds.has(p.id)).length;
        return { teamIdx, count };
    });

    // Calculate ideal distribution (equal distribution)
    const idealCountPerTeam = topPlayerCount / teams.length;

    // Calculate variance from ideal distribution
    const distributionVariance = topPlayersPerTeam.reduce((sum, item) => {
        return sum + Math.pow(item.count - idealCountPerTeam, 2);
    }, 0) / teams.length;

    // Calculate fairness score (lower is better)
    // Perfect distribution = 0, highly uneven = high value
    const fairnessScore = Math.sqrt(distributionVariance) * 100;

    return {
        fairnessScore,
        topPlayerCount,
        distributionVariance,
        idealCountPerTeam,
        topPlayersPerTeam: topPlayersPerTeam.map(t => t.count),
        details: {
            topPlayerThreshold: topPlayers[topPlayers.length - 1].weightedRating,
            maxTopPlayers: Math.max(...topPlayersPerTeam.map(t => t.count)),
            minTopPlayers: Math.min(...topPlayersPerTeam.map(t => t.count))
        }
    };
}

/**
 * Calculate consistency metric - measures stability of position-level balance within teams
 * Lower is better (0 = perfect consistency)
 * @param {Array} teams - Array of teams
 * @param {Object} composition - Position composition (e.g., { S: 1, OPP: 1, OH: 2, MB: 2, L: 1 })
 * @param {Object} positionWeights - Position weights for rating calculation
 * @returns {Object} Consistency metrics
 */
export function calculateConsistencyMetric(teams, composition, positionWeights = {}) {
    if (!teams || teams.length === 0) {
        return {
            consistencyScore: 0,
            positionVariances: {},
            overallVariance: 0,
            details: {}
        };
    }

    const positions = Object.keys(composition);
    const positionVariances = {};
    const positionDetails = {};

    // For each position, calculate how consistent the strength is across teams
    positions.forEach(position => {
        const requiredCount = composition[position];
        if (requiredCount === 0) return;

        // Get average strength at this position for each team
        const positionStrengthsByTeam = teams.map(team => {
            const playersAtPos = team.filter(p => p.assignedPosition === position);

            if (playersAtPos.length === 0) return 0;

            const totalRating = playersAtPos.reduce((sum, player) => {
                return sum + getPlayerRating(player, position);
            }, 0);

            // Average rating for this position in this team
            return totalRating / playersAtPos.length;
        });

        // Calculate variance of position strength across teams
        const avgStrength = positionStrengthsByTeam.reduce((a, b) => a + b, 0) / teams.length;
        const variance = positionStrengthsByTeam.reduce((sum, strength) => {
            return sum + Math.pow(strength - avgStrength, 2);
        }, 0) / teams.length;

        const weight = positionWeights[position] || 1.0;

        positionVariances[position] = variance;
        positionDetails[position] = {
            variance,
            stdDev: Math.sqrt(variance),
            avgStrength,
            minStrength: Math.min(...positionStrengthsByTeam),
            maxStrength: Math.max(...positionStrengthsByTeam),
            range: Math.max(...positionStrengthsByTeam) - Math.min(...positionStrengthsByTeam),
            weight
        };
    });

    // Calculate weighted overall variance
    const totalWeight = positions.reduce((sum, pos) => {
        return sum + (positionWeights[pos] || 1.0);
    }, 0);

    const weightedVariance = positions.reduce((sum, pos) => {
        const variance = positionVariances[pos] || 0;
        const weight = positionWeights[pos] || 1.0;
        return sum + (variance * weight);
    }, 0) / totalWeight;

    // Consistency score (lower is better)
    const consistencyScore = Math.sqrt(weightedVariance);

    return {
        consistencyScore,
        positionVariances,
        overallVariance: weightedVariance,
        details: positionDetails
    };
}

/**
 * Calculate depth metric - measures team depth (how strong are backup players)
 * Higher is better
 * @param {Array} teams - Array of teams
 * @param {Object} composition - Position composition
 * @param {Object} positionWeights - Position weights
 * @returns {Object} Depth metrics
 */
export function calculateDepthMetric(teams, composition, positionWeights = {}) {
    if (!teams || teams.length === 0) {
        return {
            depthScore: 0,
            teamDepths: [],
            averageDepth: 0
        };
    }

    const teamDepths = teams.map(team => {
        const positions = Object.keys(composition);
        let depthSum = 0;
        let positionCount = 0;

        positions.forEach(position => {
            const playersAtPos = team
                .filter(p => p.assignedPosition === position)
                .map(p => getPlayerRating(p, position))
                .sort((a, b) => b - a); // Sort descending

            if (playersAtPos.length <= 1) return;

            // Calculate average of all players except the top one (depth players)
            const depthPlayers = playersAtPos.slice(1);
            const avgDepth = depthPlayers.reduce((a, b) => a + b, 0) / depthPlayers.length;
            const weight = positionWeights[position] || 1.0;

            depthSum += avgDepth * weight;
            positionCount++;
        });

        return positionCount > 0 ? depthSum / positionCount : 0;
    });

    // Calculate variance of depth across teams (lower variance = more fair)
    const avgDepth = teamDepths.reduce((a, b) => a + b, 0) / teams.length;
    const depthVariance = teamDepths.reduce((sum, depth) => {
        return sum + Math.pow(depth - avgDepth, 2);
    }, 0) / teams.length;

    // Depth score: penalize variance (we want similar depth across teams)
    const depthScore = avgDepth - Math.sqrt(depthVariance) * 10;

    return {
        depthScore,
        teamDepths,
        averageDepth: avgDepth,
        depthVariance,
        minDepth: Math.min(...teamDepths),
        maxDepth: Math.max(...teamDepths)
    };
}

/**
 * Calculate role balance metric - ensures teams have similar role distributions
 * (e.g., mix of offensive/defensive specialists)
 * @param {Array} teams - Array of teams
 * @param {Object} positionWeights - Position weights (higher weight = more important role)
 * @returns {Object} Role balance metrics
 */
export function calculateRoleBalanceMetric(teams, positionWeights = {}) {
    if (!teams || teams.length === 0) {
        return {
            roleBalanceScore: 0,
            teamRoleScores: []
        };
    }

    // Calculate "importance score" for each team based on position weights
    const teamRoleScores = teams.map(team => {
        const roleScore = team.reduce((sum, player) => {
            const position = player.assignedPosition || player.positions?.[0];
            const weight = positionWeights[position] || 1.0;
            const rating = getPlayerRating(player, position);

            // Higher weight positions contribute more to role score
            return sum + (rating * weight * weight); // Square weight for emphasis
        }, 0);

        return roleScore / team.length; // Normalize by team size
    });

    // Calculate variance (we want similar role scores)
    const avgRoleScore = teamRoleScores.reduce((a, b) => a + b, 0) / teams.length;
    const roleVariance = teamRoleScores.reduce((sum, score) => {
        return sum + Math.pow(score - avgRoleScore, 2);
    }, 0) / teams.length;

    // Role balance score (lower is better)
    const roleBalanceScore = Math.sqrt(roleVariance);

    return {
        roleBalanceScore,
        teamRoleScores,
        averageRoleScore: avgRoleScore,
        roleVariance,
        minRoleScore: Math.min(...teamRoleScores),
        maxRoleScore: Math.max(...teamRoleScores)
    };
}

/**
 * Calculate comprehensive advanced metrics
 * @param {Array} teams - Array of teams
 * @param {Object} composition - Position composition
 * @param {Object} positionWeights - Position weights
 * @param {Object} options - Options for metric calculation
 * @returns {Object} All advanced metrics
 */
export function calculateAdvancedMetrics(teams, composition, positionWeights = {}, options = {}) {
    const {
        topPlayerPercent = 0.2,
        includeFairness = true,
        includeConsistency = true,
        includeDepth = true,
        includeRoleBalance = true
    } = options;

    const metrics = {};

    if (includeFairness) {
        metrics.fairness = calculateFairnessMetric(teams, positionWeights, topPlayerPercent);
    }

    if (includeConsistency) {
        metrics.consistency = calculateConsistencyMetric(teams, composition, positionWeights);
    }

    if (includeDepth) {
        metrics.depth = calculateDepthMetric(teams, composition, positionWeights);
    }

    if (includeRoleBalance) {
        metrics.roleBalance = calculateRoleBalanceMetric(teams, positionWeights);
    }

    return metrics;
}

/**
 * Calculate weighted combined score from advanced metrics
 * @param {Object} metrics - Advanced metrics object
 * @param {Object} weights - Weights for each metric
 * @returns {number} Combined score (lower is better for minimization metrics)
 */
export function calculateCombinedAdvancedScore(metrics, weights = {}) {
    const {
        fairnessWeight = 1.0,
        consistencyWeight = 1.0,
        depthWeight = 0.5,
        roleBalanceWeight = 0.5
    } = weights;

    let score = 0;

    if (metrics.fairness) {
        score += metrics.fairness.fairnessScore * fairnessWeight;
    }

    if (metrics.consistency) {
        score += metrics.consistency.consistencyScore * consistencyWeight;
    }

    if (metrics.depth) {
        // Depth is "higher is better", so we negate it
        score -= metrics.depth.depthScore * depthWeight;
    }

    if (metrics.roleBalance) {
        score += metrics.roleBalance.roleBalanceScore * roleBalanceWeight;
    }

    return score;
}
