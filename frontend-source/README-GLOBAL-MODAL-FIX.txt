CampUs global responsive dialog repair (2026-10-23)

Applied consistent centering and viewport-safe sizing to the navigation/help/filter dialogs and lost/found report form on desktop, tablet, and mobile. Close controls now read “Close” and sit in a reserved top row rather than overlapping the eyebrow or heading. Dialog content scrolls internally when taller than the viewport, form controls fit narrow screens, and action buttons remain visible at the bottom. Community chat remains a full-page screen and is intentionally excluded from generic dialog sizing.

No backend/API code was changed. Please replace the complete CampusFind-Frontend folder, restart/reload the frontend, and hard-refresh the browser to pick up the updated stylesheet.
