// Simple in-memory job queue for development/testing without Redis
const YouTubeService = require('./YouTubeService');
const AIAnalysisService = require('./AIAnalysisService');
const User = require('../models/User');
const Content = require('../models/Content');
const UserContent = require('../models/UserContent');

class SimpleJobQueue {
    constructor() {
        this.jobs = new Map();
        this.activeJobs = new Map();
        this.jobId = 0;
        this.isProcessing = false;
        this.setupProcessor();
    }

    setupProcessor() {
        // Process jobs every 5 seconds
        setInterval(() => {
            if (!this.isProcessing && this.jobs.size > 0) {
                this.processNextJob();
            }
        }, 5000);
    }

    async processNextJob() {
        if (this.jobs.size === 0) return;

        this.isProcessing = true;
        const [jobId, job] = this.jobs.entries().next().value;
        this.jobs.delete(jobId);
        this.activeJobs.set(jobId, job);

        try {
            console.log(`Processing job ${jobId}: ${job.type}`);

            switch (job.type) {
                case 'process-video':
                    await this.processVideo(job.data.videoId, job.data.videoData, job.data.userIds);
                    break;
                case 'monitor-channels':
                    await this.monitorAllChannels();
                    break;
                case 'process-user-subscriptions':
                    await this.processUserSubscriptions(job.data.userId);
                    break;
            }

            this.activeJobs.delete(jobId);
            console.log(`Job ${jobId} completed successfully`);

        } catch (error) {
            console.error(`Job ${jobId} failed:`, error);
            this.activeJobs.delete(jobId);
        }

        this.isProcessing = false;
    }

