import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, 
  Video, 
  Image as ImageIcon, 
  Mic, 
  Type, 
  Calendar, 
  ArrowRight, 
  Clock, 
  Layout, 
  Share2, 
  Download,
  Play,
  CheckCircle2,
  Cpu,
  RefreshCcw,
  Plus,
  LogOut,
  LogIn,
  Maximize,
  Music,
  Palette,
  Volume2,
  UserCircle,
  Zap,
  Gauge,
  Timer,
  Upload,
  ChevronRight,
  X,
  Square
} from 'lucide-react';
import { auth, db, getGemini, getUserClonedVoices, saveClonedVoice } from './lib/firebase';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut,
  User as FirebaseUser
} from 'firebase/auth';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  serverTimestamp, 
  doc, 
  updateDoc, 
  deleteDoc,
  getDocFromServer,
  orderBy
} from 'firebase/firestore';
import { generateElevenLabsVoice, generateRunwayVideo, getElevenLabsVoices, cloneUserVoice } from './services/api';
import { AVATAR_IDENTITIES, VIDEO_STYLE_PRESETS } from './lib/identities';

// Types
type InputMode = 'text' | 'image' | 'video' | 'voice';
type AppView = 'studio' | 'templates' | 'calendar' | 'assets' | 'pricing' | 'library' | 'dashboard';

interface ContentItem {
  id: string;
  type: 'video' | 'image';
  title: string;
  thumbnail: string;
  date: string; // Used for "Day X" display
  scheduledDate?: any; // Timestamp
  platform: 'TikTok' | 'Instagram' | 'YouTube' | 'Facebook';
  userId: string;
  videoUrl?: string;
  audioUrl?: string;
  script?: string;
  visualPrompt?: string;
  musicStyle?: string;
  status?: 'draft' | 'rendering' | 'ready';
}

interface Asset {
  id: string;
  name: string;
  type: 'logo' | 'palette' | 'font';
  value: string;
  userId: string;
}

interface Template {
  id: string;
  name: string;
  category: 'Intro' | 'Transition' | 'Outro' | 'Style';
  thumbnail: string;
  previewColor: string;
}

interface Testimonial {
  id: string;
  name: string;
  role: string;
  avatar: string;
  quote: string;
}

const testimonials: Testimonial[] = [
  {
    id: '1',
    name: 'Sarah Jenkins',
    role: 'Content Creator',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah',
    quote: "TOTAGGENAI turned my chaotic notes into a polished content strategy in minutes. I've never been this consistent!"
  },
  {
    id: '2',
    name: 'Marcus Chen',
    role: 'Digital Marketer',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Marcus',
    quote: "The batch generation feature is a game changer. What used to take a week now takes an afternoon."
  },
  {
    id: '3',
    name: 'Elena Rodriguez',
    role: 'YouTube Shorts Specialist',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Elena',
    quote: "The template library fits my branding perfectly. My engagement has doubled since I started using it."
  }
];

