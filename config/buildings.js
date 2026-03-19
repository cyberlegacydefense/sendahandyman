/**
 * Building Configurations for Custom Landing Pages
 *
 * Each building gets a unique landing page at /[slug]
 * QR codes point to these pages for resident attribution tracking
 *
 * To add a new building:
 * 1. Add entry to this array
 * 2. Add redirect to netlify.toml: /[slug] -> /building.html?slug=[slug]
 * 3. Generate QR code via /admin/qr-generator.html
 * 4. Upload building logo to /images/buildings/[slug]-logo.png
 */

const buildings = [
    {
        // Required fields
        slug: 'lumaire',
        building_name: 'Lumaire',
        logo_url: '/images/buildings/lumaire-logo.png',
        active: true,

        // Address for auto-population during checkout
        address: {
            street: '2000 S Ocean Blvd',
            city: 'Boca Raton',
            state: 'FL',
            zip: '33432'
        },

        // Optional customization (defaults shown)
        headline: 'Private Home Maintenance — On Demand',
        subheadline: 'Trusted help for the details that keep your home perfect.',

        // null = show all services, or specify array of service keys
        featured_services: null,

        // Accent color for CTAs and accents (Lumaire gold)
        accent_color: '#D4AF37',

        // Contact info for this building's property manager (optional)
        property_manager: {
            name: null,
            email: null,
            phone: null
        }
    },
    // Example inactive building
    {
        slug: 'the-bristol',
        building_name: 'The Bristol',
        logo_url: '/images/buildings/the-bristol-logo.png',
        active: false, // Shows "Coming Soon" placeholder
        address: {
            street: '1100 S Flagler Dr',
            city: 'West Palm Beach',
            state: 'FL',
            zip: '33401'
        },
        accent_color: '#1e3a5f' // Navy blue
    }
];

// Service definitions - prices must match index.html TASKS object
const services = {
    'tv_mount':       { icon: '📺', label: 'TV Wall Mounting',    price: 180, hours: '~2 hrs' },
    'ceiling-fan':    { icon: '💡', label: 'Ceiling Fan Install', price: 180, hours: '~2 hrs' },
    'light-fixture':  { icon: '✨', label: 'Light Fixtures',      price: 135, hours: '~1.5 hrs' },
    'faucet':         { icon: '🚰', label: 'Faucet & Plumbing',   price: 135, hours: '~1.5 hrs' },
    'smart-doorbell': { icon: '🔔', label: 'Smart Doorbell',      price: 110, hours: '~1 hr' },
    'blinds':         { icon: '🪟', label: 'Blinds & Curtains',   price: 90,  hours: '~1 hr' },
    'furniture':      { icon: '🪑', label: 'Furniture Assembly',  price: 180, hours: '~2 hrs' },
    'handyman':       { icon: '🔧', label: 'General Repairs',     price: 265, hours: '~3 hrs' }
};

// Trust checklist items for "Designed for Luxury Living" section
const trustChecklist = [
    'Background-checked, vetted technicians',
    'Uniformed professionals who respect your space',
    'Building-aware scheduling (we follow your rules)',
    'Transparent, flat-rate pricing — no surprises',
    'Photo documentation of completed work',
    'Direct communication throughout service'
];

// Export for use in building.html
if (typeof window !== 'undefined') {
    window.BUILDING_CONFIG = { buildings, services, trustChecklist };
}
