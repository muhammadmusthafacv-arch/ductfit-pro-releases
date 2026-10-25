import os
import json
import datetime

VERSION_FILE = os.path.join(os.path.dirname(__file__), "version.json")

def format_version(major: int, minor: int, patch: int) -> str:
    """Formats version according to Ductfit Pro standard: X.ZZZ (e.g. 1.035)"""
    return f"{major}.{patch:03d}"

def get_version_data() -> dict:
    if os.path.exists(VERSION_FILE):
        try:
            with open(VERSION_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return {
        "version": "1.038",
        "major": 1,
        "minor": 0,
        "patch": 38,
        "total_updates": 38,
        "total_user_requests": 59
    }

def get_current_version() -> str:
    return get_version_data().get("version", "1.038")

def bump_version(description: str = "Incremental application update", user_request_num: int = None) -> str:
    """
    Increments the version patch number by 1 and updates version.json.
    Example: 1.035 -> 1.036
    """
    data = get_version_data()
    major = data.get("major", 1)
    minor = data.get("minor", 0)
    patch = data.get("patch", 38) + 1
    total_updates = data.get("total_updates", 38) + 1
    total_requests = data.get("total_user_requests", 59) + 1

    new_version_str = format_version(major, minor, patch)
    now_iso = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    changelog = data.get("changelog", [])
    changelog.append({
        "version": new_version_str,
        "timestamp": now_iso,
        "description": description,
        "request_index": user_request_num or total_requests
    })

    data["version"] = new_version_str
    data["major"] = major
    data["minor"] = minor
    data["patch"] = patch
    data["total_updates"] = total_updates
    data["total_user_requests"] = total_requests
    data["last_updated"] = now_iso
    data["changelog"] = changelog

    with open(VERSION_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    return new_version_str

if __name__ == "__main__":
    import sys
    desc = " ".join(sys.argv[1:]) if len(sys.argv) > 1 else "Incremental update"
    new_ver = bump_version(desc)
    print(f"Version bumped to: v{new_ver}")
