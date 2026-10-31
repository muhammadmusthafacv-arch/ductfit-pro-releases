import json
import os
import re
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

def renumber_fittings(fittings_list):
    """
    Standardizes every fitting's sequential numbering and tag:
    - item_no: 1-based sequential integer (1, 2, 3...)
    - tag: <Code>-F<two-digit row position> (e.g. CR11-1-F01, CUST-1-F04)
    Guarantees no gaps, no duplicates.
    """
    if not isinstance(fittings_list, list):
        return []
    for i, f in enumerate(fittings_list):
        pos = i + 1
        raw_code = str(f.get("code") or "FIT").strip()
        # Clean off any trailing -Fxx suffix to prevent recursive tags
        clean_code = re.sub(r"-F\d+$", "", raw_code, flags=re.IGNORECASE).strip()
        if not clean_code:
            clean_code = "CUST-1" if f.get("is_custom") else "FIT"
        f["code"] = clean_code
        f["item_no"] = pos
        f["tag"] = f"{clean_code}-F{pos:02d}"
    return fittings_list

def get_project(project_id):
    data = get_projects_data()
    for p in data.get("projects", []):
        if p.get("id") == project_id:
            if p.get("fittings"):
                renumber_fittings(p["fittings"])
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

    is_custom = bool(fitting_data.get("is_custom") or fitting_data.get("source") == "custom")
    raw_code = str(fitting_data.get("code") or ("CUST-1" if is_custom else "CR11-1")).strip()
    clean_code = re.sub(r"-F\d+$", "", raw_code, flags=re.IGNORECASE).strip()
    if not clean_code:
        clean_code = "CUST-1" if is_custom else "CR11-1"

    name = str(fitting_data.get("name") or ("Custom Equipment" if is_custom else "Straight Duct")).strip()

    dp_val = float(fitting_data.get("dp", 0) or 0)
    qty_val = max(1, int(fitting_data.get("qty", 1) or 1))
    total_dp_val = round(dp_val * qty_val, 2)

    fit_record_id = f"fit_{int(time.time()*1000)}_{len(fittings) + 1}"

    fitting_record = {
        "id": fit_record_id,
        "item_no": len(fittings) + 1,
        "tag": "",  # dynamically set by renumber_fittings
        "code": clean_code,
        "name": name,
        "is_custom": is_custom,
        "source": "custom" if is_custom else "ashrae",
        "shape": str(fitting_data.get("shape", "rect" if not is_custom else "N/A")).lower(),
        "category": fitting_data.get("category", "Custom / Equipment" if is_custom else "General"),
        "dimensions": str(fitting_data.get("dimensions", "")).strip(),
        "inputs": fitting_data.get("inputs", {}),
        "unit_system": fitting_data.get("unit_system", target_project.get("unit_system", "SI")),
        "mfr": str(fitting_data.get("mfr", "")).strip(),
        "model": str(fitting_data.get("model", "")).strip(),
        "remarks": str(fitting_data.get("remarks", "")).strip(),
        "Q": float(fitting_data.get("Q", 0) or 0),
        "velocity": float(fitting_data.get("velocity", 0) or 0),
        "pv": None if is_custom else float(fitting_data.get("pv", 0) or 0),
        "f_or_Co": None if is_custom else float(fitting_data.get("f_or_Co", 0) or 0),
        "coeff_type": "N/A" if is_custom else fitting_data.get("coeff_type", "Co"),
        "dp": dp_val,
        "qty": qty_val,
        "total_dp": total_dp_val,
        "De": fitting_data.get("De", ""),
        "notes": str(fitting_data.get("notes") or fitting_data.get("remarks") or "").strip(),
        "added_at": _get_timestamp()
    }

    # Insert position handling:
    # "start" / 0: at the beginning
    # "end": at the end
    # integer i: after fitting index i
    insert_pos = fitting_data.get("insert_pos", "end")
    if insert_pos == "start" or insert_pos == 0 or insert_pos == "0":
        fittings.insert(0, fitting_record)
    elif str(insert_pos).lower() == "end":
        fittings.append(fitting_record)
    else:
        try:
            target_idx = int(insert_pos)
            if 0 <= target_idx < len(fittings):
                fittings.insert(target_idx + 1, fitting_record)
            else:
                fittings.append(fitting_record)
        except (ValueError, TypeError):
            fittings.append(fitting_record)

    renumber_fittings(fittings)
    target_project["updated_at"] = _get_timestamp()
    save_projects_data(data)
    return fitting_record

