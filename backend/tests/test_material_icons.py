from app.utils.material_icons import is_valid_material_icon
from app.models.category import CategoryCreate
import pytest


def test_is_valid_material_icon_known():
    assert is_valid_material_icon('directions_car') is True


def test_is_valid_material_icon_unknown():
    assert is_valid_material_icon('this_icon_does_not_exist') is False


def test_category_create_valid_icon():
    data = {
        'name': 'TestCat',
        'tags': [],
        'subcategories': [],
        'icon_name': 'directions_car',
        'icon_library': 'MaterialIcons'
    }
    cat = CategoryCreate(**data)
    assert cat.icon_name == 'directions_car'


def test_category_create_invalid_icon_raises():
    data = {
        'name': 'TestCat',
        'tags': [],
        'subcategories': [],
        'icon_name': 'invalid_icon_name_123',
        'icon_library': 'MaterialIcons'
    }
    with pytest.raises(Exception):
        CategoryCreate(**data)
