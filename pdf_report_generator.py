import re

def clean_pdf_text(text):
    if not text:
        return ""
    if not isinstance(text, str):
        text = str(text)

    # 1. LaTeX cleanup
    text = text.replace(r'\left(', '(').replace(r'\right)', ')')
    text = text.replace(r'\left[', '[').replace(r'\right]', ']')
    text = text.replace(r'\quad', '  ').replace(r'\qquad', '    ')

    # Convert LaTeX Greek & Math to ReportLab HTML entities
    text = text.replace(r'\Delta', '&Delta;').replace(r'\delta', '&delta;')
    text = text.replace(r'\rho', '&rho;').replace(r'\varepsilon', '&epsilon;').replace(r'\epsilon', '&epsilon;')
    text = text.replace(r'\mu', '&mu;').replace(r'\nu', '&nu;').replace(r'\theta', '&theta;')
    text = text.replace(r'\sum', '&Sigma;').replace(r'\Sigma', '&Sigma;')
    text = text.replace(r'\times', ' &times; ').replace(r'\cdot', ' &bull; ')
    text = text.replace(r'\degree', '&deg;').replace(r'^\circ', '&deg;')
    text = text.replace(r'\le', '&le;').replace(r'\leq', '&le;')
    text = text.replace(r'\ge', '&ge;').replace(r'\geq', '&ge;')

    # Subscripts and superscripts in LaTeX
    text = re.sub(r'\\sqrt\{([^{}]+)\}', r'&radic;(\1)', text)
    text = re.sub(r'\\log_\{?10\}?', 'log<sub>10</sub>', text)
    text = re.sub(r'_\{([^{}]+)\}', r'<sub>\1</sub>', text)
    text = re.sub(r'\^\{([^{}]+)\}', r'<sup>\1</sup>', text)

    for _ in range(3):
        text = re.sub(r'\\frac\{([^{}]+)\}\{([^{}]+)\}', r'(\1)/(\2)', text)
        text = re.sub(r'\\mathbf\{([^{}]+)\}', r'<b>\1</b>', text)
        text = re.sub(r'\\text\{([^{}]+)\}', r'\1', text)
        text = re.sub(r'\\tag\{([^{}]+)\}', r'(Eq. \1)', text)

    text = text.replace('\\', '')
    text = re.sub(r'\{([^{}]+)\}', r'\1', text)
    text = text.replace('{', '').replace('}', '')

    # 2. Unicode symbols & common mojibake to HTML entities
    # Clean composite symbols before splitting
    text = re.sub(r'[\u03c1\b]ref\b', '&rho;<sub>ref</sub>', text)
    text = re.sub(r'[\u0394\b]P_?f\b', '&Delta;P<sub>f</sub>', text)
    text = re.sub(r'[\u0394\b]p/L\b', '&Delta;p/L', text)
    text = re.sub(r'[\u0394\b]P\b', '&Delta;P', text)
    text = re.sub(r'[\u0394\b]p\b', '&Delta;p', text)
    text = re.sub(r'[\u0394\b]x\b', '&Delta;x', text)

    # Unicode sub/superscript handling to prevent ReportLab black box glyphs
    text = re.sub(r'log[\u2080-\u2089]+', 'log<sub>10</sub>', text)
    text = text.replace('10\u207b\xb9\xb2', '10<sup>-12</sup>')
    text = re.sub(r'10\u207b([\xb9\xb2\xb3\u2070-\u2079]+)', lambda m: '10<sup>-' + m.group(1).replace('\xb9','1').replace('\xb2','2').replace('\xb3','3').replace('\u2074','4').replace('\u2075','5') + '</sup>', text)

    charmap = {
        '\u0394': '&Delta;',   # Δ
        '\u03b4': '&delta;',   # δ
        '\u03c1': '&rho;',     # ρ
        '\u03b5': '&epsilon;', # ε
        '\u03bc': '&mu;',      # μ
        '\u03b8': '&theta;',   # θ
        '\u221a': '&radic;',   # √
        '\u2211': '&Sigma;',   # Σ
        '\u2192': ' &rarr; ',  # →
        '\u2212': '-',         # − (minus)
        '\xb2': '&sup2;',      # ²
        '\xb3': '&sup3;',      # ³
        '\xb0': '&deg;',       # °
        '\xb7': ' &bull; ',    # ·
        '\xd7': ' &times; ',   # ×
        # Common Mojibake replacements
        'I"': '&Delta;', '^+': '&Delta;', '^`': '&Sigma;', 'I?': '&rho;', 'I\xa7': '&epsilon;', 'I\xb4': '&mu;',
        'A\xb2': '&sup2;', 'A3': '&sup3;', 'A\xb0': '&deg;',
        'kg/mA3': 'kg/m&sup3;', 'mA3/s': 'm&sup3;/s', 'mA3': 'm&sup3;', 'mA\xb2': 'm&sup2;',
        'lbm/ftA3': 'lbm/ft&sup3;', 'ftA3': 'ft&sup3;', 'ftA\xb2': 'ft&sup2;',
        '^s': '&radic;', 'A-': ' &times; ', 'A\xb7': ' &bull; '
    }
    for k, v in charmap.items():
        text = text.replace(k, v)

    # 3. Contextual word-to-symbol replacements (avoiding &entity; double replacement!)
    text = re.sub(r'(?<!&)\bsqrtf\b', r'&radic;f', text)
    text = re.sub(r'(?<!&)\bsqrt\(([^)]+)\)', r'&radic;(\1)', text)
    text = re.sub(r'(?<!&)\bsqrt\b', r'&radic;', text)

    text = re.sub(r'(?<!&)\bDelta\s*P_f\b', r'&Delta;P<sub>f</sub>', text)
    text = re.sub(r'(?<!&)\bDelta\s*Pf\b', r'&Delta;P<sub>f</sub>', text)
    text = re.sub(r'(?<!&)\bDelta\s*P\b', r'&Delta;P', text)
    text = re.sub(r'(?<!&)\bDelta\s*p\b', r'&Delta;p', text)
    text = re.sub(r'(?<!&)\bDelta\s*x\b', r'&Delta;x', text)
    text = re.sub(r'(?<!&)\bDelta\b', r'&Delta;', text)
    text = re.sub(r'(?<!&)\bSUM\s+Delta\s*P\b', r'&Sigma;&Delta;P', text)
    text = re.sub(r'(?<!&)\bSUM\b', r'&Sigma;', text)

    text = re.sub(r'(?<!&)\brhoref\b', r'&rho;<sub>ref</sub>', text)
    text = re.sub(r'(?<!&)\brho\b', r'&rho;', text)
    text = re.sub(r'(?<!&)\beps\b', r'&epsilon;', text)
    text = re.sub(r'(?<!&)\bepsilon\b', r'&epsilon;', text)
    text = re.sub(r'(?<!&)\bmu\b', r'&mu;', text)

    text = re.sub(r'(\d+)\s*degC\b', r'\1&deg;C', text)
    text = re.sub(r'(\d+)\s*degF\b', r'\1&deg;F', text)
    text = re.sub(r'(\d+)\s*deg\b', r'\1&deg;', text)

    text = text.replace('kg/m^3', 'kg/m&sup3;').replace('m^3/s', 'm&sup3;/s')
    text = text.replace('m^3', 'm&sup3;').replace('m^2', 'm&sup2;')
    text = text.replace('lbm/ft^3', 'lbm/ft&sup3;').replace('ft^3', 'ft&sup3;').replace('ft^2', 'ft&sup2;')
    text = text.replace('10^-12', '10<sup>-12</sup>').replace('10^-4', '10<sup>-4</sup>').replace('10^-5', '10<sup>-5</sup>')
    text = text.replace('log10', 'log<sub>10</sub>')

    text = re.sub(r'\bP_v\b', r'P<sub>v</sub>', text)
    text = re.sub(r'\bPv\b', r'P<sub>v</sub>', text)
    text = re.sub(r'\bP_vb\b', r'P<sub>vb</sub>', text)
    text = re.sub(r'\bPvb\b', r'P<sub>vb</sub>', text)
    text = re.sub(r'\bP_vc\b', r'P<sub>vc</sub>', text)
    text = re.sub(r'\bPvc\b', r'P<sub>vc</sub>', text)
    text = re.sub(r'\bD_h\b', r'D<sub>h</sub>', text)
    text = re.sub(r'\bDh\b', r'D<sub>h</sub>', text)
    text = re.sub(r'\bD_e\b', r'D<sub>e</sub>', text)
    text = re.sub(r'\bDe\b', r'D<sub>e</sub>', text)
    text = re.sub(r'\bV\^2\b', r'V<sup>2</sup>', text)

    text = re.sub(r' +', ' ', text)
    return text.strip()


