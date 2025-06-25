/**
 * Cost-Effective AI Analysis Service
 * Multi-stage filtering to minimize AI costs while maximizing relevance
 * Stage 1: Basic filtering (FREE)
 * Stage 2: Keyword relevance (FREE)
 * Stage 3: Simple content scoring (FREE)
 * Stage 4: OpenAI quick analysis (LOW COST)
 * Stage 5: OpenAI detailed analysis (HIGH COST - LIMITED)
 */

const OpenAI = require('openai');

class AIAnalysisService {
    constructor() {
        // Don't initialize OpenAI in constructor to avoid import issues
        this.openai = null;

        this.config = {
            minTitleRelevance: 0.3,
            minDescriptionLength: 50,
            maxDescriptionLength: 5000,
            keywordMatchThreshold: 2,
            batchSize: 5, // Smaller batches for OpenAI
            quickScoreThreshold: 0.6,
            maxFullAnalysis: 3, // Limit expensive full analysis
            fullAnalysisThreshold: 0.8,
            minDurationSeconds: 120, // 2 minutes minimum
            maxDurationSeconds: 7200 // 2 hours maximum
        };

        // Expanded irrelevant content filters
        this.irrelevantKeywords = [
            'clickbait', 'drama', 'gossip', 'scandal', 'reaction', 'react',
            'unboxing', 'haul', 'vlog', 'daily life', 'random', 'asmr',
            'weird', 'crazy', 'insane', 'shocking', 'you won\'t believe',
            'prank', 'challenge', 'tiktok', 'shorts', 'meme', 'funny',
            'entertainment only', 'just for fun', 'random thoughts'
        ];

        // Quality content indicators
        this.qualityIndicators = [
            'tutorial', 'guide', 'explanation', 'analysis', 'research',
            'study', 'science', 'technology', 'learning', 'education',
            'how to', 'deep dive', 'comprehensive', 'detailed', 'expert',
            'course', 'lesson', 'technical', 'professional', 'industry',
            'case study', 'best practices', 'methodology', 'framework'
        ];

        // Educational/Professional domains
        this.professionalDomains = [
            'programming', 'software', 'development', 'engineering', 'design',
            'business', 'marketing', 'finance', 'data science', 'ai', 'ml',
            'machine learning', 'artificial intelligence', 'cybersecurity',
            'cloud computing', 'devops', 'architecture', 'management'
        ];
    }

    async analyzeContent(contentBatch, userInterests) {
        console.log(`Starting cost-effective analysis for ${contentBatch.length} items`);

        const startTime = Date.now();
        let totalCost = 0;

        // Stage 1: Basic content filtering (FREE)
        const basicFiltered = this.stage1_basicFilter(contentBatch);
        console.log(`Stage 1 (Basic Filter): ${basicFiltered.length}/${contentBatch.length} passed`);

        if (basicFiltered.length === 0) {
            return {
                analyzedContent: [],
                cost: { total: 0, breakdown: { basicFilter: 0 } },
                stage: 'basic_filter',
                stages: { basicFiltered: 0 }
            };
        }

        // Stage 2: Keyword relevance matching (FREE)
        const keywordFiltered = this.stage2_keywordFilter(basicFiltered, userInterests);
        console.log(`Stage 2 (Keyword Filter): ${keywordFiltered.length}/${basicFiltered.length} passed`);

        if (keywordFiltered.length === 0) {
            return {
                analyzedContent: [],
                cost: { total: 0, breakdown: { basicFilter: 0, keywordFilter: 0 } },
                stage: 'keyword_filter',
                stages: { basicFiltered: basicFiltered.length, keywordFiltered: 0 }
            };
        }

        // Stage 3: Content quality scoring (FREE)
        const qualityScored = this.stage3_qualityScoring(keywordFiltered, userInterests);
        console.log(`Stage 3 (Quality Scoring): ${qualityScored.length} items scored`);

        // Stage 4: OpenAI Quick Analysis (LOW COST)
        const quickAnalyzed = await this.stage4_openaiQuickAnalysis(qualityScored, userInterests);
        const quickAnalysisCost = quickAnalyzed.length * 0.002; // Estimated cost per item
        totalCost += quickAnalysisCost;
        console.log(`Stage 4 (OpenAI Quick): ${quickAnalyzed.length} items analyzed (Cost: $${quickAnalysisCost.toFixed(4)})`);

        // Stage 5: OpenAI Full Analysis for top candidates (HIGH COST - LIMITED)
        const topCandidates = quickAnalyzed
            .filter(content => content.quickAiScore >= this.config.fullAnalysisThreshold)
            .sort((a, b) => b.quickAiScore - a.quickAiScore)
            .slice(0, this.config.maxFullAnalysis);

        const fullyAnalyzed = await this.stage5_openaiFullAnalysis(topCandidates, userInterests);
        const fullAnalysisCost = fullyAnalyzed.length * 0.05; // Estimated cost per item
        totalCost += fullAnalysisCost;
        console.log(`Stage 5 (OpenAI Full): ${fullyAnalyzed.length} items analyzed (Cost: $${fullAnalysisCost.toFixed(4)})`);

        // Combine results
        const results = this.combineResults(quickAnalyzed, fullyAnalyzed);
        const processingTime = Date.now() - startTime;

        return {
            analyzedContent: results,
            cost: {
                total: totalCost,
                breakdown: {
                    basicFilter: 0,
                    keywordFilter: 0,
                    qualityScoring: 0,
                    quickAnalysis: quickAnalysisCost,
                    fullAnalysis: fullAnalysisCost
                }
            },
            stages: {
                basicFiltered: basicFiltered.length,
                keywordFiltered: keywordFiltered.length,
                qualityScored: qualityScored.length,
                quickAnalyzed: quickAnalyzed.length,
                fullyAnalyzed: fullyAnalyzed.length
            },
            processingTime: processingTime,
            costPerItem: results.length > 0 ? totalCost / results.length : 0
        };
    }

