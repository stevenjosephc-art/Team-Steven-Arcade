## 2026-05-10 - Enhancing Accessibility in Google Apps Script Applications
**Learning:** In projects using non-semantic elements (like `div`) as interactive components, accessibility is often overlooked. These elements must be explicitly given `role="button"` and `tabindex="0"` to be discoverable by assistive technologies and keyboard users. Additionally, global listeners for 'Enter' and 'Space' keys are necessary as `div` elements do not trigger `click` events on key presses by default.
**Action:** Always check for interactive non-button elements and ensure they have proper ARIA roles, focusability, and keyboard support. For icon-only buttons, descriptive `aria-label` attributes are a must.

## 2026-05-22 - Implementing ARIA Tab Panel Pattern
**Learning:** For tab systems using `div` elements, the WAI-ARIA Tab Panel pattern provides a robust framework for accessibility. Key components include `role="tablist"`, `role="tab"`, and `role="tabpanel"`. A "roving tabindex" (where only the active tab is `tabindex="0"`) combined with arrow key navigation is the standard for keyboard users.
**Action:** Use roving tabindex and synchronize `aria-selected` and `aria-labelledby` dynamically in the tab-switching logic to ensure screen readers correctly announce content transitions.
