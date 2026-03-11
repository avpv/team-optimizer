/**
 * Slot-Based Swap Operations
 *
 * Swap operations for the slot-based team structure.
 * Key advantages:
 * - No duplicate validation needed (impossible by structure)
 * - Much faster (swapping IDs, not objects)
 * - Cleaner code (no complex validation logic)
 *
 * 4 effective operators (removed no-op and duplicate from original):
 * 1. Adaptive: strongest ↔ weakest team, full variance-checked
 * 2. Random cross-team: exploration
 * 3. Position-targeted: balance the most imbalanced position
 * 4. Chain swap: cyclic 3-team exchange
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

    const slots1 = findSlotsByPosition(teams[t1], pos);
    const slots2 = findSlotsByPosition(teams[t2], pos);

    if (slots1.length > 0 && slots2.length > 0) {
        const idx1 = slots1[Math.floor(Math.random() * slots1.length)];
        const idx2 = slots2[Math.floor(Math.random() * slots2.length)];
        swapSlots(teams, t1, idx1, t2, idx2);
    }
}

/**
 * Perform adaptive swap between strongest and weakest teams.
 * Uses FULL variance check (not just max-min) to decide if swap improves balance.
 *
 * @param {Array<Array<{playerId, position}>>} teams - Slot-based teams
 * @param {Array<string>} positions - Available positions
 * @param {Object} playerPool - PlayerPool instance
 * @param {Object} adaptiveParams - Adaptive parameters
 */
export function performAdaptiveSlotSwap(teams, positions, playerPool, adaptiveParams) {
    if (teams.length < 2) return;

    const positionWeights = adaptiveParams.positionWeights || {};

    // Calculate team strengths with full variance
    const teamStrengths = teams.map((team, idx) => ({
        idx,
        strength: calculateSlotTeamStrength(team, playerPool, positionWeights)
    }));

    const avg = teamStrengths.reduce((s, t) => s + t.strength, 0) / teams.length;
    const currentVariance = teamStrengths.reduce((s, t) =>
        s + (t.strength - avg) ** 2, 0) / teams.length;

    teamStrengths.sort((a, b) => b.strength - a.strength);
    const strongIdx = teamStrengths[0].idx;
    const weakIdx = teamStrengths[teamStrengths.length - 1].idx;

    if (strongIdx === weakIdx) {
        return performSlotSwap(teams, positions, playerPool);
    }

    const pos = positions[Math.floor(Math.random() * positions.length)];
    const strongSlots = findSlotsByPosition(teams[strongIdx], pos);
    const weakSlots = findSlotsByPosition(teams[weakIdx], pos);

    if (strongSlots.length === 0 || weakSlots.length === 0) {
        return performSlotSwap(teams, positions, playerPool);
    }

    // Find best in strong team, worst in weak team
    const bestIdx = strongSlots.reduce((best, i) => {
        const r = playerPool.getPlayerRating(teams[strongIdx][i].playerId, pos);
        return r > best.r ? { i, r } : best;
    }, { i: -1, r: -Infinity }).i;

    const worstIdx = weakSlots.reduce((worst, i) => {
        const r = playerPool.getPlayerRating(teams[weakIdx][i].playerId, pos);
        return r < worst.r ? { i, r } : worst;
    }, { i: -1, r: Infinity }).i;

    if (bestIdx === -1 || worstIdx === -1) return;

    const weight = positionWeights[pos] || 1.0;
    const bestR = playerPool.getPlayerRating(teams[strongIdx][bestIdx].playerId, pos) * weight;
    const worstR = playerPool.getPlayerRating(teams[weakIdx][worstIdx].playerId, pos) * weight;
    const delta = bestR - worstR;

    if (delta <= 0) return performSlotSwap(teams, positions, playerPool);

    // Check if swap improves FULL variance
    const newStrengths = teamStrengths.map(t => {
        if (t.idx === strongIdx) return { ...t, strength: t.strength - delta };
        if (t.idx === weakIdx) return { ...t, strength: t.strength + delta };
        return t;
    });
    const newAvg = newStrengths.reduce((s, t) => s + t.strength, 0) / teams.length;
    const newVariance = newStrengths.reduce((s, t) =>
        s + (t.strength - newAvg) ** 2, 0) / teams.length;

    if (newVariance < currentVariance) {
        swapSlots(teams, strongIdx, bestIdx, weakIdx, worstIdx);
    } else {
        performSlotSwap(teams, positions, playerPool);
    }
}

/**
 * Position-targeted swap: find the most imbalanced position and swap to fix it.
 * @param {Array<Array<{playerId, position}>>} teams - Slot-based teams
 * @param {Array<string>} positions - Available positions
 * @param {Object} playerPool - PlayerPool instance
 * @param {Object} adaptiveParams - Adaptive parameters
 */
