const apiKey = "key_41118a42984eb4d2fc69ce9a32d21f1fced4d05605e752a9409caeb2db4943269af7ef3afccd00f0afda4dd7bef6669a3fc3d9f4c8cf222df8971bf04fbe0b8d";

async function testRunway() {
  console.log("Testing Runway API...");
  try {
    const createRes = await fetch('https://api.dev.runwayml.com/v1/image_to_video', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'X-Runway-Version': '2024-11-06',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        promptImage: `https://picsum.photos/seed/123/1280/768`, 
        promptText: "A beautiful cinematic shot of a forest",
        model: 'gen3a_turbo',
        duration: 5,
        ratio: "1280:768"
      })
    });

    const text = await createRes.text();
    console.log("Response:", createRes.status, text);
  } catch (e) {
    console.error("Fetch error:", e);
  }
}

testRunway();
