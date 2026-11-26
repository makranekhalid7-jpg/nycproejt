import React, { useState } from 'react';
import { PlateVariant } from '../data/clubData';

interface EditorialPlateProps {
  variant: PlateVariant;
  className?: string;
  darkSurface?: boolean;
  label?: string;
}

const PHOTO_MAP: Record<PlateVariant, string> = {
  hero_editorial: '/images/featured-banner.png',
  soren: '/assets/pro_news_2.png',
  nadia: '/assets/trending_1.png',
  kaelen: '/assets/trending_3.png',
  julian: '/assets/trending_2.png',
  claire: '/assets/trending_6.png',
  mateo: '/assets/trending_4.png',
  beach: '/assets/trending_5.png',
  cover_numero: '/assets/trending_3.png',
  studio_group: '/assets/pro_news_4.png',
  campaign_warm: '/assets/pro_news_1.png',
  runway_red: '/assets/pro_news_3.png',
};

/**
 * Editorial fashion & portrait plates rendering real high-contrast monochrome
 * photography with bespoke vector chiaroscuro fallback containers.
 */
export const EditorialPlate: React.FC<EditorialPlateProps> = ({
  variant,
  className = '',
  darkSurface = false,
  label,
}) => {
  const [imgError, setImgError] = useState(false);
  const photoSrc = PHOTO_MAP[variant];
  const configs: Record<
    PlateVariant,
    {
      bg: string;
      lightBeam: string;
      silhouette: string;
      filmMark: string;
      lightText?: boolean;
    }
  > = {
    hero_editorial: {
      bg: 'from-[#d8d3cc] via-[#bfb7ad] to-[#7a736b]',
      lightBeam: 'rgba(255,248,240,0.65)',
      silhouette: '#171514',
      filmMark: 'NYC MODEL CLUB',
    },
    soren: {
      bg: 'from-neutral-200 via-neutral-300 to-neutral-500',
      lightBeam: 'rgba(255,255,255,0.65)',
      silhouette: '#111111',
      filmMark: 'TRI-X 400 · 01A',
    },
    nadia: {
      bg: 'from-neutral-100 via-neutral-200 to-neutral-400',
      lightBeam: 'rgba(255,255,255,0.85)',
      silhouette: '#0d0d0d',
      filmMark: 'ILFORD HP5 · 02B',
    },
    kaelen: {
      bg: 'from-neutral-800 via-neutral-900 to-black',
      lightBeam: 'rgba(255,255,255,0.22)',
      silhouette: '#090909',
      filmMark: 'STUDIO · 03C',
      lightText: true,
    },
    julian: {
      bg: 'from-neutral-300 via-neutral-400 to-neutral-600',
      lightBeam: 'rgba(255,255,255,0.55)',
      silhouette: '#141414',
      filmMark: 'SOHO 35MM · 04D',
    },
    claire: {
      bg: 'from-neutral-700 via-neutral-800 to-neutral-950',
      lightBeam: 'rgba(255,255,255,0.28)',
      silhouette: '#0c0c0c',
      filmMark: 'CHELSEA · 05E',
      lightText: true,
    },
    mateo: {
      bg: 'from-neutral-200 via-neutral-400 to-neutral-700',
      lightBeam: 'rgba(255,255,255,0.5)',
      silhouette: '#101010',
      filmMark: 'TRIBECA · 06F',
    },
    beach: {
      bg: 'from-neutral-100 via-neutral-300 to-neutral-500',
      lightBeam: 'rgba(255,255,255,0.9)',
      silhouette: '#111111',
      filmMark: 'DAYLIGHT · 07G',
    },
    cover_numero: {
      bg: 'from-[#c8c0b4] via-[#a79c8e] to-[#595147]',
      lightBeam: 'rgba(255,250,242,0.55)',
      silhouette: '#161311',
      filmMark: 'ISSUE 12 · NY',
    },
    studio_group: {
      bg: 'from-neutral-800 via-neutral-900 to-black',
      lightBeam: 'rgba(255,255,255,0.25)',
      silhouette: '#050505',
      filmMark: 'MANHATTAN · 08H',
      lightText: true,
    },
    campaign_warm: {
      bg: 'from-[#cfc9be] via-[#aea699] to-[#635d54]',
      lightBeam: 'rgba(255,255,255,0.5)',
      silhouette: '#181818',
      filmMark: 'BACKSTAGE · 09J',
    },
    runway_red: {
      bg: 'from-[#3a1618] via-[#220c0e] to-[#0a0405]',
      lightBeam: 'rgba(255,215,215,0.2)',
      silhouette: '#0d0607',
      filmMark: 'RUNWAY · 10K',
      lightText: true,
    },
  };

  const c = configs[variant];

  if (photoSrc && !imgError) {
    return (
      <div
        className={`relative overflow-hidden bg-neutral-900 select-none ${className}`}
        role="img"
        aria-label={label || `Editorial fashion plate ${variant}`}
      >
        <img
          src={photoSrc}
          alt={label || `Editorial fashion plate ${variant}`}
          referrerPolicy="no-referrer"
          onError={() => setImgError(true)}
          className="w-full h-full object-cover object-top"
        />
      </div>
    );
  }

  return (
    <div
      className={`relative overflow-hidden bg-gradient-to-b ${c.bg} select-none ${className}`}
      role="img"
      aria-label={label || `Editorial fashion plate ${variant}`}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(circle at 28% 22%, ${c.lightBeam} 0%, transparent 62%)`,
        }}
      />

      {variant === 'hero_editorial' ? (
        <svg viewBox="0 0 800 450" className="w-full h-full object-cover" preserveAspectRatio="xMidYMid slice">
          <rect width="800" height="450" fill="none" />
          {/* Architectural studio backdrop */}
          <rect x="0" y="0" width="290" height="450" fill="rgba(255,255,255,0.18)" />
          <line x1="290" y1="0" x2="290" y2="450" stroke="rgba(0,0,0,0.12)" strokeWidth="1" />
          {/* Off-center editorial portrait bust */}
          <ellipse cx="430" cy="145" rx="56" ry="72" fill="#2b2623" />
          <path d="M372,135 C374,72 486,70 488,135 C466,104 394,104 372,135 Z" fill="#12100f" />
          <path d="M430,74 C462,74 486,104 486,144 C486,186 462,216 430,216 Z" fill="rgba(0,0,0,0.34)" />
          <rect x="406" y="208" width="48" height="58" fill="#231f1d" />
          {/* Sculptural draped editorial gown/coat */}
          <path
            d="M270,312 C320,270 374,258 406,256 L430,322 L454,256 C486,258 545,270 595,312 L630,450 L235,450 Z"
            fill="#141210"
          />
          <polygon points="406,256 430,335 365,305" fill="rgba(255,255,255,0.15)" />
        </svg>
      ) : variant === 'studio_group' ? (
        <svg viewBox="0 0 800 450" className="w-full h-full object-cover" preserveAspectRatio="xMidYMid slice">
          {/* Loft studio cyclorama windows */}
          <rect x="80" y="40" width="140" height="210" fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.2)" />
          <rect x="245" y="40" width="140" height="210" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.18)" />
          <rect x="410" y="40" width="140" height="210" fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.2)" />
          {/* Three standing figures in studio */}
          <circle cx="260" cy="182" r="22" fill="#262626" />
          <path d="M210,224 C230,206 290,206 310,224 L322,450 L198,450 Z" fill="#0e0e0e" stroke="#2e2e2e" />
          <circle cx="400" cy="168" r="24" fill="#323232" />
          <path d="M342,212 C368,194 432,194 458,212 L472,450 L328,450 Z" fill="#171717" stroke="#3f3f46" />
          <circle cx="540" cy="186" r="21" fill="#222222" />
          <path d="M492,226 C514,210 566,210 588,226 L600,450 L480,450 Z" fill="#090909" stroke="#27272a" />
        </svg>
      ) : variant === 'cover_numero' ? (
        <svg viewBox="0 0 300 400" className="w-full h-full object-cover" preserveAspectRatio="xMidYMid slice">
          <ellipse cx="150" cy="132" rx="39" ry="50" fill="#2c2722" />
          <path d="M111,122 C112,76 188,76 189,122 C170,98 130,98 111,122 Z" fill="#14110f" />
          <rect x="134" y="176" width="32" height="44" fill="#26221e" />
          <path d="M58,242 C92,214 126,208 150,208 C174,208 208,214 242,242 L262,400 L38,400 Z" fill="#171412" />
          <text x="20" y="54" fill="rgba(255,255,255,0.6)" fontFamily="Georgia, serif" fontSize="34" fontStyle="italic">
            12
          </text>
        </svg>
      ) : variant === 'beach' ? (
        <svg viewBox="0 0 400 300" className="w-full h-full object-cover" preserveAspectRatio="xMidYMid slice">
          <rect width="400" height="210" fill="rgba(255,255,255,0.28)" />
          <rect y="210" width="400" height="90" fill="rgba(0,0,0,0.08)" />
          <line x1="0" y1="210" x2="400" y2="210" stroke="#737373" strokeWidth="1" />
          <polygon points="150,70 295,88 295,210 150,210" fill="#fafafa" stroke="#262626" strokeWidth="1.2" />
          <polygon points="150,70 220,56 295,88" fill="#e5e5e5" stroke="#262626" strokeWidth="1" />
          <rect x="200" y="108" width="42" height="102" fill="#171717" />
          <circle cx="220" cy="128" r="7" fill="#0a0a0a" />
          <path d="M214,136 L226,136 L232,192 L209,192 Z" fill="#0a0a0a" />
          <line x1="216" y1="192" x2="214" y2="210" stroke="#0a0a0a" strokeWidth="2.5" />
          <line x1="224" y1="192" x2="227" y2="210" stroke="#0a0a0a" strokeWidth="2.5" />
          <polygon points="208,210 232,210 182,250 162,250" fill="rgba(0,0,0,0.22)" />
        </svg>
      ) : variant === 'nadia' || variant === 'claire' ? (
        <svg viewBox="0 0 300 400" className="w-full h-full object-cover" preserveAspectRatio="xMidYMid slice">
          <polygon
            points="175,0 300,0 300,400 110,400"
            fill={variant === 'claire' ? 'rgba(0,0,0,0.45)' : 'rgba(0,0,0,0.08)'}
          />
          <ellipse cx="150" cy="128" rx="38" ry="49" fill={variant === 'claire' ? '#d4d4d8' : '#262626'} />
          <path
            d="M112,118 C112,76 188,76 188,118 C188,100 170,84 150,84 C130,84 112,100 112,118 Z"
            fill="#090909"
          />
          <path
            d="M150,86 C171,86 186,104 186,130 C186,156 170,176 150,176 Z"
            fill={variant === 'claire' ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.35)'}
          />
          <rect x="136" y="170" width="28" height="44" fill={variant === 'claire' ? '#a1a1aa' : '#262626'} />
          <path
            d="M54,238 C78,214 114,206 136,204 L150,256 L164,204 C186,206 222,214 246,238 L268,400 L32,400 Z"
            fill={c.silhouette}
          />
        </svg>
      ) : variant === 'kaelen' || variant === 'runway_red' ? (
        <svg viewBox="0 0 300 400" className="w-full h-full object-cover" preserveAspectRatio="xMidYMid slice">
          <polygon points="0,0 165,0 95,400 0,400" fill="rgba(255,255,255,0.06)" />
          <ellipse cx="152" cy="126" rx="37" ry="47" fill="#27272a" />
          <path d="M114,116 C115,74 188,72 190,118 C176,92 130,90 114,116 Z" fill="#050505" />
          <path d="M116,120 C116,96 132,84 148,84 L148,172 C130,170 116,150 116,120 Z" fill="rgba(255,255,255,0.24)" />
          <rect x="133" y="168" width="38" height="42" rx="4" fill="#18181b" stroke="#3f3f46" strokeWidth="1" />
          <path
            d="M64,228 C94,208 122,202 150,202 C178,202 206,208 236,228 L256,400 L44,400 Z"
            fill="#0a0a0a"
            stroke="#27272a"
            strokeWidth="1"
          />
        </svg>
      ) : (
        <svg viewBox="0 0 300 400" className="w-full h-full object-cover" preserveAspectRatio="xMidYMid slice">
          <rect x="24" y="24" width="110" height="220" fill="rgba(255,255,255,0.22)" />
          <ellipse cx="152" cy="122" rx="35" ry="46" fill="#262626" />
          <path d="M116,112 C118,74 186,74 188,112 C176,95 130,92 116,112 Z" fill="#090909" />
          <path d="M152,78 C174,78 187,98 187,124 C187,150 172,168 152,168 Z" fill="rgba(0,0,0,0.42)" />
          <rect x="135" y="162" width="34" height="38" fill="#1f1f1f" />
          <path
            d="M46,232 C76,206 112,196 135,194 L152,248 L169,194 C192,196 228,206 254,232 L274,400 L26,400 Z"
            fill="#0a0a0a"
          />
          <polygon points="122,196 146,194 148,258 112,248" fill="#171717" stroke="#404040" strokeWidth="0.8" />
          <polygon points="182,196 158,194 156,258 192,248" fill="#171717" stroke="#404040" strokeWidth="0.8" />
        </svg>
      )}

      <div className="absolute inset-0 film-grain opacity-40 pointer-events-none" />

      <div
        className={`absolute bottom-2.5 left-3 font-mono text-[10px] tracking-widest uppercase pointer-events-none ${
          darkSurface || c.lightText ? 'text-white/55' : 'text-black/45'
        }`}
      >
        {c.filmMark}
      </div>
    </div>
  );
};
