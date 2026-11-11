import time
from collections import defaultdict
from datetime import datetime, timezone
from threading import Lock

try:
    from app.mongo_client import mongo_db
except Exception:
    mongo_db = None


class SlidingWindowRateLimiter:
    """
    Distributed sliding-window rate limiter with MongoDB persistence and thread-safe in-memory caching.
    Tracks failed attempts per key (e.g. client IP or IP + username).
    """

    def __init__(self, max_attempts: int = 5, window_seconds: int = 300):
        self.max_attempts = max_attempts
        self.window_seconds = window_seconds
        self._attempts = defaultdict(list)
        self._lock = Lock()

    def is_rate_limited(self, key: str) -> bool:
        """Check if the given key has exceeded the maximum permitted attempts."""
        now = time.time()
        cutoff = now - self.window_seconds

        # Check MongoDB first if available for distributed multi-worker consistency
        if mongo_db is not None:
            try:
                doc = mongo_db.login_rate_limits.find_one({"_id": key})
                if doc and "attempts" in doc:
                    db_attempts = [t for t in doc["attempts"] if t > cutoff]
                    if len(db_attempts) >= self.max_attempts:
                        with self._lock:
                            self._attempts[key] = db_attempts
                        return True
            except Exception:
                pass

        with self._lock:
            attempts = [t for t in self._attempts[key] if t > cutoff]
            self._attempts[key] = attempts
            return len(attempts) >= self.max_attempts

    def record_failure(self, key: str) -> int:
        """Record a failed attempt for the key and return current count in window."""
        now = time.time()
        cutoff = now - self.window_seconds

        with self._lock:
            attempts = [t for t in self._attempts[key] if t > cutoff]
            attempts.append(now)
            self._attempts[key] = attempts
            count = len(attempts)

        if mongo_db is not None:
            try:
                mongo_db.login_rate_limits.update_one(
                    {"_id": key},
                    {
                        "$pull": {"attempts": {"$lte": cutoff}},
                    },
                    upsert=True,
                )
                mongo_db.login_rate_limits.update_one(
                    {"_id": key},
                    {
                        "$push": {"attempts": now},
                        "$set": {"updated_at": datetime.now(timezone.utc)},
                    },
                    upsert=True,
                )
            except Exception:
                pass

        return count

    def record_success(self, key: str) -> None:
        """Clear failed attempts for key upon successful authentication."""
        with self._lock:
            if key in self._attempts:
                del self._attempts[key]

        if mongo_db is not None:
            try:
                mongo_db.login_rate_limits.delete_one({"_id": key})
            except Exception:
                pass

    def reset(self) -> None:
        """Reset all rate limiter state (used in testing)."""
        with self._lock:
            self._attempts.clear()

        if mongo_db is not None:
            try:
                mongo_db.login_rate_limits.delete_many({})
            except Exception:
                pass


# Default login rate limiter: 5 failed attempts per 5 minutes
login_rate_limiter = SlidingWindowRateLimiter(max_attempts=5, window_seconds=300)

