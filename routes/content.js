const express = require('express');
const { body, validationResult } = require('express-validator');
const Content = require('../models/Content');
const UserContent = require('../models/UserContent');
const User = require('../models/User');
const auth = require('../middleware/auth');

const router = express.Router();

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

        res.json({
            success: true,
            content: validContent,
            pagination: {
                currentPage: parseInt(page),
                totalItems: validContent.length,
                hasMore: validContent.length === parseInt(limit)
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

        res.json({
            success: true,
            content: savedContent,
            pagination: {
                currentPage: parseInt(page),
                totalItems: savedContent.length,
                hasMore: savedContent.length === parseInt(limit)
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

module.exports = router;
