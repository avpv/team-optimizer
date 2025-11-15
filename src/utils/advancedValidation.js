/**
 * Advanced validation utilities for team optimization
 * Provides comprehensive validation beyond basic composition checks
 */

import { validateTeamComposition, validateAllTeamsComposition, validatePlayerPosition } from './solutionUtils.js';
import { getPlayerRating, calculateTeamStrength } from './evaluationUtils.js';

/**
 * Validate that no player appears in multiple teams
 * @param {Array} teams - Array of teams
 * @returns {Object} Validation result
 */
export function validateNoDuplicatePlayers(teams) {
    const errors = [];
    const playerIds = new Set();
    const duplicates = new Set();

    teams.forEach((team, teamIdx) => {
        team.forEach(player => {
            if (playerIds.has(player.id)) {
                duplicates.add(player.id);
                errors.push(`Player ${player.id} appears in multiple teams (found in team ${teamIdx})`);
            }
            playerIds.add(player.id);
        });
    });

    return {
        isValid: errors.length === 0,
        errors,
        duplicatePlayerIds: Array.from(duplicates)
    };
}

/**
 * Validate that teams are reasonably balanced
 * @param {Array} teams - Array of teams
 * @param {Object} positionWeights - Position weights
 * @param {number} maxBalanceDifference - Maximum acceptable balance difference (default: 200)
 * @returns {Object} Validation result
 */
export function validateTeamBalance(teams, positionWeights = {}, maxBalanceDifference = 200) {
    const errors = [];
    const warnings = [];

    if (teams.length < 2) {
        return {
            isValid: true,
            errors: [],
            warnings: ['Cannot validate balance with less than 2 teams']
        };
    }

    const teamStrengths = teams.map((team, idx) => {
        const stats = calculateTeamStrength(team, positionWeights, true);
        return {
            teamIdx: idx,
            strength: stats.averageWeightedRating
        };
    });

    const maxStrength = Math.max(...teamStrengths.map(t => t.strength));
    const minStrength = Math.min(...teamStrengths.map(t => t.strength));
    const balanceDifference = maxStrength - minStrength;

    if (balanceDifference > maxBalanceDifference) {
        errors.push(
            `Teams are poorly balanced: difference = ${balanceDifference.toFixed(1)} ` +
            `(max: ${maxStrength.toFixed(1)}, min: ${minStrength.toFixed(1)})`
        );
    } else if (balanceDifference > maxBalanceDifference * 0.7) {
        warnings.push(
            `Teams have moderate imbalance: difference = ${balanceDifference.toFixed(1)} ` +
            `(max: ${maxStrength.toFixed(1)}, min: ${minStrength.toFixed(1)})`
        );
    }

    return {
        isValid: errors.length === 0,
        errors,
        warnings,
        balanceDifference,
        maxStrength,
        minStrength,
        teamStrengths
    };
}

/**
 * Validate position distribution across teams
 * @param {Array} teams - Array of teams
 * @param {Object} composition - Position composition
 * @param {Object} positionWeights - Position weights
 * @returns {Object} Validation result
 */
export function validatePositionDistribution(teams, composition, positionWeights = {}) {
    const errors = [];
    const warnings = [];
    const positions = Object.keys(composition);

    positions.forEach(position => {
        const requiredCount = composition[position];
        if (requiredCount === 0) return;

        // Get average strength at this position for each team
        const teamStrengthsAtPos = teams.map((team, idx) => {
            const playersAtPos = team.filter(p => p.assignedPosition === position);
            const totalRating = playersAtPos.reduce((sum, p) => {
                return sum + getPlayerRating(p, position);
            }, 0);
            const avgRating = playersAtPos.length > 0 ? totalRating / playersAtPos.length : 0;
            return { teamIdx: idx, avgRating, count: playersAtPos.length };
        });

        // Check for significant imbalance at this position
        const avgRatings = teamStrengthsAtPos.map(t => t.avgRating);
        const maxRating = Math.max(...avgRatings);
        const minRating = Math.min(...avgRatings);
        const difference = maxRating - minRating;

        // Threshold based on position weight (more important positions have stricter requirements)
        const weight = positionWeights[position] || 1.0;
        const threshold = 200 / weight; // Higher weight = lower threshold = stricter

        if (difference > threshold) {
            warnings.push(
                `Position ${position} is unevenly distributed: ` +
                `difference = ${difference.toFixed(1)} (max: ${maxRating.toFixed(1)}, min: ${minRating.toFixed(1)})`
            );
        }

        // Check for missing positions
        teamStrengthsAtPos.forEach(t => {
            if (t.count !== requiredCount) {
                errors.push(
                    `Team ${t.teamIdx} has ${t.count} players at position ${position}, expected ${requiredCount}`
                );
            }
        });
    });

    return {
        isValid: errors.length === 0,
        errors,
        warnings
    };
}

