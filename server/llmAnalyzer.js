import axios from 'axios';
import dotenv from 'dotenv';

// Configure dotenv to load environment variables
dotenv.config({ path: '../.env' }); // adjust path if needed

/**
 * Analyzes a privacy policy using the OpenRouter API with DeepSeek model
 * @param {string} content - The privacy policy content to analyze
 * @returns {Promise<{summary: Object, analyzed_at: string}>}
 */
export async function analyzePrivacyPolicy(content) {
    // Validate API key before making the request
    if (!process.env.OPENROUTER_API_KEY) {
        throw new Error('OpenRouter API key is missing. Please set the OPENROUTER_API_KEY environment variable.');
    }

    try {
        const response = await axios.post(
            'https://openrouter.ai/api/v1/chat/completions', {
                model: 'deepseek/deepseek-r1-0528-qwen3-8b:free',
                response_format: { type: "json_object" },
                messages: [{
                        role: 'system',
                        content: `You are a privacy policy auditor. Your task is to analyze privacy policies and assign scores based on specific criteria. You MUST output valid JSON in the exact format specified.

For each privacy policy, evaluate and score three categories using these detailed rubrics:

1. Data Collection & Retention
Evaluate:
- How much data is collected?
- Is sensitive or unnecessary data collected?
- Are data sources disclosed?
- Are retention periods specified and reasonable?
- Is data minimization mentioned?

Scoring:
5 – Excellent: Only necessary data collected; clear retention periods; data minimization practiced
4 – Good: Mostly appropriate collection; reasonable retention defaults
3 – Average: Broad/vague collection; unclear retention
2 – Poor: Unnecessary/sensitive data; no retention policy
1 – Very Poor: Excessive collection; no retention mention

2. Data Usage
Evaluate:
- Are purposes clearly stated?
- Essential services vs advertising/analytics?
- Profiling/automated decision-making disclosed?
- Vague terms explained?

Scoring:
5 – Excellent: Narrowly scoped, transparent, aligned with expectations
4 – Good: Mostly clear and appropriate; minor vagueness
3 – Average: General purposes listed but lacks specificity
2 – Poor: Vague/broad usage; undisclosed third-party use
1 – Very Poor: Opaque, excessive, or deceptive

3. User Rights & Controls
Evaluate:
- Access, modify, delete, export rights?
- Tracking/marketing opt-out?
- "Do Not Sell" or consent withdrawal?
- Clear procedures?

Scoring:
5 – Excellent: Full rights available with clear instructions
4 – Good: Most rights supported with usable processes
3 – Average: Some rights mentioned but lack clarity
2 – Poor: Few rights or hard to access
1 – Very Poor: No rights/controls described

Here is the required output format. Fill in the values only:

{
  "data_collection_and_retention": {
    "score": <number 1-5>,
    "justification": "<1-2 sentence explanation>",
    "learn_more": "<3-5 sentence explanation with more details>"
  },
  "data_usage": {
    "score": <number 1-5>,
    "justification": "<1-2 sentence explanation>",
    "learn_more": "<3-5 sentence explanation with more details>"
  },
  "user_rights_and_controls": {
    "score": <number 1-5>,
    "justification": "<1-2 sentence explanation>",
    "learn_more": "<3-5 sentence explanation with more details>"
  },
}`
                    },
                    {
                        role: 'user',
                        content: `Please analyze this privacy policy and provide scores, justifications, and learn more descriptions in the specified JSON format: ${content.substring(0, 14000)}`
                    }
                ],
                temperature: 0.2,
                max_tokens: 1500
            }, {
                headers: {
                    'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
                    'HTTP-Referer': `${process.env.API_URL || 'http://localhost:3000'}`,
                    'X-Title': 'PrivacyPal',
                    'Content-Type': 'application/json'
                }
            }
        );

        // Parse the response content as JSON
        const analysis = JSON.parse(response.data.choices[0].message.content);
        console.log("Analysis: ", analysis);

        return {
            summary: analysis,
            analyzed_at: new Date().toISOString()
        };
    } catch (error) {
        // Log the full error for debugging
        console.error('Error details:', {
            message: error.message,
            response: error.response && error.response.data,
            status: error.response && error.response.status
        });

        // Throw a user-friendly error
        throw new Error(`Failed to analyze privacy policy: ${error.message}`);
    }
}