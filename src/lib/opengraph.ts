/**
 * OpenGraph.io API integration for fetching event images
 */

const OPENGRAPH_API_KEY = process.env.OPENGRAPH_API_KEY;
const OPENGRAPH_BASE_URL = "https://opengraph.io/api/1.1/site";

export interface OpenGraphImage {
  url: string;
  width?: string;
  height?: string;
  type?: string;
}

export interface OpenGraphResponse {
  openGraph?: {
    title?: string;
    type?: string;
    image?: OpenGraphImage;
    images?: OpenGraphImage[];
  };
  hybridGraph?: {
    title?: string;
    type?: string;
    image?: string;
    images?: string[];
  };
  htmlInferred?: {
    title?: string;
    description?: string;
    type?: string;
    image?: string;
    favicon?: string;
    images?: string[];
  };
}

/**
 * Checks if an image URL is a valid JPG or PNG (not SVG)
 * @param imageUrl The image URL to check
 * @returns true if the image is JPG or PNG, false otherwise
 */
function isValidImageFormat(imageUrl: string): boolean {
  const lowerUrl = imageUrl.toLowerCase();
  return lowerUrl.endsWith('.jpg') ||
         lowerUrl.endsWith('.jpeg') ||
         lowerUrl.endsWith('.png');
}

/**
 * Returns a random fallback image URL from the curated fallback image set
 * @returns A public URL path to a random fallback image
 */
function getRandomFallbackImage(): string {
  const imageNumber = Math.floor(Math.random() * 10) + 1; // Random number 1-10
  return `/fallback-images/${imageNumber}.png`;
}

/**
 * Fetches Open Graph data from a URL and extracts image URLs
 * @param url The website URL to fetch Open Graph data from
 * @returns Array of image URLs found in the Open Graph metadata (JPG/PNG only)
 */
export async function fetchEventImages(url: string): Promise<string[]> {
  try {
    // Check if API key is available
    if (!OPENGRAPH_API_KEY) {
      console.error(`[OPENGRAPH] API key is missing!`);
      const fallbackImage = getRandomFallbackImage();
      console.log(`[OPENGRAPH] API key missing, using fallback: ${fallbackImage}`);
      return [fallbackImage];
    }

    // URL encode the site URL
    const encodedUrl = encodeURIComponent(url);
    const apiUrl = `${OPENGRAPH_BASE_URL}/${encodedUrl}?app_id=${OPENGRAPH_API_KEY}`;

    console.log(`[OPENGRAPH] Fetching images from: ${url}`);
    const response = await fetch(apiUrl);

    if (!response.ok) {
      console.error(`[OPENGRAPH] API error for ${url}: ${response.status} ${response.statusText}`);
      const fallbackImage = getRandomFallbackImage();
      console.log(`[OPENGRAPH] API error, using fallback: ${fallbackImage}`);
      return [fallbackImage];
    }

    const data: OpenGraphResponse = await response.json();
    console.log(`[OPENGRAPH] Response data:`, JSON.stringify(data).substring(0, 200));
    const imageUrls: string[] = [];

    // Check if openGraph has any images
    let hasOpenGraphImages = false;

    // Extract from openGraph.image
    if (data.openGraph?.image) {
      if (typeof data.openGraph.image === 'object' && data.openGraph.image.url) {
        hasOpenGraphImages = true;
        if (isValidImageFormat(data.openGraph.image.url)) {
          imageUrls.push(data.openGraph.image.url);
        }
      }
    }

    // Extract from openGraph.images array
    if (data.openGraph?.images && Array.isArray(data.openGraph.images)) {
      for (const img of data.openGraph.images) {
        if (typeof img === 'object' && img.url) {
          hasOpenGraphImages = true;
          if (isValidImageFormat(img.url)) {
            imageUrls.push(img.url);
          }
        } else if (typeof img === 'string') {
          hasOpenGraphImages = true;
          if (isValidImageFormat(img)) {
            imageUrls.push(img);
          }
        }
      }
    }

    // If openGraph is empty or has no images, fallback to htmlInferred.images
    if (!hasOpenGraphImages && data.htmlInferred?.images && Array.isArray(data.htmlInferred.images)) {
      for (const img of data.htmlInferred.images) {
        if (typeof img === 'string' && isValidImageFormat(img)) {
          imageUrls.push(img);
        }
      }
    }

    // Remove duplicates
    const uniqueImages = [...new Set(imageUrls)];
    console.log(`[OPENGRAPH] Found ${uniqueImages.length} valid image(s) for ${url}`);
    if (uniqueImages.length > 0) {
      console.log(`[OPENGRAPH] Images:`, uniqueImages);
      return uniqueImages;
    }

    // Use fallback image if no images found
    const fallbackImage = getRandomFallbackImage();
    console.log(`[OPENGRAPH] No images found, using fallback: ${fallbackImage}`);
    return [fallbackImage];
  } catch (error) {
    console.error(`[OPENGRAPH] Error fetching data for ${url}:`, error);
    const fallbackImage = getRandomFallbackImage();
    console.log(`[OPENGRAPH] Error occurred, using fallback: ${fallbackImage}`);
    return [fallbackImage];
  }
}
