# Duct Sizer — Technical Audit Report (Phase 1)

Date: 2026-10-25
Application Directory: `F:\MUSTHAFA\CHD\DUCT SIZER APP`
Backup Directory: `F:\MUSTHAFA\CHD\DUCT SIZER APP - BACKUP`

---

## 1. What the App is Built With

* **Backend Engine:**
  * **Language:** Python (3.14 / 3.x)
  * **Web Framework:** Flask (v3.0+)
  * **Mathematical & Engineering Libraries:**
    * `numpy` — Multi-dimensional linear interpolation across ASHRAE loss tables.
    * `math` — Darcy-Weisbach friction, Colebrook implicit iteration, Huebscher equivalent diameter.
  * **Reporting & Document Generation:**
    * `reportlab` — Multi-page engineering schedule & calculation PDF generation.
    * `Pillow` (PIL) — High-resolution blueprint and technical diagram image rasterization.
* **Frontend UI:**
  * **Architecture:** Vanilla JavaScript (ES6+), HTML5, and CSS3.
  * **Math Typesetting:** KaTeX (`katex.min.js`, `auto-render.min.js`, and local WOFF2/TTF fonts) — completely local.
  * **Graphics & Blueprint Rendering:** High-resolution ASHRAE blueprints and dynamic parametric SVG vector layers.
  * **No Cloud / No External Frameworks:** Operates without React, Vue, or external web dependencies.

---

## 2. How it Starts and Why Port 5052

* **Startup Entrypoint:** `python app.py` (or `run_app.bat`).
* **Port Configuration:**
  * Configured in `app.py`: `app.run(host="0.0.0.0", port=5052, debug=False)`.
  * Port `5052` was chosen as a dedicated non-standard port to avoid conflicts with common web development ports (like 80, 8080, 3000, or 5000).
* **Electron Desktop Plan:**
  * In the desktop app, the Python server will be launched in the background, listening strictly on `127.0.0.1` (localhost only, not accessible to outside network computers) on a dynamically assigned free port or port 5052.

---

## 3. Where Data is Stored

* **Projects & Fitting Schedules:**
  * Stored in `projects.json` located directly in the application root directory.
  * Holds all project schedules, tags, dimensions, airflow rates, loss coefficients, and cumulative pressure loss summaries.
* **Fitting Catalog Database:**
  * Stored in `fittings_tree.json` (hierarchical catalog of all 234 ASHRAE fittings).
  * Table data files stored in `ashrae_extracted/*.tbl` and `ashrae_data/`.
* **In-Session Inputs:**
  * Sizer inputs and working calculations are kept in memory (`state.userSizerValues`) and reset when the window is closed.
* **UserData Migration Plan for Installer (Phase 3):**
  * When installed as a Windows desktop application, `projects.json` will reside safely in the user's roaming AppData folder (`%APPDATA%\DuctSizer\projects.json`) so updates and uninstalls never overwrite or erase user engineering data.

---

## 4. Internet & Network Audit

* **External CDN Scripts / Stylesheets:** **NONE**
  * KaTeX CSS: `/static/katex/katex.min.css` (Local)
  * KaTeX JS: `/static/katex/katex.min.js` (Local)
  * KaTeX Fonts: `/static/katex/fonts/` (Local)
  * App Styles: `/static/css/style.css` (Local)
  * App Logic: `/static/js/app.js` (Local)
* **Google Fonts / Web Fonts:** **NONE**
  * The stylesheet utilizes native system fonts (`-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Inter", "Helvetica Neue", Arial, sans-serif`).
* **External APIs / Cloud Databases / Online Authentication:** **NONE**
  * All 234 fitting equations, interpolation algorithms, and sizing routines are calculated 100% on the local computer.
* **Analytics / Tracking:** **NONE**
* **Network Audit Result:** **100% Offline-Ready.** No external internet calls exist in the application code.

---

## 5. Audit Conclusion

The application has zero cloud dependencies, zero external CDN links, and is fully self-contained. It is an ideal candidate for packaging into an offline Electron desktop application.