const templates: Template[] = [
  { id: '1', name: 'Cinematic Minimal', category: 'Style', thumbnail: 'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=400&q=80', previewColor: 'bg-forest' },
  { id: '2', name: 'Dynamic Glitch', category: 'Transition', thumbnail: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=400&q=80', previewColor: 'bg-sky' },
  { id: '3', name: 'Bold Typography', category: 'Intro', thumbnail: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=400&q=80', previewColor: 'bg-gold' },
  { id: '4', name: 'Smooth Fade Out', category: 'Outro', thumbnail: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=400&q=80', previewColor: 'bg-sky-dark' },
  { id: '5', name: 'Vintage Film', category: 'Style', thumbnail: 'https://images.unsplash.com/photo-1485846234645-a6a243cb31f0?w=400&q=80', previewColor: 'bg-gold-dark' },
  { id: '6', name: 'Neon Pulse', category: 'Style', thumbnail: 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=400&q=80', previewColor: 'bg-sky' },
];

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [currentView, setCurrentView] = useState<AppView>('dashboard');
  const [activeMode, setActiveMode] = useState<InputMode>('text');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [progress, setProgress] = useState(0);
  const [selectedLayout, setSelectedLayout] = useState<'grid' | 'calendar'>('grid');
  const [sparkInput, setSparkInput] = useState('');
  
  // Production Config
  const [productionConfig, setProductionConfig] = useState({
    aspectRatio: '9:16',
    musicStyle: 'Cinematic',
    videoStyle: 'Dynamic',
    voice: 'Deep Narrator',
    voiceId: '',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix',
    pacing: 'Balanced',
    duration: '60s'
  });

  // Firestore data
  const [generatedContent, setGeneratedContent] = useState<ContentItem[]>([]);
  const [userAssets, setUserAssets] = useState<Asset[]>([]);

  useEffect(() => {
    // Safety timeout to prevent infinite "Initializing" state
    const timeout = setTimeout(() => {
      setAuthReady(true);
    }, 4500);

    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthReady(true);
      if (u) {
        testConnection();
      }
      clearTimeout(timeout);
    });
    return () => {
      unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  async function testConnection() {
    try {
      await getDocFromServer(doc(db, 'test', 'connection'));
    } catch (error) {
      if (error instanceof Error && error.message.includes('the client is offline')) {
        console.error("Please check your Firebase configuration.");
      }
    }
  }

  // Subscribe to content
  useEffect(() => {
    if (!user) {
      setGeneratedContent([]);
      return;
    }
    const q = query(
      collection(db, 'content'), 
      where('userId', '==', user.uid)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ContentItem));
      
      // Sort in memory to avoid needing a Firestore composite index
      items.sort((a: any, b: any) => {
        const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return timeB - timeA;
      });

      console.log("Fetched content count:", items.length);
      setGeneratedContent(items);
    }, (error) => {
      console.error("Firestore Error in onSnapshot:", error);
    });
    return () => unsubscribe();
  }, [user]);

  // Subscribe to assets
  useEffect(() => {
    if (!user) {
      setUserAssets([]);
      return;
    }
    const q = query(collection(db, 'assets'), where('userId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Asset));
      setUserAssets(items);
    });
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (isProcessing) {
      // Simulation for the first 90%
      const interval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 90) {
            clearInterval(interval);
            return 90;
          }
          return prev + 1;
        });
      }, 30);
      return () => clearInterval(interval);
    } else {
      setProgress(0);
    }
  }, [isProcessing]);

  if (!authReady) {
    return (
      <div style={{ backgroundColor: '#0B2E1E', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontFamily: 'sans-serif' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ 
            width: '40px', 
            height: '40px', 
            border: '4px solid rgba(135,206,235,0.2)', 
            borderTop: '4px solid #87CEEB', 
            borderRadius: '50%', 
            animation: 'loader-spin 1s linear infinite', 
            marginBottom: '20px', 
            marginLeft: 'auto', 
            marginRight: 'auto' 
          }} />
          <style>{`@keyframes loader-spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
          <h1 style={{ fontSize: '24px', letterSpacing: '0.1em', fontWeight: 'bold' }}>TOTAGGENAI</h1>
          <p style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.2em', color: '#87CEEB' }}>Initializing Content Engine...</p>
        </div>
      </div>
    );
  }

  const handleSignIn = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      console.error("Auth Error:", error);
      alert(`Authentication failed: ${error.message}\n\nIf you see 'unauthorized domain', you need to add this URL to your Firebase Authorized Domains.`);
    }
  };

  const handleSignOut = () => signOut(auth);

  const handleGenerate = async () => {
    if (!user) {
      handleSignIn();
      return;
    }

    if (!sparkInput.trim()) {
      alert("Please enter a content spark (text, voice, or image) to generate your batch!");
      return;
    }
    
    setIsProcessing(true);
    setProgress(0);
    setShowResults(false);

    try {
      // Ensure the processing screen is visible for at least 2 seconds for UX
      const minProcessingTime = new Promise(resolve => setTimeout(resolve, 2500));
      const generationTask = persistGeneratedContent();
      
      await Promise.all([minProcessingTime, generationTask]);
      
      // Once persisted and min time passed, wrap up
      setProgress(100);
      setTimeout(() => {
        setIsProcessing(false);
        setShowResults(true);
      }, 800);
    } catch (error) {
      console.error("Batch generation failed:", error);
      setIsProcessing(false);
    }
  };

  const persistGeneratedContent = async () => {
    if (!user) return;
    
    let batchItems = [
      { type: 'video', title: 'Day 1: Behind the Scenes', thumbnail: 'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=400&q=80', date: 'Oct 1', platform: 'Instagram' },
      { type: 'image', title: 'Day 3: Motivational Quote', thumbnail: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=400&q=80', date: 'Oct 3', platform: 'TikTok' },
      { type: 'video', title: 'Day 5: Product Deep Dive', thumbnail: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=400&q=80', date: 'Oct 5', platform: 'YouTube' },
    ];

    try {
      if (!genAI) throw new Error("Gemini API Key missing");
      if (!sparkInput.trim()) throw new Error("Spark input empty");

      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
      const prompt = `You are a social media strategist for an AI content generation tool TOTAGGENAI. 
      Given the following brainstorming session/idea: "${sparkInput}", 
      and the following production settings:
      - Aspect Ratio: ${productionConfig.aspectRatio}
      - Music: ${productionConfig.musicStyle}
      - Video Style: ${productionConfig.videoStyle}
      - Voice: ${productionConfig.voice}
      - Pacing: ${productionConfig.pacing}
      - Duration: ${productionConfig.duration}
      
      Generate a content plan for 1 month (approx 6-8 items).
      Return purely a JSON array of objects with the following structure:
      {"type": "video" | "image", "title": "short catchy title", "date": "Day X", "platform": "TikTok" | "Instagram" | "YouTube" | "Facebook", "script": "AI script for the video/image", "visualPrompt": "detailed visual description for generation"}
      Do not include any other text or markdown formatting.`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      const cleanedText = text.replace(/```json/g, '').replace(/```/g, '').trim();
      const aiBatch = JSON.parse(cleanedText);
      
      if (Array.isArray(aiBatch)) {
        batchItems = await Promise.all(aiBatch.map(async (item, idx) => {
          let videoUrl = item.type === 'video' ? 'https://www.w3schools.com/html/mov_bbb.mp4' : undefined;
          let audioUrl = undefined;
          
          try {
            if (item.type === 'video') {
              // Build the "Master Prompt" for Runway
              const avatarIdentity = AVATAR_IDENTITIES[productionConfig.voice] || AVATAR_IDENTITIES['Jessica'];
              const stylePreset = VIDEO_STYLE_PRESETS[productionConfig.videoStyle] || VIDEO_STYLE_PRESETS['Cinematic'];
              
              const masterPrompt = `
                IDENTITY: ${avatarIdentity.description}
                ACTION: Speaking directly to camera, professional presenter style, high-fidelity synchronized lip movements, phonetic accuracy, ${item.visualPrompt || item.script || item.title}
                STYLE: ${stylePreset.keywords}
                ENFORCEMENT: MAINTAIN EXACT LIKENESS. The person must look 100% identical to the provided image. Do not alter facial features.
              `.trim();

              const durationNum = parseInt(productionConfig.duration.replace(/[^0-9]/g, '')) || 5;
              console.log("Generating with Master Prompt, Avatar Sync, and Duration:", masterPrompt, productionConfig.avatar, durationNum);
              videoUrl = await generateRunwayVideo(masterPrompt, productionConfig.aspectRatio, productionConfig.avatar, durationNum);
            }
            if (item.script) {
              audioUrl = await generateElevenLabsVoice(item.script, productionConfig.voiceId || productionConfig.voice);
            }
          } catch (apiError) {
            console.warn("API Error during batch generation mapping:", apiError);
          }

          let scheduledDateStr = new Date().toISOString();
          if (item.date && item.date.toLowerCase().includes('day')) {
            const dayOffset = parseInt(item.date.replace(/[^0-9]/g, '')) || 1;
            const dateObj = new Date();
            dateObj.setDate(dateObj.getDate() + dayOffset - 1);
            scheduledDateStr = dateObj.toISOString();
          }

          return {
            ...item,
            status: 'ready',
            scheduledDate: scheduledDateStr,
            thumbnail: `https://picsum.photos/seed/${encodeURIComponent(item.title + Math.random())}/800/450`,
            videoUrl: videoUrl || null,
            audioUrl: audioUrl || null,
            musicStyle: productionConfig.musicStyle
          };
        }));
      }
    } catch (e) {
      console.error("Primary generation failed, using fallback:", e);
      const mockBatch = [
        { 
          type: 'video', 
          title: `Insight: ${sparkInput.substring(0, 20)}...`, 
          date: 'Day 1', 
          platform: 'TikTok',
          script: "Opening scene: Dynamic zoom on product. Text overlay 'Revolutionary AI'. Cut to lifestyle shot showing ease of use.",
          visualPrompt: "Neon-lit workspace, shallow depth of field, 4k cinematic lighting"
        },
        { 
          type: 'image', 
          title: `Gallery: ${productionConfig.videoStyle} Style`, 
          date: 'Day 4', 
          platform: 'Instagram',
          script: "Hero image showing the transformation. Carousel post detailing the 3 key benefits of the AI spark.",
          visualPrompt: "Minimalist flat design, vibrant energy colors"
        },
        { 
          type: 'video', 
          title: `Deep Dive: ${productionConfig.voice} Narration`, 
          date: 'Day 7', 
          platform: 'YouTube',
          script: "Detailed walkthrough of the generation engine. Narration focuses on time-saving and creative freedom.",
          visualPrompt: "Macro tech shots, floating UI elements, smooth transitions"
        },
      ];

      batchItems = await Promise.all(mockBatch.map(async (item, i) => {
        let videoUrl = item.type === 'video' ? 'https://www.w3schools.com/html/mov_bbb.mp4' : null;
        let audioUrl = null;
        try {
          if (item.type === 'video') {
            const avatarIdentity = AVATAR_IDENTITIES[productionConfig.voice] || AVATAR_IDENTITIES['Jessica'];
            const stylePreset = VIDEO_STYLE_PRESETS[productionConfig.videoStyle] || VIDEO_STYLE_PRESETS['Cinematic'];
            
            const masterPrompt = `
              IDENTITY: ${avatarIdentity.description}
              ACTION: Speaking directly to camera, professional presenter style, high-fidelity synchronized lip movements, phonetic accuracy, ${item.visualPrompt || item.script || item.title}
              STYLE: ${stylePreset.keywords}
              ENFORCEMENT: MAINTAIN EXACT LIKENESS. The person must look 100% identical to the provided image. Do not alter facial features.
            `.trim();

            const durationNum = parseInt(productionConfig.duration.replace(/[^0-9]/g, '')) || 5;
            console.log("Generating Fallback with Master Prompt, Avatar Sync, and Duration:", masterPrompt, productionConfig.avatar, durationNum);
            videoUrl = await generateRunwayVideo(masterPrompt, productionConfig.aspectRatio, productionConfig.avatar, durationNum);
          }
          if (item.script) {
            audioUrl = await generateElevenLabsVoice(item.script, productionConfig.voiceId || productionConfig.voice);
          }
        } catch (err) {
          console.error("Fallback APIs failed:", err);
        }

        const d = new Date();
        d.setDate(d.getDate() + (i * 3));
        return {
          ...item,
          status: 'ready',
          scheduledDate: d.toISOString(),
          thumbnail: `https://picsum.photos/seed/${encodeURIComponent(item.title + Math.random())}/800/450`,
          videoUrl: videoUrl || null,
          audioUrl: audioUrl || null,
          musicStyle: productionConfig.musicStyle
        };
      }));
    }

    try {
      console.log("Saving batch items to Firestore...");
      for (const item of batchItems) {
        await addDoc(collection(db, 'content'), {
          ...item,
          userId: user.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
      console.log("Successfully saved all batch items.");
    } catch (e) {
      console.error("Persistence error:", e);
      alert("Failed to save content items: " + (e instanceof Error ? e.message : String(e)));
      throw e;
    }
  };

  return (
    <div className="min-h-screen bg-forest text-white flex flex-col">
      {/* Navigation */}
      <nav className="sticky top-0 w-full z-50 glass border-b border-white/10 h-16 shrink-0">
        <div className="max-w-7xl mx-auto px-4 h-full flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setCurrentView('dashboard')}>
            <div className="w-10 h-10 sky-bg rounded-xl flex items-center justify-center shadow-lg shadow-sky/20">
              <Sparkles className="text-white w-6 h-6" />
            </div>
            <span className="font-display font-bold text-xl tracking-tight">TOTAGGEN<span className="text-gold">AI</span></span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium opacity-70">
            <button 
              onClick={() => {
                setCurrentView('dashboard');
                setShowResults(false);
              }}
              className={`hover:opacity-100 transition-opacity ${currentView === 'dashboard' && !showResults ? 'opacity-100 text-gold font-bold underline underline-offset-4' : ''}`}
            >
              The Studio
            </button>
            <button 
              onClick={() => {
                setCurrentView('dashboard');
                setShowResults(true);
              }}
              className={`hover:opacity-100 transition-opacity ${currentView === 'dashboard' && showResults ? 'opacity-100 text-gold font-bold underline underline-offset-4' : ''}`}
            >
              My Library
            </button>
            <button 
              onClick={() => setCurrentView('templates')}
              className={`hover:opacity-100 transition-opacity ${currentView === 'templates' ? 'opacity-100 text-gold font-bold underline underline-offset-4' : ''}`}
            >
              Templates
            </button>
            <button 
              onClick={() => setCurrentView('assets')}
              className={`hover:opacity-100 transition-opacity ${currentView === 'assets' ? 'opacity-100 text-gold font-bold underline underline-offset-4' : ''}`}
            >
              Asset Library
            </button>
            <button 
              onClick={() => setCurrentView('pricing')}
              className={`hover:opacity-100 transition-opacity ${currentView === 'pricing' ? 'opacity-100 text-gold font-bold underline underline-offset-4' : ''}`}
            >
              Pricing
            </button>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setCurrentView('pricing')}
              className="text-xs font-bold uppercase tracking-widest px-4 py-2 border border-gold text-gold rounded-lg hover:bg-gold hover:text-black transition-all"
            >
              Go Pro
            </button>
            {user ? (
              <div className="flex items-center gap-3">
                <button 
                  onClick={handleSignOut}
                  className="p-2 rounded-xl glass hover:bg-white/10 transition-colors"
                  title="Sign Out"
                >
                  <LogOut className="w-4 h-4 text-white/60" />
                </button>
                <div className="w-8 h-8 rounded-full border border-sky/30 sky-bg overflow-hidden ring-2 ring-sky/20">
                   <img src={user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`} alt="User" />
                </div>
              </div>
            ) : (
              <button 
                onClick={handleSignIn}
                className="flex items-center gap-2 px-4 py-2 bg-white text-black rounded-lg text-xs font-bold hover:bg-white/90 transition-all"
              >
                <LogIn className="w-4 h-4" />
                Sign In
              </button>
            )}
          </div>
        </div>
      </nav>

      <main className="flex-1 py-10 px-4 max-w-7xl mx-auto w-full">
        {currentView === 'dashboard' ? (
          <DashboardView 
            user={user}
            activeMode={activeMode}
            setActiveMode={setActiveMode}
            isProcessing={isProcessing}
            showResults={showResults}
            progress={progress}
            handleGenerate={handleGenerate}
            generatedContent={generatedContent}
            selectedLayout={selectedLayout}
            setSelectedLayout={setSelectedLayout}
            setShowResults={setShowResults}
            sparkInput={sparkInput}
            setSparkInput={setSparkInput}
            productionConfig={productionConfig}
            setProductionConfig={setProductionConfig}
          />
        ) : currentView === 'templates' ? (
          <TemplatesView templates={templates} onBack={() => setCurrentView('dashboard')} />
        ) : currentView === 'assets' ? (
          <AssetsView userAssets={userAssets} onBack={() => setCurrentView('dashboard')} />
        ) : (
          <PricingView onBack={() => setCurrentView('dashboard')} />
        )}

        {/* Testimonials Section */}
        <section className="mt-40 mb-20">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-light text-white mb-4">Trusted by <span className="text-gold italic font-medium">Top Tier</span> Creators</h2>
            <p className="text-white/40 max-w-xl mx-auto">See how TOTAGGENAI is streamlining content engines globally.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {testimonials.map((t) => (
              <div key={t.id} className="glass p-8 rounded-[2rem] border-white/5 hover:bg-white/5 transition-all">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 rounded-full border border-white/10 overflow-hidden bg-white/5">
                    <img src={t.avatar} alt={t.name} />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm">{t.name}</h4>
                    <p className="text-[10px] uppercase tracking-widest opacity-40">{t.role}</p>
                  </div>
                </div>
                <p className="text-sm italic opacity-60 leading-relaxed">"{t.quote}"</p>
                <div className="mt-6 flex gap-1">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Sparkles key={s} className="w-3 h-3 text-gold" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Features Sidebar / Bottom */}
        <div className="mt-32 grid grid-cols-1 md:grid-cols-3 gap-12 border-t border-white/5 pt-20">
          <Feature 
            icon={<Video className="text-white" />} 
            title="Auto-Visual Scripts" 
            desc="AI generates scene-by-scene visual descriptions and overlays for every script." 
          />
          <Feature 
            icon={<Share2 className="text-white" />} 
            title="Multi-Platform Sync" 
            desc="One click to adapt captions, hashtags, and formats for TikTok, IG, and YouTube." 
          />
          <Feature 
            icon={<Sparkles className="text-white" />} 
            title="AI Voice Synthesis" 
            desc="Choose from 50+ hyper-realistic creator voices to narrate your month of content." 
          />
        </div>
      </main>

      {/* Simplified Footer */}
      <footer className="border-t border-white/5 py-12 bg-forest/80 backdrop-blur-xl mt-20">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-8 text-[10px] font-bold uppercase tracking-widest text-white/30">
          <div className="flex items-center gap-2 text-white opacity-100">
            <Sparkles className="text-gold w-5 h-5" />
            <span className="font-display font-medium text-xs tracking-tight">TOTAGGEN<span className="text-gold">AI</span></span>
          </div>
          <div className="flex gap-8">
            <button onClick={() => { setCurrentView('dashboard'); setShowResults(false); }} className="hover:text-white transition-colors uppercase">Studio</button>
            <button onClick={() => { setCurrentView('dashboard'); setShowResults(true); }} className="hover:text-white transition-colors uppercase">Library</button>
            <button onClick={() => setCurrentView('templates')} className="hover:text-white transition-colors uppercase">Templates</button>
            <button onClick={() => setCurrentView('assets')} className="hover:text-white transition-colors uppercase">Assets</button>
          </div>
          <p>© 2024 TOTAGGENAI • Studio Mode</p>
        </div>
      </footer>
    </div>
  );
}

// Sub-components

function DashboardView({ 
  activeMode, 
  setActiveMode, 
  isProcessing, 
  showResults, 
  progress, 
  handleGenerate, 
  generatedContent,
  selectedLayout,
  setSelectedLayout,
  setShowResults,
  sparkInput,
  setSparkInput,
  productionConfig,
  setProductionConfig,
  user
}: any) {
  const [isRecording, setIsRecording] = useState(false);
  const [recognition, setRecognition] = useState<any>(null);
  const musicAudioRef = useRef<HTMLAudioElement | null>(null);
  const voiceAudioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlayingMusic, setIsPlayingMusic] = useState(false);
  const [isPlayingVoice, setIsPlayingVoice] = useState(false);

  const [platformVoices, setPlatformVoices] = useState<any[]>([]);
  const [clonedVoices, setClonedVoices] = useState<any[]>([]);
  const [isCloningModalOpen, setIsCloningModalOpen] = useState(false);
  const [cloneVoiceName, setCloneVoiceName] = useState("");
  const [cloneVoiceDescription, setCloneVoiceDescription] = useState("");
  const [cloneVoiceFile, setCloneVoiceFile] = useState<File | null>(null);
  const [isCloning, setIsCloning] = useState(false);
  const [cloningError, setCloningError] = useState("");

  useEffect(() => {
    const loadVoices = async () => {
      try {
        const pVoices = await getElevenLabsVoices();
        setPlatformVoices(pVoices);
        
        if (user) {
          const cVoices = await getUserClonedVoices(user.uid);
          setClonedVoices(cVoices);
        }
        
        // Select the first platform voice by default if none selected
        if (!productionConfig.voiceId && pVoices.length > 0) {
          setProductionConfig((prev: any) => ({
            ...prev,
            voiceId: pVoices[0].voice_id,
            voice: pVoices[0].name
          }));
        }
      } catch (e) {
        console.error("Failed to load voices", e);
      }
    };
    loadVoices();
  }, [user]);

  const updateConfig = (key: string, value: any) => {
    setProductionConfig((prev: any) => ({ ...prev, [key]: value }));
  };

  const handleCloneVoice = async () => {
    if (!cloneVoiceName || !cloneVoiceFile || !user) return;
    setIsCloning(true);
    setCloningError("");
    try {
      // 1. Upload to ElevenLabs
      const newVoiceId = await cloneUserVoice(cloneVoiceName, cloneVoiceDescription || "Cloned user voice", cloneVoiceFile);
      // 2. Save to Firebase
      await saveClonedVoice(user.uid, newVoiceId, cloneVoiceName);
      
      // 3. Update state
      const updatedClonedVoices = await getUserClonedVoices(user.uid);
      setClonedVoices(updatedClonedVoices);
      
      // 4. Auto-select
      setProductionConfig((prev: any) => ({
        ...prev,
        voiceId: newVoiceId,
        voice: cloneVoiceName
      }));
      
      setIsCloningModalOpen(false);
      setCloneVoiceName("");
      setCloneVoiceDescription("");
      setCloneVoiceFile(null);
    } catch (e: any) {
      setCloningError(e.message || "Failed to clone voice");
    } finally {
      setIsCloning(false);
    }
  };

  const previewVoice = async () => {
    if (isPlayingVoice) {
      voiceAudioRef.current?.pause();
      setIsPlayingVoice(false);
      return;
    }
    
    setIsPlayingVoice(true);
    try {
      const audioUrl = await generateElevenLabsVoice(
        `Hello, this is a preview of the ${productionConfig.voice} voice.`,
        productionConfig.voiceId || productionConfig.voice
      );
      
      if (!voiceAudioRef.current) {
        voiceAudioRef.current = new Audio(audioUrl);
      } else {
        voiceAudioRef.current.src = audioUrl;
      }
      
      voiceAudioRef.current.play();
      voiceAudioRef.current.onended = () => {
        setIsPlayingVoice(false);
      };
    } catch (e) {
      console.error("Voice preview failed", e);
      setIsPlayingVoice(false);
    }
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        updateConfig('avatar', reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const previewMusic = () => {
    if (isPlayingMusic) {
      musicAudioRef.current?.pause();
      setIsPlayingMusic(false);
      return;
    }

    const musicUrls: Record<string, string> = {
      'Cinematic': 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
      'Lo-Fi': 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3',
      'High Energy': 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
      'Corporate': 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
      'Acoustic': 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3'
    };

    const url = musicUrls[productionConfig.musicStyle];
    if (url) {
      if (!musicAudioRef.current) {
        musicAudioRef.current = new Audio(url);
      } else {
        musicAudioRef.current.src = url;
      }
      
      musicAudioRef.current.play();
      setIsPlayingMusic(true);
      
      musicAudioRef.current.onended = () => {
        setIsPlayingMusic(false);
      };
    }
  };

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recog = new SpeechRecognition();
      recog.continuous = true;
      recog.interimResults = true;
      recog.lang = 'en-US';

      recog.onresult = (event: any) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            transcript += event.results[i][0].transcript;
          }
        }
        if (transcript) {
          setSparkInput((prev: string) => prev + (prev.endsWith(' ') || prev === '' ? '' : ' ') + transcript);
        }
      };

      recog.onerror = (event: any) => {
        console.error('Speech recognition error', event.error);
        setIsRecording(false);
      };

      recog.onend = () => {
        setIsRecording(false);
      };

      setRecognition(recog);
    }
  }, []);

  const toggleRecording = () => {
    if (!recognition) {
      alert("Speech recognition is not supported in this browser.");
      return;
    }

    if (isRecording) {
      recognition.stop();
      setIsRecording(false);
    } else {
      try {
        recognition.start();
        setIsRecording(true);
        setActiveMode('text'); // Switch to text to show transcription live or just keep visually
      } catch (e) {
        console.error("Failed to start recognition", e);
      }
    }
  };

  const [segments, setSegments] = useState([
    { name: 'Initial Spark Analysis', progress: 0 },
    { name: 'Gemini Strategy Engine', progress: 0 },
    { name: 'Visual Scene Scripting', progress: 0 },
    { name: 'Finalizing Batch Data', progress: 0 },
  ]);

  const [statusMessage, setStatusMessage] = useState('Initializing Content Engine...');

  useEffect(() => {
    if (isProcessing) {
      setSegments(prev => prev.map((s, i) => {
        const segmentShare = 100 / prev.length;
        const segmentStart = i * segmentShare;
        const segmentProgress = Math.min(100, Math.max(0, (progress - segmentStart) * (100 / segmentShare)));
        return { ...s, progress: segmentProgress };
      }));

      if (progress < 25) setStatusMessage('Sparking AI analysis...');
      else if (progress < 50) setStatusMessage('Dreaming up cinematic strategy...');
      else if (progress < 75) setStatusMessage('Crafting the visual script...');
      else if (progress < 95) setStatusMessage('Finalizing batch assets...');
      else setStatusMessage('Syncing with your content vault...');
    }
  }, [progress, isProcessing]);

  return (
    <>
      {/* Hero Section */}
      {!isProcessing && !showResults && (
        <div className="text-center mb-16">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-sky/10 text-sky text-xs font-bold mb-6 border border-sky/20 backdrop-blur-md"
          >
            <Clock className="w-3.5 h-3.5" />
            <span className="uppercase tracking-widest text-[10px]">Save 40+ Hours Every Month</span>
          </motion.div>
          
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-5xl md:text-7xl font-display font-light text-white mb-6 leading-tight tracking-tight"
          >
            The 10-Minute <span className="text-gold italic font-medium">Content Month</span>
          </motion.h1>
          
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-lg md:text-xl text-white/60 max-w-2xl mx-auto mb-10 leading-relaxed font-light"
          >
            Transform your single idea into 30 days of high-performance video, 
            image, and audio assets automatically.
          </motion.p>
        </div>
      )}

      <AnimatePresence>
        {!showResults && !isProcessing ? (
          <motion.div 
            key="input-console"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            className="glass rounded-[2rem] p-6 md:p-10 border-white/5 shadow-2xl relative z-10"
          >
            <div className="space-y-8">
              <div className="flex flex-col space-y-4">
                <label className="text-[10px] font-bold uppercase tracking-widest opacity-50 px-2">Step 1: Upload your spark</label>
                
                {/* Mode Selector */}
                <div className="flex flex-wrap gap-2">
                  <ModeButton 
                    active={activeMode === 'text'} 
                    onClick={() => setActiveMode('text')} 
                    icon={<Type className="w-4 h-4" />} 
                    label="Text" 
                  />
                  <ModeButton 
                    active={activeMode === 'voice'} 
                    onClick={() => setActiveMode('voice')} 
                    icon={<Mic className="w-4 h-4" />} 
                    label="Voice Memo" 
                  />
                  <ModeButton 
                    active={activeMode === 'image'} 
                    onClick={() => setActiveMode('image')} 
                    icon={<ImageIcon className="w-4 h-4" />} 
                    label="Reference Image" 
                  />
                  <ModeButton 
                    active={activeMode === 'video'} 
                    onClick={() => setActiveMode('video')} 
                    icon={<Video className="w-4 h-4" />} 
                    label="Raw Video" 
                  />
                </div>
              </div>

              {/* Mode Specific Input */}
              <div className="max-w-4xl">
                {activeMode === 'text' && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <textarea 
                      placeholder="Paste your brainstorming notes or video ideas here..."
                      value={sparkInput}
                      onChange={(e) => setSparkInput(e.target.value)}
                      className="w-full h-48 glass rounded-3xl p-6 focus:border-sky/40 focus:outline-none text-white placeholder:text-white/20 resize-none text-lg transition-colors border-white/5"
                    />
                  </motion.div>
                )}
                  {activeMode === 'voice' && (
                    <motion.div 
                      initial={{ opacity: 0 }} 
                      animate={{ opacity: 1 }} 
                      className="h-48 glass border-dashed border-2 border-white/10 rounded-3xl flex flex-col items-center justify-center space-y-4 group cursor-pointer hover:border-sky/40 transition-colors relative overflow-hidden"
                    >
                      {isRecording && (
                        <div className="absolute inset-0 bg-red-500/5 animate-pulse" />
                      )}
                      <button 
                        onClick={toggleRecording}
                        className={`w-20 h-20 rounded-full flex items-center justify-center transition-all ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-white/5 hover:scale-110'}`}
                      >
                        <Mic className={`text-white w-8 h-8 ${isRecording ? 'opacity-100' : 'opacity-40 group-hover:opacity-100'}`} />
                      </button>
                      <p className="text-sm opacity-60 z-10">
                        {isRecording ? 'Recording your spark... Tap to stop' : 'Tap to start voice recording'}
                      </p>
                      {isRecording && (
                         <div className="flex gap-1">
                            {[1,2,3,4].map(i => (
                               <motion.div 
                                 key={i}
                                 animate={{ height: [4, 12, 4] }}
                                 transition={{ repeat: Infinity, duration: 1, delay: i * 0.1 }}
                                 className="w-0.5 bg-red-500"
                               />
                            ))}
                         </div>
                      )}
                    </motion.div>
                  )}
                {(activeMode === 'image' || activeMode === 'video') && (
                  <motion.div 
                    initial={{ opacity: 0 }} 
                    animate={{ opacity: 1 }} 
                    className="h-48 glass border-dashed border-2 border-white/10 rounded-3xl flex flex-col items-center justify-center space-y-4 group cursor-pointer hover:border-sky/40 transition-colors"
                  >
                    <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                      {activeMode === 'image' ? <ImageIcon className="opacity-40" /> : <Video className="opacity-40" />}
                    </div>
                    <p className="text-sm opacity-60">Drop your {activeMode} here</p>
                  </motion.div>
                )}
              </div>

                <div className="mt-12 pt-8 border-t border-white/5">
                   <label className="text-[10px] font-bold uppercase tracking-widest opacity-50 px-2 mb-4 block">Magic Toolbox Enabled</label>
                   <div className="flex flex-wrap gap-4 opacity-30 hover:opacity-100 transition-opacity">
                      {[
                        { icon: <Sparkles className="w-4 h-4" />, label: 'Gemini intelligence' },
                        { icon: <Mic className="w-4 h-4" />, label: 'Voice conversations' },
                        { icon: <ImageIcon className="w-4 h-4" />, label: 'Analyze images' },
                        { icon: <Video className="w-4 h-4" />, label: 'Analyze video content' },
                        { icon: <Play className="w-4 h-4" />, label: 'Animate images' },
                        { icon: <Layout className="w-4 h-4" />, label: 'Control aspect ratios' },
                        { icon: <Cpu className="w-4 h-4" />, label: 'High thinking' },
                        { icon: <Share2 className="w-4 h-4" />, label: 'Transcribe audio' },
                      ].map((tool, i) => (
                        <div key={i} className="flex items-center gap-2 glass px-3 py-1.5 rounded-full text-[10px] font-bold uppercase border-white/5">
                           {tool.icon}
                           {tool.label}
                        </div>
                      ))}
                   </div>
                </div>

                <div className="mt-12 pt-8 border-t border-white/5">
                   <label className="text-[10px] font-bold uppercase tracking-widest opacity-50 px-2 mb-4 block">Step 2: Production Preferences</label>
                   <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div className="space-y-3">
                    <label className="text-[10px] font-bold uppercase tracking-widest opacity-50 px-2 flex items-center gap-2">
                      <Maximize className="w-3 h-3" /> Aspect Ratio
                    </label>
                    <select 
                      value={productionConfig.aspectRatio}
                      onChange={(e) => updateConfig('aspectRatio', e.target.value)}
                      className="w-full glass p-3 rounded-xl border-white/5 focus:outline-none focus:border-sky/40 text-sm appearance-none bg-forest"
                    >
                      <option value="9:16">Vertical (9:16) - TikTok/Reels</option>
                      <option value="16:9">Wide (16:9) - YouTube</option>
                      <option value="1:1">Square (1:1) - IG/LinkedIn</option>
                    </select>
                  </div>

                  <div className="space-y-3">
                    <label className="text-[10px] font-bold uppercase tracking-widest opacity-50 px-2 flex items-center gap-2">
                      <Music className="w-3 h-3" /> Background Music
                    </label>
                    <div className="flex gap-2">
                      <select 
                        value={productionConfig.musicStyle}
                        onChange={(e) => {
                          updateConfig('musicStyle', e.target.value);
                          if (isPlayingMusic) {
                            musicAudioRef.current?.pause();
                            setIsPlayingMusic(false);
                          }
                        }}
                        className="flex-1 glass p-3 rounded-xl border-white/5 focus:outline-none focus:border-sky/40 text-sm appearance-none bg-forest"
                      >
                        <option value="Cinematic">Cinematic & Moody</option>
                        <option value="Lo-Fi">Lofi Beats</option>
                        <option value="High Energy">High Energy / Phonk</option>
                        <option value="Corporate">Clean Corporate</option>
                        <option value="Acoustic">Acoustic / Warm</option>
                      </select>
                      <button 
                        onClick={previewMusic}
                        className="p-3 rounded-xl glass border-white/5 hover:bg-white/10 transition-colors flex items-center justify-center shrink-0"
                        title="Preview Music"
                      >
                        {isPlayingMusic ? (
                          <div className="w-4 h-4 flex items-center justify-center gap-0.5">
                            <motion.div 
                              animate={{ height: [4, 12, 4] }} 
                              transition={{ repeat: Infinity, duration: 0.5 }}
                              className="w-1 bg-sky rounded-full" 
                            />
                            <motion.div 
                              animate={{ height: [8, 4, 8] }} 
                              transition={{ repeat: Infinity, duration: 0.5, delay: 0.1 }}
                              className="w-1 bg-sky rounded-full" 
                            />
                            <motion.div 
                              animate={{ height: [4, 10, 4] }} 
                              transition={{ repeat: Infinity, duration: 0.5, delay: 0.2 }}
                              className="w-1 bg-sky rounded-full" 
                            />
                          </div>
                        ) : (
                          <Play className="w-4 h-4 text-sky" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="text-[10px] font-bold uppercase tracking-widest opacity-50 px-2 flex items-center gap-2">
                      <Palette className="w-3 h-3" /> Video Style
                    </label>
                    <select 
                      value={productionConfig.videoStyle}
                      onChange={(e) => updateConfig('videoStyle', e.target.value)}
                      className="w-full glass p-3 rounded-xl border-white/5 focus:outline-none focus:border-sky/40 text-sm appearance-none bg-forest"
                    >
                      <option value="Dynamic">Dynamic & Fast Cuts</option>
                      <option value="Cinematic">Cinematic Storytelling</option>
                      <option value="Minimalist">Minimalist / Clean</option>
                      <option value="Vlog">Personal Vlog Style</option>
                      <option value="Dark Aesthetic">Dark Aesthetic / Brutalist</option>
                    </select>
                  </div>

                  <div className="space-y-3">
                    <label className="text-[10px] font-bold uppercase tracking-widest opacity-50 px-2 flex items-center gap-2">
                      <Volume2 className="w-3 h-3" /> Voice Selection
                    </label>
                    <div className="flex gap-2">
                      <select 
                        value={productionConfig.voiceId || productionConfig.voice}
                        onChange={(e) => {
                          const selectedId = e.target.value;
                          const selectedVoice = [...platformVoices, ...clonedVoices].find(v => (v.voice_id || v.voiceId) === selectedId);
                          if (selectedVoice) {
                            setProductionConfig((prev: any) => ({
                              ...prev,
                              voiceId: selectedId,
                              voice: selectedVoice.name
                            }));
                          }
                        }}
                        className="flex-1 glass p-3 rounded-xl border-white/5 focus:outline-none focus:border-sky/40 text-sm appearance-none bg-forest"
                      >
                        {platformVoices.length === 0 && <option value="">Loading voices...</option>}
                        {clonedVoices.length > 0 && (
                          <optgroup label="My Cloned Voices">
                            {clonedVoices.map(v => (
                              <option key={v.voiceId} value={v.voiceId}>{v.name} (Custom)</option>
                            ))}
                          </optgroup>
                        )}
                        {platformVoices.length > 0 && (
                          <optgroup label="Platform Voices">
                            {platformVoices.map(v => (
                              <option key={v.voice_id} value={v.voice_id}>{v.name}</option>
                            ))}
                          </optgroup>
                        )}
                      </select>
                      <button 
                        onClick={previewVoice}
                        className="p-3 rounded-xl glass border-white/5 hover:bg-white/10 transition-colors flex items-center justify-center shrink-0"
                        title={isPlayingVoice ? "Stop Preview" : "Preview Voice"}
                      >
                        {isPlayingVoice ? <Square className="w-4 h-4 text-sky" /> : <Play className="w-4 h-4 text-sky" />}
                      </button>
                      <button 
                        onClick={() => setIsCloningModalOpen(true)}
                        className="p-3 rounded-xl glass border-white/5 hover:bg-white/10 transition-colors flex items-center justify-center shrink-0"
                        title="Clone Voice"
                      >
                        <Mic className="w-4 h-4 text-emerald" />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="text-[10px] font-bold uppercase tracking-widest opacity-50 px-2 flex items-center gap-2">
                      <Timer className="w-3 h-3" /> Video Duration
                    </label>
                    <select 
                      value={productionConfig.duration}
                      onChange={(e) => updateConfig('duration', e.target.value)}
                      className="w-full glass p-3 rounded-xl border-white/5 focus:outline-none focus:border-sky/40 text-sm appearance-none bg-forest"
                    >
                      <option value="15s">15 Seconds (Short)</option>
                      <option value="30s">30 Seconds (Standard)</option>
                      <option value="60s">60 Seconds (Full Reel)</option>
                      <option value="3m">3 Minutes (Mini Vlog)</option>
                      <option value="5m">5 Minutes (Story)</option>
                      <option value="10m">10 Minutes (Deep Dive)</option>
                      <option value="30m">30 Minutes (Documentary)</option>
                    </select>
                  </div>

                  <div className="space-y-3">
                    <label className="text-[10px] font-bold uppercase tracking-widest opacity-50 px-2 flex items-center gap-2">
                      <UserCircle className="w-3 h-3" /> AI Avatar
                    </label>
                    <div className="flex gap-3">
                      <div className="flex-1">
                        <select 
                          value={productionConfig.avatar.startsWith('data:') ? 'custom' : productionConfig.avatar}
                          onChange={(e) => {
                            if (e.target.value === 'custom') {
                              document.getElementById('avatar-upload')?.click();
                            } else {
                              updateConfig('avatar', e.target.value);
                            }
                          }}
                          className="w-full glass p-3 rounded-xl border-white/5 focus:outline-none focus:border-sky/40 text-sm appearance-none bg-forest"
                        >
                          <option value="https://api.dicebear.com/7.x/avataaars/svg?seed=Felix">The Strategist (Male)</option>
                          <option value="https://api.dicebear.com/7.x/avataaars/svg?seed=Anya">Creative Lead (Female)</option>
                          <option value="custom">Upload Custom Avatar...</option>
                        </select>
                        <input 
                          type="file" 
                          id="avatar-upload" 
                          className="hidden" 
                          accept="image/*" 
                          onChange={handleAvatarUpload}
                        />
                      </div>
                      <div 
                        className="w-11 h-11 rounded-lg border border-white/10 sky-bg p-1 shrink-0 overflow-hidden cursor-pointer hover:border-sky/40 transition-colors flex items-center justify-center"
                        onClick={() => document.getElementById('avatar-upload')?.click()}
                      >
                        {productionConfig.avatar.startsWith('data:') || productionConfig.avatar.startsWith('http') ? (
                          <img src={productionConfig.avatar} className="w-full h-full object-cover rounded" />
                        ) : (
                          <Upload className="w-4 h-4 text-white/40" />
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="text-[10px] font-bold uppercase tracking-widest opacity-50 px-2 flex items-center gap-2">
                      <Gauge className="w-3 h-3" /> AI Pacing
                    </label>
                    <div className="flex glass rounded-xl overflow-hidden p-1">
                      {['Slow', 'Balanced', 'Fast'].map((p) => (
                        <button
                          key={p}
                          onClick={() => updateConfig('pacing', p)}
                          className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all ${productionConfig.pacing === p ? 'sky-bg text-black' : 'hover:bg-white/5'}`}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

                <div className="mt-12 pt-8 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-8">
                  <div className="space-y-4 flex-1">
                    <label className="text-[10px] font-bold uppercase tracking-widest opacity-50 px-2">Step 3: Output Targets</label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 w-full">
                      <div className="glass p-3 text-center border-sky group cursor-pointer hover:bg-white/10 transition-colors">
                        <div className="text-[10px] uppercase font-bold opacity-60 mb-1">Vertical</div>
                        <div className="text-xs">Reels/TikTok</div>
                      </div>
                      <div className="glass p-3 text-center border-white/10 cursor-pointer hover:bg-white/10 transition-colors">
                        <div className="text-[10px] uppercase font-bold opacity-60 mb-1">Square</div>
                        <div className="text-xs">Insta/FB</div>
                      </div>
                      <div className="glass p-3 text-center border-white/10 cursor-pointer hover:bg-white/10 transition-colors">
                        <div className="text-[10px] uppercase font-bold opacity-60 mb-1">Wide</div>
                        <div className="text-xs">YouTube</div>
                      </div>
                      <div className="glass p-3 text-center border-white/10 cursor-pointer hover:bg-white/10 transition-colors">
                        <div className="text-[10px] uppercase font-bold opacity-60 mb-1">Social</div>
                        <div className="text-xs">FB Feed</div>
                      </div>
                      <div className="glass p-3 text-center border-white/10 cursor-pointer hover:bg-white/10 transition-colors">
                        <div className="text-[10px] uppercase font-bold opacity-60 mb-1">Voice</div>
                        <div className="text-xs">Podcasts</div>
                      </div>
                    </div>
                  </div>

                  <button 
                    onClick={handleGenerate}
                    className="w-full md:w-auto gold-bg text-black px-12 py-5 rounded-2xl font-bold text-lg flex items-center justify-center gap-3 hover:translate-y-[-4px] transition-all active:translate-y-0 shadow-2xl shadow-gold/20"
                  >
                    Start Batch Generation
                    <ArrowRight className="w-6 h-6" />
                  </button>
                </div>

                {generatedContent.length > 0 && (
                  <div className="mt-20 pt-20 border-t border-white/5">
                    <div className="flex items-center justify-between mb-8">
                       <div>
                         <h3 className="text-xl font-bold">Recent Projects</h3>
                         <p className="text-[10px] uppercase tracking-widest opacity-40 mt-1">Jump back into your latest batch</p>
                       </div>
                       <button 
                        onClick={() => setShowResults(true)}
                        className="text-[10px] font-bold uppercase tracking-widest text-sky flex items-center gap-2 hover:gap-3 transition-all"
                       >
                         View Full Library <ChevronRight className="w-3 h-3" />
                       </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
                       {generatedContent.slice(0, 4).map((item: any, idx: number) => (
                         <div 
                          key={item.id} 
                          className="glass rounded-2xl overflow-hidden border-white/5 hover:border-sky/40 transition-all cursor-pointer group relative"
                          onClick={() => setShowResults(true)}
                         >
                            <img src={item.thumbnail} className="w-full aspect-video object-cover group-hover:scale-105 transition-transform duration-500" />
                            <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors" />
                            <div className="absolute bottom-3 left-3">
                               <p className="text-[10px] font-bold uppercase tracking-widest text-white/60">{item.platform}</p>
                               <h4 className="text-xs font-bold truncate pr-3">{item.title}</h4>
                            </div>
                         </div>
                       ))}
                    </div>
                  </div>
                )}
              </div>
          </motion.div>
        ) : isProcessing ? (
          <motion.div 
            key="processing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="glass rounded-[2.5rem] p-12 shadow-2xl border-white/5 flex flex-col items-center justify-center min-h-[500px]"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 w-full max-w-4xl">
              <div className="flex flex-col items-center justify-center">
                <div className="relative w-48 h-48 mb-10">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle
                      cx="96"
                      cy="96"
                      r="90"
                      stroke="currentColor"
                      strokeWidth="8"
                      fill="transparent"
                      className="text-white/5"
                    />
                    <motion.circle
                      cx="96"
                      cy="96"
                      r="90"
                      stroke="currentColor"
                      strokeWidth="8"
                      fill="transparent"
                      strokeDasharray={565}
                      animate={{ strokeDashoffset: 565 - (progress / 100) * 565 }}
                      className="text-sky transition-all duration-300 ease-out"
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <Cpu className="text-sky w-12 h-12 animate-pulse mb-2" />
                    <span className="text-2xl font-bold font-mono">{Math.floor(progress)}%</span>
                  </div>
                </div>
                <h2 className="text-3xl font-light text-white mb-3">AI Engine Routing</h2>
                <p className="text-sky font-medium text-center italic h-6">{statusMessage}</p>
              </div>

              <div className="space-y-6 flex flex-col justify-center">
                {segments.map((seg, i) => (
                  <div key={i} className="glass p-4 rounded-2xl border-white/5 bg-white/5">
                    <div className="flex items-center justify-between mb-2">
                       <span className={`text-[10px] font-bold uppercase tracking-widest ${seg.progress > 0 ? 'text-sky' : 'opacity-40'}`}>
                         {seg.name}
                       </span>
                       {seg.progress === 100 && <CheckCircle2 className="w-3 h-3 text-sky" />}
                    </div>
                    <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                       <motion.div 
                         animate={{ width: `${seg.progress}%` }}
                         className="h-full sky-bg"
                       />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div 
            key="results"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-12"
          >
            {/* Dashboard Header */}
            <div className="flex flex-col md:flex-row items-end justify-between gap-4">
              <div>
                <h3 className="text-[10px] font-bold uppercase tracking-widest opacity-50 mb-2">Batch Preview: Strategy <span className="text-gold italic">Evergreen Growth</span></h3>
                <h2 className="text-4xl font-light text-white">Your Month, Handled.</h2>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowResults(false)} className="px-6 py-3 rounded-xl font-bold glass text-sm hover:bg-white/10 transition-colors flex items-center gap-2">
                  <RefreshCcw className="w-4 h-4" />
                  Regenerate
                </button>
                <button className="px-6 py-3 rounded-xl font-bold gold-bg text-black text-sm flex items-center gap-2 shadow-xl shadow-gold/20">
                  <Download className="w-4 h-4" />
                  Export All
                </button>
              </div>
            </div>

            {/* View Toggle */}
            <div className="flex gap-4 border-b border-white/5 pb-4">
              <button 
                onClick={() => setSelectedLayout('grid')}
                className={`text-xs font-bold uppercase tracking-widest transition-all pb-4 flex items-center gap-2 ${selectedLayout === 'grid' ? 'text-sky border-b-2 border-sky' : 'text-white/40 hover:text-white'}`}
              >
                <Layout className="w-4 h-4" />
                Grid View
              </button>
              <button 
                onClick={() => setSelectedLayout('calendar')}
                className={`text-xs font-bold uppercase tracking-widest transition-all pb-4 flex items-center gap-2 ${selectedLayout === 'calendar' ? 'text-sky border-b-2 border-sky' : 'text-white/40 hover:text-white'}`}
              >
                <Calendar className="w-4 h-4" />
                Calendar View
              </button>
            </div>

            {generatedContent.length === 0 ? (
              <div className="glass p-20 rounded-[2.5rem] text-center border-white/5 bg-white/5">
                <Video className="w-12 h-12 text-sky mx-auto mb-6 opacity-20" />
                <h3 className="text-xl font-bold mb-2">No Content Created Yet</h3>
                <p className="text-white/40 max-w-md mx-auto text-sm mb-8">
                  Once you start a batch generation, your AI-powered videos and images will appear here as a complete month-long strategy.
                </p>
                <button 
                  onClick={() => setShowResults(false)}
                  className="px-8 py-3 gold-bg text-black font-bold rounded-xl text-xs hover:bg-gold/90 transition-all"
                >
                  Create My First Batch
                </button>
              </div>
            ) : selectedLayout === 'grid' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {generatedContent.map((item: any, index: number) => (
                  <ContentCard key={item.id} item={item} index={index} />
                ))}
                
                <div 
                  onClick={() => setShowResults(false)}
                  className="glass border-dashed border-2 border-white/10 rounded-[2.5rem] flex flex-col items-center justify-center p-8 bg-white/5 hover:bg-white/10 hover:border-sky/40 transition-all group cursor-pointer aspect-video"
                >
                    <Plus className="w-8 h-8 text-white/20 group-hover:scale-110 group-hover:text-sky transition-all mb-2" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-white/40 group-hover:text-white">Add Bonus Post</span>
                </div>
              </div>
            ) : (
              <CalendarGrid content={generatedContent} />
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Voice Cloning Modal */}
      <AnimatePresence>
        {isCloningModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-forest border border-white/10 p-6 rounded-2xl w-full max-w-md shadow-2xl"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold font-heading text-white">Clone Your Voice</h3>
                <button onClick={() => setIsCloningModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/50 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              {!user ? (
                <div className="text-center py-8">
                  <p className="text-white/70 mb-4">You must be logged in to clone and save your custom voices.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-white/50 mb-1">Voice Name</label>
                    <input 
                      type="text" 
                      value={cloneVoiceName}
                      onChange={(e) => setCloneVoiceName(e.target.value)}
                      placeholder="e.g. My Cinematic Voice"
                      className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-white focus:border-emerald/50 focus:outline-none placeholder-white/20"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-white/50 mb-1">Description (Optional)</label>
                    <input 
                      type="text" 
                      value={cloneVoiceDescription}
                      onChange={(e) => setCloneVoiceDescription(e.target.value)}
                      placeholder="e.g. Energetic and fast-paced"
                      className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-white focus:border-emerald/50 focus:outline-none placeholder-white/20"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-white/50 mb-1">Upload Audio Sample</label>
                    <div className="border-2 border-dashed border-white/20 rounded-xl p-6 text-center hover:border-emerald/40 transition-colors bg-black/20">
                      <input 
                        type="file" 
                        accept="audio/mpeg, audio/wav, audio/mp3" 
                        id="voice-upload"
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            setCloneVoiceFile(e.target.files[0]);
                          }
                        }}
                      />
                      <label htmlFor="voice-upload" className="cursor-pointer flex flex-col items-center">
                        <Upload className="w-8 h-8 text-white/40 mb-2" />
                        <span className="text-sm font-medium text-white/80">
                          {cloneVoiceFile ? cloneVoiceFile.name : "Click to select a clean audio file (MP3/WAV)"}
                        </span>
                        <span className="text-xs text-white/40 mt-1">Must be over 1 minute for best results.</span>
                      </label>
                    </div>
                  </div>
                  
                  <div className="bg-black/30 p-3 rounded-xl border border-amber/20 flex items-start gap-3 mt-4">
                    <input type="checkbox" id="consent" className="mt-1" />
                    <label htmlFor="consent" className="text-xs text-white/70 leading-relaxed">
                      I confirm that I have all necessary rights or consents to clone this voice, and it will not be used for fraudulent or illegal purposes.
                    </label>
                  </div>

                  {cloningError && (
                    <div className="bg-red-500/20 text-red-300 p-3 rounded-lg text-sm border border-red-500/30">
                      {cloningError}
                    </div>
                  )}

                  <button 
                    onClick={handleCloneVoice}
                    disabled={!cloneVoiceName || !cloneVoiceFile || isCloning}
                    className="w-full mt-4 bg-emerald hover:bg-emerald/90 disabled:opacity-50 disabled:cursor-not-allowed text-black font-bold py-3 px-6 rounded-xl transition-all flex justify-center items-center gap-2 shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_30px_rgba(16,185,129,0.5)]"
                  >
                    {isCloning ? (
                      <>
                        <RefreshCcw className="w-5 h-5 animate-spin" />
                        Cloning Voice...
                      </>
                    ) : (
                      <>
                        <Mic className="w-5 h-5" />
                        Clone Voice Instantly
                      </>
                    )}
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function TemplatesView({ templates, onBack }: { templates: Template[], onBack: () => void }) {
  const [filter, setFilter] = useState<'All' | 'Intro' | 'Transition' | 'Outro' | 'Style'>('All');

  const filteredTemplates = filter === 'All' ? templates : templates.filter(t => t.category === filter);

  return (
    <motion.div 
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className="space-y-12"
    >
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="text-4xl font-light text-white mb-2">Template Library</h2>
          <p className="text-white/40">Premium assets to spice up your batch generation.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {['All', 'Intro', 'Transition', 'Outro', 'Style'].map((f) => (
            <button 
              key={f}
              onClick={() => setFilter(f as any)}
              className={`px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all ${filter === f ? 'sky-bg text-black' : 'glass hover:bg-white/10'}`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {filteredTemplates.map((template, idx) => (
          <motion.div 
            key={template.id}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: idx * 0.05 }}
            className="group glass rounded-[2.5rem] overflow-hidden border-white/5 hover:border-sky/40 transition-all duration-500 cursor-pointer"
          >
            <div className="aspect-[16/9] relative overflow-hidden">
               <img src={template.thumbnail} alt={template.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
               <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors" />
               <div className={`absolute top-4 left-4 px-3 py-1 rounded-full text-[8px] font-bold uppercase tracking-widest text-white backdrop-blur-md border border-white/20`}>
                  {template.category}
               </div>
               <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="w-12 h-12 rounded-full sky-bg flex items-center justify-center shadow-2xl">
                    <Play className="w-4 h-4 text-black fill-black" />
                  </div>
               </div>
            </div>
            <div className="p-6 flex items-center justify-between">
              <div>
                <h4 className="font-bold text-sm text-white mb-1">{template.name}</h4>
                <p className="text-[10px] opacity-40 uppercase tracking-widest">Optimized for Verticals</p>
              </div>
              <button className="p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors">
                <Plus className="w-4 h-4 text-white" />
              </button>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

function CalendarGrid({ content }: { content: ContentItem[] }) {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  
  // Mock calendar for Oct
  const gridCells = Array.from({ length: 35 }, (_, i) => i + 1);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="glass rounded-[2rem] overflow-hidden border-white/5 p-8"
    >
      <div className="grid grid-cols-7 gap-4">
        {days.map(day => (
          <div key={day} className="text-center text-[10px] font-bold uppercase tracking-widest opacity-40 mb-4">{day}</div>
        ))}
        {gridCells.map(cell => {
          // Mocking October
          const dayNumber = cell - 3; // Starts Oct 1 on Thursday
          const isCurrentMonth = dayNumber >= 1 && dayNumber <= 31;
          const itemsForDay = content.filter(item => {
            if (!item.scheduledDate) return false;
            let date;
            if (item.scheduledDate.toDate) {
              date = item.scheduledDate.toDate();
            } else {
              date = new Date(item.scheduledDate);
            }
            return date.getDate() === dayNumber;
          });

          return (
            <div 
              key={cell} 
              className={`aspect-square glass rounded-2xl p-2 flex flex-col gap-1 border-white/5 transition-all ${!isCurrentMonth ? 'opacity-10' : 'hover:bg-white/5'}`}
            >
              {isCurrentMonth && (
                <>
                  <span className="text-[10px] font-medium opacity-40">{dayNumber}</span>
                  <div className="flex flex-col gap-1 overflow-y-auto custom-scrollbar">
                    {itemsForDay.map(item => (
                      <div key={item.id} className="text-[8px] p-1.5 rounded-lg sky-bg text-black font-bold flex items-center gap-1 truncate group cursor-pointer relative">
                         <div className="w-1.5 h-1.5 rounded-full bg-forest animate-pulse" />
                         {item.title}
                         <div className="absolute inset-0 bg-black opacity-0 group-hover:opacity-10 rounded-lg transition-opacity" />
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

function PricingView({ onBack }: { onBack: () => void }) {
  const plans = [
    {
      name: 'Creator',
      price: 'Free',
      desc: 'Perfect for getting started.',
      features: ['5 AI Video Batches / mo', 'Standard Templates', 'Basic Asset Library', '720p Export'],
      cta: 'Get Started',
      popular: false
    },
    {
      name: 'Influencer',
      price: '$29',
      desc: 'Scale your content strategy.',
      features: ['30 AI Video Batches / mo', 'Premium Templates', 'Advanced Asset Library', '1080p Export', 'Priority Support'],
      cta: 'Go Pro',
      popular: true
    },
    {
      name: 'Studio',
      price: '$99',
      desc: 'The ultimate content engine.',
      features: ['Unlimited Batches', 'Exclusive Templates', 'API Access', '4K Export', 'Dedicated Account Manager', 'Custom AI Training'],
      cta: 'Contact Sales',
      popular: false
    }
  ];

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-16 py-10"
    >
      <div className="text-center max-w-2xl mx-auto">
        <h2 className="text-5xl font-display font-light mb-6">Choose Your <span className="text-gold italic font-medium">Power Level</span></h2>
        <p className="text-white/60 text-lg">Simple, transparent pricing to fuel your content engine.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {plans.map((plan, i) => (
          <div 
            key={i} 
            className={`glass p-10 rounded-[2.5rem] border-white/5 flex flex-col relative transition-all hover:scale-[1.02] ${plan.popular ? 'border-sky/30 shadow-2xl shadow-sky/10' : ''}`}
          >
            {plan.popular && (
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 sky-bg text-black px-4 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest">
                Most Popular
              </div>
            )}
            <div className="mb-8">
              <h3 className="text-xl font-bold mb-2">{plan.name}</h3>
              <div className="flex items-baseline gap-1 mb-4">
                <span className="text-4xl font-bold">{plan.price}</span>
                {plan.price !== 'Free' && <span className="text-white/40 text-sm">/month</span>}
              </div>
              <p className="text-sm text-white/40">{plan.desc}</p>
            </div>

            <div className="space-y-4 mb-10 flex-1">
              {plan.features.map((feature, idx) => (
                <div key={idx} className="flex items-start gap-3">
                  <CheckCircle2 className="w-4 h-4 text-sky shrink-0 mt-0.5" />
                  <span className="text-sm text-white/70">{feature}</span>
                </div>
              ))}
            </div>

            <button className={`w-full py-4 rounded-2xl font-bold transition-all shadow-lg ${plan.popular ? 'gold-bg text-black shadow-gold/20' : 'glass hover:bg-white/10'}`}>
              {plan.cta}
            </button>
          </div>
        ))}
      </div>

      <div className="glass p-12 rounded-[2.5rem] border-white/5 text-center bg-forest-dark/40 backdrop-blur-3xl relative overflow-hidden">
        <div className="absolute inset-0 sky-bg opacity-5 mix-blend-overlay" />
        <h3 className="text-2xl font-light mb-4">Need a custom enterprise solution?</h3>
        <p className="text-white/40 mb-8 max-w-xl mx-auto text-sm">We offer high-volume processing and custom content model training for massive media agencies.</p>
        <button className="px-8 py-3 glass rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-white/10 transition-colors">
          Talk to Enterprise Team
        </button>
      </div>
    </motion.div>
  );
}

function AssetsView({ userAssets, onBack }: { userAssets: Asset[], onBack: () => void }) {
  const logos = userAssets.filter(a => a.type === 'logo');
  const palettes = userAssets.filter(a => a.type === 'palette');
  const fonts = userAssets.filter(a => a.type === 'font');

  const handleAddAsset = async (type: string) => {
    const name = prompt(`Enter ${type} name:`);
    const value = prompt(`Enter ${type} value/url:`);
    if (name && value) {
      try {
        await addDoc(collection(db, 'assets'), {
          name,
          type,
          value,
          userId: auth.currentUser?.uid,
          createdAt: serverTimestamp()
        });
      } catch (e) {
        console.error("Asset add error:", e);
      }
    }
  };

  const handleDeleteAsset = async (id: string) => {
    if (typeof window !== 'undefined' && window.confirm("Delete this asset?")) {
      await deleteDoc(doc(db, 'assets', id));
    }
  };

  const assetCategories = [
    { title: 'Brand Logos', items: logos, icon: <ImageIcon className="w-4 h-4" />, type: 'logo' },
    { title: 'Color Palettes', items: palettes, icon: <div className="w-4 h-4 rounded-full bg-sky" />, type: 'palette' },
    { title: 'Custom Fonts', items: fonts, icon: <Type className="w-4 h-4" />, type: 'font' },
  ];

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="space-y-12"
    >
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="text-4xl font-light text-white mb-2">Asset Library</h2>
          <p className="text-white/40">Manage your brand DNA for consistent AI output.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {assetCategories.map((cat, i) => (
          <div key={i} className="glass p-8 rounded-[2rem] border-white/5 hover:bg-white/5 transition-all">
             <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 glass rounded-xl flex items-center justify-center bg-white/5">
                   {cat.icon}
                </div>
                <h4 className="font-bold text-lg">{cat.title}</h4>
             </div>
             <div className="space-y-3">
                {cat.items.map((item, idx) => (
                  <div key={idx} className="p-3 glass rounded-xl border-white/5 bg-white/5 flex items-center justify-between group cursor-pointer hover:border-sky/40 transition-all">
                     <span className="text-xs opacity-60 group-hover:opacity-100">{item.name}</span>
                     <button onClick={() => handleDeleteAsset(item.id)} className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-500">
                        <Plus className="w-3 h-3 rotate-45" />
                     </button>
                  </div>
                ))}
                <div 
                  onClick={() => handleAddAsset(cat.type)}
                  className="p-3 border-dashed border-2 border-white/5 rounded-xl flex items-center justify-center text-[10px] uppercase font-bold tracking-widest opacity-20 hover:opacity-100 cursor-pointer transition-all"
                >
                   Add {cat.title}
                </div>
             </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

interface ModeButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}

function ModeButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button 
      onClick={onClick}
      className={`input-pill text-xs font-bold uppercase tracking-widest flex items-center gap-2 relative group overflow-hidden ${
        active 
        ? 'border-sky text-white' 
        : 'text-white/60 hover:text-white'
      }`}
    >
      {active && <div className="absolute inset-0 sky-bg opacity-20" />}
      <div className="z-10 flex items-center gap-2">
        {icon}
        <span>{label}</span>
      </div>
    </button>
  );
}

interface ContentCardProps {
  item: ContentItem;
  index: number;
}

function ContentCard({ item, index }: { item: ContentItem; index: number; key?: string | number }) {
  const [isPreviewing, setIsPreviewing] = useState(false);
  
  const handleEdit = async () => {
    if (typeof window === 'undefined') return;
    const newTitle = window.prompt("Enter new title:", item.title);
    if (newTitle) {
      await updateDoc(doc(db, 'content', item.id), {
        title: newTitle,
        updatedAt: serverTimestamp()
      });
    }
  };

  const handleSchedule = async () => {
    if (typeof window === 'undefined') return;
    const dateStr = window.prompt("Enter schedule date (YYYY-MM-DD):", new Date().toISOString().split('T')[0]);
    if (dateStr) {
      const date = new Date(dateStr);
      await updateDoc(doc(db, 'content', item.id), {
        scheduledDate: date,
        updatedAt: serverTimestamp()
      });
    }
  };

  const handleDelete = async () => {
    if (typeof window !== 'undefined' && window.confirm("Delete this generated item?")) {
      await deleteDoc(doc(db, 'content', item.id));
    }
  };

  return (
    <>
    <motion.div 
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: (index % 3) * 0.1, duration: 0.5 }}
      className="group glass rounded-[2.5rem] overflow-hidden shadow-2xl border-white/5 hover:border-sky/40 transition-all duration-500 relative"
    >
      <div className="absolute top-4 left-4 z-20 opacity-0 group-hover:opacity-100 transition-opacity">
        <button 
          onClick={handleDelete}
          className="p-2 bg-red-500/20 hover:bg-red-500/40 rounded-lg backdrop-blur-md border border-red-500/50 transition-colors"
        >
          <Plus className="w-3 h-3 rotate-45 text-red-500" />
        </button>
      </div>
      <div 
        className="relative aspect-video overflow-hidden cursor-pointer"
        onClick={() => setIsPreviewing(true)}
      >
        <img src={item.thumbnail} alt={item.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
        <div className="absolute inset-0 bg-black/40 group-hover:bg-black/60 transition-colors" />
        {item.scheduledDate && (
          <div className="absolute top-2 right-2">
              <div className="w-4 h-4 rounded-full bg-sky shadow-[0_0_10px_rgba(135,206,235,0.5)]" />
          </div>
        )}
        <div className="absolute bottom-3 left-4 right-4 space-y-2">
            <div className="flex items-center justify-between mb-1">
               <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-[9px] font-bold uppercase tracking-widest text-green-500">Rendered</span>
               </div>
               <span className="text-[9px] font-bold uppercase tracking-widest text-white/40">v1.0</span>
            </div>
            <div className="h-1 w-full bg-white/20 rounded-full">
                <div className={`h-1 sky-bg rounded-full ${index % 2 === 0 ? 'w-full' : 'w-full'}`} />
            </div>
            <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-widest text-sky">Batch Output</span>
                <div className="flex items-center gap-1">
                   <Play className="w-3 h-3 text-white fill-white mr-1" />
                   <CheckCircle2 className="w-3 h-3 text-sky" />
                </div>
            </div>
        </div>
      </div>
      <div className="p-6">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] font-bold opacity-40 uppercase tracking-widest">{item.date}</span>
          <span className="text-[10px] font-bold text-sky uppercase tracking-widest">
            {item.platform}
          </span>
        </div>
        <h3 className="font-bold text-sm text-white line-clamp-1">{item.title}</h3>
        <p className="text-[10px] opacity-60 leading-tight mt-2 line-clamp-2">Optimized for algorithm. Auto-posted to scheduler.</p>
        <div className="mt-5 pt-5 border-t border-white/5 flex items-center justify-between gap-2">
           <div className="flex gap-2 flex-1">
             <button 
              onClick={handleEdit}
              className="flex-1 px-3 py-2 glass rounded-lg text-[10px] font-bold uppercase hover:bg-white/10 transition-colors flex items-center justify-center gap-2"
             >
               <RefreshCcw className="w-3 h-3" />
               Edit
             </button>
             <button 
              onClick={handleSchedule}
              className={`flex-1 px-3 py-2 rounded-lg text-[10px] font-bold uppercase flex items-center justify-center gap-2 ${item.scheduledDate ? 'bg-forest border border-sky/30 text-sky' : 'sky-bg text-black'}`}
             >
               <Calendar className="w-3 h-3" />
               {item.scheduledDate ? 'Scheduled' : 'Schedule'}
             </button>
           </div>
           <Download className="w-4 h-4 opacity-40 hover:opacity-100 cursor-pointer transition-opacity" />
        </div>
      </div>
    </motion.div>

    <AnimatePresence>
      {isPreviewing && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-10 backdrop-blur-2xl bg-black/80"
        >
          <motion.div 
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            className="w-full max-w-6xl h-[80vh] glass rounded-[2.5rem] overflow-hidden relative shadow-2xl border-white/10 flex flex-col md:flex-row"
          >
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setIsPreviewing(false);
              }}
              className="absolute top-6 right-6 z-50 w-12 h-12 glass rounded-2xl flex items-center justify-center hover:bg-white/10 transition-colors shadow-2xl"
            >
              <X className="w-6 h-6" />
            </button>

            {/* Video Canvas */}
            <div className="flex-1 relative bg-black overflow-hidden group">
              {item.type === 'video' ? (
                <>
                <video 
                  src={item.videoUrl || 'https://www.w3schools.com/html/mov_bbb.mp4'} 
                  autoPlay 
                  muted
                  controls 
                  className="w-full h-full object-contain"
                />
                
                {/* Simulated AI Overlays */}
                <div className="absolute inset-x-0 bottom-20 px-10 pointer-events-none">
                   <motion.div 
                     initial={{ opacity: 0, y: 20 }}
                     animate={{ opacity: 1, y: 0 }}
                     transition={{ delay: 1 }}
                     className="bg-black/60 backdrop-blur-md p-4 rounded-xl border border-white/10 text-center"
                   >
                     <p className="text-sky font-bold text-xs uppercase tracking-widest mb-1">AI Gen Subtitles</p>
                     <p className="text-white text-lg font-medium">{item.title}</p>
                   </motion.div>
                </div>
                </>
              ) : (
                <div className="w-full h-full relative">
                  <img src={item.thumbnail} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/20" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="glass p-8 rounded-3xl text-center">
                      <ImageIcon className="w-12 h-12 text-sky mx-auto mb-4" />
                      <h3 className="text-xl font-bold">Image Asset Preview</h3>
                      <p className="text-white/40 text-sm mt-1">Ready for {item.platform} export</p>
                    </div>
                  </div>
                </div>
              )}
              
              {item.audioUrl && (
                <div className="absolute top-6 left-6 z-50 bg-black/60 backdrop-blur-md p-4 rounded-xl border border-white/10">
                   <p className="text-gold font-bold text-xs uppercase tracking-widest mb-2">AI Voice Narration</p>
                   <audio src={item.audioUrl} autoPlay controls className="h-8" />
                </div>
              )}
            </div>

            {/* Director's Panel */}
            <div className="w-full md:w-80 border-l border-white/5 bg-white/5 p-8 flex flex-col gap-6 overflow-y-auto overflow-x-hidden">
               <div>
                  <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-sky mb-4">Director View</h4>
                  <div className="space-y-4">
                     <div className="p-4 glass rounded-2xl border-white/5 bg-white/5">
                        <label className="text-[9px] font-bold uppercase tracking-widest opacity-40 block mb-2">Generation Status</label>
                        <div className="flex items-center gap-2">
                           <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                           <span className="text-xs font-bold uppercase tracking-widest">Ready to Export</span>
                        </div>
                     </div>

                     <div className="space-y-2">
                        <div className="flex items-center gap-2 text-xs font-bold opacity-80">
                           <Type className="w-3.5 h-3.5" />
                           AI Script
                        </div>
                        <p className="text-[11px] leading-relaxed opacity-60 bg-black/20 p-3 rounded-xl border border-white/5 italic">
                           {item.script || "Transcribing audio spark to cinematic content flow..."}
                        </p>
                     </div>

                     <div className="space-y-2">
                        <div className="flex items-center gap-2 text-xs font-bold opacity-80">
                           <Sparkles className="w-3.5 h-3.5" />
                           Visual Storyboard
                        </div>
                        <p className="text-[10px] leading-relaxed opacity-40 uppercase tracking-wide">
                           {item.visualPrompt || "Generating scene composition based on branding assets..."}
                        </p>
                     </div>
                  </div>
               </div>

               <div className="mt-auto items-center justify-between gap-4 p-4 glass rounded-2xl flex">
                  <div className="flex items-center gap-2">
                    <Download className="w-4 h-4 text-sky" />
                    <span className="text-[10px] font-bold uppercase tracking-widest">MP4 v1.0</span>
                  </div>
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
               </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
    </>
  );
}

function Feature({ icon, title, desc }: { icon: React.ReactNode, title: string, desc: string }) {
  return (
    <div className="flex flex-col gap-4 p-8 glass rounded-3xl hover:bg-white/5 transition-all duration-300">
      <div className="w-12 h-12 rounded-2xl sky-bg shadow-lg shadow-sky/20 flex items-center justify-center text-xl">
        {icon}
      </div>
      <div>
        <h4 className="text-xs font-bold uppercase tracking-widest opacity-80 mb-2">{title}</h4>
        <p className="text-[10px] opacity-60 leading-relaxed font-light">{desc}</p>
      </div>
    </div>
  );
}
