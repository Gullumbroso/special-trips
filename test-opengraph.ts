/**
 * Test script for OpenGraph image fetching
 * Run with: OPENGRAPH_API_KEY=6dc1b1e1-39fa-4f40-a8a0-3897aa60c050 npx tsx test-opengraph.ts
 */

import { fetchEventImages } from "./src/lib/opengraph";

async function testOpenGraph() {
  // Verify API key is set
  if (!process.env.OPENGRAPH_API_KEY) {
    console.error("❌ OPENGRAPH_API_KEY environment variable is not set!");
    console.log("Run with: OPENGRAPH_API_KEY=your-key-here npx tsx test-opengraph.ts");
    process.exit(1);
  }

  console.log(`🔑 API Key loaded: ${process.env.OPENGRAPH_API_KEY.substring(0, 8)}...`);

  console.log("🧪 Testing OpenGraph Image Fetching\n");

  // Test URLs for different types of events
  const testUrls = [
    "https://www.coachella.com",
    "https://www.lollapalooza.com",
    "https://www.glastonburyfestivals.co.uk",
    "https://www.wimbledon.com",
    "https://www.metmuseum.org",
  ];

  for (const url of testUrls) {
    console.log(`\n📍 Testing: ${url}`);
    console.log("─".repeat(60));

    try {
      const startTime = Date.now();
      const images = await fetchEventImages(url);
      const duration = Date.now() - startTime;

      if (images.length > 0) {
        console.log(`✅ Found ${images.length} image(s) in ${duration}ms:`);
        images.forEach((img, idx) => {
          console.log(`   ${idx + 1}. ${img}`);
        });
      } else {
        console.log(`⚠️  No images found (${duration}ms)`);
      }
    } catch (error) {
      console.log(`❌ Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("✅ Test complete!");
}

testOpenGraph();
