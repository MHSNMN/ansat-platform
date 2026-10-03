import React, { useRef, useState } from "react";
import type { PlatformId } from "../types";
import { motion, useMotionValue, useSpring, useTransform } from "motion/react";
import { ArrowLeft } from "lucide-react";

export interface PlatformCardData {
  id: PlatformId;
  label: string;
  description: string;
  icon: React.ReactNode;
  href: string;
  color: string;
  roles?: string[];
  gradient: string;
}

export function PlatformCard({
  platform,
  locked = false,
  index,
}: {
  platform: PlatformCardData;
  locked?: boolean;
  index: number;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState(false);

  // Motion values for 3D tilt
  const mouseX = useMotionValue(0.5);
  const mouseY = useMotionValue(0.5);

  const springConfig = { damping: 25, stiffness: 300, mass: 0.5 };
  const rotateX = useSpring(
    useTransform(mouseY, [0, 1], [8, -8]),
    springConfig,
  );
  const rotateY = useSpring(
    useTransform(mouseX, [0, 1], [-8, 8]),
    springConfig,
  );
  const glareX = useSpring(
    useTransform(mouseX, [0, 1], [-50, 150]),
    springConfig,
  );
  const glareY = useSpring(
    useTransform(mouseY, [0, 1], [-50, 150]),
    springConfig,
  );

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (locked || !cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    mouseX.set(x);
    mouseY.set(y);
  };

  const handleMouseEnter = () => {
    if (!locked) setHovered(true);
  };

  const handleMouseLeave = () => {
    setHovered(false);
    mouseX.set(0.5);
    mouseY.set(0.5);
  };

  const content = (
    <motion.div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.7,
        delay: index * 0.1,
        ease: [0.23, 1, 0.32, 1],
      }}
      style={{
        rotateX: hovered ? rotateX : 0,
        rotateY: hovered ? rotateY : 0,
        transformStyle: "preserve-3d",
      }}
      className={`group relative overflow-hidden rounded-[2rem] p-8 transition-colors duration-500 min-h-[280px] flex flex-col will-change-transform
        ${
          locked
            ? "bg-slate-50/80 border border-slate-200 cursor-not-allowed opacity-70"
            : "bg-white border border-slate-200/60 hover:border-transparent shadow-sm hover:shadow-2xl hover:shadow-slate-300/40 cursor-pointer"
        }
      `}
    >
      {/* Glare effect */}
      {!locked && (
        <motion.div
          style={{
            x: glareX,
            y: glareY,
            opacity: hovered ? 0.4 : 0,
          }}
          className="pointer-events-none absolute -inset-[100%] z-20 w-[200%] h-[200%] bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.8)_0%,transparent_50%)] mix-blend-overlay transition-opacity duration-500"
        />
      )}

      {/* Background Gradient Hint */}
      {!locked && (
        <div
          className={`absolute inset-0 opacity-0 group-hover:opacity-[0.04] transition-opacity duration-700 bg-gradient-to-br ${platform.gradient}`}
        />
      )}
      {!locked && (
        <div
          className={`absolute -top-32 -right-32 w-64 h-64 rounded-full blur-[80px] opacity-0 group-hover:opacity-30 transition-opacity duration-700 bg-gradient-to-br ${platform.gradient}`}
        />
      )}

      <div
        className="flex flex-col h-full relative z-10"
        style={{
          transform: hovered ? "translateZ(30px)" : "none",
          transition: "transform 0.3s ease-out",
        }}
      >
        <div className="flex items-start justify-between mb-8">
          <div
            className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-500
              ${locked ? "bg-slate-100 text-slate-400" : "group-hover:scale-110 group-hover:rotate-6"}
            `}
            style={
              !locked
                ? {
                    backgroundColor: `${platform.color}15`,
                    color: platform.color,
                  }
                : {}
            }
          >
            {platform.icon}
          </div>
          <span className="text-sm font-bold tracking-widest text-slate-300 font-mono">
            0{index + 1}
          </span>
        </div>

        <div className="mt-auto">
          <h3
            className={`text-2xl font-black mb-3 tracking-tight transition-colors duration-300 ${locked ? "text-slate-500" : "text-slate-800 group-hover:text-slate-950"}`}
          >
            {platform.label}
          </h3>
          <p className="text-slate-500 text-sm leading-relaxed mb-8 min-h-[40px] font-medium">
            {platform.description}
          </p>

          <div className="flex items-center gap-2">
            {locked ? (
              <span className="text-xs font-bold px-3 py-1.5 bg-slate-100/80 text-slate-500 rounded-lg border border-slate-200">
                تحتاج صلاحية
              </span>
            ) : (
              <div
                className="flex items-center gap-2 text-sm font-bold transition-all duration-300 group-hover:gap-3"
                style={{ color: platform.color }}
              >
                <span>دخول المنصة</span>
                <ArrowLeft
                  size={18}
                  className="transform transition-transform"
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );

  return locked ? (
    <div
      aria-disabled="true"
      className="block h-full"
      style={{ perspective: "1000px" }}
    >
      {content}
    </div>
  ) : (
    <a
      href={platform.href}
      className="block no-underline h-full"
      style={{ perspective: "1000px" }}
    >
      {content}
    </a>
  );
}
export default PlatformCard;
