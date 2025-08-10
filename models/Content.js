const mongoose = require('mongoose');

const ContentSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
    },
    description: {
        type: String,
        default: '',
    },
    url: {
        type: String,
        required: true,
        unique: true,
    },
    source: {
        type: String,
        enum: ['youtube', 'rss', 'web', 'article'],
        required: true,
    },
    sourceId: String, // YouTube video ID, article ID, etc.
    sourceChannel: {
        id: String,
        name: String,
    },
    thumbnail: String,
    publishedAt: {
        type: Date,
        required: true,
    },
    duration: Number, // in seconds for videos
    tags: [String],
    category: String,

    // AI processed content
    transcript: {
        text: String,
        segments: [{
            start: Number, // seconds
            end: Number,   // seconds
            text: String,
            topics: [String],
            relevanceScore: Number
        }]
    },
    analysis: {
        // Core AI Analysis from ComprehensiveAIAnalyzer
        relevanceScore: {
            type: Number,
            min: 0,
            max: 1,
            default: 0
        },
        summary: String,
        highlights: [{
            text: String,
            relevance: {
                type: Number,
                min: 0,
                max: 1
            },
            reason: String,
            timestamp: Number // for video segments
        }],
        keyPoints: [String],
        categories: [String],
        tags: [String],

        // Additional metadata
        complexity: {
            type: String,
            enum: ['beginner', 'intermediate', 'advanced'],
            default: 'intermediate'
        },
        sentiment: {
            type: String,
            enum: ['positive', 'neutral', 'negative'],
            default: 'neutral'
        },
        estimatedWatchTime: String,
        recommendationReason: String,

        // Legacy fields for backward compatibility
        mainTopics: [String],
        overallRelevanceScore: Number, // 0-100 (legacy)

        // Processing metadata
        aiModel: String,
        processedAt: {
            type: Date,
            default: Date.now
        },
        processingStage: String,
        fallback: {
            type: Boolean,
            default: false
        }
    },

    // User engagement
    views: [{
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        viewedAt: {
            type: Date,
            default: Date.now
        },
        relevanceScore: Number,
        userInterested: Boolean,
    }],

    // Content status
    processed: {
        type: Boolean,
        default: false,
    },
    processedAt: {
        type: Date,
        default: null,
    },
    processingError: String,

    createdAt: {
        type: Date,
        default: Date.now,
    },
});

// Index for efficient queries
ContentSchema.index({ publishedAt: -1 });
ContentSchema.index({ source: 1, publishedAt: -1 });
ContentSchema.index({ 'sourceChannel.id': 1, publishedAt: -1 });
ContentSchema.index({ sourceId: 1 }); // For YouTube video IDs
ContentSchema.index({ processedAt: -1 }); // For tracking processed content

module.exports = mongoose.model('Content', ContentSchema);
