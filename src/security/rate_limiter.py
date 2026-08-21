"""
TOKEN BUCKET & SLIDING WINDOW RATE LIMITER MODULE
Protects AI Agent and Scraper endpoints against abusive traffic, denial-of-service,
and concurrency starvation in multi-tenant environments.
"""

import time
import logging
from typing import Dict, Tuple, Optional

logger = logging.getLogger("RateLimiter")

class SlidingWindowRateLimiter:
    """
    In-Memory Sliding Window Rate Limiter.
    Can be backed by Redis in multi-instance production setups.
    """
    def __init__(self, max_requests: int = 30, window_seconds: int = 3600):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._user_windows: Dict[str, list] = {}

    def check_rate_limit(self, identifier: str) -> Tuple[bool, int, int]:
        """
        Checks if a user/IP has exceeded their request quota.
        Returns:
            - is_allowed (bool)
            - remaining_requests (int)
            - reset_in_seconds (int)
        """
        now = time.time()
        cutoff = now - self.window_seconds

        if identifier not in self._user_windows:
            self._user_windows[identifier] = []

        # Filter out expired timestamps
        timestamps = [ts for ts in self._user_windows[identifier] if ts > cutoff]
        self._user_windows[identifier] = timestamps

        if len(timestamps) < self.max_requests:
            # Grant access
            self._user_windows[identifier].append(now)
            remaining = self.max_requests - len(self._user_windows[identifier])
            return True, remaining, int(self.window_seconds)

        # Quota exceeded
        oldest_ts = timestamps[0]
        reset_in = max(1, int(oldest_ts + self.window_seconds - now))
        logger.warning(f"[RateLimiter] Quota exceeded for '{identifier}'. Reset in {reset_in}s.")
        return False, 0, reset_in

    def reset_user(self, identifier: str):
        """Manually resets a user's rate limit window."""
        self._user_windows.pop(identifier, None)

# Global singleton rate limiter instance (30 requests/hour default)
rate_limiter = SlidingWindowRateLimiter(max_requests=30, window_seconds=3600)
