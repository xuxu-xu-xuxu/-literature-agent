import type { Config } from "tailwindcss";
const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        accent: {
          DEFAULT: "#2563eb",
          light: "#3b82f6",
        },
      },
    },
  },
  plugins: [],
};
export default config;
