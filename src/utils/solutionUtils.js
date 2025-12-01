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

/**
 * Validate that no player appears in multiple teams (check for duplicate player IDs)
 * @param {Array} teams - Array of teams to validate
 * @returns {Object} Validation result { isValid: boolean, errors: Array, duplicates: Array }
 */
export function validateNoDuplicatePlayers(teams) {
    const errors = [];
    const duplicates = [];
    const playerIdToTeams = new Map(); // Map of player ID to array of team indices

    // Track which teams each player appears in
    teams.forEach((team, teamIdx) => {
        team.forEach(player => {
            if (!player.id) {
                errors.push(`Player without ID found in team ${teamIdx}`);
                return;
            }

            if (!playerIdToTeams.has(player.id)) {
                playerIdToTeams.set(player.id, []);
            }
            playerIdToTeams.get(player.id).push(teamIdx);
        });
    });

    // Check for duplicates (players appearing in more than one team)
    playerIdToTeams.forEach((teamIndices, playerId) => {
        if (teamIndices.length > 1) {
            const teamNumbers = teamIndices.map(idx => idx + 1).join(', ');
            errors.push(`Player ${playerId} appears in multiple teams: ${teamNumbers}`);
            duplicates.push({
                playerId,
                teamIndices,
                count: teamIndices.length
            });
        }
    });

    return {
        isValid: errors.length === 0,
        errors,
        duplicates
    };
}

/**
 * Remove duplicate players from teams (keep only first occurrence)
 * If a player appears in multiple teams, keep them in the first team and remove from others
 * @param {Array} teams - Array of teams
 * @returns {Object} { cleanedTeams: Array, removedCount: number, details: Array }
 */
export function removeDuplicatePlayers(teams) {
    const seenPlayerIds = new Set();
    const removedCount = { total: 0 };
    const details = [];

    const cleanedTeams = teams.map((team, teamIdx) => {
        const cleanedTeam = [];

        team.forEach(player => {
            if (!player.id) {
                // Keep players without ID (shouldn't happen, but safe fallback)
                cleanedTeam.push(player);
                return;
            }

            if (seenPlayerIds.has(player.id)) {
                // Duplicate found - skip this player
                removedCount.total++;
                details.push({
                    playerId: player.id,
                    playerName: player.name,
                    removedFromTeam: teamIdx,
                    position: player.assignedPosition
                });
            } else {
                // First occurrence - keep it
                seenPlayerIds.add(player.id);
                cleanedTeam.push(player);
            }
        });

        return cleanedTeam;
    });

    return {
        cleanedTeams,
        removedCount: removedCount.total,
        details
    };
}
