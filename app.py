import os
import sys
import json
import math
from flask import Flask, render_template, request, jsonify, send_file
from ashrae_engine import AshraeEngine
from version_manager import get_current_version, get_version_data

BASE_DIR = getattr(sys, '_MEIPASS', os.path.dirname(os.path.abspath(__file__)))
app = Flask(
    __name__,
    static_folder=os.path.join(BASE_DIR, "static"),
    template_folder=os.path.join(BASE_DIR, "templates")
)

def safe_float(val, default=0.0):
    if val is None:
        return default
    try:
        f = float(val)
        return default if math.isnan(f) else f
    except (ValueError, TypeError):
        return default

# Load Catalog Tree Data into Memory
TREE_FILE = os.path.join(BASE_DIR, "fittings_tree.json")
FITTINGS_TREE = {}
if os.path.exists(TREE_FILE):
    with open(TREE_FILE, "r", encoding="utf-8") as f:
        FITTINGS_TREE = json.load(f)

@app.route("/")
def index():
    return render_template("index.html", version=get_current_version())

@app.route("/api/version", methods=["GET"])
def get_version():
    """Returns current version and historical update changelog"""
    return jsonify({"status": "success", "data": get_version_data()})

@app.route("/api/tree", methods=["GET"])
def get_tree():
    """Returns the full hierarchical catalog tree matching ASHRAE Database"""
    if os.path.exists(TREE_FILE):
        with open(TREE_FILE, "r", encoding="utf-8") as f:
            return jsonify({"status": "success", "data": json.load(f)})
    return jsonify({"status": "success", "data": FITTINGS_TREE})

@app.route("/api/calculate", methods=["POST"])
def calculate():
    """
    Unified Calculation Endpoint
    Handles straight ducts, fittings, and automated duct sizing.
    Returns exact calculated values AND step-by-step formula substitutions.
    """
    try:
        data = request.get_json() or {}
        code = data.get("code", "CR11-1")
        unit_system = data.get("unit_system", "SI")
        mode = data.get("mode", "direct") # 'direct' or 'sizer'
        inputs = data.get("inputs", {})
        if "ei" in inputs and "e" not in inputs:
            inputs["e"] = inputs["ei"]
        elif "e" in inputs and "ei" not in inputs:
            inputs["ei"] = inputs["e"]
        air_condition_id = data.get("air_condition_id") or inputs.get("air_condition_id", "comfort_return")
        air_cond = AshraeEngine.AIR_CONDITIONS.get(air_condition_id, AshraeEngine.AIR_CONDITIONS["comfort_return"])

        if mode == "sizer" or code.startswith("SIZE-"):
            # Sizing mode
            target_type = data.get("target_type", "friction")
            if target_type == "velocity":
                target_val = safe_float(inputs.get("V"), safe_float(data.get("target_val"), 2.5 if unit_system == "SI" else 500.0))
            else:
                target_val = safe_float(inputs.get("target_hf"), safe_float(data.get("target_val"), 1.0 if unit_system == "SI" else 0.10))
            shape = data.get("shape")
            if not shape or code == "SIZE-ROUND" or code.startswith("CD"):
                shape = "round" if (code == "SIZE-ROUND" or code.startswith("CD")) else (shape or "rect")

            last_changed = data.get("last_changed", "")
            h_val = safe_float(inputs.get("H"), None)
            w_val = safe_float(inputs.get("W"), None)
            has_h = h_val is not None and h_val > 0
            has_w = w_val is not None and w_val > 0

            if last_changed == "W" and has_w:
                fixed_type = "W"
                fixed_dim = w_val
            elif has_h:
                fixed_type = "H"
                fixed_dim = h_val
            elif has_w:
                fixed_type = "W"
                fixed_dim = w_val
            else:
                # Neither H nor W specified: Continuous circular equivalent governs (McQuay parity)
                fixed_type = "NONE"
                fixed_dim = 0.0

            Q = safe_float(inputs.get("Q"), 300.0 if unit_system == "SI" else 636.0)
            L = safe_float(inputs.get("L"), 1.0 if unit_system == "SI" else 10.0)
            e = safe_float(inputs.get("e"), 0.21336 if unit_system == "SI" else 0.0007)
            rho = safe_float(inputs.get("rho"), air_cond["density_si"] if unit_system == "SI" else air_cond["density_ip"])

            if unit_system == "IP":
                Q_Lps = Q / 2.11888
                L_m = L / 3.28084
                e_mm = e * 304.8
                rho_si = rho * 16.018463
                if target_type == "friction":
                    target_val_si = target_val * (249.0889 / 30.48)
                else:
                    target_val_si = target_val * 0.00508
                if fixed_type not in ("AR", "NONE"):
                    fixed_dim_si = fixed_dim * 25.4
                else:
                    fixed_dim_si = fixed_dim
            else:
                Q_Lps = Q
                L_m = L
                e_mm = e
                rho_si = rho
                target_val_si = target_val
                fixed_dim_si = fixed_dim

            res = AshraeEngine.size_duct(
                Q_Lps=Q_Lps,
                target_type=target_type,
                target_val=target_val_si,
                shape=shape,
                fixed_dim=fixed_dim_si,
                fixed_type=fixed_type,
                L_m=L_m,
                e_mm=e_mm,
                rho=rho_si,
                material_name=inputs.get("material_name"),
                unit_system=unit_system,
                air_condition_id=air_condition_id,
                mu=air_cond["viscosity_pas"]
            )
            res["unit_system"] = unit_system
            res["mode"] = "sizer"
            res["air_condition"] = air_cond
            return jsonify({"status": "success", "data": res})

        else:
            # Direct fitting or straight duct loss calculation
            if "air_condition_id" not in inputs:
                inputs["air_condition_id"] = air_condition_id
            res = AshraeEngine.calculate_fitting(code, inputs, unit_system)
            res["unit_system"] = unit_system
            res["mode"] = "direct"
            res["air_condition"] = air_cond
            return jsonify({"status": "success", "data": res})

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"status": "error", "message": str(e)}), 400

