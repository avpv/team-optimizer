// src/services/optimizer/utils/swapOperations.js

import { calculateTeamStrength } from './evaluationUtils.js';

/**
 * Various swap operations for team optimization
 *
 * IMPORTANT: All swap operations now maintain composition integrity:
 * - performSwap: Swaps players at the SAME position between teams
 * - performAdaptiveSwap: Swaps players at the SAME position with balance checking
 * - performCrossTeamPositionSwap: Swaps players at the SAME position across teams
 * - performPositionSwap: Swaps players within one team (always safe)
 *
 * For additional safety, use validateTeamComposition() or validateAllTeamsComposition()
 * from solutionUtils.js to verify composition after swaps.
 */

/**
 * Perform a simple random swap between two random teams at random positions
 * @param {Array} teams - Array of teams
 * @param {Array} positions - Available positions
 */
export function performSwap(teams, positions) {
    if (teams.length < 2) return;
    
    const t1 = Math.floor(Math.random() * teams.length);
    let t2 = Math.floor(Math.random() * teams.length);
    while (t2 === t1 && teams.length > 1) {
        t2 = Math.floor(Math.random() * teams.length);
    }
    
    const pos = positions[Math.floor(Math.random() * positions.length)];
    const p1 = teams[t1].filter(p => p.assignedPosition === pos);
    const p2 = teams[t2].filter(p => p.assignedPosition === pos);
    
    if (p1.length > 0 && p2.length > 0) {
        const idx1 = teams[t1].findIndex(p => p.id === p1[Math.floor(Math.random() * p1.length)].id);
        const idx2 = teams[t2].findIndex(p => p.id === p2[Math.floor(Math.random() * p2.length)].id);
        if (idx1 !== -1 && idx2 !== -1) {
            [teams[t1][idx1], teams[t2][idx2]] = [teams[t2][idx2], teams[t1][idx1]];
        }
    }
}

/**
 * Perform an adaptive swap between strongest and weakest teams
 * Uses position-weighted ratings for more accurate team strength evaluation
 * @param {Array} teams - Array of teams
 * @param {Array} positions - Available positions
 * @param {Object} adaptiveParams - Adaptive parameters configuration
 */
export function performAdaptiveSwap(teams, positions, adaptiveParams) {
    const positionWeights = adaptiveParams.positionWeights || {};
    const teamStrengths = teams.map((team, idx) => ({
        idx,
        strength: calculateTeamStrength(team, positionWeights, true).weightedRating
    })).sort((a, b) => b.strength - a.strength);

    if (teamStrengths.length < 2) {
        return performSwap(teams, positions);
    }

    const strongestIdx = teamStrengths[0].idx;
    const weakestIdx = teamStrengths[teamStrengths.length - 1].idx;

    if (Math.random() < adaptiveParams.strongWeakSwapProbability && strongestIdx !== weakestIdx) {
        const position = positions[Math.floor(Math.random() * positions.length)];
        const strongPlayers = teams[strongestIdx].filter(p => p.assignedPosition === position);
        const weakPlayers = teams[weakestIdx].filter(p => p.assignedPosition === position);

        if (strongPlayers.length > 0 && weakPlayers.length > 0) {
            // FIXED: Take STRONGEST from STRONG team and WEAKEST from WEAK team to balance
            const strongestInStrong = strongPlayers.reduce((max, p) => p.positionRating > max.positionRating ? p : max);
            const weakestInWeak = weakPlayers.reduce((min, p) => p.positionRating < min.positionRating ? p : min);
            const idx1 = teams[strongestIdx].findIndex(p => p.id === strongestInStrong.id);
            const idx2 = teams[weakestIdx].findIndex(p => p.id === weakestInWeak.id);

            // Only swap if it actually improves balance (strong player is stronger than weak player)
            if (idx1 !== -1 && idx2 !== -1 && strongestInStrong.positionRating > weakestInWeak.positionRating) {
                // Calculate current balance
                const currentBalance = teamStrengths[0].strength - teamStrengths[teamStrengths.length - 1].strength;

                // Calculate balance after swap
                const strongTeamAfter = teamStrengths[0].strength -
                    strongestInStrong.positionRating * (positionWeights[position] || 1.0) +
                    weakestInWeak.positionRating * (positionWeights[position] || 1.0);
                const weakTeamAfter = teamStrengths[teamStrengths.length - 1].strength -
                    weakestInWeak.positionRating * (positionWeights[position] || 1.0) +
                    strongestInStrong.positionRating * (positionWeights[position] || 1.0);
                const newBalance = Math.abs(strongTeamAfter - weakTeamAfter);

                // Only perform swap if it improves balance
                if (newBalance < currentBalance) {
                    [teams[strongestIdx][idx1], teams[weakestIdx][idx2]] = [teams[weakestIdx][idx2], teams[strongestIdx][idx1]];
                    return;
                }
            }
        }
    }

    performSwap(teams, positions);
}

