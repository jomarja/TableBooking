export default function GeorgianFlag({ size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 30 20" xmlns="http://www.w3.org/2000/svg">
      {/* White background */}
      <rect width="30" height="20" fill="white" />
      {/* Red cross */}
      <rect x="12" y="0" width="6" height="20" fill="#FF0000" />
      <rect x="0" y="7" width="30" height="6" fill="#FF0000" />
      {/* Four red bolnur-katskhuri crosses in corners */}
      {/* Top-left */}
      <rect x="4.5" y="2" width="3" height="3" fill="#FF0000" />
      <rect x="5.25" y="1" width="1.5" height="5" fill="#FF0000" />
      <rect x="3.5" y="2.75" width="5" height="1.5" fill="#FF0000" />
      {/* Top-right */}
      <rect x="22.5" y="2" width="3" height="3" fill="#FF0000" />
      <rect x="23.25" y="1" width="1.5" height="5" fill="#FF0000" />
      <rect x="21.5" y="2.75" width="5" height="1.5" fill="#FF0000" />
      {/* Bottom-left */}
      <rect x="4.5" y="14.5" width="3" height="3" fill="#FF0000" />
      <rect x="5.25" y="13.5" width="1.5" height="5" fill="#FF0000" />
      <rect x="3.5" y="15.25" width="5" height="1.5" fill="#FF0000" />
      {/* Bottom-right */}
      <rect x="22.5" y="14.5" width="3" height="3" fill="#FF0000" />
      <rect x="23.25" y="13.5" width="1.5" height="5" fill="#FF0000" />
      <rect x="21.5" y="15.25" width="5" height="1.5" fill="#FF0000" />
    </svg>
  );
}
