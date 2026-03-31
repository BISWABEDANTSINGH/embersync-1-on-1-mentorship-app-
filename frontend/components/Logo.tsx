import React from "react";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2.5 select-none ${className}`}>
      {/* The Icon: Overlapping Code Brackets / Flame Concept */}
      <div className="relative flex items-center justify-center w-8 h-8">
        <svg
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full"
        >
          {/* Back Bracket (Deeper Orange/Amber) - Represents the Mentor */}
          <path
            d="M13.5 6L5.5 16L13.5 26"
            stroke="url(#mentorGradient)"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]"
          />
          {/* Front Bracket (Bright Orange) - Represents the Student */}
          <path
            d="M18.5 6L26.5 16L18.5 26"
            stroke="url(#studentGradient)"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="drop-shadow-[0_0_12px_rgba(234,88,12,0.6)]"
          />
          {/* Center Connection Line (Real-time Sync) */}
          <path
            d="M11 22L21 10"
            stroke="#ffffff"
            strokeWidth="2.5"
            strokeLinecap="round"
            className="opacity-50"
          />

          <defs>
            <linearGradient id="mentorGradient" x1="5.5" y1="6" x2="13.5" y2="26" gradientUnits="userSpaceOnUse">
              <stop stopColor="#F59E0B" /> {/* amber-500 */}
              <stop offset="1" stopColor="#D97706" /> {/* amber-600 */}
            </linearGradient>
            <linearGradient id="studentGradient" x1="18.5" y1="6" x2="26.5" y2="26" gradientUnits="userSpaceOnUse">
              <stop stopColor="#EA580C" /> {/* orange-600 */}
              <stop offset="1" stopColor="#F97316" /> {/* orange-500 */}
            </linearGradient>
          </defs>
        </svg>
      </div>

      {/* The Typography */}
      <div className="font-extrabold text-xl tracking-tight flex items-baseline">
        <span className="text-white">Ember</span>
        <span className="bg-gradient-to-r from-orange-500 to-orange-400 bg-clip-text text-transparent">
          Sync
        </span>
      </div>
    </div>
  );
}