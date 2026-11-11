from fastapi import Request, Response, status
from fastapi.responses import JSONResponse

MAX_REQUEST_BODY_BYTES = 5 * 1024 * 1024  # 5 MB


def apply_security_headers(response: Response) -> Response:
    """Attach hardened HTTP security headers to response."""
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = (
        "accelerometer=(), camera=(), geolocation=(), "
        "gyroscope=(), magnetometer=(), microphone=(), "
        "payment=(), usb=()"
    )
    response.headers["X-XSS-Protection"] = "1; mode=block"
    return response


def is_payload_oversized(
    content_length_str: str | None,
    max_bytes: int = MAX_REQUEST_BODY_BYTES,
) -> bool:
    """Return True if content-length header exceeds max allowed bytes."""
    if not content_length_str:
        return False
    try:
        return int(content_length_str) > max_bytes
    except (ValueError, TypeError):
        return False


async def security_and_size_middleware(request: Request, call_next):
    """FastAPI HTTP middleware enforcing security headers and payload size limits."""
    content_length_str = request.headers.get("content-length")
    if is_payload_oversized(content_length_str):
        return JSONResponse(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            content={
                "detail": "Request payload exceeds maximum allowed size of 5MB."
            },
        )

    response = await call_next(request)
    return apply_security_headers(response)

