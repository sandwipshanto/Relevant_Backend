const express = require('express');
const { body, validationResult } = require('express-validator');
const Content = require('../models/Content');
const UserContent = require('../models/UserContent');
const User = require('../models/User');
const auth = require('../middleware/auth');
const YouTubeService = require('../services/YouTubeService');
const AIAnalysisService = require('../services/AIAnalysisServiceRefactored');
const JobQueue = require('../services/SimpleJobQueue');

const router = express.Router();

// Process a specific YouTube video
router.post('/process-video', auth, [
    body('videoId').notEmpty().withMessage('Video ID is required'),
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                msg: 'Validation errors',
                errors: errors.array()
            });
        }

        const { videoId } = req.body;

        // Get video details
        const videoData = await YouTubeService.getVideoDetails(videoId);
        if (!videoData) {
            return res.status(404).json({
                success: false,
                msg: 'Video not found'
            });
        }

        // Queue the video for processing
        const job = await JobQueue.queueVideoProcessing(videoId, videoData, [req.user.id]);

        res.json({
            success: true,
            msg: 'Video queued for processing',
            jobId: job.id,
            videoTitle: videoData.title
        });

    } catch (error) {
        console.error('Process video error:', error);
        res.status(500).json({
            success: false,
            msg: 'Error processing video'
        });
    }
});

// Process user's YouTube subscriptions
router.post('/process-subscriptions', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user || !user.youtubeSources || user.youtubeSources.length === 0) {
            return res.status(400).json({
                success: false,
                msg: 'No YouTube subscriptions found'
            });
        }

        const job = await JobQueue.queueUserSubscriptionProcessing(req.user.id);

        res.json({
            success: true,
            msg: 'Subscriptions queued for processing',
            jobId: job.id,
            subscriptionsCount: user.youtubeSources.length
        });

    } catch (error) {
        console.error('Process subscriptions error:', error);
        res.status(500).json({
            success: false,
            msg: 'Error processing subscriptions'
        });
    }
});

// Process today's content only (avoid re-analyzing old content)
router.post('/process-today', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user || !user.youtubeSources || user.youtubeSources.length === 0) {
            return res.status(400).json({
                success: false,
                msg: 'No YouTube subscriptions found'
            });
        }

        const job = await JobQueue.queueTodaysContentProcessing(req.user.id);

        res.json({
            success: true,
            msg: 'Today\'s content queued for processing (no duplicate analysis)',
            jobId: job,
            subscriptionsCount: user.youtubeSources.length
        });

    } catch (error) {
        console.error('Process today\'s content error:', error);
        res.status(500).json({
            success: false,
            msg: 'Error processing today\'s content'
        });
    }
});

// Get video highlights and segments
router.get('/:id/highlights', auth, async (req, res) => {
    try {
        const content = await Content.findById(req.params.id);
        if (!content) {
            return res.status(404).json({
                success: false,
                msg: 'Content not found'
            });
        }

        // Get user's interests for personalized highlights
        const user = await User.findById(req.user.id);
        const userInterests = user?.interests || {};

        // Get AI-generated highlights with user-specific relevance
        let personalizedHighlights = content.highlights || [];

        if (Object.keys(userInterests).length > 0 && content.transcriptSegments.length > 0) {
            // Re-score segments based on user interests
            const relevanceScores = await AIAnalysisService.scoreSegmentsForUser(
                content.transcriptSegments,
                userInterests
            );

            personalizedHighlights = content.transcriptSegments
                .map((segment, index) => ({
                    ...segment,
                    userRelevanceScore: relevanceScores[index] || 0
                }))
                .filter(segment => segment.userRelevanceScore > 0.7)
                .sort((a, b) => b.userRelevanceScore - a.userRelevanceScore)
                .slice(0, 10); // Top 10 personalized highlights
        }

        res.json({
            success: true,
            content: {
                id: content._id,
                title: content.title,
                videoId: content.videoId,
                url: content.url,
                duration: content.duration
            },
            highlights: personalizedHighlights,
            segments: content.transcriptSegments || [],
            topics: content.topics || [],
            categories: content.categories || []
        });

    } catch (error) {
        console.error('Get highlights error:', error);
        res.status(500).json({
            success: false,
            msg: 'Error fetching highlights'
        });
    }
});

