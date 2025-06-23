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
        mainTopics: [String],
        summary: String,
        highlights: [{
            text: String,
            timestamp: Number,
            relevanceScore: Number,
            matchedInterests: [String]
        }],
        keyPoints: [String],
        sentiment: String,
        complexity: Number, // 1-10
        overallRelevanceScore: Number // 0-100
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

module.exports = mongoose.model('Content', ContentSchema);
