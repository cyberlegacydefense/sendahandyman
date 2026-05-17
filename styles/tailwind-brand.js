/* ============================================================
   ResidentSteward — Shared Tailwind Config
   ============================================================
   Include via <script src="/styles/tailwind-brand.js"></script>
   AFTER the Tailwind CDN script tag.
   ============================================================ */

tailwind.config = {
  theme: {
    extend: {
      colors: {
        forest:      { DEFAULT: '#1A3D2E', deep: '#0F2A1F' },
        brass:       { DEFAULT: '#C9A961', soft: '#D4B97A' },
        cream:       { DEFAULT: '#F5F0E6', deep: '#EBE4D4' },
        ink:         '#1A1A1A',
        mist:        '#8A9991',
      },
      fontFamily: {
        display: ['"Cormorant Garamond"', 'Georgia', 'serif'],
        body:    ['"Jost"', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'sans-serif'],
      },
      fontSize: {
        hero:    '96px',
        section: '68px',
        card:    '44px',
        body:    '17px',
        label:   '12px',
        cta:     '15px',
      },
      transitionTimingFunction: {
        brand: 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
      transitionDuration: {
        600: '600ms',
        900: '900ms',
      },
      borderWidth: {
        1: '1px',
      },
    },
  },
};
