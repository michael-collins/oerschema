/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/views/**/*.njk"],
  theme: {
    extend: {},
  },
  plugins: [require("daisyui")],
  daisyui: {
    themes: [
      {
        oerschema: {
          "primary": "#2196F3",          // Use current blue color
          "secondary": "#26a69a",        // Use current teal color
          "accent": "#f57c00",           // Orange accent color
          "neutral": "#2b3440",
          "base-100": "#ffffff",
          "info": "#3abff8",
          "success": "#36d399",
          "warning": "#fbbd23",
          "error": "#f87272",
        },
      },
      "light",
      "dark"
    ],
  },
}