# API Quick Reference for Relevant Frontend v2.0

## Authentication Flow
```javascript
// 1. Register (email, password, name fields)
const registerResponse = await axios.post('/api/auth/register', {
  email: 'user@example.com',
  password: 'password123',
  name: 'User Name'  // Optional but recommended
});
const token = registerResponse.data.token;

// 2. Store token and set axios defaults
localStorage.setItem('token', token);
axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;

// 3. Login
const loginResponse = await axios.post('/api/auth/login', {
  email: 'user@example.com',
  password: 'password123'
});
const token = loginResponse.data.token;

// 4. Get current user
const userResponse = await axios.get('/api/auth/me');
const user = userResponse.data.user;

// 5. Logout
await axios.post('/api/auth/logout');
```

## Hierarchical Interest Management
```javascript
// Method 1: Set all interests at once
await axios.put('/api/user/interests', {
  interests: {
    "Technology": {
      priority: 9,
      subcategories: {
        "AI/ML": {
          priority: 10,
          keywords: ["artificial intelligence", "machine learning", "neural networks"]
        },
        "Web Development": {
          priority: 8,
          keywords: ["javascript", "react", "nodejs", "api"]
        }
      },
      keywords: ["programming", "coding", "software"]
    },
    "Science": {
      priority: 7,
      subcategories: {
        "Physics": {
          priority: 8,
          keywords: ["quantum", "relativity", "mechanics"]
        }
      },
      keywords: ["research", "discovery", "experiment"]
    }
  }
});

// Method 2: Use hierarchical endpoint (alternative)
await axios.put('/api/user/interests/hierarchical', {
  interests: {
    // Same structure as above
  }
});

// Add single category
await axios.post('/api/user/interests/category', {
  category: 'Entertainment',
  priority: 5,
  keywords: ['movies', 'music', 'games']
});

// Add subcategory
await axios.post('/api/user/interests/subcategory', {
  category: 'Technology',
  subcategory: 'Blockchain',
  priority: 7,
  keywords: ['cryptocurrency', 'bitcoin', 'ethereum']
});

// Delete category
await axios.delete('/api/user/interests/category/Entertainment');

// Delete subcategory
await axios.delete('/api/user/interests/subcategory/Technology/Blockchain');
```

## YouTube Integration
```javascript
// Get all subscribed YouTube channels
const channelsResponse = await axios.get('/api/user/youtube-sources');
const channels = channelsResponse.data.channels;

// Add YouTube channel manually (channelId and channelTitle are required)
await axios.post('/api/user/youtube-sources', {
  channelId: 'UC_x5XG1OV2P6uZZ5FSM9Ttw',
  channelTitle: 'Google for Developers',
  channelUrl: 'https://youtube.com/c/googledevelopers'  // Optional
});

// Import YouTube subscriptions automatically (requires YouTube OAuth)
const importResponse = await axios.post('/api/user/youtube-sources/import', {
  accessToken: 'ya29.a0ARrdaM...'  // YouTube OAuth access token
});
console.log(`Imported ${importResponse.data.totalAdded} channels`);
console.log(`Skipped ${importResponse.data.totalSkipped} existing channels`);

// Remove YouTube channel
await axios.delete('/api/user/youtube-sources/UC_x5XG1OV2P6uZZ5FSM9Ttw');

// Process user's subscriptions (full analysis)
const processResponse = await axios.post('/api/content/process-subscriptions');
console.log('Success:', processResponse.data.success);

// Process only today's content (efficient, no duplicates)
const todayResponse = await axios.post('/api/content/process-today');
console.log('Today\'s content:', todayResponse.data.msg);

// Process specific video
await axios.post('/api/content/process-video', {
  videoId: 'dQw4w9WgXcQ'
});
```