def duplicate_fitting_in_project(project_id, fitting_id):
    """
    Duplicates an existing fitting by fitting_id, copying all its engineering properties,
    and appends the exact duplicate to the end of the project schedule with a new unique id and re-sequenced tag.
    """
    data = get_projects_data()
    target_project = None
    for p in data.get("projects", []):
        if p.get("id") == project_id:
            target_project = p
            break

    if not target_project:
        return None

    fittings = target_project.setdefault("fittings", [])
    source_fit = None
    for f in fittings:
        if f.get("id") == fitting_id:
            source_fit = f
            break

    if not source_fit:
        return None

    import copy
    new_fit = copy.deepcopy(source_fit)
    new_id = f"fit_{int(time.time()*1000)}_{len(fittings) + 1}"
    new_fit["id"] = new_id
    new_fit["item_no"] = len(fittings) + 1
    new_fit["added_at"] = _get_timestamp()
    fittings.append(new_fit)
    renumber_fittings(fittings)
    target_project["updated_at"] = _get_timestamp()
    save_projects_data(data)
    return new_fit

def delete_fitting_from_project(project_id, fitting_id):
    data = get_projects_data()
    for p in data.get("projects", []):
        if p.get("id") == project_id:
            fittings = p.get("fittings", [])
            initial_len = len(fittings)
            p["fittings"] = [f for f in fittings if f.get("id") != fitting_id]
            if len(p["fittings"]) < initial_len:
                renumber_fittings(p["fittings"])
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
                        qty_val = max(1, int(fitting_data.get("qty", f.get("qty", 1))))
                        total_dp_val = round(dp_val * qty_val, 2)

                        if "code" in fitting_data:
                            clean_c = re.sub(r"-F\d+$", "", str(fitting_data["code"]).strip(), flags=re.IGNORECASE)
                            f["code"] = clean_c or f.get("code", "FIT")
                        if "name" in fitting_data:
                            f["name"] = str(fitting_data["name"]).strip()
                        if "is_custom" in fitting_data:
                            f["is_custom"] = bool(fitting_data["is_custom"])
                        if "shape" in fitting_data:
                            f["shape"] = str(fitting_data["shape"]).lower()
                        if "dimensions" in fitting_data:
                            f["dimensions"] = str(fitting_data["dimensions"]).strip()
                        if "inputs" in fitting_data:
                            f["inputs"] = fitting_data["inputs"]
                        if "unit_system" in fitting_data:
                            f["unit_system"] = fitting_data["unit_system"]
                        if "mfr" in fitting_data:
                            f["mfr"] = str(fitting_data["mfr"]).strip()
                        if "model" in fitting_data:
                            f["model"] = str(fitting_data["model"]).strip()
                        if "remarks" in fitting_data:
                            f["remarks"] = str(fitting_data["remarks"]).strip()
                        if "Q" in fitting_data:
                            f["Q"] = float(fitting_data.get("Q", 0) or 0)
                        if "velocity" in fitting_data:
                            f["velocity"] = float(fitting_data.get("velocity", 0) or 0)
                        if not f.get("is_custom"):
                            if "pv" in fitting_data: f["pv"] = fitting_data["pv"]
                            if "f_or_Co" in fitting_data: f["f_or_Co"] = fitting_data["f_or_Co"]
                            if "coeff_type" in fitting_data: f["coeff_type"] = fitting_data["coeff_type"]
                        else:
                            f["pv"] = None
                            f["f_or_Co"] = None
                            f["coeff_type"] = "N/A"

                        f["dp"] = dp_val
                        f["qty"] = qty_val
                        f["total_dp"] = total_dp_val
                        if "De" in fitting_data: f["De"] = fitting_data["De"]
                        if "notes" in fitting_data:
                            f["notes"] = str(fitting_data["notes"]).strip()
                        elif "remarks" in fitting_data:
                            f["notes"] = str(fitting_data["remarks"]).strip()

                        renumber_fittings(p["fittings"])
                        f["updated_at"] = _get_timestamp()
                        p["updated_at"] = _get_timestamp()
                        save_projects_data(data)
                        return f
                    except Exception as ex:
                        print("Error updating fitting:", ex)
                        return None
    return None

def reorder_fittings_in_project(project_id, source_index, target_index):
    """
    Moves a fitting from source_index to target_index and renumbers all tags.
    """
    data = get_projects_data()
    for p in data.get("projects", []):
        if p.get("id") == project_id:
            fittings = p.get("fittings", [])
            n = len(fittings)
            if 0 <= source_index < n and 0 <= target_index < n:
                if source_index != target_index:
                    item = fittings.pop(source_index)
                    fittings.insert(target_index, item)
                renumber_fittings(fittings)
                p["updated_at"] = _get_timestamp()
                save_projects_data(data)
                return True
            return False
    return False

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

