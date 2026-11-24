const fs = require('fs');
const path = require('path');

const publicDir = path.resolve(__dirname, '../public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// Gradient definitions for metallic champagne gold
const defs = `
  <defs>
    <!-- Metallic Champagne Gold Gradients -->
    <linearGradient id="goldLight" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FDF4DC" />
      <stop offset="25%" stop-color="#F0D89F" />
      <stop offset="50%" stop-color="#D6B56D" />
      <stop offset="75%" stop-color="#B8934A" />
      <stop offset="100%" stop-color="#94743D" />
    </linearGradient>

    <linearGradient id="goldShine" x1="20%" y1="0%" x2="80%" y2="100%">
      <stop offset="0%" stop-color="#F5E3B8" />
      <stop offset="35%" stop-color="#D6B56D" />
      <stop offset="70%" stop-color="#94743D" />
      <stop offset="100%" stop-color="#6E5124" />
    </linearGradient>

    <linearGradient id="goldHighlight" x1="0%" y1="100%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#94743D" />
      <stop offset="40%" stop-color="#D6B56D" />
      <stop offset="70%" stop-color="#F0D89F" />
      <stop offset="100%" stop-color="#FAF0D7" />
    </linearGradient>

    <linearGradient id="goldBevel" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#FFF3D4" stop-opacity="0.9" />
      <stop offset="100%" stop-color="#5C4217" stop-opacity="0.9" />
    </linearGradient>

    <linearGradient id="goldText" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#F5E2B5" />
      <stop offset="45%" stop-color="#D6B56D" />
      <stop offset="100%" stop-color="#94743D" />
    </linearGradient>

    <linearGradient id="ruleGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#D6B56D" stop-opacity="0" />
      <stop offset="50%" stop-color="#D6B56D" stop-opacity="0.8" />
      <stop offset="100%" stop-color="#D6B56D" stop-opacity="0" />
    </linearGradient>

    <radialGradient id="irisCore" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#050505" />
      <stop offset="100%" stop-color="#0E0E0E" />
    </radialGradient>

    <filter id="goldGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="2.5" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
  </defs>
`;

function renderEmblem(cx = 100, cy = 100, scale = 1, flat = false) {
  const grads = flat 
    ? ['#D6B56D', '#D6B56D', '#D6B56D'] 
    : ['url(#goldLight)', 'url(#goldShine)', 'url(#goldHighlight)'];
  const edgeStroke = flat ? '#090909' : '#141009';

  let out = `<g transform="translate(${cx}, ${cy}) scale(${scale})">`;
  // Background circle for aperture depth
  out += `<circle cx="0" cy="0" r="88" fill="url(#irisCore)" stroke="${flat ? '#D6B56D' : '#5C4217'}" stroke-width="${flat ? 2 : 1.5}" />`;

  // 6 blades
  for (let i = 0; i < 6; i++) {
    const angle = i * 60;
    const g = grads[i % 3];
    out += `
      <g transform="rotate(${angle})">
        <path
          d="M 85.1 -18.1 A 87 87 0 0 1 53.7 68.6 C 36 62 20 48 10.2 31.4 C 18 20 28 8 40 -2 C 55 -12 70 -16 85.1 -18.1 Z"
          fill="${g}"
          stroke="${edgeStroke}"
          stroke-width="1.2"
          stroke-linejoin="round"
        />
        ${!flat ? `<path d="M 53.7 68.6 C 36 62 20 48 10.2 31.4" stroke="url(#goldBevel)" stroke-width="1.4" fill="none" opacity="0.85" />` : ''}
      </g>
    `;
  }

  // Center Play Symbol
  const playFill = flat ? '#D6B56D' : 'url(#goldLight)';
  out += `
    <polygon
      points="-11,-16 18,0 -11,16"
      fill="${playFill}"
      stroke="${flat ? 'none' : '#3D2B10'}"
      stroke-width="${flat ? 0 : 1}"
      stroke-linejoin="round"
      filter="${flat ? '' : 'url(#goldGlow)'}"
    />
  `;
  out += `</g>`;
  return out;
}

// 1. Standalone Emblem SVG (200x200)
const emblemSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
${defs}
${renderEmblem(100, 100, 1, false)}
</svg>`;
fs.writeFileSync(path.join(publicDir, 'synctheater-emblem.svg'), emblemSvg);

// 2. Flat Monochrome Emblem (200x200)
const emblemFlatSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
${defs}
${renderEmblem(100, 100, 1, true)}
</svg>`;
fs.writeFileSync(path.join(publicDir, 'synctheater-emblem-flat.svg'), emblemFlatSvg);

// 3. Favicon SVG (64x64 simplified)
const faviconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
${defs}
${renderEmblem(32, 32, 0.34, false)}
</svg>`;
fs.writeFileSync(path.join(publicDir, 'favicon.svg'), faviconSvg);

// 4. Primary Horizontal Logo (Emblem + SYNCTHEATER + Tagline) (540 x 120)
const primaryLogoSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 540 120" width="540" height="120">
${defs}
<!-- Emblem on Left -->
${renderEmblem(60, 60, 0.58, false)}

<!-- Wordmark on Right -->
<g transform="translate(136, 68)">
  <text
    x="0"
    y="0"
    font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    font-size="34"
    font-weight="800"
    letter-spacing="0.22em"
    fill="url(#goldText)"
  >SYNCTHE<tspan font-weight="700">Λ</tspan>TER</text>
  
  <line x1="2" y1="20" x2="80" y2="20" stroke="url(#ruleGrad)" stroke-width="1" />
  <text
    x="180"
    y="23"
    text-anchor="middle"
    font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    font-size="9"
    font-weight="600"
    letter-spacing="0.32em"
    fill="#B9B9B9"
    opacity="0.9"
  >WATCH TOGETHER. ANYWHERE.</text>
  <line x1="280" y1="20" x2="358" y2="20" stroke="url(#ruleGrad)" stroke-width="1" />
</g>
</svg>`;
fs.writeFileSync(path.join(publicDir, 'synctheater-logo.svg'), primaryLogoSvg);

// 5. Stacked / Vertical Logo (Emblem Top, Wordmark Bottom) (400 x 300)
const stackedLogoSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="400" height="300">
${defs}
<!-- Emblem Centered Top -->
${renderEmblem(200, 105, 0.88, false)}

<!-- Wordmark Centered Below -->
<g transform="translate(200, 235)">
  <text
    x="0"
    y="0"
    text-anchor="middle"
    font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    font-size="30"
    font-weight="800"
    letter-spacing="0.28em"
    fill="url(#goldText)"
  >SYNCTHE<tspan font-weight="700">Λ</tspan>TER</text>

  <line x1="-150" y1="22" x2="-65" y2="22" stroke="url(#ruleGrad)" stroke-width="1.2" />
  <text
    x="0"
    y="25"
    text-anchor="middle"
    font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    font-size="9"
    font-weight="600"
    letter-spacing="0.34em"
    fill="#B9B9B9"
    opacity="0.9"
  >WATCH TOGETHER. ANYWHERE.</text>
  <line x1="65" y1="22" x2="150" y2="22" stroke="url(#ruleGrad)" stroke-width="1.2" />
</g>
</svg>`;
fs.writeFileSync(path.join(publicDir, 'synctheater-logo-stacked.svg'), stackedLogoSvg);

console.log('All 5 logo SVGs successfully generated in frontend/public/');