/**
 * Validate that all players can play at their assigned positions
 * @param {Array} teams - Array of teams
 * @returns {Object} Validation result
 */
export function validatePlayerPositionAssignments(teams) {
    const errors = [];
    const warnings = [];

    teams.forEach((team, teamIdx) => {
        team.forEach((player, playerIdx) => {
            if (!player.assignedPosition) {
                errors.push(
                    `Team ${teamIdx}, Player ${playerIdx} (${player.id}): no assigned position`
                );
                return;
            }

            if (!validatePlayerPosition(player)) {
                errors.push(
                    `Team ${teamIdx}, Player ${playerIdx} (${player.id}): ` +
                    `assigned position "${player.assignedPosition}" is not in player's available positions ` +
                    `[${player.positions?.join(', ') || 'none'}]`
                );
            }

            // Check for missing ratings
            if (player.ratings) {
                if (!player.ratings[player.assignedPosition]) {
                    warnings.push(
                        `Team ${teamIdx}, Player ${playerIdx} (${player.id}): ` +
                        `no rating for assigned position "${player.assignedPosition}"`
                    );
                }
            } else if (player.positionRating === undefined || player.positionRating === null) {
                warnings.push(
                    `Team ${teamIdx}, Player ${playerIdx} (${player.id}): no rating information`
                );
            }
        });
    });

    return {
        isValid: errors.length === 0,
        errors,
        warnings
    };
}

/**
 * Validate fairness of player distribution
 * @param {Array} teams - Array of teams
 * @param {Object} positionWeights - Position weights
 * @param {number} topPlayerPercent - Percentage of top players (default: 0.2)
 * @returns {Object} Validation result
 */
export function validateFairness(teams, positionWeights = {}, topPlayerPercent = 0.2) {
    const errors = [];
    const warnings = [];

    const allPlayers = teams.flat();
    if (allPlayers.length === 0) {
        return { isValid: true, errors: [], warnings: [] };
    }

    // Get weighted ratings for all players
    const playerRatings = allPlayers.map(player => {
        const position = player.assignedPosition || player.positions?.[0];
        const rating = getPlayerRating(player, position);
        const weight = positionWeights[position] || 1.0;
        return {
            player,
            weightedRating: rating * weight
        };
    });

    playerRatings.sort((a, b) => b.weightedRating - a.weightedRating);

    const topPlayerCount = Math.max(1, Math.ceil(allPlayers.length * topPlayerPercent));
    const topPlayers = playerRatings.slice(0, topPlayerCount);
    const topPlayerIds = new Set(topPlayers.map(tp => tp.player.id));

    // Count top players per team
    const topPlayersPerTeam = teams.map(team => {
        return team.filter(p => topPlayerIds.has(p.id)).length;
    });

    const maxTopPlayers = Math.max(...topPlayersPerTeam);
    const minTopPlayers = Math.min(...topPlayersPerTeam);
    const difference = maxTopPlayers - minTopPlayers;

    // Ideal distribution
    const idealCount = topPlayerCount / teams.length;

    if (difference >= 3) {
        errors.push(
            `Unfair distribution of top players: ` +
            `max = ${maxTopPlayers}, min = ${minTopPlayers}, difference = ${difference} ` +
            `(ideal: ${idealCount.toFixed(1)} per team)`
        );
    } else if (difference >= 2) {
        warnings.push(
            `Moderate imbalance in top player distribution: ` +
            `max = ${maxTopPlayers}, min = ${minTopPlayers}, difference = ${difference} ` +
            `(ideal: ${idealCount.toFixed(1)} per team)`
        );
    }

    return {
        isValid: errors.length === 0,
        errors,
        warnings,
        topPlayersPerTeam,
        maxTopPlayers,
        minTopPlayers,
        idealCount
    };
}