// Search content by topic or keyword
router.get('/search/:query', auth, async (req, res) => {
    try {
        const { query } = req.params;
        const { page = 1, limit = 10, minRelevance = 0.5 } = req.query;
        const skip = (page - 1) * limit;

        // Search in content titles, descriptions, topics, and transcript
        const searchResults = await Content.find({
            $or: [
                { title: { $regex: query, $options: 'i' } },
                { description: { $regex: query, $options: 'i' } },
                { topics: { $regex: query, $options: 'i' } },
                { categories: { $regex: query, $options: 'i' } },
                { 'transcriptSegments.text': { $regex: query, $options: 'i' } }
            ]
        })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        // Get user's personalized content entries
        const contentIds = searchResults.map(c => c._id);
        const userContent = await UserContent.find({
            userId: req.user.id,
            contentId: { $in: contentIds },
            relevanceScore: { $gte: minRelevance }
        });

        // Merge content with user data
        const results = searchResults.map(content => {
            const userEntry = userContent.find(uc =>
                uc.contentId.toString() === content._id.toString()
            );

            return {
                ...content.toObject(),
                userContent: userEntry || null
            };
        });

        res.json({
            success: true,
            query,
            results,
            pagination: {
                currentPage: parseInt(page),
                totalItems: results.length,
                hasMore: results.length === parseInt(limit)
            }
        });

    } catch (error) {
        console.error('Search content error:', error);
        res.status(500).json({
            success: false,
            msg: 'Error searching content'
        });
    }
});

// Get processing status and queue information
router.get('/processing/status', auth, async (req, res) => {
    try {
        const queueStats = await JobQueue.getQueueStats();
        const activeJobs = await JobQueue.getActiveJobs();

        res.json({
            success: true,
            queueStats,
            activeJobs
        });

    } catch (error) {
        console.error('Get processing status error:', error);
        res.status(500).json({
            success: false,
            msg: 'Error fetching processing status'
        });
    }
});

