// src/services/optimizer/utils/solutionUtils.js

/**
 * Utility functions for working with team solutions
 */

/**
 * Deep clone teams array
 * @param {Array} teams - Array of teams to clone
 * @returns {Array} Cloned teams
 */
export function cloneTeams(teams) {
    return teams.map(team => team.map(player => ({ ...player })));
}

/**
 * Create a hash string representing the solution for tabu search
 * @param {Array} teams - Array of teams
 * @returns {string} Hash string
 */
export function hashSolution(teams) {
    return teams.map(team => 
        team.map(p => p.id).sort().join(',')
    ).sort().join('|');
}

/**
 * Get unused players from all available players
 * @param {Array} teams - Array of teams
 * @param {Array} allPlayers - All available players
 * @returns {Array} Unused players
 */
export function getUnusedPlayers(teams, allPlayers) {
    const usedIds = new Set(teams.flat().map(p => p.id));
    return allPlayers.filter(p => !usedIds.has(p.id));
}

/**
 * Sort players in a team by position order
 * @param {Array} team - Team to sort
 * @param {Array} positionOrder - Order of positions ['S', 'OPP', 'OH', 'MB', 'L']
 * @returns {Array} Sorted team
 */
export function sortTeamByPosition(team, positionOrder) {
    return team.sort((a, b) => {
        const posA = a.assignedPosition || a.positions?.[0];
        const posB = b.assignedPosition || b.positions?.[0];

        const indexA = positionOrder.indexOf(posA);
        const indexB = positionOrder.indexOf(posB);

        // If position not found, put at the end
        const orderA = indexA === -1 ? 999 : indexA;
        const orderB = indexB === -1 ? 999 : indexB;

        return orderA - orderB;
    });
}

/**
 * Validate that a team has the correct composition of positions
 * @param {Array} team - Team to validate
 * @param {Object} composition - Required composition (e.g., { S: 1, OPP: 1, OH: 2, MB: 2, L: 1 })
 * @returns {Object} Validation result { isValid: boolean, errors: Array, positionCounts: Object }
 */
export function validateTeamComposition(team, composition) {
    const errors = [];
    const positionCounts = {};

    // Count players at each position
    team.forEach(player => {
        const pos = player.assignedPosition;
        if (pos) {
            positionCounts[pos] = (positionCounts[pos] || 0) + 1;
        } else {
            errors.push(`Player ${player.id} has no assigned position`);
        }
    });

    // Check if counts match composition
    Object.keys(composition).forEach(position => {
        const required = composition[position];
        const actual = positionCounts[position] || 0;

        if (actual !== required) {
            errors.push(
                `Position ${position}: expected ${required}, got ${actual}`
            );
        }
    });

    // Check for positions not in composition
    Object.keys(positionCounts).forEach(position => {
        if (!(position in composition)) {
            errors.push(
                `Position ${position} is not in composition (has ${positionCounts[position]} players)`
            );
        }
    });

    return {
        isValid: errors.length === 0,
        errors,
        positionCounts
    };
}

/**
 * Validate that all teams have the correct composition
 * @param {Array} teams - Array of teams to validate
 * @param {Object} composition - Required composition
 * @returns {Object} Validation result { isValid: boolean, errors: Array, teamValidations: Array }
 */
export function validateAllTeamsComposition(teams, composition) {
    const teamValidations = teams.map((team, idx) => ({
        teamIndex: idx,
        ...validateTeamComposition(team, composition)
    }));

    const allErrors = teamValidations.flatMap((v, idx) =>
        v.errors.map(err => `Team ${idx}: ${err}`)
    );

    return {
        isValid: allErrors.length === 0,
        errors: allErrors,
        teamValidations
    };
}

/**
 * Validate that a player can play at their assigned position
 * @param {Object} player - Player to validate
 * @returns {boolean} True if player can play at assigned position
 */
export function validatePlayerPosition(player) {
    if (!player.assignedPosition) {
        return false;
    }

    // Check if player's available positions include assigned position
    if (player.positions && Array.isArray(player.positions)) {
        return player.positions.includes(player.assignedPosition);
    }

    // If no positions array, assume player can play at assigned position
    return true;
}
