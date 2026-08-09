---
name: Offline deployment
description: The hospital card printer’s local-network runtime and distribution constraint.
---

The card printer must remain usable on a hospital computer/server with no Internet connection. The runtime package therefore includes compiled frontend assets, the facility logo, an offline static server, and setup instructions; it does not rely on remote fonts, APIs, or cloud storage.

**Why:** The target computer system is isolated from the Internet, but staff still need browser-based editing, local persistence, and Magicard printing.

**How to apply:** Keep future card templates and UI changes bundled into the production build. Avoid remote asset URLs and external runtime services. Distribute the built offline package and ensure Node.js plus the Magicard printer driver are available on the local server/client computers.