    async processVideo(videoId, videoData, userIds = []) {
        try {
            console.log(`Processing video: ${videoId}`);

            // Validate input data
            if (!videoData || !videoData.title) {
                console.error(`Invalid video data for video: ${videoId}`);
                return { success: false, error: 'Invalid video data' };
            }

            // Ensure required fields have default values
            videoData = {
                title: videoData.title || 'Unknown Title',
                description: videoData.description || '',
                channelId: videoData.channelId || '',
                channelTitle: videoData.channelTitle || 'Unknown Channel',
                duration: videoData.duration || 'PT0S',
                publishedAt: videoData.publishedAt || new Date().toISOString(),
                viewCount: videoData.viewCount || 0,
                thumbnails: videoData.thumbnails || {},
                ...videoData
            };

            // Check if content already exists
            let content = await Content.findOne({ videoId });

            if (!content) {
                // Try to get transcript (may fail for some videos)
                let transcript = [];
                try {
                    transcript = await YouTubeService.getVideoTranscript(videoId);
                    // Ensure transcript is always an array
                    if (!transcript || !Array.isArray(transcript)) {
                        transcript = [];
                    }
                } catch (error) {
                    console.log(`No transcript available for video: ${videoId} - ${error.message}`);
                    transcript = [];
                }

                if (transcript.length === 0) {
                    // Create content without transcript for testing
                    transcript = [{
                        text: `Sample transcript for ${videoData.title}. This would normally contain the actual video transcript for AI analysis.`,
                        start: 0,
                        duration: 10
                    }];
                }                // Step 1: List and display video information
                console.log(`\n=== VIDEO ANALYSIS START ===`);
                console.log(`Title: ${videoData.title}`);
                console.log(`Channel: ${videoData.channelTitle}`);
                console.log(`Duration: ${videoData.duration}`);
                console.log(`Published: ${videoData.publishedAt}`);
                console.log(`Views: ${videoData.viewCount || 0}`);

                // Step 2: Extract keywords from transcript (free method, very low token usage)
                const extractedKeywords = this.extractKeywordsFromTranscript(transcript);
                console.log(`Transcript processed: ${transcript.length} segments -> ${extractedKeywords.length} keywords`);
                console.log(`Keywords: ${extractedKeywords.slice(0, 10).join(', ')}${extractedKeywords.length > 10 ? '...' : ''}`);

                // Step 3: Get user interests for relevance analysis
                const users = await User.find({
                    'youtubeSources.channelId': videoData.channelId
                });
                const aggregatedInterests = this.aggregateUserInterests(users);

                // Step 4: Use OpenAI to analyze video relevance with keywords only
                let analysis;
                try {
                    console.log(`Starting OpenAI relevance analysis for video: ${videoId}`);

                    const relevanceAnalysis = await AIAnalysisService.analyzeVideoRelevance({
                        id: videoId,
                        title: videoData.title,
                        keywords: extractedKeywords,
                        duration: videoData.duration,
                        viewCount: videoData.viewCount || 0,
                        channelTitle: videoData.channelTitle,
                        publishedAt: videoData.publishedAt
                    }, aggregatedInterests);

                    console.log(`Relevance Analysis completed - Score: ${relevanceAnalysis.relevanceScore} - Cost: $${relevanceAnalysis.cost.toFixed(4)}`);

                    // Step 5: If relevant, perform detailed analysis
                    if (relevanceAnalysis.isRelevant) {
                        console.log(`Video is relevant, performing detailed analysis...`);

                        const detailedAnalysis = await AIAnalysisService.performDetailedAnalysis({
                            id: videoId,
                            title: videoData.title,
                            keywords: extractedKeywords,
                            channelTitle: videoData.channelTitle
                        }, aggregatedInterests);

                        analysis = {
                            segments: transcript.map(t => ({
                                ...t,
                                relevanceScore: relevanceAnalysis.relevanceScore,
                                topics: detailedAnalysis.topics || ['general']
                            })),
                            analysis: {
                                summary: detailedAnalysis.summary || `Analysis of ${videoData.title}`,
                                sentiment: detailedAnalysis.sentiment || 'neutral',
                                keyPoints: detailedAnalysis.keyPoints || [],
                                relevanceScore: relevanceAnalysis.relevanceScore,
                                processingCost: relevanceAnalysis.cost + (detailedAnalysis.cost || 0),
                                processingStage: 'detailed_analysis',
                                extractedKeywords: extractedKeywords
                            },
                            highlights: detailedAnalysis.highlights || transcript.slice(0, 2).map(t => ({
                                ...t,
                                reason: 'High relevance to user interests',
                                relevance: relevanceAnalysis.relevanceScore
                            })),
                            topics: detailedAnalysis.topics || ['general'],
                            categories: detailedAnalysis.categories || ['General'],
                            costEffectiveAnalysis: {
                                totalCost: relevanceAnalysis.cost + (detailedAnalysis.cost || 0),
                                stagesCompleted: 2,
                                aiProcessed: true,
                                relevanceScore: relevanceAnalysis.relevanceScore,
                                isRelevant: true,
                                keywordCount: extractedKeywords.length
                            }
                        };
                    } else {
                        // Content not relevant - skip detailed analysis
                        console.log(`Video not relevant (score: ${relevanceAnalysis.relevanceScore}), skipping detailed analysis`);
                        analysis = {
                            segments: [],
                            analysis: {
                                summary: 'Video filtered out due to low relevance',
                                sentiment: 'neutral',
                                keyPoints: ['Video did not meet relevance threshold'],
                                relevanceScore: relevanceAnalysis.relevanceScore,
                                processingCost: relevanceAnalysis.cost,
                                processingStage: 'relevance_filtered',
                                extractedKeywords: extractedKeywords
                            },
                            highlights: [],
                            topics: [],
                            categories: [],
                            costEffectiveAnalysis: {
                                totalCost: relevanceAnalysis.cost,
                                stagesCompleted: 1,
                                aiProcessed: false,
                                relevanceScore: relevanceAnalysis.relevanceScore,
                                isRelevant: false,
                                filtered: true,
                                keywordCount: extractedKeywords.length
                            }
                        };
                    }
                } catch (error) {
                    console.log(`AI analysis failed for video: ${videoId} - ${error.message}`);
                    // Create fallback analysis for testing
                    const extractedKeywords = this.extractKeywordsFromTranscript(transcript);
                    analysis = {
                        segments: transcript.map(t => ({
                            ...t,
                            relevanceScore: 0.5,
                            topics: ['general']
                        })),
                        analysis: {
                            summary: `Fallback analysis of ${videoData.title}`,
                            sentiment: 'neutral',
                            keyPoints: ['Analysis failed, using fallback'],
                            relevanceScore: 0.5,
                            processingCost: 0,
                            processingStage: 'fallback',
                            extractedKeywords: extractedKeywords
                        },
                        highlights: transcript.slice(0, 2).map(t => ({
                            ...t,
                            reason: 'Fallback highlight'
                        })),
                        topics: ['general'],
                        categories: ['General']
                    };
                }

                console.log(`=== VIDEO ANALYSIS COMPLETE ===\n`);

                // Create content record
                content = new Content({
                    title: videoData.title,
                    description: videoData.description || '',
                    url: `https://www.youtube.com/watch?v=${videoId}`,
                    source: 'youtube', // Required field
                    sourceId: videoId, // YouTube video ID
                    sourceChannel: {
                        id: videoData.channelId,
                        name: videoData.channelTitle
                    },
                    thumbnail: videoData.thumbnails?.medium?.url || videoData.thumbnails?.default?.url,
                    publishedAt: new Date(videoData.publishedAt),
                    duration: this.parseDuration(videoData.duration), // Convert to seconds
                    transcript: {
                        text: transcript.map(t => t.text).join(' '), // Use full transcript for storage
                        segments: transcript.map(t => ({
                            start: t.start || 0,
                            end: t.end || (t.start || 0) + (t.duration || 0),
                            text: t.text,
                            topics: t.topics || [],
                            relevanceScore: t.relevanceScore || 0
                        })),
                        // Store extracted keywords for analysis
                        extractedKeywords: this.extractKeywordsFromTranscript(transcript)
                    },
                    analysis: {
                        mainTopics: analysis.topics || [],
                        summary: analysis.analysis?.summary || '',
                        highlights: analysis.highlights || [],
                        keyPoints: analysis.analysis?.keyPoints || [],
                        sentiment: analysis.analysis?.sentiment || 'neutral',
                        complexity: analysis.analysis?.complexity || 5,
                        overallRelevanceScore: (analysis.analysis?.relevanceScore || 0) * 100
                    },
                    processed: true,
                    processingError: null
                });

                await content.save();
                console.log(`Content created for video: ${videoId}`);
            }

            // Create personalized content for specified users
            // NOTE: At this point, relevance has already been calculated in batch processing
            // Only videos that passed the relevance filter should reach this point
            let targetUsers = userIds;
            if (!targetUsers || targetUsers.length === 0) {
                const users = await User.find({
                    'youtubeSources.channelId': videoData.channelId
                });
                targetUsers = users.map(u => u._id.toString());
            }

            if (targetUsers.length === 0) {
                console.log(`No target users found for video: ${videoId}`);
                return { success: true, reason: 'No target users' };
            }

            // Create UserContent entries with relevance scoring
            const userContentPromises = targetUsers.map(async (userId) => {
                const existingUserContent = await UserContent.findOne({
                    userId,
                    contentId: content._id
                });

                if (existingUserContent) {
                    return existingUserContent;
                }

                const user = await User.findById(userId);
                if (!user) return null;

                // Use relevance score from content analysis (already calculated in batch)
                // If this video reached processVideo, it means it passed relevance filtering
                const relevanceScore = content.analysis?.overallRelevanceScore
                    ? content.analysis.overallRelevanceScore / 100  // Convert back to 0-1 scale
                    : 0.8; // Default high score for videos that passed batch filtering

                const threshold = parseFloat(process.env.RELEVANCE_THRESHOLD) || 0.6;
                if (relevanceScore >= threshold) {
                    // Calculate matched interests between user and content
                    const matchedInterests = this.calculateMatchedInterests(user.interests, content);

                    // Generate personalized highlights based on user interests
                    const personalizedHighlights = this.generatePersonalizedHighlights(content, user.interests);

                    const userContent = new UserContent({
                        userId,
                        contentId: content._id,
                        relevanceScore,
                        matchedInterests,
                        personalizedHighlights,
                        createdAt: new Date()
                    });
                    await userContent.save();
                    return userContent;
                }

                return null;
            });

            const userContentResults = await Promise.all(userContentPromises);
            const createdUserContent = userContentResults.filter(uc => uc !== null);

            console.log(`Created ${createdUserContent.length} UserContent entries for video: ${videoId}`);

            return {
                success: true,
                contentId: content._id,
                userContentCount: createdUserContent.length
            };

        } catch (error) {
            console.error(`Error processing video ${videoId}:`, error);
            throw error;
        }
    }

