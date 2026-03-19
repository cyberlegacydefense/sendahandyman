/**
 * Building Configuration Reference
 *
 * NOTE: Buildings are now managed via Supabase database.
 * Use the Admin Dashboard → Buildings section to add/manage buildings.
 *
 * This file documents the schema and is kept for reference only.
 *
 * Supabase Table: buildings
 *
 * Schema:
 * {
 *   id: UUID (auto-generated)
 *   building_name: string (required) - Display name, e.g., "Lumaire"
 *   slug: string (required, unique) - URL path, e.g., "lumaire" for /lumaire
 *   street: string - Street address for auto-fill
 *   city: string - City for auto-fill
 *   state: string - State (default: "FL")
 *   zip: string - ZIP code for auto-fill
 *   logo_url: string - Path to building logo image
 *   accent_color: string - Hex color for CTAs (default: "#0ea5e9")
 *   headline: string - Custom hero headline (optional)
 *   subheadline: string - Custom subheadline (optional)
 *   featured_services: string[] - Array of service keys to show (null = show all)
 *   pm_name: string - Property manager name (optional)
 *   pm_email: string - Property manager email (optional)
 *   pm_phone: string - Property manager phone (optional)
 *   active: boolean - true = live, false = "Coming Soon"
 *   created_at: timestamp
 *   updated_at: timestamp
 * }
 *
 * Workflow:
 * 1. Add building via Admin Dashboard → Buildings → Add Building
 * 2. Add redirect to netlify.toml:
 *    [[redirects]]
 *    from = "/your-building-slug"
 *    to = "/building.html?slug=your-building-slug"
 *    status = 200
 * 3. Deploy to Netlify
 * 4. Generate QR code from Admin Dashboard
 * 5. Add QR code to flyers/lobby displays
 *
 * Service Keys (for featured_services):
 * - tv_mount
 * - ceiling-fan
 * - light-fixture
 * - faucet
 * - smart-doorbell
 * - blinds
 * - furniture
 * - handyman
 */

// This file is kept for documentation purposes only.
// Buildings are stored in Supabase and managed via Admin Dashboard.
