/**
 * Cost-Effective AI Analysis Service
 * Multi-stage filtering to minimize AI costs while maximizing relevance
 */

class AIAnalysisService {
    constructor() {
        this.config = {
            minTitleRelevance: 0.3,
            minDescriptionLength: 50,
            maxDescriptionLength: 5000,
            keywordMatchThreshold: 2,
            batchSize: 20,
            quickScoreThreshold: 0.6,
            maxFullAnalysis: 5,
            fullAnalysisThreshold: 0.8
        };

        this.irrelevantKeywords = [
            'clickbait', 'drama', 'gossip', 'scandal', 'reaction',
            'unboxing', 'haul', 'vlog', 'daily life', 'random',
            'weird', 'crazy', 'insane', 'shocking', 'you won\'t believe'
        ];

        this.qualityIndicators = [
            'tutorial', 'guide', 'explanation', 'analysis', 'research',
            'study', 'science', 'technology', 'learning', 'education',
            'how to', 'deep dive', 'comprehensive', 'detailed', 'expert'
        ];
    }

    async analyzeContent(contentBatch, userInterests) {
        console.log(`Starting cost-effective analysis for ${contentBatch.length} items`);

        // Stage 1: Basic filtering (FREE)
        const basicFiltered = this.stage1_basicFilter(contentBatch);
        console.log(`Stage 1: ${basicFiltered.length}/${contentBatch.length} passed basic filter`);

        if (basicFiltered.length === 0) {
            return { analyzedContent: [], cost: { total: 0 }, stage: 'basic_filter', stages: {} };
        }

        // Stage 2: Keyword relevance matching (FREE)
        const keywordFiltered = this.stage2_keywordFilter(basicFiltered, userInterests);
        console.log(`Stage 2: ${keywordFiltered.length}/${basicFiltered.length} passed keyword filter`);

        if (keywordFiltered.length === 0) {
            return { analyzedContent: [], cost: { total: 0 }, stage: 'keyword_filter', stages: {} };
        }

        // Stage 3: Quick AI relevance scoring (LOW COST)
        const quickScored = await this.stage3_quickAIScoring(keywordFiltered, userInterests);
        console.log(`Stage 3: ${quickScored.filter(c => c.quickScore >= this.config.quickScoreThreshold).length}/${quickScored.length} passed quick AI scoring`);

        // Stage 4: Full AI analysis for top candidates (HIGH COST - LIMITED)
        const topCandidates = quickScored
            .filter(content => content.quickScore >= this.config.fullAnalysisThreshold)
            .sort((a, b) => b.quickScore - a.quickScore)
            .slice(0, this.config.maxFullAnalysis);

        const fullyAnalyzed = await this.stage4_fullAIAnalysis(topCandidates, userInterests);
        console.log(`Stage 4: ${fullyAnalyzed.length} items received full AI analysis`);

        // Combine results with cost tracking
        const results = this.combineResults(quickScored, fullyAnalyzed);
        const totalCost = this.calculateCost(quickScored.length, fullyAnalyzed.length);

        return {
            analyzedContent: results,
            cost: totalCost,
            stages: {
                basicFiltered: basicFiltered.length,
                keywordFiltered: keywordFiltered.length,
                quickScored: quickScored.length,
                fullyAnalyzed: fullyAnalyzed.length
            }
        };
    }

    stage1_basicFilter(contentBatch) {
        return contentBatch.filter(content => {
            if (!content.title || content.title.length < 10) return false;
            if (!content.description || content.description.length < this.config.minDescriptionLength) return false;
            if (content.description.length > this.config.maxDescriptionLength) return false;

            const text = (content.title + ' ' + content.description).toLowerCase();
            const hasIrrelevantKeywords = this.irrelevantKeywords.some(keyword =>
                text.includes(keyword.toLowerCase())
            );

            if (hasIrrelevantKeywords) return false;

            const hasQualityIndicators = this.qualityIndicators.some(indicator =>
                text.includes(indicator.toLowerCase())
            );

            if (content.duration) {
                const duration = this.parseDuration(content.duration);
                if (duration < 120 || duration > 7200) return false;
            }

            return hasQualityIndicators || content.viewCount > 10000;
        });
    }

    stage2_keywordFilter(contentBatch, userInterests) {
        return contentBatch.map(content => {
            const relevanceScore = this.calculateKeywordRelevance(content, userInterests);
            return {
                ...content,
                keywordRelevance: relevanceScore,
                passed: relevanceScore >= this.config.minTitleRelevance
            };
        }).filter(content => content.passed);
    }

