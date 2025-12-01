/**
 * PlayerPool - Centralized player storage and management
 *
 * This class eliminates duplicate player issues by maintaining a single source
 * of truth for all players. Teams reference players by ID rather than copying
 * player objects.
 *
 * Architecture:
 * - PlayerPool: Map<playerId, playerObject> - single source of truth
 * - Team Structure: Array<{playerId, position}> - lightweight references
 * - No duplicate player objects in memory
 * - Physically impossible to have duplicate player IDs in teams
 */

class PlayerPool {
    constructor(players = []) {
        // Single source of truth: ID -> Player object
        this.players = new Map();

        // Quick lookup: Position -> Array of player IDs
        this.playersByPosition = new Map();

        // Add all players
        players.forEach(player => this.addPlayer(player));
    }

    /**
     * Add a player to the pool
     * @param {Object} player - Player object with id, positions, ratings, etc.
     */
    addPlayer(player) {
        if (!player.id) {
            throw new Error('Player must have an id');
        }

        // Store in main pool
        this.players.set(player.id, player);

        // Index by positions
        if (player.positions && Array.isArray(player.positions)) {
            player.positions.forEach(position => {
                if (!this.playersByPosition.has(position)) {
                    this.playersByPosition.set(position, []);
                }
                if (!this.playersByPosition.get(position).includes(player.id)) {
                    this.playersByPosition.get(position).push(player.id);
                }
            });
        }
    }

    /**
     * Get a player by ID
     * @param {number|string} playerId - Player ID
     * @returns {Object|undefined} Player object or undefined
     */
    getPlayer(playerId) {
        return this.players.get(playerId);
    }

    /**
     * Get all player IDs that can play a position
     * @param {string} position - Position code (e.g., 'S', 'OH', 'MB')
     * @returns {Array<number>} Array of player IDs
     */
    getPlayerIdsForPosition(position) {
        return this.playersByPosition.get(position) || [];
    }

    /**
     * Get all players (as array)
     * @returns {Array<Object>} Array of player objects
     */
    getAllPlayers() {
        return Array.from(this.players.values());
    }

    /**
     * Check if a player can play a position
     * @param {number} playerId - Player ID
     * @param {string} position - Position code
     * @returns {boolean} True if player can play position
     */
    canPlayPosition(playerId, position) {
        const player = this.getPlayer(playerId);
        return player && player.positions && player.positions.includes(position);
    }

    /**
     * Get player's rating for a position
     * @param {number} playerId - Player ID
     * @param {string} position - Position code
     * @returns {number} Rating or default 1500
     */
    getPlayerRating(playerId, position) {
        const player = this.getPlayer(playerId);
        if (!player) return 1500;
        return player.ratings?.[position] || 1500;
    }

    /**
     * Resolve a team slot to full player object with assigned position
     * @param {{playerId: number, position: string}} slot - Team slot
     * @returns {Object} Player object with assignedPosition and positionRating
     */
    resolveSlot(slot) {
        const player = this.getPlayer(slot.playerId);
        if (!player) {
            throw new Error(`Player ${slot.playerId} not found in pool`);
        }

        return {
            ...player,
            assignedPosition: slot.position,
            positionRating: this.getPlayerRating(slot.playerId, slot.position)
        };
    }

    /**
     * Resolve an entire team (array of slots) to player objects
     * @param {Array<{playerId, position}>} team - Team as array of slots
     * @returns {Array<Object>} Array of resolved player objects
     */
    resolveTeam(team) {
        return team.map(slot => this.resolveSlot(slot));
    }

    /**
     * Resolve multiple teams
     * @param {Array<Array<{playerId, position}>>} teams - Array of teams
     * @returns {Array<Array<Object>>} Array of resolved teams
     */
    resolveTeams(teams) {
        return teams.map(team => this.resolveTeam(team));
    }

    /**
     * Create a team slot
     * @param {number} playerId - Player ID
     * @param {string} position - Position code
     * @returns {{playerId: number, position: string}} Team slot
     */
    static createSlot(playerId, position) {
        return { playerId, position };
    }

    /**
     * Get player count
     * @returns {number} Total number of players in pool
     */
    getPlayerCount() {
        return this.players.size;
    }
}

export default PlayerPool;
