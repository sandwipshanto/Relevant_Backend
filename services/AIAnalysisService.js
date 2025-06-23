const OpenAI = require('openai');

class AIAnalysisService {
    constructor() {
        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });
    }

    /**
     * Analyze video content and extract relevant information
     */
    async analyzeVideoContent(videoData, userInterests) {
        try {
            const { title, description, transcript } = videoData;

            if (!transcript || !transcript.text) {
                return this.analyzeWithoutTranscript(title, description, userInterests);
            }

            console.log(`Analyzing content with AI for: ${title}`);

            // Create interest context for AI
            const interestContext = this.formatUserInterests(userInterests);

            const analysisPrompt = `
You are an expert content analyzer. Analyze this YouTube video content and provide insights.

VIDEO TITLE: ${title}
VIDEO DESCRIPTION: ${description}
TRANSCRIPT: ${transcript.text.substring(0, 8000)} ${transcript.text.length > 8000 ? '...(truncated)' : ''}

USER INTERESTS: ${interestContext}

Please analyze and respond with a JSON object containing:
1. mainTopics: Array of 3-5 main topics discussed
2. summary: 2-sentence summary of the video
3. highlights: Array of key highlights with timestamps (if available)
4. keyPoints: Array of 5-7 important points
5. sentiment: overall sentiment (positive/neutral/negative)
6. complexity: complexity level 1-10 (1=beginner, 10=expert)
7. overallRelevanceScore: 0-100 score of how relevant this is to user interests
8. matchedInterests: Which specific user interests this content matches

Format response as valid JSON only.`;

            const response = await this.openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [
                    {
                        role: "system",
                        content: "You are a content analysis expert. Always respond with valid JSON only."
                    },
                    {
                        role: "user",
                        content: analysisPrompt
                    }
                ],
                max_tokens: 1500,
                temperature: 0.3
            });

            const analysis = JSON.parse(response.choices[0].message.content);

            // Process transcript segments if available
            const processedSegments = await this.analyzeTranscriptSegments(
                transcript.segments,
                userInterests,
                analysis.mainTopics
            );

            return {
                ...analysis,
                transcriptSegments: processedSegments
            };

        } catch (error) {
            console.error('Error in AI analysis:', error.message);
            // Return basic analysis if AI fails
            return this.getFallbackAnalysis(videoData, userInterests);
        }
    }

    /**
     * Analyze transcript segments for topic relevance
     */
    async analyzeTranscriptSegments(segments, userInterests, mainTopics) {
        if (!segments || segments.length === 0) return [];

        try {
            // Group segments into larger chunks (every 10 segments)
            const chunks = [];
            for (let i = 0; i < segments.length; i += 10) {
                const chunk = segments.slice(i, i + 10);
                const combinedText = chunk.map(s => s.text).join(' ');

                if (combinedText.length < 50) continue; // Skip very short chunks

                chunks.push({
                    startTime: chunk[0].start,
                    endTime: chunk[chunk.length - 1].end,
                    text: combinedText,
                    segments: chunk
                });
            }

            const interestContext = this.formatUserInterests(userInterests);
            const processedChunks = [];

            // Analyze chunks in batches to avoid rate limits
            for (let i = 0; i < chunks.length; i += 3) {
                const batch = chunks.slice(i, i + 3);

                for (const chunk of batch) {
                    const segmentAnalysis = await this.analyzeSegment(chunk, interestContext, mainTopics);
                    if (segmentAnalysis.relevanceScore > 30) { // Only keep relevant segments
                        processedChunks.push(segmentAnalysis);
                    }
                }

                // Small delay to respect rate limits
                if (i < chunks.length - 3) {
                    await this.delay(1000);
                }
            }

            return processedChunks;

        } catch (error) {
            console.error('Error analyzing transcript segments:', error.message);
            return [];
        }
    }

    /**
     * Analyze individual segment
     */
    async analyzeSegment(chunk, interestContext, mainTopics) {
        try {
            const prompt = `
Analyze this video segment for relevance to user interests.

SEGMENT (${chunk.startTime}s - ${chunk.endTime}s): ${chunk.text}
USER INTERESTS: ${interestContext}
MAIN VIDEO TOPICS: ${mainTopics.join(', ')}

Rate relevance 0-100 and identify topics. Respond with JSON:
{
  "relevanceScore": 0-100,
  "topics": ["topic1", "topic2"],
  "summary": "1-sentence summary",
  "matchedInterests": ["interest1"]
}`;

            const response = await this.openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [
                    { role: "system", content: "Respond with valid JSON only." },
                    { role: "user", content: prompt }
                ],
                max_tokens: 200,
                temperature: 0.2
            });

            const analysis = JSON.parse(response.choices[0].message.content);

            return {
                startTime: chunk.startTime,
                endTime: chunk.endTime,
                text: chunk.text,
                relevanceScore: analysis.relevanceScore,
                topics: analysis.topics || [],
                summary: analysis.summary || '',
                matchedInterests: analysis.matchedInterests || []
            };

        } catch (error) {
            console.error('Error analyzing segment:', error.message);
            return {
                startTime: chunk.startTime,
                endTime: chunk.endTime,
                text: chunk.text,
                relevanceScore: 0,
                topics: [],
                summary: '',
                matchedInterests: []
            };
        }
    }

    /**
     * Analyze video without transcript (title + description only)
     */
    async analyzeWithoutTranscript(title, description, userInterests) {
        try {
            const interestContext = this.formatUserInterests(userInterests);

            const prompt = `
Analyze this YouTube video based on title and description only.

TITLE: ${title}
DESCRIPTION: ${description}
USER INTERESTS: ${interestContext}

Provide analysis as JSON:
{
  "mainTopics": ["topic1", "topic2"],
  "summary": "2-sentence summary",
  "keyPoints": ["point1", "point2"],
  "sentiment": "positive/neutral/negative",
  "complexity": 1-10,
  "overallRelevanceScore": 0-100,
  "matchedInterests": ["interest1"]
}`;

            const response = await this.openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [
                    { role: "system", content: "Respond with valid JSON only." },
                    { role: "user", content: prompt }
                ],
                max_tokens: 500,
                temperature: 0.3
            });

            return JSON.parse(response.choices[0].message.content);

        } catch (error) {
            console.error('Error in basic analysis:', error.message);
            return this.getFallbackAnalysis({ title, description }, userInterests);
        }
    }

    /**
     * Format user interests for AI context
     */
    formatUserInterests(interests) {
        if (!interests || interests.length === 0) {
            return "No specific interests provided";
        }

        return interests.map(interest => {
            if (typeof interest === 'string') {
                return interest;
            }

            if (interest.category) {
                const subcats = interest.subcategories?.map(sub =>
                    `${sub.name} (${sub.keywords?.join(', ') || 'no keywords'})`
                ).join(', ') || '';

                return `${interest.category}: ${subcats}`;
            }

            return 'Unknown interest format';
        }).join(' | ');
    }

    /**
     * Fallback analysis when AI fails
     */
    getFallbackAnalysis(videoData, userInterests) {
        const { title, description } = videoData;

        // Simple keyword matching for relevance
        const allText = `${title} ${description}`.toLowerCase();
        let relevanceScore = 0;
        const matchedInterests = [];

        if (interests && interests.length > 0) {
            interests.forEach(interest => {
                const interestText = typeof interest === 'string' ?
                    interest :
                    interest.category || '';

                if (allText.includes(interestText.toLowerCase())) {
                    relevanceScore += 20;
                    matchedInterests.push(interestText);
                }
            });
        }

        return {
            mainTopics: [title.split(' ').slice(0, 3).join(' ')],
            summary: `Video about ${title}. ${description?.substring(0, 100) || ''}...`,
            highlights: [],
            keyPoints: [title],
            sentiment: 'neutral',
            complexity: 5,
            overallRelevanceScore: Math.min(relevanceScore, 100),
            matchedInterests,
            transcriptSegments: []
        };
    }

    /**
     * Utility delay function
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = new AIAnalysisService();
