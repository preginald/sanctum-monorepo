"""
Shared pagination dependency for list endpoints.

Usage:
    from ..services.pagination import pagination_params

    @router.get("/things")
    def list_things(pagination: dict = Depends(pagination_params)):
        limit, offset = pagination["limit"], pagination["offset"]
"""
from fastapi import Query


def pagination_params(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
) -> dict:
    return {"limit": limit, "offset": offset}