import os
import sys
import io
import math
from datetime import datetime

from reportlab.lib.pagesizes import letter
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, Image, KeepTogether
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.pdfgen import canvas

import project_manager
from ashrae_engine import AshraeEngine
import version_manager

BLUEPRINTS_DIR = os.path.join(os.path.dirname(__file__), "static", "blueprints")

class DuctfitNumberedCanvas(canvas.Canvas):
    """
    Two-pass canvas that adds running headers and page numbers
    matching the exact style of the official ASHRAE / AFA.pdf report.
    """
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_header_and_footer(num_pages)
            super().showPage()
        super().save()

    def draw_header_and_footer(self, total_pages):
        self.saveState()
        w, h = letter
        margin = 36 # 0.5 in margins

        # --- Top Header Line ---
        self.setStrokeColor(colors.HexColor("#334155"))
        self.setLineWidth(0.75)
        self.line(margin, h - 36, w - margin, h - 36)

        # Center Title
        cur_ver = version_manager.get_current_version()
        rep_title = getattr(self, "report_title", "DUCTFIT PRO — DUCT FITTING REPORT")
        self.setFont("Helvetica-Bold", 10)
        self.setFillColor(colors.HexColor("#0f172a"))
        self.drawCentredString(w / 2.0, h - 50, rep_title)



        # --- Bottom Footer Line ---
        self.setStrokeColor(colors.HexColor("#cbd5e1"))
        self.setLineWidth(0.75)
        self.line(margin, 42, w - margin, 42)

        # Footer Text
        date_short = datetime.now().strftime("%m-%d-%Y")
        self.setFont("Helvetica-Bold", 8)
        self.setFillColor(colors.HexColor("#475569"))
        self.drawString(margin, 30, date_short)

        self.setFont("Helvetica", 8)
        self.drawCentredString(w / 2.0, 30, f"Page {self._pageNumber} of {total_pages}")

        self.drawRightString(w - margin, 30, f"Ductfit Pro v{cur_ver}")

        self.restoreState()


class DuctfitFittingCanvas(DuctfitNumberedCanvas):
    report_title = "DUCTFIT PRO — DUCT FITTING REPORT"


class DuctfitSizerCanvas(DuctfitNumberedCanvas):
    report_title = "DUCTFIT PRO — DUCT SIZING REPORT"


