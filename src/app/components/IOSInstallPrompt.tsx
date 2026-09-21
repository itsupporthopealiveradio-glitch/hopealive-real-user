import { useState, useEffect } from "react";
import { X, Share, PlusSquare } from "lucide-react";

export function IOSInstallPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    // Check if the device is iOS
    const isIos = () => {
      const userAgent = window.navigator.userAgent.toLowerCase();
      return /iphone|ipad|ipod/.test(userAgent);
    };

    // Check if the app is already in standalone mode
    const isStandalone = () => {
      // @ts-ignore - iOS specific property
      if (window.navigator.standalone) return true;
      if (window.matchMedia("(display-mode: standalone)").matches) return true;
      return false;
    };

    // If it's iOS and not standalone, and not dismissed recently, show prompt
    if (isIos() && !isStandalone()) {
      const hasDismissed = localStorage.getItem("ios_install_prompt_dismissed");
      if (!hasDismissed) {
        setShowPrompt(true);
      }
    }
  }, []);

  const dismiss = () => {
    setShowPrompt(false);
    localStorage.setItem("ios_install_prompt_dismissed", "true");
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 animate-in slide-in-from-bottom-5 fade-in duration-300">
      <div className="bg-white/95 backdrop-blur-xl dark:bg-[#1a1a1a]/95 border border-slate-200 dark:border-white/10 rounded-2xl p-4 shadow-2xl flex flex-col gap-3">
        <button 
          onClick={dismiss}
          className="absolute top-3 right-3 text-slate-400 hover:text-slate-600 dark:hover:text-white"
        >
          <X size={16} />
        </button>
        
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="App Icon" className="w-12 h-12 rounded-xl shadow-sm" />
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Install Hope Alive</h3>
            <p className="text-xs text-slate-500 dark:text-gray-400">Install this app on your home screen for a better, full-screen experience.</p>
          </div>
        </div>

        <div className="bg-slate-50 dark:bg-white/5 rounded-xl p-3 flex flex-col gap-2 mt-1 border border-slate-100 dark:border-white/5">
          <div className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
            <span className="bg-white dark:bg-[#222] shadow-sm w-6 h-6 rounded-md flex items-center justify-center font-bold">1</span>
            Tap the <Share size={14} className="text-blue-500 mx-1" /> Share button below.
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
            <span className="bg-white dark:bg-[#222] shadow-sm w-6 h-6 rounded-md flex items-center justify-center font-bold">2</span>
            Scroll down and tap <strong>Add to Home Screen</strong> <PlusSquare size={14} className="text-slate-500 mx-1" />
          </div>
        </div>
      </div>
      
      {/* Down arrow pointing to Safari's share button */}
      <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-white/95 dark:bg-[#1a1a1a]/95 border-b border-r border-slate-200 dark:border-white/10 rotate-45"></div>
    </div>
  );
}
