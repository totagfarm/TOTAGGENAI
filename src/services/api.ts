export interface ElevenLabsVoice {
  voice_id: string;
  name: string;
  category: string;
  preview_url?: string;
}

export async function getElevenLabsVoices(): Promise<ElevenLabsVoice[]> {
  const apiKey = import.meta.env.VITE_ELEVENLABS_API_KEY;
  if (!apiKey) return [];

  try {
    const response = await fetch('https://api.elevenlabs.io/v1/voices', {
      headers: {
        'xi-api-key': apiKey,
        'Accept': 'application/json'
      }
    });
    if (!response.ok) throw new Error('Failed to fetch voices');
    const data = await response.json();
    return data.voices || [];
  } catch (error) {
    console.error("Failed to load ElevenLabs voices:", error);
    return [];
  }
}

export async function cloneUserVoice(name: string, description: string, audioBlob: Blob): Promise<string> {
  const apiKey = import.meta.env.VITE_ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error("API Key missing");

  const formData = new FormData();
  formData.append('name', name);
  formData.append('description', description);
  formData.append('files', audioBlob, 'sample.wav'); // File name is required

  const response = await fetch('https://api.elevenlabs.io/v1/voices/add', {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      // Do NOT set Content-Type header manually when using FormData, 
      // the browser will set it automatically with the correct boundary
      'Accept': 'application/json'
    },
    body: formData
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Voice cloning failed: ${response.statusText} - ${errorBody}`);
  }

  const data = await response.json();
  return data.voice_id;
}

export async function generateElevenLabsVoice(text: string, voiceId: string): Promise<string> {
  const apiKey = import.meta.env.VITE_ELEVENLABS_API_KEY;
  if (!apiKey) {
    console.warn("No VITE_ELEVENLABS_API_KEY found, using mock audio.");
    return 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3'; // Fallback mock
  }

  try {
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_monolingual_v1",
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.5
        }
      })
    });

    if (!response.ok) {
      throw new Error(`ElevenLabs API error: ${response.statusText}`);
    }

    const blob = await response.blob();
    return URL.createObjectURL(blob);
  } catch (error) {
    console.error("ElevenLabs generation failed:", error);
    throw error;
  }
}

export async function generateRunwayVideo(prompt: string, aspectRatio: string = "16:9", imageUrl?: string, duration: number = 5): Promise<string> {
  const ratio = aspectRatio === '9:16' ? '768:1280' : '1280:768';
  
  try {
    console.log("Calling Server Proxy for Runway generation...");
    const response = await fetch('/api/generate-video', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, ratio, imageUrl, duration })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ message: "Unknown error" }));
      throw new Error(err.message || err.error || `Proxy Error: ${response.status}`);
    }

    const data = await response.json();
    return data.url;

  } catch (error) {
    console.error("Runway Proxy failed:", error);
    alert("Runway Generation Failed: " + (error instanceof Error ? error.message : String(error)));
    return 'https://www.w3schools.com/html/mov_bbb.mp4';
  }
}
