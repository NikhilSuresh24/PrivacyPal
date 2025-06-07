// Background script to handle privacy policy detections
chrome.runtime.onInstalled.addListener(() => {
  console.log('PrivacyPal installed');
});

import type { Analysis } from '../types/analysis';

interface PrivacyContent {
  url: string;
  content: string;
  analysis?: Analysis;
  timestamp: number;  // Add timestamp for cache management
}

// Badge states
const BADGE_STATES = {
  NO_POLICY: {
    text: '✓',
    color: '#4CAF50' // Green
  },
  PROCESSING: {
    text: '⚙️',
    color: '#1976D2' // Blue
  },
  CONTENT_LOADED: {
    text: '❗',
    color: '#FFA000' // Orange
  }
} as const;

function getDomainFromUrl(url: string): string {
  try {
    const hostname = new URL(url).hostname;
    const parts = hostname.split('.');
    const mainParts = parts.length > 2 ? parts.slice(-2) : parts;
    return mainParts.join('.');
  } catch {
    return '';
  }
}

// Function to update badge
function updateBadge(state: keyof typeof BADGE_STATES, tabId: number) {
  chrome.action.setBadgeText({ 
    text: BADGE_STATES[state].text,
    tabId 
  });
  chrome.action.setBadgeBackgroundColor({ 
    color: BADGE_STATES[state].color,
    tabId 
  });
}

// Function to store privacy content in chrome.storage.local
async function storePrivacyContent(domain: string, content: PrivacyContent): Promise<void> {
  try {
    await chrome.storage.local.set({ [domain]: content });
    console.log(`📥 Stored privacy policy for ${domain} in local storage:`, content);
  } catch (error) {
    console.error('Error storing privacy content:', error);
  }
}

// Function to get privacy content from chrome.storage.local
async function getPrivacyContent(domain: string): Promise<PrivacyContent | null> {
  try {
    const result = await chrome.storage.local.get(domain);
    return result[domain] || null;
  } catch (error) {
    console.error('Error getting privacy content:', error);
    return null;
  }
}

// Listen for messages from content script and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Background received message:', message);
  
  // For GET_PRIVACY_POLICY requests from popup
  if (message.type === 'GET_PRIVACY_POLICY') {
    if (message.domain) {
      // Use async/await with chrome.storage.local
      getPrivacyContent(message.domain)
        .then(policy => {
          console.log('Found cached policy for domain:', message.domain, policy);
          sendResponse(policy);
        })
        .catch(error => {
          console.error('Error getting cached policy:', error);
          sendResponse(null);
        });
      return true; // Will respond asynchronously
    }
    sendResponse(null);
    return true;
  }

  // For OPEN_POPUP requests from content script
  if (message.type === 'OPEN_POPUP') {
    chrome.action.openPopup();
    return true;
  }

  // For messages from content script
  if (!sender.tab?.id) {
    sendResponse({ error: 'No tab ID found' });
    return true;
  }

  const tabId = sender.tab.id;
  const domain = getDomainFromUrl(sender.tab.url || '');
  let contentData: PrivacyContent;
  
  switch (message.type) {
    case 'NO_PRIVACY_LINK':
      updateBadge('NO_POLICY', tabId);
      sendResponse({ status: 'received' });
      break;

    case 'PRIVACY_LINKS_FOUND':
      // Update badge to show we're processing
      updateBadge('PROCESSING', tabId);
      sendResponse({ status: 'received' });
      break;

    case 'PRIVACY_CONTENT_FETCHED':
      console.log('Received PRIVACY_CONTENT_FETCHED:', message.data);
      contentData = {
        ...message.data,
        timestamp: Date.now()
      } as PrivacyContent;
      
      if (domain) {
        // Store the privacy policy content in chrome.storage.local
        storePrivacyContent(domain, contentData)
          .then(() => {
            // Update badge to show content is loaded
            updateBadge('CONTENT_LOADED', tabId);
            sendResponse({ status: 'content_stored' });
          })
          .catch(error => {
            console.error('Error storing content:', error);
            sendResponse({ error: 'Failed to store content' });
          });
        return true; // Will respond asynchronously
      } else {
        sendResponse({ error: 'Invalid domain' });
      }
      break;

    default:
      sendResponse({ error: 'Unknown message type' });
  }

  return true;
});

// Handle connection errors
chrome.runtime.onConnect.addListener((port) => {
  port.onDisconnect.addListener(() => {
    if (chrome.runtime.lastError) {
      console.log('Port disconnected:', chrome.runtime.lastError.message);
    }
  });
});