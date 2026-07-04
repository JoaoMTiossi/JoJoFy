/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef2ff",
          100: "#e0e7ff",
          500: "#5b4fe9",
          600: "#4a3fd1",
          700: "#3c32ac",
        },
      },
    },
  },
  plugins: [],
};