def get_styles():
    base = getSampleStyleSheet()

    title_style = ParagraphStyle(
        "ReportTitle",
        parent=base["Normal"],
        fontName="Helvetica-Bold",
        fontSize=13,
        leading=16,
        alignment=1, # Center
        textColor=colors.HexColor("#0f172a")
    )

    subtitle_style = ParagraphStyle(
        "ReportSubtitle",
        parent=base["Normal"],
        fontName="Helvetica-Oblique",
        fontSize=9,
        leading=12,
        alignment=1,
        textColor=colors.HexColor("#334155")
    )

    meta_style = ParagraphStyle(
        "ProjectMeta",
        parent=base["Normal"],
        fontName="Helvetica",
        fontSize=8.5,
        leading=11,
        alignment=1,
        textColor=colors.HexColor("#0369a1")
    )

    h2_style = ParagraphStyle(
        "SectionH2",
        parent=base["Normal"],
        fontName="Helvetica-Bold",
        fontSize=10,
        leading=13,
        textColor=colors.HexColor("#1e3a8a"),
        spaceBefore=4,
        spaceAfter=3
    )

    cell_style = ParagraphStyle(
        "TableCell",
        parent=base["Normal"],
        fontName="Helvetica",
        fontSize=7.5,
        leading=9.5,
        textColor=colors.HexColor("#0f172a")
    )

    cell_bold = ParagraphStyle(
        "TableCellBold",
        parent=cell_style,
        fontName="Helvetica-Bold"
    )

    cell_right = ParagraphStyle(
        "TableCellRight",
        parent=cell_style,
        alignment=2 # Right
    )

    step_title_style = ParagraphStyle(
        "StepTitle",
        parent=base["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor("#1e3a8a")
    )

    formula_style = ParagraphStyle(
        "StepFormula",
        parent=base["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8,
        leading=10.5,
        textColor=colors.HexColor("#0f172a")
    )

    calc_text_style = ParagraphStyle(
        "StepCalcText",
        parent=base["Normal"],
        fontName="Helvetica",
        fontSize=7.5,
        leading=9.5,
        textColor=colors.HexColor("#334155")
    )

    return {
        "title": title_style,
        "subtitle": subtitle_style,
        "meta": meta_style,
        "h2": h2_style,
        "cell": cell_style,
        "cell_bold": cell_bold,
        "cell_right": cell_right,
        "step_title": step_title_style,
        "formula": formula_style,
        "calc": calc_text_style
    }


def safe_num(val, default=0.0):
    if val is None:
        return default
    try:
        f = float(val)
        return default if math.isnan(f) else f
    except (ValueError, TypeError):
        return default


def format_inputs_outputs_table(fit, data_calc, styles, unit_system="SI"):
    """
    Produces the authentic 4-column side-by-side INPUTS | OUTPUTS table
    exactly matching AFA.pdf page 1 & 2.
    """
    inputs = fit.get("inputs", {})
    code = fit.get("code", "CR11-1")
    is_si = unit_system == "SI"

    # Compile input rows
    in_rows = []
    h_in = inputs.get("H")
    w_in = inputs.get("W")
    d_in = inputs.get("D")

    if h_in is not None and w_in is not None and safe_num(h_in) > 0 and safe_num(w_in) > 0:
        in_rows.append(("Height (H, mm)" if is_si else "Height (H, in.)", f"{safe_num(h_in):.1f}"))
        in_rows.append(("Width (W, mm)" if is_si else "Width (W, in.)", f"{safe_num(w_in):.1f}"))
    elif d_in is not None and safe_num(d_in) > 0:
        in_rows.append(("Diameter (D, mm)" if is_si else "Diameter (D, in.)", f"{safe_num(d_in):.1f}"))
    elif data_calc.get("rectangular") and data_calc["rectangular"].get("H_mm"):
        rect = data_calc["rectangular"]
        in_rows.append(("Height (H, mm)" if is_si else "Height (H, in.)", f"{safe_num(rect.get('H_mm')):.1f}"))
        in_rows.append(("Width (W, mm)" if is_si else "Width (W, in.)", f"{safe_num(rect.get('W_mm')):.1f}"))

    if inputs.get("r_over_w") is not None:
        in_rows.append(("Radius Ratio (r/W)", f"{safe_num(inputs['r_over_w']):.2f}"))
    elif inputs.get("r_over_d") is not None:
        in_rows.append(("Radius Ratio (r/D)", f"{safe_num(inputs['r_over_d']):.2f}"))

    if inputs.get("theta") is not None:
        in_rows.append(("Angle (&theta;, &deg;)", f"{safe_num(inputs['theta']):.0f}"))

    if inputs.get("L") is not None:
        in_rows.append(("Length (L, m)" if is_si else "Length (L, ft)", f"{safe_num(inputs['L']):.2f}"))

    e_val = safe_num(inputs.get("e") if inputs.get("e") is not None else inputs.get("ei"), 0.09 if is_si else 0.0003)
    in_rows.append(("Absolute Roughness (&epsilon;, mm)" if is_si else "Absolute Roughness (&epsilon;, ft)", f"{e_val:.3f}"))

    q_val = safe_num(fit.get("Q") or inputs.get("Q"), 700)
    in_rows.append(("Flow Rate (Q, L/s)" if is_si else "Flow Rate (Q, cfm)", f"{q_val:.0f}"))

    rho_val = safe_num(inputs.get("rho"), 1.204 if is_si else 0.075)
    in_rows.append(("Air Density (&rho;, kg/m&sup3;)" if is_si else "Air Density (&rho;, lbm/ft&sup3;)", f"{rho_val:.3f}"))

    # Compile output rows
    out_rows = []
    raw_env = data_calc.get("raw_env", {})
    if "Cb" in raw_env and ("Cs" in raw_env or "Pos" in raw_env):
        out_rows.append(("--- BRANCH ---", ""))
        vb = safe_num(raw_env.get("Vb", data_calc.get("Vb_ms" if is_si else "velocity_fpm")))
        out_rows.append(("Velocity (Vb, m/s)" if is_si else "Velocity (Vb, fpm)", f"{vb:.1f}"))
        pvb = safe_num(raw_env.get("Pvb"))
        out_rows.append(("Vel Pres at Vb (P<sub>vb</sub>, Pa)" if is_si else "Vel Pres at Vb (P<sub>vb</sub>, in. wg)", f"{pvb:.0f}" if is_si else f"{pvb:.2f}"))
        cb = safe_num(raw_env.get("Cb", data_calc.get("Cb")))
        out_rows.append(("Loss Coeff (C<sub>b</sub>)", f"{cb:.2f}"))
        pob = safe_num(raw_env.get("Pob", data_calc.get("Pob_pa" if is_si else "Pob_in_wg")))
        out_rows.append(("Branch Loss (&Delta;P<sub>b</sub>, Pa)" if is_si else "Branch Loss (&Delta;P<sub>b</sub>, in. wg)", f"{pob:.0f}" if is_si else f"{pob:.2f}"))

        out_rows.append(("--- MAIN ---", ""))
        vs = safe_num(raw_env.get("Vs", data_calc.get("Vs_ms")))
        out_rows.append(("Velocity (Vs, m/s)" if is_si else "Velocity (Vs, fpm)", f"{vs:.1f}"))
        vc = safe_num(raw_env.get("Vc"))
        if vc:
            out_rows.append(("Velocity (Vc, m/s)" if is_si else "Velocity (Vc, fpm)", f"{vc:.1f}"))
        pvc = safe_num(raw_env.get("Pvc"))
        if pvc:
            out_rows.append(("Vel Pres at Vc (P<sub>vc</sub>, Pa)" if is_si else "Vel Pres at Vc (P<sub>vc</sub>, in. wg)", f"{pvc:.0f}" if is_si else f"{pvc:.2f}"))
        cs = safe_num(raw_env.get("Cs", data_calc.get("Cs")))
        out_rows.append(("Loss Coeff (C<sub>s</sub>)", f"{cs:.2f}"))
        pos = safe_num(raw_env.get("Pos", data_calc.get("Pos_pa" if is_si else "Pos_in_wg")))
        out_rows.append(("Main Loss (&Delta;P<sub>s</sub>, Pa)" if is_si else "Main Loss (&Delta;P<sub>s</sub>, in. wg)", f"{pos:.0f}" if is_si else f"{pos:.2f}"))
    else:
        v_val = safe_num(fit.get("velocity", data_calc.get("velocity_ms", 7.8)))
        out_rows.append(("Velocity (V, m/s)" if is_si else "Velocity (V, fpm)", f"{v_val:.1f}"))

        pv_val = safe_num(fit.get("pv", data_calc.get("pv_pa", 36.0)))
        out_rows.append(("Velocity Pressure (P<sub>v</sub>, Pa)" if is_si else "Velocity Pressure (P<sub>v</sub>, in. wg)", f"{pv_val:.1f}"))

        f_or_co = safe_num(fit.get("f_or_Co", data_calc.get("C", data_calc.get("f", 0.0183))))
        coeff_name = "Friction Factor (f)" if fit.get("coeff_type") == "f" or code in ["CR11-1", "CD11-1", "CF11-1"] else "Loss Coefficient (Co)"
        out_rows.append((coeff_name, f"{f_or_co:.4f}"))

        dp_val = safe_num(fit.get("dp", data_calc.get("pressure_loss_pa", 2.2)))
        out_rows.append(("Pressure Loss (&Delta;P, Pa)" if is_si else "Pressure Loss (&Delta;P, in. wg)", f"{dp_val:.2f}"))

    qty = int(safe_num(fit.get("qty", 1), 1))
    if qty > 1:
        out_rows.append(("Quantity", f"{qty}"))
        tot_dp = safe_num(fit.get("total_dp"), dp_val * qty)
        out_rows.append(("Total Section Loss (&Delta;P, Pa)" if is_si else "Total Section Loss (&Delta;P, in. wg)", f"{tot_dp:.2f}"))

    de_val = safe_num(data_calc.get("De_mm") or fit.get("De"))
    if de_val > 0:
        out_rows.append(("Equivalent Diameter (D<sub>e</sub>, mm)" if is_si else "Eq. Diam (D<sub>e</sub>, in.)", f"{de_val:.0f}"))


    # Combine into 4-column table
    max_len = max(len(in_rows), len(out_rows))
    table_data = [
        [
            Paragraph("<b>INPUTS</b>", styles["cell_bold"]),
            "",
            Paragraph("<b>OUTPUTS</b>", styles["cell_bold"]),
            ""
        ]
    ]

    for i in range(max_len):
        in_lbl = in_rows[i][0] if i < len(in_rows) else ""
        in_v = in_rows[i][1] if i < len(in_rows) else ""
        out_lbl = out_rows[i][0] if i < len(out_rows) else ""
        out_v = out_rows[i][1] if i < len(out_rows) else ""

        table_data.append([
            Paragraph(in_lbl, styles["cell"]),
            Paragraph(in_v, styles["cell_right"]),
            Paragraph(out_lbl, styles["cell"]),
            Paragraph(out_v, styles["cell_right"])
        ])

    col_widths = [160, 95, 170, 95] # Total = 520pt (matches 8.5in - 2*36pt = 540pt printable)
    t = Table(table_data, colWidths=col_widths)
    t.setStyle(TableStyle([
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#000000")),
        ('BACKGROUND', (0, 0), (1, 0), colors.HexColor("#f8fafc")),
        ('BACKGROUND', (2, 0), (3, 0), colors.HexColor("#f8fafc")),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 2),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
        ('RIGHTPADDING', (0, 0), (-1, -1), 4),
    ]))
    return t


def format_sizer_inputs_outputs_table(seg, data_calc, styles, unit_system="SI"):
    """
    Produces the authentic 4-column side-by-side INPUTS | OUTPUTS table
    specifically for Auto Duct Sizer sections.
    """
    is_si = unit_system == "SI"
    rect = data_calc.get("rectangular") if isinstance(data_calc, dict) else {}
    if not rect:
        rect = data_calc or {}
    round_d = data_calc.get("round") if isinstance(data_calc, dict) else {}
    if not round_d:
        round_d = {}

    shape = seg.get("shape", rect.get("shape", "rect"))
    is_round = shape == "round"

    # Inputs rows
    in_rows = []

    q_val = safe_num(seg.get("Q"), rect.get("Q_Lps" if is_si else "Q_cfm", 1200))
    in_rows.append(("Design Airflow (Q, L/s)" if is_si else "Design Airflow (Q, cfm)", f"{q_val:.0f}"))

    tgt_type = seg.get("target_type", data_calc.get("target_type", "friction"))
    tgt_val = safe_num(seg.get("target_val", data_calc.get("target_val", 0.82)))
    if tgt_type == "velocity":
        tgt_str = f"Velocity: {tgt_val:.1f} m/s" if is_si else f"Velocity: {tgt_val:.0f} fpm"
    else:
        tgt_str = f"Equal Friction: {tgt_val:.2f} Pa/m" if is_si else f"Equal Friction: {tgt_val:.3f} in./100ft"
    in_rows.append(("Sizing Criterion Target", tgt_str))

    in_rows.append(("Duct Geometry / Shape", "Round Circular" if is_round else "Rectangular Commercial"))

    if not is_round and rect.get("H_mm"):
        h_val = rect.get("H_mm") if is_si else (rect.get("H_in") or rect.get("H_mm") / 25.4)
        in_rows.append(("Height Constraint (H, mm)" if is_si else "Height Constraint (H, in.)", f"{safe_num(h_val):.1f}"))

    len_val = safe_num(seg.get("length", rect.get("L_m" if is_si else "L_ft", 1.0)))
    in_rows.append(("Duct Run Length (L, m)" if is_si else "Duct Run Length (L, ft)", f"{len_val:.1f}"))

    e_val = safe_num(rect.get("e_mm" if is_si else "e_ft", 0.09 if is_si else 0.0003))
    in_rows.append(("Absolute Roughness (&epsilon;, mm)" if is_si else "Roughness (&epsilon;, ft)", f"{e_val:.3f}"))

    rho_val = safe_num(rect.get("rho", 1.204 if is_si else 0.075))
    in_rows.append(("Air Density (&rho;, kg/m&sup3;)" if is_si else "Air Density (&rho;, lbm/ft&sup3;)", f"{rho_val:.3f}"))

    # Outputs rows
    out_rows = []

    dim_str = seg.get("dimensions")
    if not dim_str:
        if is_round:
            d_val = round_d.get("D_nom_mm" if is_si else "D_nom_in") or round_d.get("D_exact_mm", 450)
            dim_str = f"Dia. {d_val:.0f} mm" if is_si else f"Dia. {d_val:.1f} in."
        else:
            w_val = rect.get("W_mm" if is_si else "W_in", 600)
            h_val = rect.get("H_mm" if is_si else "H_in", 400)
            dim_str = f"{w_val:.0f} x {h_val:.0f} mm" if is_si else f"{w_val:.1f} x {h_val:.1f} in."
    out_rows.append(("Sized Duct Dimensions", dim_str))

    v_val = safe_num(seg.get("velocity", rect.get("velocity_ms" if is_si else "velocity_fpm", round_d.get("velocity_exact_ms", 5.0))))
    out_rows.append(("Mean Air Velocity (V, m/s)" if is_si else "Mean Velocity (V, fpm)", f"{v_val:.2f}"))

    pv_val = safe_num(rect.get("pv_pa" if is_si else "pv_in_wg", round_d.get("pv_exact_pa", 15.0)))
    out_rows.append(("Velocity Pressure (P<sub>v</sub>, Pa)" if is_si else "Velocity Pressure (P<sub>v</sub>, in. wg)", f"{pv_val:.1f}"))

    f_val = safe_num(rect.get("f", round_d.get("f_exact", 0.0169)))
    out_rows.append(("Darcy Friction Factor (f)", f"{f_val:.4f}"))

    fr_val = safe_num(seg.get("friction_rate", rect.get("friction_rate_pa_m" if is_si else "friction_rate_in_100ft", 0.82)))
    out_rows.append(("Friction Rate (&Delta;P<sub>f</sub>/L, Pa/m)" if is_si else "Friction Rate (&Delta;P<sub>f</sub>/L, in./100ft)", f"{fr_val:.2f}"))

    tot_dp = safe_num(seg.get("dp", fr_val * len_val))
    out_rows.append(("Total Section Head Loss (&Delta;P, Pa)" if is_si else "Total Head Loss (&Delta;P, in. wg)", f"{tot_dp:.2f}"))

    de_val = safe_num(rect.get("De_mm" if is_si else "De_in", round_d.get("D_exact_mm", 532)))
    out_rows.append(("Equivalent Diameter (D<sub>e</sub>, mm)" if is_si else "Eq. Diam (D<sub>e</sub>, in.)", f"{de_val:.1f}"))

    if not is_round and rect.get("aspect_ratio"):
        ar_val = safe_num(rect.get("aspect_ratio", 1.5))
        out_rows.append(("Aspect Ratio (W/H)", f"{ar_val:.2f}"))

    area_val = safe_num(rect.get("area_m2" if is_si else "area_ft2", round_d.get("area_exact_m2", 0.24)))
    out_rows.append(("Internal Flow Area (A, m&sup2;)" if is_si else "Internal Flow Area (A, ft&sup2;)", f"{area_val:.3f}"))

    re_val = safe_num(rect.get("reynolds", round_d.get("reynolds_exact", 150000)))
    out_rows.append(("Reynolds Number (Re)", f"{re_val:,.0f}"))

    # Combine into 4-column table
    max_len = max(len(in_rows), len(out_rows))
    table_data = [
        [
            Paragraph("<b>INPUTS &amp; DESIGN CRITERIA</b>", styles["cell_bold"]),
            "",
            Paragraph("<b>OUTPUTS &amp; SIZING PARAMETERS</b>", styles["cell_bold"]),
            ""
        ]
    ]

    for i in range(max_len):
        in_lbl = in_rows[i][0] if i < len(in_rows) else ""
        in_v = in_rows[i][1] if i < len(in_rows) else ""
        out_lbl = out_rows[i][0] if i < len(out_rows) else ""
        out_v = out_rows[i][1] if i < len(out_rows) else ""

        table_data.append([
            Paragraph(in_lbl, styles["cell"]),
            Paragraph(in_v, styles["cell_right"]),
            Paragraph(out_lbl, styles["cell"]),
            Paragraph(out_v, styles["cell_right"])
        ])

    col_widths = [160, 95, 170, 95] # 520pt total
    t = Table(table_data, colWidths=col_widths)
    t.setStyle(TableStyle([
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#000000")),
        ('BACKGROUND', (0, 0), (1, 0), colors.HexColor("#f0f9ff")),
        ('BACKGROUND', (2, 0), (3, 0), colors.HexColor("#f0fdf4")),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 2.5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2.5),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
        ('RIGHTPADDING', (0, 0), (-1, -1), 4),
    ]))
    return t


