import os
import json
from typing import Set, List

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', 'static'))
ICON_JSON_PATH = os.path.join(BASE_DIR, 'material-icons-web.json')

def _load_icons_from_json() -> List[str]:
    try:
        with open(ICON_JSON_PATH, 'r', encoding='utf-8') as fh:
            icons = json.load(fh)
            if isinstance(icons, list):
                return icons
    except Exception:
        pass
    # fallback curated list (short)
    return [
        'directions_car', 'color_lens', 'auto_fix_high', 'local_hospital', 'construction',
        'build', 'format_paint', 'brush', 'search', 'category'
    ]

_MATERIAL_ICONS = set(_load_icons_from_json())

def is_valid_material_icon(name: str) -> bool:
    if not name:
        return False
    return name in _MATERIAL_ICONS

def get_all_material_icons() -> List[str]:
    return sorted(list(_MATERIAL_ICONS))
