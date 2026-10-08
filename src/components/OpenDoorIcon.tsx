import React from 'react';

interface OpenDoorIconProps {
  className?: string;
  size?: number;
}

export const OpenDoorIcon: React.FC<OpenDoorIconProps> = ({
  className = 'w-6 h-6',
  size,
}) => {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      width={size}
      height={size}
      aria-label="OpenRoom Door Icon"
    >
      <defs>
        {/* Interior welcoming glow beaming through the open doorway */}
        <linearGradient id="openDoorInteriorGlow" x1="16" y1="10" x2="36" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#38BDF8" />
          <stop offset="50%" stopColor="#6366F1" />
          <stop offset="100%" stopColor="#4F46E5" />
        </linearGradient>

        {/* Ambient light beam cast onto threshold floor */}
        <linearGradient id="openDoorFloorLight" x1="24" y1="38" x2="38" y2="45" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.75" />
          <stop offset="100%" stopColor="#6366F1" stopOpacity="0.05" />
        </linearGradient>

        {/* Outer door frame gradient */}
        <linearGradient id="openDoorFrameGrad" x1="8" y1="6" x2="40" y2="44" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#94A3B8" />
          <stop offset="100%" stopColor="#475569" />
        </linearGradient>

        {/* Swung door leaf gradient with rich 3D shading */}
        <linearGradient id="openDoorPanelGrad" x1="12" y1="10" x2="28" y2="42" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#3B82F6" />
          <stop offset="45%" stopColor="#2563EB" />
          <stop offset="100%" stopColor="#1D4ED8" />
        </linearGradient>

        {/* Door edge bevel */}
        <linearGradient id="openDoorEdgeGrad" x1="25" y1="13" x2="27" y2="41" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#60A5FA" />
          <stop offset="100%" stopColor="#1E40AF" />
        </linearGradient>
      </defs>

      {/* Light pool on the floor */}
      <polygon
        points="14,41 38,41 43,45 16,45"
        fill="url(#openDoorFloorLight)"
      />

      {/* Outer Door Frame */}
      <rect
        x="10"
        y="7"
        width="28"
        height="34"
        rx="3"
        stroke="url(#openDoorFrameGrad)"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />

      {/* Floor Threshold / Sill */}
      <line
        x1="6"
        y1="41"
        x2="42"
        y2="41"
        stroke="#94A3B8"
        strokeWidth="2.5"
        strokeLinecap="round"
      />

      {/* Glowing Room Interior behind the door */}
      <path
        d="M12.5 9.5H35.5V40H12.5V9.5Z"
        fill="url(#openDoorInteriorGlow)"
      />

      {/* Subtle interior perspective lines */}
      <line
        x1="27"
        y1="9.5"
        x2="27"
        y2="33"
        stroke="#FFFFFF"
        strokeWidth="1"
        strokeOpacity="0.3"
      />
      <line
        x1="27"
        y1="33"
        x2="35.5"
        y2="37.5"
        stroke="#FFFFFF"
        strokeWidth="1"
        strokeOpacity="0.3"
      />

      {/* Swung Open Door (hinged on left at x=12.5, angled in perspective to x=25) */}
      <polygon
        points="12.5,9.5 25,13.5 25,37.5 12.5,40"
        fill="url(#openDoorPanelGrad)"
      />

      {/* Door 3D Thickness Edge */}
      <polygon
        points="25,13.5 27,14.5 27,36.5 25,37.5"
        fill="url(#openDoorEdgeGrad)"
      />

      {/* Door upper panel detail */}
      <polygon
        points="15,14 22.5,16.2 22.5,23.2 15,22.2"
        fill="#1E3A8A"
        fillOpacity="0.4"
      />

      {/* Door lower panel detail */}
      <polygon
        points="15,25.2 22.5,26.2 22.5,34.2 15,35.8"
        fill="#1E3A8A"
        fillOpacity="0.4"
      />

      {/* Door Handle */}
      <circle
        cx="23.5"
        cy="25.5"
        r="1.6"
        fill="#FCD34D"
        stroke="#F59E0B"
        strokeWidth="0.5"
      />
    </svg>
  );
};
