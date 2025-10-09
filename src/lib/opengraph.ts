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
 * Checks if an image URL is valid (not SVG)
 * @param imageUrl The image URL to check
 * @returns true if the image is not an SVG, false otherwise
 */
function isValidImageFormat(imageUrl: string): boolean {
  const lowerUrl = imageUrl.toLowerCase();
  // Remove query parameters and fragments to check the actual file extension
  const urlWithoutParams = lowerUrl.split('?')[0].split('#')[0];
  // Blacklist SVG files only
  return !urlWithoutParams.endsWith('.svg');
}

/**
 * Fetches Open Graph data from a URL and extracts image URLs
 * @param url The website URL to fetch Open Graph data from
 * @returns Array of image URLs found in the metadata (all formats except SVG)
 */
export async function fetchEventImages(url: string): Promise<string[]> {
  try {
    // Check if API key is available
    if (!OPENGRAPH_API_KEY) {
      console.error(`[OPENGRAPH] API key is missing!`);
      return [];
    }

    // URL encode the site URL
    const encodedUrl = encodeURIComponent(url);
    const apiUrl = `${OPENGRAPH_BASE_URL}/${encodedUrl}?app_id=${OPENGRAPH_API_KEY}`;

    console.log(`[OPENGRAPH] Fetching images from: ${url}`);
    const response = await fetch(apiUrl);

    if (!response.ok) {
      console.error(`[OPENGRAPH] API error for ${url}: ${response.status} ${response.statusText}`);
      return [];
    }

    const data: OpenGraphResponse = await response.json();
    console.log(`[OPENGRAPH] Response data:`, JSON.stringify(data).substring(0, 200));
    const imageUrls: string[] = [];

    // Priority 1: Extract from hybridGraph
    if (data.hybridGraph?.image && typeof data.hybridGraph.image === 'string') {
      if (isValidImageFormat(data.hybridGraph.image)) {
        imageUrls.push(data.hybridGraph.image);
      }
    }

    if (data.hybridGraph?.images && Array.isArray(data.hybridGraph.images)) {
      for (const img of data.hybridGraph.images) {
        if (typeof img === 'string' && isValidImageFormat(img)) {
          imageUrls.push(img);
        }
      }
    }

    // Priority 2: Fallback to openGraph if no hybridGraph images found
    if (imageUrls.length === 0) {
      // Extract from openGraph.image
      if (data.openGraph?.image) {
        if (typeof data.openGraph.image === 'object' && data.openGraph.image.url) {
          if (isValidImageFormat(data.openGraph.image.url)) {
            imageUrls.push(data.openGraph.image.url);
          }
        }
      }

      // Extract from openGraph.images array
      if (data.openGraph?.images && Array.isArray(data.openGraph.images)) {
        for (const img of data.openGraph.images) {
          if (typeof img === 'object' && img.url) {
            if (isValidImageFormat(img.url)) {
              imageUrls.push(img.url);
            }
          } else if (typeof img === 'string') {
            if (isValidImageFormat(img)) {
              imageUrls.push(img);
            }
          }
        }
      }
    }

    // Priority 3: Final fallback to htmlInferred.images
    if (imageUrls.length === 0 && data.htmlInferred?.images && Array.isArray(data.htmlInferred.images)) {
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
    }
    return uniqueImages;
  } catch (error) {
    console.error(`[OPENGRAPH] Error fetching data for ${url}:`, error);
    return [];
  }
}
