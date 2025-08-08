/**
 * Analysis Pipeline
 * Orchestrates the multi-stage content analysis process
 */

const BasicContentFilter = require('./filters/BasicContentFilter');
const KeywordRelevanceFilter = require('./filters/KeywordRelevanceFilter');
const QualityScorer = require('./filters/QualityScorer');
const QuickAIAnalyzer = require('./filters/QuickAIAnalyzer');
const FullAIAnalyzer = require('./filters/FullAIAnalyzer');
const AnalysisConfig = require('./config/AnalysisConfig');

class AnalysisPipeline {
    constructor() {
        this.filters = [
            new BasicContentFilter(),
            new KeywordRelevanceFilter(),
            new QualityScorer(),
            new QuickAIAnalyzer(),
            new FullAIAnalyzer()
        ];

        this.config = AnalysisConfig.thresholds;
        this.stats = {
            totalProcessingTime: 0,
            stageResults: {},
            totalCost: 0
        };
    }

    async process(contentBatch, userInterests) {
        console.log(`🚀 Starting analysis pipeline for ${contentBatch.length} items`);
        console.log('='.repeat(60));

        const startTime = Date.now();
        let currentContent = [...contentBatch];
        let totalCost = 0;
        const stageResults = {};

        // Process through each filter stage
        for (let i = 0; i < this.filters.length; i++) {
            const filter = this.filters[i];
            const stageStartTime = Date.now();

            try {
                console.log(`\n📍 Stage ${i + 1}: ${filter.name}`);

                const result = await filter.process(currentContent, userInterests);

                // Update content for next stage
                currentContent = result.content;

                // Track stage statistics
                const stageTime = Date.now() - stageStartTime;
                const stageCost = result.metadata.totalCost || 0;
                totalCost += stageCost;

                stageResults[filter.name] = {
                    inputCount: filter.getStats().processed,
                    outputCount: currentContent.length,
                    processingTime: stageTime,
                    cost: stageCost,
                    filterStats: filter.getFilterStats ? filter.getFilterStats() : filter.getStats(),
                    metadata: result.metadata
                };

                console.log(`   ✅ ${currentContent.length} items passed (${stageTime}ms)`);
                if (stageCost > 0) {
                    console.log(`   💰 Stage cost: $${stageCost.toFixed(6)}`);
                }

                // Early exit if no content remains
                if (currentContent.length === 0) {
                    console.log(`   ⚠️  No content remaining after ${filter.name}`);
                    break;
                }

            } catch (error) {
                console.error(`❌ Stage ${i + 1} (${filter.name}) failed:`, error.message);

                stageResults[filter.name] = {
                    error: error.message,
                    inputCount: currentContent.length,
                    outputCount: 0
                };

                // Don't continue pipeline if a stage fails
                break;
            }
        }

        // Apply final filtering based on minimum relevance
        const finalResults = this.applyFinalFilter(currentContent);

        const totalTime = Date.now() - startTime;
        this.updateStats(totalTime, stageResults, totalCost);

        return this.createFinalResult(finalResults, contentBatch.length, totalTime, totalCost, stageResults);
    }

    applyFinalFilter(content) {
        const filtered = content.filter(item =>
            (item.finalRelevanceScore || item.quickAiScore || item.combinedScore || 0) >= this.config.minTitleRelevance
        );

        console.log(`\n🎯 Final filter: ${filtered.length}/${content.length} items above threshold (${this.config.minTitleRelevance})`);

        return filtered.sort((a, b) =>
            (b.finalRelevanceScore || b.quickAiScore || b.combinedScore || 0) -
            (a.finalRelevanceScore || a.quickAiScore || a.combinedScore || 0)
        );
    }

    createFinalResult(analyzedContent, originalCount, processingTime, totalCost, stageResults) {
        const result = {
            analyzedContent,
            cost: {
                total: totalCost,
                breakdown: this.createCostBreakdown(stageResults)
            },
            stages: this.createStagesSummary(stageResults),
            processingTime,
            costPerItem: analyzedContent.length > 0 ? totalCost / analyzedContent.length : 0,
            pipelineStats: {
                originalCount,
                finalCount: analyzedContent.length,
                filteringEfficiency: originalCount > 0 ?
                    ((originalCount - analyzedContent.length) / originalCount * 100).toFixed(1) + '%' : '0%',
                stages: Object.keys(stageResults).length
            }
        };

        this.logFinalSummary(result);
        return result;
    }

    createCostBreakdown(stageResults) {
        const breakdown = {};

        Object.entries(stageResults).forEach(([stageName, data]) => {
            const cost = data.cost || 0;
            breakdown[stageName.toLowerCase().replace(/([A-Z])/g, '_$1')] = cost;
        });

        return breakdown;
    }

    createStagesSummary(stageResults) {
        const summary = {};

        Object.entries(stageResults).forEach(([stageName, data]) => {
            summary[stageName.toLowerCase() + 'Count'] = data.outputCount || 0;
        });

        return summary;
    }

    updateStats(totalTime, stageResults, totalCost) {
        this.stats.totalProcessingTime = totalTime;
        this.stats.stageResults = stageResults;
        this.stats.totalCost = totalCost;
    }

    logFinalSummary(result) {
        console.log('\n' + '='.repeat(60));
        console.log('📊 PIPELINE SUMMARY');
        console.log('='.repeat(60));

        console.log(`\n⏱️  Performance:`);
        console.log(`   Total Time: ${result.processingTime}ms`);
        console.log(`   Total Cost: $${result.cost.total.toFixed(6)}`);
        console.log(`   Cost per Item: $${result.costPerItem.toFixed(6)}`);
        console.log(`   Filtering Efficiency: ${result.pipelineStats.filteringEfficiency}`);

        console.log(`\n🔢 Results:`);
        console.log(`   Original Items: ${result.pipelineStats.originalCount}`);
        console.log(`   Final Items: ${result.pipelineStats.finalCount}`);
        console.log(`   Stages Completed: ${result.pipelineStats.stages}`);

        if (result.analyzedContent.length > 0) {
            console.log(`\n🏆 Top Results:`);
            result.analyzedContent.slice(0, 3).forEach((content, index) => {
                const score = content.finalRelevanceScore || content.quickAiScore || content.combinedScore || 0;
                console.log(`   ${index + 1}. ${content.title.substring(0, 50)}...`);
                console.log(`      Score: ${score.toFixed(3)} | Stage: ${content.processingStage || 'unknown'}`);
            });
        }

        console.log('\n' + '='.repeat(60));
    }

    // Get detailed statistics for all filters
    getDetailedStats() {
        return {
            pipeline: this.stats,
            filters: this.filters.map(filter => ({
                name: filter.name,
                stats: filter.getFilterStats ? filter.getFilterStats() : filter.getStats()
            }))
        };
    }

    // Reset all filter statistics
    resetStats() {
        this.filters.forEach(filter => filter.resetStats());
        this.stats = {
            totalProcessingTime: 0,
            stageResults: {},
            totalCost: 0
        };
    }
}

module.exports = AnalysisPipeline;
