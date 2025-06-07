import express from 'express';
import cors from 'cors';
import puppeteer from 'puppeteer';
import { analyzePrivacyPolicy } from './llmAnalyzer.js';

const app = express();
const port = process.env.PORT || 3000;

// Enable CORS for the Chrome extension
app.use(cors());
app.use(express.json());

// Initialize browser instance
let browser;
async function initBrowser() {
    browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
}

// Handle graceful shutdown
process.on('SIGINT', async() => {
    if (browser) {
        await browser.close();
    }
    process.exit();
});

app.get('/scrape', async(req, res) => {
    try {
        const { url } = req.query;

        if (!url) {
            return res.status(400).json({ error: 'URL parameter is required' });
        }

        // Initialize browser if not already initialized
        if (!browser) {
            await initBrowser();
        }

        // Create a new page
        const page = await browser.newPage();

        try {
            // Set viewport and user agent
            await page.setViewport({ width: 1280, height: 800 });
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');

            // Navigate to the page
            await page.goto(url, {
                waitUntil: 'networkidle0',
                timeout: 30000
            });

            // Wait for body content to load
            await page.waitForSelector('body');

            // Extract text content
            const content = await page.evaluate(() => {
                return document.body.innerText;
            });

            // Clean the content
            const cleanedContent = content.replace(/\s+/g, ' ').trim();

            // Only analyze if there's actual content
            if (!cleanedContent) {
                return res.json({
                    url,
                    content: '',
                    analysis: null,
                    message: 'No content found to analyze'
                });
            }

            // Check if content looks like a privacy policy
            const privacyRelatedTerms = ['privacy', 'data', 'collection', 'personal information', 'cookies'];
            const hasPrivacyTerms = privacyRelatedTerms.some(term =>
                cleanedContent.toLowerCase().includes(term)
            );

            if (!hasPrivacyTerms) {
                return res.json({
                    url,
                    content: cleanedContent,
                    analysis: null,
                    message: 'Content does not appear to be a privacy policy'
                });
            }

            // Analyze the privacy policy
            const analysis = await analyzePrivacyPolicy(cleanedContent);

            res.json({
                url,
                content: cleanedContent,
                analysis,
                message: 'Successfully analyzed privacy policy'
            });

        } finally {
            // Always close the page to free up resources
            await page.close();
        }

    } catch (error) {
        console.error('Scraping error:', error);
        res.status(500).json({
            error: 'Failed to scrape privacy policy',
            message: error.message
        });
    }
});

// Initialize browser when server starts
initBrowser().then(() => {
    app.listen(port, () => {
        console.log(`PrivacyPal server running on port ${port}`);
    });
}).catch(error => {
    console.error('Failed to initialize browser:', error);
    process.exit(1);
});