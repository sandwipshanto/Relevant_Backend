const express = require('express');
const User = require('../models/User');
const auth = require('../middleware/auth');
const YouTubeService = require('../services/YouTubeService');

const router = express.Router();

// Get YouTube OAuth URL
router.get('/youtube/auth-url', auth, async (req, res) => {
    try {
        const authUrl = YouTubeService.getAuthUrl();
        res.json({
            success: true,
            authUrl
        });
    } catch (error) {
        console.error('Error getting YouTube auth URL:', error);
        res.status(500).json({
            success: false,
            msg: 'Error generating YouTube authentication URL'
        });
    }
});

// Handle YouTube OAuth callback
router.post('/youtube/callback', auth, async (req, res) => {
    try {
        const { code } = req.body;

        if (!code) {
            return res.status(400).json({
                success: false,
                msg: 'Authorization code is required'
            });
        }

        // Exchange code for tokens
        const tokens = await YouTubeService.getTokensFromCode(code);

        // Check if the connection is valid
        const connectionInfo = await YouTubeService.checkYouTubeConnection(tokens.access_token);

        if (!connectionInfo.isConnected) {
            return res.status(400).json({
                success: false,
                msg: 'Unable to connect to YouTube account'
            });
        }

        // Update user with YouTube OAuth information
        const user = await User.findById(req.user.id);
        user.youtubeAuth = {
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token,
            expiryDate: new Date(tokens.expiry_date),
            isConnected: true,
            connectedAt: new Date()
        };
        await user.save();

        // Automatically fetch and add subscriptions
        try {
            await YouTubeService.syncUserSubscriptions(user._id.toString());
        } catch (syncError) {
            console.error('Error syncing subscriptions during connection:', syncError);
            // Don't fail the connection if sync fails
        }

        res.json({
            success: true,
            msg: 'YouTube account connected successfully',
            channelInfo: connectionInfo
        });

    } catch (error) {
        console.error('Error handling YouTube callback:', error);
        res.status(500).json({
            success: false,
            msg: 'Error connecting YouTube account'
        });
    }
});

// Disconnect YouTube account
router.post('/youtube/disconnect', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);

        // Clear YouTube OAuth information
        user.youtubeAuth = {
            isConnected: false
        };

        // Optionally clear YouTube sources
        const { clearSources } = req.body;
        if (clearSources) {
            user.youtubeSources = [];
        }

        await user.save();

        res.json({
            success: true,
            msg: 'YouTube account disconnected successfully'
        });

    } catch (error) {
        console.error('Error disconnecting YouTube account:', error);
        res.status(500).json({
            success: false,
            msg: 'Error disconnecting YouTube account'
        });
    }
});

// Manually sync YouTube subscriptions
router.post('/youtube/sync-subscriptions', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);

        if (!user.youtubeAuth || !user.youtubeAuth.isConnected) {
            return res.status(400).json({
                success: false,
                msg: 'YouTube account not connected'
            });
        }

        const syncResult = await YouTubeService.syncUserSubscriptions(user._id.toString());

        res.json({
            success: true,
            msg: 'Subscriptions synced successfully',
            ...syncResult
        });

    } catch (error) {
        console.error('Error syncing YouTube subscriptions:', error);
        res.status(500).json({
            success: false,
            msg: 'Error syncing YouTube subscriptions'
        });
    }
});

// Get YouTube connection status
router.get('/youtube/status', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('youtubeAuth youtubeSources');

        const status = {
            isConnected: user.youtubeAuth?.isConnected || false,
            connectedAt: user.youtubeAuth?.connectedAt,
            lastSyncAt: user.youtubeAuth?.lastSyncAt,
            subscriptionsCount: user.youtubeSources?.length || 0
        };

        res.json({
            success: true,
            status
        });

    } catch (error) {
        console.error('Error getting YouTube status:', error);
        res.status(500).json({
            success: false,
            msg: 'Error getting YouTube connection status'
        });
    }
});

module.exports = router;
