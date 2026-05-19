## 2026-05-10 - Enhancing Accessibility in Google Apps Script Applications
**Learning:** In projects using non-semantic elements (like `div`) as interactive components, accessibility is often overlooked. These elements must be explicitly given `role="button"` and `tabindex="0"` to be discoverable by assistive technologies and keyboard users. Additionally, global listeners for 'Enter' and 'Space' keys are necessary as `div` elements do not trigger `click` events on key presses by default.
**Action:** Always check for interactive non-button elements and ensure they have proper ARIA roles, focusability, and keyboard support. For icon-only buttons, descriptive `aria-label` attributes are a must.

## 2026-05-19 - Standardized ARIA Tab Panel Pattern
**Learning:** For single-page applications with complex navigation, implementing the full ARIA Tab Panel pattern (role="tablist", role="tab", role="tabpanel") significantly improves the experience for assistive technology users. When combining this with level-based gating, it's crucial to remove locked tabs from the tab order (tabindex="-1") and mark them with aria-disabled="true" to prevent confusion.
**Action:** Use role="tablist" and role="tabpanel" to link navigation to content. Manage aria-selected, tabindex, and aria-hidden dynamically. Implement arrow key navigation within the tablist for a native-feeling experience.
