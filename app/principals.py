"""Principal types for Sanctum Core authentication (#2793).

Core can authenticate two principal kinds:

1. ``models.User`` — a human (or trusted-service) row in the ``users`` table,
   authenticated via Personal Access Token (``sntm_...``), RS256 user JWT from
   Sanctum Auth, or legacy HS256 session JWT.

2. ``ServicePrincipal`` — an OAuth2 Client-Credentials caller (M2M). No row
   in ``users`` — identity is entirely token-derived per DOC-064 §3b.

See ticket #2793 and DOC-064 for the approved design.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import TYPE_CHECKING, Any, Union

if TYPE_CHECKING:  # pragma: no cover - typing only
    from . import models


@dataclass(frozen=True)
class ServicePrincipal:
    """OAuth2 Client-Credentials caller identity.

    Derived entirely from decoded JWT claims — there is no ``users`` row.
    ``client_name`` is optional because DOC-064 §3b does not mandate a
    ``client_name`` claim on M2M tokens; callers that need a human-readable
    label should use :func:`display_name` which falls back to ``client_id``.
    """

    client_id: str
    client_name: str | None
    scopes: list[str] = field(default_factory=list)
    issued_at: datetime | None = None
    expires_at: datetime | None = None
    jti: str | None = None
    raw_claims: dict[str, Any] = field(default_factory=dict)

    @property
    def display_name(self) -> str:
        """Human-readable label for audit logs / UI."""
        return self.client_name or f"service:{self.client_id[:8]}"

    @property
    def principal_type(self) -> str:
        return "service"

    def has_scope(self, scope: str) -> bool:
        """Wildcard (``*``) grants everything; otherwise exact match."""
        granted = set(self.scopes)
        return "*" in granted or scope in granted


# Union of every principal the auth layer can resolve. Imported lazily to avoid
# a circular import with ``app.models``.
Principal = Union["models.User", ServicePrincipal]


def _to_datetime(value: Any) -> datetime | None:
    """Coerce a JWT epoch-seconds claim into a timezone-aware datetime."""
    if value is None:
        return None
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    try:
        return datetime.fromtimestamp(int(value), tz=timezone.utc)
    except (TypeError, ValueError):
        return None


def service_principal_from_claims(claims: dict[str, Any]) -> ServicePrincipal:
    """Build a :class:`ServicePrincipal` from verified M2M JWT claims.

    Per DOC-064 §3b, ``scope`` is a space-delimited string (OAuth2 / RFC 6749
    standard). ``client_name`` is optional and treated as ``None`` if absent.
    """
    client_id = claims.get("sub") or claims.get("client_id") or ""
    scope_claim = claims.get("scope") or ""
    if isinstance(scope_claim, list):
        scopes = [str(s) for s in scope_claim if s]
    else:
        scopes = [s for s in str(scope_claim).split() if s]

    return ServicePrincipal(
        client_id=str(client_id),
        client_name=claims.get("client_name"),
        scopes=scopes,
        issued_at=_to_datetime(claims.get("iat")),
        expires_at=_to_datetime(claims.get("exp")),
        jti=claims.get("jti"),
        raw_claims=dict(claims),
    )


def principal_audit_label(principal: Any) -> str:
    """Return the audit-log ``changed_by``-style label for any principal.

    Forward-compatible shim: write-path handlers still demand ``User`` in v1,
    but this helper lets future opt-in handlers stamp a service label into
    free-text actor columns (e.g. ``ticket_transitions.changed_by``).
    """
    if isinstance(principal, ServicePrincipal):
        return f"service:{principal.client_name or principal.client_id}"
    full_name = getattr(principal, "full_name", None)
    return full_name or "system"


def principal_type_of(principal: Any) -> str:
    """Return ``"service"`` or ``"user"`` for audit-log disambiguation."""
    return "service" if isinstance(principal, ServicePrincipal) else "user"


__all__ = [
    "Principal",
    "ServicePrincipal",
    "principal_audit_label",
    "principal_type_of",
    "service_principal_from_claims",
]
