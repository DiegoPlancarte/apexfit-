import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Buffer } from 'node:buffer';
import process from 'node:process';
import { PNG } from 'pngjs';
import jpeg from 'jpeg-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const publicDir = path.resolve(projectRoot, 'public');

// Colors
const COLOR_CYAN = { r: 0, g: 216, b: 255 }; // #00d8ff Electric cyan
const COLOR_CYAN_LIGHT = { r: 56, g: 235, b: 255 };
const COLOR_CYAN_DEEP = { r: 0, g: 180, b: 225 };
const COLOR_WHITE = { r: 255, g: 255, b: 255 };
const COLOR_BG_ICON = { r: 18, g: 22, b: 28 }; // #12161c
const COLOR_BG_SPLASH = { r: 11, g: 15, b: 21 }; // #0b0f15

// Helper: clamp
const clamp = (val, min = 0, max = 255) => Math.max(min, Math.min(max, val));

// Bilinear sampling of source PNG image
function sampleSource(srcPng, u, v) {
  if (u < 0 || u >= srcPng.width - 1 || v < 0 || v >= srcPng.height - 1) {
    if (u >= -0.5 && u < srcPng.width && v >= -0.5 && v < srcPng.height) {
      const cx = clamp(Math.round(u), 0, srcPng.width - 1);
      const cy = clamp(Math.round(v), 0, srcPng.height - 1);
      const idx = (cy * srcPng.width + cx) * 4;
      return {
        r: srcPng.data[idx],
        g: srcPng.data[idx + 1],
        b: srcPng.data[idx + 2],
        a: srcPng.data[idx + 3],
      };
    }
    return { r: 0, g: 0, b: 0, a: 0 };
  }

  const x1 = Math.floor(u);
  const y1 = Math.floor(v);
  const x2 = x1 + 1;
  const y2 = y1 + 1;
  const fx = u - x1;
  const fy = v - y1;

  const idx11 = (y1 * srcPng.width + x1) * 4;
  const idx21 = (y1 * srcPng.width + x2) * 4;
  const idx12 = (y2 * srcPng.width + x1) * 4;
  const idx22 = (y2 * srcPng.width + x2) * 4;

  const a1 = srcPng.data[idx11 + 3];
  const a2 = srcPng.data[idx21 + 3];
  const a3 = srcPng.data[idx12 + 3];
  const a4 = srcPng.data[idx22 + 3];

  const a = (1 - fx) * (1 - fy) * a1 + fx * (1 - fy) * a2 + (1 - fx) * fy * a3 + fx * fy * a4;

  // Weighted color
  const r = (1 - fx) * (1 - fy) * srcPng.data[idx11] +
            fx * (1 - fy) * srcPng.data[idx21] +
            (1 - fx) * fy * srcPng.data[idx12] +
            fx * fy * srcPng.data[idx22];

  const g = (1 - fx) * (1 - fy) * srcPng.data[idx11 + 1] +
            fx * (1 - fy) * srcPng.data[idx21 + 1] +
            (1 - fx) * fy * srcPng.data[idx12 + 1] +
            fx * fy * srcPng.data[idx22 + 1];

  const b = (1 - fx) * (1 - fy) * srcPng.data[idx11 + 2] +
            fx * (1 - fy) * srcPng.data[idx21 + 2] +
            (1 - fx) * fy * srcPng.data[idx12 + 2] +
            fx * fy * srcPng.data[idx22 + 2];

  return { r, g, b, a };
}

// Alpha blend pixel onto target canvas
function blendPixel(targetPng, x, y, r, g, b, alphaFrac) {
  if (x < 0 || x >= targetPng.width || y < 0 || y >= targetPng.height || alphaFrac <= 0.001) {
    return;
  }
  const idx = (y * targetPng.width + x) * 4;
  const bgR = targetPng.data[idx];
  const bgG = targetPng.data[idx + 1];
  const bgB = targetPng.data[idx + 2];
  const bgA = targetPng.data[idx + 3] / 255;

  const outA = alphaFrac + bgA * (1 - alphaFrac);
  if (outA <= 0.001) return;

  const outR = (r * alphaFrac + bgR * bgA * (1 - alphaFrac)) / outA;
  const outG = (g * alphaFrac + bgG * bgA * (1 - alphaFrac)) / outA;
  const outB = (b * alphaFrac + bgB * bgA * (1 - alphaFrac)) / outA;

  targetPng.data[idx] = clamp(Math.round(outR));
  targetPng.data[idx + 1] = clamp(Math.round(outG));
  targetPng.data[idx + 2] = clamp(Math.round(outB));
  targetPng.data[idx + 3] = clamp(Math.round(outA * 255));
}

