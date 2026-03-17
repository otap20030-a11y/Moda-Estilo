import React, { useState, useMemo, useEffect, useRef, Component } from 'react';
import { Sparkles, Menu, X, ChevronLeft, ChevronRight, ArrowRight, Camera, Trash2, Plus, RefreshCw, Upload, Send, LogIn, LogOut, Globe, User as UserIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import { GoogleGenAI } from "@google/genai";
import { 
  auth, db, googleProvider, signInWithPopup, signOut, onAuthStateChanged,
  collection, doc, setDoc, getDocs, query, where, orderBy, limit, onSnapshot, addDoc, deleteDoc, updateDoc
} from './firebase';
import { User } from 'firebase/auth';

// --- Types ---
interface UserClothing {
  id: string;
  userId: string;
  image: string;
  timestamp: number;
  category?: string;
  isPublic?: boolean;
  userName?: string;
  userPhoto?: string;
}

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Components
interface NavbarProps {
  user: User | null;
  onLogin: () => void;
  onLogout: () => void;
}

function Navbar({ user, onLogin, onLogout }: NavbarProps) {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-xl border-b border-black/5">
      <div className="max-w-7xl mx-auto px-4 h-20 flex items-center justify-between">
        <div className="flex items-center gap-4 group cursor-pointer">
          <div className="relative">
            <div className="absolute inset-0 bg-emerald-500 rounded-full blur-md opacity-20 group-hover:opacity-40 transition-opacity"></div>
            <img 
              src="https://images.unsplash.com/photo-1552053831-71594a27632d?auto=format&fit=crop&q=80&w=200&h=200" 
              alt="Terry" 
              className="w-14 h-14 rounded-full object-cover border-2 border-emerald-500 shadow-xl relative z-10 transition-transform group-hover:scale-110"
              referrerPolicy="no-referrer"
            />
          </div>
          <h1 className="text-2xl font-black tracking-tighter uppercase italic">Modas Terry</h1>
        </div>
        <div className="flex items-center gap-3">
          {user ? (
            <>
              <div className="flex items-center gap-2 ml-2">
                <img src={user.photoURL || ''} alt={user.displayName || ''} className="w-8 h-8 rounded-full border border-black/10" />
                <button onClick={onLogout} className="p-2 hover:bg-black/5 rounded-full transition-colors text-black/40 hover:text-black">
                  <LogOut size={18} />
                </button>
              </div>
            </>
          ) : (
            <button 
              onClick={onLogin}
              className="flex items-center gap-2 px-6 py-2 rounded-full bg-black text-white text-xs font-bold hover:bg-neutral-800 transition-all"
            >
              <LogIn size={14} />
              <span>Iniciar Sesión</span>
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}

const Hero = ({ onOpenUpload, showUpload }: { onOpenUpload: () => void, showUpload: boolean }) => (
  <section className="pt-40 pb-20 px-4 overflow-hidden">
    <div className="max-w-7xl mx-auto">
      <div className="grid lg:grid-cols-12 gap-12 items-center">
        <div className="lg:col-span-4">
          <motion.div 
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            <h2 className="text-[12vw] lg:text-[5vw] font-black tracking-tighter leading-[0.85] uppercase italic mb-12">
              Comparte <br />
              <span className="text-emerald-500">Tu Estilo</span>
            </h2>
            {showUpload && (
              <div className="flex flex-wrap gap-4">
                <button 
                  onClick={onOpenUpload}
                  className="px-10 py-5 bg-black text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:scale-105 transition-all flex items-center gap-3 shadow-2xl shadow-black/20"
                >
                  <Upload size={20} />
                  Subir Foto
                </button>
              </div>
            )}
          </motion.div>
        </div>
        <div className="lg:col-span-8 hidden lg:block">
          <motion.div 
            initial={{ opacity: 0, scale: 0.8, rotate: 5 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            transition={{ duration: 1, delay: 0.2 }}
            className="relative aspect-[16/10] rounded-[48px] overflow-hidden shadow-[0_32px_64px_-16px_rgba(0,0,0,0.3)] border-[16px] border-white group"
          >
            <img 
              src="https://images.unsplash.com/photo-1552053831-71594a27632d?auto=format&fit=crop&q=80&w=1200" 
              alt="Terry Mascot"
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
              referrerPolicy="no-referrer"
            />
            <div className="absolute bottom-8 left-8 right-8 bg-white/10 backdrop-blur-xl border border-white/20 p-8 rounded-3xl">
              <p className="text-white text-xs font-black uppercase tracking-[0.4em] mb-2">Mascota Oficial de Modas Terry</p>
              <h3 className="text-white text-5xl font-black uppercase italic tracking-tighter">Terry</h3>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  </section>
);

const UploadModal = ({ isOpen, onClose, onUpload }: { isOpen: boolean, onClose: () => void, onUpload: (img: string, isPublic: boolean, category: string) => void }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isPublic, setIsPublic] = useState(true);
  const [category, setCategory] = useState('Ropa');
  const [preview, setPreview] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const categories = ['Ropa', 'Accesorios'];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setPreview(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const processAndUpload = () => {
    if (!preview || !canvasRef.current) return;
    setIsProcessing(true);

    const img = new Image();
    img.onload = () => {
      if (!canvasRef.current) return;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      if (context) {
        const MAX_DIMENSION = 1024;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_DIMENSION) {
            height *= MAX_DIMENSION / width;
            width = MAX_DIMENSION;
          }
        } else {
          if (height > MAX_DIMENSION) {
            width *= MAX_DIMENSION / height;
            height = MAX_DIMENSION;
          }
        }

        canvas.width = width;
        canvas.height = height;
        context.drawImage(img, 0, 0, width, height);
        
        const data = canvas.toDataURL('image/jpeg', 0.7);
        onUpload(data, isPublic, category);
        onClose();
      }
    };
    img.src = preview;
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-xl flex flex-col items-center justify-center p-4"
        >
          <div className="absolute top-6 right-6 z-10">
            <button onClick={onClose} className="p-4 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors">
              <X size={24} />
            </button>
          </div>

          <div className="relative w-full max-w-2xl bg-white rounded-[48px] overflow-hidden shadow-2xl p-8 flex flex-col items-center">
            <h2 className="text-3xl font-black uppercase tracking-tighter italic mb-2">Subir Estilo</h2>
            <p className="text-black/40 text-xs font-bold uppercase tracking-widest mb-8 text-center">Sube una foto para compartir tu estilo</p>

            <div 
              onClick={() => fileInputRef.current?.click()}
              className="w-full aspect-[3/4] rounded-3xl border-2 border-dashed border-black/10 bg-neutral-50 flex flex-col items-center justify-center cursor-pointer hover:bg-neutral-100 transition-colors overflow-hidden group relative"
            >
              {preview ? (
                <img src={preview} alt="Preview" className="w-full h-full object-cover" />
              ) : (
                <>
                  <div className="w-16 h-16 bg-black/5 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <Upload size={32} className="text-black/20" />
                  </div>
                  <span className="text-xs font-bold uppercase tracking-widest text-black/40">Seleccionar Archivo</span>
                </>
              )}
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                accept="image/*" 
                className="hidden" 
              />
            </div>

            <div className="w-full mt-8 space-y-6">
              <div className="space-y-3">
                <span className="text-[10px] font-black uppercase tracking-widest text-black/40 px-2">Categoría</span>
                <div className="flex gap-2">
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setCategory(cat)}
                      className={cn(
                        "flex-1 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border",
                        category === cat 
                          ? "bg-black text-white border-black" 
                          : "bg-white text-black/40 border-black/5 hover:border-black/20"
                      )}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between bg-neutral-100 px-6 py-4 rounded-2xl">
                <div className="flex items-center gap-3">
                  <Globe size={16} className={isPublic ? "text-emerald-500" : "text-black/20"} />
                  <span className="text-[10px] font-black uppercase tracking-widest">Publicar en el Muro</span>
                </div>
                <button 
                  onClick={() => setIsPublic(!isPublic)}
                  className={cn(
                    "w-12 h-6 rounded-full transition-colors relative",
                    isPublic ? "bg-emerald-500" : "bg-black/10"
                  )}
                >
                  <div className={cn(
                    "absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-all",
                    isPublic ? "left-7" : "left-1"
                  )} />
                </button>
              </div>

              <button 
                onClick={processAndUpload}
                disabled={!preview || isProcessing}
                className="w-full py-5 bg-black text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:scale-[1.02] transition-all active:scale-95 disabled:opacity-50 disabled:hover:scale-100 flex items-center justify-center gap-3"
              >
                {isProcessing ? (
                  <RefreshCw size={18} className="animate-spin" />
                ) : (
                  <>
                    <Plus size={18} />
                    <span>Compartir Estilo</span>
                  </>
                )}
              </button>
            </div>
          </div>
          <canvas ref={canvasRef} className="hidden" />
        </motion.div>
      )}
    </AnimatePresence>
  );
};


