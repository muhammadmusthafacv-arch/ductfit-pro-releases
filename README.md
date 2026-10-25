# ASHRAE Duct Sizer & Duct Fitting Database v6.0 (Port 5052)

A comprehensive HVAC aerodynamic engineering and duct sizing application running on local port `5052`. 
Replicates the visual layout, exact numerical calculations, and technical drafting sheets of the **ASHRAE Duct Fitting Database (v5.0 & v6.0)** combined with the sizing equations of **2009 ASHRAE Handbook - Fundamentals, Chapter 21: Duct Design**.

---

## 🚀 Quick Access

- **Web Browser URL**: **[http://localhost:5052](http://localhost:5052)**
- **Batch Launcher**: Double-click `run_app.bat`

---

## 🌟 Core Features & Implementation

### 1. Master-Detail Windows Explorer Tree Browser
- Features the complete hierarchical catalog tree matching the official ASHRAE software:
  - **Supply**: Round & Rectangular Plenums, Exits, Transitions, Junctions (Crosses, Tees, Wyes, Heel-Tapped Elbows, Double Wyes), Fan & System Interactions.
  - **Common**: Straight Ducts (`CR11-1`, `CD11-1`, `CF11-1`, Flexible Ducts), Round & Rectangular Elbows, Dampers (Opposed, Parallel, Butterfly, Fire Damper).
  - **Exhaust / Return**: Round & Rectangular Entries, Transitions, Converging Junctions.
  - **Automated Duct Sizing Tools**: Equal Friction and Velocity Reduction sizing.
- Instant search filter and expand/collapse all controls.

### 2. Exact Numerical Match to ASHRAE Software
- Benchmark Test Case:
  - Input: $H = 300\text{ mm}$, $W = 300\text{ mm}$, $L = 3\text{ m}$, $Q = 2000\text{ L/s}$, $e = 0.090\text{ mm}$, $\rho = 1.204\text{ kg/m}^3$
  - Velocity: **$22.2\text{ m/s}$**
  - Velocity Pressure: **$297\text{ Pa}$**
  - Darcy Friction Factor: **$0.0163$**
  - Pressure Loss: **$48.5\text{ Pa}$**

### 3. Step-by-Step Mathematical Calculation Breakdown
- Every calculation displays the exact mathematical formula, parameter substitution with units, intermediate values, and physical explanations:
  - **Step 1**: Flow Area $A = H \times W$ (or $\frac{\pi D^2}{4}$, or oval area)
  - **Step 2**: Airflow Velocity $V = Q / A$
  - **Step 3**: Dynamic Velocity Pressure $P_v = \frac{1}{2}\rho V^2$
  - **Step 4**: Hydraulic Diameter $D_h$ and Circular Equivalent $D_e$ (Huebscher 1948 / Heyt & Diaz 1975)
  - **Step 5**: Reynolds Number $Re = \frac{\rho V D_h}{\mu}$
  - **Step 6**: Darcy Friction Factor $f$ via iterative Colebrook-White equation
  - **Step 7**: Darcy-Weisbach Pressure Loss $\Delta p = f \frac{L}{D_h} P_v$ and Friction Rate $\Delta p / L$ (or fitting loss $\Delta p = C_o P_v$)

### 4. Automated Duct Sizing Solver
- Sizes rectangular, round, and flat oval ductwork for:
  - **Equal Friction Method**: target $\Delta p / L$ (e.g. $1.0\text{ Pa/m}$ or $0.10\text{ in. wg/100ft}$)
  - **Velocity Reduction Method**: target velocity (e.g. $6.0\text{ m/s}$ or $1200\text{ fpm}$)
- Allows fixing Height ($H$), fixing Width ($W$), or targeting a maximum Aspect Ratio ($W/H$).
- Rounds automatically to standard sheet metal commercial increments ($25\text{ mm}$ / $1\text{ inch}$).
- Generates an **Alternative Candidates Matrix** for quick selection of optimal $H \times W$ aspect ratios.

### 5. CAD Vector Technical Drafting Sheet
- Authentic drafting workspace with matte gray background (`#8c8c8c`) and centered white drafting sheet (`#ffffff`).
- Parametric SVG technical line drawings with:
  - Flow arrows ($Q$ in, discharge out)
  - Dimension lines and witness extensions ($L$, $H \times W$, $\varnothing D$)
  - Mechanical zig-zag break lines
  - Real-time toggle: "Display Values in Drawing"
  - Technical footer with date (`10-19-2026`) and version `5.00.00` / `6.00.00`.

---

## 🧪 Unit Test Suite

Run automated unit tests verifying 2021 ASHRAE Handbook—Fundamentals Chapter 21 benchmarks:
```bash
python test_engine.py
```
Results: `11/11 tests pass (OK)`.
