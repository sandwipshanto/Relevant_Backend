/**
 * OpenRouter API Service
 * Handles all interactions with OpenRouter AI API
 */

const axios = require('axios');
const AnalysisConfig = require('./config/AnalysisConfig');

class OpenRouterService {
    constructor() {
        this.apiKey = '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';
        this.model = AnalysisConfig.models.primary;
        this.fallbackModel = AnalysisConfig.models.fallback;
        this.apiUrl = 'https://openrouter.ai/api/v1/chat/completions';
        this.costs = AnalysisConfig.costs;

        this.stats = {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            totalTokens: 0,
            totalCost: 0
        };
    }

    /**
     * Make a request to OpenRouter API
     */
    async makeRequest(messages, maxTokens = 500, temperature = 0.3, model = null) {
        const requestModel = model || this.model;

        try {
            this.stats.totalRequests++;

            const response = await axios.post(this.apiUrl, {
                model: requestModel,
                messages: messages,
                max_tokens: maxTokens,
                temperature: temperature
            }, {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                },
                timeout: 30000 // 30 second timeout
            });

            this.stats.successfulRequests++;

            // Track usage if available
            if (response.data.usage) {
                this.stats.totalTokens += response.data.usage.total_tokens || 0;
                this.stats.totalCost += this.calculateCost(response.data.usage.total_tokens || 0, requestModel);
            }

            return response.data;

        } catch (error) {
            this.stats.failedRequests++;
            console.error('OpenRouter API error:', error.response?.data || error.message);

            // Try fallback model if primary fails
            if (requestModel === this.model && this.fallbackModel !== this.model) {
                console.log(`Retrying with fallback model: ${this.fallbackModel}`);
                return this.makeRequest(messages, maxTokens, temperature, this.fallbackModel);
            }

            throw error;
        }
    }

    /**
     * Parse JSON response from AI, handling markdown formatting
     */
    parseResponse(content) {
        try {
            // Remove markdown code blocks if present
            const cleanContent = content
                .replace(/```json\s*/g, '')
                .replace(/```\s*/g, '')
                .trim();

            return JSON.parse(cleanContent);
        } catch (error) {
            console.error('Failed to parse AI response:', content);
            console.error('Parse error:', error.message);
            throw new Error(`Failed to parse AI response: ${error.message}`);
        }
    }

    /**
     * Calculate API costs based on token usage
     */
    calculateCost(tokens, model) {
        const costs = {
            'gpt-3.5-turbo': 0.002 / 1000,
            'gpt-4': 0.03 / 1000,
            'google/gemini-2.0-flash-001': 0.0 / 1000, // Free model
            'meta-llama/llama-3.1-8b-instruct:free': 0.0 / 1000, // Free model
            'openrouter/horizon-beta': 0.001 / 1000
        };

        return tokens * (costs[model] || costs['google/gemini-2.0-flash-001']);
    }

    /**
     * Get service statistics
     */
    getStats() {
        return {
            ...this.stats,
            successRate: this.stats.totalRequests > 0 ?
                (this.stats.successfulRequests / this.stats.totalRequests * 100).toFixed(2) + '%' : '0%',
            averageCostPerRequest: this.stats.successfulRequests > 0 ?
                (this.stats.totalCost / this.stats.successfulRequests).toFixed(6) : 0
        };
    }

    /**
     * Reset statistics
     */
    resetStats() {
        this.stats = {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            totalTokens: 0,
            totalCost: 0
        };
    }

    /**
     * Test API connectivity
     */
    async testConnection() {
        try {
            const response = await this.makeRequest([
                { role: 'user', content: 'Respond with just the word "connected"' }
            ], 10, 0.1);

            const result = response.choices?.[0]?.message?.content?.trim().toLowerCase();
            return result === 'connected';
        } catch (error) {
            console.error('API connection test failed:', error.message);
            return false;
        }
    }

    /**
     * Batch process multiple requests with rate limiting
     */
    async batchProcess(requests, delayMs = 1000) {
        const results = [];

        for (let i = 0; i < requests.length; i++) {
            try {
                const result = await this.makeRequest(...requests[i]);
                results.push({ success: true, data: result, index: i });

                // Add delay between requests to respect rate limits
                if (i < requests.length - 1 && delayMs > 0) {
                    await new Promise(resolve => setTimeout(resolve, delayMs));
                }
            } catch (error) {
                results.push({ success: false, error: error.message, index: i });
            }
        }

        return results;
    }

    /**
     * Format user interests for AI prompts
     */
    formatUserInterests(userInterests) {
        if (Array.isArray(userInterests)) {
            return userInterests.join(', ');
        }

        if (typeof userInterests === 'object') {
            return Object.keys(userInterests).map(interest => {
                const data = userInterests[interest];
                const priority = data?.priority || 5;
                let interestText = `${interest} (priority: ${priority})`;

                // Include subcategories and their keywords
                if (data.subcategories && Object.keys(data.subcategories).length > 0) {
                    const subcategoryTexts = Object.keys(data.subcategories).map(subcat => {
                        const subcatData = data.subcategories[subcat];
                        const subcatPriority = subcatData?.priority || 5;
                        let subcatText = `${subcat} (priority: ${subcatPriority})`;

                        // Include keywords for this subcategory
                        if (subcatData.keywords && subcatData.keywords.length > 0) {
                            subcatText += ` [keywords: ${subcatData.keywords.join(', ')}]`;
                        }

                        return subcatText;
                    });

                    interestText += ` → subcategories: ${subcategoryTexts.join('; ')}`;
                }

                // Include main category keywords
                if (data.keywords && data.keywords.length > 0) {
                    interestText += ` [main keywords: ${data.keywords.join(', ')}]`;
                }

                return interestText;
            }).join(' | ');
        }

        return 'general technology and learning';
    }
}

module.exports = OpenRouterService;
