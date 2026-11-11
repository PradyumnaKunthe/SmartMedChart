import re
from datetime import date, datetime
from typing import Optional


# RFC 5322 compliant email regex pattern
EMAIL_REGEX = re.compile(
    r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$"
)

# Indian and general international mobile number pattern
# Supports: +919876543210, 919876543210, 09876543210, 9876543210, and +[1-9]\d{6,14}
INDIAN_MOBILE_REGEX = re.compile(
    r"^(?:\+91|91|0)?([6-9]\d{9})$"
)
INTL_MOBILE_REGEX = re.compile(
    r"^\+?[1-9]\d{7,14}$"
)


def validate_non_empty_str(v: Optional[str], field_name: str = "Field") -> str:
    """Validate that a string value is not None, not empty, and not whitespace-only."""
    if v is None:
        raise ValueError(f"{field_name} is required.")
    stripped = v.strip()
    if not stripped:
        raise ValueError(f"{field_name} cannot be empty or only whitespace.")
    return stripped


def validate_email_str(v: Optional[str], required: bool = True) -> Optional[str]:
    """Validate email syntax, trim whitespace, and normalize to lowercase."""
    if v is None:
        if required:
            raise ValueError("Please enter a valid email address.")
        return None

    normalized = v.strip().lower()
    if not normalized:
        if required:
            raise ValueError("Please enter a valid email address.")
        return None

    if len(normalized) > 255:
        raise ValueError("Email address cannot exceed 255 characters.")

    if not EMAIL_REGEX.match(normalized):
        raise ValueError("Please enter a valid email address.")

    # Reject consecutive dots or invalid domain parts
    if ".." in normalized or normalized.endswith("."):
        raise ValueError("Please enter a valid email address.")

    return normalized


def validate_mobile_number(v: Optional[str], required: bool = False) -> Optional[str]:
    """
    Validate phone number length and allowed characters.
    Supports valid Indian mobile number formats and international prefixes.
    Rejects alphabetic characters and malformed numbers.
    Normalizes standard Indian mobile numbers to 10 digits.
    """
    if v is None:
        if required:
            raise ValueError("Mobile number format is invalid.")
        return None

    cleaned = v.strip()
    if not cleaned:
        if required:
            raise ValueError("Mobile number format is invalid.")
        return None

    # Check for prohibited alphabetic or dangerous characters
    if any(c.isalpha() for c in cleaned):
        raise ValueError("Mobile number format is invalid. Alphabetic characters are not permitted.")

    # Remove formatting characters (spaces, hyphens, parentheses)
    digits_and_plus = re.sub(r"[\s\-\(\)\.]", "", cleaned)

    # 1. Match Indian mobile number pattern
    indian_match = INDIAN_MOBILE_REGEX.match(digits_and_plus)
    if indian_match:
        # Normalize to standard 10-digit representation
        return indian_match.group(1)

    # 2. Match general international format
    if INTL_MOBILE_REGEX.match(digits_and_plus):
        return digits_and_plus

    raise ValueError("Mobile number format is invalid. Please provide a valid 10-digit mobile number.")


def validate_password_str(v: str) -> str:
    """Validate password rules: minimum length of 8 characters, maximum 128, non-empty."""
    if not v:
        raise ValueError("Password must contain at least 8 characters.")

    if len(v) < 8:
        raise ValueError("Password must contain at least 8 characters.")

    if len(v) > 128:
        raise ValueError("Password cannot exceed 128 characters.")

    if not v.strip():
        raise ValueError("Password cannot consist entirely of whitespace.")

    return v


def validate_dob_str(v: Optional[str | date]) -> Optional[str]:
    """Validate date of birth: cannot be in the future, must not exceed 130 years ago."""
    if v is None:
        return None

    parsed_date: Optional[date] = None
    if isinstance(v, date):
        parsed_date = v
    elif isinstance(v, str):
        cleaned = v.strip()
        if not cleaned:
            return None
        # Support YYYY-MM-DD
        try:
            parsed_date = datetime.strptime(cleaned[:10], "%Y-%m-%d").date()
        except ValueError:
            raise ValueError("Invalid date format for date of birth. Expected YYYY-MM-DD.")
    else:
        raise ValueError("Invalid date format for date of birth.")

    today = date.today()
    if parsed_date > today:
        raise ValueError("Date of birth cannot be in the future.")

    if parsed_date.year < (today.year - 130):
        raise ValueError("Date of birth cannot exceed 130 years in the past.")

    return parsed_date.isoformat()

