const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
    },
    password: {
        type: String,
        required: true,
    },
    name: {
        type: String,
        trim: true,
    },
    interests: [{
        type: String,
        trim: true,
    }],
    youtubeSources: [{
        channelId: String,
        channelName: String,
        channelUrl: String,
        addedAt: {
            type: Date,
            default: Date.now,
        }
    }],
    preferences: {
        contentFrequency: {
            type: String,
            enum: ['realtime', 'daily', 'weekly'],
            default: 'daily'
        },
        maxContentPerDay: {
            type: Number,
            default: 10
        },
        relevanceThreshold: {
            type: Number,
            default: 0.7,
            min: 0,
            max: 1
        }
    },
    lastActive: {
        type: Date,
        default: Date.now,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

// Update lastActive on user queries
UserSchema.pre('findOneAndUpdate', function () {
    this.set({ lastActive: new Date() });
});

module.exports = mongoose.model('User', UserSchema);
