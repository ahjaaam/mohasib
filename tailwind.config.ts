import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: "#0D1526",
          light: "#1a2744",
          muted: "#2a3a5c",
        },
        gold: {
          DEFAULT: "#C8924A",
          light: "#d9a96b",
          dark: "#a8722a",
        },
        cream: {
          DEFAULT: "#FAFAF6",
          dark: "#F0F0E8",
        },
      },
      fontFamily: {
        sans: ["Inter", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
