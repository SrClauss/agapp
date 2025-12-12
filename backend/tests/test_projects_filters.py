from app.crud.project import build_project_query
from app.schemas.project import ProjectFilter


def test_build_query_with_subcategories_only():
    filters = ProjectFilter(subcategories=["paint", "plumbing"])
    q = build_project_query(filters)
    assert "category.sub" in q
    assert q["category.sub"] == {"$in": ["paint", "plumbing"]}


def test_build_query_with_no_filters_returns_empty_dict():
    filters = None
    q = build_project_query(filters)
    assert q == {}


def test_build_query_with_category_and_geo():
    filters = ProjectFilter(category="home", latitude=10.0, longitude=20.0, radius_km=5)
    q = build_project_query(filters)
    # Should combine base category clause and geo $or under $and
    assert "$and" in q
    assert isinstance(q["$and"], list)
    base, geo_clause = q["$and"]
    assert "$or" in geo_clause
    assert any(isinstance(item, dict) and item.get("category") == "home" or item.get("category.main") == "home" for item in base.get("$or", []))


def test_build_query_category_and_subcategories_and_geo():
    filters = ProjectFilter(category="home", subcategories=["kitchen"], latitude=1.0, longitude=2.0, radius_km=10)
    q = build_project_query(filters)
    # Expect $and with base and geo $or
    assert "$and" in q
    base, geo_clause = q["$and"]
    # base should have both $or (category match) and category.sub
    assert "$or" in base
    assert "category.sub" in base and base["category.sub"]["$in"] == ["kitchen"]
    assert "$or" in geo_clause
