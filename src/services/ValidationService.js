/**
 * ValidationService - Handles all validation logic for team optimization
 * Validates input parameters, player availability, and composition requirements
 */

class ValidationService {
    /**
     * @param {Object} activityConfig - Activity-specific configuration
     */
    constructor(activityConfig) {
        this.activityConfig = activityConfig;
    }

    /**
     * Enhanced validation of input parameters
     * Checks if there are enough players for each position and overall
     * @param {Object} composition - Position composition (e.g., {MB: 2, S: 1, ...})
     * @param {number} teamCount - Number of teams to create
     * @param {Array} players - Available players
     * @returns {Object} Validation result with isValid, errors, and warnings
     */
    validate(composition, teamCount, players) {
        const errors = [];
        const warnings = [];
        let totalNeeded = 0;

        // Validate composition and check player availability for each position
        Object.entries(composition).forEach(([position, count]) => {
            if (count > 0) {
                const needed = count * teamCount;
                const available = players.filter(p =>
                    p.positions && Array.isArray(p.positions) && p.positions.includes(position)
                ).length;

                totalNeeded += needed;

                if (available < needed) {
                    const positionName = this.activityConfig.positions?.[position] || position;
                    errors.push({
                        position,
                        needed,
                        available,
                        message: `Not enough ${positionName}s: need ${needed}, have ${available}`
                    });
                }

                // Warning if barely enough players
                if (available === needed) {
                    const positionName = this.activityConfig.positions?.[position] || position;
                    warnings.push({
                        position,
                        message: `Exactly enough ${positionName}s available (${available}), no flexibility for optimization`
                    });
                }
            }
        });

        // Validate total player count
        if (players.length < totalNeeded) {
            errors.push({
                message: `Not enough total players: need ${totalNeeded}, have ${players.length}`
            });
        }

        // Warning if not much extra players
        const surplus = players.length - totalNeeded;
        if (surplus > 0 && surplus < teamCount) {
            warnings.push({
                message: `Only ${surplus} extra players available, limited optimization flexibility`
            });
        }

        return {
            isValid: errors.length === 0,
            errors,
            warnings,
            totalNeeded,
            totalAvailable: players.length,
            surplus
        };
    }

    /**
     * Validate activity configuration structure
     * @param {Object} activityConfig - Activity configuration to validate
     * @returns {boolean} True if configuration is valid
     */
    validateActivityConfig(activityConfig) {
        if (!activityConfig || typeof activityConfig !== 'object') {
            return false;
        }

        // Required fields
        const requiredFields = ['positions', 'positionOrder', 'defaultComposition', 'positionWeights'];
        for (const field of requiredFields) {
            if (!activityConfig[field]) {
                return false;
            }
        }

        // Validate positions object
        if (typeof activityConfig.positions !== 'object' || Object.keys(activityConfig.positions).length === 0) {
            return false;
        }

        // Validate positionOrder array
        if (!Array.isArray(activityConfig.positionOrder) || activityConfig.positionOrder.length === 0) {
            return false;
        }

        // Validate defaultComposition
        if (typeof activityConfig.defaultComposition !== 'object') {
            return false;
        }

        // Validate positionWeights
        if (typeof activityConfig.positionWeights !== 'object') {
            return false;
        }

        return true;
    }

    /**
     * Validate player data structure
     * @param {Array} players - Players to validate
     * @returns {Object} Validation result
     */
    validatePlayers(players) {
        if (!Array.isArray(players)) {
            return {
                isValid: false,
                errors: [{ message: 'Players must be an array' }]
            };
        }

        const errors = [];
        const warnings = [];

        players.forEach((player, idx) => {
            // Check required fields
            if (!player.id) {
                errors.push({
                    player: idx,
                    message: `Player at index ${idx} missing required field: id`
                });
            }

            if (!player.name) {
                warnings.push({
                    player: idx,
                    message: `Player at index ${idx} missing name`
                });
            }

            if (!player.positions || !Array.isArray(player.positions) || player.positions.length === 0) {
                errors.push({
                    player: idx,
                    message: `Player ${player.name || idx} has no positions defined`
                });
            }

            if (!player.ratings || typeof player.ratings !== 'object') {
                warnings.push({
                    player: idx,
                    message: `Player ${player.name || idx} has no ratings defined`
                });
            }
        });

        return {
            isValid: errors.length === 0,
            errors,
            warnings
        };
    }
}

export default ValidationService;
