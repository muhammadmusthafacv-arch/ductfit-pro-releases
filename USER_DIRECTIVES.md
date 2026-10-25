# Fitduct Pro - User Directives & Scope Isolation Rules

## Rule 1: Strict Separation Between Auto Duct Sizer and Fitting Loss Analysis
- **Directive**: Whenever the user asks to change, add, style, or modify anything from the **Auto Duct Sizer**, that change applies **ONLY to the Auto Duct Sizer**, and **NEVER to the Fitting Loss Analysis**.
- **Scope Definition**:
  - **Auto Duct Sizer**:
    - Triggered by `#btnModeSizer`, `state.mode === "sizer"`, or fitting codes starting with `SIZE-` (`SIZE-AUTO`, `SIZE-RECT`, `SIZE-ROUND`).
    - Governed by McQuay bi-directional continuity solver, target head loss / velocity constraints, and automated dimension sizing.
  - **Fitting Loss Analysis**:
    - Triggered by `#btnModeDirect`, `state.mode === "direct"`, or catalog fitting codes (`CR11-1`, `CD11-1`, `CR3-1`, elbows, transitions, junctions, dampers).
    - Governed by official ASHRAE 2021 Fundamentals Ch. 21 loss coefficient tables, Darcy-Weisbach / Colebrook friction formulas.
- **Implementation Guarantee**:
  - Always verify mode context with `if (state.mode === "sizer" || state.activeCode.startsWith("SIZE-"))` vs `else` before modifying logic.
  - Never let styling, inputs, outputs, calculation steps, or default parameters intended for the Sizer spill into direct fitting analysis.

## Rule 2: Permanent Locked / Default Stage
- **User Instruction**: "lock this stage, when ever i asked you to come to locked satge you have to return to this stage" and "remembrer this satge , and when ever i asked you to come to the default page you have to come back and make it the application at this stage".
- **Trigger Phrasing**: Whenever the user asks to "come to the default page", "return to default stage", "come to locked stage", "revert to locked stage", or "restore default baseline".
- **Action Required**:
  1. Immediately restore the application to this exact snapshot.
  2. Execute `python restore_to_locked_stage.py` (or `git checkout LOCKED_DEFAULT_STAGE_V1.060`).
  3. Restart the background Flask server daemon on Port 5052 (`python -u app.py`).
  4. Ensure all features of this locked stage are fully intact:
     - Auto Duct Sizer and Fitting Loss Analysis completely separated across UI, data storage (`project.duct_segments` vs `project.fittings`), project summary modals, and PDF generation.
     - Sizer Project Report: Page 1 Sizing KPIs + Schedule + Methodology box; Page 2+ Detailed 4-column Inputs/Outputs table + Step-by-Step Breakdown (strictly NO CAD line drawings, strictly NO fitting loss items).
     - Fitting Loss Report: Master Fitting Schedule + Dynamic Loss KPIs; Page 2+ Blueprint line drawing + Inputs/Outputs table + Colebrook steps (strictly NO duct sizer runs).
     - Table headers use clean light ash grey background (`#e2e8f0`) with dark high-contrast text (`#0f172a`).
     - Real Greek & math symbols used everywhere ($\Delta, \rho, \epsilon, \mu, \sqrt{\phantom{x}}, \Sigma$) instead of plain words ("Delta", "rho", "eps", "sqrt", "SUM").
     - No dates on top running headers of either report; date cleanly placed on bottom footer (`10-25-2026`).
     - Running headers strictly `DUCTFIT PRO — DUCT SIZING REPORT` and `DUCTFIT PRO — DUCT FITTING REPORT`.
     - Standard engineering citations strictly mention `ASHRAE Fundamentals, Ch. 21` (all "2021" mentions removed).
     - Number typography: Professional tabular engineering sans-serif font.
     - Single-precision parity with official ASHRAE Duct Fitting Database (SD5-11: 0.87, 38 Pa; SD5-15: 2.15, 93 Pa; SD5-16: 2.32, 101 Pa; SD5-23: 0.82, 31 Pa).
