// Without this file Vite never runs Tailwind: the "@tailwind base/components/
// utilities" lines in src/index.css stay as raw text, so every utility class
// (flex, p-4, rounded-xl, grid, ...) does nothing and the UI renders unstyled.
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
