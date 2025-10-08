// Quick test script to call the generate-bundles API
const testPreferences = {
  interests: ["concerts", "sports", "art"],
  musicProfile: "I like indie rock and electronic music",
  timeframe: "next 3 months",
  otherPreferences: "I prefer smaller venues"
};

async function testAPI() {
  console.log('Testing API...');

  const response = await fetch('http://localhost:3000/api/generate-bundles', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(testPreferences)
  });

  console.log('Response status:', response.status);
  console.log('Response headers:', Object.fromEntries(response.headers.entries()));

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  let reasoningSummaries = [];
  let completed = false;
  let bundles = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      console.log('\n=== Stream ended ===');
      break;
    }

    const chunk = decoder.decode(value);
    const lines = chunk.split('\n');

    for (const line of lines) {
      if (line.startsWith('event: ')) {
        const eventType = line.substring(7);
        const dataLine = lines[lines.indexOf(line) + 1];

        if (dataLine && dataLine.startsWith('data: ')) {
          const data = JSON.parse(dataLine.substring(6));

          if (eventType === 'reasoning_summary') {
            reasoningSummaries.push(data.text);
            console.log(`[REASONING ${reasoningSummaries.length}]:`, data.text.substring(0, 80) + '...');
          } else if (eventType === 'completed') {
            completed = true;
            bundles = data.bundles;
            console.log('\n=== COMPLETED ===');
            console.log('Bundles received:', bundles.bundles?.length || 'none');
            if (bundles.bundles) {
              bundles.bundles.forEach((bundle, i) => {
                console.log(`Bundle ${i + 1}: ${bundle.city} - ${bundle.title}`);
              });
            }
          } else if (eventType === 'error') {
            console.error('ERROR:', data.message);
          }
        }
      }
    }
  }

  console.log('\n=== Summary ===');
  console.log('Reasoning summaries:', reasoningSummaries.length);
  console.log('Completed:', completed);
  console.log('Bundles:', bundles ? 'YES' : 'NO');
}

testAPI().catch(console.error);