def build_calculation_steps_table(steps, styles):
    """
    Renders the 4-step engineering breakdown into a clean ReportLab table.
    """
    if not steps:
        return Paragraph("<i>No engineering calculation steps available.</i>", styles["cell"])

    story = []
    for s in steps:
        step_lbl = s.get("step_label", f"STEP {s.get('step_num', 1)}")
        step_title = s.get("title", "")
        raw_cit = s.get("citation", "")
        citation = clean_pdf_text(raw_cit)
        citation = citation.replace("2021 ASHRAE Handbook—Fundamentals", "ASHRAE Fundamentals")
        citation = citation.replace("2021 ASHRAE Handbook-Fundamentals", "ASHRAE Fundamentals")
        citation = citation.replace("2021 ASHRAE", "ASHRAE")
        citation = citation.replace("2021 ", "")
        
        raw_formula = s.get("formula") or s.get("governing_latex") or ""
        formula = clean_pdf_text(raw_formula)

        raw_subst = s.get("substitution")
        if not raw_subst:
            deriv = s.get("derivation_latex")
            if isinstance(deriv, list):
                raw_subst = " &bull; ".join(deriv)
            elif deriv:
                raw_subst = str(deriv)
            else:
                raw_subst = ""
        subst = clean_pdf_text(raw_subst)

        raw_res = s.get("result") or s.get("framed_result_latex") or s.get("result_latex") or ""
        res = clean_pdf_text(raw_res)

        header_p = Paragraph(f"<b>{clean_pdf_text(step_lbl)}: {clean_pdf_text(step_title)}</b> &nbsp;&nbsp;<font size=6 color='#64748b'>({clean_pdf_text(citation)})</font>", styles["step_title"])
        formula_p = Paragraph(f"<b>Formulation:</b> {formula}", styles["formula"])
        subst_p = Paragraph(f"<b>Substitution:</b> {subst.replace(chr(10), ' &bull; ')}", styles["calc"])
        res_p = Paragraph(f"<b>Result:</b> <font color='#166534'><b>{res}</b></font>", styles["formula"])

        step_table = Table([[header_p], [formula_p], [subst_p], [res_p]], colWidths=[520])
        step_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#fdfdfb")),
            ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
            ('LINELEFT', (0, 0), (0, -1), 2.5, colors.HexColor("#1e3a8a")),
            ('TOPPADDING', (0, 0), (-1, -1), 2),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
            ('LEFTPADDING', (0, 0), (-1, -1), 6),
            ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ]))

        story.append(step_table)
        story.append(Spacer(1, 4))

    return story


