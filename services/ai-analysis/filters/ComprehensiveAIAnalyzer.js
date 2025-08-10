/**
 * Comprehensive AI Analyzer
 * Merged Stage 4 & 5: Performs full AI analysis with relevance scoring and content highlights
 */

const BaseFilter = require('./BaseFilter');
const OpenRouterService = require('../OpenRouterService');
const PromptsConfig = require('../config/PromptsConfig');
const AnalysisConfig = require('../config/AnalysisConfig');

class ComprehensiveAIAnalyzer extends BaseFilter {
    constructor() {
        super('ComprehensiveAIAnalyzer', AnalysisConfig.processing);
        this.openRouter = new OpenRouterService();
        this.thresholds = AnalysisConfig.thresholds;
    }

    async process(contentBatch, userInterests) {
        console.log(`🎯 Comprehensive AI analysis for ${contentBatch.length} items...`);

        const results = [];
        let totalCost = 0;

        // Process in smaller batches to manage API limits and provide better analysis
        for (let i = 0; i < contentBatch.length; i += this.config.batchSize) {
            const batch = contentBatch.slice(i, i + this.config.batchSize);

            try {
                const batchResults = await this.analyzeBatch(batch, userInterests);
                results.push(...batchResults.content);
                totalCost += batchResults.cost;

                this.stats.processed += batch.length;

                console.log(`   ✅ Batch ${Math.floor(i / this.config.batchSize) + 1}: ${batch.length} items analyzed`);

            } catch (error) {
                console.error('Comprehensive AI analysis failed for batch:', error.message);

                // Fallback to combined scores with basic structure
                const fallbackResults = batch.map(content => ({
                    ...content,
                    relevanceScore: content.combinedScore || 0.5,
                    aiAnalyzed: false,
                    fallback: true,
                    error: error.message,
                    summary: 'Analysis failed - using quality score fallback',
                    highlights: [],
                    categories: ['Unknown'],
                    keyPoints: [],
                    processingStage: 'fallback'
                }));

                results.push(...fallbackResults);
                this.stats.errors += batch.length;
            }
        }

        // Sort by relevance score (highest first)
        const sortedResults = results.sort((a, b) => b.relevanceScore - a.relevanceScore);

        console.log(`✅ Comprehensive AI analysis completed: ${results.length} items (Cost: $${totalCost.toFixed(4)})`);

        return this.createResult(sortedResults, {
            totalCost,
            costPerItem: results.length > 0 ? totalCost / results.length : 0,
            batchSize: this.config.batchSize,
            model: this.openRouter.model,
            aiStats: this.openRouter.getStats(),
            averageRelevance: this.calculateAverageRelevance(sortedResults),
            highRelevanceCount: sortedResults.filter(item => item.relevanceScore >= 0.7).length
        });
    }

    async analyzeBatch(batch, userInterests) {
        const analysisResults = [];
        let batchCost = 0;

        // Analyze each item individually for comprehensive results
        for (const content of batch) {
            try {
                const analysisResult = await this.analyzeContent(content, userInterests);
                analysisResults.push(analysisResult.content);
                batchCost += analysisResult.cost;

            } catch (error) {
                console.error(`Analysis failed for "${content.title.substring(0, 30)}...":`, error.message);

                // Individual fallback
                analysisResults.push({
                    ...content,
                    relevanceScore: content.combinedScore || 0.5,
                    aiAnalyzed: false,
                    error: error.message,
                    summary: 'Individual analysis failed',
                    highlights: [],
                    categories: ['Error'],
                    keyPoints: [],
                    processingStage: 'error'
                });
            }
        }

        return {
            content: analysisResults,
            cost: batchCost
        };
    }

    async analyzeContent(content, userInterests) {
        const interestsText = this.openRouter.formatUserInterests(userInterests);
        const prompt = this.createComprehensivePrompt(interestsText, content);

        console.log(`🔍 Analyzing: "${content.title.substring(0, 40)}..."`);

        const response = await this.openRouter.makeRequest(
            [{ role: "user", content: prompt }],
            this.config.maxTokensFull,
            this.config.temperature
        );

        const analysisText = response.choices[0].message.content.trim();
        const analysis = this.openRouter.parseResponse(analysisText);

        // Validate and enrich the analysis
        this.validateAndEnrichAnalysis(analysis, content);

        const enrichedContent = {
            ...content,
            // Core scoring
            relevanceScore: analysis.relevanceScore,
            finalRelevanceScore: analysis.relevanceScore, // For backward compatibility

            // Content insights
            summary: analysis.summary,
            highlights: analysis.highlights || [],
            keyPoints: analysis.keyPoints || [],
            categories: analysis.categories || ['General'],
            tags: analysis.tags || [],

            // Additional metadata
            complexity: analysis.complexity || 'intermediate',
            sentiment: analysis.sentiment || 'neutral',
            estimatedWatchTime: analysis.estimated_watch_time || 'Unknown',
            recommendationReason: analysis.recommendationReason || '',

            // Processing metadata
            aiAnalyzed: true,
            aiProcessed: true,
            processingStage: 'comprehensive_ai',
            aiModel: this.openRouter.model,

            // Full analysis object for detailed inspection
            fullAnalysis: analysis
        };

        // Estimate cost
        const estimatedTokens = prompt.length / 4 + this.config.maxTokensFull;
        const cost = this.openRouter.calculateCost(estimatedTokens, this.openRouter.model);

        return {
            content: enrichedContent,
            cost
        };
    }

