/**
 * Test Script for AI Analysis and Job Queue
 * Uses cached YouTube data instead of making API calls
 */

const TestDataFetcher = require('./fetchTestData');
const AIAnalysisService = require('../services/AIAnalysisServiceRefactored');
const SimpleJobQueue = require('../services/SimpleJobQueue');

class AIAnalysisTester {
    constructor() {
        this.results = {
            stages: {},
            costs: {},
            performance: {},
            errors: []
        };
    }

    async testWithCachedData(sampleSize = 'small') {
        console.log('🧪 Testing AI Analysis with Cached Data');
        console.log('=====================================\n');

        try {
            // Load test data
            const videos = TestDataFetcher.loadTestData(sampleSize);
            console.log(`📊 Using ${videos.length} cached videos\n`);

            // Sample user interests for testing
            const testUserInterests = {
                'AI': {
                    priority: 9,
                    keywords: ['artificial intelligence', 'machine learning', 'neural networks'],
                    subcategories: {
                        'LLM': {
                            priority: 8,
                            keywords: ['large language model', 'gpt', 'transformer', 'llama']
                        },
                        'Computer Vision': {
                            priority: 7,
                            keywords: ['image recognition', 'opencv', 'deep learning']
                        }
                    }
                },
                'Programming': {
                    priority: 8,
                    keywords: ['javascript', 'python', 'react', 'nodejs'],
                    subcategories: {
                        'Web Development': {
                            priority: 7,
                            keywords: ['frontend', 'backend', 'api', 'database']
                        }
                    }
                },
                'Cloud Computing': {
                    priority: 6,
                    keywords: ['aws', 'docker', 'kubernetes', 'microservices']
                }
            };

            // Test AI Analysis
            console.log('🔍 Running AI Analysis...');
            const startTime = Date.now();

            const analysisResult = await AIAnalysisService.analyzeContent(videos, testUserInterests);

            const endTime = Date.now();
            const processingTime = endTime - startTime;

            // Display results
            this.displayResults(analysisResult, processingTime, videos.length);

            // Test with Job Queue
            console.log('\n🔄 Testing with Job Queue...');
            await this.testJobQueue(videos, testUserInterests);

            return analysisResult;

        } catch (error) {
            console.error('❌ Test failed:', error);
            throw error;
        }
    }

    async testJobQueue(videos, userInterests) {
        const queue = new SimpleJobQueue();

        // Add analysis job
        const jobId = queue.addJob('AI_ANALYSIS', {
            videos: videos.slice(0, 10), // Use smaller batch for queue test
            userInterests
        });

        console.log(`📝 Added job to queue: ${jobId}`);

        // Process jobs
        const result = await queue.processJobs();
        console.log('✅ Job queue processing completed');
        console.log(`📊 Processed ${result.processed} jobs, ${result.failed} failed`);

        return result;
    }

    displayResults(result, processingTime, originalCount) {
        console.log('\n📈 Analysis Results');
        console.log('==================');

        console.log(`\n⏱️  Performance:`);
        console.log(`   Processing Time: ${processingTime}ms`);
        console.log(`   Cost per Item: $${result.costPerItem?.toFixed(6) || 0}`);
        console.log(`   Total Cost: $${result.cost?.total?.toFixed(6) || 0}`);

        console.log(`\n🔢 Stage Statistics:`);
        console.log(`   Original Videos: ${originalCount}`);
        console.log(`   Basic Filtered: ${result.stages?.basicFiltered || 0}`);
        console.log(`   Keyword Filtered: ${result.stages?.keywordFiltered || 0}`);
        console.log(`   Quality Scored: ${result.stages?.qualityScored || 0}`);
        console.log(`   Quick AI Analyzed: ${result.stages?.quickAnalyzed || 0}`);
        console.log(`   Full AI Analyzed: ${result.stages?.fullyAnalyzed || 0}`);
        console.log(`   Final Results: ${result.analyzedContent?.length || 0}`);

        console.log(`\n💰 Cost Breakdown:`);
        if (result.cost?.breakdown) {
            Object.entries(result.cost.breakdown).forEach(([stage, cost]) => {
                console.log(`   ${stage}: $${cost.toFixed(6)}`);
            });
        }

        console.log(`\n🎯 Top Results:`);
        if (result.analyzedContent?.length > 0) {
            result.analyzedContent.slice(0, 5).forEach((content, index) => {
                console.log(`   ${index + 1}. ${content.title.substring(0, 60)}...`);
                console.log(`      Score: ${content.finalRelevanceScore?.toFixed(3)} | Stage: ${content.processingStage}`);
            });
        } else {
            console.log('   No relevant content found');
        }

        // Filtering efficiency
        const efficiency = originalCount > 0 ?
            ((originalCount - (result.analyzedContent?.length || 0)) / originalCount * 100).toFixed(1) : 0;
        console.log(`\n📊 Filtering Efficiency: ${efficiency}% of content filtered out`);
    }

    async runPerformanceTest() {
        console.log('\n🏃 Performance Test');
        console.log('==================');

        const sizes = ['small', 'medium'];
        const results = {};

        for (const size of sizes) {
            console.log(`\n🔍 Testing with ${size} dataset...`);

            const startTime = Date.now();
            const result = await this.testWithCachedData(size);
            const endTime = Date.now();

            results[size] = {
                processingTime: endTime - startTime,
                totalCost: result.cost?.total || 0,
                resultCount: result.analyzedContent?.length || 0,
                stages: result.stages
            };
        }

        console.log('\n📊 Performance Comparison:');
        Object.entries(results).forEach(([size, data]) => {
            console.log(`\n${size.toUpperCase()}:`);
            console.log(`   Time: ${data.processingTime}ms`);
            console.log(`   Cost: $${data.totalCost.toFixed(6)}`);
            console.log(`   Results: ${data.resultCount}`);
        });

        return results;
    }
}

// CLI execution
if (require.main === module) {
    const tester = new AIAnalysisTester();

    async function main() {
        const args = process.argv.slice(2);
        const sampleSize = args[0] || 'small';
        const isPerformanceTest = args.includes('--performance');

        if (isPerformanceTest) {
            await tester.runPerformanceTest();
        } else {
            await tester.testWithCachedData(sampleSize);
        }
    }

    main().catch(console.error);
}

module.exports = AIAnalysisTester;
