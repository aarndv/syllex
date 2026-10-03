import React from "react";

interface SyllexLogoProps {
  size?: number;
  className?: string;
  showProvisionalTag?: boolean;
}

export const SyllexLogo: React.FC<SyllexLogoProps> = ({
  size = 72,
  className = "",
  showProvisionalTag = false,
}) => {
  return (
    <div className={`syllex-logo-container ${className}`} style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 120 120"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="Syllex Academic Emblem"
      >
        <defs>
          {/* Subtle Outer Frame Gradient */}
          <linearGradient id="syllexFrameGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#1e4d35" />
            <stop offset="50%" stopColor="#133323" />
            <stop offset="100%" stopColor="#0a1c12" />
          </linearGradient>

          {/* Gold Foil Accent Gradient */}
          <linearGradient id="syllexGoldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fef3c7" />
            <stop offset="25%" stopColor="#f59e0b" />
            <stop offset="70%" stopColor="#d97706" />
            <stop offset="100%" stopColor="#92400e" />
          </linearGradient>

          {/* Parchment Page Gradient */}
          <linearGradient id="syllexParchmentGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#f5eedc" />
          </linearGradient>

          {/* Inner Shield Glow */}
          <radialGradient id="syllexInnerGlow" cx="50%" cy="40%" r="60%">
            <stop offset="0%" stopColor="#2d6a4f" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#133323" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Outer Academic Shield / Seal */}
        <rect
          x="6"
          y="6"
          width="108"
          height="108"
          rx="24"
          fill="url(#syllexFrameGrad)"
          stroke="url(#syllexGoldGrad)"
          strokeWidth="2.5"
        />

        {/* Inner Decorative Inset Border */}
        <rect
          x="12"
          y="12"
          width="96"
          height="96"
          rx="18"
          fill="url(#syllexInnerGlow)"
          stroke="url(#syllexGoldGrad)"
          strokeWidth="1"
          strokeDasharray="3 3"
          strokeOpacity="0.65"
        />

        {/* Corner Academic Dots */}
        <circle cx="20" cy="20" r="1.5" fill="#f59e0b" />
        <circle cx="100" cy="20" r="1.5" fill="#f59e0b" />
        <circle cx="20" cy="100" r="1.5" fill="#f59e0b" />
        <circle cx="100" cy="100" r="1.5" fill="#f59e0b" />

        {/* Central Open Codex / Book Base */}
        {/* Left Page */}
        <path
          d="M60 48 C50 43, 34 44, 28 47 C26.5 47.7 26 49.2 26 51 L26 81 C34 77, 48 77, 60 82 Z"
          fill="url(#syllexParchmentGrad)"
          stroke="#1b3627"
          strokeWidth="1.2"
        />
        {/* Left Page Ribbons / Text Lines */}
        <path
          d="M32 55 C38 53, 48 53, 54 56 M32 63 C38 61, 48 61, 54 64 M32 71 C38 69, 48 69, 54 72"
          stroke="#4b5563"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeOpacity="0.6"
        />

        {/* Right Page */}
        <path
          d="M60 48 C70 43, 86 44, 92 47 C93.5 47.7 94 49.2 94 51 L94 81 C86 77, 72 77, 60 82 Z"
          fill="url(#syllexParchmentGrad)"
          stroke="#1b3627"
          strokeWidth="1.2"
        />
        {/* Right Page Ribbons / Text Lines */}
        <path
          d="M66 56 C72 53, 82 53, 88 55 M66 64 C72 61, 82 61, 88 63 M66 72 C72 69, 82 69, 88 71"
          stroke="#4b5563"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeOpacity="0.6"
        />

        {/* Codex Spine & Center Rib */}
        <path
          d="M60 46 L60 84"
          stroke="url(#syllexGoldGrad)"
          strokeWidth="2.5"
          strokeLinecap="round"
        />

        {/* Stylized Ascending Quill / Crest Star of Knowledge */}
        {/* Central North Star / Illumination */}
        <path
          d="M60 22 L62.5 31 L71 33.5 L62.5 36 L60 44.5 L57.5 36 L49 33.5 L57.5 31 Z"
          fill="url(#syllexGoldGrad)"
        />

        {/* Laurel Foliage Left */}
        <path
          d="M38 34 C36 30, 42 27, 44 31 C46 34, 40 37, 38 34 Z"
          fill="url(#syllexGoldGrad)"
          opacity="0.85"
        />
        {/* Laurel Foliage Right */}
        <path
          d="M82 34 C84 30, 78 27, 76 31 C74 34, 80 37, 82 34 Z"
          fill="url(#syllexGoldGrad)"
          opacity="0.85"
        />

        {/* Small Golden Footing Pedestal */}
        <path
          d="M48 88 L72 88 M44 92 L76 92"
          stroke="url(#syllexGoldGrad)"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
      {showProvisionalTag && (
        <span className="provisional-logo-badge" title="Temporary visual placeholder">
          Provisional
        </span>
      )}
    </div>
  );
};
