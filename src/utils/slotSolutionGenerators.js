/**
 * Solution Generators for Slot-Based Team Structure
 *
 * Generates initial team solutions using the new architecture:
 * - No duplicate player objects
 * - Teams are arrays of {playerId, position} slots
 * - PlayerPool provides single source of truth
 */

/**
 * Calculate position scarcity for smart allocation
 * @param {Object} composition - Position requirements
 * @param {number} teamCount - Number of teams
 * @param {Object} playerPool - PlayerPool instance
 * @param {Set} usedIds - Already allocated player IDs
 * @returns {Object} Position scarcity scores
 */
function calculatePositionScarcity(composition, teamCount, playerPool, usedIds) {
    const scarcity = {};

    Object.entries(composition).forEach(([position, neededPerTeam]) => {
        if (!neededPerTeam || neededPerTeam === 0) {
            scarcity[position] = Infinity;
            return;
        }

        const totalNeeded = neededPerTeam * teamCount;
        const availableIds = playerPool.getPlayerIdsForPosition(position)
            .filter(id => !usedIds.has(id));
        const availableCount = availableIds.length;

        scarcity[position] = availableCount / totalNeeded;
    });

    return scarcity;
}

/**
 * Create a smart solution using slot-based structure
 * @param {Object} composition - Position composition
 * @param {number} teamCount - Number of teams
 * @param {Object} playerPool - PlayerPool instance
 * @param {boolean} randomize - Add randomization
 * @returns {Array<Array<{playerId, position}>>} Slot-based teams
 */
export function createSmartSlotSolution(composition, teamCount, playerPool, randomize = false) {
    const teams = Array.from({ length: teamCount }, () => []);
    const usedIds = new Set();

    const positionsNeeded = Object.entries(composition)
        .filter(([, count]) => count && count > 0)
        .map(([pos, count]) => ({ position: pos, count }));

    // Phase 1: Allocate specialist players (one position only)
    positionsNeeded.forEach(({ position, count: neededCount }) => {
        const playerIds = playerPool.getPlayerIdsForPosition(position)
            .filter(id => {
                const player = playerPool.getPlayer(id);
                return !usedIds.has(id) && player.positions.length === 1;
            })
            .sort((a, b) => {
                const aRating = playerPool.getPlayerRating(a, position);
                const bRating = playerPool.getPlayerRating(b, position);
                if (randomize) {
                    return (bRating + (Math.random() - 0.5) * 30) - (aRating + (Math.random() - 0.5) * 30);
                }
                return bRating - aRating;
            });

        let playerIdx = 0;
        for (let teamIdx = 0; teamIdx < teamCount && playerIdx < playerIds.length; teamIdx++) {
            for (let slot = 0; slot < neededCount && playerIdx < playerIds.length; slot++) {
                const currentCount = teams[teamIdx].filter(s => s.position === position).length;
                if (currentCount < neededCount) {
                    teams[teamIdx].push({ playerId: playerIds[playerIdx], position });
                    usedIds.add(playerIds[playerIdx]);
                    playerIdx++;
                }
            }
        }
    });

    // Phase 2: Allocate multi-position players based on scarcity
    let maxIterations = 200;
    let iteration = 0;

    while (iteration < maxIterations) {
        iteration++;
        let madeProgress = false;

        const scarcity = calculatePositionScarcity(composition, teamCount, playerPool, usedIds);
        const positionsByScarcity = positionsNeeded
            .map(({ position }) => ({ position, scarcity: scarcity[position] }))
            .filter(({ scarcity }) => scarcity < Infinity)
            .sort((a, b) => a.scarcity - b.scarcity);

        for (const { position } of positionsByScarcity) {
            const neededCount = composition[position];

            let needsMore = false;
            for (let teamIdx = 0; teamIdx < teamCount; teamIdx++) {
                const currentCount = teams[teamIdx].filter(s => s.position === position).length;
                if (currentCount < neededCount) {
                    needsMore = true;
                    break;
                }
            }

            if (!needsMore) continue;

            const availablePlayerIds = playerPool.getPlayerIdsForPosition(position)
                .filter(id => !usedIds.has(id))
                .sort((a, b) => {
                    const playerA = playerPool.getPlayer(a);
                    const playerB = playerPool.getPlayer(b);

                    if (playerA.positions.length !== playerB.positions.length) {
                        return playerA.positions.length - playerB.positions.length;
                    }

                    const aRating = playerPool.getPlayerRating(a, position);
                    const bRating = playerPool.getPlayerRating(b, position);
                    if (randomize) {
                        return (bRating + (Math.random() - 0.5) * 30) - (aRating + (Math.random() - 0.5) * 30);
                    }
                    return bRating - aRating;
                });

            if (availablePlayerIds.length === 0) continue;

            for (let teamIdx = 0; teamIdx < teamCount && availablePlayerIds.length > 0; teamIdx++) {
                const currentCount = teams[teamIdx].filter(s => s.position === position).length;

                if (currentCount < neededCount) {
                    const playerId = availablePlayerIds.shift();
                    teams[teamIdx].push({ playerId, position });
                    usedIds.add(playerId);
                    madeProgress = true;
                }
            }
        }

        if (!madeProgress) break;
    }

    return teams;
}

