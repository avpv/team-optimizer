/**
 * SolutionOrganizer - Handles organization and sorting of solutions
 * Groups players, sorts teams, and prepares final results
 */

import { calculateSimpleTeamStrength } from '../utils/evaluationUtils.js';
import { sortTeamByPosition, getUnusedPlayers } from '../utils/solutionUtils.js';

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
        // Sort teams by strength
        this.sortTeamsByStrength(teams);

        // Sort players within teams
        this.sortPlayersInTeams(teams);

        // Get unused players
        const unusedPlayers = getUnusedPlayers(teams, allPlayers);

        return {
            teams,
            unusedPlayers
        };
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
