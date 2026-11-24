import React from 'react';
import Link from 'next/link';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showTagline?: boolean;
  href?: string;
  variant?: 'metallic' | 'flat';
}

export function IrisEmblem({
  size = 'md',
  className = '',
  variant = 'metallic',
}: {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  variant?: 'metallic' | 'flat';
}) {
  const sizeMap = {
    xs: 'w-6 h-6',
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-14 h-14',
    xl: 'w-20 h-20',
  };

  const isFlat = variant === 'flat';

  return (
    <svg
      viewBox="0 0 200 200"
      className={`${sizeMap[size]} shrink-0 ${className}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="emblemGoldLight" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FDF4DC" />
          <stop offset="25%" stopColor="#F0D89F" />
          <stop offset="50%" stopColor="#D6B56D" />
          <stop offset="75%" stopColor="#B8934A" />
          <stop offset="100%" stopColor="#94743D" />
        </linearGradient>
        <linearGradient id="emblemGoldShine" x1="20%" y1="0%" x2="80%" y2="100%">
          <stop offset="0%" stopColor="#F5E3B8" />
          <stop offset="35%" stopColor="#D6B56D" />
          <stop offset="70%" stopColor="#94743D" />
          <stop offset="100%" stopColor="#6E5124" />
        </linearGradient>
        <linearGradient id="emblemGoldHighlight" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#94743D" />
          <stop offset="40%" stopColor="#D6B56D" />
          <stop offset="70%" stopColor="#F0D89F" />
          <stop offset="100%" stopColor="#FAF0D7" />
        </linearGradient>
        <linearGradient id="emblemBevel" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#FFF3D4" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#5C4217" stopOpacity="0.9" />
        </linearGradient>
        <radialGradient id="emblemIrisCore" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#050505" />
          <stop offset="100%" stopColor="#111111" />
        </radialGradient>
        <filter id="emblemPlayGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      <g transform="translate(100, 100)">
        {/* Core Depth Circle */}
        <circle
          cx="0"
          cy="0"
          r="88"
          fill="url(#emblemIrisCore)"
          stroke={isFlat ? '#D6B56D' : '#5C4217'}
          strokeWidth={isFlat ? 2 : 1.5}
        />

        {/* 6 Overlapping Metallic Aperture Blades */}
        {[0, 60, 120, 180, 240, 300].map((angle, idx) => {
          const grads = isFlat
            ? ['#D6B56D', '#D6B56D', '#D6B56D']
            : ['url(#emblemGoldLight)', 'url(#emblemGoldShine)', 'url(#emblemGoldHighlight)'];
          const g = grads[idx % 3];
          return (
            <g key={angle} transform={`rotate(${angle})`}>
              <path
                d="M 85.1 -18.1 A 87 87 0 0 1 53.7 68.6 C 36 62 20 48 10.2 31.4 C 18 20 28 8 40 -2 C 55 -12 70 -16 85.1 -18.1 Z"
                fill={g}
                stroke={isFlat ? '#090909' : '#141009'}
                strokeWidth="1.2"
                strokeLinejoin="round"
              />
              {!isFlat && (
                <path
                  d="M 53.7 68.6 C 36 62 20 48 10.2 31.4"
                  stroke="url(#emblemBevel)"
                  strokeWidth="1.4"
                  fill="none"
                  opacity="0.85"
                />
              )}
            </g>
          );
        })}

        {/* Center Triangular Play Button */}
        <polygon
          points="-11,-16 18,0 -11,16"
          fill={isFlat ? '#D6B56D' : 'url(#emblemGoldLight)'}
          stroke={isFlat ? 'none' : '#3D2B10'}
          strokeWidth={isFlat ? 0 : 1}
          strokeLinejoin="round"
          filter={isFlat ? undefined : 'url(#emblemPlayGlow)'}
        />
      </g>
    </svg>
  );
}

export function Logo({
  size = 'md',
  showTagline = false,
  className = '',
  href,
  variant = 'metallic',
}: LogoProps) {
  const content = (
    <div className={`inline-flex items-center gap-3 select-none ${className}`}>
      <IrisEmblem size={size} variant={variant} />
      <div className="flex flex-col">
        <span
          className={`font-extrabold tracking-[0.24em] uppercase bg-gradient-to-b from-[#F0D89F] via-[#D6B56D] to-[#94743D] bg-clip-text text-transparent ${
            size === 'sm'
              ? 'text-lg tracking-[0.2em]'
              : size === 'md'
              ? 'text-xl tracking-[0.24em]'
              : size === 'lg'
              ? 'text-2xl tracking-[0.26em]'
              : 'text-3xl tracking-[0.28em]'
          }`}
          style={{ fontFamily: 'inherit' }}
        >
          SYNCTHE<span className="font-bold text-[#F0D89F]">Λ</span>TER
        </span>
        {showTagline && (
          <span className="text-[9px] font-semibold tracking-[0.32em] text-[#B9B9B9] uppercase mt-0.5 opacity-90">
            Watch Together. Anywhere.
          </span>
        )}
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="group transition-opacity hover:opacity-95">
        {content}
      </Link>
    );
  }

  return content;
}

export function StackedLogo({
  className = '',
  showTagline = true,
}: {
  className?: string;
  showTagline?: boolean;
}) {
  return (
    <div className={`flex flex-col items-center text-center select-none ${className}`}>
      <IrisEmblem size="xl" className="mb-4 drop-shadow-[0_4px_24px_rgba(214,181,109,0.25)]" />
      <h1 className="text-3xl sm:text-4xl font-extrabold tracking-[0.28em] bg-gradient-to-b from-[#F0D89F] via-[#D6B56D] to-[#94743D] bg-clip-text text-transparent">
        SYNCTHE<span className="font-bold text-[#F0D89F]">Λ</span>TER
      </h1>
      {showTagline && (
        <div className="flex items-center gap-3 mt-2 w-full max-w-xs">
          <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-[#D6B56D]/60 to-transparent" />
          <span className="text-[10px] font-semibold tracking-[0.32em] text-[#B9B9B9] uppercase shrink-0">
            Watch Together. Anywhere.
          </span>
          <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-[#D6B56D]/60 to-transparent" />
        </div>
      )}
    </div>
  );
}
