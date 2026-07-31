/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: { DEFAULT: "#0A1F4E", light: "#152C63" },
        brand: { DEFAULT: "#1A6BDB", dark: "#144FA3" },
        mint: { DEFAULT: "#2FBF9F" },
        cream: { DEFAULT: "#FBF9F4" },
        warn: { DEFAULT: "#F5A524" },
        danger: { DEFAULT: "#DC2626" },
      },
      fontFamily: {
        sans: ["'Be Vietnam Pro'", "system-ui", "sans-serif"],
      },
      borderRadius: {
        xl: "0.875rem",
      },
      boxShadow: {
        card: "0 2px 10px 0 rgba(10, 31, 78, 0.06)",
      },
    },
  },
  plugins: [],
};