    async processUserSubscriptions(userId) {
        try {
            console.log(`Processing subscriptions for user: ${userId}`);

            const user = await User.findById(userId);
            if (!user || !user.youtubeSources || user.youtubeSources.length === 0) {
                return { success: false, reason: 'No YouTube sources found' };
            }

            // Step 1: Collect all videos from all channels first
            console.log('\n=== BATCH VIDEO COLLECTION ===');
            const allVideos = [];
            const channelResults = [];

            for (const source of user.youtubeSources) {
                try {
                    let videos = [];
                    try {
                        videos = await YouTubeService.getChannelVideos(source.channelId, 5);
                    } catch (error) {
                        console.log(`Failed to get videos from ${source.channelId}, creating mock data`);
                        videos = [{
                            id: `mock_${Date.now()}_${Math.random()}`,
                            title: `Mock Video from ${source.channelTitle}`,
                            description: 'Mock video description for testing',
                            channelId: source.channelId,
                            channelTitle: source.channelTitle,
                            publishedAt: new Date().toISOString(),
                            duration: 'PT10M30S',
                            thumbnails: {
                                default: { url: 'https://i.ytimg.com/vi/mock/default.jpg' }
                            }
                        }];
                    }

                    // Filter out videos that already exist
                    const newVideos = [];
                    for (const video of videos) {
                        const existingContent = await Content.findOne({
                            videoId: video.id,
                            processedAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
                        });

                        if (!existingContent) {
                            newVideos.push(video);
                        }
                    }

                    allVideos.push(...newVideos);
                    channelResults.push({
                        channelId: source.channelId,
                        channelTitle: source.channelTitle,
                        videosFound: newVideos.length
                    });

                } catch (error) {
                    console.error(`Error collecting videos from channel ${source.channelId}:`, error);
                    channelResults.push({
                        channelId: source.channelId,
                        channelTitle: source.channelTitle,
                        error: error.message
                    });
                }
            }

            if (allVideos.length === 0) {
                console.log('No new videos found to process');
                return {
                    success: true,
                    userId,
                    totalVideosQueued: 0,
                    channelResults
                };
            }

            console.log(`Found ${allVideos.length} new videos across ${user.youtubeSources.length} channels`);

            // Step 2: Extract keywords from all videos
            console.log('\n=== BATCH KEYWORD EXTRACTION ===');
            const videosWithKeywords = await this.extractKeywordsFromAllVideos(allVideos);

            // Step 3: Get user interests for batch analysis
            const aggregatedInterests = this.aggregateUserInterests([user]);

            // Step 4: Batch relevance analysis
            console.log('\n=== BATCH RELEVANCE ANALYSIS ===');
            const relevanceResults = await this.batchAnalyzeRelevance(videosWithKeywords, aggregatedInterests);

            // Step 5: Process videos based on relevance results
            console.log('\n=== PROCESSING RELEVANT VIDEOS ===');
            let processedCount = 0;

            for (const result of relevanceResults) {
                if (result.isRelevant) {
                    console.log(`✅ Processing relevant video: ${result.video.title}`);
                    await this.queueVideoProcessing(result.video.id, result.video, [userId]);
                    processedCount++;
                } else {
                    console.log(`❌ Skipping irrelevant video: ${result.video.title} (score: ${result.relevanceScore})`);
                }
            }

            console.log(`\n=== BATCH PROCESSING COMPLETE ===`);
            console.log(`Total videos analyzed: ${allVideos.length}`);
            console.log(`Relevant videos queued: ${processedCount}`);
            console.log(`Videos filtered out: ${allVideos.length - processedCount}`);

            return {
                success: true,
                userId,
                totalVideosAnalyzed: allVideos.length,
                totalVideosQueued: processedCount,
                relevanceResults: relevanceResults.map(r => ({
                    videoId: r.video.id,
                    title: r.video.title,
                    relevanceScore: r.relevanceScore,
                    isRelevant: r.isRelevant,
                    reasoning: r.reasoning
                })),
                channelResults
            };

        } catch (error) {
            console.error(`Error processing user subscriptions ${userId}:`, error);
            throw error;
        }
    }