    stage1_basicFilter(contentBatch) {
        return contentBatch.filter(content => {
            // Basic validation
            if (!content.title || content.title.length < 10) {
                console.log(`Filtered out - Title too short: ${content.title}`);
                return false;
            }

            if (!content.description || content.description.length < this.config.minDescriptionLength) {
                console.log(`Filtered out - Description too short: ${content.title}`);
                return false;
            }

            if (content.description.length > this.config.maxDescriptionLength) {
                console.log(`Filtered out - Description too long: ${content.title}`);
                return false;
            }

            const text = (content.title + ' ' + content.description).toLowerCase();

            // Filter out irrelevant content
            const hasIrrelevantKeywords = this.irrelevantKeywords.some(keyword =>
                text.includes(keyword.toLowerCase())
            );

            if (hasIrrelevantKeywords) {
                console.log(`Filtered out - Contains irrelevant keywords: ${content.title}`);
                return false;
            }

            // Check for quality indicators
            const hasQualityIndicators = this.qualityIndicators.some(indicator =>
                text.includes(indicator.toLowerCase())
            );

            // Check for professional domains
            const hasProfessionalContent = this.professionalDomains.some(domain =>
                text.includes(domain.toLowerCase())
            );

            // Duration filtering
            if (content.duration) {
                const duration = this.parseDuration(content.duration);
                if (duration < this.config.minDurationSeconds || duration > this.config.maxDurationSeconds) {
                    console.log(`Filtered out - Duration out of range: ${content.title} (${duration}s)`);
                    return false;
                }
            }

            // Must have quality indicators, professional content, or high view count
            const hasEngagement = (content.viewCount && content.viewCount > 10000);
            const passes = hasQualityIndicators || hasProfessionalContent || hasEngagement;

            if (!passes) {
                console.log(`Filtered out - No quality indicators: ${content.title}`);
            }

            return passes;
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

    stage3_qualityScoring(contentBatch, userInterests) {
        return contentBatch.map(content => {
            const qualityScore = this.calculateQualityScore(content);
            const interestAlignment = this.calculateInterestAlignment(content, userInterests);

            return {
                ...content,
                qualityScore,
                interestAlignment,
                combinedScore: (qualityScore * 0.4) + (content.keywordRelevance * 0.4) + (interestAlignment * 0.2)
            };
        }).sort((a, b) => b.combinedScore - a.combinedScore);
    }

    async stage4_openaiQuickAnalysis(contentBatch, userInterests) {
        const results = [];

        for (let i = 0; i < contentBatch.length; i += this.config.batchSize) {
            const batch = contentBatch.slice(i, i + this.config.batchSize);
            try {
                const batchResults = await this.performQuickOpenAIAnalysis(batch, userInterests);
                results.push(...batchResults);
            } catch (error) {
                console.error('OpenAI Quick Analysis failed for batch:', error.message);
                // Fallback to quality score if OpenAI fails
                const fallbackResults = batch.map(content => ({
                    ...content,
                    quickAiScore: content.combinedScore,
                    aiAnalyzed: false,
                    fallback: true
                }));
                results.push(...fallbackResults);
            }
        }

        return results;
    }

    async stage5_openaiFullAnalysis(topCandidates, userInterests) {
        const results = [];

        for (const content of topCandidates) {
            try {
                console.log(`Performing full OpenAI analysis for: ${content.title}`);
                const fullAnalysis = await this.performFullOpenAIAnalysis(content, userInterests);
                results.push({
                    ...content,
                    fullAnalysis,
                    finalRelevanceScore: fullAnalysis.relevanceScore,
                    highlights: fullAnalysis.highlights,
                    categories: fullAnalysis.categories,
                    aiProcessed: true,
                    processingStage: 'full_ai'
                });
            } catch (error) {
                console.error('Full OpenAI analysis failed for content:', content.id, error.message);
                results.push({
                    ...content,
                    finalRelevanceScore: content.quickAiScore,
                    aiProcessed: false,
                    error: 'Full analysis failed',
                    processingStage: 'quick_ai_only'
                });
            }
        }

        return results;
    }

    async performQuickOpenAIAnalysis(batch, userInterests) {
        const interestsText = this.formatUserInterests(userInterests);

        const prompt = `Analyze the following YouTube content items for relevance to user interests: ${interestsText}

Content to analyze:
${batch.map((content, index) => `
${index + 1}. Title: ${content.title}
   Description: ${content.description.substring(0, 300)}...
   Channel: ${content.channelTitle}
`).join('\n')}

For each item, provide a relevance score (0.0 to 1.0) based on:
1. How well it matches the user's interests
2. Content quality and educational value
3. Likelihood to be valuable to the user

Respond with only a JSON array of scores: [0.85, 0.23, 0.91, ...]`;

        try {
            const response = await this.getOpenAIClient().chat.completions.create({
                model: "gpt-3.5-turbo",
                messages: [{ role: "user", content: prompt }],
                max_tokens: 200,
                temperature: 0.3
            });

            const scoresText = response.choices[0].message.content.trim();
            const scores = JSON.parse(scoresText);

            return batch.map((content, index) => ({
                ...content,
                quickAiScore: scores[index] || content.combinedScore,
                aiAnalyzed: true
            }));
        } catch (error) {
            console.error('OpenAI Quick Analysis parsing error:', error.message);
            throw error;
        }
    }

    async performFullOpenAIAnalysis(content, userInterests) {
        const interestsText = this.formatUserInterests(userInterests);

        const prompt = `Provide a detailed analysis of this YouTube content for a user interested in: ${interestsText}

Content:
Title: ${content.title}
Description: ${content.description}
Channel: ${content.channelTitle}
Duration: ${content.duration}

Provide analysis in JSON format:
{
    "relevanceScore": 0.0-1.0,
    "summary": "brief summary of content value",
    "categories": ["category1", "category2"],
    "highlights": [
        {"text": "key point", "relevance": 0.9, "reason": "why relevant"}
    ],
    "tags": ["tag1", "tag2"],
    "sentiment": "positive/neutral/negative",
    "complexity": "beginner/intermediate/advanced",
    "estimated_watch_time": "time to get value",
    "keyPoints": ["point1", "point2"],
    "recommendationReason": "why this matches user interests"
}`;

        const response = await this.getOpenAIClient().chat.completions.create({
            model: "gpt-4",
            messages: [{ role: "user", content: prompt }],
            max_tokens: 800,
            temperature: 0.3
        });

        const analysisText = response.choices[0].message.content.trim();
        return JSON.parse(analysisText);
    }

    /**
     * Analyze video relevance using OpenAI (first filter step)
     * Uses only title and keywords to minimize token usage and cost
     */
    async analyzeVideoRelevance(videoContent, userInterests) {
        const interestsText = this.formatUserInterests(userInterests);

        const prompt = `Analyze if this YouTube video is relevant to the user's interests: ${interestsText}

Video Information:
Title: ${videoContent.title}
Channel: ${videoContent.channelTitle}
Duration: ${videoContent.duration}
Key Topics: ${videoContent.keywords.slice(0, 15).join(', ')}

Rate the relevance from 0.0 to 1.0 and determine if it should be processed further.
Consider:
1. Direct match with user interests
2. Educational/professional value
3. Practical applicability
4. Content quality indicators

Respond with JSON only:
{
  "relevanceScore": 0.85,
  "isRelevant": true,
  "reasoning": "Brief explanation of why it's relevant/not relevant",
  "keyTopics": ["topic1", "topic2"]
}`;

        try {
            const response = await this.getOpenAIClient().chat.completions.create({
                model: 'gpt-3.5-turbo',
                messages: [{ role: 'user', content: prompt }],
                max_tokens: 150,
                temperature: 0.1
            });

            const result = JSON.parse(response.choices[0].message.content);
            const cost = this.calculateCost(response.usage.total_tokens, 'gpt-3.5-turbo');

            return {
                relevanceScore: result.relevanceScore || 0,
                isRelevant: result.isRelevant || false,
                reasoning: result.reasoning || '',
                keyTopics: result.keyTopics || [],
                cost: cost
            };
        } catch (error) {
            console.error('Relevance analysis failed:', error);
            // Return conservative relevance score
            return {
                relevanceScore: 0.3,
                isRelevant: false,
                reasoning: 'Analysis failed, marked as not relevant',
                keyTopics: [],
                cost: 0
            };
        }
    }

    /**
     * Perform detailed analysis on relevant videos using keywords
     */
    async performDetailedAnalysis(videoContent, userInterests) {
        const interestsText = this.formatUserInterests(userInterests);

        const prompt = `Perform detailed analysis of this relevant YouTube video for user interests: ${interestsText}

Video Information:
Title: ${videoContent.title}
Channel: ${videoContent.channelTitle}
Key Topics: ${videoContent.keywords.join(', ')}

Based on the title and key topics, provide detailed analysis including:
1. Comprehensive summary of likely content
2. Key learning points
3. Practical applications
4. Content categories
5. Sentiment analysis
6. Target audience

Respond with JSON only:
{
  "summary": "Detailed summary of the video content based on title and topics",
  "keyPoints": ["point1", "point2", "point3"],
  "sentiment": "positive/neutral/negative",
  "topics": ["topic1", "topic2"],
  "categories": ["category1", "category2"],
  "highlights": [
    {
      "text": "key topic or concept",
      "reason": "why this is important"
    }
  ],
  "practicalValue": "How this can be applied practically",
  "targetAudience": "Who would benefit most from this"
}`;

        try {
            const response = await this.getOpenAIClient().chat.completions.create({
                model: 'gpt-4',
                messages: [{ role: 'user', content: prompt }],
                max_tokens: 600,
                temperature: 0.2
            });

            const result = JSON.parse(response.choices[0].message.content);
            const cost = this.calculateCost(response.usage.total_tokens, 'gpt-4');

            return {
                summary: result.summary || '',
                keyPoints: result.keyPoints || [],
                sentiment: result.sentiment || 'neutral',
                topics: result.topics || [],
                categories: result.categories || [],
                highlights: result.highlights || [],
                practicalValue: result.practicalValue || '',
                targetAudience: result.targetAudience || '',
                cost: cost
            };
        } catch (error) {
            console.error('Detailed analysis failed:', error);
            return {
                summary: 'Detailed analysis failed',
                keyPoints: ['Analysis could not be completed'],
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

    /**
     * Calculate OpenAI API costs based on token usage
     */
    calculateCost(tokens, model) {
        const costs = {
            'gpt-3.5-turbo': 0.002 / 1000, // $0.002 per 1k tokens
            'gpt-4': 0.03 / 1000 // $0.03 per 1k tokens
        };

        return tokens * (costs[model] || costs['gpt-3.5-turbo']);
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

    calculateQualityScore(content) {
        const text = (content.title + ' ' + content.description).toLowerCase();
        let score = 0;

        // Quality indicators
        const qualityMatches = this.qualityIndicators.filter(indicator =>
            text.includes(indicator.toLowerCase())
        ).length;
        score += Math.min(qualityMatches * 0.1, 0.4);

        // Professional domain matches
        const domainMatches = this.professionalDomains.filter(domain =>
            text.includes(domain.toLowerCase())
        ).length;
        score += Math.min(domainMatches * 0.1, 0.3);

        // Channel quality (view count as proxy)
        if (content.viewCount) {
            if (content.viewCount > 100000) score += 0.2;
            else if (content.viewCount > 10000) score += 0.1;
        }

        // Duration quality (sweet spot for educational content)
        if (content.duration) {
            const duration = this.parseDuration(content.duration);
            if (duration >= 300 && duration <= 3600) { // 5 minutes to 1 hour
                score += 0.1;
            }
        }

        return Math.min(score, 1.0);
    }

    calculateInterestAlignment(content, userInterests) {
        if (!userInterests || Object.keys(userInterests).length === 0) return 0.5;

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

    formatUserInterests(userInterests) {
        if (Array.isArray(userInterests)) {
            return userInterests.join(', ');
        }

        if (typeof userInterests === 'object') {
            return Object.keys(userInterests).map(interest => {
                const data = userInterests[interest];
                const priority = data?.priority || 5;
                return `${interest} (priority: ${priority})`;
            }).join(', ');
        }

        return 'general technology and learning';
    }

    combineResults(quickAnalyzed, fullyAnalyzed) {
        const fullyAnalyzedIds = new Set(fullyAnalyzed.map(c => c.id));

        const combined = [
            ...fullyAnalyzed,
            ...quickAnalyzed
                .filter(c => !fullyAnalyzedIds.has(c.id))
                .map(c => ({
                    ...c,
                    finalRelevanceScore: c.quickAiScore || c.combinedScore,
                    aiProcessed: c.aiAnalyzed || false,
                    processingStage: c.aiAnalyzed ? 'quick_ai' : 'keyword_filtered'
                }))
        ];

        return combined
            .sort((a, b) => b.finalRelevanceScore - a.finalRelevanceScore)
            .filter(c => c.finalRelevanceScore >= this.config.minTitleRelevance);
    }

    parseDuration(duration) {
        if (!duration || typeof duration !== 'string') {
            return 0;
        }

        const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
        if (!match) {
            return 0;
        }

        const hours = parseInt(match[1] || '0');
        const minutes = parseInt(match[2] || '0');
        const seconds = parseInt(match[3] || '0');

        return hours * 3600 + minutes * 60 + seconds;
    }

    // Additional method for scoring transcript segments
    async scoreSegmentsForUser(segments, userInterests) {
        try {
            const interestsText = this.formatUserInterests(userInterests);

            const prompt = `Score these video transcript segments (0.0-1.0) based on relevance to user interests: ${interestsText}

Segments:
${segments.slice(0, 10).map((seg, i) => `${i + 1}. ${seg.text.substring(0, 200)}`).join('\n')}

Return only a JSON array of scores: [0.8, 0.3, 0.9, ...]`;

            const response = await this.getOpenAIClient().chat.completions.create({
                model: "gpt-3.5-turbo",
                messages: [{ role: "user", content: prompt }],
                max_tokens: 150,
                temperature: 0.3
            });

            const scoresText = response.choices[0].message.content.trim();
            const scores = JSON.parse(scoresText);

            // Extend scores array to match segments length if needed
            while (scores.length < segments.length) {
                scores.push(0.5);
            }

            return scores;
        } catch (error) {
            console.error('Error scoring segments:', error.message);
            // Return default scores if OpenAI fails
            return segments.map(() => 0.5);
        }
    }

    getAnalysisStats() {
        return {
            config: this.config,
            irrelevantKeywords: this.irrelevantKeywords.length,
            qualityIndicators: this.qualityIndicators.length,
            professionalDomains: this.professionalDomains.length,
            openaiConfigured: !!process.env.OPENAI_API_KEY
        };
    }

    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        console.log('AI Analysis config updated:', this.config);
    }

    // Initialize OpenAI client when needed
    getOpenAIClient() {
        if (!this.openai) {
            this.openai = new OpenAI({
                apiKey: process.env.OPENAI_API_KEY
            });
        }
        return this.openai;
    }
}

module.exports = new AIAnalysisService();