// Render scaled element with recoloring
function drawSubImage(targetPng, srcPng, srcBox, dstBox, recolorType = 'cyan', glow = false) {
  const { minX: sMinX, minY: sMinY, w: sW, h: sH } = srcBox;
  const { x: dX, y: dY, w: dW, h: dH } = dstBox;

  // Optional glow pass
  if (glow) {
    const glowRadius = Math.max(3, Math.round(dW * 0.025));
    for (let gy = -glowRadius; gy <= glowRadius; gy += 2) {
      for (let gx = -glowRadius; gx <= glowRadius; gx += 2) {
        const dist = Math.sqrt(gx * gx + gy * gy);
        if (dist > glowRadius) continue;
        const glowFactor = (1 - dist / glowRadius) * 0.09;

        for (let py = 0; py < dH; py += 2) {
          const v = sMinY + (py / dH) * sH;
          for (let px = 0; px < dW; px += 2) {
            const u = sMinX + (px / dW) * sW;
            const sample = sampleSource(srcPng, u, v);
            if (sample.a > 10) {
              const aFrac = (sample.a / 255) * glowFactor;
              blendPixel(targetPng, Math.round(dX + px + gx), Math.round(dY + py + gy), COLOR_CYAN.r, COLOR_CYAN.g, COLOR_CYAN.b, aFrac);
            }
          }
        }
      }
    }
  }

  // Sharp rendering pass
  for (let py = 0; py < dH; py++) {
    const targetY = Math.round(dY + py);
    const v = sMinY + ((py + 0.5) / dH) * sH;

    for (let px = 0; px < dW; px++) {
      const targetX = Math.round(dX + px);
      const u = sMinX + ((px + 0.5) / dW) * sW;

      const sample = sampleSource(srcPng, u, v);
      if (sample.a <= 2) continue;

      const alphaFrac = sample.a / 255;
      let r, g, b;

      if (recolorType === 'cyan') {
        // Vertical gradient for electric cyan
        const vertRatio = py / dH;
        r = COLOR_CYAN_LIGHT.r * (1 - vertRatio) + COLOR_CYAN_DEEP.r * vertRatio;
        g = COLOR_CYAN_LIGHT.g * (1 - vertRatio) + COLOR_CYAN_DEEP.g * vertRatio;
        b = COLOR_CYAN_LIGHT.b * (1 - vertRatio) + COLOR_CYAN_DEEP.b * vertRatio;
      } else if (recolorType === 'white') {
        r = COLOR_WHITE.r;
        g = COLOR_WHITE.g;
        b = COLOR_WHITE.b;
      } else {
        r = sample.r;
        g = sample.g;
        b = sample.b;
      }

      blendPixel(targetPng, targetX, targetY, r, g, b, alphaFrac);
    }
  }
}

// Draw a smooth squircle/rounded rectangle container with border and subtle radial gradient
function drawSquircleContainer(targetPng, width, height, cornerRadius) {
  const cx = width / 2;
  const cy = height / 2;
  const hw = cx - 18; // Margin
  const hh = cy - 18;
  const r = cornerRadius;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dx = Math.abs(x - cx);
      const dy = Math.abs(y - cy);

      // Signed distance to rounded rectangle
      const qx = dx - (hw - r);
      const qy = dy - (hh - r);

      let dist;
      if (qx > 0 && qy > 0) {
        dist = Math.sqrt(qx * qx + qy * qy) - r;
      } else {
        dist = Math.max(qx, qy) - r;
      }

      // Smooth anti-aliased edge
      const edge = clamp(0.5 - dist);
      if (edge <= 0.001) continue;

      // Subtle radial highlight
      const distFromCenter = Math.sqrt(Math.pow(x - cx, 2) + Math.pow(y - cy, 2)) / Math.sqrt(hw * hw + hh * hh);
      const gradR = clamp(Math.round(24 * (1 - distFromCenter * 0.45) + COLOR_BG_ICON.r * distFromCenter * 0.45));
      const gradG = clamp(Math.round(30 * (1 - distFromCenter * 0.45) + COLOR_BG_ICON.g * distFromCenter * 0.45));
      const gradB = clamp(Math.round(38 * (1 - distFromCenter * 0.45) + COLOR_BG_ICON.b * distFromCenter * 0.45));

      // Subtle inner border (1.5px stroke at dist ~= -1)
      let finalR = gradR;
      let finalG = gradG;
      let finalB = gradB;

      if (dist >= -2.0 && dist <= 0) {
        const borderAlpha = (1 - Math.abs(dist + 1)) * 0.35;
        finalR = Math.round(finalR * (1 - borderAlpha) + 120 * borderAlpha);
        finalG = Math.round(finalG * (1 - borderAlpha) + 180 * borderAlpha);
        finalB = Math.round(finalB * (1 - borderAlpha) + 240 * borderAlpha);
      }

      blendPixel(targetPng, x, y, finalR, finalG, finalB, edge);
    }
  }
}