def export_project_archive(project_id):
    """
    Exports a self-contained, portable project archive package (.dfp).
    Contains project metadata, full fitting schedule, Auto Duct Sizer runs,
    design margins, and custom equipment templates for offline backup or sharing.
    """
    project = get_project(project_id)
    if not project:
        return None, None

    clean_code = re.sub(r'[^a-zA-Z0-9_\-\.]', '_', str(project.get("code") or "PRJ").strip())
    clean_name = re.sub(r'[^a-zA-Z0-9_\-\.]', '_', str(project.get("name") or "Project").strip())
    filename = f"{clean_code}_{clean_name}.dfp"

    # Gather user-saved custom equipment templates if any
    custom_templates = []
    templates_file = os.path.join(os.path.dirname(__file__), "custom_templates.json")
    user_data = os.environ.get("DUCTFIT_USER_DATA")
    if user_data and os.path.exists(os.path.join(user_data, "custom_templates.json")):
        templates_file = os.path.join(user_data, "custom_templates.json")

    if os.path.exists(templates_file):
        try:
            with open(templates_file, "r", encoding="utf-8") as f:
                raw_t = json.load(f)
                if isinstance(raw_t, list):
                    custom_templates = raw_t
        except Exception:
            pass

    archive = {
        "file_format": "ductfit_project_archive",
        "file_version": "1.0",
        "app_name": "DuctFit Pro",
        "exported_at": _get_timestamp(),
        "project": project,
        "custom_templates": custom_templates
    }
    return archive, filename

def validate_project_archive(archive_data):
    """
    Validates the structure of a project archive (.dfp / .json)
    and checks whether it conflicts with an existing project in the workspace.
    """
    if not isinstance(archive_data, dict):
        return {"valid": False, "error": "Invalid file format: content must be a JSON object."}

    # Allow both wrapped archive package or direct project entity
    if archive_data.get("file_format") == "ductfit_project_archive" and "project" in archive_data:
        project_obj = archive_data["project"]
    elif "fittings" in archive_data or "code" in archive_data:
        project_obj = archive_data
    else:
        return {"valid": False, "error": "Unrecognized project archive file structure."}

    if not isinstance(project_obj, dict):
        return {"valid": False, "error": "Missing valid project data structure."}

    code = str(project_obj.get("code") or "").strip()
    name = str(project_obj.get("name") or "").strip()
    if not code:
        return {"valid": False, "error": "Project Code is missing in archive."}

    data = get_projects_data()
    existing_by_code = None
    existing_by_id = None

    for p in data.get("projects", []):
        if p.get("code", "").strip().lower() == code.lower():
            existing_by_code = p
        if p.get("id") == project_obj.get("id"):
            existing_by_id = p

    has_conflict = existing_by_code is not None or existing_by_id is not None
    conflict_project = existing_by_code or existing_by_id

    fittings = project_obj.get("fittings", [])
    duct_segments = project_obj.get("duct_segments", [])
    total_dp = sum(float(f.get("total_dp", f.get("dp", 0)) or 0) for f in fittings)

    return {
        "valid": True,
        "project": project_obj,
        "summary": {
            "id": project_obj.get("id"),
            "code": code,
            "name": name,
            "client": project_obj.get("client", ""),
            "contractor": project_obj.get("contractor", ""),
            "subcontractor": project_obj.get("subcontractor", ""),
            "unit_system": project_obj.get("unit_system", "SI"),
            "design_margin": float(project_obj.get("design_margin", 0.0) or 0.0),
            "fittings_count": len(fittings),
            "duct_segments_count": len(duct_segments),
            "total_dp": round(total_dp, 2),
            "notes": project_obj.get("notes", ""),
            "exported_at": archive_data.get("exported_at", _get_timestamp())
        },
        "has_conflict": has_conflict,
        "conflict_info": {
            "existing_id": conflict_project.get("id") if conflict_project else None,
            "existing_code": conflict_project.get("code") if conflict_project else None,
            "existing_name": conflict_project.get("name") if conflict_project else None,
            "existing_fittings_count": len(conflict_project.get("fittings", [])) if conflict_project else 0
        } if has_conflict else None
    }