    async monitorAllChannels() {
        try {
            console.log('Starting channel monitoring for all users');

            const users = await User.find({
                'youtubeSources.0': { $exists: true }
            });

            const channelMap = new Map();

            users.forEach(user => {
                user.youtubeSources.forEach(source => {
                    if (!channelMap.has(source.channelId)) {
                        channelMap.set(source.channelId, {
                            channelId: source.channelId,
                            channelTitle: source.channelTitle,
                            users: []
                        });
                    }
                    channelMap.get(source.channelId).users.push(user._id.toString());
                });
            });

            let totalProcessed = 0;
            const results = [];

            for (const [channelId, channelData] of channelMap) {
                try {
                    let videos = [];
                    try {
                        videos = await YouTubeService.getChannelVideos(channelId, 3);
                    } catch (error) {
                        console.log(`Failed to get videos from ${channelId}, creating mock data`);
                        videos = [{
                            id: `mock_monitor_${Date.now()}_${Math.random()}`,
                            title: `Recent Mock Video from ${channelData.channelTitle}`,
                            description: 'Mock video for channel monitoring test',
                            channelId: channelId,
                            channelTitle: channelData.channelTitle,
                            publishedAt: new Date().toISOString(),
                            duration: 'PT15M20S',
                            thumbnails: {
                                default: { url: 'https://i.ytimg.com/vi/mock/default.jpg' }
                            }
                        }];
                    }

                    let channelProcessed = 0;
                    for (const video of videos) {
                        const videoDate = new Date(video.publishedAt);
                        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

                        if (videoDate >= sevenDaysAgo) {
                            const existingContent = await Content.findOne({ videoId: video.id });

                            if (!existingContent) {
                                await this.queueVideoProcessing(video.id, video, channelData.users);
                                channelProcessed++;
                            }
                        }
                    }

                    results.push({
                        channelId,
                        channelTitle: channelData.channelTitle,
                        userCount: channelData.users.length,
                        videosQueued: channelProcessed
                    });

                    totalProcessed += channelProcessed;

                } catch (error) {
                    console.error(`Error monitoring channel ${channelId}:`, error);
                    results.push({
                        channelId,
                        error: error.message
                    });
                }
            }

            console.log(`Channel monitoring complete. Queued ${totalProcessed} videos from ${channelMap.size} channels`);

            return {
                success: true,
                totalVideosQueued: totalProcessed,
                channelsMonitored: channelMap.size,
                results
            };

        } catch (error) {
            console.error('Error in channel monitoring:', error);
            throw error;
        }
    }

    // Queue management methods
    async queueVideoProcessing(videoId, videoData, userIds = []) {
        const jobId = ++this.jobId;
        const job = {
            id: jobId,
            type: 'process-video',
            data: { videoId, videoData, userIds },
            createdAt: new Date(),
            status: 'queued'
        };

        this.jobs.set(jobId, job);
        console.log(`Queued video processing job ${jobId} for video ${videoId}`);

        return job;
    }

