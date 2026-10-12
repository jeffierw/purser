import React from 'react';

interface WaxSealProps {
  status: 'intact' | 'broken';
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  interactive?: boolean;
  onClick?: () => void;
  className?: string;
}

export const WaxSeal: React.FC<WaxSealProps> = ({
  status,
  label,
  size = 'md',
  interactive = false,
  onClick,
  className = '',
}) => {
  const isIntact = status === 'intact';

  const sizePx = size === 'sm' ? 44 : size === 'lg' ? 84 : 64;

  return (
    <div
      className={`wax-seal-wrapper ${interactive ? 'wax-seal-interactive' : ''} ${className}`}
      onClick={interactive ? onClick : undefined}
      title={label || (isIntact ? 'In Force' : 'Broken / Revoked')}
      role={interactive ? 'button' : 'img'}
      tabIndex={interactive ? 0 : undefined}
    >
      <svg
        width={sizePx}
        height={sizePx}
        viewBox="0 0 80 80"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`wax-seal-svg ${isIntact ? 'intact' : 'broken'}`}
      >
        <defs>
          <filter id="waxShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#400A0A" floodOpacity="0.4" />
          </filter>
        </defs>

        {isIntact ? (
          <g filter="url(#waxShadow)">
            {/* Irregular outer melted wax edge */}
            <path
              d="M40 5 C50 4 60 10 68 18 C76 26 77 38 74 48 C71 58 64 68 54 73 C44 78 30 77 20 71 C10 65 5 52 6 40 C7 28 14 16 24 10 C30 6 35 6 40 5 Z"
              fill="#962222"
              stroke="#751515"
              strokeWidth="1.5"
            />
            {/* Inner stamped rim */}
            <circle cx="40" cy="40" r="28" fill="#A82828" stroke="#7A1818" strokeWidth="2" />
            <circle cx="40" cy="40" r="24" fill="none" stroke="#C73E3E" strokeWidth="1" strokeDasharray="3 2" />

            {/* Embossed seal device: anchorless maritime lock & quill */}
            <circle cx="40" cy="40" r="16" fill="#8F2020" />
            <path
              d="M34 38 L40 32 L46 38 M40 32 L40 48"
              stroke="#D65656"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="40" cy="40" r="3" fill="#FFEFEF" opacity="0.8" />

            {/* Stamp text */}
            <text
              x="40"
              y="56"
              textAnchor="middle"
              fill="#E87474"
              fontSize="7.5"
              fontFamily="Cinzel, serif"
              letterSpacing="1.5"
              fontWeight="600"
            >
              IN FORCE
            </text>
          </g>
        ) : (
          <g filter="url(#waxShadow)">
            {/* Broken left fragment */}
            <path
              d="M38 6 C28 8 18 16 12 25 C6 35 6 48 11 58 C16 67 26 74 37 75 L38 52 L34 46 L39 37 L33 26 L38 18 Z"
              fill="#7A2020"
              stroke="#541212"
              strokeWidth="1.5"
            />
            {/* Broken right fragment (slightly displaced) */}
            <path
              d="M44 8 L44 19 L39 27 L45 36 L40 47 L44 53 L43 74 C55 72 65 64 71 53 C77 42 76 28 69 19 C61 10 52 6 44 8 Z"
              fill="#6B1A1A"
              stroke="#4A0F0F"
              strokeWidth="1.5"
            />
            {/* Fracture jagged line in the center */}
            <path
              d="M39 5 L43 18 L35 27 L43 38 L36 49 L42 55 L39 76"
              stroke="#F2EFE8"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <text
              x="40"
              y="44"
              textAnchor="middle"
              fill="#F2EFE8"
              fontSize="8"
              fontFamily="Cinzel, serif"
              letterSpacing="1.2"
              fontWeight="700"
              transform="rotate(-12 40 44)"
            >
              BROKEN
            </text>
          </g>
        )}
      </svg>
      {label && <span className="wax-seal-label">{label}</span>}
    </div>
  );
};
