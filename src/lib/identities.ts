export interface AvatarIdentity {
  name: string;
  description: string;
  voiceId?: string;
}

export interface VideoStylePreset {
  name: string;
  keywords: string;
}

export const AVATAR_IDENTITIES: Record<string, AvatarIdentity> = {
  'Jessica': {
    name: 'Jessica',
    description: 'A professional 30-year-old female tech presenter, sharp facial features, minimalist business attire, speaking directly to camera, modern office background, shallow depth of field.',
    voiceId: 'cgSgSqi655KNBp9YR8io' // Sample ElevenLabs voice
  },
  'Marcus': {
    name: 'Marcus',
    description: 'A friendly 25-year-old male entrepreneur, energetic gestures, casual professional look, bright studio lighting, vibrant background, high energy.',
    voiceId: 'pNInz6obpg8ndclQU7Nc'
  },
  'Elena': {
    name: 'Elena',
    description: 'A sophisticated mature female narrator, elegant poise, softly lit library background, warm tones, slow-motion gestures.',
    voiceId: 'EXAVITQu4vr4xnSDxMaL'
  },
  'Deep Narrator': {
    name: 'Deep Narrator',
    description: 'Cinematic silhouette of a male figure, dramatic rim lighting, mysterious tech environment, volumetric fog, blue and orange color grade.',
    voiceId: 'vr6299fZ8E0vj1a7oU1x'
  }
};

export const VIDEO_STYLE_PRESETS: Record<string, VideoStylePreset> = {
  'Dynamic': {
    name: 'Dynamic',
    keywords: 'Fast-paced cuts, energetic camera movement, motion blur, high contrast, 4k, cinematic action.'
  },
  'Minimalist': {
    name: 'Minimalist',
    keywords: 'Clean flat colors, centered composition, soft shadows, airy atmosphere, Apple-style product aesthetic, 8k.'
  },
  'Neon': {
    name: 'Neon',
    keywords: 'Cyberpunk aesthetic, vibrant neon lights, dark moody shadows, volumetric lighting, futuristic tech vibe.'
  },
  'Cinematic': {
    name: 'Cinematic',
    keywords: 'Film grain, anamorphic lens flares, warm color grading, shallow depth of field, f/1.8 aperture, professional color correction.'
  }
};