/**
 * Swap players at same position within one team
 * @param {Array} teams - Array of teams
 */
export function performPositionSwap(teams) {
    if (teams.length === 0) return;
    
    const team = teams[Math.floor(Math.random() * teams.length)];
    if (team.length < 2) return;
    
    const positionsInTeam = [...new Set(team.map(p => p.assignedPosition))];
    const position = positionsInTeam[Math.floor(Math.random() * positionsInTeam.length)];
    const playersAtPos = team.map((p, idx) => ({ p, idx })).filter(({p}) => p.assignedPosition === position);
    
    if (playersAtPos.length >= 2) {
        const idx1 = Math.floor(Math.random() * playersAtPos.length);
        let idx2 = Math.floor(Math.random() * playersAtPos.length);
        while (idx2 === idx1 && playersAtPos.length > 1) {
            idx2 = Math.floor(Math.random() * playersAtPos.length);
        }
        
        const i1 = playersAtPos[idx1].idx;
        const i2 = playersAtPos[idx2].idx;
        [team[i1], team[i2]] = [team[i2], team[i1]];
    }
}

/**
 * Swap players at the same position across teams
 * FIXED: Now swaps players at the SAME position to maintain team composition
 * @param {Array} teams - Array of teams
 */
export function performCrossTeamPositionSwap(teams) {
    if (teams.length < 2) return;

    const t1 = Math.floor(Math.random() * teams.length);
    let t2 = Math.floor(Math.random() * teams.length);
    while (t2 === t1 && teams.length > 1) {
        t2 = Math.floor(Math.random() * teams.length);
    }

    if (teams[t1].length === 0 || teams[t2].length === 0) return;

    // Get all positions available in both teams
    const positions1 = [...new Set(teams[t1].map(p => p.assignedPosition))];
    const positions2 = [...new Set(teams[t2].map(p => p.assignedPosition))];

    // Find common positions between teams
    const commonPositions = positions1.filter(pos => positions2.includes(pos));

    if (commonPositions.length === 0) {
        // No common positions, cannot perform safe swap
        return;
    }

    // Select a random common position
    const position = commonPositions[Math.floor(Math.random() * commonPositions.length)];

    // Get players at this position in both teams
    const playersT1 = teams[t1].filter(p => p.assignedPosition === position);
    const playersT2 = teams[t2].filter(p => p.assignedPosition === position);

    if (playersT1.length === 0 || playersT2.length === 0) {
        // Should not happen, but safety check
        return;
    }

    // Randomly select one player from each team at this position
    const player1 = playersT1[Math.floor(Math.random() * playersT1.length)];
    const player2 = playersT2[Math.floor(Math.random() * playersT2.length)];

    // Find their indices in their respective teams
    const idx1 = teams[t1].findIndex(p => p.id === player1.id);
    const idx2 = teams[t2].findIndex(p => p.id === player2.id);

    if (idx1 !== -1 && idx2 !== -1) {
        // Swap players at the same position - this maintains team composition
        [teams[t1][idx1], teams[t2][idx2]] = [teams[t2][idx2], teams[t1][idx1]];
    }
}

/**
 * Perform a universal swap - randomly choose one of the swap strategies
 * @param {Array} teams - Array of teams
 * @param {Array} positions - Available positions
 * @param {Object} adaptiveParams - Adaptive parameters configuration
 */
export function performUniversalSwap(teams, positions, adaptiveParams) {
    const rand = Math.random();
    
    if (rand < 0.25) {
        performSwap(teams, positions);
    } 
    else if (rand < 0.5) {
        performAdaptiveSwap(teams, positions, adaptiveParams);
    } 
    else if (rand < 0.75) {
        performCrossTeamPositionSwap(teams);
    } 
    else {
        performPositionSwap(teams);
    }
}
