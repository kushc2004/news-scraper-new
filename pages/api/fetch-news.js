import axios from 'axios';
import * as cheerio from 'cheerio';

const links = {
  "agritech": "https://startupnews.fyi/category/agritech/",
  "artificial-intelligence": "https://startupnews.fyi/category/artificial-intelligence/",
  "blockchain": "https://startupnews.fyi/category/blockchain/",
  "ecommerce": "https://startupnews.fyi/category/ecommerce/",
  "edtech": "https://startupnews.fyi/category/edtech/",
  "fintech": "https://startupnews.fyi/category/fintech/",
  "general": "https://startupnews.fyi/category/general/",
  "health-tech": "https://startupnews.fyi/category/health-tech/",
  "logistictech": "https://startupnews.fyi/category/logistictech/",
  "retail-tech": "https://startupnews.fyi/category/retail-tech/",
  "social-media": "https://startupnews.fyi/category/social-media/",
  "tech": "https://startupnews.fyi/category/tech/",
  "travel": "https://startupnews.fyi/category/travel/",
  "ev": "https://startupnews.fyi/category/ev/"
};

// Function to fetch articles from a specific subcategory
const fetchArticlesFromSubcategory = async (subcategoryUrl) => {
  try {
    const response = await axios.get(subcategoryUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
        'Connection': 'keep-alive',
        'DNT': '1',
        'Referer': 'https://www.google.com/',
      },
      timeout: 10000, // 10 seconds timeout
    });

    if ([403, 429, 503].includes(response.status)) {
      console.error(`Request blocked: ${response.status} - ${response.statusText}`);
      return [];
    }

    // Load the HTML using cheerio
    const $ = cheerio.load(response.data);
    const articles = [];
    const dateCount = {};

    console.log(`Scraping ${subcategoryUrl} for articles...`);

    $('.td_module_wrap').each((index, element) => {
      if (articles.length >= 20) return false; // Limit to 20 articles per subcategory

      const title = $(element).find('.entry-title a').text().trim();
      const date = $(element).find('.entry-date').text().trim();
      const articleUrl = $(element).find('.entry-title a').attr('href');

      if (title && date && articleUrl) {
        dateCount[date] = (dateCount[date] || 0) + 1;
        if (dateCount[date] <= 3) { // Limit to 3 articles per date
          articles.push({ title, date, articleUrl });
        }
      }
    });

    console.log(`Total articles fetched from ${subcategoryUrl}: ${articles.length}`);

    return articles;
  } catch (error) {
    console.error(`Error fetching articles from ${subcategoryUrl}:`, error.message);
    return [];
  }
};

// Function to fetch the fifth paragraph from an article
const fetchArticleSummary = async (articleUrl) => {
  try {
    const response = await axios.get(articleUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
        'Connection': 'keep-alive',
        'DNT': '1',
        'Referer': 'https://www.google.com/',
      },
      timeout: 10000, // 10 seconds timeout
    });

    const $ = cheerio.load(response.data);
    const fifthParagraph = $('p').eq(4).text().trim(); // Get the fifth paragraph
    return fifthParagraph || 'No summary available';
  } catch (error) {
    console.error('Error fetching article page:', error.message);
    return 'No summary available';
  }
};

// Main API handler
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    const allArticles = {};

    // Fetch articles for each subcategory link
    for (const [subcategory, link] of Object.entries(links)) {
      const articles = await fetchArticlesFromSubcategory(link);

      // Fetch summaries for each article
      for (const article of articles) {
        const summary = await fetchArticleSummary(article.articleUrl);
        article.summary = summary;
      }

      // Add articles to the overall result, keyed by subcategory
      allArticles[subcategory] = articles;
    }

    // Return the articles grouped by subcategory
    res.status(200).json({ message: 'Articles fetched successfully!', allArticles });
  } catch (error) {
    console.error('Error in handler:', error.message);
    res.status(500).json({ error: 'Failed to fetch articles' });
  }
}
