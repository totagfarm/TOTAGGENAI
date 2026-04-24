import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { Storage } from '@google-cloud/storage';
import crypto from 'crypto';

const storage = new Storage();
const bucketName = 'totag-assets-public-018a';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
const port = process.env.PORT || 8080;

// Runway Proxy Endpoint
app.post('/api/generate-video', async (req, res) => {
  const { prompt, ratio, imageUrl, duration } = req.body;
  const apiKey = process.env.RUNWAYML_API_SECRET;

  if (!apiKey) {
    return res.status(500).json({ error: "Server misconfigured: RUNWAYML_API_SECRET missing" });
  }

  try {
    let finalImageUrl = imageUrl || `https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=1280&h=768&q=80`;

    // If it's a data URI, upload to GCS first
    if (imageUrl && imageUrl.startsWith('data:')) {
      console.log("Detected Data URI. Uploading to GCS...");
      const base64Data = imageUrl.split(',')[1];
      const mimeType = imageUrl.split(';')[0].split(':')[1];
      const extension = mimeType.split('/')[1] || 'jpg';
      const fileName = `avatars/${crypto.randomBytes(8).toString('hex')}.${extension}`;
      
      const bucket = storage.bucket(bucketName);
      const file = bucket.file(fileName);
      
      await file.save(Buffer.from(base64Data, 'base64'), {
        metadata: { contentType: mimeType }
      });
      
      finalImageUrl = `https://storage.googleapis.com/${bucketName}/${fileName}`;
      console.log("Hosted at:", finalImageUrl);
    }

    const sanitizedPrompt = prompt.replace(/\s+/g, ' ').trim();
    const body = {
      promptImage: finalImageUrl,
      promptText: sanitizedPrompt,
      model: 'gen3a_turbo',
      duration: Math.min(Number(duration) || 5, 10),
      ratio: ratio
    };

    console.log("Payload Size (JSON):", JSON.stringify(body).length);
    console.log("Image URL starts with:", finalImageUrl ? finalImageUrl.substring(0, 50) + "..." : "Default URL");
    console.log("Sanitized Prompt:", sanitizedPrompt);


    // 1. Create the task
    const createRes = await fetch('https://api.runwayml.com/v1/image_to_video', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'X-Runway-Version': '2024-11-06',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    const taskData = await createRes.json();
    if (!createRes.ok) {
      console.error("Runway API Rejection:", JSON.stringify(taskData, null, 2));
      return res.status(createRes.status).json(taskData);
    }

    const taskId = taskData.id;

    // 2. Poll for completion (Server-side polling)
    let attempts = 0;
    while (attempts < 60) { // Max 5 minutes
      await new Promise(r => setTimeout(r, 5000));
      const pollRes = await fetch(`https://api.runwayml.com/v1/tasks/${taskId}`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'X-Runway-Version': '2024-11-06'
        }
      });
      const pollData = await pollRes.json();
      
      if (pollData.status === 'SUCCEEDED') {
        return res.json({ url: pollData.output[0] });
      }
      if (pollData.status === 'FAILED') {
        return res.status(500).json({ error: "Runway task failed", details: pollData });
      }
      attempts++;
    }
    res.status(408).json({ error: "Runway generation timed out" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Serve static files from the React app build directory
app.use(express.static(path.join(__dirname, 'dist')));

// The "catchall" handler: for any request that doesn't
// match one above, send back React's index.html file.
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