def generate_project_pdf(project_id, output_path=None):
    """
    Generates a master PDF report:
    - Page 1: Project Master Specification & Fitting Schedule Table
    - Page 2..N: Dedicated separate page for EVERY fitting in the project
                 with Inputs/Outputs table, Blueprint CAD Diagram, and Step-by-Step Breakdown!
    """
    project = project_manager.get_project(project_id)
    if not project:
        raise ValueError(f"Project with ID '{project_id}' not found.")

    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        output_path or buf,
        pagesize=letter,
        leftMargin=36,
        rightMargin=36,
        topMargin=64, # Space for running header
        bottomMargin=50 # Space for running footer
    )

    styles = get_styles()
    story = []
    unit_system = project.get("unit_system", "SI")
    is_si = unit_system == "SI"
    dp_unit = "Pa" if is_si else "in. wg"
    flow_unit = "L/s" if is_si else "cfm"
    vel_unit = "m/s" if is_si else "fpm"

    fittings = project.get("fittings", [])

    # =========================================================================
    # PAGE 1: MASTER PROJECT SUMMARY & DUCT FITTING SCHEDULE
    # =========================================================================
    story.append(Paragraph("PROJECT DUCT FITTING SCHEDULE &amp; ENGINEERING ANALYSIS", styles["title"]))
    story.append(Paragraph("ASHRAE Fundamentals, Ch. 21: Duct Design", styles["subtitle"]))
    story.append(Spacer(1, 8))

    # Project Specification Box
    spec_data = [
        [
            Paragraph("<b>Project Code:</b>", styles["cell_bold"]),
            Paragraph(project.get("code", "-"), styles["cell"]),
            Paragraph("<b>Client:</b>", styles["cell_bold"]),
            Paragraph(project.get("client") or "(Not specified)", styles["cell"])
        ],
        [
            Paragraph("<b>Project Name:</b>", styles["cell_bold"]),
            Paragraph(project.get("name", "-"), styles["cell"]),
            Paragraph("<b>Contractor:</b>", styles["cell_bold"]),
            Paragraph(project.get("contractor") or "(Not specified)", styles["cell"])
        ],
        [
            Paragraph("<b>System / Notes:</b>", styles["cell_bold"]),
            Paragraph(project.get("notes") or "HVAC Air Distribution Network", styles["cell"]),
            Paragraph("<b>Sub Contractor:</b>", styles["cell_bold"]),
            Paragraph(project.get("subcontractor") or "(Not specified)", styles["cell"])
        ],
        [
            Paragraph("<b>Standard Edition:</b>", styles["cell_bold"]),
            Paragraph("ANSI / ASHRAE Fundamentals (Ch. 21)", styles["cell"]),
            Paragraph("<b>Date Generated:</b>", styles["cell_bold"]),
            Paragraph(datetime.now().strftime("%d %B %Y"), styles["cell"])
        ]
    ]

    t_spec = Table(spec_data, colWidths=[90, 180, 80, 170])
    t_spec.setStyle(TableStyle([
        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor("#0369a1")),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ('LEFTPADDING', (0, 0), (-1, -1), 5),
        ('RIGHTPADDING', (0, 0), (-1, -1), 5),
    ]))
    story.append(t_spec)
    story.append(Spacer(1, 8))

    # Calculate Totals
    total_qty = sum(int(f.get("qty", 1)) for f in fittings)
    cum_dp = sum(float(f.get("total_dp", f.get("dp", 0)) or 0) for f in fittings)
    max_dp = max((float(f.get("dp", 0) or 0) for f in fittings), default=0.0)

    # KPI Statistics Row
    kpi_data = [
        [
            Paragraph(f"<b>TOTAL FITTINGS:</b> {len(fittings)} ({total_qty} pcs)", styles["cell_bold"]),
            Paragraph(f"<b>CUMULATIVE DYNAMIC LOSS (&Sigma;&Delta;P):</b> <font color='#166534'><b>{cum_dp:.1f} {dp_unit}</b></font>", styles["cell_bold"]),
            Paragraph(f"<b>MAX SINGLE LOSS:</b> {max_dp:.1f} {dp_unit}", styles["cell_bold"])
        ]
    ]
    t_kpi = Table(kpi_data, colWidths=[170, 200, 150])
    t_kpi.setStyle(TableStyle([
        ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor("#166534")),
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#f0fdf4")),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]))
    story.append(t_kpi)
    story.append(Spacer(1, 10))

    # Master Schedule Table
    story.append(Paragraph("<b>MASTER DUCT FITTING SCHEDULE (ASHRAE FITTING DATABASE MODEL)</b>", styles["h2"]))

    sched_headers = [
        Paragraph("<b>#</b>", styles["cell_bold"]),
        Paragraph("<b>Tag / Mark</b>", styles["cell_bold"]),
        Paragraph("<b>Code</b>", styles["cell_bold"]),
        Paragraph("<b>Description</b>", styles["cell_bold"]),
        Paragraph("<b>Shape</b>", styles["cell_bold"]),
        Paragraph("<b>Dimensions</b>", styles["cell_bold"]),
        Paragraph(f"<b>Q ({flow_unit})</b>", styles["cell_bold"]),
        Paragraph(f"<b>V ({vel_unit})</b>", styles["cell_bold"]),
        Paragraph("<b>Co / f</b>", styles["cell_bold"]),
        Paragraph(f"<b>&Delta;P ({dp_unit})</b>", styles["cell_bold"]),
        Paragraph("<b>Qty</b>", styles["cell_bold"]),
        Paragraph(f"<b>Total &Delta;P ({dp_unit})</b>", styles["cell_bold"])
    ]
    sched_rows = [sched_headers]

    for idx, fit in enumerate(fittings):
        q = float(fit.get("Q", 0) or 0)
        v = float(fit.get("velocity", 0) or 0)
        coeff = float(fit.get("f_or_Co", 0) or 0)
        dp = float(fit.get("dp", 0) or 0)
        qty = int(fit.get("qty", 1) or 1)
        tot_dp = float(fit.get("total_dp", dp * qty) or 0)

        sched_rows.append([
            Paragraph(str(idx + 1), styles["cell"]),
            Paragraph(f"<b>{fit.get('tag', f'FIT-{idx+1}')}</b>", styles["cell"]),
            Paragraph(fit.get("code", "-"), styles["cell_bold"]),
            Paragraph(fit.get("name", "-"), styles["cell"]),
            Paragraph(fit.get("shape", "rect").upper(), styles["cell"]),
            Paragraph(fit.get("dimensions", "-"), styles["cell"]),
            Paragraph(f"{q:.0f}", styles["cell_right"]),
            Paragraph(f"{v:.1f}", styles["cell_right"]),
            Paragraph(f"{coeff:.4f}", styles["cell_right"]),
            Paragraph(f"{dp:.1f}", styles["cell_right"]),
            Paragraph(str(qty), styles["cell_right"]),
            Paragraph(f"<b>{tot_dp:.1f}</b>", styles["cell_right"])
        ])

    # Summary Row
    sched_rows.append([
        "", "", "", Paragraph("<b>CUMULATIVE PROJECT DYNAMIC LOSS (&Sigma;&Delta;P):</b>", styles["cell_bold"]),
        "", "", "", "", "", "",
        Paragraph(f"<b>{total_qty}</b>", styles["cell_right"]),
        Paragraph(f"<b>{cum_dp:.1f} {dp_unit}</b>", styles["cell_right"])
    ])

    sched_widths = [22, 60, 48, 120, 36, 68, 36, 32, 36, 32, 24, 46] # 520pt total
    t_sched = Table(sched_rows, colWidths=sched_widths, repeatRows=1)
    t_sched.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#e2e8f0")),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.HexColor("#0f172a")),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor("#94a3b8")),
        ('LINEBELOW', (0, 0), (-1, 0), 1.5, colors.HexColor("#94a3b8")),
        ('ROWBACKGROUNDS', (0, 1), (-1, -2), [colors.white, colors.HexColor("#f8fafc")]),
        ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor("#e2e8f0")),
        ('SPAN', (0, -1), (2, -1)),
        ('SPAN', (3, -1), (9, -1)),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ('LEFTPADDING', (0, 0), (-1, -1), 3),
        ('RIGHTPADDING', (0, 0), (-1, -1), 3),
    ]))
    story.append(t_sched)

    # =========================================================================
    # PAGES 2..N: DEDICATED SEPARATE PAGE FOR EVERY FITTING
    # =========================================================================
    for idx, fit in enumerate(fittings):
        story.append(PageBreak())

        code = fit.get("code", "CR11-1")
        name = fit.get("name", "Duct Section")
        tag = fit.get("tag", f"FIT-{idx+1}")
        inputs = fit.get("inputs", {})

        # Compute or fetch step-by-step engineering breakdown
        calc_res = {}
        steps = []
        try:
            if code.startswith("SIZE-"):
                # Sizing mode fitting
                target_val = safe_num(inputs.get("target_hf"), 0.8 if is_si else 0.10)
                q_val = safe_num(inputs.get("Q"), 300 if is_si else 636)
                shape = fit.get("shape", "rect")
                h_val = safe_num(inputs.get("H"), 300 if is_si else 12)
                calc_res = AshraeEngine.size_duct(
                    Q_Lps=q_val, target_type="friction", target_val=target_val,
                    shape=shape, fixed_dim=h_val, fixed_type="H" if h_val > 0 else "NONE", unit_system=unit_system
                )
            else:
                calc_res = AshraeEngine.calculate_fitting(code, inputs, unit_system)
            steps = calc_res.get("steps", [])
        except Exception as e:
            print(f"Error calculating steps for {code}: {e}")

        # Fitting Header
        story.append(Paragraph(f"({code})  {name}", styles["title"]))
        raw_cit = calc_res.get("citation") or "(ASHRAE Fundamentals, Ch. 21: Duct Design)"
        citation = raw_cit.replace("2021 ASHRAE Handbook—Fundamentals Chapter 21: Duct Design", "ASHRAE Fundamentals, Ch. 21: Duct Design").replace("2021 ASHRAE Handbook—Fundamentals", "ASHRAE Fundamentals, Ch. 21").replace("2021 ", "")
        story.append(Paragraph(f"<i>{citation}</i>", styles["subtitle"]))

        subhead_text = f"<b>Item #{idx+1}</b> &bull; Mark / Tag: <b>{tag}</b> &bull; Project: <b>{project.get('code')}</b> &bull; Client: <b>{project.get('client') or 'N/A'}</b>"
        story.append(Paragraph(subhead_text, styles["meta"]))
        story.append(Spacer(1, 6))

        # Inputs & Outputs 4-Column Table (Authentic AFA.pdf style)
        t_io = format_inputs_outputs_table(fit, calc_res, styles, unit_system)
        story.append(t_io)
        story.append(Spacer(1, 8))

        # Blueprint Image (Centered, exact visual match to AFA.pdf CAD section)
        img_path = os.path.join(BLUEPRINTS_DIR, f"{code}.png")
        if not os.path.exists(img_path) and code == "SIZE-AUTO":
            img_path = os.path.join(BLUEPRINTS_DIR, "CR11-1.png")

        if os.path.exists(img_path):
            try:
                # Target max height ~110pt so everything fits on a single sheet
                img = Image(img_path, width=280, height=110)
                img.hAlign = 'CENTER'
                story.append(img)
                story.append(Spacer(1, 6))
            except Exception as e:
                print(f"Error loading image {img_path}: {e}")

        # Step-by-Step Engineering Calculation Breakdown
        story.append(Paragraph("<b>STEP-BY-STEP ENGINEERING CALCULATION BREAKDOWN</b>", styles["h2"]))
        steps_table_story = build_calculation_steps_table(steps, styles)
        if isinstance(steps_table_story, list):
            story.extend(steps_table_story)
        else:
            story.append(steps_table_story)

    # Build the document
    doc.build(story, canvasmaker=DuctfitFittingCanvas)

    if output_path:
        return output_path
    else:
        pdf_bytes = buf.getvalue()
        buf.close()
        return pdf_bytes


