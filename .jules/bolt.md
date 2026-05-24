## 2024-05-24 - [Pokedex Lookup Optimization]
**Learning:** The Pokemon Play module repeatedly performed O(N) linear searches through the 386-entry POKEDEX array for basic ID-to-object lookups, causing noticeable lag in batch operations like auto-equipping or rendering large lists (Binder/GTS).
**Action:** Use the pre-defined (but underutilized) POKEDEX_MAP for O(1) lookups in all performance-critical paths.

## 2024-05-24 - [PR Hygiene and Artifact Management]
**Learning:** Local verification artifacts like bundled.html or verification scripts can confuse reviewers and bloat the workspace, potentially leading to incorrect assessments if untracked files are included in the review context.
**Action:** Always clean up generated files and verification infrastructure before requesting review or submitting. Ensure journal paths match requested casing (.jules vs .Jules).
