import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router";
import * as faceapi from "@vladmandic/face-api";
import { supabase } from "../../lib/supabase";
import { ArrowLeft, ArrowRight, Camera, ShieldCheck, CheckCircle2, RotateCw } from "lucide-react";

import { SignaturePad } from "../components/SignaturePad";

type SetupStep = "loading" | "camera-permission" | "center" | "left" | "right" | "saving" | "signature" | "success" | "error";

export default function FaceOnboarding() {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const centerDescriptorRef = useRef<Float32Array | null>(null);
  const leftDescriptorRef = useRef<Float32Array | null>(null);
  const [step, setStep] = useState<SetupStep>("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);

  // Calibration progress
  const [centerProgress, setCenterProgress] = useState(0);
  const [leftProgress, setLeftProgress] = useState(0);
  const [rightProgress, setRightProgress] = useState(0);

  // Store final face descriptor
  const [faceDescriptor, setFaceDescriptor] = useState<Float32Array | null>(null);

  // Load models on mount
  useEffect(() => {
    async function init() {
      // Auth guard & check if already enrolled
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData?.session?.user?.id;
      if (!userId) {
        navigate("/");
        return;
      }
      
      const { data: emp } = await supabase
        .from("employees")
        .select("id, onboarding_status")
        .eq("auth_user_id", userId)
        .maybeSingle();
        
      if (emp?.onboarding_status === "enrolled") {
        navigate("/dashboard");
        return;
      }

      try {
        const MODEL_URL = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.3/model/";
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        ]);
        setModelsLoaded(true);
        setStep("camera-permission");
      } catch (err) {
        console.error(err);
        setStep("error");
        setErrorMsg("Failed to load face recognition models. Please check your internet connection.");
      }
    }
    init();

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // Request Camera
  const startCamera = async () => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: "user" },
        audio: false,
      });
      streamRef.current = mediaStream;
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setStep("center");
    } catch (err) {
      console.error(err);
      setStep("error");
      setErrorMsg("Camera access denied. Please enable camera permissions in your browser settings and try again.");
    }
  };

  useEffect(() => {
    if (step === "camera-permission" && modelsLoaded) {
      startCamera();
    }
  }, [step, modelsLoaded]);

  // Keep video source bound to stream
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream, step]);

  // Main Detection Loop
  useEffect(() => {
    if (step === "loading" || step === "camera-permission" || step === "saving" || step === "success" || step === "error") return;

    let active = true;
    let detectionInterval: NodeJS.Timeout;

    async function runDetection() {
      if (!videoRef.current || !canvasRef.current || !active) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;

      // Match canvas dimensions to video
      const displaySize = { width: video.videoWidth || 640, height: video.videoHeight || 480 };
      if (canvas.width !== displaySize.width) {
        canvas.width = displaySize.width;
        canvas.height = displaySize.height;
        faceapi.matchDimensions(canvas, displaySize);
      }

      // Detect face and landmarks
      const detection = await faceapi
        .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 }))
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detection) {
        // Clear canvas if no face
        const ctx = canvas.getContext("2d");
        ctx?.clearRect(0, 0, canvas.width, canvas.height);
        return;
      }

      // Resize details for canvas drawing
      const resizedDetection = faceapi.resizeResults(detection, displaySize);
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        // Custom elegant overlay design (draw scanning rectangle or points)
        const landmarks = resizedDetection.landmarks;
        const jaw = landmarks.getJawOutline();
        const nose = landmarks.getNose();
        
        ctx.strokeStyle = "rgba(254, 172, 34, 0.4)"; // Gold pulse overlay
        ctx.lineWidth = 2;
        ctx.beginPath();
        // Draw path around jawline
        jaw.forEach((p, idx) => {
          if (idx === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        });
        ctx.stroke();

        // Calculate rotation estimation ratio
        // Distance from nose center point to left jaw edge and right jaw edge
        const noseTip = nose[6]; // Tip of nose
        const leftJaw = jaw[0];
        const rightJaw = jaw[16];

        const distLeft = noseTip.x - leftJaw.x;
        const distRight = rightJaw.x - noseTip.x;
        const ratio = distLeft / (distRight || 1);

        if (step === "center") {
          // Look straight: ratio should be close to 1.0 (between 0.75 and 1.3)
          if (ratio >= 0.75 && ratio <= 1.3) {
            setCenterProgress((prev) => {
              const next = prev + 10;
              if (next >= 100) {
                centerDescriptorRef.current = detection.descriptor;
                setStep("left");
                return 100;
              }
              return next;
            });
          }
        } else if (step === "left") {
          // Turn left (mirrored camera means nose moves opposite way visually)
          if (ratio > 1.6) {
            setLeftProgress((prev) => {
              const next = prev + 10;
              if (next >= 100) {
                leftDescriptorRef.current = detection.descriptor;
                setStep("right");
                return 100;
              }
              return next;
            });
          }
        } else if (step === "right") {
          // Turn right
          if (ratio < 0.6) {
            setRightProgress((prev) => {
              const next = prev + 10;
              if (next >= 100) {
                // Average all 3 descriptors for a more robust biometric
                const avg = new Float32Array(128);
                const descs = [centerDescriptorRef.current!, leftDescriptorRef.current!, detection.descriptor];
                for (let i = 0; i < 128; i++) {
                  avg[i] = (descs[0][i] + descs[1][i] + descs[2][i]) / 3;
                }
                setFaceDescriptor(avg);
                setStep("saving");
                if (streamRef.current) {
                  streamRef.current.getTracks().forEach((track) => track.stop());
                  streamRef.current = null;
                }
                return 100;
              }
              return next;
            });
          }
        }
      }
    }

    detectionInterval = setInterval(runDetection, 300);

    return () => {
      active = false;
      clearInterval(detectionInterval);
    };
  }, [step]);

  // Handle saving face descriptor to Supabase
  useEffect(() => {
    if (step === "saving" && faceDescriptor) {
      async function saveBiometrics() {
        try {
          const { data: sessionData } = await supabase.auth.getSession();
          const userId = sessionData?.session?.user?.id;
          const userEmail = sessionData?.session?.user?.email;

          if (!userId) {
            setStep("error");
            setErrorMsg("User session not found. Please log in again.");
            return;
          }

          // Lookup employee record - first by auth_user_id, then fallback to email
          let emp: any = null;
          
          const { data: empById } = await supabase
            .from("employees")
            .select("id, reference_descriptor")
            .eq("auth_user_id", userId)
            .maybeSingle();
          
          if (empById) {
            emp = empById;
          } else if (userEmail) {
            // Fallback: lookup by email (handles case where admin created record before user signed up)
            const { data: empByEmail } = await supabase
              .from("employees")
              .select("id, reference_descriptor")
              .eq("email", userEmail.toLowerCase())
              .maybeSingle();
            
            if (empByEmail) {
              emp = empByEmail;
              // Auto-link the auth_user_id so future lookups are instant
              await supabase
                .from("employees")
                .update({ auth_user_id: userId })
                .eq("id", empByEmail.id);
            }
          }

          if (!emp) {
             setStep("error");
             setErrorMsg("Employee record not found. Ask admin to create one.");
             return;
          }

          if (!emp.reference_descriptor) {
             setStep("error");
             setErrorMsg("Admin has not authorized a reference photo for your account. Please contact your administrator.");
             return;
          }

          let referenceDescriptor: Float32Array | null = null;
          const raw = emp.reference_descriptor;
          if (Array.isArray(raw)) {
            referenceDescriptor = new Float32Array(raw.map((value: any) => Number(value)));
          } else if (typeof raw === 'string') {
            try {
              const parsed = JSON.parse(raw);
              referenceDescriptor = new Float32Array(Array.isArray(parsed) ? parsed.map((value: any) => Number(value)) : []);
            } catch {
              referenceDescriptor = null;
            }
          }

          if (!referenceDescriptor || referenceDescriptor.length !== 128) {
            setStep("error");
            setErrorMsg("The saved reference face is invalid or incomplete. Please ask the administrator to re-save the employee reference image.");
            return;
          }

          // Compare live Face ID to Admin's Reference Face ID
          const distance = faceapi.euclideanDistance(referenceDescriptor, faceDescriptor);
          console.log("Face match distance:", distance);
          
          // Threshold: 0.6 or lower means it's the same person
          // (photos vs live webcam naturally have more variance than two live captures)
          if (distance > 0.6) {
             setStep("error");
             setErrorMsg(`Face does not match the Admin's authorized reference photo. (Score: ${distance.toFixed(3)})`);
             return;
          }

          // Save array descriptor as JSON array
          const descriptorArray = Array.from(faceDescriptor);

          // Use secure RPC function to save biometrics (bypasses RLS safely)
          const { error } = await supabase.rpc("save_biometric_enrollment", {
            p_employee_id: emp.id,
            p_face_descriptor: descriptorArray,
          });

          if (error) {
            console.error("Biometric save error:", error);
            setStep("error");
            setErrorMsg(`Database error: ${error.message}`);
            return;
          }
          
          setStep("signature");
        } catch (err) {
          console.error(err);
          setStep("error");
          setErrorMsg(err instanceof Error ? err.message : "Failed to save biometrics to database");
        }
      }
      saveBiometrics();
    }
  }, [step, faceDescriptor]);

  return (
    <div className="min-h-screen bg-transparent flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white border border-slate-200 rounded-2xl p-6 shadow-xl space-y-6 text-slate-900 relative">
        
        {/* Header */}
        <div className="relative flex justify-center items-center pb-2 border-b border-slate-100">
          <button
            onClick={() => navigate("/")}
            className="absolute left-0 w-9 h-9 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors"
            aria-label="Go back"
          >
            <ArrowLeft size={20} className="text-slate-700" strokeWidth={2} />
          </button>
          <div className="text-center">
            <img src="/logo.png" alt="Hope Alive Radio Logo" className="h-8 mx-auto mb-1 object-contain" />
            <h1 className="text-base font-bold">Face ID Enrollment</h1>
            <p className="text-xs text-slate-500">First-time biometric setup</p>
          </div>
        </div>

        {/* Dynamic Card Area */}
        <div className="flex flex-col items-center justify-center">
          
          {step === "loading" && (
            <div className="flex flex-col items-center py-10 gap-3">
              <span className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              <span className="text-sm font-semibold text-slate-500">Loading AI biometrics engine…</span>
            </div>
          )}

          {step === "camera-permission" && (
            <div className="flex flex-col items-center py-10 text-center gap-3">
              <Camera size={44} className="text-primary animate-pulse" />
              <p className="text-sm text-slate-900 font-bold">Permission Required</p>
              <p className="text-xs text-slate-500">Please enable camera permissions to register your Face ID.</p>
              <button
                onClick={startCamera}
                className="mt-4 px-6 h-10 bg-primary hover:bg-primary/95 text-black text-xs font-bold rounded-xl transition-all"
              >
                Allow Camera
              </button>
            </div>
          )}

          {/* Active Calibration Feed */}
          {(step === "center" || step === "left" || step === "right") && (
            <div className="w-full flex flex-col items-center gap-4">
              {/* Webcam view with circular neon border */}
              <div className="relative w-64 h-64 rounded-full overflow-hidden border-2 border-primary/50 shadow-[0_0_20px_rgba(254,172,34,0.2)] bg-slate-100">
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
                
                {/* Visual Scanner Overlay */}
                <div className="absolute inset-0 border border-primary/10 rounded-full pointer-events-none" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 border border-dashed border-slate-300 rounded-full animate-pulse" />
              </div>

              {/* Visual Rotation direction Helper */}
              <div className="flex justify-center items-center h-10 w-full mt-2">
                {step === "center" && (
                  <div className="flex items-center gap-1.5 bg-green-500/10 border border-green-500/30 rounded-full px-3 py-1 text-green-400 text-xs font-bold">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                    LOOK CENTER
                  </div>
                )}
                {step === "left" && (
                  <div className="flex items-center gap-2 bg-primary/10 border border-primary/30 rounded-full px-4 py-1.5 text-primary text-xs font-bold">
                    <ArrowLeft size={14} className="animate-bounce-horizontal" />
                    TURN LEFT
                  </div>
                )}
                {step === "right" && (
                  <div className="flex items-center gap-2 bg-primary/10 border border-primary/30 rounded-full px-4 py-1.5 text-primary text-xs font-bold">
                    TURN RIGHT
                    <ArrowRight size={14} className="animate-bounce-horizontal-right" />
                  </div>
                )}
              </div>

              {/* Step indicator messages */}
              <div className="text-center space-y-1.5 mt-2">
                <span className="text-xs font-bold text-primary uppercase tracking-wider">
                  {step === "center" && "Step 1: Look Center"}
                  {step === "left" && "Step 2: Turn Left"}
                  {step === "right" && "Step 3: Turn Right"}
                </span>
                <p className="text-sm text-slate-900 font-bold">
                  {step === "center" && "Keep your face straight & aligned"}
                  {step === "left" && "Rotate your face slightly to the left"}
                  {step === "right" && "Rotate your face slightly to the right"}
                </p>
              </div>

              {/* Multi-step progress bars */}
              <div className="w-full space-y-2 mt-2">
                <div className="flex justify-between items-center text-[10px] text-slate-500 font-bold uppercase">
                  <span>Center Calibration</span>
                  <span>{centerProgress}%</span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                  <div
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${centerProgress}%` }}
                  />
                </div>

                {centerProgress >= 100 && (
                  <>
                    <div className="flex justify-between items-center text-[10px] text-slate-500 font-bold uppercase">
                      <span>Left Rotation</span>
                      <span>{leftProgress}%</span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                      <div
                        className="h-full bg-primary transition-all duration-300"
                        style={{ width: `${leftProgress}%` }}
                      />
                    </div>
                  </>
                )}

                {leftProgress >= 100 && (
                  <>
                    <div className="flex justify-between items-center text-[10px] text-slate-500 font-bold uppercase">
                      <span>Right Rotation</span>
                      <span>{rightProgress}%</span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                      <div
                        className="h-full bg-primary transition-all duration-300"
                        style={{ width: `${rightProgress}%` }}
                      />
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {step === "saving" && (
            <div className="flex flex-col items-center py-10 gap-3 text-center">
              <span className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-sm font-semibold text-slate-900">Generating biometric signature…</p>
              <p className="text-xs text-slate-500">Writing secure Face ID data to your profile...</p>
            </div>
          )}

          {step === "signature" && (
            <div className="flex flex-col items-center py-6 text-center gap-4 w-full">
              <div className="space-y-1 w-full">
                <p className="text-base font-bold text-slate-900">Digital Signature</p>
                <p className="text-xs text-slate-500">Please provide your signature for timesheets.</p>
              </div>
              <SignaturePad 
                onSave={async (signatureData) => {
                  try {
                    setStep("loading");
                    const { data: sessionData } = await supabase.auth.getSession();
                    const userId = sessionData?.session?.user?.id;
                    if (!userId) throw new Error("No user ID");

                    // Get employee ID
                    const { data: emp } = await supabase
                      .from("employees")
                      .select("id")
                      .eq("auth_user_id", userId)
                      .single();

                    if (emp) {
                      const { error } = await supabase.rpc("save_employee_signature", {
                        p_employee_id: emp.id,
                        p_signature_data: signatureData,
                      });

                      if (error) throw error;
                      setStep("success");
                    }
                  } catch (err: any) {
                    setStep("error");
                    setErrorMsg("Failed to save signature: " + err.message);
                  }
                }} 
              />
            </div>
          )}

          {step === "success" && (
            <div className="flex flex-col items-center py-6 text-center gap-4">
              <CheckCircle2 size={48} className="text-green-400 animate-bounce" />
              <div className="space-y-1">
                <p className="text-base font-bold text-slate-900">Enrollment Complete!</p>
                <p className="text-xs text-slate-500">Your Face ID is registered successfully.</p>
              </div>
              <button
                onClick={() => navigate("/verify")}
                className="w-full h-11 bg-primary hover:bg-primary/90 text-black text-sm font-bold rounded-xl transition-all shadow-md mt-4"
              >
                Proceed to Clock In
              </button>
            </div>
          )}

          {step === "error" && (
            <div className="flex flex-col items-center py-6 text-center gap-4">
              <div className="w-12 h-12 bg-red-500/10 border border-red-500/30 rounded-full flex items-center justify-center text-red-400">
                <RotateCw size={24} />
              </div>
              <div className="space-y-1">
                <p className="text-base font-bold text-slate-900">Setup Failed</p>
                <p className="text-xs text-red-400">{errorMsg}</p>
              </div>
              <button
                onClick={() => {
                  setStep("loading");
                  setErrorMsg("");
                  setCenterProgress(0);
                  setLeftProgress(0);
                  setRightProgress(0);
                  setModelsLoaded(false);
                  setTimeout(() => {
                    const MODEL_URL = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.3/model/";
                    Promise.all([
                      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
                      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
                      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
                    ]).then(() => {
                      setModelsLoaded(true);
                      setStep("camera-permission");
                    });
                  }, 500);
                }}
                className="w-full h-11 bg-primary hover:bg-primary/90 text-black text-sm font-bold rounded-xl transition-all shadow-md mt-2"
              >
                Retry Setup
              </button>
            </div>
          )}

        </div>
      </div>
      <style>{`
        @keyframes bounceHorizontal {
          0%, 100% { transform: translateX(0); }
          50% { transform: translateX(-6px); }
        }
        @keyframes bounceHorizontalRight {
          0%, 100% { transform: translateX(0); }
          50% { transform: translateX(6px); }
        }
        .animate-bounce-horizontal {
          animation: bounceHorizontal 1s ease-in-out infinite;
        }
        .animate-bounce-horizontal-right {
          animation: bounceHorizontalRight 1s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
