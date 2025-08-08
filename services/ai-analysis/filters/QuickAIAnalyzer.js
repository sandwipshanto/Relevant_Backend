/**
 * Quick AI Analyzer
 * Performs fast AI-powered relevance scoring with minimal token usage
 */

const BaseFilter = require('./BaseFilter');
const OpenRouterService = require('../OpenRouterService');
const PromptsConfig = require('../config/PromptsConfig');
const AnalysisConfig = require('../config/AnalysisConfig');

class QuickAIAnalyzer extends BaseFilter {
    constructor() {
        super('QuickAIAnalyzer', AnalysisConfig.processing);
        this.openRouter = new OpenRouterService();
    }

    async process(contentBatch, userInterests) {
        console.log(`🤖 Quick AI analysis for ${contentBatch.length} items...`);

        const results = [];
        let totalCost = 0;

        // Process in batches
        for (let i = 0; i < contentBatch.length; i += this.config.batchSize) {
            const batch = contentBatch.slice(i, i + this.config.batchSize);

            try {
                const batchResults = await this.analyzeBatch(batch, userInterests);
                results.push(...batchResults.content);
                totalCost += batchResults.cost;

                this.stats.processed += batch.length;

            } catch (error) {
                console.error('Quick AI analysis failed for batch:', error.message);

                // Fallback to combined scores
                const fallbackResults = batch.map(content => ({
                    ...content,
                    quickAiScore: content.combinedScore || 0.5,
                    aiAnalyzed: false,
                    fallback: true,
                    error: error.message
                }));

                results.push(...fallbackResults);
                this.stats.errors += batch.length;
            }
        }

        console.log(`✅ Quick AI analysis: ${results.length} items processed (Cost: $${totalCost.toFixed(4)})`);

        return this.createResult(results, {
            totalCost,
            costPerItem: results.length > 0 ? totalCost / results.length : 0,
            batchSize: this.config.batchSize,
            model: this.openRouter.model,
            aiStats: this.openRouter.getStats()
        });
    }

    async analyzeBatch(batch, userInterests) {
        const interestsText = this.openRouter.formatUserInterests(userInterests);
        const prompt = PromptsConfig.quickAnalysis(interestsText, batch);

        const response = await this.openRouter.makeRequest(
            [{ role: "user", content: prompt }],
            this.config.maxTokensQuick,
            this.config.temperature
        );

        const scoresText = response.choices[0].message.content.trim();
        const scores = this.openRouter.parseResponse(scoresText);

        // Validate scores array
        if (!Array.isArray(scores) || scores.length !== batch.length) {
            throw new Error(`Invalid scores array: expected ${batch.length} scores, got ${scores.length}`);
        }

        const enrichedContent = batch.map((content, index) => ({
            ...content,
            quickAiScore: scores[index] || content.combinedScore || 0.5,
            aiAnalyzed: true,
            aiModel: this.openRouter.model
        }));

        // Estimate cost
        const estimatedTokens = prompt.length / 4; // Rough estimate
        const cost = this.openRouter.calculateCost(estimatedTokens + this.config.maxTokensQuick, this.openRouter.model);

        return {
            content: enrichedContent,
            cost
        };
    }

    getFilterStats() {
        return {
            ...this.getStats(),
            config: {
                batchSize: this.config.batchSize,
                maxTokens: this.config.maxTokensQuick,
                temperature: this.config.temperature
            },
            openRouterStats: this.openRouter.getStats()
        };
    }
}

module.exports = QuickAIAnalyzer;