    async queueChannelMonitoring() {
        const jobId = ++this.jobId;
        const job = {
            id: jobId,
            type: 'monitor-channels',
            data: {},
            createdAt: new Date()
        };

        this.jobs.set(jobId, job);
        console.log(`Queued channel monitoring job ${jobId}`);
        return jobId;
    }

    /**
     * Queue user subscription processing
     */
    async queueUserSubscriptionProcessing(userId) {
        const jobId = ++this.jobId;
        const job = {
            id: jobId,
            type: 'process-user-subscriptions',
            data: { userId },
            createdAt: new Date(),
            status: 'queued'
        };

        this.jobs.set(jobId, job);
        console.log(`Queued user subscription processing job ${jobId} for user ${userId}`);

        return job;
    }

    /**
     * Get queue statistics
     */
    async getQueueStats() {
        return {
            queuedJobs: this.jobs.size,
            activeJobs: this.activeJobs.size,
            totalJobsProcessed: this.jobId - this.jobs.size - this.activeJobs.size,
            isProcessing: this.isProcessing
        };
    }

    /**
     * Get active jobs
     */
    async getActiveJobs() {
        const activeJobsArray = Array.from(this.activeJobs.values()).map(job => ({
            id: job.id,
            type: job.type,
            status: 'processing',
            createdAt: job.createdAt,
            data: job.data
        }));

        return activeJobsArray;
    }

    /**
     * Add job to queue (generic method)
     */
    addJob(type, data) {
        const jobId = ++this.jobId;
        const job = {
            id: jobId,
            type,
            data,
            createdAt: new Date(),
            status: 'queued'
        };

        this.jobs.set(jobId, job);
        console.log(`Added job ${jobId} of type ${type} to queue`);

        return job;
    }

    /**
     * Cleanup method for graceful shutdown
     */
    async cleanup() {
        console.log('SimpleJobQueue: Performing cleanup...');
        this.isProcessing = false;
        // Clear any active intervals or resources if needed
        console.log('SimpleJobQueue: Cleanup complete');
    }

    // Helper method to aggregate user interests for AI analysis
    aggregateUserInterests(users) {
        const aggregated = {};

        // Handle null or empty users array
        if (!users || !Array.isArray(users) || users.length === 0) {
            console.log('No users found for interest aggregation, using default interests');
            return {
                'programming': {
                    priority: 5,
                    keywords: ['coding', 'development', 'software'],
                    subcategories: {}
                },
                'technology': {
                    priority: 5,
                    keywords: ['tech', 'innovation'],
                    subcategories: {}
                }
            };
        }

        for (const user of users) {
            if (!user.interests) continue;

            // Handle both array (legacy) and object (hierarchical) formats
            if (Array.isArray(user.interests)) {
                // Legacy format - convert to simple object
                for (const interest of user.interests) {
                    if (!aggregated[interest]) {
                        aggregated[interest] = {
                            priority: 5,
                            keywords: [],
                            subcategories: {}
                        };
                    }
                    aggregated[interest].priority = Math.max(aggregated[interest].priority, 5);
                }
            } else if (typeof user.interests === 'object') {
                // Hierarchical format - merge interests
                for (const [category, data] of Object.entries(user.interests)) {
                    if (!aggregated[category]) {
                        aggregated[category] = {
                            priority: data.priority || 5,
                            keywords: [...(data.keywords || [])],
                            subcategories: { ...(data.subcategories || {}) }
                        };
                    } else {
                        // Merge with existing
                        aggregated[category].priority = Math.max(
                            aggregated[category].priority,
                            data.priority || 5
                        );

                        // Merge keywords
                        const existingKeywords = new Set(aggregated[category].keywords);
                        for (const keyword of data.keywords || []) {
                            existingKeywords.add(keyword);
                        }
                        aggregated[category].keywords = Array.from(existingKeywords);
                        // Merge subcategories
                        aggregated[category].subcategories = {
                            ...aggregated[category].subcategories,
                            ...(data.subcategories || {})
                        };
                    }
                }
            }
        }

        return aggregated;
    }

    // Utility method to parse YouTube duration format (PT30M15S) to seconds
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

    /**
     * Extract keywords from transcript using free methods (no LLM)
     * This method uses natural language processing techniques to extract relevant keywords
     */
    extractKeywordsFromTranscript(transcript) {
        if (!transcript || !Array.isArray(transcript) || transcript.length === 0) {
            return [];
        }

        // Combine all transcript text
        const fullText = transcript.map(segment => segment.text).join(' ').toLowerCase();

        // Step 1: Basic text cleaning
        const cleanedText = this.cleanTextForKeywordExtraction(fullText);

        // Step 2: Extract important words and phrases
        const keywords = this.extractImportantKeywords(cleanedText);

        // Step 3: Filter and rank keywords
        const rankedKeywords = this.rankKeywordsByImportance(keywords);

        // Step 4: Return top keywords (limit for cost efficiency)
        const topKeywords = rankedKeywords.slice(0, 30); // Limit to 30 most important keywords

        console.log(`Keyword extraction: ${transcript.length} segments -> ${topKeywords.length} keywords`);
        return topKeywords;
    }

