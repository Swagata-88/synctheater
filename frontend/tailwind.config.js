const path = require("path");

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    path.join(__dirname, "src/pages/**/*.{js,ts,jsx,tsx,mdx}"),
    path.join(__dirname, "src/components/**/*.{js,ts,jsx,tsx,mdx}"),
    path.join(__dirname, "src/app/**/*.{js,ts,jsx,tsx,mdx}"),
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        // Official SYNCTHEATER Brand Identity: Metallic Champagne Gold x Midnight Black
        theater: {
          bg: "#090909",          // Main background
          secondary: "#111111",   // Secondary background
          card: "#171717",        // Card background
          surface: "#202020",     // Elevated surfaces
          gold: "#D6B56D",        // Primary champagne gold
          goldLight: "#F0D89F",   // Gold highlight
          goldDark: "#94743D",    // Antique gold
          border: "#353535",      // Borders
          borderSubtle: "#242424",
          text: "#FFFFFF",        // Main text
          textMuted: "#B9B9B9",   // Secondary text
          textDim: "#777777",     // Muted text
          player: "#000000",      // Video player background
          emergency: "#ef4444",   // Emergency Pause red
        }
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "-apple-system", "sans-serif"],
        mono: ["var(--font-geist-mono)", "monospace"],
      },
      animation: {
        "pulse-fast": "pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "gold-shimmer": "gold-shimmer 3s ease-in-out infinite alternate",
      },
      keyframes: {
        "gold-shimmer": {
          "0%": { opacity: "0.85" },
          "100%": { opacity: "1" },
        }
      }
    },
  },
  plugins: [],
};
