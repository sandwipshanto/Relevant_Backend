const express = require('express');
const { body, validationResult } = require('express-validator');
const axios = require('axios');
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
router.put('/interests', auth, async (req, res) => {
    try {
        const { interests } = req.body;

        // Validate input - support both array (legacy) and object (hierarchical) formats
        if (!interests) {
            return res.status(400).json({
                success: false,
                msg: 'Interests are required'
            });
        }

        let processedInterests;

        if (Array.isArray(interests)) {
            // Legacy array format - convert to simple categories
            processedInterests = {};
            interests.forEach(interest => {
                if (typeof interest === 'string' && interest.trim()) {
                    processedInterests[interest.trim()] = {
                        priority: 5,
                        subcategories: {},
                        keywords: []
                    };
                }
            });
        } else if (typeof interests === 'object' && interests !== null) {
            // Hierarchical object format
            processedInterests = {};
            for (const [category, data] of Object.entries(interests)) {
                if (typeof data === 'object' && data !== null) {
                    processedInterests[category] = {
                        priority: Math.max(1, Math.min(10, data.priority || 5)),
                        subcategories: data.subcategories || {},
                        keywords: Array.isArray(data.keywords) ? data.keywords : []
                    };
                }
            }
        } else {
            return res.status(400).json({
                success: false,
                msg: 'Interests must be an array or object'
            });
        }

        const user = await User.findByIdAndUpdate(
            req.user.id,
            { $set: { interests: processedInterests } },
            { new: true }
        ).select('-password');

        res.json({
            success: true,
            user,
            interests: user.interests,
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
    body('channelTitle').notEmpty().withMessage('Channel title is required'),
], auth, async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }

        const { channelId, channelTitle, channelUrl } = req.body;

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
            channelTitle,
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

// Get all user's YouTube sources
router.get('/youtube-sources', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('youtubeSources');

        res.json({
            success: true,
            channels: user.youtubeSources || []
        });
    } catch (err) {
        console.error('Error fetching YouTube sources:', err.message);
        res.status(500).json({
            success: false,
            msg: 'Failed to fetch YouTube sources'
        });
    }
});

// Import YouTube subscriptions automatically
router.post('/youtube-sources/import', [
    body('accessToken').notEmpty().withMessage('YouTube access token is required'),
], auth, async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        } const { accessToken } = req.body;

        // Fetch user's subscriptions from YouTube API
        let allSubscriptions = [];
        let nextPageToken = null;

        do {
            const subscriptionsResponse = await axios.get(
                'https://www.googleapis.com/youtube/v3/subscriptions',
                {
                    params: {
                        part: 'snippet',
                        mine: true,
                        maxResults: 50, // YouTube API limit
                        pageToken: nextPageToken,
                        key: process.env.YOUTUBE_API_KEY
                    },
                    headers: {
                        Authorization: `Bearer ${accessToken}`
                    }
                }
            );

            allSubscriptions = allSubscriptions.concat(subscriptionsResponse.data.items);
            nextPageToken = subscriptionsResponse.data.nextPageToken;
        } while (nextPageToken);

        const user = await User.findById(req.user.id);
        const addedChannels = [];
        const skippedChannels = [];

        // Add each subscription to user's sources
        for (const subscription of allSubscriptions) {
            const channelData = {
                channelId: subscription.snippet.resourceId.channelId,
                channelTitle: subscription.snippet.title,
                channelUrl: `https://youtube.com/channel/${subscription.snippet.resourceId.channelId}`
            };

            // Check if channel already exists
            const existingSource = user.youtubeSources.find(
                source => source.channelId === channelData.channelId
            );

            if (!existingSource) {
                user.youtubeSources.push(channelData);
                addedChannels.push(channelData);
            } else {
                skippedChannels.push(channelData);
            }
        }

        await user.save();

        res.json({
            success: true,
            message: `Successfully imported ${addedChannels.length} channels`,
            addedChannels,
            skippedChannels,
            totalFound: allSubscriptions.length,
            totalAdded: addedChannels.length,
            totalSkipped: skippedChannels.length
        });

    } catch (error) {
        console.error('Error importing YouTube subscriptions:', error);

        // Handle specific YouTube API errors
        if (error.response?.status === 401) {
            return res.status(401).json({
                success: false,
                msg: 'Invalid or expired YouTube access token'
            });
        } else if (error.response?.status === 403) {
            return res.status(403).json({
                success: false,
                msg: 'YouTube API quota exceeded or access denied'
            });
        }

        res.status(500).json({
            success: false,
            msg: 'Failed to import YouTube subscriptions'
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

// Update hierarchical interests (categories, subcategories, keywords)
router.put('/interests/hierarchical', [
    body('interests').isObject().withMessage('Interests must be an object with categories')
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

        // Validate interests structure
        const validatedInterests = {};
        for (const [category, data] of Object.entries(interests)) {
            if (typeof data === 'object' && data !== null) {
                validatedInterests[category] = {
                    priority: Math.max(1, Math.min(10, data.priority || 5)),
                    subcategories: data.subcategories || {},
                    keywords: Array.isArray(data.keywords) ? data.keywords : []
                };
            }
        } const user = await User.findByIdAndUpdate(
            req.user.id,
            { $set: { interests: validatedInterests } },
            { new: true }
        ).select('-password');

        res.json({
            success: true,
            user,
            msg: 'Hierarchical interests updated successfully'
        });

    } catch (error) {
        console.error('Update hierarchical interests error:', error);
        res.status(500).json({
            success: false,
            msg: 'Error updating hierarchical interests'
        });
    }
});

// Add or update a specific interest category
router.post('/interests/category', [
    body('category').notEmpty().withMessage('Category name is required'),
    body('priority').isInt({ min: 1, max: 10 }).withMessage('Priority must be between 1 and 10'),
], auth, async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }

        const { category, priority, subcategories = {}, keywords = [] } = req.body; const user = await User.findById(req.user.id);

        console.log(`[DEBUG] Adding category "${category}" for user ${req.user.id}`);
        console.log('[DEBUG] User interests before:', typeof user.interests, user.interests);

        // Initialize interests as object if not exists or if it's still array format
        if (!user.interests || Array.isArray(user.interests) || typeof user.interests !== 'object') {
            console.log('[DEBUG] Initializing interests as empty object');
            user.interests = {};
        }

        // Add or update category
        user.interests[category] = {
            priority: parseInt(priority),
            subcategories: subcategories || {},
            keywords: Array.isArray(keywords) ? keywords : []
        }; console.log('[DEBUG] User interests after adding category:', user.interests);

        // Use findByIdAndUpdate with $set to ensure the save works
        const updatedUser = await User.findByIdAndUpdate(
            req.user.id,
            { $set: { interests: user.interests } },
            { new: true }
        );

        console.log('[DEBUG] User interests after update:', updatedUser.interests);
        console.log('[DEBUG] Interests keys after update:', Object.keys(updatedUser.interests || {}));

        res.json({
            success: true,
            category,
            interests: updatedUser.interests,
            msg: 'Interest category updated successfully'
        });

    } catch (error) {
        console.error('Add interest category error:', error);
        res.status(500).json({
            success: false,
            msg: 'Error adding interest category'
        });
    }
});

