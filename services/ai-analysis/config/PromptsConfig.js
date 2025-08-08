/**
 * AI Prompts Configuration
 * Centralized prompt templates for AI analysis
 */

module.exports = {
    quickAnalysis: (interestsText, contentBatch) => `Analyze the following YouTube content items for relevance to user interests: ${interestsText}

Content to analyze:
${contentBatch.map((content, index) => `
${index + 1}. Title: ${content.title}
   Description: ${content.description.substring(0, 300)}...
   Channel: ${content.channelTitle}
`).join('\n')}

For each item, provide a realistic relevance score (0.0 to 1.0) based on:
1. How well it matches the user's specific interests
2. Content quality and educational value
3. Likelihood to be valuable to the user

IMPORTANT: Be realistic with scores. Most content should score 0.1-0.4 unless genuinely relevant.
- 0.0-0.3: Not relevant to user interests
- 0.4-0.6: Somewhat related
- 0.7-0.8: Good match
- 0.9-1.0: Perfect match

Respond with only a JSON array of scores (no examples): [score1, score2, score3, ...]`,

    fullAnalysis: (interestsText, content) => `Provide a detailed analysis of this YouTube content for a user interested in: ${interestsText}

Content:
Title: ${content.title}
Description: ${content.description}
Channel: ${content.channelTitle}
Duration: ${content.duration}

Provide analysis in JSON format:
{
    "relevanceScore": 0.0-1.0,
    "summary": "brief summary of content value",
    "categories": ["category1", "category2"],
    "highlights": [
        {"text": "key point", "relevance": 0.9, "reason": "why relevant"}
    ],
    "tags": ["tag1", "tag2"],
    "sentiment": "positive/neutral/negative",
    "complexity": "beginner/intermediate/advanced",
    "estimated_watch_time": "time to get value",
    "keyPoints": ["point1", "point2"],
    "recommendationReason": "why this matches user interests"
}`,

    videoRelevance: (interestsText, videoContent) => `You are analyzing YouTube video relevance for a user interested in: ${interestsText}

Video to analyze:
Title: "${videoContent.title}"
Channel: ${videoContent.channelTitle}
Duration: ${videoContent.duration}
Keywords: ${videoContent.keywords ? videoContent.keywords.slice(0, 15).join(', ') : 'N/A'}

Rate this video's relevance from 0.0 to 1.0 based on how well it matches the user's specific interests.

IMPORTANT MATCHING RULES:
1. If the video title/keywords contain ANY of the user's specific interest keywords (like "AI", "LLM", "programming", etc.), it should score 0.7+ unless it's clearly entertainment-only content.
2. Pay special attention to technical terms and acronyms that match the user's interests.
3. Consider both main categories AND subcategories in the user interests.

SCORING GUIDE:
- 0.0-0.3: Completely irrelevant (entertainment, vlogs, unrelated topics)
- 0.4-0.6: Somewhat related but not directly useful
- 0.7-0.8: Good match with user interests (contains relevant keywords/topics)
- 0.9-1.0: Perfect match, highly valuable content

Be realistic but recognize when content directly matches user's stated interests.

Return JSON:
{
  "relevanceScore": [actual_score_between_0_and_1],
  "isRelevant": [true_if_score_above_0.7],
  "reasoning": "Explain why this score was given, specifically mentioning any keyword matches",
  "keyTopics": ["main", "topics"]
}`,

    segmentScoring: (interestsText, segments) => `Score these video transcript segments (0.0-1.0) based on relevance to user interests: ${interestsText}

Segments:
${segments.slice(0, 10).map((seg, i) => `${i + 1}. ${seg.text.substring(0, 200)}`).join('\n')}

Return only a JSON array of scores: [0.8, 0.3, 0.9, ...]`,

    detailedAnalysis: (interestsText, videoContent) => `Perform detailed analysis of this relevant YouTube video for user interests: ${interestsText}

Video Information:
Title: ${videoContent.title}
Channel: ${videoContent.channelTitle}
Key Topics: ${videoContent.keywords ? videoContent.keywords.join(', ') : 'N/A'}

Based on the title and key topics, provide detailed analysis including:
1. Comprehensive summary of likely content
2. Key learning points
3. Practical applications
4. Content categories
5. Sentiment analysis
6. Target audience

Respond with JSON only:
{
  "summary": "Detailed summary of the video content based on title and topics",
  "keyPoints": ["point1", "point2", "point3"],
  "sentiment": "positive/neutral/negative",
  "topics": ["topic1", "topic2"],
  "categories": ["category1", "category2"],
  "highlights": [
    {
      "text": "key topic or concept",
      "reason": "why this is important"
    }
  ],
  "practicalValue": "How this can be applied practically",
  "targetAudience": "Who would benefit most from this"
}`
};
