/**
 * Copy and facts rendered on the placeholder home screen.
 *
 * Kept out of the component so the page has something worth asserting on in a
 * test, and so this file is the single place to edit while the app is a
 * placeholder.
 */
export const APP_STATUS = {
  tagline: "Management software for people, not teams. Nothing to manage yet.",
  facts: [
    { label: "Stack", value: "Next.js + TypeScript" },
    { label: "Hosting", value: "GitHub Pages" },
    { label: "Status", value: "Placeholder" },
  ],
} as const;