export function performPositionTargetedSwap(teams, positions, playerPool, adaptiveParams) {
    if (teams.length < 2) return;
    const positionWeights = adaptiveParams.positionWeights || {};

    // Find position with maximum weighted variance between teams
    let worstPosition = null;
    let worstVariance = 0;

    for (const pos of positions) {
        const teamAvgs = teams.map(team => {
            const slots = team.filter(s => s.position === pos);
            if (slots.length === 0) return 0;
            return slots.reduce((sum, s) =>
                sum + playerPool.getPlayerRating(s.playerId, pos), 0) / slots.length;
        });

        const avg = teamAvgs.reduce((a, b) => a + b, 0) / teams.length;
        const variance = teamAvgs.reduce((s, v) => s + (v - avg) ** 2, 0) / teams.length;
        const weight = positionWeights[pos] || 1.0;

        if (variance * weight > worstVariance) {
            worstVariance = variance * weight;
            worstPosition = pos;
        }
    }

    if (!worstPosition) return;

    // Swap best player from strongest team ↔ worst player from weakest team AT THIS POSITION
    const teamStrengths = teams.map((team, idx) => {
        const slots = team.filter(s => s.position === worstPosition);
        const strength = slots.reduce((sum, s) =>
            sum + playerPool.getPlayerRating(s.playerId, worstPosition), 0);
        return { idx, strength, slots };
    }).sort((a, b) => b.strength - a.strength);

    const strong = teamStrengths[0];
    const weak = teamStrengths[teamStrengths.length - 1];

    if (strong.slots.length === 0 || weak.slots.length === 0) return;

    const bestSlotIdx = strong.slots.reduce((best, s) => {
        const idx = teams[strong.idx].indexOf(s);
        const rating = playerPool.getPlayerRating(s.playerId, worstPosition);
        return rating > best.rating ? { idx, rating } : best;
    }, { idx: -1, rating: -Infinity }).idx;

    const worstSlotIdx = weak.slots.reduce((worst, s) => {
        const idx = teams[weak.idx].indexOf(s);
        const rating = playerPool.getPlayerRating(s.playerId, worstPosition);
        return rating < worst.rating ? { idx, rating } : worst;
    }, { idx: -1, rating: Infinity }).idx;

    if (bestSlotIdx !== -1 && worstSlotIdx !== -1) {
        swapSlots(teams, strong.idx, bestSlotIdx, weak.idx, worstSlotIdx);
    }
}

/**
 * Chain swap: cyclic exchange between 3 teams (A→B, B→C, C→A).
 * Explores moves unreachable by pairwise swaps.
 *
 * @param {Array<Array<{playerId, position}>>} teams - Slot-based teams
 * @param {Array<string>} positions - Available positions
 * @param {Object} playerPool - PlayerPool instance
 */
export function performChainSlotSwap(teams, positions, playerPool) {
    if (teams.length < 3) return performSlotSwap(teams, positions, playerPool);

    // Select 3 random teams
    const indices = [];
    while (indices.length < 3) {
        const idx = Math.floor(Math.random() * teams.length);
        if (!indices.includes(idx)) indices.push(idx);
    }

    const pos = positions[Math.floor(Math.random() * positions.length)];

    // Find one player at this position in each team
    const slots = indices.map(idx => {
        const posSlots = teams[idx]
            .map((s, i) => ({ ...s, slotIdx: i }))
            .filter(s => s.position === pos);
        if (posSlots.length === 0) return null;
        return { teamIdx: idx, slotIdx: posSlots[Math.floor(Math.random() * posSlots.length)].slotIdx };
    });

    if (slots.some(s => s === null)) return;

    // Cyclic exchange: A→B, B→C, C→A
    const temp = teams[slots[0].teamIdx][slots[0].slotIdx];
    teams[slots[0].teamIdx][slots[0].slotIdx] = teams[slots[2].teamIdx][slots[2].slotIdx];
    teams[slots[2].teamIdx][slots[2].slotIdx] = teams[slots[1].teamIdx][slots[1].slotIdx];
    teams[slots[1].teamIdx][slots[1].slotIdx] = temp;
}

/**
 * Universal swap - randomly choose from 4 effective strategies.
 *
 * Distribution:
 *   40% Adaptive (strong↔weak, variance-checked)
 *   30% Random cross-team (exploration)
 *   20% Position-targeted (fix most imbalanced position)
 *   10% Chain swap (3-team cyclic, reachable only this way)
 *
 * @param {Array<Array<{playerId, position}>>} teams - Slot-based teams
 * @param {Array<string>} positions - Available positions
 * @param {Object} playerPool - PlayerPool instance
 * @param {Object} adaptiveParams - Adaptive parameters
 */
export function performUniversalSlotSwap(teams, positions, playerPool, adaptiveParams) {
    const rand = Math.random();

    if (rand < 0.40) {
        performAdaptiveSlotSwap(teams, positions, playerPool, adaptiveParams);
    } else if (rand < 0.70) {
        performSlotSwap(teams, positions, playerPool);
    } else if (rand < 0.90) {
        performPositionTargetedSwap(teams, positions, playerPool, adaptiveParams);
    } else {
        performChainSlotSwap(teams, positions, playerPool);
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