    /**
     * Clean text for keyword extraction
     */
    cleanTextForKeywordExtraction(text) {
        return text
            // Remove URLs, emails, and special characters
            .replace(/https?:\/\/[^\s]+/g, '')
            .replace(/\S+@\S+\.\S+/g, '')
            .replace(/[^\w\s]/g, ' ')
            // Normalize whitespace
            .replace(/\s+/g, ' ')
            .trim();
    }

    /**
     * Extract important keywords using NLP techniques
     */
    extractImportantKeywords(text) {
        const words = text.split(/\s+/);
        const keywords = new Set();

        // Common stop words to ignore
        const stopWords = new Set([
            'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
            'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they',
            'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
            'will', 'would', 'could', 'should', 'may', 'might', 'can', 'must',
            'what', 'where', 'when', 'why', 'how', 'who', 'which',
            'up', 'down', 'out', 'off', 'over', 'under', 'again', 'further', 'then', 'once',
            'here', 'there', 'when', 'where', 'why', 'how', 'all', 'any', 'both', 'each',
            'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only',
            'own', 'same', 'so', 'than', 'too', 'very', 'just', 'now'
        ]);

        // Extract single words (nouns, verbs, adjectives)
        for (let i = 0; i < words.length; i++) {
            const word = words[i];
            if (word.length >= 3 && !stopWords.has(word) && isNaN(word)) {
                // Prioritize technical and educational terms
                if (this.isTechnicalOrEducationalTerm(word)) {
                    keywords.add(word + '_priority'); // Mark as priority
                }
                keywords.add(word);
            }
        }

        // Extract 2-word phrases (bigrams)
        for (let i = 0; i < words.length - 1; i++) {
            const phrase = `${words[i]} ${words[i + 1]}`;
            if (!stopWords.has(words[i]) && !stopWords.has(words[i + 1]) &&
                phrase.length >= 6 && phrase.length <= 25) {
                if (this.isTechnicalOrEducationalPhrase(phrase)) {
                    keywords.add(phrase + '_priority');
                }
                keywords.add(phrase);
            }
        }

        // Extract 3-word phrases (trigrams) for technical concepts
        for (let i = 0; i < words.length - 2; i++) {
            const phrase = `${words[i]} ${words[i + 1]} ${words[i + 2]}`;
            if (this.isTechnicalOrEducationalPhrase(phrase) && phrase.length <= 30) {
                keywords.add(phrase + '_priority');
            }
        }

        return Array.from(keywords);
    }

    /**
     * Check if a word is technical or educational
     */
    isTechnicalOrEducationalTerm(word) {
        const technicalTerms = [
            'function', 'variable', 'array', 'object', 'class', 'method', 'property',
            'algorithm', 'data', 'structure', 'database', 'server', 'client', 'api',
            'programming', 'coding', 'development', 'software', 'application', 'system',
            'framework', 'library', 'package', 'module', 'component', 'interface',
            'protocol', 'security', 'authentication', 'authorization', 'encryption',
            'performance', 'optimization', 'testing', 'debugging', 'deployment',
            'architecture', 'design', 'pattern', 'principle', 'concept', 'theory',
            'analysis', 'implementation', 'solution', 'problem', 'approach', 'strategy',
            'tutorial', 'guide', 'example', 'demo', 'explanation', 'introduction',
            'advanced', 'beginner', 'intermediate', 'professional', 'best', 'practice'
        ];
        return technicalTerms.some(term => word.includes(term) || term.includes(word));
    }

    /**
     * Check if a phrase is technical or educational
     */
    isTechnicalOrEducationalPhrase(phrase) {
        const technicalPhrases = [
            'machine learning', 'artificial intelligence', 'data science', 'web development',
            'software engineering', 'computer science', 'programming language', 'database design',
            'user interface', 'user experience', 'responsive design', 'version control',
            'test driven', 'object oriented', 'functional programming', 'data structure',
            'best practice', 'code review', 'software architecture', 'design pattern',
            'how to', 'tutorial', 'step by', 'getting started', 'deep dive', 'case study',
            'real world', 'practical example', 'hands on', 'comprehensive guide'
        ];
        return technicalPhrases.some(techPhrase =>
            phrase.includes(techPhrase) || techPhrase.includes(phrase)
        );
    }