// Add subcategory to an existing category
router.post('/interests/subcategory', [
    body('category').notEmpty().withMessage('Category name is required'),
    body('subcategory').notEmpty().withMessage('Subcategory name is required'),
    body('priority').isInt({ min: 1, max: 10 }).withMessage('Priority must be between 1 and 10'),
], auth, async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }

        const { category, subcategory, priority, keywords = [] } = req.body; const user = await User.findById(req.user.id);

        // Initialize interests as object if not exists or if it's still array format
        if (!user.interests || Array.isArray(user.interests) || typeof user.interests !== 'object') {
            user.interests = {};
        }

        // Check if category exists
        if (!user.interests[category]) {
            return res.status(400).json({
                success: false,
                msg: 'Category does not exist'
            });
        }

        // Initialize subcategories if not exists
        if (!user.interests[category].subcategories) {
            user.interests[category].subcategories = {};
        }        // Add subcategory
        user.interests[category].subcategories[subcategory] = {
            priority: parseInt(priority),
            keywords: Array.isArray(keywords) ? keywords : []
        };

        const updatedUser = await User.findByIdAndUpdate(
            req.user.id,
            { $set: { interests: user.interests } },
            { new: true }
        );

        res.json({
            success: true,
            category,
            subcategory,
            interests: updatedUser.interests,
            msg: 'Subcategory added successfully'
        });

    } catch (error) {
        console.error('Add subcategory error:', error);
        res.status(500).json({
            success: false,
            msg: 'Error adding subcategory'
        });
    }
});

// Delete interest category
router.delete('/interests/category/:category', auth, async (req, res) => {
    try {
        const { category } = req.params; const user = await User.findById(req.user.id);


        // Initialize interests as object if not exists or if it's still array format
        if (!user.interests || Array.isArray(user.interests) || typeof user.interests !== 'object') {

            user.interests = {};
        }

        if (!user.interests[category]) {

            return res.status(404).json({
                success: false,
                msg: 'Category not found'
            });
        } delete user.interests[category];


        const updatedUser = await User.findByIdAndUpdate(
            req.user.id,
            { $set: { interests: user.interests } },
            { new: true }
        );

        res.json({
            success: true,
            deletedCategory: category,
            interests: updatedUser.interests,
            msg: 'Category deleted successfully'
        });

    } catch (error) {
        console.error('Delete category error:', error);
        res.status(500).json({
            success: false,
            msg: 'Error deleting category'
        });
    }
});

// Delete subcategory
router.delete('/interests/subcategory/:category/:subcategory', auth, async (req, res) => {
    try {
        const { category, subcategory } = req.params; const user = await User.findById(req.user.id);

        // Initialize interests as object if not exists or if it's still array format
        if (!user.interests || Array.isArray(user.interests) || typeof user.interests !== 'object') {
            user.interests = {};
        }

        if (!user.interests[category] || !user.interests[category].subcategories || !user.interests[category].subcategories[subcategory]) {
            return res.status(404).json({
                success: false,
                msg: 'Subcategory not found'
            });
        } delete user.interests[category].subcategories[subcategory];

        const updatedUser = await User.findByIdAndUpdate(
            req.user.id,
            { $set: { interests: user.interests } },
            { new: true }
        );

        res.json({
            success: true,
            deletedSubcategory: subcategory,
            category,
            interests: updatedUser.interests,
            msg: 'Subcategory deleted successfully'
        });

    } catch (error) {
        console.error('Delete subcategory error:', error);
        res.status(500).json({
            success: false,
            msg: 'Error deleting subcategory'
        });
    }
});

module.exports = router;
