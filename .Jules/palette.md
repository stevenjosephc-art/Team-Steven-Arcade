## 2026-05-10 - Enhancing Accessibility in Google Apps Script Applications
**Learning:** In projects using non-semantic elements (like `div`) as interactive components, accessibility is often overlooked. These elements must be explicitly given `role="button"` and `tabindex="0"` to be discoverable by assistive technologies and keyboard users. Additionally, global listeners for 'Enter' and 'Space' keys are necessary as `div` elements do not trigger `click` events on key presses by default.
**Action:** Always check for interactive non-button elements and ensure they have proper ARIA roles, focusability, and keyboard support. For icon-only buttons, descriptive `aria-label` attributes are a must.

## 2026-05-24
- **Game UI Fix**: Resolved piece-tray overlap in Block Blast by increasing canvas height (480 -> 600) and shifting tray coordinates (410 -> 520).
- **Glassmorphism Enhancement**: Implemented radial gradients for canvas backgrounds to enhance depth and align with the "Next-Gen Glass" design system.
- **Accessibility**: Verified that Block Blast mechanics (drag and drop) work correctly with the application's global state and game-over overlays.
- **Maintenance**: Performed thorough cleanup of retired game assets, including logic, categorization, and unused CSS classes (.s-slot, .mem-card) to maintain a lean codebase.

## 2026-06-15
- **New Feature**: Added 'Battleship Command', a strategic naval combat game with a 12x12 grid and 6 ship types.
- **AI Logic**: Implemented multi-tier AI behaviors ranging from random fire (Easy) to predictive probability mapping (Hard) based on game difficulty selection.
- **Strategic Mechanics**: Introduced an Energy system fueled by hits and ship-sinks, allowing players to activate 'Radar Scan', 'Sonar Ping', and 'Artillery Barrage' abilities.
- **Design System Alignment**: Utilized the "Next-Gen Glass" aesthetic for the game UI, including translucent HUDs, glowing neon hit/miss markers, and smooth CSS transitions.
- **Ecosystem Integration**: Successfully integrated the game into the 'Brain & Logic' category and the Seasonal Featured carousel, ensuring it fits with existing reward and progression systems.
