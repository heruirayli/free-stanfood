// Adapted from Kokonut UI's Loader (https://kokonutui.com, MIT License,
// Copyright (c) 2025 kokonutUI): counter-rotating conic-gradient rings. Trimmed
// to the light rings (this site has no dark mode) and a single size.
// Rotation stops for people who prefer reduced motion (see MotionConfig in App).
import { motion } from "motion/react";

const INK = "28, 25, 23"; // stone-900

const RINGS = [
  { from: 0, stops: `transparent 0deg, rgb(${INK}) 90deg, transparent 180deg`, band: [35, 37, 39, 41], opacity: 0.8, duration: 3, reverse: false },
  { from: 0, stops: `transparent 0deg, rgb(${INK}) 120deg, rgba(${INK}, 0.5) 240deg, transparent 360deg`, band: [42, 44, 48, 50], opacity: 0.9, duration: 2.5, reverse: false },
  { from: 180, stops: `transparent 0deg, rgba(${INK}, 0.6) 45deg, transparent 90deg`, band: [52, 54, 56, 58], opacity: 0.35, duration: 4, reverse: true },
  { from: 270, stops: `transparent 0deg, rgba(${INK}, 0.4) 20deg, transparent 40deg`, band: [61, 62, 63, 64], opacity: 0.5, duration: 3.5, reverse: false },
];

const ringMask = ([a, b, c, d]: number[]) =>
  `radial-gradient(circle at 50% 50%, transparent ${a}%, black ${b}%, black ${c}%, transparent ${d}%)`;

const Loader = ({ className = "size-14" }: { className?: string }) => (
  <motion.div
    aria-hidden="true"
    className={`relative ${className}`}
    animate={{ scale: [1, 1.02, 1] }}
    transition={{ duration: 4, repeat: Number.POSITIVE_INFINITY, ease: [0.4, 0, 0.6, 1] }}
  >
    {RINGS.map((ring) => (
      <motion.div
        key={ring.band.join()}
        className="absolute inset-0 rounded-full"
        style={{
          background: `conic-gradient(from ${ring.from}deg, ${ring.stops})`,
          mask: ringMask(ring.band),
          WebkitMask: ringMask(ring.band),
          opacity: ring.opacity,
        }}
        animate={{ rotate: ring.reverse ? [0, -360] : [0, 360] }}
        transition={{ duration: ring.duration, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
      />
    ))}
  </motion.div>
);

export default Loader;
