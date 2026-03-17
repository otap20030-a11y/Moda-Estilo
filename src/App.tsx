import React, { useState, useMemo, useEffect, useRef, Component } from 'react';
import { Sparkles, Menu, X, ChevronRight, ArrowRight, Camera, Trash2, Plus, RefreshCw, Upload, Send, LogIn, LogOut, Globe, User as UserIcon } from 'lucide-react';
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
        <div className="flex items-center gap-12">
          <h1 className="text-2xl font-black tracking-tighter uppercase italic">Studio Moda</h1>
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

const Hero = ({ onOpenUpload }: { onOpenUpload: () => void }) => (
  <section className="pt-40 pb-20 px-4 overflow-hidden">
    <div className="max-w-7xl mx-auto">
      <div className="grid lg:grid-cols-12 gap-12 items-end">
        <div className="lg:col-span-8">
          <motion.div 
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="flex items-center gap-3 mb-6">
              <span className="px-3 py-1 bg-black text-white text-[10px] font-black uppercase tracking-widest rounded-full">New Season</span>
              <span className="text-[10px] font-bold text-black/30 uppercase tracking-widest">Spring / Summer 2026</span>
            </div>
            <h2 className="text-[12vw] lg:text-[10vw] font-black tracking-tighter leading-[0.85] uppercase italic mb-12">
              Comparte <br />
              <span className="text-emerald-500">Tu Estilo</span>
            </h2>
            <div className="flex flex-wrap gap-4">
              <button 
                onClick={onOpenUpload}
                className="px-10 py-5 bg-black text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:scale-105 transition-all flex items-center gap-3 shadow-2xl shadow-black/20"
              >
                <Upload size={20} />
                Subir Foto
              </button>
            </div>
          </motion.div>
        </div>
        <div className="lg:col-span-4 hidden lg:block">
          <motion.div 
            initial={{ opacity: 0, scale: 0.8, rotate: 5 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            transition={{ duration: 1, delay: 0.2 }}
            className="relative aspect-[3/4] rounded-[48px] overflow-hidden shadow-2xl border-[12px] border-white"
          >
            <img 
              src="https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&q=80&w=800" 
              alt="Studio Fashion"
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          </motion.div>
        </div>
      </div>
    </div>
  </section>
);

const UploadModal = ({ isOpen, onClose, onUpload }: { isOpen: boolean, onClose: () => void, onUpload: (img: string, isPublic: boolean) => void }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isPublic, setIsPublic] = useState(true);
  const [preview, setPreview] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

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
      const canvas = canvasRef.current!;
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
        onUpload(data, isPublic);
        setIsProcessing(false);
        setPreview(null);
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
                  <p className="text-xs font-bold uppercase tracking-widest text-black/40">Seleccionar Archivo</p>
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
                    Compartir Estilo
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

function AppContent() {
  const [user, setUser] = useState<User | null>(null);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [feedItems, setFeedItems] = useState<UserClothing[]>([]);
  const [isFeedLoading, setIsFeedLoading] = useState(true);

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

  const addToFeed = async (image: string, isPublic: boolean) => {
    console.log("addToFeed: Starting upload", { isPublic });
    if (!user) {
      login();
      return;
    }

    const newItem: Omit<UserClothing, 'id'> = {
      userId: user.uid,
      image,
      timestamp: Date.now(),
      category: 'General',
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
            else setIsUploadOpen(true);
          }}
        />

        <section id="muro" className="py-40 bg-black text-white overflow-hidden">
          <div className="max-w-7xl mx-auto px-4">
            <div className="grid lg:grid-cols-2 gap-20 items-center">
              <div>
                <h2 className="text-7xl font-black tracking-tighter leading-[0.9] uppercase italic mb-8">
                  Tu Estilo, <br />
                  <span className="text-emerald-500">En el Muro</span>
                </h2>
                <p className="text-white/60 text-lg mb-12 max-w-md leading-relaxed">
                  Comparte tus mejores outfits con la comunidad subiendo fotos directamente desde tu galería.
                </p>
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
              </div>
              <div className="relative">
                {isFeedLoading ? (
                  <div className="flex items-center justify-center h-80">
                    <RefreshCw className="animate-spin text-white/20" />
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-4 pt-12">
                      {feedItems.filter((_, i) => i % 2 === 0).map((item) => (
                        <div key={item.id} className="relative aspect-[3/4] rounded-3xl overflow-hidden bg-neutral-900 border border-white/10 group">
                          <img src={item.image} alt="Style" className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity" />
                          <div className="absolute bottom-4 left-4 flex items-center gap-2 bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-full border border-white/5">
                            <img src={item.userPhoto || ''} className="w-4 h-4 rounded-full" />
                            <span className="text-[9px] font-black uppercase tracking-tighter text-white">{item.userName}</span>
                          </div>
                          {user && item.userId === user.uid && (
                            <div className="absolute top-4 right-4 flex gap-2">
                              {deletingId === item.id ? (
                                <div className="flex gap-1">
                                  <button 
                                    onClick={() => deleteFromFeed(item.id)}
                                    className="p-2 bg-red-600 text-white rounded-full transition-all backdrop-blur-sm shadow-lg z-10 text-[10px] font-bold px-3"
                                  >
                                    Confirmar
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
                      {feedItems.filter((_, i) => i % 2 !== 0).map((item) => (
                        <div key={item.id} className="relative aspect-[3/4] rounded-3xl overflow-hidden bg-neutral-900 border border-white/10 group">
                          <img src={item.image} alt="Style" className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity" />
                          <div className="absolute bottom-4 left-4 flex items-center gap-2 bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-full border border-white/5">
                            <img src={item.userPhoto || ''} className="w-4 h-4 rounded-full" />
                            <span className="text-[9px] font-black uppercase tracking-tighter text-white">{item.userName}</span>
                          </div>
                          {user && item.userId === user.uid && (
                            <div className="absolute top-4 right-4 flex gap-2">
                              {deletingId === item.id ? (
                                <div className="flex gap-1">
                                  <button 
                                    onClick={() => deleteFromFeed(item.id)}
                                    className="p-2 bg-red-600 text-white rounded-full transition-all backdrop-blur-sm shadow-lg z-10 text-[10px] font-bold px-3"
                                  >
                                    Confirmar
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
              <h2 className="text-3xl font-black tracking-tighter uppercase italic mb-6">Studio Moda</h2>
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
            <p className="text-[10px] font-bold text-black/20 uppercase tracking-widest">© 2026 Studio Moda. All rights reserved.</p>
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
    </div>
  );
}