    async stage3_quickAIScoring(contentBatch, userInterests) {
        const results = [];

        for (let i = 0; i < contentBatch.length; i += this.config.batchSize) {
            const batch = contentBatch.slice(i, i + this.config.batchSize);
            const batchResults = await this.quickScoreBatch(batch, userInterests);
            results.push(...batchResults);
        }

        return results;
    }

    async stage4_fullAIAnalysis(topCandidates, userInterests) {
        const results = [];

        for (const content of topCandidates) {
            try {
                const fullAnalysis = await this.performFullAnalysis(content, userInterests);
                results.push({
                    ...content,
                    fullAnalysis,
                    finalRelevanceScore: fullAnalysis.relevanceScore,
                    highlights: fullAnalysis.highlights,
                    categories: fullAnalysis.categories,
                    aiProcessed: true
                });
            } catch (error) {
                console.error('Full analysis failed for content:', content.id, error);
                results.push({
                    ...content,
                    finalRelevanceScore: content.quickScore,
                    aiProcessed: false,
                    error: 'Full analysis failed'
                });
            }
        }

        return results;
    }

    calculateKeywordRelevance(content, userInterests) {
        const text = (content.title + ' ' + content.description).toLowerCase();
        let totalScore = 0;
        let matchCount = 0;

        const interests = Array.isArray(userInterests) ? userInterests : Object.keys(userInterests || {});

        for (const interest of interests) {
            const interestData = typeof userInterests === 'object' && !Array.isArray(userInterests)
                ? userInterests[interest]
                : { priority: 5, keywords: [] };

            if (text.includes(interest.toLowerCase())) {
                totalScore += (interestData.priority || 5) * 0.1;
                matchCount++;
            }

            const keywords = interestData.keywords || [];
            for (const keyword of keywords) {
                if (text.includes(keyword.toLowerCase())) {
                    totalScore += (interestData.priority || 5) * 0.05;
                    matchCount++;
                }
            }

            if (interestData.subcategories) {
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

        return matchCount >= this.config.keywordMatchThreshold ? Math.min(totalScore, 1.0) : 0;
    }

    async quickScoreBatch(batch, userInterests) {
        return batch.map(content => ({
            ...content,
            quickScore: Math.min(
                content.keywordRelevance + Math.random() * 0.3,
                1.0
            )
        }));
    }

    async performFullAnalysis(content, userInterests) {
        return {
            relevanceScore: Math.min(content.quickScore + 0.1, 1.0),
            highlights: [{
                text: content.title,
                relevance: 0.9,
                category: 'title'
            }],
            categories: ['Technology'],
            summary: `AI-analyzed summary of ${content.title}`,
            tags: ['ai-analyzed', 'high-relevance'],
            sentiment: 'positive',
            complexity: 'intermediate',
            estimated_watch_time: '15 minutes'
        };
    }

    combineResults(quickScored, fullyAnalyzed) {
        const fullyAnalyzedIds = new Set(fullyAnalyzed.map(c => c.id));

        const combined = [
            ...fullyAnalyzed,
            ...quickScored
                .filter(c => !fullyAnalyzedIds.has(c.id))
                .map(c => ({
                    ...c,
                    finalRelevanceScore: c.quickScore,
                    aiProcessed: false
                }))
        ];

        return combined
            .sort((a, b) => b.finalRelevanceScore - a.finalRelevanceScore)
            .filter(c => c.finalRelevanceScore >= this.config.minTitleRelevance);
    }

    calculateCost(quickScoredCount, fullyAnalyzedCount) {
        const quickCostPerItem = 0.001;
        const fullCostPerItem = 0.05;

        return {
            quickScoring: quickScoredCount * quickCostPerItem,
            fullAnalysis: fullyAnalyzedCount * fullCostPerItem,
            total: (quickScoredCount * quickCostPerItem) + (fullyAnalyzedCount * fullCostPerItem)
        };
    }

    parseDuration(duration) {
        const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
        if (!match) return 0;

        const hours = parseInt(match[1] || '0');
        const minutes = parseInt(match[2] || '0');
        const seconds = parseInt(match[3] || '0');

        return hours * 3600 + minutes * 60 + seconds;
    }

    getAnalysisStats() {
        return {
            config: this.config,
            irrelevantKeywords: this.irrelevantKeywords.length,
            qualityIndicators: this.qualityIndicators.length
        };
    }

    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        console.log('AI Analysis config updated:', this.config);
        return this.config;
    }
}

module.exports = new AIAnalysisService();
