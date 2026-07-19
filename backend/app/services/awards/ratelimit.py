"""Per-IP sliding-window limiter for the public awards endpoint.

SINGLE-INSTANCE ASSUMPTION: state is in-process, so with multiple workers
the effective cap is per worker. This is a safety valve against runaway
scanning, not a billing control — the 6-hour scan cache absorbs real load.
Move to a shared store (Redis/DB) for scale-out, as noted in sync.py and
report.py.
"""
from __future__ import annotations

import time
from collections import defaultdict, deque


class SlidingWindowLimiter:
    def __init__(self, max_events: int, window_seconds: int) -> None:
        self.max_events = max_events
        self.window = window_seconds
        self._events: dict[str, deque[float]] = defaultdict(deque)

    def allow(self, key: str, now: float | None = None) -> bool:
        t = time.monotonic() if now is None else now
        q = self._events[key]
        cutoff = t - self.window
        while q and q[0] <= cutoff:
            q.popleft()
        if len(q) >= self.max_events:
            return False
        q.append(t)
        return True
