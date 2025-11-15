/**
 * Advanced swap operations for team optimization
 * Provides intelligent, targeted swap strategies beyond basic random swaps
 */

import { calculateTeamStrength, getPlayerRating } from './evaluationUtils.js';
import { calculateFairnessMetric, calculateConsistencyMetric } from './advancedMetrics.js';

/**
 * Perform a fairness-driven swap - balances distribution of top players
 * @param {Array} teams - Array of teams
 * @param {Array} positions - Available positions
 * @param {Object} adaptiveParams - Adaptive parameters
 * @returns {boolean} Whether swap was performed
 */
export function performFairnessSwap(teams, positions, adaptiveParams) {
    if (teams.length < 2) return false;

    const positionWeights = adaptiveParams.positionWeights || {};

    // Calculate fairness metrics
    const fairness = calculateFairnessMetric(teams, positionWeights, 0.2);

    if (!fairness || !fairness.topPlayersPerTeam || fairness.topPlayersPerTeam.length === 0) return false;

    // Find team with most top players and team with least top players
    const teamCounts = fairness.topPlayersPerTeam.map((count, idx) => ({ idx, count }));
    teamCounts.sort((a, b) => b.count - a.count);

    const richestTeamIdx = teamCounts[0].idx;
    const poorestTeamIdx = teamCounts[teamCounts.length - 1].idx;

    // Only swap if there's a significant imbalance
    if (teamCounts[0].count - teamCounts[teamCounts.length - 1].count < 2) {
        return false;
    }

    // Find a top player from richest team and a non-top player from poorest team
    const allPlayers = teams.flat();
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
    const topPlayerThreshold = playerRatings[Math.ceil(allPlayers.length * 0.2) - 1].weightedRating;

    // Get top player from richest team
    const richestTeam = teams[richestTeamIdx];
    const topPlayersInRichest = richestTeam.filter(p => {
        const position = p.assignedPosition || p.positions?.[0];
        const rating = getPlayerRating(p, position);
        const weight = positionWeights[position] || 1.0;
        return rating * weight >= topPlayerThreshold;
    });

    if (topPlayersInRichest.length === 0) return false;

    // Try to find a swap partner with same position from poorest team
    for (const topPlayer of topPlayersInRichest) {
        const topPlayerPosition = topPlayer.assignedPosition;
        const poorestTeam = teams[poorestTeamIdx];

        const samePositionPlayers = poorestTeam.filter(p => {
            const position = p.assignedPosition || p.positions?.[0];
            const rating = getPlayerRating(p, position);
            const weight = positionWeights[position] || 1.0;
            return p.assignedPosition === topPlayerPosition && rating * weight < topPlayerThreshold;
        });

        if (samePositionPlayers.length > 0) {
            // Perform the swap
            const swapPartner = samePositionPlayers[0];
            const idx1 = richestTeam.findIndex(p => p.id === topPlayer.id);
            const idx2 = poorestTeam.findIndex(p => p.id === swapPartner.id);

            if (idx1 !== -1 && idx2 !== -1) {
                [teams[richestTeamIdx][idx1], teams[poorestTeamIdx][idx2]] =
                    [teams[poorestTeamIdx][idx2], teams[richestTeamIdx][idx1]];
                return true;
            }
        }
    }

    return false;
}

/**
 * Perform a consistency-driven swap - improves position-level balance
 * @param {Array} teams - Array of teams
 * @param {Object} composition - Position composition
 * @param {Object} adaptiveParams - Adaptive parameters
 * @returns {boolean} Whether swap was performed
 */
