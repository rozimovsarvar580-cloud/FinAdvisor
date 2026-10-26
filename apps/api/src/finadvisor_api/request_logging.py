import json
import logging
import re

_EMAIL = re.compile(r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b", re.IGNORECASE)
_IP_ADDRESS = re.compile(r"\b(?:\d{1,3}\.){3}\d{1,3}\b")
_BEARER = re.compile(r"(?i)\bBearer\s+[^\s,;]+")
_SECRET = re.compile(r"(?i)(password|token|secret|api[_-]?key)(\s*[=:]\s*)[^\s,;]+")


def redact_log_value(value: str) -> str:
    """Remove common credentials and direct personal identifiers from log text."""
    value = _BEARER.sub("Bearer [REDACTED]", value)
    value = _SECRET.sub(r"\1\2[REDACTED]", value)
    value = _EMAIL.sub("[REDACTED]", value)
    return _IP_ADDRESS.sub("[REDACTED]", value)


class RequestJsonFormatter(logging.Formatter):
    """Emit a small allow-listed JSON request record, never arbitrary log extras."""

    def format(self, record: logging.LogRecord) -> str:
        event = {
            "event": "api_request",
            "request_id": redact_log_value(str(getattr(record, "request_id", "unknown"))),
            "user_id": getattr(record, "user_id", None),
            "method": redact_log_value(str(getattr(record, "method", ""))),
            "path": redact_log_value(str(getattr(record, "path", ""))),
            "status_code": getattr(record, "status_code", None),
        }
        return json.dumps(event, separators=(",", ":"), ensure_ascii=True)
