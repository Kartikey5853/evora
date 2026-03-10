"""Developer overrides / bypass flags.

This replaces the removed fake-clock system with simple per-feature bypasses.

All overrides are intentionally in-memory (reset on server restart).
"""

from __future__ import annotations

from threading import Lock

_lock = Lock()

_state = {
    "bypass_time_windows": False,
}


def get_state() -> dict:
    with _lock:
        return dict(_state)


def set_bypass_time_windows(enabled: bool) -> None:
    with _lock:
        _state["bypass_time_windows"] = bool(enabled)


def bypass_time_windows() -> bool:
    with _lock:
        return bool(_state.get("bypass_time_windows"))
