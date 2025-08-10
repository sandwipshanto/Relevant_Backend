/**
 * AI Analysis Configuration
 * Centralized configuration for all analysis parameters
 */

module.exports = {
    // Analysis thresholds
    thresholds: {
        minTitleRelevance: 0.3, // Lowered from 0.5 for testing - AI gives good matches 0.7+
        minDescriptionLength: 50,
        maxDescriptionLength: 5000,
        keywordMatchThreshold: 2,
        quickScoreThreshold: 0.6,
        fullAnalysisThreshold: 0.75,
        minDurationSeconds: 60, // Lowered from 120 to include tutorial shorts
        maxDurationSeconds: 28800 // Increased from 7200 (2h) to 28800 (8h) for long courses
    },

    // Processing limits
    processing: {
        batchSize: 3, // Reduced for more thorough individual analysis
        maxFullAnalysis: 10, // Increased since we only have one AI stage now
        maxTokensQuick: 200, // Legacy - not used in comprehensive analyzer
        maxTokensFull: 1000, // Increased for comprehensive analysis
        temperature: 0.3
    },

    // Cost estimates (per item)
    costs: {
        quickAnalysis: 0.002, // Legacy - not used
        fullAnalysis: 0.010,  // Increased due to more comprehensive analysis
        comprehensiveAnalysis: 0.012 // New comprehensive analysis cost
    },

    // API models
    models: {
        primary: 'google/gemini-2.0-flash-001',
        fallback: 'meta-llama/llama-3.1-8b-instruct:free'
    },

    // Quality score weights
    scoring: {
        qualityWeight: 0.4,
        relevanceWeight: 0.4,
        alignmentWeight: 0.2,

        // Quality indicators
        qualityIndicatorScore: 0.1,
        domainMatchScore: 0.1,
        viewCountBonusHigh: 0.2,
        viewCountBonusMed: 0.1,
        viewCountThresholdHigh: 100000,
        viewCountThresholdMed: 10000,
        durationBonusScore: 0.1,
        durationMinOptimal: 300,  // 5 minutes
        durationMaxOptimal: 3600  // 1 hour
    }
};
