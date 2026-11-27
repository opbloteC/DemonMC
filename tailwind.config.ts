import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  darkMode: ["class", '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        /* Surfaces. White flips to a dark navy glass panel when the dark theme is active. */
        white: "rgb(var(--white) / <alpha-value>)",
        ink: {
          950: "#e9f6fe",
          900: "#ffffff",
          850: "#f7fcff",
          800: "#eef8fe",
          700: "#e1f2fb",
        },
        aqua: {
          50: "rgb(var(--aqua-50) / <alpha-value>)",
          100: "rgb(var(--aqua-100) / <alpha-value>)",
          200: "rgb(var(--aqua-200) / <alpha-value>)",
          300: "rgb(var(--aqua-300) / <alpha-value>)",
          400: "rgb(var(--aqua-400) / <alpha-value>)",
          500: "rgb(var(--aqua-500) / <alpha-value>)",
          600: "rgb(var(--aqua-600) / <alpha-value>)",
          700: "rgb(var(--aqua-700) / <alpha-value>)",
          800: "rgb(var(--aqua-800) / <alpha-value>)",
          900: "rgb(var(--aqua-900) / <alpha-value>)",
        },
        navy: {
          100: "rgb(var(--navy-100) / <alpha-value>)",
          200: "rgb(var(--navy-200) / <alpha-value>)",
          300: "rgb(var(--navy-300) / <alpha-value>)",
          400: "rgb(var(--navy-400) / <alpha-value>)",
          500: "rgb(var(--navy-500) / <alpha-value>)",
          600: "rgb(var(--navy-600) / <alpha-value>)",
          700: "rgb(var(--navy-700) / <alpha-value>)",
          800: "rgb(var(--navy-800) / <alpha-value>)",
          900: "rgb(var(--navy-900) / <alpha-value>)",
        },
        ember: {
          DEFAULT: "#f4842d",
          bright: "#ffa45c",
          deep: "#dd6a12",
          dark: "#a34c0b",
        },
        sun: {
          DEFAULT: "#ff8a3d",
          bright: "#ffa15e",
          deep: "#f2701c",
          dark: "#c25008",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "Segoe UI", "system-ui", "-apple-system", "sans-serif"],
        display: ["var(--font-sora)", "Sora", "Inter", "Segoe UI", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "Consolas", "ui-monospace", "monospace"],
      },
      boxShadow: {
        glow: "0 18px 40px -18px rgba(12, 110, 160, 0.45)",
        panel: "0 20px 50px -32px rgba(9, 60, 90, 0.4)",
        card: "0 14px 36px -24px rgba(9, 60, 90, 0.35)",
      },
      keyframes: {
        "fade-up": {
          from: { opacity: "0", transform: "translateY(18px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "pulse-soft": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.35" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" },
        },
        drift: {
          "0%": { transform: "translate3d(0, 0, 0)" },
          "50%": { transform: "translate3d(2.5%, -1.5%, 0)" },
          "100%": { transform: "translate3d(-1.5%, 1%, 0)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.7s cubic-bezier(0.2, 0.7, 0.2, 1) both",
        "fade-in": "fade-in 0.6s ease both",
        "pulse-soft": "pulse-soft 2.2s ease-in-out infinite",
        float: "float 7s ease-in-out infinite",
        drift: "drift 48s ease-in-out infinite alternate",
      },
    },
  },
  plugins: [],
};

export default config;
