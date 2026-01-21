from typing import Callable, Dict, List, Any
from fastapi import BackgroundTasks

# Define Payload Types (Generic for now)
EventPayload = Any

# Listener Signature: (payload, background_tasks) -> None
Listener = Callable[[EventPayload, BackgroundTasks], None]

class EventBus:
    def __init__(self):
        self._subscribers: Dict[str, List[Listener]] = {}

    def subscribe(self, event_type: str, listener: Listener):
        if event_type not in self._subscribers:
            self._subscribers[event_type] = []
        self._subscribers[event_type].append(listener)

    def emit(self, event_type: str, payload: EventPayload, background_tasks: BackgroundTasks):
        """
        Trigger all listeners for an event. 
        Listeners typically add work to background_tasks to stay non-blocking.
        """
        if event_type in self._subscribers:
            for listener in self._subscribers[event_type]:
                try:
                    listener(payload, background_tasks)
                except Exception as e:
                    print(f"Error in event listener for {event_type}: {e}")

# Global Instance
event_bus = EventBus()