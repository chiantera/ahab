/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './it/index.html', './404.html', './assets/js/**/*.js'],
  theme: {
    extend: {
      colors: {
        parchment: '#f4f1ea',
        ink: '#2c3e50',
        ocean: '#1a365d',
        crimson: '#8b0000',
        bone: '#e3dac9',
      },
      fontFamily: {
        serif: ['"Playfair Display"', 'serif'],
        body: ['"Lora"', 'serif'],
        antique: ['"IM Fell English"', 'serif'],
      },
    },
  },
  plugins: [],
};
