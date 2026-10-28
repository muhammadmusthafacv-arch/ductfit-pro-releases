import json
import os
import time
from datetime import datetime

def get_projects_file():
    user_data = os.environ.get("DUCTFIT_USER_DATA")
    if user_data:
        os.makedirs(user_data, exist_ok=True)
        target = os.path.join(user_data, "projects.json")
        if not os.path.exists(target):
            try:
                with open(target, "w", encoding="utf-8") as f:
                    json.dump(get_default_project_data(), f, indent=2)
            except Exception:
                pass
        return target
    return os.path.join(os.path.dirname(__file__), "projects.json")

def _get_timestamp():
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")

def get_default_project_data():
    return {
        "active_project_id": None,
        "projects": []
    }

def cleanup_sample_projects(data):
    if not isinstance(data, dict) or "projects" not in data:
        return False
    sample_ids = {"PRFC-1021", "SDF"}
    sample_names = {"EPSILON", "ddd"}
    initial_count = len(data["projects"])
    filtered = [
        p for p in data["projects"]
        if p.get("id") not in sample_ids
        and p.get("code") not in sample_ids
        and p.get("name") not in sample_names
    ]
    if len(filtered) != initial_count:
        data["projects"] = filtered
        valid_ids = {p.get("id") for p in filtered}
        if data.get("active_project_id") not in valid_ids:
            data["active_project_id"] = filtered[0]["id"] if filtered else None
        return True
    return False

def get_projects_data():
    projects_file = get_projects_file()
    if not os.path.exists(projects_file):
        data = get_default_project_data()
        save_projects_data(data)
        return data
    try:
        with open(projects_file, "r", encoding="utf-8") as f:
            data = json.load(f)
            if not isinstance(data, dict) or "projects" not in data:
                data = get_default_project_data()
                save_projects_data(data)
            elif cleanup_sample_projects(data):
                save_projects_data(data)
            return data
    except Exception as e:
        print(f"Error loading {projects_file}: {e}")
        data = get_default_project_data()
        save_projects_data(data)
        return data

