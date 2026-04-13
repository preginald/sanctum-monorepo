"""Unit tests for UUID prefix resolution service (#1931).

Tests cover:
- Full UUID lookup (existing behaviour preserved)
- Short prefix (8+ chars) resolving to single entity
- Ambiguous prefix returning 409 with candidates
- Non-existent prefix returning 404
- Prefix too short (<8 chars) returning 422
- Non-hex characters returning 422
- Dash handling in prefixes
- is_deleted filtering (models with and without the column)
- get_or_404 helper with eager load options
- Label extraction from various model attributes
"""

import pytest
from uuid import UUID, uuid4
from unittest.mock import MagicMock, patch, PropertyMock, create_autospec
from fastapi import HTTPException

from app.services.uuid_resolver import (
    resolve_uuid,
    get_or_404,
    _get_label,
    _strip_dashes,
    MIN_PREFIX_LENGTH,
    MAX_CANDIDATES,
)


# ---------------------------------------------------------------------------
# Stubs
# ---------------------------------------------------------------------------

class StubEntity:
    """Simple stub with .id and .name for label tests."""
    def __init__(self, id=None, name="Test Entity"):
        self.id = id or uuid4()
        self.name = name


class StubSubjectEntity:
    def __init__(self, id=None, subject="Test Subject"):
        self.id = id or uuid4()
        self.subject = subject


class StubMinimalEntity:
    def __init__(self, id=None):
        self.id = id or uuid4()


def _make_chainable_query(results):
    """Build a MagicMock that simulates a chainable SQLAlchemy query."""
    q = MagicMock()
    q.filter.return_value = q
    q.options.return_value = q
    q.limit.return_value = q
    q.first.return_value = results[0] if results else None
    q.all.return_value = results
    return q


def _make_db(results):
    db = MagicMock()
    db.query.return_value = _make_chainable_query(results)
    return db


def _make_model(has_is_deleted=True):
    """Create a mock model class with an .id column attribute."""
    model = MagicMock()
    model.__name__ = "TestModel"
    model.id = MagicMock()  # Simulates SQLAlchemy column descriptor
    if has_is_deleted:
        model.is_deleted = MagicMock()
    else:
        # Remove is_deleted so hasattr returns False
        del model.is_deleted
    return model


# ---------------------------------------------------------------------------
# _get_label tests
# ---------------------------------------------------------------------------

def test_label_uses_name():
    assert _get_label(StubEntity(name="My Project")) == "My Project"


def test_label_uses_subject_when_no_name():
    assert _get_label(StubSubjectEntity(subject="Bug Report")) == "Bug Report"


def test_label_falls_back_to_id():
    e = StubMinimalEntity()
    assert _get_label(e) == str(e.id)


# ---------------------------------------------------------------------------
# _strip_dashes tests
# ---------------------------------------------------------------------------

def test_strip_dashes():
    assert _strip_dashes("a1b2c3d4-e5f6") == "a1b2c3d4e5f6"
    assert _strip_dashes("abcdef12") == "abcdef12"


# ---------------------------------------------------------------------------
# resolve_uuid tests
# ---------------------------------------------------------------------------

def test_full_uuid_found():
    """Full UUID resolves to the entity's id."""
    entity = StubEntity()
    model = _make_model()
    db = _make_db([entity])
    result = resolve_uuid(db, model, str(entity.id))
    assert result == entity.id


def test_full_uuid_not_found():
    """Full UUID that doesn't match raises 404."""
    model = _make_model()
    db = _make_db([])
    # first() returns None for empty results
    db.query.return_value.filter.return_value.filter.return_value.first.return_value = None
    db.query.return_value.filter.return_value.first.return_value = None
    with pytest.raises(HTTPException) as exc_info:
        resolve_uuid(db, model, str(uuid4()))
    assert exc_info.value.status_code == 404


def test_prefix_too_short():
    """Prefix shorter than MIN_PREFIX_LENGTH raises 422."""
    model = _make_model()
    db = _make_db([])
    with pytest.raises(HTTPException) as exc_info:
        resolve_uuid(db, model, "a1b2c3")  # 6 chars
    assert exc_info.value.status_code == 422
    assert "at least" in exc_info.value.detail