## Content Management & Discovery
```javascript
// Get personalized content feed
const feedResponse = await axios.get('/api/content/feed?page=1&limit=10&minRelevance=0.7');
const content = feedResponse.data.content;

// Get specific content by ID
const contentResponse = await axios.get(`/api/content/${contentId}`);
const contentData = contentResponse.data.content;

// Get content highlights with timestamps
const highlightsResponse = await axios.get(`/api/content/${contentId}/highlights`);
const highlights = highlightsResponse.data.highlights;
const segments = highlightsResponse.data.segments;

// Search content
const searchResponse = await axios.get('/api/content/search/artificial intelligence');
const results = searchResponse.data.results;

// Content interactions
await axios.post(`/api/content/${contentId}/view`);  // Track view
await axios.post(`/api/content/${contentId}/like`, { liked: true });  // Like/unlike
await axios.post(`/api/content/${contentId}/save`, { saved: true });  // Save/unsave
await axios.post(`/api/content/${contentId}/dismiss`);  // Dismiss content

// Get saved content
const savedResponse = await axios.get('/api/content/saved/list');
const savedContent = savedResponse.data.content;
```

## User Profile & Preferences
```javascript
// Get user profile
const profileResponse = await axios.get('/api/user/profile');
const user = profileResponse.data.user;

// Update user preferences
await axios.put('/api/user/preferences', {
  emailNotifications: true,
  contentLanguage: 'en',
  feedFrequency: 'daily'
});

// Get user statistics
const statsResponse = await axios.get('/api/user/stats');
const stats = statsResponse.data.stats;
```

## Background Processing & Monitoring
```javascript
// Check processing status
const statusResponse = await axios.get('/api/content/processing/status');
console.log('Active jobs:', statusResponse.data.activeJobs);

// Admin monitoring (no auth required for these endpoints)
const adminStatus = await axios.get('/api/admin/jobs/status');
console.log('Queue stats:', adminStatus.data.queueStats);
console.log('Cron status:', adminStatus.data.cronStatus);

// Manual trigger channel monitoring (admin)
await axios.post('/api/admin/trigger/channel-monitoring');

// Get AI analysis statistics
const aiStatsResponse = await axios.get('/api/admin/ai/stats');
console.log('AI Stats:', aiStatsResponse.data.stats);

// Update AI configuration (admin)
await axios.put('/api/admin/ai/config', {
  maxFullAnalysis: 3,
  quickScoreThreshold: 0.7,
  fullAnalysisThreshold: 0.85
});
```
```

## Error Handling Pattern
```javascript
try {
  const response = await axios.post('/api/auth/login', loginData);
  // Handle success
} catch (error) {
  if (error.response?.data?.msg) {
    // Display API error message
    showToast(error.response.data.msg, 'error');
  } else {
    // Display generic error
    showToast('Something went wrong', 'error');
  }
}
```

## Sample Test Data
- **Test Email**: `testuser@relevant.com`
- **Test Password**: `testpass123`
- **Sample Interests**: `['AI', 'Web Development', 'Machine Learning', 'Content Creation']`
- **Sample YouTube Channel**: `UC_x5XG1OV2P6uZZ5FSM9Ttw` (Google for Developers)

## 📋 Complete API Endpoint Reference

### Authentication Endpoints (`/api/auth/`)
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/register` | Register new user | No |
| POST | `/login` | Login user | No |
| GET | `/me` | Get current user | Yes |
| POST | `/logout` | Logout user | Yes |

### User Management (`/api/user/`)
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/profile` | Get user profile | Yes |
| PUT | `/interests` | Update user interests | Yes |
| PUT | `/interests/hierarchical` | Update hierarchical interests | Yes |
| POST | `/interests/category` | Add interest category | Yes |
| POST | `/interests/subcategory` | Add interest subcategory | Yes |
| DELETE | `/interests/category/:category` | Delete interest category | Yes |
| DELETE | `/interests/subcategory/:category/:subcategory` | Delete subcategory | Yes |
| GET | `/youtube-sources` | Get all YouTube channels | Yes |
| POST | `/youtube-sources` | Add YouTube channel | Yes |
| POST | `/youtube-sources/import` | Import YouTube subscriptions | Yes |
| DELETE | `/youtube-sources/:channelId` | Remove YouTube channel | Yes |
| PUT | `/preferences` | Update user preferences | Yes |
| GET | `/stats` | Get user statistics | Yes |

### Content Management (`/api/content/`)
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/feed` | Get personalized content feed | Yes |
| GET | `/:id` | Get specific content | Yes |
| GET | `/:id/highlights` | Get content highlights | Yes |
| GET | `/search/:query` | Search content | Yes |
| GET | `/saved/list` | Get saved content | Yes |
| GET | `/processing/status` | Get processing status | Yes |
| POST | `/process-video` | Process specific video | Yes |
| POST | `/process-subscriptions` | Process user subscriptions (full) | Yes |
| POST | `/process-today` | Process today's content only (no duplicates) | Yes |
| POST | `/:id/view` | Mark content as viewed | Yes |
| POST | `/:id/like` | Like/unlike content | Yes |
| POST | `/:id/save` | Save/unsave content | Yes |
| POST | `/:id/dismiss` | Dismiss content | Yes |

