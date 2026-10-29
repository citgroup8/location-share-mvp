/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './features/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}'
  ],
  theme: {
    extend: {
      colors: {
        snapchat: {
          yellow: '#FFFC00',
          black: '#111111',
          white: '#FFFFFF',
          gray: '#F3F3F3',
          muted: '#767676',
          blue: '#1E90FF',
          coral: '#FF6C6C',
          green: '#5ACD4E'
        }
      },
      boxShadow: {
        snap: '0 12px 35px rgba(17, 17, 17, 0.12)'
      },
      borderRadius: {
        snap: '28px'
      }
    }
  },
  plugins: []
};
