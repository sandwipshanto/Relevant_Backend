/**
 * YouTube Test Data Fetcher
 * Fetches real YouTube data once and saves it for testing purposes
 * This prevents exhausting API limits during development/testing
 */

const fs = require('fs');
const path = require('path');
const YouTubeService = require('../services/YouTubeService');

class TestDataFetcher {
    constructor() {
        this.dataDir = path.join(__dirname, '..', 'test-data');
        this.ensureDataDir();
    }

    ensureDataDir() {
        if (!fs.existsSync(this.dataDir)) {
            fs.mkdirSync(this.dataDir, { recursive: true });
        }
    }

    async fetchAndSaveData() {
        console.log('🔄 Fetching YouTube test data...');

        try {
            // Define test search queries that will give diverse content
            const testQueries = [
                'javascript tutorial',
                'machine learning explained',
                'react hooks guide',
                'python programming',
                'web development',
                'artificial intelligence',
                'nodejs backend',
                'database design',
                'system design interview',
                'software architecture',
                'docker tutorial',
                'kubernetes explained',
                'aws cloud computing',
                'data structures algorithms',
                'typescript advanced'
            ];

            const allVideos = [];
            let totalFetched = 0;

            for (const query of testQueries) {
                try {
                    console.log(`📹 Fetching videos for: "${query}"`);

                    // Fetch 20 videos per query (adjust based on your API limits)
                    const videos = await YouTubeService.searchVideos(query, 20);

                    if (videos && videos.length > 0) {
                        // Add query context to each video for testing
                        const videosWithContext = videos.map(video => ({
                            ...video,
                            testQuery: query,
                            fetchedAt: new Date().toISOString()
                        }));

                        allVideos.push(...videosWithContext);
                        totalFetched += videos.length;
                        console.log(`  ✅ Fetched ${videos.length} videos`);

                        // Add delay to respect rate limits
                        await this.delay(1000);
                    }
                } catch (error) {
                    console.error(`❌ Error fetching for "${query}":`, error.message);
                    continue;
                }
            }

            // Save the data
            const testData = {
                fetchedAt: new Date().toISOString(),
                totalVideos: allVideos.length,
                queries: testQueries,
                videos: allVideos,
                metadata: {
                    apiCalls: testQueries.length,
                    averageVideosPerQuery: Math.round(allVideos.length / testQueries.length),
                    categories: this.categorizeVideos(allVideos)
                }
            };

            const filePath = path.join(this.dataDir, 'youtube-test-data.json');
            fs.writeFileSync(filePath, JSON.stringify(testData, null, 2));

            console.log(`\n🎉 Successfully saved ${totalFetched} videos to ${filePath}`);
            console.log(`📊 Data breakdown:`);
            console.log(`   - Total videos: ${testData.totalVideos}`);
            console.log(`   - API calls made: ${testData.metadata.apiCalls}`);
            console.log(`   - Average per query: ${testData.metadata.averageVideosPerQuery}`);

            // Create smaller sample files for quick testing
            await this.createSampleFiles(testData);

            return testData;

        } catch (error) {
            console.error('❌ Failed to fetch test data:', error);
            throw error;
        }
    }

    async createSampleFiles(fullData) {
        console.log('\n📝 Creating sample data files...');

        // Create small sample (20 videos)
        const smallSample = {
            ...fullData,
            videos: fullData.videos.slice(0, 20),
            totalVideos: 20
        };

        const smallPath = path.join(this.dataDir, 'sample-small.json');
        fs.writeFileSync(smallPath, JSON.stringify(smallSample, null, 2));
        console.log(`  ✅ Small sample: ${smallPath} (20 videos)`);

        // Create medium sample (50 videos)
        const mediumSample = {
            ...fullData,
            videos: fullData.videos.slice(0, 50),
            totalVideos: 50
        };

        const mediumPath = path.join(this.dataDir, 'sample-medium.json');
        fs.writeFileSync(mediumPath, JSON.stringify(mediumSample, null, 2));
        console.log(`  ✅ Medium sample: ${mediumPath} (50 videos)`);

        // Create category-specific samples
        const categories = this.categorizeVideos(fullData.videos);
        for (const [category, videos] of Object.entries(categories)) {
            if (videos.length > 5) {
                const categorySample = {
                    category,
                    fetchedAt: fullData.fetchedAt,
                    totalVideos: videos.length,
                    videos: videos.slice(0, Math.min(15, videos.length))
                };

                const categoryPath = path.join(this.dataDir, `sample-${category.toLowerCase()}.json`);
                fs.writeFileSync(categoryPath, JSON.stringify(categorySample, null, 2));
                console.log(`  ✅ ${category} sample: ${categoryPath} (${categorySample.videos.length} videos)`);
            }
        }
    }