def test_non_hex_prefix():
    """Non-hex characters in prefix raise 422."""
    model = _make_model()
    db = _make_db([])
    with pytest.raises(HTTPException) as exc_info:
        resolve_uuid(db, model, "a1b2c3g4")  # 'g' is not hex
    assert exc_info.value.status_code == 422
    assert "hexadecimal" in exc_info.value.detail


def test_prefix_single_match():
    """8+ char hex prefix matching exactly one entity returns its UUID."""
    entity = StubEntity()
    model = _make_model()
    db = _make_db([entity])
    result = resolve_uuid(db, model, str(entity.id).replace("-", "")[:8])
    assert result == entity.id


def test_prefix_no_match():
    """Prefix with no matches raises 404."""
    model = _make_model()
    db = MagicMock()
    q = _make_chainable_query([])
    db.query.return_value = q
    with pytest.raises(HTTPException) as exc_info:
        resolve_uuid(db, model, "a1b2c3d4")
    assert exc_info.value.status_code == 404


def test_prefix_ambiguous():
    """Prefix matching multiple entities raises 409 with candidates."""
    e1 = StubEntity(name="Entity One")
    e2 = StubEntity(name="Entity Two")
    model = _make_model()
    db = _make_db([e1, e2])
    with pytest.raises(HTTPException) as exc_info:
        resolve_uuid(db, model, "a1b2c3d4")
    assert exc_info.value.status_code == 409
    detail = exc_info.value.detail
    assert detail["detail"] == "Ambiguous UUID prefix"
    assert len(detail["candidates"]) == 2


def test_prefix_with_dashes():
    """Prefix containing dashes is handled correctly (dashes stripped)."""
    entity = StubEntity()
    model = _make_model()
    db = _make_db([entity])
    # Use first 10 chars of UUID string which includes a dash at position 8
    prefix_with_dash = str(entity.id)[:10]  # e.g. "a1b2c3d4-e"
    result = resolve_uuid(db, model, prefix_with_dash)
    assert result == entity.id


def test_prefix_uppercase():
    """Uppercase hex prefix is accepted."""
    entity = StubEntity()
    model = _make_model()
    db = _make_db([entity])
    result = resolve_uuid(db, model, str(entity.id).replace("-", "")[:8].upper())
    assert result == entity.id


def test_model_without_is_deleted():
    """Models without is_deleted column skip the deleted filter."""
    entity = StubEntity()
    model = _make_model(has_is_deleted=False)
    db = _make_db([entity])
    result = resolve_uuid(db, model, str(entity.id))
    assert result == entity.id


def test_candidates_capped():
    """More than MAX_CANDIDATES matches truncates the candidate list."""
    entities = [StubEntity(name=f"Entity {i}") for i in range(MAX_CANDIDATES + 2)]
    model = _make_model()
    # limit(11) will return 11 entities
    db = MagicMock()
    q = _make_chainable_query(entities[:MAX_CANDIDATES + 1])
    db.query.return_value = q
    with pytest.raises(HTTPException) as exc_info:
        resolve_uuid(db, model, "a1b2c3d4")
    detail = exc_info.value.detail
    assert detail["truncated"] is True
    assert len(detail["candidates"]) == MAX_CANDIDATES


# ---------------------------------------------------------------------------
# get_or_404 tests
# ---------------------------------------------------------------------------

def test_get_or_404_returns_entity():
    """get_or_404 resolves and returns the full entity."""
    entity = StubEntity()
    model = _make_model()
    db = _make_db([entity])
    result = get_or_404(db, model, str(entity.id))
    assert result.id == entity.id


def test_get_or_404_not_found():
    """get_or_404 raises 404 when entity not found."""
    model = _make_model()
    db = _make_db([])
    db.query.return_value.filter.return_value.filter.return_value.first.return_value = None
    db.query.return_value.filter.return_value.first.return_value = None
    with pytest.raises(HTTPException) as exc_info:
        get_or_404(db, model, str(uuid4()))
    assert exc_info.value.status_code == 404


def test_get_or_404_with_options():
    """get_or_404 passes eager load options through."""
    entity = StubEntity()
    model = _make_model()
    db = _make_db([entity])
    mock_option = MagicMock()
    result = get_or_404(db, model, str(entity.id), options=[mock_option])
    assert result.id == entity.id