/**
 * Create greedy solution (strongest players first)
 * @param {Object} composition - Position composition
 * @param {number} teamCount - Number of teams
 * @param {Object} playerPool - PlayerPool instance
 * @param {boolean} randomize - Add randomization
 * @returns {Array<Array<{playerId, position}>>} Slot-based teams
 */
export function createGreedySlotSolution(composition, teamCount, playerPool, randomize = false) {
    const teams = Array.from({ length: teamCount }, () => []);
    const usedIds = new Set();

    const positionPriority = ['MB', 'S', 'L', 'OPP', 'OH'];
    let positionOrder = positionPriority
        .map(pos => [pos, composition[pos]])
        .filter(([, count]) => count && count > 0);

    if (randomize) {
        for (let i = positionOrder.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [positionOrder[i], positionOrder[j]] = [positionOrder[j], positionOrder[i]];
        }
    }

    positionOrder.forEach(([position, neededCount]) => {
        const playerIds = playerPool.getPlayerIdsForPosition(position)
            .filter(id => !usedIds.has(id))
            .sort((a, b) => {
                const aRating = playerPool.getPlayerRating(a, position);
                const bRating = playerPool.getPlayerRating(b, position);
                if (randomize) {
                    return (bRating + (Math.random() - 0.5) * 50) - (aRating + (Math.random() - 0.5) * 50);
                }
                return bRating - aRating;
            });

        let playerIdx = 0;
        for (let teamIdx = 0; teamIdx < teamCount; teamIdx++) {
            for (let slot = 0; slot < neededCount; slot++) {
                if (playerIdx < playerIds.length) {
                    teams[teamIdx].push({ playerId: playerIds[playerIdx], position });
                    usedIds.add(playerIds[playerIdx]);
                    playerIdx++;
                }
            }
        }
    });

    return teams;
}

/**
 * Create balanced solution (round-robin)
 * @param {Object} composition - Position composition
 * @param {number} teamCount - Number of teams
 * @param {Object} playerPool - PlayerPool instance
 * @param {boolean} randomize - Add randomization
 * @returns {Array<Array<{playerId, position}>>} Slot-based teams
 */
export function createBalancedSlotSolution(composition, teamCount, playerPool, randomize = false) {
    const teams = Array.from({ length: teamCount }, () => []);
    const usedIds = new Set();

    const positionPriority = ['MB', 'S', 'L', 'OPP', 'OH'];
    let positionOrder = positionPriority
        .map(pos => [pos, composition[pos]])
        .filter(([, count]) => count && count > 0);

    if (randomize) {
        for (let i = positionOrder.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [positionOrder[i], positionOrder[j]] = [positionOrder[j], positionOrder[i]];
        }
    }

    positionOrder.forEach(([position, neededCount]) => {
        const playerIds = playerPool.getPlayerIdsForPosition(position)
            .filter(id => !usedIds.has(id))
            .sort((a, b) => {
                const aRating = playerPool.getPlayerRating(a, position);
                const bRating = playerPool.getPlayerRating(b, position);
                if (randomize) {
                    return (bRating + (Math.random() - 0.5) * 40) - (aRating + (Math.random() - 0.5) * 40);
                }
                return bRating - aRating;
            });

        let playerIdx = 0;
        const startOffset = randomize ? Math.floor(Math.random() * teamCount) : 0;

        for (let round = 0; round < neededCount; round++) {
            for (let i = 0; i < teamCount; i++) {
                const teamIdx = (i + startOffset) % teamCount;
                if (playerIdx < playerIds.length) {
                    teams[teamIdx].push({ playerId: playerIds[playerIdx], position });
                    usedIds.add(playerIds[playerIdx]);
                    playerIdx++;
                }
            }
        }
    });

    return teams;
}

/**
 * Create snake draft solution
 * @param {Object} composition - Position composition
 * @param {number} teamCount - Number of teams
 * @param {Object} playerPool - PlayerPool instance
 * @param {boolean} randomize - Add randomization
 * @returns {Array<Array<{playerId, position}>>} Slot-based teams
 */