    createComprehensivePrompt(interestsText, content) {
        return `Analyze this YouTube content for a user interested in: ${interestsText}

Content Details:
Title: ${content.title}
Description: ${content.description.substring(0, 800)}${content.description.length > 800 ? '...' : ''}
Channel: ${content.channelTitle}
Duration: ${content.duration || 'Unknown'}
View Count: ${content.viewCount || 'Unknown'}
Quality Score: ${content.qualityScore || 'Unknown'}

Provide comprehensive analysis in JSON format:
{
    "relevanceScore": 0.0-1.0,
    "summary": "2-3 sentence summary of content value and relevance",
    "highlights": [
        {
            "text": "specific highlight or key topic",
            "relevance": 0.0-1.0,
            "reason": "why this is relevant to user interests"
        }
    ],
    "keyPoints": ["main point 1", "main point 2", "main point 3"],
    "categories": ["primary category", "secondary category"],
    "tags": ["relevant", "tags", "for", "filtering"],
    "complexity": "beginner|intermediate|advanced",
    "sentiment": "positive|neutral|negative",
    "estimated_watch_time": "time to get value (e.g., '10 minutes')",
    "recommendationReason": "specific reason why this matches user interests"
}

SCORING GUIDELINES:
- 0.0-0.3: Not relevant (entertainment, unrelated topics)
- 0.4-0.6: Somewhat related but limited value
- 0.7-0.8: Good match with clear relevance
- 0.9-1.0: Excellent match, highly valuable

Focus on practical value and direct relevance to user interests.`;
    }

    validateAndEnrichAnalysis(analysis, content) {
        if (!analysis || typeof analysis !== 'object') {
            throw new Error('Invalid analysis object');
        }

        // Ensure required fields with sensible defaults
        analysis.relevanceScore = Math.max(0, Math.min(1, analysis.relevanceScore || content.combinedScore || 0.5));
        analysis.summary = analysis.summary || `Analysis of "${content.title.substring(0, 50)}..."`;
        analysis.categories = Array.isArray(analysis.categories) ? analysis.categories : ['General'];
        analysis.highlights = Array.isArray(analysis.highlights) ? analysis.highlights : [];
        analysis.keyPoints = Array.isArray(analysis.keyPoints) ? analysis.keyPoints : [];
        analysis.tags = Array.isArray(analysis.tags) ? analysis.tags : [];
        analysis.complexity = analysis.complexity || 'intermediate';
        analysis.sentiment = analysis.sentiment || 'neutral';
        analysis.estimated_watch_time = analysis.estimated_watch_time || 'Unknown';
        analysis.recommendationReason = analysis.recommendationReason || 'Content matches your interests';

        // Validate highlights structure
        analysis.highlights = analysis.highlights.map(highlight => {
            if (typeof highlight === 'string') {
                return {
                    text: highlight,
                    relevance: 0.7,
                    reason: 'Relevant content identified'
                };
            }
            return {
                text: highlight.text || 'Key point identified',
                relevance: Math.max(0, Math.min(1, highlight.relevance || 0.7)),
                reason: highlight.reason || 'Relevant to your interests'
            };
        });

        // Limit array sizes for performance
        analysis.highlights = analysis.highlights.slice(0, 5);
        analysis.keyPoints = analysis.keyPoints.slice(0, 10);
        analysis.tags = analysis.tags.slice(0, 15);
        analysis.categories = analysis.categories.slice(0, 3);
    }

    calculateAverageRelevance(results) {
        if (results.length === 0) return 0;
        const total = results.reduce((sum, item) => sum + (item.relevanceScore || 0), 0);
        return (total / results.length).toFixed(3);
    }

    getFilterStats() {
        return {
            ...this.getStats(),
            config: {
                batchSize: this.config.batchSize,
                maxTokens: this.config.maxTokensFull,
                temperature: this.config.temperature,
                model: this.openRouter.model
            },
            openRouterStats: this.openRouter.getStats(),
            thresholds: {
                relevanceThreshold: 0.7,
                comprehensiveAnalysis: true
            }
        };
    }
}

module.exports = ComprehensiveAIAnalyzer;
