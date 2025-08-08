/**
 * Base Filter Class
 * Abstract base class for all analysis filters
 */

class BaseFilter {
    constructor(name, config = {}) {
        this.name = name;
        this.config = config;
        this.stats = {
            processed: 0,
            filtered: 0,
            errors: 0
        };
    }

    /**
     * Process content batch - must be implemented by subclasses
     * @param {Array} contentBatch - Array of content items to process
     * @param {Object} userInterests - User's interest configuration
     * @returns {Promise<Object>} - Processing result with content and metadata
     */
    async process(contentBatch, userInterests) {
        throw new Error(`Process method must be implemented by ${this.constructor.name}`);
    }

    /**
     * Log processing statistics
     */
    logStats() {
        console.log(`${this.name}: ${this.stats.processed} processed, ${this.stats.filtered} filtered, ${this.stats.errors} errors`);
    }

    /**
     * Reset statistics
     */
    resetStats() {
        this.stats = { processed: 0, filtered: 0, errors: 0 };
    }

    /**
     * Get filter statistics
     */
    getStats() {
        return { ...this.stats, name: this.name };
    }

    /**
     * Validate content item has required fields
     */
    validateContent(content) {
        return content &&
            typeof content === 'object' &&
            content.title &&
            content.description;
    }

    /**
     * Parse duration string to seconds
     */
    parseDuration(duration) {
        if (!duration || typeof duration !== 'string') {
            return 0;
        }

        const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
        if (!match) {
            return 0;
        }

        const hours = parseInt(match[1] || '0');
        const minutes = parseInt(match[2] || '0');
        const seconds = parseInt(match[3] || '0');

        return hours * 3600 + minutes * 60 + seconds;
    }

    /**
     * Create standardized filter result
     */
    createResult(content, metadata = {}) {
        return {
            content,
            metadata: {
                filterName: this.name,
                timestamp: new Date().toISOString(),
                stats: this.getStats(),
                ...metadata
            }
        };
    }
}

module.exports = BaseFilter;