def import_project_archive(archive_data, conflict_resolution="copy"):
    """
    Imports an archived project (.dfp) into DuctFit Pro.
    - If conflict_resolution == 'overwrite': updates existing matching project in place.
    - If conflict_resolution == 'copy' (or no conflict): generates fresh unique IDs and imports as distinct project.
    Sets the imported project as the active project.
    """
    val = validate_project_archive(archive_data)
    if not val.get("valid"):
        raise ValueError(val.get("error", "Invalid archive data"))

    project_obj = val["project"]
    data = get_projects_data()
    projects = data.get("projects", [])

    existing_idx = None
    for idx, p in enumerate(projects):
        if p.get("id") == project_obj.get("id") or p.get("code", "").strip().lower() == str(project_obj.get("code")).strip().lower():
            existing_idx = idx
            break

    if existing_idx is not None and conflict_resolution == "overwrite":
        # Overwrite existing project
        target_id = projects[existing_idx]["id"]
        project_obj["id"] = target_id
        project_obj["updated_at"] = _get_timestamp()
        if not project_obj.get("created_at"):
            project_obj["created_at"] = projects[existing_idx].get("created_at", _get_timestamp())
        project_obj["fittings"] = renumber_fittings(project_obj.get("fittings", []))
        projects[existing_idx] = project_obj
        data["active_project_id"] = target_id
        final_project = project_obj
    else:
        # Create as new project / separate copy
        ts = int(time.time() * 1000)
        new_id = f"prj_{ts}"
        base_code = str(project_obj.get("code") or "PRJ").strip()
        base_name = str(project_obj.get("name") or "Imported Project").strip()

        # Ensure unique code if duplicate
        new_code = base_code
        if any(p.get("code", "").strip().lower() == new_code.lower() for p in projects):
            suffix_num = 1
            while any(p.get("code", "").strip().lower() == f"{base_code} (Copy {suffix_num})".lower() for p in projects):
                suffix_num += 1
            new_code = f"{base_code} (Copy)" if suffix_num == 1 else f"{base_code} (Copy {suffix_num})"
            base_name = f"{base_name} (Retrieved)"

        project_obj["id"] = new_id
        project_obj["code"] = new_code
        project_obj["name"] = base_name
        project_obj["created_at"] = _get_timestamp()
        project_obj["updated_at"] = _get_timestamp()

        # Regenerate fitting IDs to prevent cross-project ID collisions
        fittings = project_obj.get("fittings", [])
        for i, f in enumerate(fittings):
            f["id"] = f"fit_{ts}_{i+1}"
        project_obj["fittings"] = renumber_fittings(fittings)

        # Regenerate duct segment IDs if present
        segments = project_obj.get("duct_segments", [])
        for i, s in enumerate(segments):
            s["id"] = f"seg_{ts}_{i+1}"
        project_obj["duct_segments"] = segments

        projects.insert(0, project_obj)
        data["active_project_id"] = new_id
        final_project = project_obj

    data["projects"] = projects
    save_projects_data(data)

    # Merge custom templates if included
    if isinstance(archive_data, dict):
        custom_templates = archive_data.get("custom_templates")
        if isinstance(custom_templates, list) and custom_templates:
            _merge_custom_templates(custom_templates)

    return final_project

def _merge_custom_templates(templates_to_merge):
    """Safely merges custom templates into custom_templates.json without duplicate IDs"""
    templates_file = os.path.join(os.path.dirname(__file__), "custom_templates.json")
    user_data = os.environ.get("DUCTFIT_USER_DATA")
    if user_data:
        templates_file = os.path.join(user_data, "custom_templates.json")

    existing_templates = []
    if os.path.exists(templates_file):
        try:
            with open(templates_file, "r", encoding="utf-8") as f:
                d = json.load(f)
                if isinstance(d, list):
                    existing_templates = d
        except Exception:
            existing_templates = []

    existing_ids = {t.get("id") for t in existing_templates if isinstance(t, dict) and t.get("id")}
    existing_codes = {t.get("code", "").lower() for t in existing_templates if isinstance(t, dict) and t.get("code")}

    modified = False
    for t in templates_to_merge:
        if isinstance(t, dict) and t.get("name") and t.get("code"):
            t_id = t.get("id")
            t_code = t.get("code", "").lower()
            if t_id not in existing_ids and t_code not in existing_codes:
                existing_templates.append(t)
                existing_ids.add(t_id)
                existing_codes.add(t_code)
                modified = True

    if modified:
        try:
            with open(templates_file, "w", encoding="utf-8") as f:
                json.dump(existing_templates, f, indent=2)
        except Exception as e:
            print(f"Error saving merged templates: {e}")



