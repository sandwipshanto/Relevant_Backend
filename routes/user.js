const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const auth = require('../middleware/auth');

const router = express.Router();

// Get user profile
router.get('/profile', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        res.json({
            success: true,
            user
        });
    } catch (err) {
        console.error('Profile fetch error:', err.message);
        res.status(500).json({
            success: false,
            msg: 'Error fetching user profile'
        });
    }
});

// Update user interests
router.put('/interests', [
    body('interests').isArray().withMessage('Interests must be an array'),
], auth, async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }

        const { interests } = req.body;

        const user = await User.findByIdAndUpdate(
            req.user.id,
            { interests: interests.map(i => i.trim()).filter(i => i.length > 0) },
            { new: true }
        ).select('-password');

        res.json({
            success: true,
            user,
            msg: 'Interests updated successfully'
        });
    } catch (err) {
        console.error('Update interests error:', err.message);
        res.status(500).json({
            success: false,
            msg: 'Error updating interests'
        });
    }
});

// Add YouTube channel source
router.post('/youtube-sources', [
    body('channelId').notEmpty().withMessage('Channel ID is required'),
    body('channelName').notEmpty().withMessage('Channel name is required'),
], auth, async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }

        const { channelId, channelName, channelUrl } = req.body;

        const user = await User.findById(req.user.id);

        // Check if channel already exists
        const existingSource = user.youtubeSources.find(
            source => source.channelId === channelId
        );

        if (existingSource) {
            return res.status(400).json({
                success: false,
                msg: 'YouTube channel already added'
            });
        }

        user.youtubeSources.push({
            channelId,
            channelName,
            channelUrl: channelUrl || `https://youtube.com/channel/${channelId}`
        });
        await user.save();

        res.json({
            success: true,
            youtubeSources: user.youtubeSources,
            msg: 'YouTube channel added successfully'
        });
    } catch (err) {
        console.error('Add YouTube source error:', err.message);
        res.status(500).json({
            success: false,
            msg: 'Error adding YouTube channel'
        });
    }
});

// Remove YouTube channel source
router.delete('/youtube-sources/:channelId', auth, async (req, res) => {
    try {
        const { channelId } = req.params;

        const user = await User.findById(req.user.id);

        user.youtubeSources = user.youtubeSources.filter(
            source => source.channelId !== channelId
        );
        await user.save();

        res.json({
            success: true,
            youtubeSources: user.youtubeSources,
            msg: 'YouTube channel removed successfully'
        });
    } catch (err) {
        console.error('Remove YouTube source error:', err.message);
        res.status(500).json({
            success: false,
            msg: 'Error removing YouTube channel'
        });
    }
});

// Update user preferences
router.put('/preferences', [
    body('contentFrequency').optional().isIn(['realtime', 'daily', 'weekly']),
    body('maxContentPerDay').optional().isInt({ min: 1, max: 50 }),
    body('relevanceThreshold').optional().isFloat({ min: 0, max: 1 }),
], auth, async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }

        const { contentFrequency, maxContentPerDay, relevanceThreshold } = req.body;

        const updateData = {};
        if (contentFrequency) updateData['preferences.contentFrequency'] = contentFrequency;
        if (maxContentPerDay) updateData['preferences.maxContentPerDay'] = maxContentPerDay;
        if (relevanceThreshold !== undefined) updateData['preferences.relevanceThreshold'] = relevanceThreshold;

        const user = await User.findByIdAndUpdate(
            req.user.id,
            updateData,
            { new: true }
        ).select('-password');

        res.json({
            success: true,
            user,
            msg: 'Preferences updated successfully'
        });
    } catch (err) {
        console.error('Update preferences error:', err.message);
        res.status(500).json({
            success: false,
            msg: 'Error updating preferences'
        });
    }
});

// Get user statistics
router.get('/stats', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');

        // You can add more statistics here later
        const stats = {
            totalInterests: user.interests.length,
            totalYoutubeSources: user.youtubeSources.length,
            memberSince: user.createdAt,
            lastActive: user.lastActive,
        };

        res.json({
            success: true,
            stats
        });
    } catch (err) {
        console.error('Stats fetch error:', err.message);
        res.status(500).json({
            success: false,
            msg: 'Error fetching user statistics'
        });
    }
});

module.exports = router;