@app.route("/api/calculate-direct", methods=["POST"])
def calculate_direct():
    """Legacy backward compatibility route"""
    try:
        data = request.get_json() or {}
        shape = data.get("shape", "rect")
        unit_system = data.get("unit_system", "SI")
        code = "CR11-1" if shape == "rect" else ("CD11-1" if shape == "round" else "CF11-1")
        inputs = data
        res = AshraeEngine.calculate_fitting(code, inputs, unit_system)
        res["unit_system"] = unit_system
        return jsonify({"status": "success", "data": res})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 400

@app.route("/api/size-duct", methods=["POST"])
def size_duct():
    """Legacy backward compatibility route"""
    try:
        data = request.get_json() or {}
        unit_system = data.get("unit_system", "SI")
        target_type = data.get("target_type", "friction")
        target_val = float(data.get("target_val", 1.0))
        shape = data.get("shape", "rect")
        fixed_type = data.get("fixed_type", "H")
        fixed_dim = float(data.get("fixed_dim", 300.0))
        
        Q = float(data.get("Q", 2000.0))
        L = float(data.get("L", 3.0))
        e = float(data.get("e", 0.090))
        air_condition_id = data.get("air_condition_id", "comfort_return")
        air_cond = AshraeEngine.AIR_CONDITIONS.get(air_condition_id, AshraeEngine.AIR_CONDITIONS["comfort_return"])
        rho = float(data.get("rho", air_cond["density_si"] if unit_system == "SI" else air_cond["density_ip"]))

        if unit_system == "IP":
            Q_Lps = Q / 2.11888
            L_m = L / 3.28084
            e_mm = e * 304.8
            rho_si = rho * 16.018463
            if target_type == "friction":
                target_val_si = target_val * (249.0889 / 30.48)
            else:
                target_val_si = target_val * 0.00508
            if fixed_type != "AR":
                fixed_dim_si = fixed_dim * 25.4
            else:
                fixed_dim_si = fixed_dim
        else:
            Q_Lps = Q
            L_m = L
            e_mm = e
            rho_si = rho
            target_val_si = target_val
            fixed_dim_si = fixed_dim

        res = AshraeEngine.size_duct(
            Q_Lps=Q_Lps,
            target_type=target_type,
            target_val=target_val_si,
            shape=shape,
            fixed_dim=fixed_dim_si,
            fixed_type=fixed_type,
            L_m=L_m,
            e_mm=e_mm,
            rho=rho_si,
            unit_system=unit_system,
            air_condition_id=air_condition_id,
            mu=air_cond["viscosity_pas"]
        )
        res["unit_system"] = unit_system
        res["air_condition"] = air_cond
        return jsonify({"status": "success", "data": res})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 400

