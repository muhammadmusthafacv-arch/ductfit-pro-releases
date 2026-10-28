# Fitduct Pro - User Directives & Scope Isolation Rules

## Rule 1: Strict Separation Between Auto Duct Sizer and Fitting Loss Analysis
- **Directive**: Whenever the user asks to change, add, style, or modify anything from the **Auto Duct Sizer**, that change applies **ONLY to the Auto Duct Sizer**, and **NEVER to the Fitting Loss Analysis**.
- **Scope Definition**:
  - **Auto Duct Sizer**:
    - Triggered by `#btnModeSizer`, `state.mode === "sizer"`, or fitting codes starting with `SIZE-` (`SIZE-AUTO`, `SIZE-RECT`, `SIZE-ROUND`).
    - Governed by McQuay bi-directional continuity solver, target head loss / velocity constraints, and automated dimension sizing.
    - Default parameters include McQuay default roughness ($0.0003\text{ ft} / 0.09\text{ mm}$) and air density ($0.075\text{ lb/ft}^3 / 1.204\text{ kg/m}^3$).
  - **Fitting Loss Analysis**:
    - Triggered by `#btnModeDirect`, `state.mode === "direct"`, or catalog fitting codes (`CR11-1`, `CD11-1`, `CR3-1`, elbows, transitions, junctions, dampers).
    - Governed by official ASHRAE 2021 Fundamentals Ch. 21 loss coefficient tables, Darcy-Weisbach / Colebrook friction formulas.
- **Implementation Guarantee**:
  - Always verify mode context with `if (state.mode === "sizer" || state.activeCode.startsWith("SIZE-"))` vs `else` before modifying logic.
  - Never let styling, inputs, outputs, calculation steps, or default parameters intended for the Sizer spill into direct fitting analysis.

## Rule 2: Permanent Locked / Default Stage
- **User Instruction**:
  - "and make this is the dafault stage , when ever i asked you to make or go back to default , you have to come back at this stage . so remember this stage" (28-Oct-2026).
  - "lock this stage, when ever i asked you to come to locked satge you have to return to this stage" & "remembrer this satge , and when ever i asked you to come to the default page you have to come back and make it the application at this stage".
- **Trigger Phrasing**: Whenever the user asks to:
  - "go back to default"
  - "make or go back to default"
  - "come back at this stage"
  - "return to default stage"
  - "come to the default page"
  - "come to locked stage"
  - "revert to locked stage"
  - "restore default baseline"
- **Action Required**:
  1. Immediately restore the application to this exact snapshot.
  2. Execute `python restore_to_locked_stage.py` (or `git checkout LOCKED_DEFAULT_STAGE` / `git checkout DEFAULT_STAGE`).
  3. Restart the background Flask server daemon on Port 5052 (`python -u app.py`).
  4. Ensure all features of this locked default stage are fully intact:
     - **ASHRAE Database Parity Across All 234 Fittings**:
       - Every fitting title exactly matches the official ASHRAE `Title1` designations (e.g. `SD5-1: Wye, 45 Degree, Diverging`).
       - Tree view branch labels remain clean and compact with full tooltips and search indexing.
       - Master PDF reports resolve official ASHRAE titles and database citations.
     - **Design Safety Margin (%) in Project Summary**:
       - Interactive Design Safety Margin card with quick presets (`0%`, `5%`, `10%`, `15%`, `20%`, `25%`) and custom numeric input.
       - Backend API endpoint `POST /api/projects/<project_id>/margin` persisting the margin to `projects.json`.
       - 3-tier engineering breakdown: Base Subtotal, Design Safety Allowance (`+XX%` in a single line, nowrap), and Total Design Fan ESP across UI KPI cards, schedule footers, CSV exports, and PDF reports.
     - **Step-by-Step Engineering Calculation Inclusion Toggle**:
       - Project Summary toggle switch to include or exclude step-by-step engineering calculations in the final PDF report.
       - High-DPI KaTeX equation cards rendering formulas, numeric substitutions, and SI/IP units without any overlapping or clipping.
     - **Auto Duct Sizer Absolute Roughness Default**:
       - Editable absolute roughness field pre-populated with McQuay standard default ($0.0003\text{ ft} / 0.09\text{ mm}$) alongside standard air density.
     - **Schedule Action Controls**:
       - Icon-only Edit and Delete action buttons (clean SVG pencil and trash icons without redundant text labels).
     - **Zero Overlap & Flow Integrity Across PDF Reports**:
       - Auto Duct Sizer and Fitting Loss Analysis PDFs render clean multi-page schedules, blueprint CAD drawings, and mathematical breakdowns with strict layout separation and zero clipping.
