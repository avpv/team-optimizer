// src/services/optimizer/IOptimizer.js

/**
 * Base interface/class for all optimization algorithms.
 * Each optimizer must implement the solve() method.
 */
class IOptimizer {
    /**
     * @param {Object} config - Algorithm-specific configuration
     */
    constructor(config) {
        this.config = config;
    }

    /**
     * Solve the optimization problem and return the best solution.
     *
     * SLOT-BASED ARCHITECTURE:
     * Teams are represented as arrays of slots: [{playerId, position}, ...]
     * PlayerPool maintains the single source of truth for all player data.
     *
     * @param {Object} problemContext - Context containing:
     *   - initialSolution: Array of slot-based teams or array of solutions
     *   - composition: Position composition requirements (e.g., {S: 1, OH: 2, MB: 2})
     *   - teamCount: Number of teams to create
     *   - playerPool: PlayerPool instance (single source of truth)
     *   - positions: Array of position keys (e.g., ['S', 'OH', 'MB'])
     *   - positionWeights: Position weights for evaluation (e.g., {S: 1.2, OH: 1.0})
     * @returns {Promise<Array>} Best slot-based solution found (array of slot-based teams)
     */
    async solve(problemContext) {
        throw new Error('Method solve() must be implemented by subclass');
    }

    /**
     * Get algorithm-specific statistics
     * @returns {Object} Statistics object
     */
    getStatistics() {
        return {
            iterations: 0,
            improvements: 0
        };
    }
}

export default IOptimizer;
