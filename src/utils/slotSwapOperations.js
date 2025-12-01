/**
 * Slot-Based Swap Operations
 *
 * Swap operations for the new slot-based team structure.
 * Key advantages:
 * - No duplicate validation needed (impossible by structure)
 * - Much faster (swapping IDs, not objects)
 * - Cleaner code (no complex validation logic)
 */

import { findSlotsByPosition, swapSlots } from './teamSlotUtils.js';

/**
 * Perform a simple random swap between two teams at same position
 * @param {Array<Array<{playerId, position}>>} teams - Slot-based teams
 * @param {Array<string>} positions - Available positions
 * @param {Object} playerPool - PlayerPool instance
 */
export function performSlotSwap(teams, positions, playerPool) {
    if (teams.length < 2) return;

    const t1 = Math.floor(Math.random() * teams.length);
    let t2 = Math.floor(Math.random() * teams.length);
    while (t2 === t1 && teams.length > 1) {
        t2 = Math.floor(Math.random() * teams.length);
    }

    const pos = positions[Math.floor(Math.random() * positions.length)];

    // Find slots at this position
    const slots1 = findSlotsByPosition(teams[t1], pos);
    const slots2 = findSlotsByPosition(teams[t2], pos);

    if (slots1.length > 0 && slots2.length > 0) {
        const idx1 = slots1[Math.floor(Math.random() * slots1.length)];
        const idx2 = slots2[Math.floor(Math.random() * slots2.length)];

        // Simple swap - no validation needed!
        swapSlots(teams, t1, idx1, t2, idx2);
    }
}

/**
 * Perform adaptive swap between strongest and weakest teams
 * @param {Array<Array<{playerId, position}>>} teams - Slot-based teams
 * @param {Array<string>} positions - Available positions
 * @param {Object} playerPool - PlayerPool instance
 * @param {Object} adaptiveParams - Adaptive parameters
 */
export function performAdaptiveSlotSwap(teams, positions, playerPool, adaptiveParams) {
    if (teams.length < 2) return;

    const positionWeights = adaptiveParams.positionWeights || {};

    // Calculate team strengths
    const teamStrengths = teams.map((team, idx) => {
        const strength = calculateSlotTeamStrength(team, playerPool, positionWeights);
        return { idx, strength };
    }).sort((a, b) => b.strength - a.strength);

    const strongestIdx = teamStrengths[0].idx;
    const weakestIdx = teamStrengths[teamStrengths.length - 1].idx;

    if (Math.random() < adaptiveParams.strongWeakSwapProbability && strongestIdx !== weakestIdx) {
        const position = positions[Math.floor(Math.random() * positions.length)];

        const strongSlots = findSlotsByPosition(teams[strongestIdx], position);
        const weakSlots = findSlotsByPosition(teams[weakestIdx], position);

        if (strongSlots.length > 0 && weakSlots.length > 0) {
            // Find strongest player in strong team
            let strongestSlotIdx = strongSlots[0];
            let strongestRating = playerPool.getPlayerRating(
                teams[strongestIdx][strongestSlotIdx].playerId,
                position
            );

            for (const slotIdx of strongSlots) {
                const rating = playerPool.getPlayerRating(
                    teams[strongestIdx][slotIdx].playerId,
                    position
                );
                if (rating > strongestRating) {
                    strongestRating = rating;
                    strongestSlotIdx = slotIdx;
                }
            }

            // Find weakest player in weak team
            let weakestSlotIdx = weakSlots[0];
            let weakestRating = playerPool.getPlayerRating(
                teams[weakestIdx][weakestSlotIdx].playerId,
                position
            );

            for (const slotIdx of weakSlots) {
                const rating = playerPool.getPlayerRating(
                    teams[weakestIdx][slotIdx].playerId,
                    position
                );
                if (rating < weakestRating) {
                    weakestRating = rating;
                    weakestSlotIdx = slotIdx;
                }
            }

            // Check if swap improves balance
            if (strongestRating > weakestRating) {
                const currentBalance = teamStrengths[0].strength - teamStrengths[teamStrengths.length - 1].strength;
                const weight = positionWeights[position] || 1.0;

                const strongTeamAfter = teamStrengths[0].strength - strongestRating * weight + weakestRating * weight;
                const weakTeamAfter = teamStrengths[teamStrengths.length - 1].strength - weakestRating * weight + strongestRating * weight;
                const newBalance = Math.abs(strongTeamAfter - weakTeamAfter);

                if (newBalance < currentBalance) {
                    swapSlots(teams, strongestIdx, strongestSlotIdx, weakestIdx, weakestSlotIdx);
                    return;
                }
            }
        }
    }

    performSlotSwap(teams, positions, playerPool);
}

