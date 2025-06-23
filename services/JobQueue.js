const Queue = require('bull');
const redis = require('redis');
const YouTubeService = require('./YouTubeService');
const AIAnalysisService = require('./AIAnalysisService');
const User = require('../models/User');
const Content = require('../models/Content');
const UserContent = require('../models/UserContent');

// Create Redis client for Bull
const redisClient = redis.createClient({
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    // For local development, use default settings
    // For production, configure Redis URL
});

// Create job queues
const contentProcessingQueue = new Queue('content processing', {
    redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
        password: process.env.REDIS_PASSWORD || undefined,
    },
    defaultJobOptions: {
        removeOnComplete: 10,
        removeOnFail: 50,
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 2000,
        },
    },
});

const channelMonitoringQueue = new Queue('channel monitoring', {
    redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
        password: process.env.REDIS_PASSWORD || undefined,
    },
    defaultJobOptions: {
        removeOnComplete: 5,
        removeOnFail: 10,
        attempts: 2,
        backoff: {
            type: 'exponential',
            delay: 5000,
        },
    },
});

class JobQueueService {
    constructor() {
        this.setupJobProcessors();
    }

    setupJobProcessors() {
        // Process individual videos
        contentProcessingQueue.process('process-video', 5, async (job) => {
            const { videoId, videoData, userIds } = job.data;
            return await this.processVideo(videoId, videoData, userIds);
        });

        // Monitor channels for new content
        channelMonitoringQueue.process('monitor-channels', 1, async (job) => {
            return await this.monitorAllChannels();
        });

        // Process user's subscriptions
        channelMonitoringQueue.process('process-user-subscriptions', 3, async (job) => {
            const { userId } = job.data;
            return await this.processUserSubscriptions(userId);
        });

        // Error handling
        contentProcessingQueue.on('failed', (job, err) => {
            console.error(`Content processing job ${job.id} failed:`, err);
        });

        channelMonitoringQueue.on('failed', (job, err) => {
            console.error(`Channel monitoring job ${job.id} failed:`, err);
        });
    }

    async processVideo(videoId, videoData, userIds = []) {
        try {
            console.log(`Processing video: ${videoId}`);

            // Check if content already exists
            let content = await Content.findOne({ videoId });

            if (!content) {
                // Get transcript
                const transcript = await YouTubeService.getVideoTranscript(videoId);

                if (!transcript || transcript.length === 0) {
                    console.log(`No transcript available for video: ${videoId}`);
                    return { success: false, reason: 'No transcript available' };
                }

                // Analyze content with AI
                const analysis = await AIAnalysisService.analyzeContent(
                    videoData.title,
                    videoData.description || '',
                    transcript
                );

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

            // Create personalized content for specified users or all users with matching interests
            let targetUsers = userIds;
            if (!targetUsers || targetUsers.length === 0) {
                // Find users who might be interested based on channel subscriptions
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
                // Check if UserContent already exists
                const existingUserContent = await UserContent.findOne({
                    userId,
                    contentId: content._id
                });

                if (existingUserContent) {
                    return existingUserContent;
                }

                // Get user for interest matching
                const user = await User.findById(userId);
                if (!user) return null;

                // Calculate relevance score
                const relevanceScore = await AIAnalysisService.calculateRelevanceScore(
                    content,
                    user.interests
                );

                // Only create UserContent if relevance meets threshold
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
                    // Get recent videos from channel
                    const videos = await YouTubeService.getChannelVideos(
                        source.channelId,
                        10 // Get last 10 videos
                    );

                    let channelProcessed = 0;
                    for (const video of videos) {
                        // Check if we already processed this video recently
                        const existingContent = await Content.findOne({
                            videoId: video.id,
                            processedAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24 hours
                        });

                        if (!existingContent) {
                            // Queue video for processing
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

            // Get all unique channel IDs from all users
            const users = await User.find({
                'youtubeSources.0': { $exists: true }
            });

            const channelMap = new Map();
            const userChannelMap = new Map();

            // Build channel to users mapping
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

            // Process each unique channel
            for (const [channelId, channelData] of channelMap) {
                try {
                    // Get recent videos from channel
                    const videos = await YouTubeService.getChannelVideos(channelId, 5);

                    let channelProcessed = 0;
                    for (const video of videos) {
                        // Check if video is recent (last 7 days) and not already processed
                        const videoDate = new Date(video.publishedAt);
                        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

                        if (videoDate >= sevenDaysAgo) {
                            const existingContent = await Content.findOne({ videoId: video.id });

                            if (!existingContent) {
                                // Queue video for processing with all interested users
                                await this.queueVideoProcessing(
                                    video.id,
                                    video,
                                    channelData.users
                                );
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
        return await contentProcessingQueue.add('process-video', {
            videoId,
            videoData,
            userIds
        }, {
            priority: 1,
            delay: 1000 // Small delay to avoid API rate limits
        });
    }

    async queueChannelMonitoring() {
        return await channelMonitoringQueue.add('monitor-channels', {}, {
            priority: 5,
            repeat: { cron: '0 */2 * * *' } // Every 2 hours
        });
    }

    async queueUserSubscriptionProcessing(userId) {
        return await channelMonitoringQueue.add('process-user-subscriptions', {
            userId
        }, {
            priority: 3
        });
    }

    // Queue status methods
    async getQueueStats() {
        const contentStats = await contentProcessingQueue.getJobCounts();
        const channelStats = await channelMonitoringQueue.getJobCounts();

        return {
            contentProcessing: contentStats,
            channelMonitoring: channelStats
        };
    }

    async getActiveJobs() {
        const contentJobs = await contentProcessingQueue.getActive();
        const channelJobs = await channelMonitoringQueue.getActive();

        return {
            contentProcessing: contentJobs.length,
            channelMonitoring: channelJobs.length,
            jobs: {
                content: contentJobs.map(job => ({
                    id: job.id,
                    data: job.data,
                    progress: job.progress()
                })),
                channel: channelJobs.map(job => ({
                    id: job.id,
                    data: job.data,
                    progress: job.progress()
                }))
            }
        };
    }

    // Cleanup method
    async cleanup() {
        await contentProcessingQueue.close();
        await channelMonitoringQueue.close();
    }
}

module.exports = new JobQueueService();
