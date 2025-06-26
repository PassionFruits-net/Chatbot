import axios from 'axios';

export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
}

export interface WebSearchResponse {
  results: WebSearchResult[];
  query: string;
}

// Using Bing Search API - you'll need to set BING_SEARCH_KEY environment variable
const BING_SEARCH_ENDPOINT = 'https://api.bing.microsoft.com/v7.0/search';
const BING_SEARCH_KEY = process.env.BING_SEARCH_KEY;

export async function performWebSearch(query: string, count: number = 5): Promise<WebSearchResponse> {
  if (!BING_SEARCH_KEY) {
    console.warn('Bing Search API key not configured, skipping web search');
    return { results: [], query };
  }

  try {
    const response = await axios.get(BING_SEARCH_ENDPOINT, {
      headers: {
        'Ocp-Apim-Subscription-Key': BING_SEARCH_KEY,
        'Accept': 'application/json',
      },
      params: {
        q: query,
        count: count,
        responseFilter: 'Webpages',
        safesearch: 'Moderate',
        freshness: 'Month' // Get relatively recent results
      },
      timeout: 10000, // 10 second timeout
    });

    const webPages = response.data?.webPages?.value || [];
    const results: WebSearchResult[] = webPages.map((page: any) => ({
      title: page.name || '',
      url: page.url || '',
      snippet: page.snippet || '',
    }));

    return {
      results,
      query
    };
  } catch (error) {
    console.error('Web search error:', error);
    return { results: [], query };
  }
}

// Alternative: DuckDuckGo Instant Answer API (free but more limited)
export async function performDuckDuckGoSearch(query: string): Promise<WebSearchResponse> {
  try {
    const response = await axios.get('https://api.duckduckgo.com/', {
      params: {
        q: query,
        format: 'json',
        no_html: '1',
        skip_disambig: '1'
      },
      timeout: 8000,
    });

    const results: WebSearchResult[] = [];
    
    // Add abstract if available
    if (response.data.Abstract) {
      results.push({
        title: response.data.AbstractSource || 'DuckDuckGo',
        url: response.data.AbstractURL || '',
        snippet: response.data.Abstract
      });
    }

    // Add related topics
    if (response.data.RelatedTopics) {
      response.data.RelatedTopics.slice(0, 3).forEach((topic: any) => {
        if (topic.Text && topic.FirstURL) {
          results.push({
            title: topic.Text.split(' - ')[0] || 'Related Topic',
            url: topic.FirstURL,
            snippet: topic.Text
          });
        }
      });
    }

    return {
      results,
      query
    };
  } catch (error) {
    console.error('DuckDuckGo search error:', error);
    return { results: [], query };
  }
}