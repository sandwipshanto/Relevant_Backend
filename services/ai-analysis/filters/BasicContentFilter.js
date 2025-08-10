/**
 * Basic Content Filter
 * Removes obviously irrelevant content based on basic criteria
 */

const BaseFilter = require('./BaseFilter');
const KeywordsConfig = require('../config/KeywordsConfig');
const AnalysisConfig = require('../config/AnalysisConfig');

class BasicContentFilter extends BaseFilter {
    constructor() {
        super('BasicContentFilter', AnalysisConfig.thresholds);
        this.irrelevantKeywords = KeywordsConfig.irrelevantKeywords;
        this.qualityIndicators = KeywordsConfig.qualityIndicators;
        this.professionalDomains = KeywordsConfig.professionalDomains;
    }

    async process(contentBatch, userInterests) {
        console.log(`🔍 Basic filtering ${contentBatch.length} items...`);

        const filtered = contentBatch.filter(content => this.passesBasicFilter(content));

        this.stats.processed = contentBatch.length;
        this.stats.filtered = contentBatch.length - filtered.length;

        console.log(`✅ Basic filter: ${filtered.length}/${contentBatch.length} passed`);

        return this.createResult(filtered, {
            originalCount: contentBatch.length,
            filteredCount: filtered.length,
            filterCriteria: {
                titleLength: this.config.minTitleRelevance,
                descriptionLength: `${this.config.minDescriptionLength}-${this.config.maxDescriptionLength}`,
                duration: `${this.config.minDurationSeconds}-${this.config.maxDurationSeconds}s`
            }
        });
    }

    passesBasicFilter(content) {
        try {
            // Basic validation
            if (!this.validateContent(content)) {
                this.logFilterReason(content, 'Invalid content structure');
                return false;
            }

            // Title length check
            if (!content.title || content.title.length < 10) {
                this.logFilterReason(content, 'Title too short');
                return false;
            }

            // Description length check - be more lenient for videos with good titles
            if (!content.description) {
                content.description = ''; // Handle missing descriptions
            }
            
            // Allow shorter descriptions if title has quality indicators
            const title = content.title.toLowerCase();
            const hasQualityTitle = this.qualityIndicators.some(indicator => 
                title.includes(indicator.toLowerCase())
            ) || this.professionalDomains.some(domain => 
                title.includes(domain.toLowerCase())
            );
            
            const minDescLength = hasQualityTitle ? 0 : this.config.minDescriptionLength;
            
            if (content.description.length < minDescLength) {
                this.logFilterReason(content, `Description too short (${content.description.length} chars, need ${minDescLength})`);
                return false;
            }

            if (content.description.length > this.config.maxDescriptionLength) {
                this.logFilterReason(content, 'Description too long');
                return false;
            }

            const text = (content.title + ' ' + content.description).toLowerCase();

            // Filter out irrelevant content
            if (this.hasIrrelevantKeywords(text)) {
                this.logFilterReason(content, 'Contains irrelevant keywords');
                return false;
            }

            // Duration filtering
            if (content.duration && !this.isValidDuration(content.duration)) {
                const duration = this.parseDuration(content.duration);
                this.logFilterReason(content, `Duration out of range: ${duration}s`);
                return false;
            }

            // Must have quality indicators, professional content, or high engagement
            if (!this.hasQualityIndicators(text, content)) {
                this.logFilterReason(content, 'No quality indicators');
                return false;
            }

            return true;

        } catch (error) {
            console.error(`Error filtering content "${content.title}":`, error.message);
            this.stats.errors++;
            return false;
        }
    }

    hasIrrelevantKeywords(text) {
        return this.irrelevantKeywords.some(keyword =>
            text.includes(keyword.toLowerCase())
        );
    }

    isValidDuration(duration) {
        const durationSeconds = this.parseDuration(duration);
        return durationSeconds >= this.config.minDurationSeconds &&
            durationSeconds <= this.config.maxDurationSeconds;
    }

    hasQualityIndicators(text, content) {
        // Check for quality indicators
        const hasQualityKeywords = this.qualityIndicators.some(indicator =>
            text.includes(indicator.toLowerCase())
        );

        // Check for professional domains
        const hasProfessionalContent = this.professionalDomains.some(domain =>
            text.includes(domain.toLowerCase())
        );

        // Check engagement metrics
        const hasEngagement = content.viewCount && content.viewCount > 10000;

        return hasQualityKeywords || hasProfessionalContent || hasEngagement;
    }

    logFilterReason(content, reason) {
        if (process.env.DEBUG_FILTERS) {
            console.log(`[FILTERED] ${reason}: ${content.title}`);
        }
    }

    getFilterStats() {
        return {
            ...this.getStats(),
            criteria: {
                irrelevantKeywords: this.irrelevantKeywords.length,
                qualityIndicators: this.qualityIndicators.length,
                professionalDomains: this.professionalDomains.length
            }
        };
    }
}

module.exports = BasicContentFilter;
