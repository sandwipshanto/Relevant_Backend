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
