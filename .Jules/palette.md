## 2026-05-10 - Enhancing Accessibility in Google Apps Script Applications
**Learning:** In projects using non-semantic elements (like `div`) as interactive components, accessibility is often overlooked. These elements must be explicitly given `role="button"` and `tabindex="0"` to be discoverable by assistive technologies and keyboard users. Additionally, global listeners for 'Enter' and 'Space' keys are necessary as `div` elements do not trigger `click` events on key presses by default.
**Action:** Always check for interactive non-button elements and ensure they have proper ARIA roles, focusability, and keyboard support. For icon-only buttons, descriptive `aria-label` attributes are a must.

## 2026-05-23 - ARIA Tab Panel Pattern Implementation
**Learning:** Implementing the ARIA Tab Panel pattern (role="tablist", role="tab", role="tabpanel") significantly improves navigation for screen reader and keyboard users. A roving tabindex (0 for active, -1 for others) combined with arrow key listeners allows for standard-compliant tab switching. Also, Ensure locked/disabled tabs are marked with aria-disabled="true" and removed from tab order.
**Action:** Use role="tablist", role="tab", and role="tabpanel" for all tabbed interfaces. Manage focus via roving tabindex and provide arrow key navigation support.