# =========================================================================
# Project Management Endpoints (ASHRAE Project Schedule Database Model)
# =========================================================================
import project_manager

@app.route("/api/projects", methods=["GET"])
def get_projects():
    """List all projects and active project ID"""
    try:
        return jsonify({"status": "success", "data": project_manager.list_projects()})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 400

@app.route("/api/projects", methods=["POST"])
def create_project_route():
    """Create a new project"""
    try:
        data = request.get_json() or {}
        code = data.get("code", "")
        name = data.get("name", "")
        client = data.get("client", "")
        contractor = data.get("contractor", "")
        subcontractor = data.get("subcontractor", "")
        notes = data.get("notes", "")
        unit_system = data.get("unit_system", "SI")
        if not code or not name:
            return jsonify({"status": "error", "message": "Project Code and Project Name are required"}), 400
        proj = project_manager.create_project(code, name, client, contractor, subcontractor, notes, unit_system)
        return jsonify({"status": "success", "data": proj})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 400

@app.route("/api/projects/select", methods=["POST"])
def select_project_route():
    """Set active project"""
    try:
        data = request.get_json() or {}
        project_id = data.get("id")
        if not project_id:
            return jsonify({"status": "error", "message": "Project ID required"}), 400
        ok = project_manager.set_active_project(project_id)
        if ok:
            return jsonify({"status": "success", "active_project_id": project_id})
        return jsonify({"status": "error", "message": "Project not found"}), 404
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 400

@app.route("/api/projects/<project_id>", methods=["GET"])
def get_project_details_route(project_id):
    """Get project details and all contained fittings"""
    try:
        proj = project_manager.get_project(project_id)
        if proj:
            return jsonify({"status": "success", "data": proj})
        return jsonify({"status": "error", "message": "Project not found"}), 404
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 400

@app.route("/api/projects/<project_id>", methods=["PUT"])
def update_project_route(project_id):
    """Update project metadata"""
    try:
        data = request.get_json() or {}
        code = data.get("code", "").strip()
        name = data.get("name", "").strip()
        if not code or not name:
            return jsonify({"status": "error", "message": "Project Code and Project Name are required"}), 400
        proj = project_manager.update_project(project_id, data)
        if proj:
            return jsonify({"status": "success", "data": proj})
        return jsonify({"status": "error", "message": "Project not found"}), 404
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 400

@app.route("/api/projects/<project_id>/margin", methods=["POST", "PUT"])
def update_project_margin_route(project_id):
    """Update project design safety margin percentage"""
    try:
        data = request.get_json() or {}
        margin_val = data.get("margin", data.get("design_margin", 10.0))
        proj = project_manager.update_project_margin(project_id, margin_val)
        if proj:
            return jsonify({"status": "success", "data": proj})
        return jsonify({"status": "error", "message": "Project not found"}), 404
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 400

@app.route("/api/projects/<project_id>", methods=["DELETE"])
def delete_project_route(project_id):
    """Delete a project"""
    try:
        ok = project_manager.delete_project(project_id)
        if ok:
            return jsonify({"status": "success", "data": project_manager.list_projects()})
        return jsonify({"status": "error", "message": "Project not found"}), 404
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 400

@app.route("/api/projects/<project_id>/fittings", methods=["POST"])
def add_fitting_route(project_id):
    """Add a calculated fitting to project"""
    try:
        data = request.get_json() or {}
        fit = project_manager.add_fitting_to_project(project_id, data)
        if not fit:
            return jsonify({"status": "error", "message": "No project found. Please create a project first."}), 400
        return jsonify({"status": "success", "data": fit})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 400