def save_projects_data(data):
    projects_file = get_projects_file()
    try:
        temp_file = projects_file + ".tmp"
        with open(temp_file, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        if os.path.exists(projects_file):
            os.replace(temp_file, projects_file)
        else:
            os.rename(temp_file, projects_file)
        return True
    except Exception as e:
        print(f"Error saving {projects_file}: {e}")
        return False

def list_projects():
    data = get_projects_data()
    projects_summary = []
    for p in data.get("projects", []):
        fittings = p.get("fittings", [])
        duct_segments = p.get("duct_segments", [])
        total_dp = sum(float(f.get("total_dp", f.get("dp", 0)) or 0) for f in fittings)
        total_sizer_dp = sum(float(s.get("dp", 0) or 0) for s in duct_segments)
        projects_summary.append({
            "id": p.get("id"),
            "code": p.get("code"),
            "name": p.get("name"),
            "client": p.get("client"),
            "contractor": p.get("contractor"),
            "subcontractor": p.get("subcontractor"),
            "notes": p.get("notes", ""),
            "fittings_count": len(fittings),
            "duct_segments_count": len(duct_segments),
            "total_dp": round(total_dp, 2),
            "total_sizer_dp": round(total_sizer_dp, 2),
            "updated_at": p.get("updated_at"),
            "created_at": p.get("created_at"),
            "is_active": p.get("id") == data.get("active_project_id")
        })
    return {
        "active_project_id": data.get("active_project_id"),
        "projects": projects_summary
    }

def get_project(project_id):
    data = get_projects_data()
    for p in data.get("projects", []):
        if p.get("id") == project_id:
            return p
    return None

def create_project(code, name, client="", contractor="", subcontractor="", notes="", unit_system="SI"):
    data = get_projects_data()
    pid = code.strip().replace(" ", "-").upper()
    if not pid:
        pid = f"PRJ-{int(time.time())}"

    # Ensure uniqueness
    existing_ids = {p.get("id") for p in data.get("projects", [])}
    unique_pid = pid
    counter = 1
    while unique_pid in existing_ids:
        unique_pid = f"{pid}-{counter}"
        counter += 1

    new_project = {
        "id": unique_pid,
        "code": code.strip() or unique_pid,
        "name": name.strip() or "Untitled Project",
        "client": client.strip(),
        "contractor": contractor.strip(),
        "subcontractor": subcontractor.strip(),
        "notes": notes.strip(),
        "created_at": _get_timestamp(),
        "updated_at": _get_timestamp(),
        "unit_system": unit_system,
        "design_margin": 10.0,
        "fittings": [],
        "duct_segments": []
    }

    data.setdefault("projects", []).append(new_project)
    data["active_project_id"] = unique_pid
    save_projects_data(data)
    return new_project

def set_active_project(project_id):
    data = get_projects_data()
    for p in data.get("projects", []):
        if p.get("id") == project_id:
            data["active_project_id"] = project_id
            save_projects_data(data)
            return True
    return False

def add_fitting_to_project(project_id, fitting_data):
    data = get_projects_data()
    target_project = None
    for p in data.get("projects", []):
        if p.get("id") == project_id:
            target_project = p
            break

    if not target_project:
        # Fallback to active project if exists
        if data.get("projects"):
            target_project = data["projects"][0]
            project_id = target_project["id"]
        else:
            return None

    fittings = target_project.setdefault("fittings", [])
    fit_idx = len(fittings) + 1

    dp_val = float(fitting_data.get("dp", 0) or 0)
    qty_val = int(fitting_data.get("qty", 1) or 1)
    total_dp_val = round(dp_val * qty_val, 2)

    tag = fitting_data.get("tag") or f"FIT-{fit_idx:02d}"

    fitting_record = {
        "id": f"fit_{int(time.time()*1000)}_{fit_idx}",
        "item_no": fit_idx,
        "tag": tag,
        "code": fitting_data.get("code", "CR11-1"),
        "name": fitting_data.get("name", "Straight Duct"),
        "shape": fitting_data.get("shape", "rect"),
        "category": fitting_data.get("category", "General"),
        "dimensions": fitting_data.get("dimensions", ""),
        "inputs": fitting_data.get("inputs", {}),
        "unit_system": fitting_data.get("unit_system", target_project.get("unit_system", "SI")),
        "Q": fitting_data.get("Q", 0),
        "velocity": fitting_data.get("velocity", 0),
        "pv": fitting_data.get("pv", 0),
        "f_or_Co": fitting_data.get("f_or_Co", 0),
        "coeff_type": fitting_data.get("coeff_type", "Co"),
        "dp": dp_val,
        "qty": qty_val,
        "total_dp": total_dp_val,
        "De": fitting_data.get("De", ""),
        "notes": fitting_data.get("notes", ""),
        "added_at": _get_timestamp()
    }

    fittings.append(fitting_record)
    target_project["updated_at"] = _get_timestamp()
    save_projects_data(data)
    return fitting_record

def delete_fitting_from_project(project_id, fitting_id):
    data = get_projects_data()
    for p in data.get("projects", []):
        if p.get("id") == project_id:
            fittings = p.get("fittings", [])
            initial_len = len(fittings)
            p["fittings"] = [f for f in fittings if f.get("id") != fitting_id]
            if len(p["fittings"]) < initial_len:
                # Re-index remaining fittings
                for i, f in enumerate(p["fittings"]):
                    f["item_no"] = i + 1
                p["updated_at"] = _get_timestamp()
                save_projects_data(data)
                return True
    return False

def update_fitting_qty(project_id, fitting_id, new_qty):
    data = get_projects_data()
    for p in data.get("projects", []):
        if p.get("id") == project_id:
            for f in p.get("fittings", []):
                if f.get("id") == fitting_id:
                    try:
                        q = max(1, int(new_qty))
                        f["qty"] = q
                        f["total_dp"] = round(float(f.get("dp", 0)) * q, 2)
                        p["updated_at"] = _get_timestamp()
                        save_projects_data(data)
                        return f
                    except Exception:
                        return None
    return None

def update_fitting_in_project(project_id, fitting_id, fitting_data):
    data = get_projects_data()
    for p in data.get("projects", []):
        if p.get("id") == project_id:
            for f in p.get("fittings", []):
                if f.get("id") == fitting_id:
                    try:
                        dp_val = float(fitting_data.get("dp", f.get("dp", 0)))
                        qty_val = int(fitting_data.get("qty", f.get("qty", 1)))
                        total_dp_val = round(dp_val * qty_val, 2)
                        
                        if "tag" in fitting_data: f["tag"] = fitting_data["tag"]
                        if "name" in fitting_data: f["name"] = fitting_data["name"]
                        if "shape" in fitting_data: f["shape"] = fitting_data["shape"]
                        if "dimensions" in fitting_data: f["dimensions"] = fitting_data["dimensions"]
                        if "inputs" in fitting_data: f["inputs"] = fitting_data["inputs"]
                        if "unit_system" in fitting_data: f["unit_system"] = fitting_data["unit_system"]
                        if "Q" in fitting_data: f["Q"] = fitting_data["Q"]
                        if "velocity" in fitting_data: f["velocity"] = fitting_data["velocity"]
                        if "pv" in fitting_data: f["pv"] = fitting_data["pv"]
                        if "f_or_Co" in fitting_data: f["f_or_Co"] = fitting_data["f_or_Co"]
                        if "coeff_type" in fitting_data: f["coeff_type"] = fitting_data["coeff_type"]
                        f["dp"] = dp_val
                        f["qty"] = qty_val
                        f["total_dp"] = total_dp_val
                        if "De" in fitting_data: f["De"] = fitting_data["De"]
                        if "notes" in fitting_data: f["notes"] = fitting_data["notes"]
                        f["updated_at"] = _get_timestamp()
                        p["updated_at"] = _get_timestamp()
                        save_projects_data(data)
                        return f
                    except Exception:
                        return None
    return None

def clear_project_fittings(project_id):
    data = get_projects_data()
    for p in data.get("projects", []):
        if p.get("id") == project_id:
            p["fittings"] = []
            p["updated_at"] = _get_timestamp()
            save_projects_data(data)
            return True
    return False

def add_duct_segment_to_project(project_id, segment_data):
    """Adds an auto-sized duct section to project.duct_segments (kept strictly separate from fitting loss ESP analysis)"""
    data = get_projects_data()
    target_project = None
    for p in data.get("projects", []):
        if p.get("id") == project_id:
            target_project = p
            break

    if not target_project:
        if data.get("projects"):
            target_project = data["projects"][0]
            project_id = target_project["id"]
        else:
            return None

    segments = target_project.setdefault("duct_segments", [])
    seg_idx = len(segments) + 1

    tag = segment_data.get("tag") or f"DS-{seg_idx:02d}"
    section_name = segment_data.get("section_name") or segment_data.get("name") or f"Section {seg_idx}"
    length_val = float(segment_data.get("length", 1.0) or 1.0)
    fr_val = float(segment_data.get("friction_rate", 0.8) or 0.8)
    dp_val = round(fr_val * length_val, 2)

    seg_record = {
        "id": f"seg_{int(time.time()*1000)}_{seg_idx}",
        "item_no": seg_idx,
        "tag": tag,
        "section_name": section_name,
        "shape": segment_data.get("shape", "rect"),
        "dimensions": segment_data.get("dimensions", ""),
        "unit_system": segment_data.get("unit_system", target_project.get("unit_system", "SI")),
        "Q": float(segment_data.get("Q", 0) or 0),
        "velocity": float(segment_data.get("velocity", 0) or 0),
        "friction_rate": fr_val,
        "length": length_val,
        "dp": dp_val,
        "De": segment_data.get("De", ""),
        "aspect_ratio": segment_data.get("aspect_ratio", ""),
        "target_type": segment_data.get("target_type", "friction"),
        "target_val": float(segment_data.get("target_val", 0.8) or 0.8),
        "notes": segment_data.get("notes", ""),
        "steps": segment_data.get("steps", []),
        "added_at": _get_timestamp()
    }

    segments.append(seg_record)
    target_project["updated_at"] = _get_timestamp()
    save_projects_data(data)
    return seg_record

def delete_duct_segment_from_project(project_id, segment_id):
    data = get_projects_data()
    for p in data.get("projects", []):
        if p.get("id") == project_id:
            segs = p.get("duct_segments", [])
            initial_len = len(segs)
            p["duct_segments"] = [s for s in segs if s.get("id") != segment_id]
            if len(p["duct_segments"]) < initial_len:
                for i, s in enumerate(p["duct_segments"]):
                    s["item_no"] = i + 1
                p["updated_at"] = _get_timestamp()
                save_projects_data(data)
                return True
    return False

def clear_project_duct_segments(project_id):
    data = get_projects_data()
    for p in data.get("projects", []):
        if p.get("id") == project_id:
            p["duct_segments"] = []
            p["updated_at"] = _get_timestamp()
            save_projects_data(data)
            return True
    return False

def delete_project(project_id):
    data = get_projects_data()
    initial_len = len(data.get("projects", []))
    data["projects"] = [p for p in data.get("projects", []) if p.get("id") != project_id]
    if len(data["projects"]) < initial_len:
        if data.get("active_project_id") == project_id:
            data["active_project_id"] = data["projects"][0]["id"] if data["projects"] else None
        save_projects_data(data)
        return True
    return False

def update_project(project_id, updates):
    """Update project metadata (code, name, client, contractor, subcontractor, notes, unit_system, design_margin)"""
    data = get_projects_data()
    for p in data.get("projects", []):
        if p.get("id") == project_id:
            for field in ["code", "name", "client", "contractor", "subcontractor", "notes", "unit_system"]:
                if field in updates and updates[field] is not None:
                    p[field] = str(updates[field]).strip()
            if "design_margin" in updates and updates["design_margin"] is not None:
                try:
                    p["design_margin"] = max(0.0, float(updates["design_margin"]))
                except (ValueError, TypeError):
                    p["design_margin"] = 0.0
            p["updated_at"] = _get_timestamp()
            save_projects_data(data)
            return p
    return None

def update_project_margin(project_id, margin):
    """Update design safety margin in percentage (e.g. 10.0 for 10%)"""
    data = get_projects_data()
    for p in data.get("projects", []):
        if p.get("id") == project_id:
            try:
                p["design_margin"] = max(0.0, float(margin))
            except (ValueError, TypeError):
                p["design_margin"] = 0.0
            p["updated_at"] = _get_timestamp()
            save_projects_data(data)
            return p
    return None