    /**
     * Rank keywords by importance
     */
    rankKeywordsByImportance(keywords) {
        return keywords
            .map(keyword => {
                let score = 1;
                const cleanKeyword = keyword.replace('_priority', '');

                // Priority keywords get higher score
                if (keyword.includes('_priority')) {
                    score += 3;
                }

                // Longer phrases often more specific and valuable
                if (cleanKeyword.split(' ').length > 1) {
                    score += 1;
                }

                // Technical terms get bonus
                if (this.isTechnicalOrEducationalTerm(cleanKeyword) ||
                    this.isTechnicalOrEducationalPhrase(cleanKeyword)) {
                    score += 2;
                }

                return { keyword: cleanKeyword, score };
            })
            .sort((a, b) => b.score - a.score)
            .map(item => item.keyword);
    }

    /**
     * Extract keywords from all videos in batch
     */
    async extractKeywordsFromAllVideos(videos) {
        console.log(`Extracting keywords from ${videos.length} videos...`);

        const videosWithKeywords = [];

        for (const video of videos) {
            // Get transcript for each video
            let transcript = [];
            try {
                transcript = await YouTubeService.getVideoTranscript(video.id);
                if (!transcript || !Array.isArray(transcript)) {
                    transcript = [];
                }
            } catch (error) {
                console.log(`No transcript for ${video.id}: ${error.message}`);
                transcript = [];
            }

            // Create mock transcript if none available
            if (transcript.length === 0) {
                transcript = [{
                    text: `Sample content for ${video.title}. This video discusses topics related to the title.`,
                    start: 0,
                    duration: 10
                }];
            }

            // Extract keywords
            const keywords = this.extractKeywordsFromTranscript(transcript);

            videosWithKeywords.push({
                ...video,
                keywords,
                transcriptSegments: transcript.length
            });

            console.log(`📹 ${video.title}`);
            console.log(`   Channel: ${video.channelTitle}`);
            console.log(`   Keywords: ${keywords.slice(0, 8).join(', ')}${keywords.length > 8 ? '...' : ''}`);
            console.log(`   Transcript: ${transcript.length} segments`);
        }

        return videosWithKeywords;
    }

    /**
     * Batch analyze relevance of all videos at once
     */
    async batchAnalyzeRelevance(videosWithKeywords, userInterests) {
        const interestsText = this.formatUserInterests(userInterests);

        // Prepare batch data for OpenAI
        const videoSummaries = videosWithKeywords.map((video, index) => {
            return `${index + 1}. Title: "${video.title}"
   Channel: ${video.channelTitle}
   Duration: ${video.duration}
   Keywords: ${video.keywords.slice(0, 15).join(', ')}`;
        }).join('\n\n');

        const prompt = `Analyze the relevance of these ${videosWithKeywords.length} YouTube videos for a user interested in: ${interestsText}

Videos to analyze:
${videoSummaries}

For each video, provide a relevance score (0.0 to 1.0) and determine if it should receive detailed analysis.
Consider:
1. Direct match with user interests
2. Educational/professional value  
3. Practical applicability
4. Content quality indicators

Respond with JSON only - an array of objects:
[
  {
    "videoIndex": 1,
    "relevanceScore": 0.85,
    "isRelevant": true,
    "reasoning": "Brief explanation",
    "keyTopics": ["topic1", "topic2"]
  },
  ...
]`;

        try {
            console.log(`Sending batch analysis request for ${videosWithKeywords.length} videos...`);

            const response = await AIAnalysisService.getOpenAIClient().chat.completions.create({
                model: 'gpt-3.5-turbo',
                messages: [{ role: 'user', content: prompt }],
                max_tokens: 1500, // Increased for batch response
                temperature: 0.1
            });

            const batchResults = JSON.parse(response.choices[0].message.content);
            const cost = this.calculateTokenCost(response.usage.total_tokens, 'gpt-3.5-turbo');

            console.log(`✅ Batch analysis complete - Cost: $${cost.toFixed(4)}`);
            console.log(`📊 Analyzed ${batchResults.length} videos in single API call`);

            // Map results back to videos
            const results = batchResults.map(result => {
                const video = videosWithKeywords[result.videoIndex - 1];
                return {
                    video,
                    relevanceScore: result.relevanceScore || 0,
                    isRelevant: result.isRelevant || false,
                    reasoning: result.reasoning || '',
                    keyTopics: result.keyTopics || [],
                    cost: cost / batchResults.length // Distribute cost
                };
            });

            // Log summary
            const relevantCount = results.filter(r => r.isRelevant).length;
            console.log(`📈 Results: ${relevantCount}/${results.length} videos marked as relevant`);

            return results;

        } catch (error) {
            console.error('Batch relevance analysis failed:', error);

            // Fallback to individual analysis or conservative scoring
            return videosWithKeywords.map(video => ({
                video,
                relevanceScore: 0.3,
                isRelevant: false,
                reasoning: 'Batch analysis failed, marked as not relevant',
                keyTopics: [],
                cost: 0
            }));
        }
    }

