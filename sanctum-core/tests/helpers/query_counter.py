"""SQLAlchemy query-counting helper for live-endpoint query-budget tests.

Usage::

    from tests.helpers.query_counter import QueryCounter

    def test_something():
        with QueryCounter(db) as counter:
            client.get("/some-endpoint")
        assert counter.count < 15
"""

from __future__ import annotations

from sqlalchemy import event
from sqlalchemy.engine import Engine


class QueryCounter:
    """Context manager that counts SQL statements executed on an engine.

    Subscribes to ``after_cursor_execute`` and increments a counter
    for every statement.  Resets on entry, captures on exit.
    """

    def __init__(self, engine: Engine):
        self._engine = engine
        self.count: int = 0
        self.statements: list[str] = []
        self._listener = None

    def _callback(self, conn, cursor, statement, parameters, context, executemany):
        self.count += 1
        self.statements.append(statement)

    def __enter__(self) -> QueryCounter:
        self.count = 0
        self.statements.clear()
        event.listen(self._engine, "after_cursor_execute", self._callback)
        return self

    def __exit__(self, *exc_info) -> None:
        event.remove(self._engine, "after_cursor_execute", self._callback)
