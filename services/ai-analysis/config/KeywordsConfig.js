/**
 * Content Keywords Configuration
 * Keyword lists for content filtering and scoring
 */

module.exports = {
    // Keywords that indicate low-quality or irrelevant content
    irrelevantKeywords: [
        'clickbait', 'drama', 'gossip', 'scandal', 'reaction', 'react',
        'unboxing', 'haul', 'vlog', 'daily life', 'random', 'asmr',
        'weird', 'crazy', 'insane', 'shocking', 'you won\'t believe',
        'prank', 'challenge', 'tiktok', 'meme', 'funny',
        'entertainment only', 'just for fun', 'random thoughts'
    ],

    // Keywords that indicate high-quality educational content
    qualityIndicators: [
        'tutorial', 'guide', 'explanation', 'analysis', 'research',
        'study', 'science', 'technology', 'learning', 'education',
        'how to', 'deep dive', 'comprehensive', 'detailed', 'expert',
        'course', 'lesson', 'technical', 'professional', 'industry',
        'case study', 'best practices', 'methodology', 'framework'
    ],

    // Professional/Technical domain keywords
    professionalDomains: [
        'programming', 'software', 'development', 'engineering', 'design',
        'business', 'marketing', 'finance', 'data science', 'ai', 'ml',
        'machine learning', 'artificial intelligence', 'cybersecurity',
        'cloud computing', 'devops', 'architecture', 'management'
    ]
};
