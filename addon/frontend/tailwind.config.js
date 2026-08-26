/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        gips: {
          green: "#1E7A3D",
          gold: "#D4A017",
        },
      },
    },
  },
  plugins: [],
};
