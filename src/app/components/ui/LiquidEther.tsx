import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

interface LiquidEtherProps {
  colors?: string[];
  mouseForce?: number;
  cursorSize?: number;
  isViscous?: boolean;
  viscous?: number;
  iterationsViscous?: number;
  iterationsPoisson?: number;
  resolution?: number;
  isBounce?: boolean;
  autoDemo?: boolean;
  autoSpeed?: number;
  autoIntensity?: number;
  takeoverDuration?: number;
  autoResumeDelay?: number;
  autoRampDuration?: number;
  color0?: string;
  color1?: string;
  color2?: string;
}

export default function LiquidEther({
  colors = ["#ea580c", "#fb923c", "#ffedd5"],
  color0,
  color1,
  color2,
  autoSpeed = 0.5,
  cursorSize = 100,
}: LiquidEtherProps) {
  // Use explicitly provided colors or fallback to the colors array
  const activeColors = [
    color0 || colors[0] || "#ea580c",
    color1 || colors[1] || "#fb923c",
    color2 || colors[2] || "#ffedd5",
  ];

  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setMousePos({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        });
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 w-full h-full overflow-hidden bg-black flex items-center justify-center"
      style={{
        // A sophisticated blur overlay to give it that "ether" / gooey liquid feel
        filter: "contrast(1.2) brightness(0.9)",
      }}
    >
      {/* Background ambient glow */}
      <div 
        className="absolute inset-0 opacity-40 mix-blend-screen"
        style={{
          background: `radial-gradient(circle at 50% 50%, ${activeColors[0]}33 0%, transparent 70%)`
        }}
      />

      {/* Blob 1 */}
      <motion.div
        animate={{
          x: [0, 100, -50, 0],
          y: [0, -100, 50, 0],
          scale: [1, 1.2, 0.8, 1],
        }}
        transition={{
          duration: 15 / autoSpeed,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="absolute w-[600px] h-[600px] rounded-full mix-blend-screen filter blur-[80px] opacity-60"
        style={{ backgroundColor: activeColors[0], top: "10%", left: "20%" }}
      />

      {/* Blob 2 */}
      <motion.div
        animate={{
          x: [0, -150, 100, 0],
          y: [0, 150, -100, 0],
          scale: [1, 1.5, 0.9, 1],
        }}
        transition={{
          duration: 20 / autoSpeed,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 1,
        }}
        className="absolute w-[500px] h-[500px] rounded-full mix-blend-screen filter blur-[100px] opacity-50"
        style={{ backgroundColor: activeColors[1], bottom: "10%", right: "20%" }}
      />

      {/* Blob 3 (Follows Mouse loosely to simulate mouseForce) */}
      <motion.div
        animate={{
          x: mousePos.x - cursorSize * 2,
          y: mousePos.y - cursorSize * 2,
        }}
        transition={{
          type: "spring",
          stiffness: 40,
          damping: 20,
          mass: 1,
        }}
        className="absolute rounded-full mix-blend-screen filter blur-[60px] opacity-40 pointer-events-none"
        style={{
          width: cursorSize * 4,
          height: cursorSize * 4,
          backgroundColor: activeColors[2],
        }}
      />
      
      {/* Texture overlay for professional look */}
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay"></div>
    </div>
  );
}