const GalleryModal = ({ 
  isOpen,
  items, 
  currentIndex, 
  onClose, 
  onNavigate 
}: { 
  isOpen: boolean,
  items: UserClothing[], 
  currentIndex: number, 
  onClose: () => void, 
  onNavigate: (index: number) => void 
}) => {
  const currentItem = items[currentIndex];

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') onNavigate((currentIndex - 1 + items.length) % items.length);
      if (e.key === 'ArrowRight') onNavigate((currentIndex + 1) % items.length);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentIndex, items.length, onClose, onNavigate]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-2xl flex items-center justify-center p-4 lg:p-12"
          onClick={onClose}
        >
          <button 
            onClick={onClose}
            className="absolute top-8 right-8 p-4 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors z-[110]"
          >
            <X size={24} />
          </button>

          <div className="absolute left-4 lg:left-12 top-1/2 -translate-y-1/2 z-[110]">
            <button 
              onClick={(e) => {
                e.stopPropagation();
                onNavigate((currentIndex - 1 + items.length) % items.length);
              }}
              className="p-4 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
            >
              <ChevronLeft size={32} />
            </button>
          </div>

          <div className="absolute right-4 lg:right-12 top-1/2 -translate-y-1/2 z-[110]">
            <button 
              onClick={(e) => {
                e.stopPropagation();
                onNavigate((currentIndex + 1) % items.length);
              }}
              className="p-4 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
            >
              <ChevronRight size={32} />
            </button>
          </div>

          <motion.div 
            key={currentIndex}
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="relative max-w-5xl w-full h-full flex flex-col items-center justify-center gap-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative w-full h-[70vh] rounded-[48px] overflow-hidden shadow-2xl border border-white/10">
              <img 
                src={currentItem.image} 
                alt="Style" 
                className="w-full h-full object-contain bg-neutral-900"
              />
            </div>

            <div className="flex flex-col items-center text-center">
              <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md px-6 py-3 rounded-full border border-white/10 mb-4">
                <img src={currentItem.userPhoto || ''} className="w-6 h-6 rounded-full" />
                <span className="text-xs font-black uppercase tracking-widest text-white">{currentItem.userName}</span>
              </div>
              <p className="text-white/40 text-[10px] font-bold uppercase tracking-[0.2em]">
                {currentIndex + 1} / {items.length}
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

