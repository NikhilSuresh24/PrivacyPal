import { debounce } from '../utils/debounce';
import environment from '../config/environment';
import type { Analysis } from '../types/analysis';

console.log('PrivacyPal content script loaded!');

// Create and inject the button container
function injectLogoButton() {
  // Remove any existing button
  const existingButton = document.getElementById('privacy-pal-button-container');
  if (existingButton) {
    existingButton.remove();
  }

  // Create wrapper
  const wrapper = document.createElement('div');
  wrapper.id = 'privacy-pal-button-container';
  
  // Create shadow DOM
  const shadow = wrapper.attachShadow({ mode: 'closed' });

  // Add styles
  const style = document.createElement('style');
  style.textContent = `
    .privacy-pal-button {
      position: fixed;
      top: 20px;
      right: 0;
      z-index: 2147483647;
      width: 48px;
      height: 48px;
      border-radius: 8px 0 0 8px;
      background-color: #00B4DB;
      cursor: pointer;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
      border: none;
      padding: 0;
      margin: 0;
      opacity: 0;
      transform: translateY(-10px);
      animation: slideIn 0.3s ease forwards;
    }

    .privacy-pal-button:hover {
      background-color: #0083B0;
      transform: scale(1.05);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    }

    .privacy-pal-close {
      position: absolute;
      top: -6px;
      left: -6px;
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background-color: #ff4444;
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 10px;
      font-family: Arial, sans-serif;
      cursor: pointer;
      transition: all 0.2s ease;
      border: 1px solid white;
      opacity: 0;
      transform: scale(0.8);
    }

    .privacy-pal-button:hover .privacy-pal-close {
      opacity: 1;
      transform: scale(1);
    }

    .privacy-pal-close:hover {
      background-color: #ff0000;
      transform: scale(1.1) !important;
    }

    .privacy-pal-button img {
      width: 32px;
      height: 32px;
      object-fit: contain;
    }

    @keyframes slideIn {
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
  `;

  // Create button
  const button = document.createElement('button');
  button.className = 'privacy-pal-button';

  // Create close button
  const closeButton = document.createElement('div');
  closeButton.className = 'privacy-pal-close';
  closeButton.textContent = '×';
  closeButton.addEventListener('click', (e) => {
    e.stopPropagation(); // Prevent main button click
    wrapper.remove(); // Remove the entire button from DOM
  });
  button.appendChild(closeButton);

  // Add logo image
  const img = document.createElement('img');
  const svgUrl = chrome.runtime.getURL('src/assets/logo.svg');
  const pngUrl = chrome.runtime.getURL('src/assets/logo.png');
  
  // Try to load SVG first, fallback to PNG if SVG fails
  img.onerror = () => {
    img.src = pngUrl;
  };
  img.src = svgUrl;
  img.alt = 'PrivacyPal';
  button.appendChild(img);

  // Add click handler
  button.addEventListener('click', () => {
    // Open the extension popup programmatically
    chrome.runtime.sendMessage({ type: 'OPEN_POPUP' });
  });

  // Add everything to shadow DOM
  shadow.appendChild(style);
  shadow.appendChild(button);

  // Add to page
  document.body.appendChild(wrapper);
}

// Content script that scans for privacy policy links
const PRIVACY_KEYWORDS = [
  'privacy policy',
  'privacy',
  'data policy',
];

// Keep track of found links to prevent duplicates
let lastFoundLinks: string[] = [];
let isProcessing = false;
let lastProcessedUrl = '';

// Configuration
const API_ENDPOINT = `${environment.API_URL}/scrape`;

interface PrivacyLink {
  text: string;
  href: string;
  score?: number;
}

interface ChromeMessage {
  type: string;
  data: {
    url: string;
    links?: PrivacyLink[];
    content?: string;
    analysis?: Analysis;
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

async function fetchPrivacyPolicyContent(url: string): Promise<Analysis | null> {
  try {
    const response = await fetch(`${API_ENDPOINT}?url=${encodeURIComponent(url)}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const analysis = await response.json();
    console.log('Fetched analysis:', analysis);
    return analysis;
  } catch (error) {
    console.error('Failed to fetch privacy policy analysis:', error);
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

    // Fetch and analyze the privacy policy
    const analysis = await fetchPrivacyPolicyContent(bestLink.href);
    if (analysis) {
      console.log('📄 Successfully analyzed privacy policy:', analysis);
      // Send the analysis to the background script
      await sendMessage({
        type: 'PRIVACY_CONTENT_FETCHED',
        data: {
          url: bestLink.href,
          analysis: analysis
        }
      });
      console.log('Sent analysis to background script');

      // Show the button when we have analysis
      injectLogoButton();
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
  // Don't process if we're already processing or if we've already processed this URL
  if (isProcessing || lastProcessedUrl === window.location.href) {
    return;
  }

  try {
    isProcessing = true;
    const privacyLinks = await findPrivacyPolicyLinks();
    
    // Convert links to strings for comparison
    const currentLinks = privacyLinks.map(link => link.href);
    
    // Only process if we haven't seen these links before
    if (privacyLinks.length > 0 && 
        JSON.stringify(currentLinks) !== JSON.stringify(lastFoundLinks)) {
      lastFoundLinks = currentLinks;
      lastProcessedUrl = window.location.href;
    }
  } catch (error) {
    // Ignore "Extension context invalidated" errors
    if (error instanceof Error && !error.message.includes('Extension context invalidated')) {
      console.error('Error in analyzePage:', error);
    }
  } finally {
    isProcessing = false;
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
  isProcessing = false;
  lastProcessedUrl = '';
}); 