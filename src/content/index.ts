import { debounce } from '../utils/debounce';
import environment from '../config/environment';

console.log('PrivacyPal content script loaded!');

// Content script that scans for privacy policy links
const PRIVACY_KEYWORDS = [
  'privacy policy',
  'privacy',
  'data policy',
];

// Keep track of found links to prevent duplicates
let lastFoundLinks: string[] = [];

// Configuration
const API_ENDPOINT = `${environment.API_URL}/scrape`;

interface PrivacyLink {
  text: string;
  href: string;
  score?: number;
}

interface ScrapeResponse {
  url: string;
  content: string;
}

interface ChromeMessage {
  type: string;
  data: {
    url: string;
    links?: PrivacyLink[];
    content?: string;
  };
}

// Helper function to safely send messages
async function sendMessage(message: ChromeMessage): Promise<void> {
  try {
    await chrome.runtime.sendMessage(message);
  } catch (error) {
    // Ignore "Extension context invalidated" errors
    if (error instanceof Error && !error.message.includes('Extension context invalidated')) {
      console.error('Error sending message:', error);
    }
  }
}

async function fetchPrivacyPolicyContent(url: string): Promise<string | null> {
  try {
    const response = await fetch(`${API_ENDPOINT}?url=${encodeURIComponent(url)}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data: ScrapeResponse = await response.json();
    return data.content;
  } catch (error) {
    console.error('Failed to fetch privacy policy content:', error);
    return null;
  }
}

function getDomainFromUrl(url: string): string {
  try {
    const hostname = new URL(url).hostname;
    // Get domain parts (e.g., ["www", "facebook", "com"])
    const parts = hostname.split('.');
    // Get the main domain parts (e.g., ["facebook", "com"])
    const mainParts = parts.length > 2 ? parts.slice(-2) : parts;
    return mainParts.join('.');
  } catch {
    return '';
  }
}

function isRelatedDomain(domain1: string, domain2: string): boolean {
  // Consider empty domains as not related
  if (!domain1 || !domain2) return false;
  
  // Check if either domain contains the other
  return domain1.includes(domain2) || domain2.includes(domain1);
}

async function findPrivacyPolicyLinks(): Promise<PrivacyLink[]> {
  const links = Array.from(document.getElementsByTagName('a'));
  const currentDomain = getDomainFromUrl(window.location.href);
  
  // First, find all privacy-related links
  const allPrivacyLinks = links.filter(link => {
    const linkText = link.textContent?.toLowerCase() || '';
    return PRIVACY_KEYWORDS.some(keyword => linkText.includes(keyword));
  });

  // Then filter for domain-related links
  const privacyLinks = allPrivacyLinks
    .filter(link => {
      const linkDomain = getDomainFromUrl(link.href);
      return isRelatedDomain(linkDomain, currentDomain);
    })
    .map(link => ({
      text: link.textContent?.trim() || '',
      href: link.href,
      score: calculateLinkScore(link)
    }))
    .sort((a, b) => (b.score || 0) - (a.score || 0));

  // Get the highest scoring link
  if (privacyLinks.length > 0) {
    const bestLink = privacyLinks[0];
    console.log('🔒 Found privacy policy:', {
      page: window.location.href,
      policy: bestLink
    });

    // Send message that we found a link and are processing
    await sendMessage({
      type: 'PRIVACY_LINKS_FOUND',
      data: {
        url: window.location.href,
        links: [{ text: bestLink.text, href: bestLink.href }]
      }
    });

    // Fetch the privacy policy content
    const content = await fetchPrivacyPolicyContent(bestLink.href);
    if (content) {
      console.log('📄 Successfully fetched privacy policy content');
      // Send the content to the background script
      await sendMessage({
        type: 'PRIVACY_CONTENT_FETCHED',
        data: {
          url: bestLink.href,
          content: content
        }
      });
    }

    return [{ text: bestLink.text, href: bestLink.href }];
  }

  // If no privacy policy found, send message
  await sendMessage({
    type: 'NO_PRIVACY_LINK',
    data: {
      url: window.location.href
    }
  });

  return [];
}

function calculateLinkScore(link: HTMLAnchorElement): number {
  const linkText = link.textContent?.toLowerCase() || '';
  let score = 0;

  // Highest priority: Contains "privacy policy"
  if (linkText.includes('privacy policy')) {
    score += 10;
  }
  // Medium priority: Contains just "privacy"
  else if (linkText.includes('privacy')) {
    score += 5;
  }
  // Lower priority: Other privacy-related terms
  else {
    score += 1;
  }

  return score;
}

// Function to analyze the page
async function analyzePage() {
  try {
    const privacyLinks = await findPrivacyPolicyLinks();
    
    // Convert links to strings for comparison
    const currentLinks = privacyLinks.map(link => link.href);
    
    // Only send message if we found new links
    if (privacyLinks.length > 0 && 
        JSON.stringify(currentLinks) !== JSON.stringify(lastFoundLinks)) {
      lastFoundLinks = currentLinks;
    }
  } catch (error) {
    // Ignore "Extension context invalidated" errors
    if (error instanceof Error && !error.message.includes('Extension context invalidated')) {
      console.error('Error in analyzePage:', error);
    }
  }
}

// Immediate scan before debounce
console.log('🚀 Starting initial privacy scan...');
analyzePage();

// Debounced version of analyzePage
const debouncedAnalyzePage = debounce(analyzePage, 1000);

// Create observer
let observer: MutationObserver | null = null;

// Function to start observing
function startObserving() {
  if (observer) return;
  
  observer = new MutationObserver(() => {
    debouncedAnalyzePage();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

// Function to stop observing
function stopObserving() {
  if (observer) {
    observer.disconnect();
    observer = null;
  }
}

// Start observing
startObserving();

// Setup cleanup
const port = chrome.runtime.connect({ name: 'content-script-cleanup' });
port.onDisconnect.addListener(() => {
  stopObserving();
  lastFoundLinks = [];
}); 