class ErrorBoundary extends (Component as any) {
  state = { hasError: false };

  static getDerivedStateFromError(_error: any) {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-8 bg-neutral-50">
          <div className="max-w-md w-full bg-white p-12 rounded-[48px] shadow-2xl text-center border border-black/5">
            <div className="w-20 h-20 bg-red-500 rounded-full flex items-center justify-center text-white mx-auto mb-8 shadow-xl shadow-red-500/20">
              <X size={40} />
            </div>
            <h2 className="text-3xl font-black uppercase tracking-tighter italic mb-4">Algo salió mal</h2>
            <p className="text-black/40 text-sm font-medium leading-relaxed mb-8">
              Hemos tenido un problema técnico. Por favor, intenta recargar la página.
            </p>
            <button 
              onClick={() => window.location.reload()}
              className="w-full py-4 bg-black text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:scale-105 transition-all"
            >
              Recargar Página
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}

const AUTHORIZED_EMAIL = "ramon39261@gmail.com";

function AppContent() {
  const [user, setUser] = useState<User | null>(null);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [feedItems, setFeedItems] = useState<UserClothing[]>([]);
  const [isFeedLoading, setIsFeedLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('Todos');

  const filteredItems = useMemo(() => {
    if (activeFilter === 'Todos') return feedItems;
    return feedItems.filter(item => item.category === activeFilter);
  }, [feedItems, activeFilter]);

  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Auth listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setIsAuthReady(true);
      if (u) {
        // Save user profile
        setDoc(doc(db, 'users', u.uid), {
          uid: u.uid,
          displayName: u.displayName,
          photoURL: u.photoURL,
          email: u.email
        }, { merge: true }).catch(err => handleFirestoreError(err, OperationType.WRITE, `users/${u.uid}`));
      }
    });
    return () => unsubscribe();
  }, []);

  // Feed listener
  useEffect(() => {
    const q = query(
      collection(db, 'clothing'),
      where('isPublic', '==', true),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newItems = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as UserClothing[];
      
      const sortedItems = newItems.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      setFeedItems(sortedItems);
      setIsFeedLoading(false);
    }, (error) => {
      console.error("Feed Error:", error);
      handleFirestoreError(error, OperationType.LIST, 'clothing');
    });

    return () => unsubscribe();
  }, []);

  const login = async () => {
    if (isLoggingIn) return;
    setIsLoggingIn(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      if (error.code !== 'auth/cancelled-popup-request' && error.code !== 'auth/popup-closed-by-user') {
        console.error("Login Error:", error);
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-black border-t-transparent rounded-full animate-spin" />
          <p className="text-[10px] font-black uppercase tracking-widest text-black/20">Cargando Studio...</p>
        </div>
      </div>
    );
  }

  const logout = () => signOut(auth);

  const addToFeed = async (image: string, isPublic: boolean, category: string) => {
    console.log("addToFeed: Starting upload", { isPublic, category });
    if (!user) {
      login();
      return;
    }

    const newItem: Omit<UserClothing, 'id'> = {
      userId: user.uid,
      image,
      timestamp: Date.now(),
      category,
      isPublic,
      userName: user.displayName || 'Usuario',
      userPhoto: user.photoURL || ''
    };

    try {
      const docRef = await addDoc(collection(db, 'clothing'), newItem);
      console.log("addToFeed: Success, doc ID:", docRef.id);
    } catch (error) {
      console.error("addToFeed: Error", error);
      handleFirestoreError(error, OperationType.CREATE, 'clothing');
    }
  };

  const deleteFromFeed = async (itemId: string) => {
    if (!user) return;
    
    try {
      setIsFeedLoading(true);
      await deleteDoc(doc(db, 'clothing', itemId));
      console.log("deleteFromFeed: Success, item ID:", itemId);
      setDeletingId(null);
    } catch (error) {
      console.error("deleteFromFeed: Error", error);
      handleFirestoreError(error, OperationType.DELETE, `clothing/${itemId}`);
    } finally {
      setIsFeedLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white text-black font-sans selection:bg-emerald-500 selection:text-white">
      <Navbar 
        user={user}
        onLogin={login}
        onLogout={logout}
      />

      <main>
        <Hero 
          onOpenUpload={() => {
            if (!user) login();
            else if (user.email === AUTHORIZED_EMAIL) setIsUploadOpen(true);
          }}
          showUpload={user?.email === AUTHORIZED_EMAIL}
        />

        <section id="muro" className="py-40 bg-black text-white overflow-hidden">
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-20">
              <div className="max-w-xl">
                <h2 className="text-7xl font-black tracking-tighter leading-[0.9] uppercase italic mb-8">
                  Tu Estilo, <br />
                  <span className="text-emerald-500">En el Muro</span>
                </h2>
                <p className="text-white/60 text-lg mb-12 max-w-md leading-relaxed">
                  Comparte tus mejores outfits con la comunidad subiendo fotos directamente desde tu galería.
                </p>
                {user?.email === AUTHORIZED_EMAIL && (
                  <button 
                    onClick={() => {
                      if (!user) login();
                      else setIsUploadOpen(true);
                    }}
                    className="px-10 py-5 bg-emerald-500 text-black rounded-2xl font-black uppercase tracking-widest text-xs hover:scale-105 transition-all shadow-2xl shadow-emerald-500/20 flex items-center gap-3"
                  >
                    <Upload size={18} />
                    Subir mis Fotos
                  </button>
                )}
              </div>

              <div className="flex gap-2 bg-white/5 p-1.5 rounded-2xl backdrop-blur-sm border border-white/10">
                {['Todos', 'Ropa', 'Accesorios'].map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setActiveFilter(filter)}
                    className={cn(
                      "px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                      activeFilter === filter 
                        ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20" 
                        : "text-white/40 hover:text-white hover:bg-white/5"
                    )}
                  >
                    {filter}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid lg:grid-cols-2 gap-20 items-start">
              <div className="relative lg:order-2">
                {isFeedLoading ? (
                  <div className="flex items-center justify-center h-80">
                    <RefreshCw className="animate-spin text-white/20" />
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-4 pt-12">
                      {filteredItems.filter((_, i) => i % 2 === 0).map((item) => (
                        <div 
                          key={item.id} 
                          className="relative aspect-[3/4] rounded-3xl overflow-hidden bg-neutral-900 border border-white/10 group cursor-pointer"
                          onClick={() => {
                            const index = feedItems.findIndex(fi => fi.id === item.id);
                            setSelectedImageIndex(index);
                          }}
                        >
                          <img src={item.image} alt="Style" className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity" />
                          <div className="absolute top-4 left-4">
                            <span className="px-2 py-1 bg-emerald-500 text-white text-[8px] font-black uppercase tracking-widest rounded-md shadow-lg">
                              {item.category}
                            </span>
                          </div>
                          <div className="absolute bottom-4 left-4 flex items-center gap-2 bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-full border border-white/5">
                            <img src={item.userPhoto || ''} className="w-4 h-4 rounded-full" />
                            <span className="text-[9px] font-black uppercase tracking-tighter text-white">{item.userName}</span>
                          </div>
                          {user && item.userId === user.uid && (
                            <div className="absolute top-4 right-4 flex gap-2" onClick={(e) => e.stopPropagation()}>
                              {deletingId === item.id ? (
                                <div className="flex gap-1">
                                  <button 
                                    onClick={() => deleteFromFeed(item.id)}
                                    className="p-2 bg-red-600 text-white rounded-full transition-all backdrop-blur-sm shadow-lg z-10 text-[10px] font-bold px-3"
                                  >
                                    <span>Confirmar</span>
                                  </button>
                                  <button 
                                    onClick={() => setDeletingId(null)}
                                    className="p-2 bg-white/20 text-white rounded-full transition-all backdrop-blur-sm shadow-lg z-10"
                                  >
                                    <X size={14} />
                                  </button>
                                </div>
                              ) : (
                                <button 
                                  onClick={() => setDeletingId(item.id)}
                                  className="p-2.5 bg-red-500 hover:bg-red-600 text-white rounded-full transition-all backdrop-blur-sm shadow-lg z-10"
                                  title="Eliminar foto"
                                >
                                  <Trash2 size={16} />
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    <div className="space-y-4">
                      {filteredItems.filter((_, i) => i % 2 !== 0).map((item) => (
                        <div 
                          key={item.id} 
                          className="relative aspect-[3/4] rounded-3xl overflow-hidden bg-neutral-900 border border-white/10 group cursor-pointer"
                          onClick={() => {
                            const index = feedItems.findIndex(fi => fi.id === item.id);
                            setSelectedImageIndex(index);
                          }}
                        >
                          <img src={item.image} alt="Style" className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity" />
                          <div className="absolute top-4 left-4">
                            <span className="px-2 py-1 bg-emerald-500 text-white text-[8px] font-black uppercase tracking-widest rounded-md shadow-lg">
                              {item.category}
                            </span>
                          </div>
                          <div className="absolute bottom-4 left-4 flex items-center gap-2 bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-full border border-white/5">
                            <img src={item.userPhoto || ''} className="w-4 h-4 rounded-full" />
                            <span className="text-[9px] font-black uppercase tracking-tighter text-white">{item.userName}</span>
                          </div>
                          {user && item.userId === user.uid && (
                            <div className="absolute top-4 right-4 flex gap-2" onClick={(e) => e.stopPropagation()}>
                              {deletingId === item.id ? (
                                <div className="flex gap-1">
                                  <button 
                                    onClick={() => deleteFromFeed(item.id)}
                                    className="p-2 bg-red-600 text-white rounded-full transition-all backdrop-blur-sm shadow-lg z-10 text-[10px] font-bold px-3"
                                  >
                                    <span>Confirmar</span>
                                  </button>
                                  <button 
                                    onClick={() => setDeletingId(null)}
                                    className="p-2 bg-white/20 text-white rounded-full transition-all backdrop-blur-sm shadow-lg z-10"
                                  >
                                    <X size={14} />
                                  </button>
                                </div>
                              ) : (
                                <button 
                                  onClick={() => setDeletingId(item.id)}
                                  className="p-2.5 bg-red-500 hover:bg-red-600 text-white rounded-full transition-all backdrop-blur-sm shadow-lg z-10"
                                  title="Eliminar foto"
                                >
                                  <Trash2 size={16} />
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {!isFeedLoading && feedItems.length === 0 && (
                  <div className="grid grid-cols-2 gap-4 opacity-20 grayscale">
                    <div className="space-y-4 pt-12">
                      <div className="aspect-[3/4] rounded-3xl overflow-hidden bg-neutral-900 border border-white/10" />
                      <div className="aspect-[3/4] rounded-3xl overflow-hidden bg-neutral-900 border border-white/10" />
                    </div>
                    <div className="space-y-4">
                      <div className="aspect-[3/4] rounded-3xl overflow-hidden bg-neutral-900 border border-white/10" />
                      <div className="aspect-[3/4] rounded-3xl overflow-hidden bg-neutral-900 border border-white/10" />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="py-20 px-4 border-t bg-neutral-50">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-12 mb-20">
            <div className="col-span-2">
              <div className="flex items-center gap-6 mb-8">
                <div className="relative">
                  <div className="absolute inset-0 bg-emerald-500 rounded-full blur-lg opacity-20"></div>
                  <img 
                    src="https://images.unsplash.com/photo-1552053831-71594a27632d?auto=format&fit=crop&q=80&w=200&h=200" 
                    alt="Terry" 
                    className="w-20 h-20 rounded-full object-cover border-4 border-white shadow-2xl relative z-10"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <h2 className="text-4xl font-black tracking-tighter uppercase italic">Modas Terry</h2>
              </div>
              <p className="text-black/40 max-w-xs text-sm leading-relaxed">
                Redefiniendo la experiencia de moda con tecnología y comunidad.
              </p>
            </div>
            <div>
              <h4 className="text-[10px] font-black uppercase tracking-widest mb-6">Explorar</h4>
              <ul className="space-y-4 text-sm font-bold uppercase tracking-tighter">
                <li><a href="#muro" className="hover:text-emerald-500 transition-colors">Muro de Estilo</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-[10px] font-black uppercase tracking-widest mb-6">Soporte</h4>
              <ul className="space-y-4 text-sm font-bold uppercase tracking-tighter">
                <li><a href="#" className="hover:text-emerald-500 transition-colors">Envíos</a></li>
                <li><a href="#" className="hover:text-emerald-500 transition-colors">Devoluciones</a></li>
                <li><a href="#" className="hover:text-emerald-500 transition-colors">Contacto</a></li>
              </ul>
            </div>
          </div>
          <div className="pt-8 border-t flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-[10px] font-bold text-black/20 uppercase tracking-widest">© 2026 Modas Terry. All rights reserved.</p>
            <div className="flex gap-8">
              <a href="#" className="text-[10px] font-bold text-black/20 uppercase tracking-widest hover:text-black transition-colors">Instagram</a>
              <a href="#" className="text-[10px] font-bold text-black/20 uppercase tracking-widest hover:text-black transition-colors">TikTok</a>
              <a href="#" className="text-[10px] font-bold text-black/20 uppercase tracking-widest hover:text-black transition-colors">Pinterest</a>
            </div>
          </div>
        </div>
      </footer>

      <UploadModal 
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onUpload={addToFeed}
      />
      <GalleryModal 
        isOpen={selectedImageIndex !== null}
        items={feedItems}
        currentIndex={selectedImageIndex || 0}
        onClose={() => setSelectedImageIndex(null)}
        onNavigate={setSelectedImageIndex}
      />
    </div>
  );
}
