export default function SplashScreen({
  isVisible,
  message = 'INITIALIZING APEXFIT • SYNCING GOOGLE SHEETS',
}) {
  if (!isVisible) return null;

  return (
    <div
      className="splash-screen-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="ApexFit Loading Screen"
    >
      <div className="splash-screen-inner">
        {/* Soft electric cyan ambient backdrop */}
        <div className="splash-ambient-glow" aria-hidden="true" />

        {/* Central Logo & Live Loading Indicator */}
        <div className="splash-content-wrap">
          <div className="splash-logo-container">
            <img
              src="/apexfit-icon-only.png"
              alt="ApexFit Insignia"
              className="splash-barbell-logo"
            />
          </div>

          <h1 className="splash-brand-title">ApexFit</h1>

          {/* Spinning Olympic 45LB Weight Plate */}
          <div className="splash-spinner-display-zone">
            <div className="splash-plate-spinner-wrap" aria-label="Loading: Spinning Olympic 45LB Weight Plate">
              <div className="splash-plate-specular" aria-hidden="true" />
              <svg
                className="splash-plate-spinner-svg"
                viewBox="0 0 100 100"
                aria-hidden="true"
              >
                <defs>
                  {/* Dark cast-iron / calibrated competition plate body gradient */}
                  <radialGradient id="plateBodyGrad" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#10141c" />
                    <stop offset="60%" stopColor="#151b24" />
                    <stop offset="85%" stopColor="#1c2431" />
                    <stop offset="96%" stopColor="#111620" />
                    <stop offset="100%" stopColor="#00d8ff" stopOpacity="0.8" />
                  </radialGradient>

                  {/* Precision-machined stainless steel Olympic collar gradient */}
                  <linearGradient id="olympicCollarGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#f1f5f9" />
                    <stop offset="25%" stopColor="#94a3b8" />
                    <stop offset="50%" stopColor="#ffffff" />
                    <stop offset="75%" stopColor="#64748b" />
                    <stop offset="100%" stopColor="#cbd5e1" />
                  </linearGradient>

                  <radialGradient id="plateCenterRecess" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#0d1117" />
                    <stop offset="82%" stopColor="#131822" />
                    <stop offset="100%" stopColor="#1e2736" />
                  </radialGradient>

                  <filter id="plateGlow" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="0" dy="0" stdDeviation="3.5" floodColor="#00d8ff" floodOpacity="0.45" />
                  </filter>

                  {/* Circular arcs for curved plate markings */}
                  <path id="plateTextArcTop" d="M 21 50 A 29 29 0 0 1 79 50" fill="none" />
                  <path id="plateTextArcBottom" d="M 79 50 A 29 29 0 0 1 21 50" fill="none" />
                </defs>

                {/* Outer Rim Lip (Thick Olympic Plate Flange) */}
                <circle
                  cx="50"
                  cy="50"
                  r="47.5"
                  fill="url(#plateBodyGrad)"
                  stroke="#00d8ff"
                  strokeWidth="1.6"
                  filter="url(#plateGlow)"
                />

                {/* Outer Flange Stepped Chamfer Ridges */}
                <circle cx="50" cy="50" r="44" fill="none" stroke="#2d3748" strokeWidth="1.8" />
                <circle cx="50" cy="50" r="41" fill="none" stroke="#0a0e14" strokeWidth="1.2" />

                {/* Recessed Plate Face */}
                <circle cx="50" cy="50" r="38.5" fill="url(#plateCenterRecess)" stroke="#1a2230" strokeWidth="1" />

                {/* Concentric Calibration Grooves */}
                <circle cx="50" cy="50" r="35.5" fill="none" stroke="#00d8ff" strokeOpacity="0.25" strokeWidth="0.7" />
                <circle cx="50" cy="50" r="19" fill="none" stroke="#242e3f" strokeWidth="1.2" />

                {/* Top Arched Brand Text: "APEXFIT" */}
                <text
                  fontSize="6.2"
                  fontWeight="900"
                  letterSpacing="1.4"
                  fill="#00d8ff"
                  fontFamily="var(--font-sans), system-ui, sans-serif"
                >
                  <textPath href="#plateTextArcTop" startOffset="50%" textAnchor="middle">
                    APEXFIT
                  </textPath>
                </text>

                {/* Bottom Arched Metric Equivalent: "20.4 KG" */}
                <text
                  fontSize="5"
                  fontWeight="800"
                  letterSpacing="1.2"
                  fill="#94a3b8"
                  fontFamily="var(--font-sans), system-ui, sans-serif"
                >
                  <textPath href="#plateTextArcBottom" startOffset="50%" textAnchor="middle">
                    20.4 KG
                  </textPath>
                </text>

                {/* Prominent Left & Right Weight Numbers: Bold "45" & "LB" */}
                <text
                  x="25"
                  y="52"
                  fontSize="9.5"
                  fontWeight="900"
                  fill="#ffffff"
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontFamily="var(--font-sans), system-ui, sans-serif"
                  letterSpacing="-0.5"
                >
                  45
                </text>

                <text
                  x="75"
                  y="52"
                  fontSize="7.8"
                  fontWeight="900"
                  fill="#ffffff"
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontFamily="var(--font-sans), system-ui, sans-serif"
                  letterSpacing="0.5"
                >
                  LB
                </text>

                {/* Precision-Machined Olympic Barbell Stainless Steel Collar Insert (Smooth steel ring, NO bolts) */}
                <circle
                  cx="50"
                  cy="50"
                  r="14"
                  fill="url(#olympicCollarGrad)"
                  stroke="#f8fafc"
                  strokeWidth="0.8"
                />

                {/* Inner Steel Machined Bushing Lip */}
                <circle
                  cx="50"
                  cy="50"
                  r="12"
                  fill="none"
                  stroke="#64748b"
                  strokeWidth="0.8"
                />

                {/* 2-Inch Olympic Barbell Sleeve Center Bore Hole */}
                <circle
                  cx="50"
                  cy="50"
                  r="8"
                  fill="#080b0f"
                  stroke="#334155"
                  strokeWidth="1.2"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="6.8"
                  fill="#000000"
                />
              </svg>
            </div>
          </div>
        </div>

        {/* Bottom Status Dock */}
        <div className="splash-screen-dock">
          <div className="splash-screen-status">
            <span className="splash-spinner-dot"></span>
            <span>{message}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
