# API Quick Reference for Relevant Frontend v2.0

## Authentication Flow
```javascript
// 1. Register
const registerResponse = await axios.post('/api/auth/register', {
  email: 'user@example.com',
  password: 'password123',
  name: 'User Name'
});
const token = registerResponse.data.token;

// 2. Store token and set axios defaults
localStorage.setItem('token', token);
axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;

// 3. Get current user
const userResponse = await axios.get('/api/auth/me');
const user = userResponse.data.user;
```

## Hierarchical Interest Management
```javascript
// Set hierarchical interests
await axios.put('/api/user/interests/hierarchical', {
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
// Add YouTube channel
await axios.post('/api/user/youtube-sources', {
  channelId: 'UC_x5XG1OV2P6uZZ5FSM9Ttw',
  channelName: 'Google for Developers',
  channelUrl: 'https://youtube.com/c/googledevelopers'
});

// Process user's subscriptions
const processResponse = await axios.post('/api/content/process-subscriptions');
console.log('Job ID:', processResponse.data.jobId);

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

// Get content highlights with timestamps
const highlightsResponse = await axios.get(`/api/content/${contentId}/highlights`);
const highlights = highlightsResponse.data.highlights;
const segments = highlightsResponse.data.segments;

// Search content
const searchResponse = await axios.get('/api/content/search/artificial intelligence');
const results = searchResponse.data.results;

// Content interactions
await axios.post(`/api/content/${contentId}/like`, { liked: true });
await axios.post(`/api/content/${contentId}/save`, { saved: true });
await axios.post(`/api/content/${contentId}/view`);
await axios.post(`/api/content/${contentId}/dismiss`);

// Get saved content
const savedResponse = await axios.get('/api/content/saved/list');
```

## Background Processing & Monitoring
```javascript
// Check processing status
const statusResponse = await axios.get('/api/content/processing/status');
console.log('Active jobs:', statusResponse.data.activeJobs);

// Admin monitoring (if you have admin access)
const adminStatus = await axios.get('/api/admin/jobs/status');
console.log('Queue stats:', adminStatus.data.queueStats);
console.log('Cron status:', adminStatus.data.cronStatus);

// Manual trigger channel monitoring
await axios.post('/api/admin/trigger/channel-monitoring');
```

// Save content
await axios.post(`/api/content/${contentId}/save`, { saved: true });

// Get saved content
const savedResponse = await axios.get('/api/content/saved/list');
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
