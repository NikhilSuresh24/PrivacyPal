// Background script to handle privacy policy detections
chrome.runtime.onInstalled.addListener(() => {
  console.log('PrivacyPal installed');
});

interface PrivacyContent {
  url: string;
  content: string;
}

// Store privacy policies for each domain
const privacyPolicies = new Map<string, PrivacyContent>();

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

// Listen for messages from content script and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // For GET_PRIVACY_POLICY requests from popup
  if (message.type === 'GET_PRIVACY_POLICY') {
    if (message.domain) {
      const policy = privacyPolicies.get(message.domain);
      sendResponse(policy || null);
    } else {
      sendResponse(null);
    }
    return true; // Will respond asynchronously
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
      contentData = message.data as PrivacyContent;
      if (domain) {
        // Store the privacy policy content
        privacyPolicies.set(domain, contentData);
        console.log(`📥 Stored privacy policy for ${domain}`);
        
        // Update badge to show content is loaded
        updateBadge('CONTENT_LOADED', tabId);
        
        // Notify any open popup
        try {
          chrome.runtime.sendMessage({
            type: 'PRIVACY_CONTENT_UPDATED',
            data: contentData
          }).catch(() => {
            // Ignore errors when popup is not open
            console.log('No popup listening for updates');
          });
        } catch {
          // Ignore errors when message passing fails
        }

        sendResponse({ status: 'content_stored' });
      } else {
        sendResponse({ error: 'Invalid domain' });
      }
      break;

    default:
      sendResponse({ error: 'Unknown message type' });
  }

  return true; // Will respond asynchronously
});

// Handle connection errors
chrome.runtime.onConnect.addListener((port) => {
  port.onDisconnect.addListener(() => {
    if (chrome.runtime.lastError) {
      console.log('Port disconnected:', chrome.runtime.lastError.message);
    }
  });
});