export function performConsistencySwap(teams, composition, adaptiveParams) {
    if (teams.length < 2) return false;

    const positionWeights = adaptiveParams.positionWeights || {};
    const consistency = calculateConsistencyMetric(teams, composition, positionWeights);

    if (!consistency || !consistency.details) return false;

    // Find position with highest variance (least consistent)
    const positions = Object.keys(consistency.details);
    if (positions.length === 0) return false;

    positions.sort((a, b) => {
        return consistency.details[b].variance - consistency.details[a].variance;
    });

    const targetPosition = positions[0];
    const posDetails = consistency.details[targetPosition];

    // Find strongest and weakest team at this position
    const teamStrengthsAtPos = teams.map((team, idx) => {
        const playersAtPos = team.filter(p => p.assignedPosition === targetPosition);
        const totalRating = playersAtPos.reduce((sum, p) => {
            return sum + getPlayerRating(p, targetPosition);
        }, 0);
        const avgRating = playersAtPos.length > 0 ? totalRating / playersAtPos.length : 0;
        return { idx, avgRating, players: playersAtPos };
    });

    teamStrengthsAtPos.sort((a, b) => b.avgRating - a.avgRating);

    const strongestTeamIdx = teamStrengthsAtPos[0].idx;
    const weakestTeamIdx = teamStrengthsAtPos[teamStrengthsAtPos.length - 1].idx;

    // Swap players at this position
    const strongPlayers = teamStrengthsAtPos[0].players;
    const weakPlayers = teamStrengthsAtPos[teamStrengthsAtPos.length - 1].players;

    if (strongPlayers.length === 0 || weakPlayers.length === 0) return false;

    // Find strongest from strong team and weakest from weak team
    strongPlayers.sort((a, b) => {
        return getPlayerRating(b, targetPosition) - getPlayerRating(a, targetPosition);
    });
    weakPlayers.sort((a, b) => {
        return getPlayerRating(a, targetPosition) - getPlayerRating(b, targetPosition);
    });

    const strongPlayer = strongPlayers[0];
    const weakPlayer = weakPlayers[0];

    const idx1 = teams[strongestTeamIdx].findIndex(p => p.id === strongPlayer.id);
    const idx2 = teams[weakestTeamIdx].findIndex(p => p.id === weakPlayer.id);

    if (idx1 !== -1 && idx2 !== -1) {
        [teams[strongestTeamIdx][idx1], teams[weakestTeamIdx][idx2]] =
            [teams[weakestTeamIdx][idx2], teams[strongestTeamIdx][idx1]];
        return true;
    }

    return false;
}

/**
 * Perform a multi-position chain swap - swaps players across 3+ teams
 * @param {Array} teams - Array of teams
 * @param {Array} positions - Available positions
 * @param {Object} adaptiveParams - Adaptive parameters
 * @returns {boolean} Whether swap was performed
 */
export function performChainSwap(teams, positions, adaptiveParams) {
    if (teams.length < 3) return false;

    const positionWeights = adaptiveParams.positionWeights || {};

    // Select 3 random teams
    const teamIndices = [];
    while (teamIndices.length < 3) {
        const idx = Math.floor(Math.random() * teams.length);
        if (!teamIndices.includes(idx)) {
            teamIndices.push(idx);
        }
    }

    // Select a random position
    const position = positions[Math.floor(Math.random() * positions.length)];

    // Get players at this position from each team
    const playersAtPos = teamIndices.map(idx => {
        const players = teams[idx].filter(p => p.assignedPosition === position);
        return players.length > 0 ? players[Math.floor(Math.random() * players.length)] : null;
    });

    // Check if all teams have players at this position
    if (playersAtPos.some(p => p === null)) return false;

    // Perform chain swap: team[0] -> team[1], team[1] -> team[2], team[2] -> team[0]
    const indices = teamIndices.map((teamIdx, i) => {
        return teams[teamIdx].findIndex(p => p.id === playersAtPos[i].id);
    });

    if (indices.some(idx => idx === -1)) return false;

    // Save players before swap
    const player0 = teams[teamIndices[0]][indices[0]];
    const player1 = teams[teamIndices[1]][indices[1]];
    const player2 = teams[teamIndices[2]][indices[2]];

    // Perform circular swap
    teams[teamIndices[0]][indices[0]] = player2;
    teams[teamIndices[1]][indices[1]] = player0;
    teams[teamIndices[2]][indices[2]] = player1;

    return true;
}

