from app.schemas.project import ProjectCreate, ProjectUpdate
import pytest


def test_project_create_title_too_long_raises_validation_error():
    long_title = 'A' * 200
    data = {
        'title': long_title,
        'description': 'Some description',
        'category': {'main': 'Test', 'sub': 'Sub'},
        'location': {'address': 'Rua Teste 123'}
    }
    with pytest.raises(Exception):
        ProjectCreate(**data)


def test_project_update_title_too_long_raises_validation_error():
    long_title = 'B' * 120
    with pytest.raises(Exception):
        ProjectUpdate(title=long_title)
