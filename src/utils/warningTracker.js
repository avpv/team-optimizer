/**
 * Utility for tracking and deduplicating console warnings
 * Prevents warning spam by limiting warnings per key per time interval
 */

class WarningTracker {
    constructor(resetInterval = 5000) {
        this.counts = new Map();
        this.lastReset = Date.now();
        this.resetInterval = resetInterval; // Reset interval in milliseconds
    }

    /**
     * Check if a warning should be displayed for a given key
     * Returns true only once per key per reset interval
     * @param {string} key - Unique identifier for the warning type
     * @returns {boolean} True if warning should be shown, false otherwise
     */
    shouldWarn(key) {
        const now = Date.now();

        // Reset counts if interval has elapsed
        if (now - this.lastReset > this.resetInterval) {
            this.counts.clear();
            this.lastReset = now;
        }

        const count = this.counts.get(key) || 0;
        this.counts.set(key, count + 1);

        // Only warn once per key per reset interval
        return count === 0;
    }

    /**
     * Reset all warning counts immediately
     */
    reset() {
        this.counts.clear();
        this.lastReset = Date.now();
    }

    /**
     * Get the current count for a specific warning key
     * @param {string} key - Warning key to check
     * @returns {number} Number of times this warning was triggered
     */
    getCount(key) {
        return this.counts.get(key) || 0;
    }
}

// Export singleton instance for backward compatibility
export const warningTracker = new WarningTracker();

// Export class for creating custom instances
export default WarningTracker;
