/**
 * Refactored AI Analysis Service
 * Clean, modular service that orchestrates the analysis pipeline
 */

const AnalysisPipeline = require('./ai-analysis/AnalysisPipeline');
const OpenRouterService = require('./ai-analysis/OpenRouterService');
const AnalysisConfig = require('./ai-analysis/config/AnalysisConfig');

class AIAnalysisServiceRefactored {
    constructor() {
        this.pipeline = new AnalysisPipeline();
        this.openRouter = new OpenRouterService();
        this.config = AnalysisConfig;
    }

    /**
     * Main analysis method - simplified interface
     */
    async analyzeContent(contentBatch, userInterests) {
        if (!Array.isArray(contentBatch) || contentBatch.length === 0) {
            return this.createEmptyResult();
        }

        if (!userInterests || Object.keys(userInterests).length === 0) {
            console.warn('No user interests provided, using default analysis');
        }

        try {
            return await this.pipeline.process(contentBatch, userInterests);
        } catch (error) {
            console.error('Analysis pipeline failed:', error);
            return this.createErrorResult(error, contentBatch.length);
        }
    }

    /**
     * Analyze single video for relevance (backward compatibility)
     */
    async analyzeVideoRelevance(videoContent, userInterests) {
        const result = await this.analyzeContent([videoContent], userInterests);

        if (result.analyzedContent.length > 0) {
            const analyzed = result.analyzedContent[0];
            return {
                relevanceScore: analyzed.finalRelevanceScore || 0,
                isRelevant: (analyzed.finalRelevanceScore || 0) >= this.config.thresholds.minTitleRelevance,
                reasoning: analyzed.fullAnalysis?.recommendationReason || 'Basic analysis completed',
                keyTopics: analyzed.categories || [],
                cost: result.cost.total
            };
        }

        return {
            relevanceScore: 0,
            isRelevant: false,
            reasoning: 'No analysis available',
            keyTopics: [],
            cost: result.cost.total
        };
    }

    /**
     * Perform detailed analysis (backward compatibility)
     */
    async performDetailedAnalysis(videoContent, userInterests) {
        const result = await this.analyzeContent([videoContent], userInterests);

        if (result.analyzedContent.length > 0) {
            const analyzed = result.analyzedContent[0];
            const analysis = analyzed.fullAnalysis || {};

            return {
                summary: analysis.summary || 'Analysis completed',
                keyPoints: analysis.keyPoints || [],
                sentiment: analysis.sentiment || 'neutral',
                topics: analyzed.categories || [],
                categories: analyzed.categories || [],
                highlights: analysis.highlights || [],
                practicalValue: analysis.practicalValue || 'Educational content',
                targetAudience: analysis.targetAudience || 'General audience',
                cost: result.cost.total
            };
        }

        return this.createEmptyDetailedAnalysis();
    }

    /**
     * Score transcript segments
     */
    async scoreSegmentsForUser(segments, userInterests) {
        if (!Array.isArray(segments) || segments.length === 0) {
            return [];
        }

        try {
            const interestsText = this.openRouter.formatUserInterests(userInterests);
            const PromptsConfig = require('./ai-analysis/config/PromptsConfig');
            const prompt = PromptsConfig.segmentScoring(interestsText, segments);

            const response = await this.openRouter.makeRequest([
                { role: "user", content: prompt }
            ], 150, 0.3);

            const scoresText = response.choices[0].message.content.trim();
            const scores = this.openRouter.parseResponse(scoresText);

            // Extend scores array to match segments length if needed
            while (scores.length < segments.length) {
                scores.push(0.5);
            }

            return scores;
        } catch (error) {
            console.error('Error scoring segments:', error.message);
            // Return default scores if AI fails
            return segments.map(() => 0.5);
        }
    }

    /**
     * Get analysis statistics
     */
    getAnalysisStats() {
        return {
            config: this.config,
            pipelineStats: this.pipeline.getDetailedStats(),
            openRouterStats: this.openRouter.getStats()
        };
    }

    /**
     * Update configuration
     */
    updateConfig(newConfig) {
        // Deep merge new config with existing
        this.config = { ...this.config, ...newConfig };
        console.log('AI Analysis config updated:', newConfig);
    }

    /**
     * Test API connectivity
     */
    async testConnection() {
        return this.openRouter.testConnection();
    }

    /**
     * Reset all statistics
     */
    resetStats() {
        this.pipeline.resetStats();
        this.openRouter.resetStats();
    }

    // Helper methods
    createEmptyResult() {
        return {
            analyzedContent: [],
            cost: { total: 0, breakdown: {} },
            stages: {},
            processingTime: 0,
            costPerItem: 0,
            pipelineStats: {
                originalCount: 0,
                finalCount: 0,
                filteringEfficiency: '0%',
                stages: 0
            }
        };
    }

    createErrorResult(error, originalCount) {
        return {
            analyzedContent: [],
            cost: { total: 0, breakdown: {} },
            stages: {},
            processingTime: 0,
            costPerItem: 0,
            error: error.message,
            pipelineStats: {
                originalCount,
                finalCount: 0,
                filteringEfficiency: '100%',
                stages: 0
            }
        };
    }

    createEmptyDetailedAnalysis() {
        return {
            summary: 'Analysis could not be completed',
            keyPoints: ['Analysis failed'],
            sentiment: 'neutral',
            topics: ['general'],
            categories: ['General'],
            highlights: [],
            practicalValue: 'Unknown',
            targetAudience: 'General audience',
            cost: 0
        };
    }
}

// Export singleton instance for backward compatibility
module.exports = new AIAnalysisServiceRefactored();
