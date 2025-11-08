// src/services/optimizer/utils/swapOperations.js

/**
 * Various swap operations for team optimization
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
 * Calculate team strength based on player ratings
 * @param {Array} players - Team players
 * @param {Object} positionWeights - Position weights from sport config
 * @param {boolean} usePositionWeights - Whether to apply position weights
 * @returns {Object} Team strength statistics
 */
function calculateTeamStrength(players, positionWeights = {}, usePositionWeights = true) {
    const DEFAULT_RATING = 1500;

    if (!players || players.length === 0) {
        return {
            totalRating: 0,
            weightedRating: 0,
            averageRating: 0,
            playerCount: 0
        };
    }

    let totalRating = 0;
    let weightedRating = 0;

    players.forEach(player => {
        const position = player.assignedPosition || player.positions?.[0];
        const rating = position && player.ratings?.[position]
            ? player.ratings[position]
            : DEFAULT_RATING;

        totalRating += rating;

        // Apply position weight if enabled
        if (usePositionWeights && position) {
            const weight = positionWeights[position] || 1.0;
            weightedRating += rating * weight;
        } else {
            weightedRating += rating;
        }
    });

    return {
        totalRating: Math.round(totalRating),
        weightedRating: Math.round(weightedRating),
        averageRating: Math.round(totalRating / players.length),
        playerCount: players.length
    };
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
            const weakestInStrong = strongPlayers.reduce((min, p) => p.positionRating < min.positionRating ? p : min);
            const strongestInWeak = weakPlayers.reduce((max, p) => p.positionRating > max.positionRating ? p : max);
            const idx1 = teams[strongestIdx].findIndex(p => p.id === weakestInStrong.id);
            const idx2 = teams[weakestIdx].findIndex(p => p.id === strongestInWeak.id);
            
            if (idx1 !== -1 && idx2 !== -1 && weakestInStrong.positionRating < strongestInWeak.positionRating) {
                [teams[strongestIdx][idx1], teams[weakestIdx][idx2]] = [teams[weakestIdx][idx2], teams[strongestIdx][idx1]];
                return;
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
 * Swap players at different positions across teams
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
    
    const idx1 = Math.floor(Math.random() * teams[t1].length);
    const idx2 = Math.floor(Math.random() * teams[t2].length);
    
    [teams[t1][idx1], teams[t2][idx2]] = [teams[t2][idx2], teams[t1][idx1]];
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
