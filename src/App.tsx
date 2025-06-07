import { useEffect, useState } from "react";
import "./App.css";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronsUpDown, ChevronDown, ChevronUp, X } from "lucide-react";
import type { Analysis, AnalysisSection } from "./types/analysis";
import { ScoreRating } from "./components/ScoreRating";

interface DisplaySection {
  title: string;
  description: string;
  data: AnalysisSection;
}

function AnalysisCollapsibleItem({
  section,
  isFirst,
}: {
  section: DisplaySection;
  isFirst: boolean;
}) {
  const [isOpen, setIsOpen] = useState(isFirst);
  const [showLearnMore, setShowLearnMore] = useState(false);

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={setIsOpen}
      className="w-full border-b border-gray-200 last:border-0"
    >
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-0 text-left">
          <h3 className="text-2xl font-semibold leading-none">{section.title}</h3>
          <p className="text-sm text-gray-500 italic leading-none">{section.description}</p>
        </div>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="icon" className="size-4 shrink-0">
            <ChevronsUpDown className="h-4 w-4" />
            <span className="sr-only">Toggle</span>
          </Button>
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent className="pb-8">
        <div className="flex flex-col space-y-8 p-4 [&>*]:w-full">
          <ScoreRating score={section.data.score} />
          <div className="text-base text-gray-600">
            {showLearnMore
              ? section.data.learn_more
              : section.data.justification}
          </div>
          <div className="flex justify-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowLearnMore(!showLearnMore)}
              className="relative rounded-full border border-[#1C1C1C] bg-transparent px-6 py-2 text-xs font-medium text-[#1C1C1C] transition-all hover:bg-[#1C1C1C] hover:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              {showLearnMore ? (
                <>
                  Show Less <ChevronUp className="ml-1 h-3 w-3" />
                </>
              ) : (
                <>
                  Learn More <ChevronDown className="ml-1 h-3 w-3" />
                </>
              )}
            </Button>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function LoadingState() {
  return (
    <div className="space-y-4">
      <p className="text-center text-lg">
        PrivacyPal is reading the fine print so you don't have to...
      </p>
      <div className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-[90%]" />
        <Skeleton className="h-4 w-[80%]" />
      </div>
    </div>
  );
}

function getDomainWithoutTLD(domain: string): string {
  const mainDomain = domain.split('.')[0];
  return mainDomain.charAt(0).toUpperCase() + mainDomain.slice(1);
}

function App() {
  const [domain, setDomain] = useState<string>("");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const sections: DisplaySection[] = analysis
    ? [
        {
          title: "Data Collection & Retention",
          description: "How your personal information is collected and stored",
          data: analysis.data_collection_and_retention,
        },
        {
          title: "Data Usage",
          description: "How your data is used and shared with others",
          data: analysis.data_usage,
        },
        {
          title: "User Rights & Controls",
          description: "Your rights and control over your personal data",
          data: analysis.user_rights_and_controls,
        },
      ]
    : [];

  useEffect(() => {
    // Get current tab's domain and check for cached analysis
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      const currentTab = tabs[0];
      if (!currentTab?.url) return;

      const domain = getDomainFromUrl(currentTab.url);
      setDomain(domain);
      console.log("Checking cached analysis for domain:", domain);

      try {
        // First try to get directly from storage
        const result = await chrome.storage.local.get(domain);
        const storedData = result[domain];

        console.log("Found in storage:", storedData);
        if (storedData?.analysis) {
          console.log(
            "Setting analysis from storage:",
            storedData.analysis.analysis.summary
          );
          setAnalysis(storedData.analysis.analysis.summary);
          setIsLoading(false);
          return;
        }

        // If not in storage, request from background script
        const response = await chrome.runtime.sendMessage({
          type: "GET_PRIVACY_POLICY",
          domain,
        });

        console.log("Received cached response:", response);
        if (response?.analysis) {
          console.log("Setting cached analysis:", response.analysis);
          setAnalysis(response.analysis);
        }
        setIsLoading(false);
      } catch (error) {
        console.error("Error fetching analysis:", error);
        setIsLoading(false);
      }
    });

    // Listen for storage changes
    const handleStorageChange = (changes: {
      [key: string]: chrome.storage.StorageChange;
    }) => {
      chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
        const currentTab = tabs[0];
        if (!currentTab?.url) return;

        const domain = getDomainFromUrl(currentTab.url);
        if (changes[domain]) {
          const newData = changes[domain].newValue;
          if (newData?.analysis) {
            console.log("Storage updated with new analysis:", newData.analysis);
            setAnalysis(newData.analysis);
            setIsLoading(false);
          }
        }
      });
    };

    chrome.storage.onChanged.addListener(handleStorageChange);

    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange);
    };
  }, []);

  // Helper function to get domain from URL
  function getDomainFromUrl(url: string): string {
    try {
      const hostname = new URL(url).hostname;
      const parts = hostname.split(".");
      const mainParts = parts.length > 2 ? parts.slice(-2) : parts;
      return mainParts.join(".");
    } catch {
      return "";
    }
  }

  const handleClose = () => {
    window.close();
  };

  return (
    <Card className="w-[400px] min-h-[500px] border-none bg-gradient-to-b from-white to-gray-50">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-3xl font-bold">
              <h2 className="text-black">{getDomainWithoutTLD(domain)} Privacy Analysis</h2>
            </CardTitle>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={handleClose}
            className="size-6 rounded-full hover:bg-red-500 hover:text-white bg-red-100 text-red-500 transition-colors"
          >
            <X className="h-3 w-3" />
            <span className="sr-only">Close</span>
          </Button>
        </div>
      </CardHeader>

      <CardContent className="px-6">
        {isLoading ? (
          <LoadingState />
        ) : analysis ? (
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground mb-6">
              We've analyzed this privacy policy to help you understand how your
              data is handled.
            </div>
            <div className="h-px bg-gray-200 w-full" />
            <div className="flex flex-col w-full divide-y divide-gray-200">
              {sections.map((section: DisplaySection, index) => (
                <AnalysisCollapsibleItem
                  key={section.title}
                  section={section}
                  isFirst={index === 0}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center space-y-4">
            <p className="text-muted-foreground">
              No privacy policy analysis available.
            </p>
            <p className="text-sm text-muted-foreground opacity-75">
              We couldn't find a privacy policy on this page.
            </p>
          </div>
        )}
      </CardContent>

      <CardFooter className="mt-auto">
        <p className="w-full text-center italic text-sm text-muted-foreground opacity-75">
          powered by PrivacyPal
        </p>
      </CardFooter>
    </Card>
  );
}

export default App;
