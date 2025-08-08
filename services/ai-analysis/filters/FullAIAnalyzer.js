/**
 * Full AI Analyzer
 * Performs detailed AI analysis for top candidates only
 */

const BaseFilter = require('./BaseFilter');
const OpenRouterService = require('../OpenRouterService');
const PromptsConfig = require('../config/PromptsConfig');
const AnalysisConfig = require('../config/AnalysisConfig');

class FullAIAnalyzer extends BaseFilter {
    constructor() {
        super('FullAIAnalyzer', AnalysisConfig.processing);
        this.openRouter = new OpenRouterService();
        this.thresholds = AnalysisConfig.thresholds;
    }

    async process(contentBatch, userInterests) {
        console.log(`🎯 Full AI analysis selection from ${contentBatch.length} items...`);

        // Select top candidates for full analysis
        const topCandidates = this.selectTopCandidates(contentBatch);

        if (topCandidates.length === 0) {
            console.log('❌ No candidates meet threshold for full analysis');
            return this.createResult(contentBatch, {
                candidatesSelected: 0,
                threshold: this.thresholds.fullAnalysisThreshold,
                totalCost: 0
            });
        }

        console.log(`🔍 Performing full analysis on ${topCandidates.length} top candidates...`);

        const results = [];
        let totalCost = 0;

        // Process each candidate individually for detailed analysis
        for (const content of topCandidates) {
            try {
                const analysisResult = await this.analyzeContent(content, userInterests);
                results.push(analysisResult.content);
                totalCost += analysisResult.cost;

                this.stats.processed++;

            } catch (error) {
                console.error(`Full analysis failed for "${content.title}":`, error.message);

                // Fallback to quick AI score
                results.push({
                    ...content,
                    finalRelevanceScore: content.quickAiScore || content.combinedScore || 0.5,
                    aiProcessed: false,
                    error: error.message,
                    processingStage: 'quick_ai_only'
                });

                this.stats.errors++;
            }
        }

        // Combine with remaining content that didn't get full analysis
        const remainingContent = contentBatch
            .filter(content => !topCandidates.some(candidate => candidate.id === content.id))
            .map(content => ({
                ...content,
                finalRelevanceScore: content.quickAiScore || content.combinedScore || 0.5,
                aiProcessed: content.aiAnalyzed || false,
                processingStage: content.aiAnalyzed ? 'quick_ai' : 'keyword_filtered'
            }));

        const allResults = [...results, ...remainingContent]
            .sort((a, b) => b.finalRelevanceScore - a.finalRelevanceScore);

        console.log(`✅ Full AI analysis: ${results.length} detailed, ${remainingContent.length} quick (Cost: $${totalCost.toFixed(4)})`);

        return this.createResult(allResults, {
            candidatesSelected: topCandidates.length,
            fullyAnalyzed: results.length,
            totalCost,
            costPerDetailedItem: results.length > 0 ? totalCost / results.length : 0,
            threshold: this.thresholds.fullAnalysisThreshold,
            model: this.openRouter.model
        });
    }

    selectTopCandidates(contentBatch) {
        return contentBatch
            .filter(content => (content.quickAiScore || content.combinedScore || 0) >= this.thresholds.fullAnalysisThreshold)
            .sort((a, b) => (b.quickAiScore || b.combinedScore || 0) - (a.quickAiScore || a.combinedScore || 0))
            .slice(0, this.config.maxFullAnalysis);
    }

    async analyzeContent(content, userInterests) {
        const interestsText = this.openRouter.formatUserInterests(userInterests);
        const prompt = PromptsConfig.fullAnalysis(interestsText, content);

        console.log(`🔍 Full analysis: "${content.title.substring(0, 50)}..."`);

        const response = await this.openRouter.makeRequest(
            [{ role: "user", content: prompt }],
            this.config.maxTokensFull,
            this.config.temperature
        );

        const analysisText = response.choices[0].message.content.trim();
        const fullAnalysis = this.openRouter.parseResponse(analysisText);

        // Validate required fields
        this.validateAnalysis(fullAnalysis);

        const enrichedContent = {
            ...content,
            fullAnalysis,
            finalRelevanceScore: fullAnalysis.relevanceScore || content.quickAiScore || 0.5,
            highlights: fullAnalysis.highlights || [],
            categories: fullAnalysis.categories || [],
            summary: fullAnalysis.summary || '',
            keyPoints: fullAnalysis.keyPoints || [],
            aiProcessed: true,
            processingStage: 'full_ai',
            aiModel: this.openRouter.model
        };

        // Estimate cost
        const estimatedTokens = prompt.length / 4 + this.config.maxTokensFull;
        const cost = this.openRouter.calculateCost(estimatedTokens, this.openRouter.model);

        return {
            content: enrichedContent,
            cost
        };
    }

    validateAnalysis(analysis) {
        if (!analysis || typeof analysis !== 'object') {
            throw new Error('Invalid analysis object');
        }

        // Ensure required fields exist with defaults
        analysis.relevanceScore = analysis.relevanceScore || 0.5;
        analysis.summary = analysis.summary || 'Analysis completed';
        analysis.categories = analysis.categories || ['General'];
        analysis.highlights = analysis.highlights || [];
        analysis.keyPoints = analysis.keyPoints || [];
        analysis.sentiment = analysis.sentiment || 'neutral';
    }

    getFilterStats() {
        return {
            ...this.getStats(),
            config: {
                maxFullAnalysis: this.config.maxFullAnalysis,
                threshold: this.thresholds.fullAnalysisThreshold,
                maxTokens: this.config.maxTokensFull,
                temperature: this.config.temperature
            },
            openRouterStats: this.openRouter.getStats()
        };
    }
}

module.exports = FullAIAnalyzer;