/**
 * Perform a strategic swap based on team weaknesses
 * Identifies each team's weakest position and tries to improve it
 * @param {Array} teams - Array of teams
 * @param {Object} composition - Position composition
 * @param {Object} adaptiveParams - Adaptive parameters
 * @returns {boolean} Whether swap was performed
 */
export function performWeaknessTargetedSwap(teams, composition, adaptiveParams) {
    if (teams.length < 2) return false;

    const positionWeights = adaptiveParams.positionWeights || {};
    const positions = Object.keys(composition);

    // For each team, identify weakest position
    const teamWeaknesses = teams.map((team, teamIdx) => {
        const positionStrengths = positions.map(position => {
            const playersAtPos = team.filter(p => p.assignedPosition === position);
            const avgRating = playersAtPos.length > 0
                ? playersAtPos.reduce((sum, p) => sum + getPlayerRating(p, position), 0) / playersAtPos.length
                : 0;
            const weight = positionWeights[position] || 1.0;
            return {
                position,
                avgRating,
                weightedRating: avgRating * weight,
                playerCount: playersAtPos.length
            };
        });

        // Sort by weighted rating (ascending) to find weakest
        positionStrengths.sort((a, b) => a.weightedRating - b.weightedRating);

        return {
            teamIdx,
            weakestPosition: positionStrengths[0].position,
            weakestRating: positionStrengths[0].avgRating
        };
    });

    // Sort teams by their weakest position rating
    teamWeaknesses.sort((a, b) => a.weakestRating - b.weakestRating);

    const weakestTeam = teamWeaknesses[0];
    const strongestTeam = teamWeaknesses[teamWeaknesses.length - 1];

    // Try to swap players at the weakest position
    const weakPosition = weakestTeam.weakestPosition;

    const weakTeamPlayers = teams[weakestTeam.teamIdx].filter(p => p.assignedPosition === weakPosition);
    const strongTeamPlayers = teams[strongestTeam.teamIdx].filter(p => p.assignedPosition === weakPosition);

    if (weakTeamPlayers.length === 0 || strongTeamPlayers.length === 0) return false;

    // Find weakest player from weak team
    weakTeamPlayers.sort((a, b) => {
        return getPlayerRating(a, weakPosition) - getPlayerRating(b, weakPosition);
    });

    // Find a decent player from strong team (not strongest, to avoid breaking strong team too much)
    strongTeamPlayers.sort((a, b) => {
        return getPlayerRating(b, weakPosition) - getPlayerRating(a, weakPosition);
    });

    const weakPlayer = weakTeamPlayers[0];
    const strongPlayer = strongTeamPlayers.length > 1
        ? strongTeamPlayers[1]  // Take second-best to maintain some strength in strong team
        : strongTeamPlayers[0];

    // Only swap if it actually improves the weak team
    const weakPlayerRating = getPlayerRating(weakPlayer, weakPosition);
    const strongPlayerRating = getPlayerRating(strongPlayer, weakPosition);

    if (strongPlayerRating <= weakPlayerRating) return false;

    const idx1 = teams[weakestTeam.teamIdx].findIndex(p => p.id === weakPlayer.id);
    const idx2 = teams[strongestTeam.teamIdx].findIndex(p => p.id === strongPlayer.id);

    if (idx1 !== -1 && idx2 !== -1) {
        [teams[weakestTeam.teamIdx][idx1], teams[strongestTeam.teamIdx][idx2]] =
            [teams[strongestTeam.teamIdx][idx2], teams[weakestTeam.teamIdx][idx1]];
        return true;
    }

    return false;
}

/**
 * Perform a balanced multi-swap - swaps 2 players between 2 teams
 * Tries to balance both position and overall strength
 * @param {Array} teams - Array of teams
 * @param {Array} positions - Available positions
 * @param {Object} adaptiveParams - Adaptive parameters
 * @returns {boolean} Whether swap was performed
 */
