## 2026-05-10 - Enhancing Accessibility in Google Apps Script Applications
**Learning:** In projects using non-semantic elements (like `div`) as interactive components, accessibility is often overlooked. These elements must be explicitly given `role="button"` and `tabindex="0"` to be discoverable by assistive technologies and keyboard users. Additionally, global listeners for 'Enter' and 'Space' keys are necessary as `div` elements do not trigger `click` events on key presses by default.
**Action:** Always check for interactive non-button elements and ensure they have proper ARIA roles, focusability, and keyboard support. For icon-only buttons, descriptive `aria-label` attributes are a must.

## 2026-05-24
- **Game UI Fix**: Resolved piece-tray overlap in Block Blast by increasing canvas height (480 -> 600) and shifting tray coordinates (410 -> 520).
- **Glassmorphism Enhancement**: Implemented radial gradients for canvas backgrounds to enhance depth and align with the "Next-Gen Glass" design system.
- **Accessibility**: Verified that Block Blast mechanics (drag and drop) work correctly with the application's global state and game-over overlays.
- **Maintenance**: Performed thorough cleanup of retired game assets, including logic, categorization, and unused CSS classes (.s-slot, .mem-card) to maintain a lean codebase.

## 2026-05-24 - ARIA Tab Panel Pattern for GAS
**Learning:** Implementing the full ARIA Tab Panel pattern (tablist, tab, tabpanel) significantly improves navigation for screen reader users by establishing a clear relationship between the navigation and its content. A "roving tabindex" (only the active tab is in the tab flow) combined with arrow key navigation is the standard for accessible tabs, but must be manually implemented when using non-semantic containers like divs.
**Action:** Use role="tablist", role="tab", and role="tabpanel" for category-style navigation. Manage focus with arrow keys and synchronize aria-selected and aria-labelledby dynamically.
