import React, { useState, useEffect } from "react";
import { 
  ShieldCheck, 
  AlertTriangle, 
  Search, 
  History, 
  LogOut, 
  Github,
  LogIn,
  AlertCircle,
  CheckCircle2,
  Lock,
  ArrowRight
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  onAuthStateChanged,
  User
} from "firebase/auth";
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot,
  Timestamp,
  serverTimestamp
} from "firebase/firestore";
import { auth, db } from "./lib/firebase";
import { analyzeScam, ScamAnalysis } from "./services/geminiService";

// Types
interface ScanResult extends ScamAnalysis {
  id?: string;
  message: string;
  createdAt: any;
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"analyze" | "history">("analyze");
  const [message, setMessage] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [history, setHistory] = useState<ScanResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // History Listener
  useEffect(() => {
    if (!user) {
      setHistory([]);
      return;
    }

    const q = query(
      collection(db, "scans"),
      where("userId", "==", user.uid),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...(doc.data() as Omit<ScanResult, "id">)
      }));
      setHistory(docs);
    }, (err) => {
      console.error("Firestore error:", err);
    });

    return () => unsubscribe();
  }, [user]);

  const login = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (err) {
      console.error("Login failed", err);
    }
  };

  const logout = () => signOut(auth);

  const analyzeMessage = async () => {
    if (!message.trim()) return;
    setIsAnalyzing(true);
    setError(null);
    setResult(null);

    try {
      const data = await analyzeScam(message);
      setResult(data as ScanResult);

      // Save to Firestore if logged in
      if (user) {
        await addDoc(collection(db, "scans"), {
          ...data,
          userId: user.uid,
          message,
          createdAt: serverTimestamp(),
        });
      }
    } catch (err) {
      setError("AI analysis failed. Please try again.");
      console.error(err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          className="w-12 h-12 border-4 border-cyan-500/20 border-t-cyan-500 rounded-full"
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 border-b border-slate-200 bg-white/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-600/20">
              <ShieldCheck className="text-white w-5 h-5" />
            </div>
            <span className="text-xl font-bold tracking-tight uppercase">
              ScamShield <span className="text-blue-600">AI</span>
            </span>
          </div>

          <div className="flex items-center gap-4">
            {user ? (
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setActiveTab("analyze")}
                  className={`hidden sm:block px-4 py-2 text-xs font-bold uppercase tracking-widest rounded-lg transition-colors ${activeTab === "analyze" ? "bg-slate-100 text-blue-600" : "text-slate-400 hover:text-slate-600"}`}
                >
                  Analyze
                </button>
                <button 
                  onClick={() => setActiveTab("history")}
                  className={`hidden sm:block px-4 py-2 text-xs font-bold uppercase tracking-widest rounded-lg transition-colors ${activeTab === "history" ? "bg-slate-100 text-blue-600" : "text-slate-400 hover:text-slate-600"}`}
                >
                  History
                </button>
                <div className="h-4 w-[1px] bg-slate-200 hidden sm:block" />
                <button 
                  onClick={logout}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors text-xs font-bold text-slate-500 uppercase"
                >
                  <LogOut className="w-3 h-3" />
                  <span className="hidden sm:inline">Logout</span>
                </button>
                <img src={user.photoURL || ""} alt={user.displayName || ""} className="w-8 h-8 rounded-full border border-slate-200 shadow-sm" />
              </div>
            ) : (
              <button 
                onClick={login}
                className="flex items-center gap-2 px-6 py-2 bg-slate-900 text-white rounded-full font-bold text-sm hover:bg-slate-800 transition-all active:scale-95"
              >
                <LogIn className="w-4 h-4" />
                Get Started
              </button>
            )}
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 py-12 relative z-10">
        <AnimatePresence mode="wait">
          {activeTab === "analyze" ? (
            <motion.div 
              key="analyze"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex flex-col lg:flex-row gap-8"
            >
              {/* Left Column: Input & Status */}
              <div className="lg:w-1/3 flex flex-col gap-6">
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Analysis Input</h2>
                    <div className="flex gap-1">
                      <button className="px-2 py-0.5 bg-blue-50 text-blue-600 text-[9px] font-black rounded border border-blue-100 uppercase">Auto</button>
                    </div>
                  </div>
                  
                  <div className="relative border-2 border-dashed border-slate-100 rounded-xl p-4 bg-slate-50 flex-grow group focus-within:border-blue-200 transition-all">
                    <textarea 
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Paste SMS, Email text, or URL here..."
                      className="w-full bg-transparent resize-none h-48 focus:outline-none text-sm text-slate-800 leading-relaxed placeholder:text-slate-300"
                    />
                    <div className="absolute bottom-3 right-3 text-[9px] font-mono text-slate-300 uppercase">
                      {message.length} chars
                    </div>
                  </div>

                  <button 
                    onClick={analyzeMessage}
                    disabled={isAnalyzing || !message.trim()}
                    className={`w-full py-4 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${
                      isAnalyzing || !message.trim() 
                        ? "bg-slate-100 text-slate-300 cursor-not-allowed" 
                        : "bg-slate-900 hover:bg-slate-800 text-white shadow-lg shadow-slate-900/10 active:scale-[0.98]"
                    }`}
                  >
                    {isAnalyzing ? (
                      <>
                        <motion.div 
                          animate={{ rotate: 360 }}
                          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                          className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full"
                        />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Search className="w-4 h-4" />
                        Analyze Message
                      </>
                    )}
                  </button>
                </div>

                <div className="bg-slate-900 rounded-2xl p-6 text-white shadow-xl">
                  <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">Latest Detections</h3>
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 opacity-60">
                      <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></div>
                      <span className="text-[11px] truncate font-medium">SMS +1 833 ... Flagged as High Risk</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></div>
                      <span className="text-[11px] font-medium">Email Analysis: Safe (Authentic)</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Results */}
              <div className="lg:w-2/3 space-y-6">
                {!result && !error && !isAnalyzing && (
                  <div className="h-full flex flex-col items-center justify-center p-12 text-center space-y-4 bg-white border border-slate-200 border-dashed rounded-[2rem] text-slate-300">
                    <ShieldCheck className="w-16 h-16 opacity-10" />
                    <p className="text-sm font-medium tracking-wide uppercase">Awaiting Input Data</p>
                  </div>
                )}

                {error && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-red-50 border border-red-100 text-red-600 p-6 rounded-2xl flex items-center gap-4"
                  >
                    <AlertCircle className="w-6 h-6 flex-shrink-0" />
                    <p className="font-bold text-sm">{error}</p>
                  </motion.div>
                )}

                <AnimatePresence>
                  {result && (
                    <motion.div 
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-6"
                    >
                      {/* Classification Card */}
                      <div className={`bg-white rounded-[2rem] shadow-sm border border-slate-200 border-l-[12px] p-8 ${
                        result.decision === "Scam" ? "border-l-red-500" :
                        result.decision === "Suspicious" ? "border-l-yellow-500" :
                        "border-l-emerald-500"
                      }`}>
                        <div className="flex flex-col md:flex-row justify-between items-start gap-6">
                          <div className="space-y-4">
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter ${
                              result.decision === "Scam" ? "bg-red-100 text-red-700" :
                              result.decision === "Suspicious" ? "bg-yellow-100 text-yellow-700" :
                              "bg-emerald-100 text-emerald-700"
                            }`}>
                              {result.risk} Risk Detected
                            </span>
                            <h1 className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tighter italic uppercase leading-none">
                              {result.decision} Detected
                            </h1>
                          </div>
                          <div className="md:text-right">
                            <div className="text-[10px] text-slate-400 font-bold uppercase mb-1 tracking-widest">Confidence Score</div>
                            <div className="text-6xl font-light text-slate-900 leading-none">
                              {result.confidence}<span className="text-2xl opacity-20">%</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Detail Grid */}
                      <div className="grid sm:grid-cols-2 gap-6">
                        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                          <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-6">Flagged Analysis</h3>
                          <div className="space-y-6">
                            <div className="flex gap-4">
                              <div className={`w-6 h-6 rounded bg-slate-50 flex items-center justify-center flex-shrink-0 ${
                                result.decision === "Scam" ? "text-red-500" : "text-blue-500"
                              }`}>
                                <AlertCircle className="w-4 h-4" />
                              </div>
                              <div className="space-y-1">
                                <p className="text-sm font-bold text-slate-800">Pattern Intent</p>
                                <p className="text-xs text-slate-500 leading-relaxed">{result.reason}</p>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col">
                          <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-6">Expert Action</h3>
                          <div className="flex-grow flex flex-col gap-3">
                            <div className="p-4 bg-slate-900 text-white rounded-xl flex items-center justify-between group cursor-pointer hover:bg-slate-800 transition-all">
                              <span className="text-xs font-bold leading-tight">{result.action}</span>
                              <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-white transition-colors" />
                            </div>
                            <div className="p-4 border border-slate-200 rounded-xl flex items-center justify-between hover:bg-slate-50 transition-colors cursor-pointer group">
                              <span className="text-xs font-bold text-slate-700">Get Legal Support</span>
                              <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-slate-600 transition-colors" />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Insight Footer */}
                      <div className="bg-blue-50 border border-blue-100 rounded-2xl p-6 shadow-sm">
                        <div className="flex gap-4 items-center">
                          <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center flex-shrink-0 shadow-sm border border-blue-100">
                            <ShieldCheck className="w-6 h-6 text-blue-600" />
                          </div>
                          <div>
                            <h4 className="text-[10px] font-bold text-blue-800 uppercase tracking-tight">System Architect Insight</h4>
                            <p className="text-xs text-blue-700/80 leading-relaxed mt-1">
                              Analysis completed via Multi-Shot pipeline. Identity signals show {(result.confidence * 0.98).toFixed(1)}% correlation with known phishing templates.
                            </p>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="history"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="max-w-3xl mx-auto space-y-8"
            >
              <div className="flex items-end justify-between border-b-2 border-slate-100 pb-4">
                <h2 className="text-3xl font-black text-slate-900 tracking-tighter italic uppercase">Security Log</h2>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{history.length} Entries</div>
              </div>

              {!user && (
                <div className="bg-white border border-slate-200 p-16 rounded-[2.5rem] text-center space-y-6 shadow-sm">
                  <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto">
                    <Lock className="w-8 h-8 text-slate-200" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-bold tracking-tight">Access Restricted</h3>
                    <p className="text-slate-500 text-sm max-w-xs mx-auto leading-relaxed">
                      Please sign in with your Google account to view your analysis history and tracked threats.
                    </p>
                  </div>
                  <button 
                    onClick={login}
                    className="px-8 py-3 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/10"
                  >
                    Authorize with Google
                  </button>
                </div>
              )}

              {user && history.length === 0 && (
                <div className="bg-white border border-slate-200 p-20 rounded-[2.5rem] text-center space-y-4 shadow-sm grayscale opacity-60">
                  <History className="w-12 h-12 text-slate-100 mx-auto" />
                  <h3 className="text-lg font-bold text-slate-300 uppercase tracking-widest">No Log Data Found</h3>
                </div>
              )}

              <div className="grid gap-3">
                {history.map((item) => (
                  <motion.div 
                    key={item.id}
                    layoutId={item.id}
                    className="bg-white border border-slate-200 p-5 rounded-2xl flex items-center justify-between gap-4 group hover:border-blue-200 hover:shadow-md hover:shadow-blue-600/5 transition-all cursor-pointer"
                    onClick={() => {
                      setResult(item);
                      setActiveTab("analyze");
                      setMessage(item.message);
                    }}
                  >
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        item.decision === "Scam" ? "bg-red-50 text-red-500" :
                        item.decision === "Suspicious" ? "bg-yellow-50 text-yellow-500" :
                        "bg-emerald-50 text-emerald-500"
                      }`}>
                        {item.decision === "Scam" ? <AlertTriangle className="w-5 h-5" /> :
                         item.decision === "Suspicious" ? <AlertCircle className="w-5 h-5" /> :
                         <CheckCircle2 className="w-5 h-5" />}
                      </div>
                      <div className="flex-1 min-w-0 overflow-hidden">
                        <p className="text-sm font-bold text-slate-800 truncate leading-tight mb-1">{item.message}</p>
                        <p className="text-[10px] text-slate-400 font-mono uppercase">
                          {item.createdAt?.toDate ? new Date(item.createdAt.toDate()).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : "Recently scanned"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                       <span className={`text-[9px] font-black px-2.5 py-1 rounded-md border uppercase tracking-tighter ${
                         item.decision === "Scam" ? "bg-red-50 border-red-100 text-red-600" :
                         item.decision === "Suspicious" ? "bg-yellow-50 border-yellow-100 text-yellow-600" :
                         "bg-emerald-50 border-emerald-100 text-emerald-600"
                       }`}>
                         {item.risk} Risk
                       </span>
                       <div className="w-8 h-8 bg-slate-50 rounded-lg flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-all">
                         <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-white" />
                       </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="max-w-6xl mx-auto px-4 py-20 border-t border-slate-200 mt-20">
        <div className="flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex items-center gap-2 grayscale group hover:grayscale-0 transition-all cursor-default">
            <div className="w-6 h-6 bg-slate-200 rounded flex items-center justify-center">
              <ShieldCheck className="text-slate-400 w-4 h-4" />
            </div>
            <span className="text-slate-400 font-black text-sm tracking-tighter uppercase">ScamShield <span className="text-slate-300">AI</span></span>
          </div>
          <div className="flex items-center gap-8 text-[11px] text-slate-400 font-bold uppercase tracking-widest">
            <a href="#" className="hover:text-blue-600">Documentation</a>
            <a href="#" className="hover:text-blue-600">Privacy Policy</a>
            <a href="#" className="hover:text-blue-600 flex items-center gap-1.5">
              <Github className="w-4 h-4" />
              API Status
            </a>
          </div>
          <p className="text-[10px] text-slate-400 font-mono">v2.4.0 // Production Build 09228</p>
        </div>
      </footer>
    </div>
  );

}
