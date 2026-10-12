import React from 'react';

interface LogoProps {
  size?: number;
  showWordmark?: boolean;
  className?: string;
  useImage?: boolean;
}

export const PurserIcon: React.FC<{ size?: number; className?: string }> = ({ size = 32, className = '' }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`purser-icon-svg ${className}`}
      aria-label="Purser emblem"
      role="img"
    >
      {/* Deep ink-navy square background */}
      <rect width="32" height="32" rx="4" fill="#0E1721" />

      {/* Subtle print texture grain overlay */}
      <rect width="32" height="32" rx="4" fill="#14212F" opacity="0.15" />

      {/* Short loop of rope at top */}
      <path
        d="M16 5.5 C14.6 5.5 13.8 6.9 13.8 8.6 L14.6 8.8 C15.1 7.6 15.6 6.8 16 6.8 C16.4 6.8 16.9 7.6 17.4 8.8 L18.2 8.6 C18.2 6.9 17.4 5.5 16 5.5 Z"
        fill="#C4973B"
      />

      {/* Ruffled collar of brass purse */}
      <path
        d="M12.4 8.8 C13.4 9.9 14.5 10.5 16 10.5 C17.5 10.5 18.6 9.9 19.6 8.8 L20.3 10.3 C18.9 11.4 17.5 11.8 16 11.8 C14.5 11.8 13.1 11.4 11.7 10.3 Z"
        fill="#A67B22"
      />

      {/* Rope cinching knot band */}
      <rect x="11.8" y="11" width="8.4" height="2.2" rx="1.1" fill="#DEB45A" stroke="#805B14" strokeWidth="0.4" />
      <line x1="14" y1="11" x2="13.7" y2="13.2" stroke="#805B14" strokeWidth="0.5" />
      <line x1="16" y1="11" x2="15.8" y2="13.2" stroke="#805B14" strokeWidth="0.5" />
      <line x1="18" y1="11" x2="17.7" y2="13.2" stroke="#805B14" strokeWidth="0.5" />

      {/* Brass coin purse body */}
      <path
        d="M12.3 12.8 C9.6 13.8 7.5 16.8 7.5 20.8 C7.5 24.3 10.5 26.5 16 26.5 C21.5 26.5 24.5 24.3 24.5 20.8 C24.5 16.8 22.4 13.8 19.7 12.8 C18.5 14 13.5 14 12.3 12.8 Z"
        fill="#C4973B"
        stroke="#805B14"
        strokeWidth="0.5"
      />

      {/* Flat architectural brass tone shadow / highlight */}
      <path
        d="M16 13.5 C18.5 14.8 22.2 17.5 22.4 20.8 C22.4 23.3 20.1 25.1 16 25.3"
        fill="none"
        stroke="#ECC875"
        strokeWidth="0.75"
        strokeLinecap="round"
      />
      <path
        d="M9.8 20.8 C9.8 17.8 11.2 15.2 12.8 13.8"
        fill="none"
        stroke="#7A5510"
        strokeWidth="0.5"
        opacity="0.6"
      />

      {/* Unbroken sealing-wax red seal on the purse */}
      <circle cx="19.6" cy="20.4" r="3.2" fill="#9E2525" stroke="#681212" strokeWidth="0.4" />
      <circle cx="19.6" cy="20.4" r="2.1" fill="none" stroke="#BD3A3A" strokeWidth="0.4" />
      <circle cx="19.6" cy="20.4" r="1.1" fill="#841919" />
    </svg>
  );
};

export const PurserWordmark: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <span className={`purser-wordmark ${className}`}>
      PURSER
    </span>
  );
};

export const Logo: React.FC<LogoProps> = ({
  size = 36,
  showWordmark = true,
  className = '',
  useImage = false,
}) => {
  return (
    <div className={`purser-brand-container ${className}`}>
      <div className="purser-icon-wrapper" style={{ width: size, height: size }}>
        {useImage ? (
          <img
            src="/purser_emblem.jpg"
            alt="Purser Icon"
            className="purser-icon-img"
            style={{ width: size, height: size, borderRadius: Math.max(3, Math.floor(size / 8)) }}
          />
        ) : (
          <PurserIcon size={size} />
        )}
      </div>
      {showWordmark && <PurserWordmark />}
    </div>
  );
};
