import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Nécromant — dark-fantasy esports
        base: "#12101A", // fond
        surface: {
          DEFAULT: "#1B1826", // panneaux
          raised: "#241F33", // survol / cartes hautes
        },
        hair: "#2E2842", // filets / bordures
        ink: {
          DEFAULT: "#E6E3F0", // texte principal
          soft: "#9A93B4", // texte secondaire
          faint: "#6E6788", // labels discrets
        },
        violet: {
          DEFAULT: "#7C4DFF", // accent principal
          bright: "#9B78FF",
          deep: "#5B34D9",
        },
        lime: "#A3FF12", // accent secondaire
        danger: "#FF1C5C",
        gold: "#FFC53D",
        // Couleurs de faction (associations)
        faction: {
          1: "#7C4DFF",
          2: "#A3FF12",
          3: "#2D9CFF",
          4: "#FF4D4D",
          5: "#FFC53D",
        },
      },
      fontFamily: {
        display: ["var(--font-rajdhani)", "system-ui", "sans-serif"],
        body: ["var(--font-rajdhani)", "system-ui", "sans-serif"],
        nav: ["var(--font-montserrat)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        "neon-violet": "0 0 0 1px rgba(124,77,255,0.5), 0 0 24px -4px rgba(124,77,255,0.55)",
        "neon-lime": "0 0 0 1px rgba(163,255,18,0.4), 0 0 22px -6px rgba(163,255,18,0.5)",
      },
      backgroundImage: {
        hex: "linear-gradient(rgba(18,16,26,0.82), rgba(18,16,26,0.92)), url('/theme/hexagon-bg.png')",
      },
      keyframes: {
        "slash-in": {
          "0%": { clipPath: "polygon(0 0,0 0,0 100%,0 100%)" },
          "100%": { clipPath: "polygon(0 0,100% 0,100% 100%,0 100%)" },
        },
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "slash-in": "slash-in 0.7s ease-in-out both",
        "fade-up": "fade-up 0.35s ease-out both",
      },
    },
  },
  plugins: [],
} satisfies Config;
