"""Portuguese NIF (tax id) checksum validation — local, no external call.

Only checks the format/check-digit; it does not confirm the NIF is
registered or belongs to the submitting org's business name. That
confirmation happens in manual review against the company registry (doc §2).
"""

# Leading digit for companies and equivalent legal persons ("pessoas
# coletivas"). Doc §2 only needs org identity, not individual NIFs.
_COMPANY_PREFIXES = "5689"


def nif_is_valid(nif: str) -> bool:
    if not isinstance(nif, str) or not nif.isdigit() or len(nif) != 9:
        return False
    if nif[0] not in _COMPANY_PREFIXES:
        return False
    check = sum(int(d) * w for d, w in zip(nif[:8], range(9, 1, -1))) % 11
    expected = 0 if check in (0, 1) else 11 - check
    return int(nif[8]) == expected
