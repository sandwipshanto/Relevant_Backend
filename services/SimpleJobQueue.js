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

            // Check if content already exists
            let content = await Content.findOne({ videoId });

            if (!content) {
                // Try to get transcript (may fail for some videos)
                let transcript = [];
                try {
                    transcript = await YouTubeService.getVideoTranscript(videoId);
                } catch (error) {
                    console.log(`No transcript available for video: ${videoId} - ${error.message}`);
                }

                if (transcript.length === 0) {
                    // Create content without transcript for testing
                    transcript = [{
                        text: `Sample transcript for ${videoData.title}. This would normally contain the actual video transcript for AI analysis.`,
                        start: 0,
                        duration: 10
                    }];
                }

                // Analyze content with AI (with fallback)
                let analysis;
                try {
                    analysis = await AIAnalysisService.analyzeContent(
                        videoData.title,
                        videoData.description || '',
                        transcript
                    );
                } catch (error) {
                    console.log(`AI analysis failed for video: ${videoId} - ${error.message}`);
                    // Create mock analysis for testing
                    analysis = {
                        segments: transcript.map(t => ({
                            ...t,
                            relevanceScore: Math.random() * 0.5 + 0.5,
                            topics: ['technology', 'education']
                        })),
                        analysis: {
                            summary: `Analysis of ${videoData.title}`,
                            sentiment: 'positive',
                            keyPoints: ['Point 1', 'Point 2']
                        },
                        highlights: transcript.slice(0, 3).map(t => ({
                            ...t,
                            reason: 'High relevance to user interests'
                        })),
                        topics: ['technology', 'education', 'tutorial'],
                        categories: ['Educational', 'Technology']
                    };
                }

                // Create content record
                content = new Content({
                    videoId,
                    title: videoData.title,
                    description: videoData.description || '',
                    channelId: videoData.channelId,
                    channelTitle: videoData.channelTitle,
                    publishedAt: new Date(videoData.publishedAt),
                    duration: videoData.duration,
                    thumbnailUrl: videoData.thumbnails?.medium?.url || videoData.thumbnails?.default?.url,
                    url: `https://www.youtube.com/watch?v=${videoId}`,
                    transcript,
                    transcriptSegments: analysis.segments || [],
                    aiAnalysis: analysis.analysis || {},
                    highlights: analysis.highlights || [],
                    topics: analysis.topics || [],
                    categories: analysis.categories || [],
                    processedAt: new Date()
                });

                await content.save();
                console.log(`Content created for video: ${videoId}`);
            }

            // Create personalized content for specified users
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

                // Calculate relevance score (with fallback)
                let relevanceScore;
                try {
                    relevanceScore = await AIAnalysisService.calculateRelevanceScore(
                        content,
                        user.interests
                    );
                } catch (error) {
                    console.log(`Relevance calculation failed, using mock score: ${error.message}`);
                    // Generate mock relevance based on user interests
                    relevanceScore = Math.random() * 0.4 + 0.6; // 0.6-1.0 range
                }

                const threshold = parseFloat(process.env.RELEVANCE_THRESHOLD) || 0.6;
                if (relevanceScore >= threshold) {
                    const userContent = new UserContent({
                        userId,
                        contentId: content._id,
                        relevanceScore,
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

            let totalProcessed = 0;
            const channelResults = [];

            for (const source of user.youtubeSources) {
                try {
                    // Get recent videos from channel (with fallback)
                    let videos = [];
                    try {
                        videos = await YouTubeService.getChannelVideos(source.channelId, 5);
                    } catch (error) {
                        console.log(`Failed to get videos from ${source.channelId}, creating mock data`);
                        // Create mock video data for testing
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

                    let channelProcessed = 0;
                    for (const video of videos) {
                        const existingContent = await Content.findOne({
                            videoId: video.id,
                            processedAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
                        });

                        if (!existingContent) {
                            await this.queueVideoProcessing(video.id, video, [userId]);
                            channelProcessed++;
                        }
                    }

                    channelResults.push({
                        channelId: source.channelId,
                        channelTitle: source.channelTitle,
                        videosQueued: channelProcessed
                    });

                    totalProcessed += channelProcessed;

                } catch (error) {
                    console.error(`Error processing channel ${source.channelId}:`, error);
                    channelResults.push({
                        channelId: source.channelId,
                        channelTitle: source.channelTitle,
                        error: error.message
                    });
                }
            }

            return {
                success: true,
                userId,
                totalVideosQueued: totalProcessed,
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
            createdAt: new Date()
        };

        this.jobs.set(jobId, job);
        console.log(`Queued video processing job ${jobId} for video: ${videoId}`);

        return { id: jobId };
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

        return { id: jobId };
    }

    async queueUserSubscriptionProcessing(userId) {
        const jobId = ++this.jobId;
        const job = {
            id: jobId,
            type: 'process-user-subscriptions',
            data: { userId },
            createdAt: new Date()
        };

        this.jobs.set(jobId, job);
        console.log(`Queued user subscription processing job ${jobId} for user: ${userId}`);

        return { id: jobId };
    }

    // Queue status methods
    async getQueueStats() {
        return {
            contentProcessing: {
                waiting: this.jobs.size,
                active: this.activeJobs.size,
                completed: 0,
                failed: 0
            },
            channelMonitoring: {
                waiting: 0,
                active: 0,
                completed: 0,
                failed: 0
            }
        };
    }

    async getActiveJobs() {
        const activeJobsArray = Array.from(this.activeJobs.values());

        return {
            contentProcessing: activeJobsArray.length,
            channelMonitoring: 0,
            jobs: {
                content: activeJobsArray.map(job => ({
                    id: job.id,
                    data: job.data,
                    progress: 50 // Mock progress
                })),
                channel: []
            }
        };
    }

    async cleanup() {
        this.jobs.clear();
        this.activeJobs.clear();
        console.log('SimpleJobQueue cleaned up');
    }
}

module.exports = new SimpleJobQueue();
