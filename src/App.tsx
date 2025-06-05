import { useEffect, useState } from 'react'
import './App.css'

interface PrivacyContent {
  url: string;
  content: string;
}

interface ChromeMessage {
  type: string;
  data?: PrivacyContent;
}

function App() {
  const [privacyContent, setPrivacyContent] = useState<PrivacyContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Function to get the current tab's domain
    const getCurrentDomain = async () => {
      try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        const currentTab = tabs[0];
        if (!currentTab.url) return '';
        
        const url = new URL(currentTab.url);
        const parts = url.hostname.split('.');
        const mainParts = parts.length > 2 ? parts.slice(-2) : parts;
        return mainParts.join('.');
      } catch (error) {
        console.error('Error getting domain:', error);
        return '';
      }
    };

    // Function to fetch privacy policy content
    const fetchPrivacyContent = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const domain = await getCurrentDomain();
        if (!domain) {
          setError('Could not determine current domain');
          setLoading(false);
          return;
        }

        // Get the privacy policy from the background script
        const response = await new Promise<PrivacyContent | null>((resolve) => {
          chrome.runtime.sendMessage(
            { type: 'GET_PRIVACY_POLICY', domain },
            (response) => {
              if (chrome.runtime.lastError) {
                console.error('Error:', chrome.runtime.lastError);
                resolve(null);
              } else {
                resolve(response);
              }
            }
          );
        });

        if (response) {
          setPrivacyContent(response);
        }
        setLoading(false);
      } catch (error) {
        console.error('Error in fetchPrivacyContent:', error);
        setError('An error occurred while fetching the privacy policy');
        setLoading(false);
      }
    };

    // Listen for updates from the background script
    const messageListener = (message: ChromeMessage) => {
      if (message.type === 'PRIVACY_CONTENT_UPDATED' && message.data) {
        setPrivacyContent(message.data);
        setLoading(false);
      }
    };

    // Add listener and fetch initial content
    chrome.runtime.onMessage.addListener(messageListener);
    fetchPrivacyContent();

    // Cleanup
    return () => {
      chrome.runtime.onMessage.removeListener(messageListener);
    };
  }, []);

  return (
    <div className="w-[400px] min-h-[300px] p-4">
      <h1 className="text-2xl font-bold mb-4">PrivacyPal</h1>
      
      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        </div>
      ) : error ? (
        <div className="text-center text-red-600 py-8">
          {error}
          <br />
          <button 
            onClick={() => window.location.reload()} 
            className="mt-2 text-blue-600 hover:text-blue-800 underline"
          >
            Try Again
          </button>
        </div>
      ) : privacyContent ? (
        <div className="space-y-4">
          <div className="bg-gray-100 p-3 rounded">
            <p className="text-sm text-gray-600">Privacy Policy URL:</p>
            <a 
              href={privacyContent.url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 break-all"
            >
              {privacyContent.url}
            </a>
          </div>
          
          <div className="mt-4">
            <h2 className="text-lg font-semibold mb-2">Privacy Policy Content:</h2>
            <div className="bg-white border border-gray-200 rounded p-3 max-h-[400px] overflow-y-auto">
              <p className="whitespace-pre-wrap text-sm">{privacyContent.content}</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center text-gray-600 py-8">
          No privacy policy found for this website yet.
          <br />
          Try refreshing the page if you think this is an error.
        </div>
      )}
    </div>
  )
}

export default App
