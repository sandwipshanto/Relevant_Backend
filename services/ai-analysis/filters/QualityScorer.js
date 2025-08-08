/**
 * Quality Scorer
 * Calculates comprehensive quality and alignment scores for content
 */

const BaseFilter = require('./BaseFilter');
const KeywordsConfig = require('../config/KeywordsConfig');
const AnalysisConfig = require('../config/AnalysisConfig');

class QualityScorer extends BaseFilter {
    constructor() {
        super('QualityScorer', AnalysisConfig.scoring);
        this.qualityIndicators = KeywordsConfig.qualityIndicators;
        this.professionalDomains = KeywordsConfig.professionalDomains;
    }

    async process(contentBatch, userInterests) {
        console.log(`⭐ Quality scoring ${contentBatch.length} items...`);

        const scoredContent = contentBatch.map(content =>
            this.enrichWithQualityScores(content, userInterests)
        );

        // Sort by combined score (highest first)
        const sortedContent = scoredContent.sort((a, b) => b.combinedScore - a.combinedScore);

        this.stats.processed = contentBatch.length;

        console.log(`✅ Quality scoring completed for ${contentBatch.length} items`);

        return this.createResult(sortedContent, {
            averageQuality: this.calculateAverageScore(scoredContent, 'qualityScore'),
            averageAlignment: this.calculateAverageScore(scoredContent, 'interestAlignment'),
            averageCombined: this.calculateAverageScore(scoredContent, 'combinedScore'),
            scoringWeights: {
                quality: this.config.qualityWeight,
                relevance: this.config.relevanceWeight,
                alignment: this.config.alignmentWeight
            }
        });
    }

    enrichWithQualityScores(content, userInterests) {
        const qualityScore = this.calculateQualityScore(content);
        const interestAlignment = this.calculateInterestAlignment(content, userInterests);

        const combinedScore =
            (qualityScore * this.config.qualityWeight) +
            (content.keywordRelevance * this.config.relevanceWeight) +
            (interestAlignment * this.config.alignmentWeight);

        return {
            ...content,
            qualityScore,
            interestAlignment,
            combinedScore,
            qualityBreakdown: this.getQualityBreakdown(content)
        };
    }

    calculateQualityScore(content) {
        const text = (content.title + ' ' + content.description).toLowerCase();
        let score = 0;

        // Quality indicators score
        const qualityMatches = this.qualityIndicators.filter(indicator =>
            text.includes(indicator.toLowerCase())
        ).length;
        score += Math.min(qualityMatches * this.config.qualityIndicatorScore, 0.4);

        // Professional domain matches
        const domainMatches = this.professionalDomains.filter(domain =>
            text.includes(domain.toLowerCase())
        ).length;
        score += Math.min(domainMatches * this.config.domainMatchScore, 0.3);

        // Channel quality based on view count
        if (content.viewCount) {
            if (content.viewCount > this.config.viewCountThresholdHigh) {
                score += this.config.viewCountBonusHigh;
            } else if (content.viewCount > this.config.viewCountThresholdMed) {
                score += this.config.viewCountBonusMed;
            }
        }

        // Duration quality (sweet spot for educational content)
        if (content.duration) {
            const duration = this.parseDuration(content.duration);
            if (duration >= this.config.durationMinOptimal && duration <= this.config.durationMaxOptimal) {
                score += this.config.durationBonusScore;
            }
        }

        return Math.min(score, 1.0);
    }

    calculateInterestAlignment(content, userInterests) {
        if (!userInterests || Object.keys(userInterests).length === 0) {
            return 0.5;
        }

        const text = (content.title + ' ' + content.description).toLowerCase();
        const interests = Array.isArray(userInterests) ? userInterests : Object.keys(userInterests);

        let alignment = 0;
        let totalPriority = 0;

        for (const interest of interests) {
            const priority = (typeof userInterests === 'object' && !Array.isArray(userInterests))
                ? (userInterests[interest]?.priority || 5)
                : 5;

            totalPriority += priority;

            if (text.includes(interest.toLowerCase())) {
                alignment += priority;
            }
        }

        return totalPriority > 0 ? Math.min(alignment / totalPriority, 1.0) : 0;
    }

    getQualityBreakdown(content) {
        const text = (content.title + ' ' + content.description).toLowerCase();

        const qualityMatches = this.qualityIndicators.filter(indicator =>
            text.includes(indicator.toLowerCase())
        );

        const domainMatches = this.professionalDomains.filter(domain =>
            text.includes(domain.toLowerCase())
        );

        const duration = content.duration ? this.parseDuration(content.duration) : 0;

        return {
            qualityKeywords: qualityMatches,
            professionalDomains: domainMatches,
            viewCount: content.viewCount || 0,
            duration: duration,
            durationOptimal: duration >= this.config.durationMinOptimal &&
                duration <= this.config.durationMaxOptimal
        };
    }

    calculateAverageScore(contentArray, scoreField) {
        if (contentArray.length === 0) return 0;

        const total = contentArray.reduce((sum, content) => sum + (content[scoreField] || 0), 0);
        return (total / contentArray.length).toFixed(3);
    }

    getFilterStats() {
        return {
            ...this.getStats(),
            config: {
                qualityIndicators: this.qualityIndicators.length,
                professionalDomains: this.professionalDomains.length,
                scoringWeights: {
                    quality: this.config.qualityWeight,
                    relevance: this.config.relevanceWeight,
                    alignment: this.config.alignmentWeight
                }
            }
        };
    }
}

module.exports = QualityScorer;
