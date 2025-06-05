import { debounce } from '../utils/debounce';
import environment from '../config/environment';

console.log('PrivacyPal content script loaded!'); // Immediate log on script load

// Content script that scans for privacy policy links
const PRIVACY_KEYWORDS = [
  'privacy policy',
  'privacy',
  'data policy',
];

// Keep track of found links to prevent duplicates
let lastFoundLinks: string[] = [];

// Configuration
const SCRAPE_ENDPOINT = `${environment.API_URL}/scrape`;

interface PrivacyLink {
  text: string;
  href: string;
  score?: number;
}

interface ScrapeResponse {
  url: string;
  content: string;
}

async function fetchPrivacyPolicyContent(url: string): Promise<string | null> {
  try {
    const response = await fetch(`${SCRAPE_ENDPOINT}?url=${encodeURIComponent(url)}`);
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

    // Send message that we found a link
    chrome.runtime.sendMessage({
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
      chrome.runtime.sendMessage({
        type: 'PRIVACY_CONTENT_FETCHED',
        data: {
          url: bestLink.href,
          content: content
        }
      });
    }

    return [{ text: bestLink.text, href: bestLink.href }];
  }

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

// Immediate scan before debounce
console.log('🚀 Starting initial privacy scan...');
findPrivacyPolicyLinks();

function analyzePage() {
  const privacyLinksPromise = findPrivacyPolicyLinks();
  
  privacyLinksPromise.then(privacyLinks => {
    // Convert links to strings for comparison
    const currentLinks = privacyLinks.map(link => link.href);
    
    // Only send message if we found new links
    if (privacyLinks.length > 0 && 
        JSON.stringify(currentLinks) !== JSON.stringify(lastFoundLinks)) {
      lastFoundLinks = currentLinks;
      
      // Send message to background script
      chrome.runtime.sendMessage({
        type: 'PRIVACY_LINKS_FOUND',
        data: {
          url: window.location.href,
          links: privacyLinks
        }
      });
    }
  });
}

// Debounced version of analyzePage
const debouncedAnalyzePage = debounce(analyzePage, 1000);

// Run debounced analysis
debouncedAnalyzePage();

// Listen for DOM changes (in case links are loaded dynamically)
const observer = new MutationObserver(() => {
  debouncedAnalyzePage();
});

observer.observe(document.body, {
  childList: true,
  subtree: true
}); 