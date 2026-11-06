import fs from 'fs';
import path from 'path';

describe('PWA Manifest, Service Worker & Security Hygiene Audit', () => {
  const rootDir = process.cwd();

  describe('PWA Web App Manifest (public/manifest.json)', () => {
    const manifestPath = path.join(rootDir, 'public', 'manifest.json');

    it('manifest.json exists and contains valid JSON', () => {
      expect(fs.existsSync(manifestPath)).toBe(true);
      const content = fs.readFileSync(manifestPath, 'utf-8');
      expect(() => JSON.parse(content)).not.toThrow();
    });

    it('specifies standalone display mode, dark theme colors, and correct metadata', () => {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
      expect(manifest.short_name).toBe('ApexFit');
      expect(manifest.display).toBe('standalone');
      expect(manifest.theme_color).toBe('#0b0f15');
      expect(manifest.background_color).toBe('#0b0f15');
      expect(manifest.start_url).toBe('/');
    });

    it('configures valid 512x512 app icons including maskable and any targets', () => {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
      expect(Array.isArray(manifest.icons)).toBe(true);
      expect(manifest.icons.length).toBeGreaterThanOrEqual(3);

      const hasAppIcon = manifest.icons.some(
        (icon) => icon.src === '/apexfit-app-icon.png' && icon.sizes === '512x512'
      );
      const hasMaskable = manifest.icons.some(
        (icon) => icon.src === '/icon-512.png' && icon.purpose === 'maskable'
      );
      const hasSvgFavicon = manifest.icons.some(
        (icon) => icon.src === '/favicon.svg'
      );

      expect(hasAppIcon).toBe(true);
      expect(hasMaskable).toBe(true);
      expect(hasSvgFavicon).toBe(true);
    });
  });

  describe('Service Worker (public/sw.js)', () => {
    const swPath = path.join(rootDir, 'public', 'sw.js');

    it('sw.js exists and contains install, activate, and fetch listeners', () => {
      expect(fs.existsSync(swPath)).toBe(true);
      const content = fs.readFileSync(swPath, 'utf-8');

      expect(content).toContain("addEventListener('install'");
      expect(content).toContain("addEventListener('activate'");
      expect(content).toContain("addEventListener('fetch'");
    });

    it('precaches core shell assets including index.html, manifest, and icons', () => {
      const content = fs.readFileSync(swPath, 'utf-8');

      expect(content).toContain("'/index.html'");
      expect(content).toContain("'/manifest.json'");
      expect(content).toContain("'/apexfit-app-icon.png'");
      expect(content).toContain("'/favicon.svg'");
    });

    it('handles offline navigate requests with cached index.html SPA fallback', () => {
      const content = fs.readFileSync(swPath, 'utf-8');

      expect(content).toContain("request.mode === 'navigate'");
      expect(content).toContain("match('/index.html')");
    });
  });

  describe('HTML Shell & Mobile Head Configuration (index.html)', () => {
    const htmlPath = path.join(rootDir, 'index.html');

    it('links manifest.json and apple-touch-icon', () => {
      const content = fs.readFileSync(htmlPath, 'utf-8');

      expect(content).toContain('<link rel="manifest" href="/manifest.json"');
      expect(content).toContain('<link rel="apple-touch-icon" href="/apexfit-app-icon.png"');
    });

    it('sets dark theme-color and viewport-fit=cover for mobile display', () => {
      const content = fs.readFileSync(htmlPath, 'utf-8');

      expect(content).toContain('<meta name="theme-color" content="#0b0f15"');
      expect(content).toContain('viewport-fit=cover');
    });
  });

  describe('Environment & Secrets Security Hygiene (.gitignore)', () => {
    const gitignorePath = path.join(rootDir, '.gitignore');

    it('.gitignore explicitly ignores .env, dist, build, and node_modules', () => {
      expect(fs.existsSync(gitignorePath)).toBe(true);
      const content = fs.readFileSync(gitignorePath, 'utf-8');

      expect(content).toMatch(/^\.env$/m);
      expect(content).toMatch(/^\.env\.\*$/m);
      expect(content).toMatch(/^node_modules$/m);
      expect(content).toMatch(/^dist$/m);
      expect(content).toMatch(/^build$/m);
    });

    it('.env.example template exists without exposing actual private deployment IDs', () => {
      const envExamplePath = path.join(rootDir, '.env.example');
      expect(fs.existsSync(envExamplePath)).toBe(true);

      const content = fs.readFileSync(envExamplePath, 'utf-8');
      expect(content).toContain('VITE_GAS_WEB_APP_URL');
      expect(content).not.toContain('AKfy');
    });
  });
});