    categorizeVideos(videos) {
        const categories = {
            'Programming': [],
            'AI_ML': [],
            'Web_Development': [],
            'Cloud_DevOps': [],
            'General_Tech': []
        };

        videos.forEach(video => {
            const text = (video.title + ' ' + video.description).toLowerCase();

            if (text.includes('javascript') || text.includes('python') || text.includes('programming')) {
                categories.Programming.push(video);
            } else if (text.includes('ai') || text.includes('machine learning') || text.includes('artificial intelligence')) {
                categories.AI_ML.push(video);
            } else if (text.includes('react') || text.includes('web') || text.includes('frontend') || text.includes('backend')) {
                categories.Web_Development.push(video);
            } else if (text.includes('docker') || text.includes('kubernetes') || text.includes('aws') || text.includes('cloud')) {
                categories.Cloud_DevOps.push(video);
            } else {
                categories.General_Tech.push(video);
            }
        });

        return categories;
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Method to load test data
    static loadTestData(sampleSize = 'full') {
        const dataDir = path.join(__dirname, '..', 'test-data');
        let filename;

        switch (sampleSize) {
            case 'small':
                filename = 'sample-small.json';
                break;
            case 'medium':
                filename = 'sample-medium.json';
                break;
            case 'programming':
                filename = 'sample-programming.json';
                break;
            case 'ai_ml':
                filename = 'sample-ai_ml.json';
                break;
            case 'web_development':
                filename = 'sample-web_development.json';
                break;
            default:
                filename = 'youtube-test-data.json';
        }

        const filePath = path.join(dataDir, filename);

        if (!fs.existsSync(filePath)) {
            throw new Error(`Test data file not found: ${filePath}. Run 'node scripts/fetchTestData.js' first.`);
        }

        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        console.log(`📖 Loaded ${data.totalVideos} test videos from ${filename}`);
        return data.videos;
    }

    // Method to check if test data exists and is recent
    static hasRecentTestData(maxAgeHours = 24) {
        const dataDir = path.join(__dirname, '..', 'test-data');
        const filePath = path.join(dataDir, 'youtube-test-data.json');

        if (!fs.existsSync(filePath)) {
            return false;
        }

        const stats = fs.statSync(filePath);
        const fileAge = (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60);

        return fileAge < maxAgeHours;
    }
}

// CLI execution
if (require.main === module) {
    const fetcher = new TestDataFetcher();

    async function main() {
        console.log('🚀 YouTube Test Data Fetcher');
        console.log('============================\n');

        // Check if recent data exists
        if (TestDataFetcher.hasRecentTestData()) {
            console.log('⚠️  Recent test data already exists.');
            console.log('   Use --force to fetch new data anyway.\n');

            if (!process.argv.includes('--force')) {
                console.log('💡 To use existing data in your tests:');
                console.log('   const videos = TestDataFetcher.loadTestData("small");');
                console.log('\n   Available sample sizes: small, medium, full, programming, ai_ml, web_development');
                return;
            }
        }

        try {
            await fetcher.fetchAndSaveData();
            console.log('\n✨ Test data is ready for use!');
            console.log('\n💡 Usage in your test files:');
            console.log('   const TestDataFetcher = require("./scripts/fetchTestData");');
            console.log('   const videos = TestDataFetcher.loadTestData("small");');
        } catch (error) {
            console.error('\n❌ Failed to fetch test data:', error.message);
            process.exit(1);
        }
    }

    main();
}

module.exports = TestDataFetcher;