@app.route("/api/projects/<project_id>/fittings/<fitting_id>", methods=["DELETE"])
def delete_fitting_route(project_id, fitting_id):
    """Delete a fitting from project"""
    try:
        ok = project_manager.delete_fitting_from_project(project_id, fitting_id)
        if ok:
            return jsonify({"status": "success"})
        return jsonify({"status": "error", "message": "Fitting not found"}), 404
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 400

@app.route("/api/projects/<project_id>/fittings/<fitting_id>", methods=["PUT"])
def update_fitting_route(project_id, fitting_id):
    """Update fitting quantity or full calculation properties in project"""
    try:
        data = request.get_json() or {}
        if "inputs" in data or "dimensions" in data or "dp" in data:
            fit = project_manager.update_fitting_in_project(project_id, fitting_id, data)
        else:
            qty = data.get("qty", 1)
            fit = project_manager.update_fitting_qty(project_id, fitting_id, qty)
        if fit:
            return jsonify({"status": "success", "data": fit})
        return jsonify({"status": "error", "message": "Fitting not found"}), 404
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 400

@app.route("/api/projects/<project_id>/clear", methods=["POST"])
def clear_fittings_route(project_id):
    """Clear all fittings from project"""
    try:
        ok = project_manager.clear_project_fittings(project_id)
        if ok:
            return jsonify({"status": "success"})
        return jsonify({"status": "error", "message": "Project not found"}), 404
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 400

# =========================================================================
# Auto Duct Sizer Segment Endpoints (Strictly separate from fitting losses)
# =========================================================================

@app.route("/api/projects/<project_id>/sizer-segments", methods=["GET"])
def get_sizer_segments_route(project_id):
    """Get all sized duct segments for project"""
    try:
        proj = project_manager.get_project(project_id)
        if not proj:
            return jsonify({"status": "error", "message": "Project not found"}), 404
        return jsonify({"status": "success", "data": proj.get("duct_segments", [])})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 400

@app.route("/api/projects/<project_id>/sizer-segments", methods=["POST"])
def add_sizer_segment_route(project_id):
    """Add a sized duct section to project"""
    try:
        data = request.get_json() or {}
        seg = project_manager.add_duct_segment_to_project(project_id, data)
        if not seg:
            return jsonify({"status": "error", "message": "No project found. Please create a project first."}), 400
        return jsonify({"status": "success", "data": seg})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 400

@app.route("/api/projects/<project_id>/sizer-segments/<segment_id>", methods=["DELETE"])
def delete_sizer_segment_route(project_id, segment_id):
    """Delete a sized duct section from project"""
    try:
        ok = project_manager.delete_duct_segment_from_project(project_id, segment_id)
        if ok:
            return jsonify({"status": "success"})
        return jsonify({"status": "error", "message": "Segment not found"}), 404
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 400

@app.route("/api/projects/<project_id>/sizer-segments/clear", methods=["POST"])
def clear_sizer_segments_route(project_id):
    """Clear all sized duct segments from project"""
    try:
        ok = project_manager.clear_project_duct_segments(project_id)
        if ok:
            return jsonify({"status": "success"})
        return jsonify({"status": "error", "message": "Project not found"}), 404
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 400

