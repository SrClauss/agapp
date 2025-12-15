import pytest
from types import SimpleNamespace
from fastapi import HTTPException

from app.schemas.project import ProjectCreate


@pytest.mark.asyncio
async def test_create_new_project_requires_coordinates_for_non_remote(monkeypatch):
    # Prepare a ProjectCreate with an address but no coordinates
    data = {
        'title': 'Fix sink',
        'description': 'Please fix the sink',
        'category': {'main': 'Plumbing', 'sub': 'Repair'},
        'location': {'address': 'Rua Imaginaria 123'},
        'remote_execution': False
    }
    project = ProjectCreate(**data)

    # Patch geocode_address to return None (simulate failure to geocode)
    async def fake_geocode(addr):
        return None

    import app.services.geocoding as geocoding_mod
    monkeypatch.setattr(geocoding_mod, 'geocode_address', fake_geocode)

    from app.api.endpoints.projects import create_new_project

    fake_user = SimpleNamespace(id='fake-user-id')

    with pytest.raises(HTTPException) as excinfo:
        await create_new_project(project, current_user=fake_user, db=None)

    assert excinfo.value.status_code == 400
    assert 'Endereço sem coordenadas' in str(excinfo.value.detail)


@pytest.mark.asyncio
async def test_create_new_project_geocodes_and_creates(monkeypatch):
    data = {
        'title': 'Fix sink',
        'description': 'Please fix the sink',
        'category': {'main': 'Plumbing', 'sub': 'Repair'},
        'location': {'address': 'Rua Teste 456'},
        'remote_execution': False
    }
    project = ProjectCreate(**data)

    async def fake_geocode(addr):
        return {'address': 'Rua Teste 456, Cidade', 'coordinates': [-46.0, -23.5], 'provider': 'fake'}

    async def fake_create_project(db, project_obj, client_id):
        # Simulate DB-created project (return minimal Project-like dict)
        proj = project_obj.dict()
        proj['id'] = 'proj-123'
        proj['client_id'] = client_id
        return proj

    import app.services.geocoding as geocoding_mod
    monkeypatch.setattr(geocoding_mod, 'geocode_address', fake_geocode)

    import app.crud.project as crud_project
    monkeypatch.setattr(crud_project, 'create_project', fake_create_project)

    from app.api.endpoints.projects import create_new_project
    fake_user = SimpleNamespace(id='fake-user-id')

    result = await create_new_project(project, current_user=fake_user, db=None)

    assert result['id'] == 'proj-123'
    # Coordinates should have been set by geocoding step
    assert result['location']['coordinates'] == {'type': 'Point', 'coordinates': [-46.0, -23.5]}