def generate_sizer_project_pdf(project_id, output_path=None):
    """
    Generates an official Ductfit Pro Duct Sizing Project Report:
    - Running header: DUCTFIT PRO — DUCT SIZING REPORT
    - Master Project Specification & Sized Duct Schedule Table
    - Step-by-Step Engineering Methodology & Governing Formulations
    - STRICTLY EXCLUDES CAD drawings and fitting loss items (kept separate per engineering scope)
    """
    project = project_manager.get_project(project_id)
    if not project:
        raise ValueError(f"Project with ID '{project_id}' not found.")

    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        output_path or buf,
        pagesize=letter,
        leftMargin=36,
        rightMargin=36,
        topMargin=64,
        bottomMargin=50
    )

    styles = get_styles()
    story = []
    unit_system = project.get("unit_system", "SI")
    is_si = unit_system == "SI"
    dp_unit = "Pa" if is_si else "in. wg"
    flow_unit = "L/s" if is_si else "cfm"
    vel_unit = "m/s" if is_si else "fpm"
    len_unit = "m" if is_si else "ft"
    fr_unit = "Pa/m" if is_si else "in. wg/100ft"

    segments = project.get("duct_segments", [])

    # Master Header
    story.append(Paragraph("PROJECT DUCT SIZING SCHEDULE &amp; ENGINEERING ANALYSIS", styles["title"]))
    story.append(Paragraph("ASHRAE Fundamentals, Ch. 21: Equal Friction &amp; Velocity Sizing Methods", styles["subtitle"]))
    story.append(Spacer(1, 8))

    # Project Specification Box
    spec_data = [
        [
            Paragraph("<b>Project Code:</b>", styles["cell_bold"]),
            Paragraph(project.get("code", "-"), styles["cell"]),
            Paragraph("<b>Client:</b>", styles["cell_bold"]),
            Paragraph(project.get("client") or "(Not specified)", styles["cell"])
        ],
        [
            Paragraph("<b>Project Name:</b>", styles["cell_bold"]),
            Paragraph(project.get("name", "-"), styles["cell"]),
            Paragraph("<b>Contractor:</b>", styles["cell_bold"]),
            Paragraph(project.get("contractor") or "(Not specified)", styles["cell"])
        ],
        [
            Paragraph("<b>System / Scope:</b>", styles["cell_bold"]),
            Paragraph(project.get("notes") or "HVAC Air Distribution Network - Duct Sizing", styles["cell"]),
            Paragraph("<b>Sub Contractor:</b>", styles["cell_bold"]),
            Paragraph(project.get("subcontractor") or "(Not specified)", styles["cell"])
        ],
        [
            Paragraph("<b>Design Standard:</b>", styles["cell_bold"]),
            Paragraph("ANSI / ASHRAE Fundamentals (Ch. 21)", styles["cell"]),
            Paragraph("<b>Date Generated:</b>", styles["cell_bold"]),
            Paragraph(datetime.now().strftime("%d %B %Y"), styles["cell"])
        ]
    ]

    t_spec = Table(spec_data, colWidths=[90, 180, 80, 170])
    t_spec.setStyle(TableStyle([
        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor("#0284c7")),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ('LEFTPADDING', (0, 0), (-1, -1), 5),
        ('RIGHTPADDING', (0, 0), (-1, -1), 5),
    ]))
    story.append(t_spec)
    story.append(Spacer(1, 8))

    # Calculate Totals
    total_segments = len(segments)
    total_length = sum(float(s.get("length", 0) or 0) for s in segments)
    cum_dp = sum(float(s.get("dp", 0) or 0) for s in segments)
    avg_fr = (cum_dp / total_length) if total_length > 0 else 0.0

    # KPI Statistics Row
    kpi_data = [
        [
            Paragraph(f"<b>SIZED RUNS:</b> {total_segments} sections", styles["cell_bold"]),
            Paragraph(f"<b>TOTAL RUN LENGTH:</b> {total_length:.1f} {len_unit}", styles["cell_bold"]),
            Paragraph(f"<b>TOTAL DUCT LOSS (&Sigma;&Delta;P):</b> <font color='#166534'><b>{cum_dp:.1f} {dp_unit}</b></font>", styles["cell_bold"]),
            Paragraph(f"<b>AVG FRICTION:</b> {avg_fr:.2f} {fr_unit}", styles["cell_bold"])
        ]
    ]
    t_kpi = Table(kpi_data, colWidths=[110, 130, 170, 110])
    t_kpi.setStyle(TableStyle([
        ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor("#0284c7")),
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#f0f9ff")),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]))
    story.append(t_kpi)
    story.append(Spacer(1, 10))

    # Master Duct Sizing Schedule Table
    story.append(Paragraph("<b>MASTER SIZED DUCT SCHEDULE (EQUAL FRICTION / VELOCITY METHODS)</b>", styles["h2"]))

    sched_headers = [
        Paragraph("<b>#</b>", styles["cell_bold"]),
        Paragraph("<b>Tag / Ref</b>", styles["cell_bold"]),
        Paragraph("<b>Section / Room</b>", styles["cell_bold"]),
        Paragraph("<b>Shape</b>", styles["cell_bold"]),
        Paragraph("<b>Dimensions</b>", styles["cell_bold"]),
        Paragraph(f"<b>Q ({flow_unit})</b>", styles["cell_bold"]),
        Paragraph(f"<b>V ({vel_unit})</b>", styles["cell_bold"]),
        Paragraph(f"<b>Eq. D<sub>e</sub></b>", styles["cell_bold"]),
        Paragraph("<b>AR</b>", styles["cell_bold"]),
        Paragraph(f"<b>Rate (&Delta;P<sub>f</sub>/L)</b>", styles["cell_bold"]),
        Paragraph(f"<b>L ({len_unit})</b>", styles["cell_bold"]),
        Paragraph(f"<b>&Delta;P ({dp_unit})</b>", styles["cell_bold"])
    ]
    sched_rows = [sched_headers]

    for idx, seg in enumerate(segments):
        q = float(seg.get("Q", 0) or 0)
        v = float(seg.get("velocity", 0) or 0)
        fr = float(seg.get("friction_rate", 0) or 0)
        length = float(seg.get("length", 1) or 1)
        dp = float(seg.get("dp", fr * length) or 0)
        de = seg.get("De", "-")
        ar = seg.get("aspect_ratio", "-")

        sched_rows.append([
            Paragraph(str(idx + 1), styles["cell"]),
            Paragraph(f"<b>{seg.get('tag', f'DS-{idx+1}')}</b>", styles["cell"]),
            Paragraph(seg.get("section_name", f"Section {idx+1}"), styles["cell"]),
            Paragraph(seg.get("shape", "rect").upper(), styles["cell"]),
            Paragraph(f"<b>{seg.get('dimensions', '-')}</b>", styles["cell_bold"]),
            Paragraph(f"{q:.0f}", styles["cell_right"]),
            Paragraph(f"{v:.1f}", styles["cell_right"]),
            Paragraph(str(de), styles["cell_right"]),
            Paragraph(str(ar), styles["cell_right"]),
            Paragraph(f"{fr:.2f}", styles["cell_right"]),
            Paragraph(f"{length:.1f}", styles["cell_right"]),
            Paragraph(f"<b>{dp:.1f}</b>", styles["cell_right"])
        ])

    if not segments:
        sched_rows.append([
            "", "", Paragraph("<i>No sized duct sections added to this project yet.</i>", styles["cell"]),
            "", "", "", "", "", "", "", "", ""
        ])

    # Summary Row
    sched_rows.append([
        "", "", "", Paragraph("<b>CUMULATIVE DUCT RUN TOTALS (&Sigma;&Delta;P):</b>", styles["cell_bold"]),
        "", "", "", "", "", "",
        Paragraph(f"<b>{total_length:.1f} {len_unit}</b>", styles["cell_right"]),
        Paragraph(f"<b>{cum_dp:.1f} {dp_unit}</b>", styles["cell_right"])
    ])

    sched_widths = [20, 50, 95, 34, 75, 40, 35, 40, 30, 43, 30, 48] # 520pt total
    t_sched = Table(sched_rows, colWidths=sched_widths, repeatRows=1)
    t_sched.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#e2e8f0")),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.HexColor("#0f172a")),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor("#94a3b8")),
        ('LINEBELOW', (0, 0), (-1, 0), 1.5, colors.HexColor("#94a3b8")),
        ('ROWBACKGROUNDS', (0, 1), (-1, -2), [colors.white, colors.HexColor("#f8fafc")]),
        ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor("#e2e8f0")),
        ('SPAN', (0, -1), (2, -1)),
        ('SPAN', (3, -1), (9, -1)),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ('LEFTPADDING', (0, 0), (-1, -1), 3),
        ('RIGHTPADDING', (0, 0), (-1, -1), 3),
    ]))
    story.append(t_sched)
    story.append(Spacer(1, 12))

    # Engineering Calculation Methodology Breakdown Box
    story.append(Paragraph("<b>STEP-BY-STEP ENGINEERING CALCULATION METHODOLOGY</b>", styles["h2"]))

    method_data = [
        [
            Paragraph("<b>1. Continuity Equation & Mean Velocity:</b><br/>"
                      "<i>Q = V &times; A &rarr; V = Q / A</i><br/>"
                      "Determines the duct mean air velocity from volumetric design flow rate and active cross-sectional area.", styles["calc"]),
            Paragraph("<b>2. Huebscher Circular Equivalent Diameter:</b><br/>"
                      "<i>D<sub>e</sub> = 1.30 &times; (a &bull; b)<sup>0.625</sup> / (a + b)<sup>0.25</sup></i> &nbsp;&nbsp;(ASHRAE Fundamentals Eq. 25)<br/>"
                      "Equates rectangular duct dimensions <i>a &times; b</i> to equal friction and capacity round duct equivalent diameter.", styles["calc"])
        ],
        [
            Paragraph("<b>3. Dynamic Velocity Pressure:</b><br/>"
                      "<i>P<sub>v</sub> = 0.5 &times; &rho; &times; V<sup>2</sup></i><br/>"
                      "Evaluated at standard atmospheric air density &rho; = 1.204 kg/m&sup3; (0.075 lbm/ft&sup3;).", styles["calc"]),
            Paragraph("<b>4. Darcy-Weisbach &amp; Colebrook Friction Loss:</b><br/>"
                      "<i>&Delta;P<sub>f</sub> = [ f &times; (1/D<sub>h</sub>) &times; (0.5 &rho; V<sup>2</sup>) ] &times; L</i><br/>"
                      "Friction factor <i>f</i> determined via iterative solution of Colebrook implicit equation (Eq. 19).", styles["calc"])
        ]
    ]

    t_method = Table(method_data, colWidths=[255, 265])
    t_method.setStyle(TableStyle([
        ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
    ]))
    story.append(t_method)

    # Detailed Step-by-Step Pages for each segment (Inputs/Outputs Table & Step Calculations ONLY, NO CAD Drawing)
    for idx, seg in enumerate(segments):
        steps = seg.get("steps", [])
        calc_res = {}
        try:
            q_val = float(seg.get("Q", 300) or 300)
            shape = seg.get("shape", "rect")
            target_val = float(seg.get("friction_rate", 0.8) or 0.8)
            len_val = float(seg.get("length", 1) or 1)
            dims = seg.get("dimensions", "")
            h_val = 0
            if "x" in dims.lower():
                parts = dims.lower().split("x")
                try:
                    h_val = float(parts[1].replace("mm", "").replace("in.", "").strip())
                except Exception:
                    pass
            calc_res = AshraeEngine.size_duct(
                Q_Lps=q_val if is_si else (q_val / 2.11888),
                target_type=seg.get("target_type", "friction"),
                target_val=target_val if is_si else (target_val * (249.0889 / 30.48)),
                shape=shape,
                fixed_dim=h_val,
                fixed_type="H" if h_val > 0 else "NONE",
                L_m=len_val if is_si else (len_val / 3.28084),
                unit_system=unit_system
            )
            if not steps:
                steps = calc_res.get("steps", [])
        except Exception as e:
            print(f"Error computing sizing steps for {seg.get('tag')}: {e}")

        story.append(PageBreak())
        tag = seg.get("tag", f"DS-{idx+1}")
        sec_name = seg.get("section_name", f"Section {idx+1}")
        story.append(Paragraph(f"Section #{idx+1}: {tag} — {sec_name}", styles["title"]))
        story.append(Paragraph("ASHRAE Fundamentals, Ch. 21: Equal Friction / Velocity Sizing", styles["subtitle"]))

        subhead_text = f"<b>Item #{idx+1}</b> &bull; Mark: <b>{tag}</b> &bull; Dimensions: <b>{seg.get('dimensions', '-')}</b> &bull; Flow: <b>{seg.get('Q')} {flow_unit}</b> &bull; Friction Rate: <b>{seg.get('friction_rate')} {fr_unit}</b> &bull; Run Length: <b>{seg.get('length')} {len_unit}</b>"
        story.append(Paragraph(subhead_text, styles["meta"]))
        story.append(Spacer(1, 6))

        # Detailed Duct Inputs & Outputs Table (Authentic 4-Column Side-by-Side Table)
        t_io = format_sizer_inputs_outputs_table(seg, calc_res, styles, unit_system)
        story.append(t_io)
        story.append(Spacer(1, 8))

        # Step-by-Step Engineering Calculation Breakdown
        story.append(Paragraph("<b>STEP-BY-STEP ENGINEERING CALCULATION BREAKDOWN</b>", styles["h2"]))
        steps_table_story = build_calculation_steps_table(steps, styles)
        if isinstance(steps_table_story, list):
            story.extend(steps_table_story)
        else:
            story.append(steps_table_story)

    # Build document
    doc.build(story, canvasmaker=DuctfitSizerCanvas)

    if output_path:
        return output_path
    else:
        pdf_bytes = buf.getvalue()
        buf.close()
        return pdf_bytes