// Get personalized content feed for user
router.get('/feed', auth, async (req, res) => {
    try {
        const { page = 1, limit = 10, minRelevance = 0.5 } = req.query;
        const skip = (page - 1) * limit;

        // Get user's personalized content
        const userContent = await UserContent.find({
            userId: req.user.id,
            relevanceScore: { $gte: minRelevance },
            dismissed: false,
        })
            .populate('contentId')
            .sort({ relevanceScore: -1, createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        // Filter out null content (in case of deleted content)
        const validContent = userContent.filter(uc => uc.contentId);

        // Transform the data to a frontend-friendly structure
        const transformedContent = validContent.map(uc => ({
            // Include content fields at the top level
            id: uc.contentId._id,
            title: uc.contentId.title,
            description: uc.contentId.description,
            url: uc.contentId.url,
            source: uc.contentId.source,
            sourceId: uc.contentId.sourceId,
            sourceChannel: uc.contentId.sourceChannel,
            thumbnail: uc.contentId.thumbnail,
            publishedAt: uc.contentId.publishedAt,
            duration: uc.contentId.duration,
            tags: uc.contentId.tags,
            category: uc.contentId.category,

            // Include comprehensive AI analysis data
            analysis: uc.contentId.analysis,
            relevanceScore: uc.contentId.analysis?.relevanceScore || uc.relevanceScore,
            summary: uc.contentId.analysis?.summary || uc.personalizedSummary,
            highlights: uc.contentId.analysis?.highlights || uc.personalizedHighlights || [],
            keyPoints: uc.contentId.analysis?.keyPoints || [],
            categories: uc.contentId.analysis?.categories || [uc.contentId.category],
            complexity: uc.contentId.analysis?.complexity || 'intermediate',
            estimatedWatchTime: uc.contentId.analysis?.estimatedWatchTime || uc.contentId.duration,
            recommendationReason: uc.contentId.analysis?.recommendationReason || 'Matches your interests',

            // Include user-specific data
            userContent: {
                id: uc._id,
                relevanceScore: uc.relevanceScore,
                matchedInterests: uc.matchedInterests,
                personalizedSummary: uc.personalizedSummary,
                personalizedHighlights: uc.personalizedHighlights,
                viewed: uc.viewed,
                viewedAt: uc.viewedAt,
                liked: uc.liked,
                saved: uc.saved,
                dismissed: uc.dismissed,
                createdAt: uc.createdAt
            }
        }));

        res.json({
            success: true,
            content: transformedContent,
            pagination: {
                currentPage: parseInt(page),
                totalItems: transformedContent.length,
                hasMore: transformedContent.length === parseInt(limit)
            }
        });
    } catch (err) {
        console.error('Feed fetch error:', err.message);
        res.status(500).json({
            success: false,
            msg: 'Error fetching content feed'
        });
    }
});

// Get specific content by ID
router.get('/:id', auth, async (req, res) => {
    try {
        const content = await Content.findById(req.params.id);
        if (!content) {
            return res.status(404).json({
                success: false,
                msg: 'Content not found'
            });
        }

        // Check if user has personalized version
        const userContent = await UserContent.findOne({
            userId: req.user.id,
            contentId: req.params.id
        });

        res.json({
            success: true,
            content,
            userContent
        });
    } catch (err) {
        console.error('Content fetch error:', err.message);
        res.status(500).json({
            success: false,
            msg: 'Error fetching content'
        });
    }
});

// Mark content as viewed
router.post('/:id/view', auth, async (req, res) => {
    try {
        const userContent = await UserContent.findOneAndUpdate(
            {
                userId: req.user.id,
                contentId: req.params.id
            },
            {
                viewed: true,
                viewedAt: new Date()
            },
            { new: true }
        );

        if (!userContent) {
            return res.status(404).json({
                success: false,
                msg: 'Content not found for user'
            });
        }

        res.json({
            success: true,
            userContent
        });
    } catch (err) {
        console.error('Mark viewed error:', err.message);
        res.status(500).json({
            success: false,
            msg: 'Error marking content as viewed'
        });
    }
});

// Like/unlike content
router.post('/:id/like', auth, async (req, res) => {
    try {
        const { liked = true } = req.body;

        const userContent = await UserContent.findOneAndUpdate(
            {
                userId: req.user.id,
                contentId: req.params.id
            },
            { liked },
            { new: true }
        );

        if (!userContent) {
            return res.status(404).json({
                success: false,
                msg: 'Content not found for user'
            });
        }

        res.json({
            success: true,
            userContent
        });
    } catch (err) {
        console.error('Like content error:', err.message);
        res.status(500).json({
            success: false,
            msg: 'Error updating content preference'
        });
    }
});

// Save/unsave content
router.post('/:id/save', auth, async (req, res) => {
    try {
        const { saved = true } = req.body;

        const userContent = await UserContent.findOneAndUpdate(
            {
                userId: req.user.id,
                contentId: req.params.id
            },
            { saved },
            { new: true }
        );

        if (!userContent) {
            return res.status(404).json({
                success: false,
                msg: 'Content not found for user'
            });
        }

        res.json({
            success: true,
            userContent
        });
    } catch (err) {
        console.error('Save content error:', err.message);
        res.status(500).json({
            success: false,
            msg: 'Error saving content'
        });
    }
});

// Dismiss content
router.post('/:id/dismiss', auth, async (req, res) => {
    try {
        const userContent = await UserContent.findOneAndUpdate(
            {
                userId: req.user.id,
                contentId: req.params.id
            },
            { dismissed: true },
            { new: true }
        );

        if (!userContent) {
            return res.status(404).json({
                success: false,
                msg: 'Content not found for user'
            });
        }

        res.json({
            success: true,
            userContent
        });
    } catch (err) {
        console.error('Dismiss content error:', err.message);
        res.status(500).json({
            success: false,
            msg: 'Error dismissing content'
        });
    }
});

// Get user's saved content
router.get('/saved/list', auth, async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const skip = (page - 1) * limit;

        const savedContent = await UserContent.find({
            userId: req.user.id,
            saved: true
        })
            .populate('contentId')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        // Filter out null content and transform to frontend-friendly structure
        const validContent = savedContent.filter(uc => uc.contentId);
        const transformedContent = validContent.map(uc => ({
            // Include content fields at the top level
            id: uc.contentId._id,
            title: uc.contentId.title,
            description: uc.contentId.description,
            url: uc.contentId.url,
            source: uc.contentId.source,
            sourceId: uc.contentId.sourceId,
            sourceChannel: uc.contentId.sourceChannel,
            thumbnail: uc.contentId.thumbnail,
            publishedAt: uc.contentId.publishedAt,
            duration: uc.contentId.duration,
            tags: uc.contentId.tags,
            category: uc.contentId.category,

            // Include analysis data
            analysis: uc.contentId.analysis,

            // Include user-specific data
            userContent: {
                id: uc._id,
                relevanceScore: uc.relevanceScore,
                matchedInterests: uc.matchedInterests,
                personalizedSummary: uc.personalizedSummary,
                personalizedHighlights: uc.personalizedHighlights,
                viewed: uc.viewed,
                viewedAt: uc.viewedAt,
                liked: uc.liked,
                saved: uc.saved,
                dismissed: uc.dismissed,
                createdAt: uc.createdAt
            }
        }));

        res.json({
            success: true,
            content: transformedContent,
            pagination: {
                currentPage: parseInt(page),
                totalItems: transformedContent.length,
                hasMore: transformedContent.length === parseInt(limit)
            }
        });
    } catch (err) {
        console.error('Saved content fetch error:', err.message);
        res.status(500).json({
            success: false,
            msg: 'Error fetching saved content'
        });
    }
});

