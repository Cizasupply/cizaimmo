import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: "#1B2A4A",
          dark: "#121D33",
          light: "#2A3D63",
        },
        gold: {
          DEFAULT: "#D4AF37",
          light: "#E8C86E",
          dark: "#A8862A",
        },
        // Fond général de l'espace connecté (design « Marine & Or »,
        // 2026-11-07) : blanc crème chaud, les cartes blanches
        // ressortent sans contours artificiels.
        cream: "#F7F5F0",
      },
    },
  },
  plugins: [],
};
export default config;