export function createSnakeDraftSlotSolution(composition, teamCount, playerPool, randomize = false) {
    const teams = Array.from({ length: teamCount }, () => []);
    const usedIds = new Set();

    const positionPriority = ['MB', 'S', 'L', 'OPP', 'OH'];
    let positionOrder = positionPriority
        .map(pos => [pos, composition[pos]])
        .filter(([, count]) => count && count > 0);

    if (randomize) {
        for (let i = positionOrder.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [positionOrder[i], positionOrder[j]] = [positionOrder[j], positionOrder[i]];
        }
    }

    positionOrder.forEach(([position, neededCount]) => {
        const playerIds = playerPool.getPlayerIdsForPosition(position)
            .filter(id => !usedIds.has(id))
            .sort((a, b) => {
                const playerA = playerPool.getPlayer(a);
                const playerB = playerPool.getPlayer(b);

                const aSpecialist = playerA.positions.length === 1 ? 1 : 0;
                const bSpecialist = playerB.positions.length === 1 ? 1 : 0;
                if (aSpecialist !== bSpecialist) return bSpecialist - aSpecialist;

                const aRating = playerPool.getPlayerRating(a, position);
                const bRating = playerPool.getPlayerRating(b, position);
                if (randomize) {
                    return (bRating + (Math.random() - 0.5) * 30) - (aRating + (Math.random() - 0.5) * 30);
                }
                return bRating - aRating;
            });

        let playerIdx = 0;
        let round = randomize && Math.random() > 0.5 ? 1 : 0;

        while (playerIdx < playerIds.length) {
            const isReverseRound = round % 2 === 1;

            for (let slotInRound = 0; slotInRound < teamCount; slotInRound++) {
                const teamIdx = isReverseRound ? (teamCount - 1 - slotInRound) : slotInRound;
                const currentCount = teams[teamIdx].filter(s => s.position === position).length;

                if (currentCount < neededCount && playerIdx < playerIds.length) {
                    teams[teamIdx].push({ playerId: playerIds[playerIdx], position });
                    usedIds.add(playerIds[playerIdx]);
                    playerIdx++;
                }
            }
            round++;

            if (round > 100) break;
        }
    });

    return teams;
}

/**
 * Create random solution
 * @param {Object} composition - Position composition
 * @param {number} teamCount - Number of teams
 * @param {Object} playerPool - PlayerPool instance
 * @returns {Array<Array<{playerId, position}>>} Slot-based teams
 */
export function createRandomSlotSolution(composition, teamCount, playerPool) {
    const teams = Array.from({ length: teamCount }, () => []);
    const usedIds = new Set();

    const positionPriority = ['MB', 'S', 'L', 'OPP', 'OH'];
    const positionOrder = positionPriority
        .map(pos => [pos, composition[pos]])
        .filter(([, count]) => count && count > 0);

    positionOrder.forEach(([position, neededCount]) => {
        if (neededCount === 0) return;

        const playerIds = playerPool.getPlayerIdsForPosition(position)
            .filter(id => !usedIds.has(id));

        // Shuffle
        for (let i = playerIds.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [playerIds[i], playerIds[j]] = [playerIds[j], playerIds[i]];
        }

        let playerIdx = 0;
        for (let teamIdx = 0; teamIdx < teamCount; teamIdx++) {
            for (let slot = 0; slot < neededCount; slot++) {
                if (playerIdx < playerIds.length) {
                    teams[teamIdx].push({ playerId: playerIds[playerIdx], position });
                    usedIds.add(playerIds[playerIdx]);
                    playerIdx++;
                }
            }
        }
    });

    return teams;
}

/**
 * Generate multiple initial solutions
 * @param {Object} composition - Position composition
 * @param {number} teamCount - Number of teams
 * @param {Object} playerPool - PlayerPool instance
 * @returns {Array<Array<Array<{playerId, position}>>>} Array of initial solutions
 */
export function generateInitialSlotSolutions(composition, teamCount, playerPool) {
    return [
        createSmartSlotSolution(composition, teamCount, playerPool, false),
        createSmartSlotSolution(composition, teamCount, playerPool, true),
        createGreedySlotSolution(composition, teamCount, playerPool, true),
        createBalancedSlotSolution(composition, teamCount, playerPool, true),
        createSnakeDraftSlotSolution(composition, teamCount, playerPool, true),
        createRandomSlotSolution(composition, teamCount, playerPool)
    ];
}
