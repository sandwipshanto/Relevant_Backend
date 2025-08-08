# YouTube Test Data & Refactored AI Analysis

This documentation explains how to use the new test data system and refactored AI Analysis service.

## 🚀 Quick Start

### 1. Fetch Test Data (One-time setup)
```bash
# Fetch YouTube test data
npm run fetch-test-data

# Force refresh data (if needed)
npm run fetch-test-data-force
```

### 2. Test AI Analysis with Cached Data
```bash
# Quick test with small dataset (20 videos)
npm run test-ai

# Test with medium dataset (50 videos)
npm run test-ai-medium

# Test with specific categories
npm run test-ai-programming
npm run test-ai-ml

# Performance comparison test
npm run test-ai-performance
```

## 📊 Test Data Structure

The system creates several test data files:

```
test-data/
├── youtube-test-data.json      # Complete dataset (200+ videos)
├── sample-small.json           # Small sample (20 videos)
├── sample-medium.json          # Medium sample (50 videos)
├── sample-programming.json     # Programming-focused videos
├── sample-ai_ml.json          # AI/ML-focused videos
├── sample-web_development.json # Web dev-focused videos
└── sample-cloud_devops.json    # Cloud/DevOps videos
```

## 🔧 Using Test Data in Your Code

### Load Test Data
```javascript
const TestDataFetcher = require('./scripts/fetchTestData');

// Load different sample sizes
const smallVideos = TestDataFetcher.loadTestData('small');      // 20 videos
const mediumVideos = TestDataFetcher.loadTestData('medium');    // 50 videos
const allVideos = TestDataFetcher.loadTestData('full');         // All videos

// Load category-specific data
const programmingVideos = TestDataFetcher.loadTestData('programming');
const aiVideos = TestDataFetcher.loadTestData('ai_ml');
```

### Test AI Analysis
```javascript
const AITester = require('./scripts/testAIAnalysis');

// Run test with cached data
const tester = new AITester();
const result = await tester.testWithCachedData('small');

// Test different user interests
const userInterests = {
    'AI': { priority: 9, keywords: ['machine learning', 'neural networks'] },
    'Programming': { priority: 8, keywords: ['javascript', 'python'] }
};

const videos = TestDataFetcher.loadTestData('medium');
const analysisResult = await AIAnalysisService.analyzeContent(videos, userInterests);
```

## 🏗️ Refactored AI Analysis Architecture

The AI Analysis service has been refactored into a modular, maintainable structure:

### New Structure
```
services/
└── ai-analysis/
    ├── config/
    │   ├── AnalysisConfig.js     # Main configuration
    │   ├── KeywordsConfig.js     # Content keywords
    │   └── PromptsConfig.js      # AI prompts
    ├── filters/
    │   ├── BaseFilter.js         # Abstract base class
    │   ├── BasicContentFilter.js # Stage 1: Basic filtering
    │   ├── KeywordRelevanceFilter.js # Stage 2: Keyword matching
    │   ├── QualityScorer.js      # Stage 3: Quality scoring
    │   ├── QuickAIAnalyzer.js    # Stage 4: Quick AI analysis
    │   └── FullAIAnalyzer.js     # Stage 5: Detailed AI analysis
    ├── AnalysisPipeline.js       # Orchestrates all filters
    └── OpenRouterService.js      # AI API service
```

### Benefits of Refactoring

1. **Single Responsibility**: Each class has one clear purpose
2. **Easy Testing**: Individual filters can be tested separately
3. **Maintainable**: Changes isolated to specific areas
4. **Configurable**: Centralized configuration management
5. **Extensible**: Easy to add new filters or modify existing ones

### Using the Refactored Service

```javascript
// Same interface as before - backward compatible
const AIAnalysisService = require('./services/AIAnalysisServiceRefactored');

const result = await AIAnalysisService.analyzeContent(videos, userInterests);

// New features
const stats = AIAnalysisService.getAnalysisStats();
const connected = await AIAnalysisService.testConnection();
AIAnalysisService.updateConfig({ minTitleRelevance: 0.8 });
```

## 🧪 Development Workflow

### 1. Testing Individual Components
```javascript
// Test specific filters
const BasicFilter = require('./services/ai-analysis/filters/BasicContentFilter');
const filter = new BasicFilter();
const result = await filter.process(videos, userInterests);
```

### 2. Testing the Pipeline
```javascript
// Test the complete pipeline
const Pipeline = require('./services/ai-analysis/AnalysisPipeline');
const pipeline = new Pipeline();
const result = await pipeline.process(videos, userInterests);
```

### 3. Debug Mode
```bash
# Enable detailed filtering logs
DEBUG_FILTERS=true npm run test-ai
```

## 💰 Cost Monitoring

The refactored system provides detailed cost tracking:

```javascript
const result = await AIAnalysisService.analyzeContent(videos, userInterests);

console.log('Cost Breakdown:', result.cost.breakdown);
// {
//   basiccontentfilter: 0,
//   keywordrelevancefilter: 0,  
//   qualityscorer: 0,
//   quickaianalyzer: 0.012,
//   fullaianalyzer: 0.024
// }

console.log('Total Cost:', result.cost.total);
console.log('Cost Per Item:', result.costPerItem);
```

## 🔧 Configuration

### Update Analysis Thresholds
```javascript
AIAnalysisService.updateConfig({
    minTitleRelevance: 0.8,        // Higher threshold
    maxFullAnalysis: 5,            // More detailed analysis
    fullAnalysisThreshold: 0.7     // Lower threshold for full analysis
});
```

### Customize Keywords
```javascript
// Edit services/ai-analysis/config/KeywordsConfig.js
module.exports = {
    irrelevantKeywords: ['your', 'custom', 'keywords'],
    qualityIndicators: ['tutorial', 'guide', 'advanced'],
    professionalDomains: ['programming', 'ai', 'blockchain']
};
```

## 📈 Performance Monitoring

```javascript
// Get detailed statistics
const stats = AIAnalysisService.getAnalysisStats();

console.log('Pipeline Performance:', stats.pipelineStats);
console.log('OpenRouter API Stats:', stats.openRouterStats);
console.log('Filter Statistics:', stats.pipelineStats.filters);

// Reset statistics
AIAnalysisService.resetStats();
```

## 🚨 Error Handling

The refactored system includes comprehensive error handling:

- **Graceful Degradation**: If AI fails, falls back to rule-based scoring
- **Stage Isolation**: Failure in one stage doesn't break the entire pipeline
- **Detailed Logging**: Clear error messages and debugging information
- **Cost Protection**: Strict limits prevent runaway costs

## 📝 Migration Guide

To migrate from the old service to the refactored one:

1. Replace imports:
   ```javascript
   // Old
   const AIAnalysisService = require('./services/AIAnalysisService');
   
   // New  
   const AIAnalysisService = require('./services/AIAnalysisServiceRefactored');
   ```

2. The API remains the same - no code changes needed!

3. Optionally use new features:
   ```javascript
   // Test connection
   const isConnected = await AIAnalysisService.testConnection();
   
   // Get detailed stats
   const stats = AIAnalysisService.getAnalysisStats();
   ```

This refactored system maintains full backward compatibility while providing much better maintainability and extensibility.
