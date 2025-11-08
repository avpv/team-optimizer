/**
 * ValidationService - Handles all validation logic for team optimization
 * Validates input parameters, player availability, and composition requirements
 */

class ValidationService {
    /**
     * @param {Object} sportConfig - Sport-specific configuration
     */
    constructor(sportConfig) {
        this.sportConfig = sportConfig;
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
                    const positionName = this.sportConfig.positions?.[position] || position;
                    errors.push({
                        position,
                        needed,
                        available,
                        message: `Not enough ${positionName}s: need ${needed}, have ${available}`
                    });
                }

                // Warning if barely enough players
                if (available === needed) {
                    const positionName = this.sportConfig.positions?.[position] || position;
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
     * Validate sport configuration structure
     * @param {Object} sportConfig - Sport configuration to validate
     * @returns {boolean} True if configuration is valid
     */
    validateSportConfig(sportConfig) {
        if (!sportConfig || typeof sportConfig !== 'object') {
            return false;
        }

        // Required fields
        const requiredFields = ['positions', 'positionOrder', 'defaultComposition', 'positionWeights'];
        for (const field of requiredFields) {
            if (!sportConfig[field]) {
                console.warn(`Sport config missing required field: ${field}`);
                return false;
            }
        }

        // Validate positions object
        if (typeof sportConfig.positions !== 'object' || Object.keys(sportConfig.positions).length === 0) {
            console.warn('Sport config positions must be a non-empty object');
            return false;
        }

        // Validate positionOrder array
        if (!Array.isArray(sportConfig.positionOrder) || sportConfig.positionOrder.length === 0) {
            console.warn('Sport config positionOrder must be a non-empty array');
            return false;
        }

        // Validate defaultComposition
        if (typeof sportConfig.defaultComposition !== 'object') {
            console.warn('Sport config defaultComposition must be an object');
            return false;
        }

        // Validate positionWeights
        if (typeof sportConfig.positionWeights !== 'object') {
            console.warn('Sport config positionWeights must be an object');
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