def generate_calculation_pdf(calc_data, output_path=None):
    """
    Generates a dedicated single-fitting or duct-sizing calculation PDF report:
    - Running headers with Ductfit Pro branding, date, version
    - Authentic 4-column side-by-side INPUTS | OUTPUTS table
    - Centered technical CAD blueprint diagram
    - Step-by-Step Engineering Calculation Breakdown with governing equations, parameter substitutions, and boxed results
    - Running footer with Page 1 of 1 and version
    """
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        output_path or buf,
        pagesize=letter,
        leftMargin=36,
        rightMargin=36,
        topMargin=64,
        bottomMargin=50
    )

    styles = get_styles()
    story = []

    code = calc_data.get("code", "CR11-1")
    name = calc_data.get("name", "Duct Fitting Calculation")
    unit_system = calc_data.get("unit_system", "SI")
    is_si = unit_system == "SI"
    inputs = calc_data.get("inputs", {})
    project_id = calc_data.get("project_id")

    project = None
    if project_id:
        try:
            project = project_manager.get_project(project_id)
        except Exception:
            project = None

    # Compute or fetch step-by-step engineering breakdown
    calc_res = {}
    steps = []
    try:
        if code.startswith("SIZE-"):
            target_val = safe_num(inputs.get("target_hf"), 0.8 if is_si else 0.10)
            q_val = safe_num(inputs.get("Q"), 300 if is_si else 636)
            shape = calc_data.get("shape", inputs.get("shape", "rect"))
            h_val = safe_num(inputs.get("H"), 300 if is_si else 12)
            calc_res = AshraeEngine.size_duct(
                Q_Lps=q_val, target_type=inputs.get("target_type", "friction"), target_val=target_val,
                shape=shape, fixed_dim=h_val, fixed_type="H" if h_val > 0 else "NONE", unit_system=unit_system
            )
        else:
            calc_res = AshraeEngine.calculate_fitting(code, inputs, unit_system)
        steps = calc_res.get("steps", [])
    except Exception as e:
        print(f"Error calculating steps for {code}: {e}")

    # Fallback to steps in calc_data if available
    if not steps and calc_data.get("steps"):
        steps = calc_data.get("steps")

    # Fitting Header
    story.append(Paragraph(f"({code})  {name}", styles["title"]))
    raw_cit = calc_res.get("citation") or "(ASHRAE Fundamentals, Ch. 21: Duct Design)"
    citation = raw_cit.replace("2021 ASHRAE Handbook—Fundamentals Chapter 21: Duct Design", "ASHRAE Fundamentals, Ch. 21: Duct Design").replace("2021 ASHRAE Handbook—Fundamentals", "ASHRAE Fundamentals, Ch. 21").replace("2021 ", "")
    story.append(Paragraph(f"<i>{citation}</i>", styles["subtitle"]))

    if project:
        subhead_text = f"Project: <b>{project.get('code')} - {project.get('name')}</b> &bull; Client: <b>{project.get('client') or 'N/A'}</b> &bull; Standard: <b>ASHRAE Fundamentals (Ch. 21)</b>"
    else:
        subhead_text = f"<b>Ductfit Pro Engineering Calculation Sheet</b> &bull; Standard: <b>ASHRAE Fundamentals, Ch. 21 ({unit_system})</b> &bull; Fluid: Standard Dry Air"
    story.append(Paragraph(subhead_text, styles["meta"]))
    story.append(Spacer(1, 6))

    fit = {
        "code": code,
        "name": name,
        "inputs": inputs,
        "Q": calc_res.get("Q", inputs.get("Q")),
        "velocity": calc_res.get("velocity_ms" if is_si else "velocity_fpm", calc_res.get("velocity")),
        "pv": calc_res.get("pv_pa" if is_si else "pv_in_wg", calc_res.get("pv")),
        "f_or_Co": calc_res.get("loss_coeff_Co", calc_res.get("C", calc_res.get("f"))),
        "dp": calc_res.get("pressure_loss_pa" if is_si else "pressure_loss_in_wg", calc_res.get("dp")),
        "qty": 1
    }

    # Inputs & Outputs 4-Column Table (Authentic AFA.pdf style)
    t_io = format_inputs_outputs_table(fit, calc_res, styles, unit_system)
    story.append(t_io)
    story.append(Spacer(1, 8))

    # Blueprint Image (Centered, exact visual match to AFA.pdf CAD section)
    img_path = os.path.join(BLUEPRINTS_DIR, f"{code}.png")
    if not os.path.exists(img_path) and code == "SIZE-AUTO":
        img_path = os.path.join(BLUEPRINTS_DIR, "CR11-1.png")

    if os.path.exists(img_path):
        try:
            img = Image(img_path, width=280, height=110)
            img.hAlign = 'CENTER'
            story.append(img)
            story.append(Spacer(1, 6))
        except Exception as e:
            print(f"Error loading image {img_path}: {e}")

    # Step-by-Step Engineering Calculation Breakdown
    story.append(Paragraph("<b>STEP-BY-STEP ENGINEERING CALCULATION BREAKDOWN</b>", styles["h2"]))
    steps_table_story = build_calculation_steps_table(steps, styles)
    if isinstance(steps_table_story, list):
        story.extend(steps_table_story)
    else:
        story.append(steps_table_story)

    # Build document
    doc.build(story, canvasmaker=DuctfitNumberedCanvas)

    if output_path:
        return output_path
    else:
        pdf_bytes = buf.getvalue()
        buf.close()
        return pdf_bytes
