const mongoose = require('mongoose');

const UserContentSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    contentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Content',
        required: true,
    },
    relevanceScore: {
        type: Number,
        required: true,
        min: 0,
        max: 1,
    },
    matchedInterests: [String],
    personalizedSummary: String,
    personalizedHighlights: [String],

    // User actions
    viewed: {
        type: Boolean,
        default: false,
    },
    viewedAt: Date,
    liked: {
        type: Boolean,
        default: false,
    },
    saved: {
        type: Boolean,
        default: false,
    },
    dismissed: {
        type: Boolean,
        default: false,
    },

    createdAt: {
        type: Date,
        default: Date.now,
    },
});

// Compound index for efficient user queries
UserContentSchema.index({ userId: 1, relevanceScore: -1, createdAt: -1 });
UserContentSchema.index({ userId: 1, viewed: 1 });

module.exports = mongoose.model('UserContent', UserContentSchema);