@app.route("/api/projects/<project_id>/sizer-pdf", methods=["GET"])
def download_sizer_project_pdf_route(project_id):
    """Generate and download DuctFit Pro Duct Sizing Project Report (NO CAD, NO fitting losses)"""
    try:
        import io
        import re
        import pdf_report_generator
        import project_manager
        proj = project_manager.get_project(project_id)
        if not proj:
            return jsonify({"status": "error", "message": "Project not found"}), 404
        include_calc_param = request.args.get("calc", "1")
        include_calculations = include_calc_param not in ("0", "false", "no", "False")
        margin_param = request.args.get("margin")
        margin_val = float(margin_param) if margin_param is not None and margin_param != "" else None
        pdf_bytes = pdf_report_generator.generate_sizer_project_pdf(project_id, include_calculations=include_calculations, design_margin=margin_val)
        code_sanitized = re.sub(r'[^a-zA-Z0-9_\-]', '_', proj.get('code', 'PROJECT'))
        filename = f"{code_sanitized}_Duct_Sizing_Report.pdf"
        return send_file(
            io.BytesIO(pdf_bytes),
            mimetype="application/pdf",
            as_attachment=True,
            download_name=filename
        )
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route("/api/projects/<project_id>/pdf", methods=["GET"])
def download_project_pdf_route(project_id):
    """Generate and download Ductfit pro multi-page PDF report for project"""
    try:
        import io
        import re
        import pdf_report_generator
        import project_manager
        proj = project_manager.get_project(project_id)
        if not proj:
            return jsonify({"status": "error", "message": "Project not found"}), 404
        include_calc_param = request.args.get("calc", "1")
        include_calculations = include_calc_param not in ("0", "false", "no", "False")
        margin_param = request.args.get("margin")
        margin_val = float(margin_param) if margin_param is not None and margin_param != "" else None
        pdf_bytes = pdf_report_generator.generate_project_pdf(project_id, include_calculations=include_calculations, design_margin=margin_val)
        code_sanitized = re.sub(r'[^a-zA-Z0-9_\-]', '_', proj.get('code', 'PROJECT'))
        filename = f"{code_sanitized}_DuctFit_Pro_Report.pdf"
        return send_file(
            io.BytesIO(pdf_bytes),
            mimetype="application/pdf",
            as_attachment=True,
            download_name=filename
        )
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route("/api/calculations/pdf", methods=["GET", "POST"])
def download_calculation_pdf_route():
    """Generate and download Ductfit pro single calculation PDF report"""
    try:
        import io
        import re
        import pdf_report_generator

        if request.method == "POST":
            data = request.get_json() or {}
        else:
            inputs = {}
            for k, v in request.args.items():
                if k not in ("code", "name", "unit_system", "project_id", "shape", "target_type"):
                    try:
                        inputs[k] = float(v)
                    except ValueError:
                        inputs[k] = v
            data = {
                "code": request.args.get("code", "CR11-1"),
                "name": request.args.get("name", "Duct Section"),
                "unit_system": request.args.get("unit_system", "SI"),
                "project_id": request.args.get("project_id"),
                "shape": request.args.get("shape", "rect"),
                "target_type": request.args.get("target_type", "friction"),
                "inputs": inputs
            }

        code = data.get("code", "CR11-1")
        pdf_bytes = pdf_report_generator.generate_calculation_pdf(data)
        code_sanitized = re.sub(r'[^a-zA-Z0-9_\-]', '_', code)
        filename = f"{code_sanitized}_DuctFit_Pro_Calculation.pdf"
        return send_file(
            io.BytesIO(pdf_bytes),
            mimetype="application/pdf",
            as_attachment=True,
            download_name=filename
        )
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route("/api/catalog/pdf", methods=["GET"])
def download_master_catalog_pdf():
    """Download full 62-page Master ASHRAE Catalog with all 234 fittings and process flows"""
    try:
        pdf_filename = "ASHRAE_Duct_Fitting_Database_Master_Catalog.pdf"
        pdf_path = os.path.join(os.path.dirname(__file__), pdf_filename)
        if not os.path.exists(pdf_path):
            import pdf_master_catalog
            pdf_master_catalog.generate_master_catalog_pdf()
        return send_file(
            pdf_path,
            mimetype="application/pdf",
            as_attachment=True,
            download_name="ASHRAE_Duct_Fitting_Database_Master_Catalog.pdf"
        )
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"status": "error", "message": str(e)}), 500

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="DuctFit Pro Engine Server")
    parser.add_argument("--port", type=int, default=int(os.environ.get("DUCTFIT_PORT", 5052)), help="Port to listen on")
    parser.add_argument("--host", type=str, default=os.environ.get("DUCTFIT_HOST", "127.0.0.1"), help="Host to listen on")
    parser.add_argument("--user-data-dir", type=str, default=os.environ.get("DUCTFIT_USER_DATA", ""), help="User data directory for projects.json")
    args = parser.parse_args()

    if args.user_data_dir:
        os.environ["DUCTFIT_USER_DATA"] = args.user_data_dir

    print(f"Starting DuctFit Pro Engine on http://{args.host}:{args.port} (User Data: {args.user_data_dir or 'local'}) ...")
    app.run(host=args.host, port=args.port, debug=False)
