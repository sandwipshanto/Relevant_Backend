const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

// Import services
const CronService = require('./services/CronService');
// Use SimpleJobQueue for development (no Redis required)
const JobQueue = require('./services/SimpleJobQueue');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Database connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/relevant');

mongoose.connection.on('connected', () => {
    console.log('Connected to MongoDB');

    // Start background services after DB connection
    console.log('Starting background services...');
    CronService.startAll();
    console.log('✅ Background services started');
});

mongoose.connection.on('error', (err) => {
    console.log('MongoDB connection error:', err);
});

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/user', require('./routes/user'));
app.use('/api/content', require('./routes/content'));
app.use('/api/oauth', require('./routes/youtube'));

// Admin routes for monitoring
app.get('/api/admin/jobs/status', async (req, res) => {
    try {
        const queueStats = await JobQueue.getQueueStats();
        const activeJobs = await JobQueue.getActiveJobs();
        const cronStatus = CronService.getStatus();

        res.json({
            success: true,
            queueStats,
            activeJobs,
            cronStatus
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            msg: 'Error fetching job status',
            error: error.message
        });
    }
});

// Manual trigger endpoints for testing
app.post('/api/admin/trigger/channel-monitoring', async (req, res) => {
    try {
        const result = await CronService.triggerChannelMonitoring();
        res.json({
            success: true,
            msg: 'Channel monitoring triggered',
            jobId: result.id
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            msg: 'Error triggering channel monitoring',
            error: error.message
        });
    }
});

// AI Analysis cost monitoring endpoint
app.get('/api/admin/ai/stats', async (req, res) => {
    try {
        const AIAnalysisService = require('./services/AIAnalysisService');
        const stats = AIAnalysisService.getAnalysisStats();

        // Get cost data from recent content
        const Content = require('./models/Content');
        const recentContent = await Content.find({
            'aiAnalysis.processingCost': { $exists: true },
            processedAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24 hours
        }).limit(100);

        const costAnalysis = recentContent.reduce((acc, content) => {
            const cost = content.aiAnalysis.processingCost || 0;
            const stage = content.aiAnalysis.processingStage || 'unknown';

            acc.totalCost += cost;
            acc.stageBreakdown[stage] = (acc.stageBreakdown[stage] || 0) + cost;
            acc.contentProcessed++;

            if (content.costEffectiveAnalysis) {
                if (content.costEffectiveAnalysis.aiProcessed) {
                    acc.fullyAnalyzed++;
                } else if (content.costEffectiveAnalysis.filtered) {
                    acc.filtered++;
                } else {
                    acc.keywordOnly++;
                }
            }

            return acc;
        }, {
            totalCost: 0,
            contentProcessed: 0,
            fullyAnalyzed: 0,
            keywordOnly: 0,
            filtered: 0,
            stageBreakdown: {}
        });

        res.json({
            success: true,
            aiStats: stats,
            costAnalysis,
            last24Hours: {
                totalCost: costAnalysis.totalCost,
                avgCostPerItem: costAnalysis.contentProcessed > 0 ?
                    costAnalysis.totalCost / costAnalysis.contentProcessed : 0,
                processingBreakdown: {
                    fullyAnalyzed: costAnalysis.fullyAnalyzed,
                    keywordOnly: costAnalysis.keywordOnly,
                    filtered: costAnalysis.filtered
                }
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            msg: 'Error fetching AI stats',
            error: error.message
        });
    }
});

// AI Analysis configuration update endpoint
app.put('/api/admin/ai/config', async (req, res) => {
    try {
        const AIAnalysisService = require('./services/AIAnalysisService');
        const { config } = req.body;

        if (!config) {
            return res.status(400).json({
                success: false,
                msg: 'Configuration data required'
            });
        }

        AIAnalysisService.updateConfig(config);

        res.json({
            success: true,
            msg: 'AI analysis configuration updated',
            newConfig: AIAnalysisService.getAnalysisStats().config
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            msg: 'Error updating AI config',
            error: error.message
        });
    }
});

app.get('/', (req, res) => {
    res.json({
        message: 'Relevant - Your Personal Content Curator API is running!',
        version: '2.0.0',
        features: [
            'YouTube Integration',
            'AI-Powered Content Analysis',
            'Hierarchical Interests',
            'Background Processing',
            'Personalized Content Feed'
        ],
        endpoints: {
            auth: '/api/auth',
            user: '/api/user',
            content: '/api/content',
            admin: '/api/admin'
        }
    });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('SIGTERM received, shutting down gracefully...');
    CronService.stopAll();
    await JobQueue.cleanup();
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('SIGINT received, shutting down gracefully...');
    CronService.stopAll();
    await JobQueue.cleanup();
    process.exit(0);
});

app.listen(PORT, () => {
    console.log(`🚀 Relevant API server running on port ${PORT}`);
    console.log(`📊 Database: ${process.env.MONGODB_URI || 'mongodb://localhost:27017/relevant'}`);
    console.log(`🎯 Features: YouTube Integration, AI Analysis, Background Jobs`);
});
