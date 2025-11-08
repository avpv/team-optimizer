/**
 * Evaluation utilities for team strength calculation
 * Provides shared functions for calculating team and player ratings
 */

const DEFAULT_RATING = 1500;

/**
 * Get player rating for a specific position
 * Handles both player.ratings[position] and player.positionRating formats
 * @param {Object} player - Player object
 * @param {string} position - Position to get rating for
 * @returns {number} Player rating for the position
 */
export function getPlayerRating(player, position) {
    // Try player.ratings[position] first (detailed format)
    if (player.ratings && typeof player.ratings === 'object' && position) {
        const rating = player.ratings[position];
        if (rating !== undefined && rating !== null) {
            return rating;
        }
    }

    // Fall back to player.positionRating (simplified format)
    if (player.positionRating !== undefined && player.positionRating !== null) {
        return player.positionRating;
    }

    // Default rating if nothing found
    return DEFAULT_RATING;
}

/**
 * Calculate team strength based on player ratings with optional position weights
 * @param {Array} players - Team players
 * @param {Object} positionWeights - Position weights from activity config (optional)
 * @param {boolean} usePositionWeights - Whether to apply position weights (default: true)
 * @returns {Object} Team strength statistics
 */
export function calculateTeamStrength(players, positionWeights = {}, usePositionWeights = true) {
    if (!players || !Array.isArray(players) || players.length === 0) {
        return {
            totalRating: 0,
            weightedRating: 0,
            averageRating: 0,
            playerCount: 0
        };
    }

    let totalRating = 0;
    let weightedRating = 0;
    let totalWeight = 0;

    players.forEach(player => {
        const position = player.assignedPosition || player.positions?.[0];
        const rating = getPlayerRating(player, position);

        totalRating += rating;

        // Apply position weight if enabled
        if (usePositionWeights && position) {
            const weight = positionWeights[position] || 1.0;
            weightedRating += rating * weight;
            totalWeight += weight;
        } else {
            weightedRating += rating;
            totalWeight += 1;
        }
    });

    return {
        totalRating: Math.round(totalRating),
        weightedRating: Math.round(weightedRating),
        averageRating: Math.round(totalRating / players.length),
        averageWeightedRating: totalWeight > 0 ? Math.round(weightedRating / totalWeight) : 0,
        playerCount: players.length
    };
}

/**
 * Calculate simple weighted average team strength (for backward compatibility)
 * Returns a single number instead of detailed statistics
 * @param {Array} players - Team players
 * @param {Object} positionWeights - Position weights from activity config
 * @returns {number} Average weighted team strength
 */
export function calculateSimpleTeamStrength(players, positionWeights = {}) {
    const stats = calculateTeamStrength(players, positionWeights, true);
    return stats.averageWeightedRating;
}

/**
 * Calculate balance metrics for multiple teams
 * @param {Array} teams - Array of teams
 * @param {Object} positionWeights - Position weights from activity config
 * @returns {Object} Balance metrics
 */
export function calculateTeamBalance(teams, positionWeights = {}) {
    if (!teams || !Array.isArray(teams) || teams.length === 0) {
        return {
            difference: 0,
            variance: 0,
            standardDeviation: 0,
            average: 0,
            min: 0,
            max: 0,
            teamStrengths: []
        };
    }

    const teamStrengths = teams.map(team => {
        const stats = calculateTeamStrength(team, positionWeights, true);
        return stats.averageWeightedRating;
    });

    const maxStrength = Math.max(...teamStrengths);
    const minStrength = Math.min(...teamStrengths);
    const avgStrength = teamStrengths.reduce((a, b) => a + b, 0) / teamStrengths.length;
    const variance = teamStrengths.reduce((sum, s) => sum + Math.pow(s - avgStrength, 2), 0) / teamStrengths.length;
    const stdDev = Math.sqrt(variance);

    return {
        difference: maxStrength - minStrength,
        variance,
        standardDeviation: stdDev,
        average: avgStrength,
        min: minStrength,
        max: maxStrength,
        teamStrengths
    };
}
