/**
 * Refactored SimpleJobQueue - Job orchestration only
 * Delegates analysis to the ai-analysis system
 */

const YouTubeService = require('./YouTubeService');
const AIAnalysisService = require('./AIAnalysisServiceRefactored');
const User = require('../models/User');
const Content = require('../models/Content');
const UserContent = require('../models/UserContent');

class SimpleJobQueueRefactored {
    constructor() {
        this.jobs = new Map();
        this.activeJobs = new Map();
        this.jobId = 0;
        this.isProcessing = false;
        this.setupProcessor();

        console.log('🔄 SimpleJobQueue initialized with refactored AI analysis');
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
                case 'process-todays-content':
                    await this.processTodaysContentOnly(job.data.userId);
                    break;
                case 'AI_ANALYSIS':
                    await this.processAIAnalysisJob(job.data);
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

    /**
     * Process AI Analysis job using refactored AI system
     */
    async processAIAnalysisJob(data) {
        const { videos, userInterests } = data;

        console.log(`🤖 Processing AI analysis for ${videos.length} videos`);

        // Use the refactored AI analysis system
        const result = await AIAnalysisService.analyzeContent(videos, userInterests);

        console.log(`✅ AI analysis complete: ${result.analyzedContent.length} relevant videos found`);
        console.log(`💰 Total cost: $${result.cost.total.toFixed(6)}`);

        return result;
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
            let content = await Content.findOne({
                sourceId: videoId,
                source: 'youtube'
            });

            if (!content) {
                // Get transcript
                let transcript = [];
                try {
                    transcript = await YouTubeService.getVideoTranscript(videoId);
                    if (!transcript || !Array.isArray(transcript)) {
                        transcript = [];
                    }
                } catch (error) {
                    console.log(`No transcript available for video: ${videoId} - ${error.message}`);
                    transcript = [];
                }

                if (transcript.length === 0) {
                    // Create fallback transcript
                    transcript = [{
                        text: `${videoData.title}. ${videoData.description ? videoData.description.substring(0, 200) : ''}`,
                        start: 0,
                        duration: 10
                    }];
                }

                // Prepare video for AI analysis
                const videoForAnalysis = {
                    id: videoId,
                    title: videoData.title,
                    description: videoData.description || '',
                    channelTitle: videoData.channelTitle,
                    duration: videoData.duration,
                    viewCount: videoData.viewCount || 0,
                    publishedAt: videoData.publishedAt,
                    transcript: transcript.map(t => t.text).join(' ')
                };

                // Get user interests for analysis
                const users = await User.find({
                    'youtubeSources.channelId': videoData.channelId
                });
                const aggregatedInterests = this.aggregateUserInterests(users);

                // Use refactored AI analysis system
                console.log(`🤖 Starting AI analysis for video: ${videoId}`);
                const analysisResult = await AIAnalysisService.analyzeContent([videoForAnalysis], aggregatedInterests);

                let analysis;
                if (analysisResult.analyzedContent.length > 0) {
                    const analyzedVideo = analysisResult.analyzedContent[0];
                    analysis = {
                        segments: transcript.map(t => ({
                            ...t,
                            relevanceScore: analyzedVideo.finalRelevanceScore || 0.5,
                            topics: analyzedVideo.categories || ['general']
                        })),
                        analysis: {
                            summary: analyzedVideo.fullAnalysis?.summary || `Analysis of ${videoData.title}`,
                            sentiment: analyzedVideo.fullAnalysis?.sentiment || 'neutral',
                            keyPoints: analyzedVideo.fullAnalysis?.keyPoints || [],
                            relevanceScore: analyzedVideo.finalRelevanceScore || 0.5,
                            processingCost: analysisResult.cost.total,
                            processingStage: analyzedVideo.processingStage || 'ai_analysis'
                        },
                        highlights: analyzedVideo.highlights || transcript.slice(0, 2).map(t => ({
                            ...t,
                            reason: 'AI-identified relevance',
                            relevance: analyzedVideo.finalRelevanceScore || 0.5
                        })),
                        topics: analyzedVideo.categories || ['general'],
                        categories: analyzedVideo.categories || ['General']
                    };
                } else {
                    // Video not relevant
                    console.log(`Video not relevant: ${videoId}`);
                    return { success: true, reason: 'Video not relevant' };
                }

                // Create content record
                content = new Content({
                    title: videoData.title,
                    description: videoData.description || '',
                    url: `https://www.youtube.com/watch?v=${videoId}`,
                    source: 'youtube',
                    sourceId: videoId,
                    sourceChannel: {
                        id: videoData.channelId,
                        name: videoData.channelTitle
                    },
                    thumbnail: videoData.thumbnails?.medium?.url || videoData.thumbnails?.default?.url,
                    publishedAt: new Date(videoData.publishedAt),
                    duration: this.parseDuration(videoData.duration),
                    transcript: {
                        text: transcript.map(t => t.text).join(' '),
                        segments: transcript.map(t => ({
                            start: t.start || 0,
                            end: t.end || (t.start || 0) + (t.duration || 0),
                            text: t.text,
                            topics: t.topics || [],
                            relevanceScore: t.relevanceScore || 0
                        }))
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
                    processedAt: new Date(),
                    processingError: null
                });

                await content.save();
                console.log(`Content created for video: ${videoId}`);
            }

            // Create UserContent entries for relevant users
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

            // Create UserContent entries
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

                const relevanceScore = content.analysis?.overallRelevanceScore
                    ? content.analysis.overallRelevanceScore / 100
                    : 0.8;

                const threshold = parseFloat(process.env.RELEVANCE_THRESHOLD) || 0.6;
                if (relevanceScore >= threshold) {
                    const matchedInterests = this.calculateMatchedInterests(user.interests, content);
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

            // Step 1: Collect all videos from all channels
            console.log('\n=== BATCH VIDEO COLLECTION ===');
            const allVideos = [];
            const channelResults = [];

            for (const source of user.youtubeSources) {
                try {
                    let videos = [];
                    try {
                        videos = await YouTubeService.getChannelVideos(source.channelId, 10);
                    } catch (error) {
                        console.log(`Error fetching videos from channel ${source.channelId}: ${error.message}`);
                        videos = [];
                    }

                    // Filter out videos that already exist and have been processed
                    const newVideos = [];
                    for (const video of videos) {
                        const existingContent = await Content.findOne({
                            sourceId: video.id,
                            source: 'youtube'
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

            // Step 2: Use AI analysis system for batch processing
            const aggregatedInterests = this.aggregateUserInterests([user]);

            // Prepare videos for analysis
            const videosForAnalysis = allVideos.map(video => ({
                id: video.id,
                title: video.title,
                description: video.description || '',
                channelTitle: video.channelTitle,
                duration: video.duration,
                viewCount: video.viewCount || 0,
                publishedAt: video.publishedAt
            }));

            console.log('\n=== BATCH AI ANALYSIS ===');
            const analysisResult = await AIAnalysisService.analyzeContent(videosForAnalysis, aggregatedInterests);

            // Step 3: Queue relevant videos for processing
            console.log('\n=== PROCESSING RELEVANT VIDEOS ===');
            let processedCount = 0;

            for (const analyzedVideo of analysisResult.analyzedContent) {
                const originalVideo = allVideos.find(v => v.id === analyzedVideo.id);
                if (originalVideo) {
                    console.log(`✅ Processing relevant video: ${originalVideo.title}`);
                    await this.queueVideoProcessing(originalVideo.id, originalVideo, [userId]);
                    processedCount++;
                }
            }

            console.log(`\n=== BATCH PROCESSING COMPLETE ===`);
            console.log(`Total videos analyzed: ${allVideos.length}`);
            console.log(`Relevant videos queued: ${processedCount}`);
            console.log(`Total cost: $${analysisResult.cost.total.toFixed(6)}`);

            return {
                success: true,
                userId,
                totalVideosAnalyzed: allVideos.length,
                totalVideosQueued: processedCount,
                analysisCost: analysisResult.cost.total,
                channelResults
            };

        } catch (error) {
            console.error(`Error processing user subscriptions ${userId}:`, error);
            throw error;
        }
    }

    // ... (keep existing queue management methods)
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

    // Missing methods that are being called
    getActiveJobs() {
        return Array.from(this.activeJobs.values());
    }

    getAllJobs() {
        return {
            queued: Array.from(this.jobs.values()),
            active: Array.from(this.activeJobs.values())
        };
    }

    getJobById(jobId) {
        return this.jobs.get(jobId) || this.activeJobs.get(jobId);
    }

    /**
     * Process today's content for a specific user
     */
    async processTodaysContentOnly(userId) {
        try {
            console.log(`Processing today's content for user: ${userId}`);

            const user = await User.findById(userId);
            if (!user || !user.youtubeSources || user.youtubeSources.length === 0) {
                return { success: false, reason: 'No YouTube sources found' };
            }

            // Get today's date range
            const today = new Date();
            const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
            const endOfDay = new Date(startOfDay);
            endOfDay.setDate(endOfDay.getDate() + 1);

            console.log(`Looking for videos published between ${startOfDay.toISOString()} and ${endOfDay.toISOString()}`);

            // Collect today's videos from all channels
            const todaysVideos = [];
            const channelResults = [];

            for (const source of user.youtubeSources) {
                try {
                    console.log(`Checking channel: ${source.channelTitle} (${source.channelId})`);
                    
                    const videos = await YouTubeService.getChannelVideosAfter(
                        source.channelId, 
                        startOfDay, 
                        50 // Check more videos to ensure we don't miss any
                    );

                    // Filter to only today's videos
                    const todaysChannelVideos = videos.filter(video => {
                        const publishedAt = new Date(video.publishedAt);
                        return publishedAt >= startOfDay && publishedAt < endOfDay;
                    });

                    console.log(`Found ${todaysChannelVideos.length} videos from today in ${source.channelTitle}`);

                    todaysVideos.push(...todaysChannelVideos);
                    channelResults.push({
                        channelId: source.channelId,
                        channelTitle: source.channelTitle,
                        videosFound: todaysChannelVideos.length
                    });

                } catch (error) {
                    console.error(`Error checking channel ${source.channelId}:`, error.message);
                    channelResults.push({
                        channelId: source.channelId,
                        channelTitle: source.channelTitle,
                        error: error.message
                    });
                }
            }

            if (todaysVideos.length === 0) {
                console.log('No videos from today found');
                return {
                    success: true,
                    userId,
                    videosProcessed: 0,
                    message: 'No new videos from today',
                    channelResults
                };
            }

            console.log(`Found ${todaysVideos.length} videos from today across all channels`);

            // Filter out already processed videos
            const newVideos = [];
            for (const video of todaysVideos) {
                const existingContent = await Content.findOne({
                    sourceId: video.id,
                    source: 'youtube'
                });

                if (!existingContent) {
                    newVideos.push(video);
                }
            }

            if (newVideos.length === 0) {
                console.log('All videos from today have already been processed');
                return {
                    success: true,
                    userId,
                    videosProcessed: 0,
                    message: 'All videos from today already processed',
                    channelResults
                };
            }

            console.log(`Processing ${newVideos.length} new videos from today`);

            // Use AI analysis system for batch processing
            const aggregatedInterests = this.aggregateUserInterests([user]);

            // Prepare videos for analysis
            const videosForAnalysis = newVideos.map(video => ({
                id: video.id,
                title: video.title,
                description: video.description || '',
                channelTitle: video.channelTitle,
                duration: video.duration,
                viewCount: video.viewCount || 0,
                publishedAt: video.publishedAt
            }));

            console.log('Running AI analysis on today\'s videos...');
            const analysisResult = await AIAnalysisService.analyzeContent(videosForAnalysis, aggregatedInterests);

            // Process relevant videos
            let processedCount = 0;
            for (const analyzedVideo of analysisResult.analyzedContent) {
                const originalVideo = newVideos.find(v => v.id === analyzedVideo.id);
                if (originalVideo) {
                    console.log(`✅ Processing relevant video from today: ${originalVideo.title}`);
                    await this.processVideo(originalVideo.id, originalVideo, [userId]);
                    processedCount++;
                }
            }

            console.log(`Processed ${processedCount} relevant videos from today`);

            return {
                success: true,
                userId,
                totalVideosFound: todaysVideos.length,
                newVideosFound: newVideos.length,
                relevantVideosProcessed: processedCount,
                analysisCost: analysisResult.cost.total,
                channelResults
            };

        } catch (error) {
            console.error(`Error processing today's content for user ${userId}:`, error);
            throw error;
        }
    }

    async queueUserSubscriptionProcessing(userId) {
        return this.addJob('process-user-subscriptions', { userId });
    }

    async queueTodaysContentProcessing(userId) {
        return this.addJob('process-todays-content', { userId });
    }

    // Missing methods that CronService expects
    async queueChannelMonitoring() {
        return this.addJob('monitor-channels', {});
    }

    async getQueueStats() {
        return {
            queuedJobs: this.jobs.size,
            activeJobs: this.activeJobs.size,
            totalJobsProcessed: this.jobId - this.jobs.size - this.activeJobs.size,
            isProcessing: this.isProcessing
        };
    }

    // Helper methods (keep minimal ones needed for job processing)
    aggregateUserInterests(users) {
        const aggregated = {};

        if (!users || !Array.isArray(users) || users.length === 0) {
            return {
                'programming': { priority: 5, keywords: ['coding', 'development', 'software'] },
                'technology': { priority: 5, keywords: ['tech', 'innovation'] }
            };
        }

        for (const user of users) {
            if (!user.interests) continue;

            if (Array.isArray(user.interests)) {
                for (const interest of user.interests) {
                    if (!aggregated[interest]) {
                        aggregated[interest] = { priority: 5, keywords: [] };
                    }
                    aggregated[interest].priority = Math.max(aggregated[interest].priority, 5);
                }
            } else if (typeof user.interests === 'object') {
                for (const [category, data] of Object.entries(user.interests)) {
                    aggregated[category] = {
                        priority: Math.max(aggregated[category]?.priority || 0, data.priority || 5),
                        keywords: [...(aggregated[category]?.keywords || []), ...(data.keywords || [])],
                        subcategories: { ...(aggregated[category]?.subcategories || {}), ...(data.subcategories || {}) }
                    };
                }
            }
        }

        return aggregated;
    }

    parseDuration(duration) {
        if (!duration || typeof duration !== 'string') return 0;
        const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
        if (!match) return 0;
        const hours = parseInt(match[1] || '0');
        const minutes = parseInt(match[2] || '0');
        const seconds = parseInt(match[3] || '0');
        return hours * 3600 + minutes * 60 + seconds;
    }

    calculateMatchedInterests(userInterests, content) {
        // Simplified version - delegate complex logic to AI analysis system
        if (!userInterests || !content) return [];

        const matchedInterests = [];
        const contentText = (content.title + ' ' + (content.description || '')).toLowerCase();

        if (Array.isArray(userInterests)) {
            for (const interest of userInterests) {
                if (contentText.includes(interest.toLowerCase())) {
                    matchedInterests.push(interest);
                }
            }
        } else if (typeof userInterests === 'object') {
            for (const [category, data] of Object.entries(userInterests)) {
                if (contentText.includes(category.toLowerCase())) {
                    matchedInterests.push(category);
                }
            }
        }

        return [...new Set(matchedInterests)];
    }

    generatePersonalizedHighlights(content, userInterests) {
        // Simplified version - could be enhanced to use AI analysis system
        if (!content.transcript?.segments) return [];

        const segments = content.transcript.segments || [];
        return segments.slice(0, 2).map(segment =>
            segment.text?.substring(0, 150) + '...'
        ).filter(h => h && h.length > 10);
    }

    async cleanup() {
        console.log('SimpleJobQueue: Performing cleanup...');
        this.isProcessing = false;
        console.log('SimpleJobQueue: Cleanup complete');
    }
}

module.exports = new SimpleJobQueueRefactored();
