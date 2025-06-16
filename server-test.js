require('dotenv').config({ path: '.env.test' });
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 5001;

// Middleware
app.use(cors());
app.use(express.json());

let mongod;

// Start in-memory MongoDB and connect
async function startServer() {
    try {
        // Start in-memory MongoDB
        mongod = await MongoMemoryServer.create();
        const mongoUri = mongod.getUri();

        console.log('🔥 Starting in-memory MongoDB...');
        console.log('📍 MongoDB URI:', mongoUri);

        // Connect to in-memory MongoDB
        await mongoose.connect(mongoUri);
        console.log('✅ Connected to in-memory MongoDB');

        // Routes
        app.use('/api/auth', require('./routes/auth'));
        app.use('/api/user', require('./routes/user'));
        app.use('/api/content', require('./routes/content'));

        app.get('/', (req, res) => {
            res.json({
                message: '🚀 Relevant API (TEST MODE) - Your Personal Content Curator is running!',
                version: '1.0.0',
                mode: 'IN-MEMORY DATABASE',
                endpoints: {
                    auth: '/api/auth',
                    user: '/api/user',
                    content: '/api/content'
                },
                database: 'In-Memory MongoDB (Test Mode)'
            });
        });

        // Error handling middleware
        app.use((err, req, res, next) => {
            console.error(err.stack);
            res.status(500).json({
                success: false,
                message: 'Something went wrong!',
                error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
            });
        });

        // Start server
        app.listen(PORT, () => {
            console.log(`🚀 Relevant TEST API server running on port ${PORT}`);
            console.log(`🌐 Test it: http://localhost:${PORT}`);
            console.log(`📝 API Docs: Check API_TESTING.md for endpoints`);
            console.log('');
            console.log('🎯 Ready for testing! Try:');
            console.log(`   Invoke-RestMethod -Uri "http://localhost:${PORT}/" -Method Get`);
        });

    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
}

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down gracefully...');
    try {
        if (mongod) {
            await mongod.stop();
            console.log('✅ In-memory MongoDB stopped');
        }
        await mongoose.connection.close();
        console.log('✅ Mongoose connection closed');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error during shutdown:', error);
        process.exit(1);
    }
});

// Start the server
startServer();
