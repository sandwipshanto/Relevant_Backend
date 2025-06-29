const { google } = require('googleapis');
const { YoutubeTranscript } = require('youtube-transcript');

class YouTubeService {
    constructor() {
        this.youtube = google.youtube({
            version: 'v3',
            auth: process.env.YOUTUBE_API_KEY || 'YOUR_API_KEY' // We'll use OAuth later
        });

        // Initialize OAuth2 client
        this.oauth2Client = new google.auth.OAuth2(
            process.env.YOUTUBE_CLIENT_ID,
            process.env.YOUTUBE_CLIENT_SECRET,
            process.env.YOUTUBE_REDIRECT_URI || 'http://localhost:3000/auth/youtube/callback'
        );
    }

    /**
     * Get OAuth2 authorization URL
     */
    getAuthUrl() {
        const scopes = [
            'https://www.googleapis.com/auth/youtube.readonly'
        ];

        return this.oauth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: scopes,
            prompt: 'consent'
        });
    }

    /**
     * Exchange authorization code for tokens
     */
    async getTokensFromCode(code) {
        try {
            const { tokens } = await this.oauth2Client.getAccessToken(code);
            return tokens;
        } catch (error) {
            console.error('Error getting tokens from code:', error);
            throw error;
        }
    }

    /**
     * Set OAuth2 credentials
     */
    setCredentials(tokens) {
        this.oauth2Client.setCredentials(tokens);
    }

    /**
     * Refresh access token
     */
    async refreshAccessToken(refreshToken) {
        try {
            this.oauth2Client.setCredentials({
                refresh_token: refreshToken
            });

            const { credentials } = await this.oauth2Client.refreshAccessToken();
            return credentials;
        } catch (error) {
            console.error('Error refreshing access token:', error);
            throw error;
        }
    }

    /**
     * Get user's YouTube subscriptions
     */
    async getUserSubscriptions(accessToken, maxResults = 50) {
        try {
            // Create a new YouTube client with the user's access token
            const authenticatedYoutube = google.youtube({
                version: 'v3',
                auth: this.oauth2Client
            });

            // Set the access token
            this.oauth2Client.setCredentials({
                access_token: accessToken
            });

            let allSubscriptions = [];
            let nextPageToken = null;

            do {
                const response = await authenticatedYoutube.subscriptions.list({
                    part: 'snippet',
                    mine: true,
                    maxResults: Math.min(maxResults, 50), // API limit is 50 per request
                    pageToken: nextPageToken
                });

                const subscriptions = response.data.items.map(item => ({
                    channelId: item.snippet.resourceId.channelId,
                    channelTitle: item.snippet.title,
                    channelUrl: `https://youtube.com/channel/${item.snippet.resourceId.channelId}`,
                    description: item.snippet.description,
                    thumbnails: item.snippet.thumbnails,
                    subscribedAt: item.snippet.publishedAt
                }));

                allSubscriptions = allSubscriptions.concat(subscriptions);
                nextPageToken = response.data.nextPageToken;

                // If we've reached the desired number of results, break
                if (allSubscriptions.length >= maxResults) {
                    allSubscriptions = allSubscriptions.slice(0, maxResults);
                    break;
                }
            } while (nextPageToken);

            return allSubscriptions;
        } catch (error) {
            console.error('Error fetching user subscriptions:', error);
            throw error;
        }
    }

    /**
     * Check if user's email is connected to a YouTube account
     */
    async checkYouTubeConnection(accessToken) {
        try {
            this.oauth2Client.setCredentials({
                access_token: accessToken
            });

            const authenticatedYoutube = google.youtube({
                version: 'v3',
                auth: this.oauth2Client
            });

            // Get the user's channel information
            const response = await authenticatedYoutube.channels.list({
                part: 'snippet',
                mine: true
            });

            if (response.data.items.length > 0) {
                return {
                    isConnected: true,
                    channelId: response.data.items[0].id,
                    channelTitle: response.data.items[0].snippet.title
                };
            }

            return { isConnected: false };
        } catch (error) {
            console.error('Error checking YouTube connection:', error);
            return { isConnected: false };
        }
    }

    /**
     * Get channel details by channel ID
     */
    async getChannelDetails(channelId) {
        try {
            const response = await this.youtube.channels.list({
                part: 'snippet,statistics',
                id: channelId
            });

            if (response.data.items.length === 0) {
                throw new Error('Channel not found');
            }

            const channel = response.data.items[0];
            return {
                id: channel.id,
                title: channel.snippet.title,
                description: channel.snippet.description,
                thumbnails: channel.snippet.thumbnails,
                subscriberCount: channel.statistics.subscriberCount,
                videoCount: channel.statistics.videoCount
            };
        } catch (error) {
            console.error('Error fetching channel details:', error.message);
            throw error;
        }
    }

    /**
     * Get recent videos from a channel
     */
    async getChannelVideos(channelId, maxResults = 10) {
        try {
            // First get the uploads playlist ID
            const channelResponse = await this.youtube.channels.list({
                part: 'contentDetails',
                id: channelId
            });

            if (channelResponse.data.items.length === 0) {
                throw new Error('Channel not found');
            }

            const uploadsPlaylistId = channelResponse.data.items[0].contentDetails.relatedPlaylists.uploads;

            // Get recent videos from uploads playlist
            const videosResponse = await this.youtube.playlistItems.list({
                part: 'snippet',
                playlistId: uploadsPlaylistId,
                maxResults: maxResults,
                order: 'date'
            });

            const videos = [];
            for (const item of videosResponse.data.items) {
                const videoId = item.snippet.resourceId.videoId;

                // Get additional video details
                const videoDetails = await this.getVideoDetails(videoId);
                videos.push({
                    id: videoId,
                    title: item.snippet.title,
                    description: item.snippet.description,
                    publishedAt: item.snippet.publishedAt,
                    thumbnails: item.snippet.thumbnails,
                    channelId: item.snippet.channelId,
                    channelTitle: item.snippet.channelTitle,
                    ...videoDetails
                });
            }

            return videos;
        } catch (error) {
            console.error('Error fetching channel videos:', error.message);
            throw error;
        }
    }

    /**
     * Get detailed video information
     */
    async getVideoDetails(videoId) {
        try {
            const response = await this.youtube.videos.list({
                part: 'snippet,statistics,contentDetails',
                id: videoId
            });

            if (response.data.items.length === 0) {
                throw new Error('Video not found');
            }

            const video = response.data.items[0];
            return {
                duration: this.parseDuration(video.contentDetails.duration),
                viewCount: video.statistics.viewCount,
                likeCount: video.statistics.likeCount,
                commentCount: video.statistics.commentCount,
                tags: video.snippet.tags || [],
                categoryId: video.snippet.categoryId
            };
        } catch (error) {
            console.error('Error fetching video details:', error.message);
            return {};
        }
    }

    /**
     * Get video transcript
     */
    async getVideoTranscript(videoId) {
        try {
            console.log(`Fetching transcript for video: ${videoId}`);

            const transcript = await YoutubeTranscript.fetchTranscript(videoId);

            if (!transcript || transcript.length === 0) {
                console.log('No transcript available for this video');
                return []; // Return empty array instead of null
            }

            // Process transcript into our format
            const segments = transcript.map(item => ({
                start: Math.floor(item.offset / 1000), // Convert to seconds
                end: Math.floor((item.offset + item.duration) / 1000),
                text: item.text,
                topics: [], // Will be filled by AI analysis
                relevanceScore: 0
            }));

            // Return segments array directly for consistency
            return segments;
        } catch (error) {
            console.error('Error fetching transcript:', error.message);
            return []; // Return empty array instead of null
        }
    }

    /**
     * Extract video ID from YouTube URL
     */
    extractVideoId(url) {
        const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
        const match = url.match(regex);
        return match ? match[1] : null;
    }

    /**
     * Extract channel ID from YouTube URL or handle
     */
    async getChannelIdFromUrl(url) {
        try {
            // If it's already a channel ID
            if (url.startsWith('UC') && url.length === 24) {
                return url;
            }

            // Extract from URL
            let channelIdentifier = null;

            if (url.includes('/channel/')) {
                channelIdentifier = url.split('/channel/')[1].split('/')[0];
            } else if (url.includes('/@')) {
                channelIdentifier = url.split('/@')[1].split('/')[0];
            } else if (url.includes('/c/') || url.includes('/user/')) {
                const parts = url.split('/');
                channelIdentifier = parts[parts.length - 1] || parts[parts.length - 2];
            }

            if (!channelIdentifier) {
                throw new Error('Could not extract channel identifier from URL');
            }

            // If it looks like a channel ID, return it
            if (channelIdentifier.startsWith('UC') && channelIdentifier.length === 24) {
                return channelIdentifier;
            }

            // Otherwise, search for the channel
            const searchResponse = await this.youtube.search.list({
                part: 'snippet',
                q: channelIdentifier,
                type: 'channel',
                maxResults: 1
            });

            if (searchResponse.data.items.length === 0) {
                throw new Error('Channel not found');
            }

            return searchResponse.data.items[0].snippet.channelId;
        } catch (error) {
            console.error('Error getting channel ID:', error.message);
            throw error;
        }
    }

    /**
     * Parse YouTube duration format (PT4M13S) to seconds
     */
    parseDuration(duration) {
        const match = duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
        if (!match) return 0;

        const hours = parseInt((match[1] || '0H').replace('H', '')) || 0;
        const minutes = parseInt((match[2] || '0M').replace('M', '')) || 0;
        const seconds = parseInt((match[3] || '0S').replace('S', '')) || 0;

        return hours * 3600 + minutes * 60 + seconds;
    }

    /**
     * Format seconds to readable duration
     */
    formatDuration(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const remainingSeconds = seconds % 60;

        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
        } else {
            return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
        }
    }

    /**
     * Sync user's YouTube subscriptions
     */
    async syncUserSubscriptions(userId) {
        try {
            const User = require('../models/User');
            const user = await User.findById(userId);

            if (!user || !user.youtubeAuth || !user.youtubeAuth.isConnected) {
                throw new Error('User does not have YouTube account connected');
            }

            let accessToken = user.youtubeAuth.accessToken;

            // Check if token needs to be refreshed
            if (new Date() >= user.youtubeAuth.expiryDate) {
                try {
                    const newTokens = await this.refreshAccessToken(user.youtubeAuth.refreshToken);
                    accessToken = newTokens.access_token;

                    // Update user with new tokens
                    user.youtubeAuth.accessToken = newTokens.access_token;
                    user.youtubeAuth.expiryDate = new Date(newTokens.expiry_date);
                    if (newTokens.refresh_token) {
                        user.youtubeAuth.refreshToken = newTokens.refresh_token;
                    }
                } catch (refreshError) {
                    console.error('Error refreshing token:', refreshError);
                    throw new Error('Unable to refresh YouTube access token. Please reconnect your account.');
                }
            }

            // Fetch subscriptions
            const subscriptions = await this.getUserSubscriptions(accessToken);

            // Track changes
            let addedCount = 0;
            let updatedCount = 0;

            // Add new subscriptions and update existing ones
            for (const subscription of subscriptions) {
                const existingIndex = user.youtubeSources.findIndex(
                    source => source.channelId === subscription.channelId
                );

                if (existingIndex === -1) {
                    // Add new subscription
                    user.youtubeSources.push({
                        channelId: subscription.channelId,
                        channelTitle: subscription.channelTitle,
                        channelUrl: subscription.channelUrl,
                        addedAt: new Date()
                    });
                    addedCount++;
                } else {
                    // Update existing subscription
                    user.youtubeSources[existingIndex].channelTitle = subscription.channelTitle;
                    user.youtubeSources[existingIndex].channelUrl = subscription.channelUrl;
                    updatedCount++;
                }
            }

            // Update last sync time
            user.youtubeAuth.lastSyncAt = new Date();
            await user.save();

            console.log(`Synced subscriptions for user ${userId}: ${addedCount} added, ${updatedCount} updated`);

            return {
                totalSubscriptions: subscriptions.length,
                addedCount,
                updatedCount,
                syncedAt: user.youtubeAuth.lastSyncAt
            };

        } catch (error) {
            console.error('Error syncing user subscriptions:', error);
            throw error;
        }
    }
}

module.exports = new YouTubeService();
