from urllib.parse import urlparse, urlunparse

MAX_URL_LENGTH = 2048

BLOCKED_DOMAINS = {
    "evil.com",
    "malware.example.com",
    "phishing.example.com",
}


def is_blocked_domain(hostname: str | None) -> bool:
    if hostname is None:
        return True
    return hostname.lower() in BLOCKED_DOMAINS


def validate_url(url: str) -> str:
    normalized = url.strip()
    if not normalized:
        raise ValueError("URL is required")
    if len(normalized) > MAX_URL_LENGTH:
        raise ValueError("URL is too long")

    parsed = urlparse(normalized)
    if parsed.scheme not in {"http", "https"}:
        raise ValueError("URL scheme must be http or https")
    if is_blocked_domain(parsed.hostname):
        raise ValueError("URL domain is blocked")

    scheme = "https" if parsed.scheme == "http" else parsed.scheme
    netloc = parsed.netloc.lower()
    path = parsed.path
    if parsed.path == "/" and not parsed.params and not parsed.query:
        path = ""

    return urlunparse(
        (scheme, netloc, path, parsed.params, parsed.query, parsed.fragment)
    )
