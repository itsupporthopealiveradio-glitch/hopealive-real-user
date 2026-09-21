import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router";
import * as faceapi from "@vladmandic/face-api";
import {
  ArrowLeft,
  Scan,
  QrCode,
  Camera,
  MapPin,
  CheckCircle,
  XCircle,
  RefreshCw,
  AlertCircle,
  ShieldCheck,
} from "lucide-react";
import { verifyLocation, formatDistance, OFFICE_LOCATION, MAX_DISTANCE_METERS } from "../../lib/geolocation";
import { supabase } from "../../lib/supabase";
import { secureStorage } from "../../lib/crypto";
import { Html5Qrcode } from "html5-qrcode";
import { parseWampTimestamp, wampClockIn } from "../../lib/wampApi";

type Tab = "faceid" | "qrcode";
type ScanState = "idle" | "scanning" | "success" | "failure";

// ⚠️ DEV MODE — set to false for production
const DEV_MODE = false;

export default function SecurityVerification() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>("faceid");

  // Location
  const [locationState, setLocationState] = useState<"idle" | "checking" | "verified" | "outside" | "error">("idle");
  const [distance, setDistance] = useState<number | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);

  // Face ID
  const [faceState, setFaceState] = useState<ScanState>("idle");
  const [enrolledDescriptor, setEnrolledDescriptor] = useState<Float32Array | null>(null);
  const [isBiometricLoading, setIsBiometricLoading] = useState(true);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [blinkDetected, setBlinkDetected] = useState(false);
  const blinkDetectedRef = useRef(false);
  const matchCountRef = useRef(0);
  const mismatchCountRef = useRef(0);
  const [livenessStatus, setLivenessStatus] = useState<"idle" | "blink-required" | "success">("idle");

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // QR
  const [qrState, setQrState] = useState<ScanState>("idle");
  const [manualQr, setManualQr] = useState("");
  const qrScannerRef = useRef<Html5Qrcode | null>(null);

  // Auth guard — redirect to login if no session
  useEffect(() => {
    async function checkAuth() {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session) {
        navigate("/");
      }
    }
    checkAuth();
  }, [navigate]);

  // Check enrollment on mount
  useEffect(() => {
    async function checkEnrollment() {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const userId = sessionData?.session?.user?.id;
        if (!userId) {
          navigate("/");
          return;
        }

        const { data: emp, error: empErr } = await supabase
          .from("employees")
          .select("id, reference_descriptor")
          .eq("auth_user_id", userId)
          .maybeSingle();

        if (empErr || !emp) {
          navigate("/face-onboarding");
          return;
        }

        let descriptorArray: number[] | null = null;
        const rawDescriptor = emp.reference_descriptor;
        if (Array.isArray(rawDescriptor)) {
          descriptorArray = rawDescriptor.map((value: unknown) => Number(value));
        } else if (typeof rawDescriptor === "string") {
          try {
            const parsed = JSON.parse(rawDescriptor);
            if (Array.isArray(parsed)) descriptorArray = parsed.map((value: unknown) => Number(value));
          } catch {
            descriptorArray = null;
          }
        }

        if (!descriptorArray || descriptorArray.length !== 128 || descriptorArray.some((value) => !Number.isFinite(value))) {
          // Not enrolled: redirect to onboarding!
          navigate("/face-onboarding");
          return;
        }

        setEnrolledDescriptor(new Float32Array(descriptorArray));
        setIsBiometricLoading(false);
      } catch (err) {
        console.error("Biometrics load error:", err);
        setIsBiometricLoading(false);
      }
    }
    checkEnrollment();
    handleVerifyLocation(DEV_MODE);
  }, [navigate]);

  // Load faceapi models if location verified
  useEffect(() => {
    async function loadModels() {
      try {
        const MODEL_URL = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.3/model/";
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        ]);
        setModelsLoaded(true);
      } catch (err) {
        console.error("Failed to load models in verify page:", err);
      }
    }
    if (locationState === "verified") {
      loadModels();
    }
  }, [locationState]);

  const handleVerifyLocation = async (isMock: boolean = false) => {
    setLocationState("checking");
    setLocationError(null);

    if (isMock) {
      setTimeout(() => {
        setDistance(12.5); // Simulate being 12.5 meters away
        setLocationState("verified");
      }, 1000);
      return;
    }

    try {
      const result = await verifyLocation();
      setDistance(result.distance);

      if (result.isWithinRange) {
        setLocationState("verified");
      } else {
        setLocationState("outside");
      }

      if (result.error) {
        setLocationError(result.error);
      }
    } catch (error) {
      setLocationState("error");
      setLocationError(error instanceof Error ? error.message : "Failed to verify location");
    }
  };

  const startCamera = async () => {
    try {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: "user" },
        audio: false,
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setFaceState("scanning");
      setLivenessStatus("idle");
      setBlinkDetected(false);
      blinkDetectedRef.current = false;
      matchCountRef.current = 0;
      mismatchCountRef.current = 0;
    } catch (err) {
      console.error("Camera error:", err);
      setFaceState("failure");
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
  };

  useEffect(() => {
    if (activeTab === "faceid" && locationState === "verified" && modelsLoaded && enrolledDescriptor) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [activeTab, locationState, modelsLoaded, enrolledDescriptor]);

  // Keep video source bound to stream
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream, faceState]);

  // Frame detection loop for face matching + liveness check
  useEffect(() => {
    if (faceState !== "scanning" || !enrolledDescriptor || !stream) return;

    let active = true;
    let detectionInterval: NodeJS.Timeout;

    function getEyeAspectRatio(eyeLandmarks: faceapi.Point[]) {
      const p0 = eyeLandmarks[0];
      const p1 = eyeLandmarks[1];
      const p2 = eyeLandmarks[2];
      const p3 = eyeLandmarks[3];
      const p4 = eyeLandmarks[4];
      const p5 = eyeLandmarks[5];

      const dist = (a: faceapi.Point, b: faceapi.Point) => Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2));

      const vertical1 = dist(p1, p5);
      const vertical2 = dist(p2, p4);
      const horizontal = dist(p0, p3);

      return (vertical1 + vertical2) / (2 * (horizontal || 1));
    }

    async function runMatching() {
      if (!videoRef.current || !canvasRef.current || !active) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;

      const displaySize = { width: video.videoWidth || 640, height: video.videoHeight || 480 };
      if (canvas.width !== displaySize.width) {
        canvas.width = displaySize.width;
        canvas.height = displaySize.height;
        faceapi.matchDimensions(canvas, displaySize);
      }

      const detection = await faceapi
        .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 }))
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detection) {
        const ctx = canvas.getContext("2d");
        ctx?.clearRect(0, 0, canvas.width, canvas.height);
        mismatchCountRef.current += 1;
        if (mismatchCountRef.current >= 8) {
          setFaceState("failure");
          setLivenessStatus("idle");
          stopCamera();
        }
        return;
      }

      const resizedDetection = faceapi.resizeResults(detection, displaySize);
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const landmarks = resizedDetection.landmarks;
        const leftEye = landmarks.getLeftEye();
        const rightEye = landmarks.getRightEye();

        // Draw gold tracking mesh points
        ctx.fillStyle = "#FEAC22";
        landmarks.positions.forEach((p) => {
          ctx.fillRect(p.x - 1.5, p.y - 1.5, 3, 3);
        });

        // Match check
        const distance = faceapi.euclideanDistance(detection.descriptor, enrolledDescriptor);
        const isMatch = distance < 0.5;

        // Liveness blink check
        const leftEar = getEyeAspectRatio(leftEye);
        const rightEar = getEyeAspectRatio(rightEye);
        const avgEar = (leftEar + rightEar) / 2;

        if (avgEar < 0.22 && isMatch) {
          setBlinkDetected(true);
          blinkDetectedRef.current = true;
        }

        if (isMatch) {
          mismatchCountRef.current = 0;
          // Two consecutive matches plus a blink balances speed with liveness.
          matchCountRef.current += 1;

          if (matchCountRef.current >= 2 && blinkDetectedRef.current) {
            setLivenessStatus("success");
            setFaceState("success");
            stopCamera();
          } else {
            setLivenessStatus("blink-required");
          }
        } else {
          // Reset consecutive match count on non-match
          matchCountRef.current = 0;
          mismatchCountRef.current += 1;
          if (mismatchCountRef.current >= 8) {
            setFaceState("failure");
            setLivenessStatus("idle");
            stopCamera();
          }
          setLivenessStatus("idle");
        }
      }
    }

    detectionInterval = setInterval(runMatching, 150);

    return () => {
      active = false;
      clearInterval(detectionInterval);
    };
  }, [faceState, enrolledDescriptor, stream]);

  // QR Scanner Effect
  useEffect(() => {
    let isMounted = true;
    
    if (activeTab === "qrcode" && locationState === "verified") {
       const startQr = async () => {
         try {
           setQrState("scanning");
           // Small delay to ensure the div is rendered
           await new Promise(resolve => setTimeout(resolve, 100));
           if (!isMounted) return;
           
           const html5QrCode = new Html5Qrcode("qr-reader");
           qrScannerRef.current = html5QrCode;
           await html5QrCode.start(
             { facingMode: "environment" },
             { fps: 10, qrbox: { width: 250, height: 250 } },
             (decodedText) => {
               if (isMounted) {
                 setManualQr(decodedText);
                 setQrState("success");
                 html5QrCode.stop().catch(console.error);
               }
             },
             () => {
               // ignore errors during scanning, they happen constantly
             }
           );
         } catch (err) {
           console.error("QR Scanner error", err);
           if (isMounted) setQrState("failure");
         }
       };
       startQr();
    } else {
       // Stop QR if running
       if (qrScannerRef.current) {
         qrScannerRef.current.stop().then(() => {
           qrScannerRef.current?.clear();
           qrScannerRef.current = null;
         }).catch(console.error);
       }
    }

    return () => {
       isMounted = false;
       if (qrScannerRef.current) {
         qrScannerRef.current.stop().catch(() => {}).finally(() => {
           qrScannerRef.current?.clear();
           qrScannerRef.current = null;
         });
       }
    };
  }, [activeTab, locationState]);

  const canProceed =
    activeTab === "faceid"
      ? locationState === "verified" && faceState === "success"
      : locationState === "verified" && (qrState === "success" || manualQr.trim().length > 6);

  useEffect(() => {
    if (canProceed) {
      const clockInTime = new Date().toISOString();
      
      // Save clock-in to Supabase attendance table
      (async () => {
        await secureStorage.setItem("isActive", "true");
        await secureStorage.setItem("clockInTime", clockInTime);
        const attendance = await wampClockIn(clockInTime);
        const persistedClockIn = attendance?.clock_in_at || attendance?.clock_in || clockInTime;
        await secureStorage.setItem("clockInTime", parseWampTimestamp(persistedClockIn).toISOString());
      })();

      const t = setTimeout(() => navigate("/confirmation?action=clockin"), 800);
      return () => clearTimeout(t);
    }
  }, [canProceed, navigate]);

  const isDarkMode = localStorage.getItem("theme") === "dark";

  if (isBiometricLoading) {
    return (
      <div className={`${isDarkMode ? "dark" : ""} min-h-screen bg-[#f0f4f8] dark:bg-[#121212] flex flex-col items-center justify-center p-4 transition-colors duration-300`}>
        <div className="w-full max-w-sm bg-white dark:bg-black/60 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-2xl p-6 shadow-2xl space-y-6 text-slate-900 dark:text-white text-center">
          <span className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto block" />
          <p className="text-sm font-semibold text-slate-600 dark:text-gray-300">Checking biometric configuration…</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`${isDarkMode ? "dark" : ""} min-h-screen bg-[#f0f4f8] dark:bg-[#121212] flex flex-col items-center transition-colors duration-300`}>
      <div className="w-full max-w-sm flex flex-col min-h-screen p-4 gap-4">

        {/* Header */}
        <div className="relative flex justify-center items-center pb-2 border-b border-slate-200 dark:border-white/5 pt-2">
          <button
            onClick={() => navigate("/dashboard")}
            className="absolute left-0 w-9 h-9 flex items-center justify-center rounded-lg hover:bg-slate-200 dark:hover:bg-white/5 transition-colors"
            aria-label="Go back"
          >
            <ArrowLeft size={20} className="text-slate-900 dark:text-white" strokeWidth={2} />
          </button>
          <div className="text-center">
            <img src="/logo.png" alt="Hope Alive Radio Logo" className="h-8 mx-auto mb-1 object-contain" />
            <h1 className="text-base font-bold text-slate-900 dark:text-white leading-tight">Verify Your Identity</h1>
            <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">Choose your verification method</p>
          </div>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 text-xs font-semibold">
          <span className={`flex items-center gap-1 ${locationState === "verified" ? "text-green-400" : "text-primary"}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${locationState === "verified" ? "bg-green-500/20 text-green-400" : "bg-primary/20 text-primary"}`}>1</span>
            Location
          </span>
          <div className="flex-1 h-px bg-white/10" />
          <span className={`flex items-center gap-1 ${locationState === "verified" ? "text-primary" : "text-gray-600"}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${locationState === "verified" ? "bg-primary/20 text-primary" : "bg-white/5 text-gray-600"}`}>2</span>
            Identity
          </span>
        </div>

        {/* Location Card */}
        <div className={`bg-black/60 backdrop-blur-xl border rounded-2xl p-4 shadow-2xl transition-all duration-300 ${locationState === "verified" ? "border-green-500/40" : "border-white/10"}`}>
          <div className="flex items-center gap-2 mb-3">
            <MapPin size={16} className={locationState === "verified" ? "text-green-400" : "text-primary"} strokeWidth={2} />
            <h3 className="text-sm font-bold text-white">Location Verification</h3>
          </div>

          {locationState === "idle" && (
            <p className="text-xs text-gray-400 mb-3">
              Detecting location...
            </p>
          )}

          {locationState === "checking" && (
            <div className="flex items-center gap-2 mb-3">
              <span className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <span className="text-xs text-gray-400">Detecting your location…</span>
            </div>
          )}

          {locationState === "verified" && (
            <div className="mb-1">
              <div className="flex items-center gap-2 text-green-400">
                <CheckCircle size={16} strokeWidth={2} />
                <span className="text-xs font-semibold">Location Verified</span>
              </div>
              {distance !== null && (
                <p className="text-xs text-gray-400 mt-1">Distance from office: {formatDistance(distance)}</p>
              )}
            </div>
          )}

          {locationState === "outside" && (
            <div className="mb-3">
              <div className="flex items-center gap-2 text-red-400 mb-1">
                <XCircle size={16} strokeWidth={2} />
                <span className="text-xs font-semibold">Outside Office Area</span>
              </div>
              {distance !== null && (
                <p className="text-xs text-gray-400 mb-1">
                  You are {formatDistance(distance)} away. Max allowed: {formatDistance(MAX_DISTANCE_METERS)}.
                </p>
              )}
            </div>
          )}

          {locationState === "error" && (
            <div className="mb-3">
              <div className="flex items-center gap-2 text-red-400 mb-1">
                <AlertCircle size={16} strokeWidth={2} />
                <span className="text-xs font-semibold">Location Error</span>
              </div>
              {locationError && <p className="text-xs text-gray-400 mb-1">{locationError}</p>}
              <p className="text-xs text-gray-500">Please enable location services and try again.</p>
            </div>
          )}

          {locationState !== "verified" && (
            <div className="flex flex-col gap-2">
              <button
                onClick={() => handleVerifyLocation(false)}
                disabled={locationState === "checking"}
                className="w-full h-11 rounded-xl border border-primary text-primary text-sm font-bold transition-all duration-200 hover:bg-primary/10 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {locationState === "checking" ? (
                  <>
                    <span className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    Detecting…
                  </>
                ) : locationState === "error" || locationState === "outside" ? (
                  <>
                    <RefreshCw size={14} strokeWidth={2} />
                    Retry Location
                  </>
                ) : (
                  <>
                    <MapPin size={14} strokeWidth={2} />
                    Verify Location
                  </>
                )}
              </button>
              

            </div>
          )}
        </div>

        {/* Identity Verification — only shown after location verified */}
        {locationState === "verified" && (
          <>
            {/* Tab Navigation */}
            <div className="flex bg-white/5 rounded-xl h-12 p-1 gap-1 border border-white/10">
              {(["faceid", "qrcode"] as Tab[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 flex items-center justify-center gap-2 rounded-lg text-sm font-bold transition-all duration-200 ${
                    activeTab === tab
                      ? "bg-primary text-black"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  {tab === "faceid" ? <Scan size={16} strokeWidth={2} /> : <QrCode size={16} strokeWidth={2} />}
                  {tab === "faceid" ? "Face ID" : "QR Code"}
                </button>
              ))}
            </div>

            {/* Face ID Tab */}
            {activeTab === "faceid" && (
              <div className="bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-2xl">
                <div className="flex items-center gap-2 mb-3">
                  <Scan size={16} className="text-primary" strokeWidth={2} />
                  <h3 className="text-sm font-bold text-white">Face ID Scan</h3>
                </div>

                {/* Camera viewport (Large Circular Design) */}
                <div className="relative w-64 h-64 rounded-full overflow-hidden border-2 border-primary/50 shadow-[0_0_20px_rgba(254,172,34,0.2)] bg-black/40 mx-auto mb-4 flex items-center justify-center">
                  {!modelsLoaded && (
                    <div className="flex flex-col items-center gap-2 text-gray-500 text-center p-4">
                      <span className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      <span className="text-xs">Loading AI biometrics…</span>
                    </div>
                  )}
                  
                  {modelsLoaded && faceState === "idle" && (
                    <div className="flex flex-col items-center gap-2 text-gray-500">
                      <Camera size={40} strokeWidth={1.5} />
                      <span className="text-xs">Camera feed starting...</span>
                    </div>
                  )}

                  {faceState === "scanning" && (
                    <div className="absolute inset-0 w-full h-full">
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="absolute inset-0 w-full h-full object-cover scale-x-[-1]"
                      />
                      <canvas
                        ref={canvasRef}
                        className="absolute inset-0 w-full h-full object-cover scale-x-[-1]"
                      />
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="w-48 h-48 border border-dashed border-white/20 rounded-full animate-pulse" />
                      </div>
                      <div
                        className="absolute left-0 right-0 h-0.5 bg-primary opacity-60 pointer-events-none"
                        style={{ animation: "scanLine 2s ease-in-out infinite", top: "50%" }}
                      />
                    </div>
                  )}

                  {faceState === "success" && (
                    <div className="flex flex-col items-center gap-2 text-green-400">
                      <CheckCircle size={40} strokeWidth={1.5} />
                      <span className="text-xs font-semibold">Biometrics Verified</span>
                    </div>
                  )}

                  {faceState === "failure" && (
                    <div className="flex flex-col items-center gap-2 text-red-400">
                      <XCircle size={40} strokeWidth={1.5} />
                      <span className="text-xs font-semibold">Face Not Recognized</span>
                    </div>
                  )}
                </div>

                <div className="text-xs text-center mb-3">
                  {faceState === "scanning" && livenessStatus === "blink-required" && (
                    <p className="text-yellow-500 font-bold animate-pulse">
                      ● Face Matched. Please BLINK to verify liveness!
                    </p>
                  )}
                  {faceState === "scanning" && livenessStatus === "idle" && (
                    <p className="text-gray-400">
                      Align your face within the screen area
                    </p>
                  )}
                  {faceState === "success" && (
                    <p className="text-green-400 font-bold">
                      Match Successful! Logging in...
                    </p>
                  )}
                </div>

                {faceState === "failure" && (
                  <button
                    onClick={startCamera}
                    className="w-full h-11 mt-2 rounded-xl border border-white/10 text-gray-400 text-xs font-semibold hover:bg-white/5 flex items-center justify-center gap-2 transition-all"
                  >
                    <RefreshCw size={12} strokeWidth={2} />
                    Retry Camera
                  </button>
                )}

                <button
                  onClick={() => setActiveTab("qrcode")}
                  className="w-full text-center text-xs text-primary mt-3 hover:underline font-semibold"
                >
                  Switch to QR Code
                </button>
              </div>
            )}

            {/* QR Code Tab */}
            {activeTab === "qrcode" && (
              <div className="bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-2xl">
                <div className="flex items-center gap-2 mb-3">
                  <QrCode size={16} className="text-primary" strokeWidth={2} />
                  <h3 className="text-sm font-bold text-white">QR Code Scanner</h3>
                </div>

                {/* Camera area */}
                <div className="relative w-full aspect-square bg-white/5 border border-white/10 rounded-xl mb-3 flex items-center justify-center overflow-hidden">
                  <div id="qr-reader" className="absolute inset-0 w-full h-full [&>video]:object-cover" style={{ display: qrState === "success" || qrState === "failure" ? "none" : "block" }} />
                  
                  {qrState === "idle" && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-gray-500 bg-black/80 z-10">
                      <QrCode size={40} strokeWidth={1.5} />
                      <span className="text-xs">Starting camera...</span>
                    </div>
                  )}
                  {qrState === "scanning" && (
                    <>
                      <div className="absolute inset-0 border-2 border-primary rounded-lg pointer-events-none z-10" />
                      <div
                        className="absolute left-0 right-0 h-0.5 bg-primary z-10"
                        style={{ animation: "scanLine 2s ease-in-out infinite", top: "50%" }}
                      />
                    </>
                  )}
                  {qrState === "success" && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-green-400 bg-black/80 z-10">
                      <CheckCircle size={40} strokeWidth={1.5} />
                      <span className="text-xs font-semibold">QR Code Valid</span>
                    </div>
                  )}
                  {qrState === "failure" && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-red-400 bg-black/80 z-10">
                      <XCircle size={40} strokeWidth={1.5} />
                      <span className="text-xs font-semibold">Camera Error</span>
                      <span className="text-[10px] text-gray-400">Could not start scanner</span>
                    </div>
                  )}
                </div>

                <p className="text-xs text-gray-400 text-center mb-3">
                  Scan the security officer's QR code
                </p>

                {qrState === "success" && (
                  <div className="flex items-center gap-2 justify-center bg-green-500/10 border border-green-500/30 rounded-xl p-2 mb-3">
                    <CheckCircle size={14} className="text-green-400" strokeWidth={2} />
                    <span className="text-xs text-green-400 font-semibold">QR Code Valid</span>
                  </div>
                )}

                {qrState !== "success" && qrState !== "scanning" && (
                  <button
                    onClick={() => {
                      setQrState("idle");
                      setActiveTab("faceid"); // toggling to reset
                      setTimeout(() => setActiveTab("qrcode"), 100);
                    }}
                    className="w-full h-12 rounded-xl bg-white/10 text-gray-400 text-sm font-bold transition-all duration-200 hover:bg-white/20 flex items-center justify-center gap-2"
                  >
                    <RefreshCw size={16} strokeWidth={2} />
                    Restart Scanner
                  </button>
                )}

                {/* Divider */}
                <div className="flex items-center gap-3 my-4">
                  <div className="flex-1 h-px bg-white/10" />
                  <span className="text-xs text-gray-500">OR</span>
                  <div className="flex-1 h-px bg-white/10" />
                </div>

                {/* Manual Entry */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-gray-400 font-medium">Manual QR Code Entry</label>
                  <input
                    type="text"
                    value={manualQr}
                    onChange={(e) => setManualQr(e.target.value)}
                    placeholder="Paste QR code value"
                    className="w-full h-11 border border-white/10 rounded-xl px-4 text-sm text-white placeholder-gray-600 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all bg-white/5"
                  />
                </div>

                {manualQr.trim().length > 6 && (
                  <button
                    onClick={async () => {
                      const clockInTime = new Date().toISOString();
                      await secureStorage.setItem("isActive", "true");
                      await secureStorage.setItem("clockInTime", clockInTime);

                      // Save clock-in to Supabase attendance table
                      try {
                        const { data: sessionData } = await supabase.auth.getSession();
                        const userId = sessionData?.session?.user?.id;
                        if (userId) {
                          const { data: emp } = await supabase
                            .from("employees")
                            .select("id")
                            .eq("auth_user_id", userId)
                            .maybeSingle();
                            
                          if (emp) {
                            await supabase.from("attendance_records").insert({
                              employee_id: emp.id,
                              clock_in_at: clockInTime,
                              status: "in_progress",
                            });
                          }
                        }
                      } catch (err) {
                        console.error("Failed to save QR attendance:", err);
                      }

                      navigate("/confirmation?action=clockin");
                    }}
                    className="w-full h-12 mt-3 rounded-xl bg-primary hover:bg-primary/95 text-black text-sm font-bold transition-all flex items-center justify-center gap-2"
                  >
                    <ShieldCheck size={16} strokeWidth={2} />
                    Verify Code
                  </button>
                )}

                <button
                  onClick={() => setActiveTab("faceid")}
                  className="w-full text-center text-xs text-primary mt-3 hover:underline font-semibold"
                >
                  Switch to Face ID
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <style>{`
        @keyframes scanLine {
          0%, 100% { transform: translateY(-60px); }
          50% { transform: translateY(60px); }
        }
      `}</style>
    </div>
  );
}
