const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Database connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/relevant');

mongoose.connection.on('connected', () => {
    console.log('Connected to MongoDB');
});

mongoose.connection.on('error', (err) => {
    console.log('MongoDB connection error:', err);
});

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/user', require('./routes/user'));
app.use('/api/content', require('./routes/content'));

app.get('/', (req, res) => {
    res.json({
        message: 'Relevant - Your Personal Content Curator API is running!',
        version: '1.0.0',
        endpoints: {
            auth: '/api/auth',
            user: '/api/user',
            content: '/api/content'
        }
    });
});

app.listen(PORT, () => {
    console.log(`🚀 Relevant API server running on port ${PORT}`);
    console.log(`📊 Database: ${process.env.MONGODB_URI || 'mongodb://localhost:27017/relevant'}`);
});
