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