/**
 * Comprehensive validation of solution
 * @param {Array} teams - Array of teams
 * @param {Object} composition - Position composition
 * @param {Object} positionWeights - Position weights
 * @param {Object} options - Validation options
 * @returns {Object} Comprehensive validation result
 */
export function validateSolutionComprehensive(teams, composition, positionWeights = {}, options = {}) {
    const {
        maxBalanceDifference = 200,
        topPlayerPercent = 0.2,
        strictMode = false
    } = options;

    const validations = {
        composition: validateAllTeamsComposition(teams, composition),
        duplicates: validateNoDuplicatePlayers(teams),
        balance: validateTeamBalance(teams, positionWeights, maxBalanceDifference),
        positionDistribution: validatePositionDistribution(teams, composition, positionWeights),
        playerAssignments: validatePlayerPositionAssignments(teams),
        fairness: validateFairness(teams, positionWeights, topPlayerPercent)
    };

    // Collect all errors and warnings
    const allErrors = [];
    const allWarnings = [];

    Object.entries(validations).forEach(([key, validation]) => {
        if (validation.errors && validation.errors.length > 0) {
            allErrors.push(...validation.errors.map(err => `[${key}] ${err}`));
        }
        if (validation.warnings && validation.warnings.length > 0) {
            allWarnings.push(...validation.warnings.map(warn => `[${key}] ${warn}`));
        }
    });

    // In strict mode, warnings become errors
    if (strictMode && allWarnings.length > 0) {
        allErrors.push(...allWarnings);
    }

    return {
        isValid: allErrors.length === 0,
        errors: allErrors,
        warnings: strictMode ? [] : allWarnings,
        validations,
        summary: {
            totalErrors: allErrors.length,
            totalWarnings: strictMode ? 0 : allWarnings.length,
            strictMode
        }
    };
}

/**
 * Quick validation for use during optimization
 * Only checks critical issues for performance
 * @param {Array} teams - Array of teams
 * @param {Object} composition - Position composition
 * @returns {boolean} True if valid
 */
export function quickValidate(teams, composition) {
    // Check composition
    const compositionValid = validateAllTeamsComposition(teams, composition);
    if (!compositionValid.isValid) {
        return false;
    }

    // Check duplicates
    const duplicatesValid = validateNoDuplicatePlayers(teams);
    if (!duplicatesValid.isValid) {
        return false;
    }

    return true;
}

/**
 * Validate and auto-fix minor issues if possible
 * @param {Array} teams - Array of teams (will be modified)
 * @param {Object} composition - Position composition
 * @param {Object} positionWeights - Position weights
 * @returns {Object} Validation result with fix information
 */
export function validateAndAutoFix(teams, composition, positionWeights = {}) {
    const fixes = [];
    const unfixableErrors = [];

    // Check for duplicate players
    const duplicatesValidation = validateNoDuplicatePlayers(teams);
    if (!duplicatesValidation.isValid) {
        unfixableErrors.push(...duplicatesValidation.errors);
        // Cannot auto-fix duplicates safely
    }

    // Check composition
    const compositionValidation = validateAllTeamsComposition(teams, composition);
    if (!compositionValidation.isValid) {
        unfixableErrors.push(...compositionValidation.errors);
        // Cannot auto-fix composition issues safely
    }

    // Run full validation
    const fullValidation = validateSolutionComprehensive(teams, composition, positionWeights);

    return {
        isValid: unfixableErrors.length === 0,
        errors: unfixableErrors,
        warnings: fullValidation.warnings,
        fixes,
        validation: fullValidation
    };
}
