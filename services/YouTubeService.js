const { google } = require('googleapis');
const { YoutubeTranscript } = require('youtube-transcript');

class YouTubeService {
    constructor() {
        this.youtube = google.youtube({
            version: 'v3',
            auth: process.env.YOUTUBE_API_KEY || 'YOUR_API_KEY' // We'll use OAuth later
        });
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
}

module.exports = new YouTubeService();
