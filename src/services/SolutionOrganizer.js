/**
 * SolutionOrganizer - Handles organization and sorting of solutions
 * Groups players, sorts teams, and prepares final results
 */

import { calculateSimpleTeamStrength } from '../utils/evaluationUtils.js';
import { sortTeamByPosition, getUnusedPlayers, validateNoDuplicatePlayers, removeDuplicatePlayers } from '../utils/solutionUtils.js';

class SolutionOrganizer {
    /**
     * @param {Object} activityConfig - Activity-specific configuration
     */
    constructor(activityConfig) {
        this.activityConfig = activityConfig;
    }

    /**
     * Group players by their positions
     * Each player appears once for each position they can play
     * @param {Array} players - All players
     * @returns {Object} Players grouped by position with assigned position and rating
     */
    groupByPosition(players) {
        const grouped = {};

        players.forEach(player => {
            if (player.positions && Array.isArray(player.positions)) {
                player.positions.forEach(position => {
                    if (!grouped[position]) {
                        grouped[position] = [];
                    }

                    grouped[position].push({
                        ...player,
                        assignedPosition: position,
                        positionRating: player.ratings?.[position] || 1500
                    });
                });
            }
        });

        return grouped;
    }

    /**
     * Sort teams by strength (strongest first)
     * @param {Array} teams - Teams to sort
     * @returns {Array} Sorted teams
     */
    sortTeamsByStrength(teams) {
        return teams.sort((a, b) => {
            const aStrength = calculateSimpleTeamStrength(a, this.activityConfig.positionWeights);
            const bStrength = calculateSimpleTeamStrength(b, this.activityConfig.positionWeights);
            return bStrength - aStrength;
        });
    }

    /**
     * Sort players within each team by position order
     * @param {Array} teams - Teams to sort
     * @returns {Array} Teams with sorted players
     */
    sortPlayersInTeams(teams) {
        teams.forEach(team => {
            sortTeamByPosition(team, this.activityConfig.positionOrder);
        });
        return teams;
    }

    /**
     * Prepare final solution with sorted teams and players
     * @param {Array} teams - Raw solution teams
     * @param {Array} allPlayers - All available players
     * @returns {Object} Organized solution
     */
    prepareFinalSolution(teams, allPlayers) {
        // CRITICAL FIX: Check for and remove duplicate players before proceeding
        const duplicateValidation = validateNoDuplicatePlayers(teams);

        let finalTeams = teams;
        let duplicateWarnings = [];
        let autoFillPerformed = false;

        if (!duplicateValidation.isValid) {
            console.warn('⚠️  Duplicate players detected in teams!');
            duplicateValidation.errors.forEach(error => {
                console.warn(`  - ${error}`);
            });

            // Remove duplicates (keep first occurrence)
            const cleanupResult = removeDuplicatePlayers(teams);
            finalTeams = cleanupResult.cleanedTeams;

            console.warn(`✓ Removed ${cleanupResult.removedCount} duplicate player(s)`);
            cleanupResult.details.forEach(detail => {
                const message = `  - Removed ${detail.playerName || detail.playerId} (${detail.position}) from Team ${detail.removedFromTeam + 1}`;
                console.warn(message);
            });

            duplicateWarnings = duplicateValidation.errors;

            // Try to refill incomplete teams
            const unusedPlayers = getUnusedPlayers(finalTeams, allPlayers);
            if (unusedPlayers.length > 0) {
                autoFillPerformed = this.tryRefillTeams(finalTeams, unusedPlayers, cleanupResult.details);
            }
        }

        // Sort teams by strength
        this.sortTeamsByStrength(finalTeams);

        // Sort players within teams
        this.sortPlayersInTeams(finalTeams);

        // Get unused players
        const unusedPlayers = getUnusedPlayers(finalTeams, allPlayers);

        return {
            teams: finalTeams,
            unusedPlayers,
            duplicateWarnings: duplicateWarnings.length > 0 ? duplicateWarnings : undefined,
            autoFillPerformed
        };
    }

    /**
     * Try to refill teams with missing players from unused pool
     * @param {Array} teams - Teams with missing players
     * @param {Array} unusedPlayers - Pool of unused players
     * @param {Array} removedDetails - Details of removed players
     * @returns {boolean} True if any players were added
     */
    tryRefillTeams(teams, unusedPlayers, removedDetails) {
        let addedCount = 0;

        // Create a map of removed positions per team
        const teamNeedsMap = new Map();
        removedDetails.forEach(detail => {
            if (!teamNeedsMap.has(detail.removedFromTeam)) {
                teamNeedsMap.set(detail.removedFromTeam, []);
            }
            teamNeedsMap.get(detail.removedFromTeam).push(detail.position);
        });

        // Try to fill missing positions
        teamNeedsMap.forEach((positions, teamIdx) => {
            positions.forEach(neededPosition => {
                // Find a player from unused pool who can play this position
                const playerIndex = unusedPlayers.findIndex(p =>
                    p.positions && p.positions.includes(neededPosition)
                );

                if (playerIndex !== -1) {
                    const player = unusedPlayers[playerIndex];
                    // Create a new player object with assigned position
                    teams[teamIdx].push({
                        ...player,
                        assignedPosition: neededPosition,
                        positionRating: player.ratings?.[neededPosition] || 1500
                    });
                    // Remove from unused pool
                    unusedPlayers.splice(playerIndex, 1);
                    addedCount++;
                    console.warn(`  ✓ Auto-filled Team ${teamIdx + 1} with ${player.name} (${neededPosition})`);
                }
            });
        });

        return addedCount > 0;
    }

    /**
     * Get team statistics
     * @param {Array} team - Team to analyze
     * @returns {Object} Team statistics
     */
    getTeamStatistics(team) {
        const positionCounts = {};
        const positionRatings = {};

        team.forEach(player => {
            const position = player.assignedPosition;
            positionCounts[position] = (positionCounts[position] || 0) + 1;

            if (!positionRatings[position]) {
                positionRatings[position] = [];
            }
            positionRatings[position].push(player.positionRating || 1500);
        });

        const statistics = {
            playerCount: team.length,
            positions: {},
            totalStrength: calculateSimpleTeamStrength(team, this.activityConfig.positionWeights)
        };

        Object.keys(positionCounts).forEach(position => {
            const ratings = positionRatings[position];
            const avgRating = ratings.reduce((a, b) => a + b, 0) / ratings.length;

            statistics.positions[position] = {
                count: positionCounts[position],
                averageRating: Math.round(avgRating),
                totalRating: Math.round(ratings.reduce((a, b) => a + b, 0))
            };
        });

        return statistics;
    }

    /**
     * Get statistics for all teams
     * @param {Array} teams - All teams
     * @returns {Array} Statistics for each team
     */
    getAllTeamStatistics(teams) {
        return teams.map((team, idx) => ({
            teamIndex: idx,
            teamNumber: idx + 1,
            ...this.getTeamStatistics(team)
        }));
    }
}

export default SolutionOrganizer;