// Draw minimalist circular loading spinner
function drawCircularSpinner(targetPng, centerX, centerY, outerR, innerR) {
  const meanR = (outerR + innerR) / 2;
  const halfThickness = (outerR - innerR) / 2;
  const maxSearchR = Math.ceil(outerR + 12);

  // Active arc sweep: from angle -120 deg to +150 deg (270 degree sweep)
  const arcSweepDeg = 260;
  const arcHeadDeg = 140; // head position
  const arcTailDeg = arcHeadDeg - arcSweepDeg; // tail position

  const toRad = (deg) => (deg * Math.PI) / 180;
  const radHead = toRad(arcHeadDeg);
  const radTail = toRad(arcTailDeg);

  const headX = centerX + meanR * Math.cos(radHead);
  const headY = centerY + meanR * Math.sin(radHead);
  const tailX = centerX + meanR * Math.cos(radTail);
  const tailY = centerY + meanR * Math.sin(radTail);

  for (let y = centerY - maxSearchR; y <= centerY + maxSearchR; y++) {
    for (let x = centerX - maxSearchR; x <= centerX + maxSearchR; x++) {
      const dx = x - centerX;
      const dy = y - centerY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Distance from circle centerline
      const distFromCenterline = Math.abs(dist - meanR);

      // 1. Inactive background track (complete 360 ring)
      if (distFromCenterline <= halfThickness + 1.2) {
        const trackEdge = clamp(0.5 - (distFromCenterline - halfThickness));
        if (trackEdge > 0) {
          blendPixel(targetPng, x, y, COLOR_CYAN.r, COLOR_CYAN.g, COLOR_CYAN.b, trackEdge * 0.16);
        }
      }

      // 2. Active loading arc
      // Calculate angle in normalized [0, 2*PI] or relative to arc
      let angle = Math.atan2(dy, dx); // [-PI, PI]
      let angleDeg = (angle * 180) / Math.PI;

      // Normalize angle relative to arcTailDeg
      let relDeg = ((angleDeg - arcTailDeg) % 360 + 360) % 360;

      let inArc = relDeg <= arcSweepDeg;
      let arcDist = distFromCenterline - halfThickness;

      // Check distance to rounded end caps
      const distHead = Math.sqrt(Math.pow(x - headX, 2) + Math.pow(y - headY, 2)) - halfThickness;
      const distTail = Math.sqrt(Math.pow(x - tailX, 2) + Math.pow(y - tailY, 2)) - halfThickness;

      let effectiveDist = inArc ? arcDist : Math.min(distHead, distTail);
      if (!inArc) {
        effectiveDist = Math.min(distHead, distTail);
      }

      const arcEdge = clamp(0.5 - effectiveDist);
      if (arcEdge > 0.01) {
        // Gradient progress along the arc: 0 at tail, 1 at head
        let progress;
        if (inArc) {
          progress = relDeg / arcSweepDeg;
        } else if (distHead < distTail) {
          progress = 1;
        } else {
          progress = 0.05;
        }

        // Taper opacity and brightness from tail to head
        const intensity = 0.25 + 0.75 * Math.pow(progress, 1.4);
        const r = clamp(Math.round(COLOR_CYAN.r * intensity + 20 * (1 - intensity)));
        const g = clamp(Math.round(COLOR_CYAN.g * intensity + 120 * (1 - intensity)));
        const b = clamp(Math.round(COLOR_CYAN.b * intensity + 160 * (1 - intensity)));

        blendPixel(targetPng, x, y, r, g, b, arcEdge * intensity);
      }

      // Subtle glow around active head
      const glowDistHead = Math.sqrt(Math.pow(x - headX, 2) + Math.pow(y - headY, 2));
      if (glowDistHead <= halfThickness + 14) {
        const glowFactor = (1 - glowDistHead / (halfThickness + 14)) * 0.22;
        blendPixel(targetPng, x, y, COLOR_CYAN.r, COLOR_CYAN.g, COLOR_CYAN.b, glowFactor);
      }
    }
  }
}

