/**
 * Keyword Relevance Filter
 * Filters content based on keyword matching with user interests
 */

const BaseFilter = require('./BaseFilter');
const AnalysisConfig = require('../config/AnalysisConfig');

class KeywordRelevanceFilter extends BaseFilter {
    constructor() {
        super('KeywordRelevanceFilter', AnalysisConfig.thresholds);
    }

    async process(contentBatch, userInterests) {
        console.log(`🔍 Keyword filtering ${contentBatch.length} items...`);

        const enrichedContent = contentBatch.map(content =>
            this.enrichWithKeywordRelevance(content, userInterests)
        );

        const filtered = enrichedContent.filter(content =>
            content.keywordRelevance >= this.config.minTitleRelevance
        );

        this.stats.processed = contentBatch.length;
        this.stats.filtered = contentBatch.length - filtered.length;

        console.log(`✅ Keyword filter: ${filtered.length}/${contentBatch.length} passed`);

        return this.createResult(filtered, {
            originalCount: contentBatch.length,
            filteredCount: filtered.length,
            averageRelevance: this.calculateAverageRelevance(enrichedContent),
            threshold: this.config.minTitleRelevance
        });
    }

    enrichWithKeywordRelevance(content, userInterests) {
        const relevanceScore = this.calculateKeywordRelevance(content, userInterests);

        return {
            ...content,
            keywordRelevance: relevanceScore,
            keywordMatches: this.getKeywordMatches(content, userInterests)
        };
    }

    calculateKeywordRelevance(content, userInterests) {
        const text = (content.title + ' ' + content.description).toLowerCase();
        let totalScore = 0;
        let matchCount = 0;
        let subcategoryCount = 0;

        const interests = Array.isArray(userInterests) ? userInterests : Object.keys(userInterests || {});

        for (const interest of interests) {
            const interestData = typeof userInterests === 'object' && !Array.isArray(userInterests)
                ? userInterests[interest]
                : { priority: 5, keywords: [] };

            // Main interest match
            if (text.includes(interest.toLowerCase())) {
                totalScore += (interestData.priority || 5) * 0.1;
                matchCount++;
            }

            // Keyword matches
            const keywords = interestData.keywords || [];
            for (const keyword of keywords) {
                if (text.includes(keyword.toLowerCase())) {
                    totalScore += (interestData.priority || 5) * 0.05;
                    matchCount++;
                }
            }

            // Subcategory matches
            if (interestData.subcategories) {
                const subcatKeys = Object.keys(interestData.subcategories);
                subcategoryCount += subcatKeys.length;

                for (const [subcat, subcatData] of Object.entries(interestData.subcategories)) {
                    if (text.includes(subcat.toLowerCase())) {
                        totalScore += (subcatData.priority || 5) * 0.08;
                        matchCount++;
                    }

                    for (const keyword of subcatData.keywords || []) {
                        if (text.includes(keyword.toLowerCase())) {
                            totalScore += (subcatData.priority || 5) * 0.03;
                            matchCount++;
                        }
                    }
                }
            }
        }

        // Only return positive score if minimum matches are met
        return matchCount >= this.config.keywordMatchThreshold ? Math.min(totalScore, 1.0) : 0;
    }

    getKeywordMatches(content, userInterests) {
        const text = (content.title + ' ' + content.description).toLowerCase();
        const matches = [];

        const interests = Array.isArray(userInterests) ? userInterests : Object.keys(userInterests || {});

        for (const interest of interests) {
            const interestData = typeof userInterests === 'object' && !Array.isArray(userInterests)
                ? userInterests[interest]
                : { priority: 5, keywords: [] };

            if (text.includes(interest.toLowerCase())) {
                matches.push({
                    type: 'main_interest',
                    term: interest,
                    priority: interestData.priority || 5
                });
            }

            // Check keywords
            for (const keyword of interestData.keywords || []) {
                if (text.includes(keyword.toLowerCase())) {
                    matches.push({
                        type: 'keyword',
                        term: keyword,
                        category: interest,
                        priority: interestData.priority || 5
                    });
                }
            }

            // Check subcategories
            if (interestData.subcategories) {
                for (const [subcat, subcatData] of Object.entries(interestData.subcategories)) {
                    if (text.includes(subcat.toLowerCase())) {
                        matches.push({
                            type: 'subcategory',
                            term: subcat,
                            category: interest,
                            priority: subcatData.priority || 5
                        });
                    }

                    for (const keyword of subcatData.keywords || []) {
                        if (text.includes(keyword.toLowerCase())) {
                            matches.push({
                                type: 'subcategory_keyword',
                                term: keyword,
                                category: interest,
                                subcategory: subcat,
                                priority: subcatData.priority || 5
                            });
                        }
                    }
                }
            }
        }

        return matches;
    }

    calculateAverageRelevance(contentArray) {
        if (contentArray.length === 0) return 0;

        const total = contentArray.reduce((sum, content) => sum + (content.keywordRelevance || 0), 0);
        return (total / contentArray.length).toFixed(3);
    }

    getFilterStats() {
        return {
            ...this.getStats(),
            thresholds: {
                minRelevance: this.config.minTitleRelevance,
                minMatches: this.config.keywordMatchThreshold
            }
        };
    }
}

module.exports = KeywordRelevanceFilter;