export function performBalancedMultiSwap(teams, positions, adaptiveParams) {
    if (teams.length < 2 || positions.length < 2) return false;

    const positionWeights = adaptiveParams.positionWeights || {};

    // Select two random teams
    const t1 = Math.floor(Math.random() * teams.length);
    let t2 = Math.floor(Math.random() * teams.length);
    while (t2 === t1 && teams.length > 1) {
        t2 = Math.floor(Math.random() * teams.length);
    }

    // Select two different positions
    const pos1 = positions[Math.floor(Math.random() * positions.length)];
    let pos2 = positions[Math.floor(Math.random() * positions.length)];
    while (pos2 === pos1 && positions.length > 1) {
        pos2 = positions[Math.floor(Math.random() * positions.length)];
    }

    // Find players at these positions
    const team1Pos1Players = teams[t1].filter(p => p.assignedPosition === pos1);
    const team1Pos2Players = teams[t1].filter(p => p.assignedPosition === pos2);
    const team2Pos1Players = teams[t2].filter(p => p.assignedPosition === pos1);
    const team2Pos2Players = teams[t2].filter(p => p.assignedPosition === pos2);

    if (team1Pos1Players.length === 0 || team1Pos2Players.length === 0 ||
        team2Pos1Players.length === 0 || team2Pos2Players.length === 0) {
        return false;
    }

    // Select random players
    const player1Pos1 = team1Pos1Players[Math.floor(Math.random() * team1Pos1Players.length)];
    const player1Pos2 = team1Pos2Players[Math.floor(Math.random() * team1Pos2Players.length)];
    const player2Pos1 = team2Pos1Players[Math.floor(Math.random() * team2Pos1Players.length)];
    const player2Pos2 = team2Pos2Players[Math.floor(Math.random() * team2Pos2Players.length)];

    // Find indices
    const idx1Pos1 = teams[t1].findIndex(p => p.id === player1Pos1.id);
    const idx1Pos2 = teams[t1].findIndex(p => p.id === player1Pos2.id);
    const idx2Pos1 = teams[t2].findIndex(p => p.id === player2Pos1.id);
    const idx2Pos2 = teams[t2].findIndex(p => p.id === player2Pos2.id);

    if ([idx1Pos1, idx1Pos2, idx2Pos1, idx2Pos2].some(idx => idx === -1)) {
        return false;
    }

    // Perform double swap: t1.pos1 <-> t2.pos1, t1.pos2 <-> t2.pos2
    [teams[t1][idx1Pos1], teams[t2][idx2Pos1]] = [teams[t2][idx2Pos1], teams[t1][idx1Pos1]];
    [teams[t1][idx1Pos2], teams[t2][idx2Pos2]] = [teams[t2][idx2Pos2], teams[t1][idx1Pos2]];

    return true;
}

/**
 * Perform an intelligent universal swap - chooses best swap strategy adaptively
 * @param {Array} teams - Array of teams
 * @param {Array} positions - Available positions
 * @param {Object} composition - Position composition
 * @param {Object} adaptiveParams - Adaptive parameters
 * @returns {void}
 */
export function performIntelligentSwap(teams, positions, composition, adaptiveParams) {
    // Choose swap strategy based on probability distribution
    const rand = Math.random();

    if (rand < 0.25 && composition) {
        // 25% - Fairness-driven swap
        const success = performFairnessSwap(teams, positions, adaptiveParams);
        if (!success) {
            // Fallback to weakness-targeted
            performWeaknessTargetedSwap(teams, composition, adaptiveParams);
        }
    } else if (rand < 0.45 && composition) {
        // 20% - Consistency-driven swap
        const success = performConsistencySwap(teams, composition, adaptiveParams);
        if (!success) {
            // Fallback to balanced multi-swap
            performBalancedMultiSwap(teams, positions, adaptiveParams);
        }
    } else if (rand < 0.60 && composition) {
        // 15% - Weakness-targeted swap
        performWeaknessTargetedSwap(teams, composition, adaptiveParams);
    } else if (rand < 0.75) {
        // 15% - Chain swap
        performChainSwap(teams, positions, adaptiveParams);
    } else {
        // 25% - Balanced multi-swap
        performBalancedMultiSwap(teams, positions, adaptiveParams);
    }
}