    /**
     * Format user interests for OpenAI prompt
     */
    formatUserInterests(interests) {
        if (!interests || Object.keys(interests).length === 0) {
            return 'general programming and technology topics';
        }

        const formatted = Object.entries(interests).map(([category, data]) => {
            const keywords = data.keywords && data.keywords.length > 0
                ? ` (${data.keywords.slice(0, 5).join(', ')})`
                : '';
            return `${category}${keywords}`;
        }).join(', ');

        return formatted;
    }

    /**
     * Calculate token cost
     */
    calculateTokenCost(tokens, model) {
        const costs = {
            'gpt-3.5-turbo': 0.002 / 1000, // $0.002 per 1k tokens
            'gpt-4': 0.03 / 1000 // $0.03 per 1k tokens
        };

        return tokens * (costs[model] || costs['gpt-3.5-turbo']);
    }

    /**
     * Calculate matched interests between user and content
     */
    calculateMatchedInterests(userInterests, content) {
        if (!userInterests || !content) return [];

        const matchedInterests = [];
        const contentKeywords = content.transcript?.extractedKeywords || [];
        const contentTopics = content.analysis?.mainTopics || [];
        const contentText = (content.title + ' ' + (content.description || '')).toLowerCase();

        // Handle both array (legacy) and object (hierarchical) user interests formats
        if (Array.isArray(userInterests)) {
            // Legacy format - simple array of interests
            for (const interest of userInterests) {
                const interestLower = interest.toLowerCase();

                // Check if interest matches content
                if (contentText.includes(interestLower) ||
                    contentKeywords.some(keyword => keyword.toLowerCase().includes(interestLower)) ||
                    contentTopics.some(topic => topic.toLowerCase().includes(interestLower))) {
                    matchedInterests.push(interest);
                }
            }
        } else if (typeof userInterests === 'object') {
            // Hierarchical format - object with categories
            for (const [category, data] of Object.entries(userInterests)) {
                const categoryLower = category.toLowerCase();
                let categoryMatched = false;

                // Check category name match
                if (contentText.includes(categoryLower) ||
                    contentKeywords.some(keyword => keyword.toLowerCase().includes(categoryLower)) ||
                    contentTopics.some(topic => topic.toLowerCase().includes(categoryLower))) {
                    categoryMatched = true;
                }

                // Check keywords within the category
                if (data.keywords && Array.isArray(data.keywords)) {
                    for (const keyword of data.keywords) {
                        const keywordLower = keyword.toLowerCase();
                        if (contentText.includes(keywordLower) ||
                            contentKeywords.some(ck => ck.toLowerCase().includes(keywordLower)) ||
                            contentTopics.some(topic => topic.toLowerCase().includes(keywordLower))) {
                            categoryMatched = true;
                            break;
                        }
                    }
                }

                if (categoryMatched) {
                    matchedInterests.push(category);
                }
            }
        }

        return [...new Set(matchedInterests)]; // Remove duplicates
    }

    /**
     * Generate personalized highlights based on user interests
     */
    generatePersonalizedHighlights(content, userInterests) {
        if (!content.transcript?.segments || !userInterests) return [];

        const personalizedHighlights = [];
        const segments = content.transcript.segments || [];
        const matchedInterests = this.calculateMatchedInterests(userInterests, content);

        // If no matched interests, return general highlights
        if (matchedInterests.length === 0) {
            return segments.slice(0, 2).map(segment =>
                `${segment.text?.substring(0, 100)}...`
            ).filter(h => h.length > 10);
        }

        // Find segments that relate to user interests
        for (const segment of segments.slice(0, 10)) { // Limit search to first 10 segments
            if (!segment.text) continue;

            const segmentTextLower = segment.text.toLowerCase();
            let isRelevant = false;

            // Check if segment mentions user interests
            for (const interest of matchedInterests) {
                const interestLower = interest.toLowerCase();
                if (segmentTextLower.includes(interestLower)) {
                    isRelevant = true;
                    break;
                }
            }

            // Also check for technical keywords if user has programming/tech interests
            if (!isRelevant && matchedInterests.some(i =>
                i.toLowerCase().includes('programming') ||
                i.toLowerCase().includes('technology') ||
                i.toLowerCase().includes('development')
            )) {
                const techKeywords = ['function', 'algorithm', 'code', 'programming', 'development', 'software', 'api', 'database'];
                if (techKeywords.some(keyword => segmentTextLower.includes(keyword))) {
                    isRelevant = true;
                }
            }

            if (isRelevant) {
                const highlight = segment.text.length > 150
                    ? segment.text.substring(0, 150) + '...'
                    : segment.text;
                personalizedHighlights.push(highlight);
            }

            // Limit to 3 highlights
            if (personalizedHighlights.length >= 3) break;
        }

        // If no specific highlights found, use general highlights
        if (personalizedHighlights.length === 0) {
            return segments.slice(0, 2).map(segment =>
                segment.text?.substring(0, 100) + '...'
            ).filter(h => h && h.length > 10);
        }

        return personalizedHighlights;
    }
}

module.exports = new SimpleJobQueue();