/**
 * Swap players within one team (at same position)
 * @param {Array<Array<{playerId, position}>>} teams - Slot-based teams
 * @param {Object} playerPool - PlayerPool instance
 */
export function performPositionSlotSwap(teams, playerPool) {
    if (teams.length === 0) return;

    const team = teams[Math.floor(Math.random() * teams.length)];
    if (team.length < 2) return;

    // Get unique positions in team
    const positionsInTeam = [...new Set(team.map(slot => slot.position))];
    const position = positionsInTeam[Math.floor(Math.random() * positionsInTeam.length)];

    const slotsAtPos = findSlotsByPosition(team, position);

    if (slotsAtPos.length >= 2) {
        const idx1 = Math.floor(Math.random() * slotsAtPos.length);
        let idx2 = Math.floor(Math.random() * slotsAtPos.length);
        while (idx2 === idx1 && slotsAtPos.length > 1) {
            idx2 = Math.floor(Math.random() * slotsAtPos.length);
        }

        const slot1 = slotsAtPos[idx1];
        const slot2 = slotsAtPos[idx2];

        // Swap within same team
        const temp = team[slot1];
        team[slot1] = team[slot2];
        team[slot2] = temp;
    }
}

/**
 * Swap players at same position across two teams
 * @param {Array<Array<{playerId, position}>>} teams - Slot-based teams
 * @param {Object} playerPool - PlayerPool instance
 */
export function performCrossTeamSlotSwap(teams, playerPool) {
    if (teams.length < 2) return;

    const t1 = Math.floor(Math.random() * teams.length);
    let t2 = Math.floor(Math.random() * teams.length);
    while (t2 === t1 && teams.length > 1) {
        t2 = Math.floor(Math.random() * teams.length);
    }

    if (teams[t1].length === 0 || teams[t2].length === 0) return;

    // Find common positions
    const positions1 = [...new Set(teams[t1].map(slot => slot.position))];
    const positions2 = [...new Set(teams[t2].map(slot => slot.position))];
    const commonPositions = positions1.filter(pos => positions2.includes(pos));

    if (commonPositions.length === 0) return;

    const position = commonPositions[Math.floor(Math.random() * commonPositions.length)];

    const slots1 = findSlotsByPosition(teams[t1], position);
    const slots2 = findSlotsByPosition(teams[t2], position);

    if (slots1.length > 0 && slots2.length > 0) {
        const slot1 = slots1[Math.floor(Math.random() * slots1.length)];
        const slot2 = slots2[Math.floor(Math.random() * slots2.length)];

        swapSlots(teams, t1, slot1, t2, slot2);
    }
}

/**
 * Universal swap - randomly choose strategy
 * @param {Array<Array<{playerId, position}>>} teams - Slot-based teams
 * @param {Array<string>} positions - Available positions
 * @param {Object} playerPool - PlayerPool instance
 * @param {Object} adaptiveParams - Adaptive parameters
 */
export function performUniversalSlotSwap(teams, positions, playerPool, adaptiveParams) {
    const rand = Math.random();

    if (rand < 0.25) {
        performSlotSwap(teams, positions, playerPool);
    } else if (rand < 0.5) {
        performAdaptiveSlotSwap(teams, positions, playerPool, adaptiveParams);
    } else if (rand < 0.75) {
        performCrossTeamSlotSwap(teams, playerPool);
    } else {
        performPositionSlotSwap(teams, playerPool);
    }
}

/**
 * Calculate team strength from slots
 * @param {Array<{playerId, position}>} team - Slot-based team
 * @param {Object} playerPool - PlayerPool instance
 * @param {Object} positionWeights - Position weights
 * @returns {number} Team strength
 */
function calculateSlotTeamStrength(team, playerPool, positionWeights) {
    let totalStrength = 0;

    team.forEach(slot => {
        const rating = playerPool.getPlayerRating(slot.playerId, slot.position);
        const weight = positionWeights[slot.position] || 1.0;
        totalStrength += rating * weight;
    });

    return totalStrength;
}
