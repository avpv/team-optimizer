/**
 * Team Slot Utilities
 *
 * Utilities for working with the new team structure based on player references
 * instead of object copies.
 *
 * New Team Structure: Array<{playerId: number, position: string}>
 * Old Team Structure: Array<{id, name, positions, ratings, assignedPosition, ...}>
 */

/**
 * Clone teams (slot-based structure)
 * Much faster than deep cloning player objects
 * @param {Array<Array<{playerId, position}>>} teams - Slot-based teams
 * @returns {Array<Array<{playerId, position}>>} Cloned teams
 */
export function cloneSlotTeams(teams) {
    return teams.map(team =>
        team.map(slot => ({ playerId: slot.playerId, position: slot.position }))
    );
}

/**
 * Validate no duplicate player IDs in teams (slot-based)
 * O(n) complexity - much faster than old approach
 * @param {Array<Array<{playerId, position}>>} teams - Slot-based teams
 * @returns {boolean} True if duplicates found
 */
export function hasDuplicatePlayerIds(teams) {
    const seenIds = new Set();

    for (const team of teams) {
        for (const slot of team) {
            if (seenIds.has(slot.playerId)) {
                return true; // Duplicate found
            }
            seenIds.add(slot.playerId);
        }
    }

    return false; // No duplicates
}

/**
 * Get all used player IDs from teams
 * @param {Array<Array<{playerId, position}>>} teams - Slot-based teams
 * @returns {Set<number>} Set of used player IDs
 */
export function getUsedPlayerIds(teams) {
    const usedIds = new Set();
    teams.forEach(team => {
        team.forEach(slot => usedIds.add(slot.playerId));
    });
    return usedIds;
}

/**
 * Get unused player IDs
 * @param {Array<Array<{playerId, position}>>} teams - Slot-based teams
 * @param {Array<number>} allPlayerIds - All available player IDs
 * @returns {Array<number>} Unused player IDs
 */
export function getUnusedPlayerIds(teams, allPlayerIds) {
    const usedIds = getUsedPlayerIds(teams);
    return allPlayerIds.filter(id => !usedIds.has(id));
}

/**
 * Validate team composition (slot-based)
 * @param {Array<{playerId, position}>} team - Single team (slots)
 * @param {Object} composition - Required composition {S: 1, OH: 2, ...}
 * @returns {{isValid: boolean, errors: Array}} Validation result
 */
export function validateSlotTeamComposition(team, composition) {
    const errors = [];
    const positionCounts = {};

    // Count positions
    team.forEach(slot => {
        positionCounts[slot.position] = (positionCounts[slot.position] || 0) + 1;
    });

    // Validate against composition
    Object.keys(composition).forEach(position => {
        const required = composition[position];
        const actual = positionCounts[position] || 0;

        if (actual !== required) {
            errors.push(`Position ${position}: expected ${required}, got ${actual}`);
        }
    });

    return {
        isValid: errors.length === 0,
        errors
    };
}

/**
 * Validate all teams composition
 * @param {Array<Array<{playerId, position}>>} teams - Slot-based teams
 * @param {Object} composition - Required composition
 * @returns {{isValid: boolean, errors: Array}} Validation result
 */
export function validateAllSlotTeamsComposition(teams, composition) {
    const allErrors = [];

    teams.forEach((team, idx) => {
        const validation = validateSlotTeamComposition(team, composition);
        if (!validation.isValid) {
            validation.errors.forEach(error => {
                allErrors.push(`Team ${idx + 1}: ${error}`);
            });
        }
    });

    return {
        isValid: allErrors.length === 0,
        errors: allErrors
    };
}

/**
 * Create hash for tabu search (slot-based)
 * @param {Array<Array<{playerId, position}>>} teams - Slot-based teams
 * @returns {string} Hash string
 */
export function hashSlotSolution(teams) {
    return teams.map(team =>
        team.map(slot => `${slot.playerId}:${slot.position}`).sort().join(',')
    ).sort().join('|');
}

/**
 * Swap two slots between teams
 * @param {Array<Array<{playerId, position}>>} teams - Teams
 * @param {number} team1Idx - First team index
 * @param {number} slot1Idx - First slot index
 * @param {number} team2Idx - Second team index
 * @param {number} slot2Idx - Second slot index
 */
export function swapSlots(teams, team1Idx, slot1Idx, team2Idx, slot2Idx) {
    const temp = teams[team1Idx][slot1Idx];
    teams[team1Idx][slot1Idx] = teams[team2Idx][slot2Idx];
    teams[team2Idx][slot2Idx] = temp;
}

/**
 * Find slot index by player ID in a team
 * @param {Array<{playerId, position}>} team - Team (slots)
 * @param {number} playerId - Player ID to find
 * @returns {number} Index or -1 if not found
 */
export function findSlotByPlayerId(team, playerId) {
    return team.findIndex(slot => slot.playerId === playerId);
}

/**
 * Find all slots for a position in a team
 * @param {Array<{playerId, position}>} team - Team (slots)
 * @param {string} position - Position code
 * @returns {Array<number>} Array of slot indices
 */
export function findSlotsByPosition(team, position) {
    const indices = [];
    team.forEach((slot, idx) => {
        if (slot.position === position) {
            indices.push(idx);
        }
    });
    return indices;
}

/**
 * Convert old-style team (with player objects) to slot-based team
 * @param {Array<Object>} oldTeam - Old-style team with full player objects
 * @returns {Array<{playerId, position}>} Slot-based team
 */
export function convertToSlotTeam(oldTeam) {
    return oldTeam.map(player => ({
        playerId: player.id,
        position: player.assignedPosition
    }));
}

/**
 * Convert old-style teams to slot-based teams
 * @param {Array<Array<Object>>} oldTeams - Old-style teams
 * @returns {Array<Array<{playerId, position}>>} Slot-based teams
 */
export function convertToSlotTeams(oldTeams) {
    return oldTeams.map(team => convertToSlotTeam(team));
}