// Get content filtered by relevance score
router.get('/by-relevance', auth, async (req, res) => {
    try {
        const {
            minRelevance = 0.0,
            maxRelevance = 1.0,
            page = 1,
            limit = 20,
            sortBy = 'relevance' // 'relevance' | 'date' | 'popularity'
        } = req.query;

        const skip = (page - 1) * limit;

        // Build sort criteria
        let sortCriteria;
        switch (sortBy) {
            case 'date':
                sortCriteria = { createdAt: -1 };
                break;
            case 'popularity':
                sortCriteria = { 'contentId.viewCount': -1 };
                break;
            default:
                sortCriteria = { relevanceScore: -1 };
        }

        // Get user's content with relevance filtering
        const userContent = await UserContent.find({
            userId: req.user.id,
            relevanceScore: {
                $gte: parseFloat(minRelevance),
                $lte: parseFloat(maxRelevance)
            },
            dismissed: false
        })
            .populate('contentId')
            .sort(sortCriteria)
            .skip(skip)
            .limit(parseInt(limit));

        // Filter out null content and transform
        const validContent = userContent.filter(uc => uc.contentId);

        const transformedContent = validContent.map(uc => ({
            id: uc.contentId._id,
            title: uc.contentId.title,
            description: uc.contentId.description,
            url: uc.contentId.url,
            thumbnail: uc.contentId.thumbnail,
            duration: uc.contentId.duration,
            sourceChannel: uc.contentId.sourceChannel,
            publishedAt: uc.contentId.publishedAt,

            // AI Analysis data
            relevanceScore: uc.contentId.analysis?.relevanceScore || uc.relevanceScore,
            summary: uc.contentId.analysis?.summary || uc.personalizedSummary,
            highlights: uc.contentId.analysis?.highlights || [],
            keyPoints: uc.contentId.analysis?.keyPoints || [],
            categories: uc.contentId.analysis?.categories || [],
            complexity: uc.contentId.analysis?.complexity || 'intermediate',
            estimatedWatchTime: uc.contentId.analysis?.estimatedWatchTime,
            recommendationReason: uc.contentId.analysis?.recommendationReason,

            // User interaction data
            userContent: {
                id: uc._id,
                viewed: uc.viewed,
                liked: uc.liked,
                saved: uc.saved,
                matchedInterests: uc.matchedInterests,
                createdAt: uc.createdAt
            }
        }));

        // Get relevance distribution for filtering UI
        const relevanceStats = await UserContent.aggregate([
            {
                $match: {
                    userId: req.user.id,
                    dismissed: false
                }
            },
            {
                $group: {
                    _id: null,
                    avgRelevance: { $avg: '$relevanceScore' },
                    minRelevance: { $min: '$relevanceScore' },
                    maxRelevance: { $max: '$relevanceScore' },
                    totalCount: { $sum: 1 },
                    highRelevanceCount: {
                        $sum: {
                            $cond: [{ $gte: ['$relevanceScore', 0.7] }, 1, 0]
                        }
                    }
                }
            }
        ]);

        res.json({
            success: true,
            content: transformedContent,
            pagination: {
                currentPage: parseInt(page),
                totalItems: transformedContent.length,
                hasMore: transformedContent.length === parseInt(limit)
            },
            filters: {
                minRelevance: parseFloat(minRelevance),
                maxRelevance: parseFloat(maxRelevance),
                sortBy
            },
            stats: relevanceStats[0] || {
                avgRelevance: 0,
                minRelevance: 0,
                maxRelevance: 1,
                totalCount: 0,
                highRelevanceCount: 0
            }
        });
    } catch (err) {
        console.error('Relevance filter error:', err.message);
        res.status(500).json({
            success: false,
            msg: 'Error filtering content by relevance'
        });
    }
});

module.exports = router;