// Main generation function
async function generateBrandingAssets() {
  console.log('Generating production branding assets for ApexFit...');

  const srcPath = path.resolve(publicDir, 'apexfit-logo.png');
  const srcRaw = fs.readFileSync(srcPath);
  const srcPng = PNG.sync.read(srcRaw);

  const iconBox = { minX: 16, minY: 16, w: 496, h: 296 };
  const textBox = { minX: 73, minY: 334, w: 385, h: 97 };

  // =========================================================================
  // 1. App Icon (Square 512x512px, Rounded-Corner Container #12161c)
  // =========================================================================
  console.log('1. Rendering App Icon (512x512px)...');
  const appIcon = new PNG({ width: 512, height: 512 });
  // Fill fully transparent
  appIcon.data.fill(0);

  // Draw smooth rounded-corner squircle container
  drawSquircleContainer(appIcon, 512, 512, 104);

  // Logo sizing inside App Icon
  // Icon target: width ~320px, height ~191px (preserves 496:296 aspect ratio)
  const appIcon_iconW = 320;
  const appIcon_iconH = Math.round((appIcon_iconW * iconBox.h) / iconBox.w); // 191px
  const appIcon_iconX = Math.round((512 - appIcon_iconW) / 2); // 96
  const appIcon_iconY = 118;

  // Text target: width ~240px, height ~60px
  const appIcon_textW = 240;
  const appIcon_textH = Math.round((appIcon_textW * textBox.h) / textBox.w); // 60px
  const appIcon_textX = Math.round((512 - appIcon_textW) / 2); // 136
  const appIcon_textY = appIcon_iconY + appIcon_iconH + 24; // 333

  // Draw Barbell-A in Electric Cyan (#00d8ff) with subtle glow
  drawSubImage(appIcon, srcPng, iconBox, { x: appIcon_iconX, y: appIcon_iconY, w: appIcon_iconW, h: appIcon_iconH }, 'cyan', true);

  // Draw "ApexFit" Text in Crisp White (#ffffff)
  drawSubImage(appIcon, srcPng, textBox, { x: appIcon_textX, y: appIcon_textY, w: appIcon_textW, h: appIcon_textH }, 'white', false);

  const appIconBuffer = PNG.sync.write(appIcon);
  fs.writeFileSync(path.resolve(publicDir, 'apexfit-app-icon.png'), appIconBuffer);
  fs.writeFileSync(path.resolve(publicDir, 'icon-512.png'), appIconBuffer);
  console.log('   Saved public/apexfit-app-icon.png & public/icon-512.png');

  // =========================================================================
  // 2. Logo Without Text (Icon-Only Asset, Transparent)
  // =========================================================================
  console.log('2. Rendering Logo Without Text (Icon-Only Asset, 512x512px)...');
  const iconOnly = new PNG({ width: 512, height: 512 });
  iconOnly.data.fill(0); // Transparent

  // Scale Barbell-A to occupy prominent centered area
  const ioW = 460;
  const ioH = Math.round((ioW * iconBox.h) / iconBox.w); // 275px
  const ioX = Math.round((512 - ioW) / 2); // 26
  const ioY = Math.round((512 - ioH) / 2); // 118.5 -> 119

  drawSubImage(iconOnly, srcPng, iconBox, { x: ioX, y: ioY, w: ioW, h: ioH }, 'cyan', true);

  const iconOnlyBuffer = PNG.sync.write(iconOnly);
  fs.writeFileSync(path.resolve(publicDir, 'apexfit-icon-only.png'), iconOnlyBuffer);
  fs.writeFileSync(path.resolve(publicDir, 'apexfit-icon.png'), iconOnlyBuffer);
  console.log('   Saved public/apexfit-icon-only.png & public/apexfit-icon.png');

  // =========================================================================
  // 3. Splash / Loading Screen (Full-Screen 1080x1920px, Dark #0b0f15)
  // =========================================================================
  console.log('3. Rendering Full-Screen Splash / Loading Screen (1080x1920px)...');
  const splash = new PNG({ width: 1080, height: 1920 });

  // Fill splash with #0b0f15
  for (let y = 0; y < 1920; y++) {
    for (let x = 0; x < 1080; x++) {
      const idx = (y * 1080 + x) * 4;

      // Soft ambient radial cyan vignette in center
      const cDist = Math.sqrt(Math.pow(x - 540, 2) + Math.pow(y - 880, 2));
      const glowFactor = Math.max(0, 1 - cDist / 620);
      const ambientGlow = Math.pow(glowFactor, 2.2) * 0.08;

      splash.data[idx] = clamp(Math.round(COLOR_BG_SPLASH.r + COLOR_CYAN.r * ambientGlow));
      splash.data[idx + 1] = clamp(Math.round(COLOR_BG_SPLASH.g + COLOR_CYAN.g * ambientGlow));
      splash.data[idx + 2] = clamp(Math.round(COLOR_BG_SPLASH.b + COLOR_CYAN.b * ambientGlow));
      splash.data[idx + 3] = 255;
    }
  }

  // Position full logo in upper-middle
  const splash_iconW = 440;
  const splash_iconH = Math.round((splash_iconW * iconBox.h) / iconBox.w); // 263px
  const splash_iconX = Math.round((1080 - splash_iconW) / 2); // 320
  const splash_iconY = 740;

  const splash_textW = 340;
  const splash_textH = Math.round((splash_textW * textBox.h) / textBox.w); // 86px
  const splash_textX = Math.round((1080 - splash_textW) / 2); // 370
  const splash_textY = splash_iconY + splash_iconH + 36; // 1039

  // Draw Barbell-A with electric glow
  drawSubImage(splash, srcPng, iconBox, { x: splash_iconX, y: splash_iconY, w: splash_iconW, h: splash_iconH }, 'cyan', true);

  // Draw "ApexFit" Text in Crisp White
  drawSubImage(splash, srcPng, textBox, { x: splash_textX, y: splash_textY, w: splash_textW, h: splash_textH }, 'white', false);

  // Draw Loading Spinner below text
  const spinnerCenterX = 540;
  const spinnerCenterY = splash_textY + splash_textH + 80; // 1205
  drawCircularSpinner(splash, spinnerCenterX, spinnerCenterY, 32, 26);

  // Write Splash PNG
  const splashPngBuffer = PNG.sync.write(splash);
  fs.writeFileSync(path.resolve(publicDir, 'apexfit-splash.png'), splashPngBuffer);
  fs.writeFileSync(path.resolve(publicDir, 'splash-screen.png'), splashPngBuffer);
  console.log('   Saved public/apexfit-splash.png & public/splash-screen.png');

  // Write Splash JPEG using jpeg-js
  const splashJpgData = {
    data: splash.data,
    width: 1080,
    height: 1920,
  };
  const splashJpgBuffer = jpeg.encode(splashJpgData, 94).data;
  fs.writeFileSync(path.resolve(publicDir, 'apexfit-splash.jpg'), splashJpgBuffer);
  fs.writeFileSync(path.resolve(publicDir, 'splash-screen.jpg'), splashJpgBuffer);
  console.log('   Saved public/apexfit-splash.jpg & public/splash-screen.jpg');

  // Also write App Icon JPEG version
  const appIconJpgData = {
    data: (() => {
      // Create solid background buffer for JPEG (since JPEG has no alpha)
      const solidBuf = Buffer.alloc(512 * 512 * 4);
      for (let i = 0; i < appIcon.data.length; i += 4) {
        const a = appIcon.data[i + 3] / 255;
        solidBuf[i] = Math.round(appIcon.data[i] * a + COLOR_BG_SPLASH.r * (1 - a));
        solidBuf[i + 1] = Math.round(appIcon.data[i + 1] * a + COLOR_BG_SPLASH.g * (1 - a));
        solidBuf[i + 2] = Math.round(appIcon.data[i + 2] * a + COLOR_BG_SPLASH.b * (1 - a));
        solidBuf[i + 3] = 255;
      }
      return solidBuf;
    })(),
    width: 512,
    height: 512,
  };
  const appIconJpgBuffer = jpeg.encode(appIconJpgData, 95).data;
  fs.writeFileSync(path.resolve(publicDir, 'apexfit-app-icon.jpg'), appIconJpgBuffer);
  console.log('   Saved public/apexfit-app-icon.jpg');

  console.log('All ApexFit production branding assets successfully generated!');
}

generateBrandingAssets().catch((err) => {
  console.error('Asset generation failed:', err);
  process.exit(1);
});