### Admin & Monitoring (`/api/admin/`)
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/jobs/status` | Get job queue status | No |
| POST | `/trigger/channel-monitoring` | Trigger channel monitoring | No |
| GET | `/ai/stats` | Get AI analysis statistics | No |
| PUT | `/ai/config` | Update AI configuration | No |

---

## 🧠 Cost-Effective AI Analysis System

The backend now implements a multi-stage AI analysis pipeline designed to minimize costs while maximizing content relevance:

### Analysis Stages

1. **Stage 1: Basic Filtering (FREE)**
   - Filters out obviously irrelevant content
   - Checks for minimum quality indicators
   - Duration and basic metadata validation
   - No AI costs incurred

2. **Stage 2: Keyword Matching (FREE)**
   - Matches content against user interests using keywords
   - Hierarchical interest system integration
   - Relevance scoring based on keyword overlap
   - No AI costs incurred

3. **Stage 3: Quick AI Scoring (LOW COST)**
   - Batch processing for efficiency
   - Simple relevance scoring using AI
   - ~$0.001 per item processed
   - Filters content for final stage

4. **Stage 4: Full AI Analysis (MEDIUM COST - LIMITED)**
   - Comprehensive analysis for top candidates only
   - Maximum 5 items per batch by default
   - ~$0.008 per item processed (using GPT-3.5-turbo)
   - Full topic extraction, sentiment analysis, highlights

### Cost Control Features

- **Configurable Thresholds**: Adjust relevance thresholds for each stage
- **Batch Size Limits**: Control how many items get expensive analysis
- **Real-time Cost Tracking**: Monitor spending per processing job
- **Admin Controls**: Update configuration to balance cost vs. quality

### AI Analysis API Endpoints

#### Get AI Analysis Statistics
```http
GET /api/admin/ai/stats
```

**Response:**
```json
{
  "success": true,
  "stats": {
    "config": {
      "minTitleRelevance": 0.7,
      "keywordMatchThreshold": 2,
      "quickScoreThreshold": 0.6,
      "maxFullAnalysis": 3,
      "fullAnalysisThreshold": 0.75
    },
    "irrelevantKeywords": 15,
    "qualityIndicators": 15
  }
}
```

#### Update AI Configuration
```http
PUT /api/admin/ai/config
```

**Request Body:**
```json
{
  "maxFullAnalysis": 3,
  "quickScoreThreshold": 0.6,
  "fullAnalysisThreshold": 0.75,
  "minTitleRelevance": 0.7
}
```

**Response:**
```json
{
  "success": true,
  "msg": "AI analysis configuration updated",
  "newConfig": {
    "minTitleRelevance": 0.7,
    "maxFullAnalysis": 3,
    "quickScoreThreshold": 0.6,
    "fullAnalysisThreshold": 0.75
  }
}
```

---

## 💰 Cost Optimization Benefits

- **95%+ Cost Reduction**: Switched from GPT-4 to GPT-3.5-turbo for all analysis
- **High Relevance Only**: Only show content with 70%+ relevance score
- **Smart Filtering**: Multi-stage approach eliminates irrelevant content early
- **Configurable Limits**: Admin controls prevent budget overruns
- **Real-time Monitoring**: Track costs and adjust thresholds dynamically
- **Quality Maintenance**: Still provides high-quality analysis for relevant content

---

## 🔧 Quick Setup Reminder

1. **Install Dependencies**: `npm install`
2. **Environment Setup**: Configure `.env` with MongoDB URI and API keys
3. **Start Server**: `npm start` or `npm run dev`
4. **Test Endpoints**: Use provided examples above

---

**📚 For more details, see the main README.md file**
