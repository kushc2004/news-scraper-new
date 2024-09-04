import axios from 'axios';
import * as cheerio from 'cheerio';
import { supabase } from '@/lib/supabaseClient'; // Import the Supabase client

const links = {
  "agritech": "https://startupnews.fyi/category/agritech/",
  "artificial-intelligence": "https://startupnews.fyi/category/artificial-intelligence/",
  "edtech": "https://startupnews.fyi/category/ecommerce/",
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

    const $ = cheerio.load(response.data);
    const articles = [];

    $('.td_module_wrap').each((index, element) => {
      if (articles.length >= 20) return false;

      const title = $(element).find('.entry-title a').text().trim();
      const date = $(element).find('.entry-date').text().trim();
      const articleUrl = $(element).find('.entry-title a').attr('href');
      articles.push({ title, date, articleUrl });
    });

    return articles;
  } catch (error) {
    console.error(`Error fetching articles from ${subcategoryUrl}:`, error.message);
    return [];
  }
};

// Function to fetch the first two paragraphs from a specific div with class 'tdb-block-inner td-fix-index'
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
      timeout: 10000,
    });

    const $ = cheerio.load(response.data);

    // Find the first two paragraphs within the specified div
    const paragraphs = [];
    $('.tdb-block-inner.td-fix-index p').each((index, element) => {
      const paragraphText = $(element).text().trim();
      if (paragraphText) {
        paragraphs.push(paragraphText);
      }
      if (paragraphs.length === 2) return false; // Stop after finding two paragraphs
    });

    // Concatenate the first two paragraphs, if available
    const summary = paragraphs.slice(0, 2).join(' ');
    return summary || 'No summary available';
  } catch (error) {
    console.error('Error fetching article page:', error.message);
    return 'No summary available';
  }
};

// Function to save articles in Supabase
const saveArticlesToSupabase = async (articles) => {
  try {
    const { error: delError } = await supabase
        .from('latest_insights')
        .delete()
        .neq('id', '');

    const { data, error } = await supabase.from('latest_insights').insert(articles);
    
    if (error) {
      console.error('Error saving articles to Supabase:', error.message);
    } else {
      console.log('Articles saved successfully:', data);
    }
  } catch (error) {
    console.error('Unexpected error saving articles to Supabase:', error.message);
  }
};

// Main API handler
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    const allArticles = {};

    // Fetch articles for all subcategories in parallel
    await Promise.all(Object.entries(links).map(async ([subcategory, link]) => {
      const articles = await fetchArticlesFromSubcategory(link);

      // Fetch summaries for all articles in parallel
      const articlesWithSummaries = await Promise.all(articles.map(async (article) => {
        const summary = await fetchArticleSummary(article.articleUrl);
        return { subcategory, title: article.title, date: article.date, article_url: article.articleUrl, summary };
      }));

      // Add articles to the overall result, keyed by subcategory
      allArticles[subcategory] = articlesWithSummaries;

      // Save articles to Supabase
      await saveArticlesToSupabase(articlesWithSummaries);
    }));

    res.status(200).json({ message: 'Articles fetched and saved successfully!', allArticles });
  } catch (error) {
    console.error('Error in handler:', error.message);
    res.status(500).json({ error: 'Failed to fetch articles' });
  }
}
