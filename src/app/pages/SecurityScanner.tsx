import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { CheckCircle, AlertCircle, ScanLine } from 'lucide-react';

export default function SecurityScanner() {
  const [scanStatus, setScanStatus] = useState<"idle" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  
  useEffect(() => {
    const scanner = new Html5QrcodeScanner(
      "qr-reader",
      { fps: 10, qrbox: { width: 250, height: 250 } },
      /* verbose= */ false
    );
    
    scanner.render(async (decodedText) => {
      scanner.pause(true);
      
      try {
        const { error } = await supabase
          .from('qr_sessions')
          .update({ status: 'verified' })
          .eq('id', decodedText);
          
        if (error) throw error;
        
        setScanStatus("success");
        setMessage("Worker Authorized! They can now clock in.");
        
        setTimeout(() => {
          setScanStatus("idle");
          setMessage("");
          try { scanner.resume(); } catch (e) {}
        }, 3000);
      } catch (err: any) {
        setScanStatus("error");
        setMessage(err.message || "Invalid QR Code or unauthorized.");
        setTimeout(() => {
          setScanStatus("idle");
          setMessage("");
          try { scanner.resume(); } catch (e) {}
        }, 3000);
      }
    }, (error) => {});
    
    return () => {
      scanner.clear().catch(console.error);
    };
  }, []);

  return (
    <div className="flex flex-col h-full text-slate-900 dark:text-white p-6">
      <h1 className="text-3xl font-bold mb-2">Security Scanner</h1>
      <p className="text-slate-500 mb-8">Scan worker QR codes to authorize their clock-in.</p>
      
      <div className="max-w-md w-full mx-auto bg-white dark:bg-[#1a1a1a] border border-slate-200 dark:border-white/10 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        {scanStatus === "success" && (
          <div className="absolute inset-0 bg-emerald-500/90 z-50 flex flex-col items-center justify-center text-white backdrop-blur-sm animate-in fade-in duration-300">
            <CheckCircle size={64} className="mb-4" />
            <h2 className="text-2xl font-bold">Authorized!</h2>
            <p className="text-sm font-medium mt-2">{message}</p>
          </div>
        )}
        
        {scanStatus === "error" && (
          <div className="absolute inset-0 bg-red-500/90 z-50 flex flex-col items-center justify-center text-white backdrop-blur-sm animate-in fade-in duration-300">
            <AlertCircle size={64} className="mb-4" />
            <h2 className="text-2xl font-bold">Scan Failed</h2>
            <p className="text-sm font-medium mt-2 max-w-[80%] text-center">{message}</p>
          </div>
        )}

        <div id="qr-reader" className="w-full rounded-xl overflow-hidden [&>div]:border-none [&_video]:rounded-xl min-h-[300px] flex items-center justify-center bg-slate-100 dark:bg-black/50">
        </div>
      </div>
    </div>
  );
}
