"""Keyset pagination cursor, shared by the feed and comment listing. Encodes
(timestamp, id) so ties don't reorder between requests and pages don't
skip/repeat items as new rows land — an offset-based `page=N` would."""

import base64
import binascii

from django.utils.dateparse import parse_datetime

_CURSOR_VERSION = "v1"


def encode_cursor(timestamp, item_id):
    payload = f"{_CURSOR_VERSION}|{timestamp.isoformat()}|{item_id}"
    return base64.urlsafe_b64encode(payload.encode()).decode()


def decode_cursor(raw):
    try:
        decoded = base64.urlsafe_b64decode(raw.encode()).decode()
        version, timestamp_raw, item_id = decoded.split("|", 2)
    except (ValueError, UnicodeDecodeError, binascii.Error):
        return None
    if version != _CURSOR_VERSION:
        return None
    timestamp = parse_datetime(timestamp_raw)
    if timestamp is None:
        return None
    return timestamp, item_id
