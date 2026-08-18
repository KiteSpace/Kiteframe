#!/usr/bin/env python3
"""
fetch_workflow.py — Resume an existing Kiteframe external workflow entity.

Usage:
    python skill/fetch_workflow.py --id <entity-id>
    python skill/fetch_workflow.py --url https://kiteframe.space/workflows/<id>

Prints the full entity JSON (id, entity_type, data { title, nodes, edges },
url, expires_at) to stdout on success. Exits non-zero on any error.

Requires: KITEFRAME_API_KEY environment variable (or pass --key <value>).
"""

import argparse
import json
import os
import re
import sys
import urllib.request
import urllib.error

API_BASE = "https://kiteframe.space/api/external/workflows"


def extract_id_from_url(url: str) -> str:
    """Extract the entity UUID from a /workflows/<id> URL."""
    match = re.search(r"/workflows/([0-9a-f-]{36})", url)
    if not match:
        print(f"ERROR: Could not extract entity ID from URL: {url}", file=sys.stderr)
        sys.exit(1)
    return match.group(1)


def fetch_entity(entity_id: str, api_key: str) -> dict:
    url = f"{API_BASE}/{entity_id}"
    req = urllib.request.Request(
        url,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Accept": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        if e.code == 401:
            print(
                "ERROR: Authentication failed (401). Check that KITEFRAME_API_KEY is set and valid.",
                file=sys.stderr,
            )
        elif e.code == 403:
            print(
                f"ERROR: Access denied (403). The API key does not own entity '{entity_id}'.\n"
                "You may need to create a new workflow with POST /api/external/workflows instead.",
                file=sys.stderr,
            )
        elif e.code == 404:
            print(
                f"ERROR: Entity '{entity_id}' not found (404). It may have expired (external "
                "entities are deleted after 24 hours) or the ID may be incorrect.",
                file=sys.stderr,
            )
        else:
            print(f"ERROR: HTTP {e.code} from API. Response: {body}", file=sys.stderr)
        sys.exit(1)
    except urllib.error.URLError as e:
        print(f"ERROR: Network error contacting Kiteframe API: {e.reason}", file=sys.stderr)
        sys.exit(1)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Fetch a Kiteframe external workflow entity by ID or URL."
    )
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--id", dest="entity_id", help="Entity UUID")
    group.add_argument("--url", dest="entity_url", help="Public diagram URL")
    parser.add_argument(
        "--key",
        dest="api_key",
        default=os.environ.get("KITEFRAME_API_KEY", ""),
        help="API key (defaults to $KITEFRAME_API_KEY)",
    )
    args = parser.parse_args()

    if not args.api_key:
        print(
            "ERROR: No API key provided. Set KITEFRAME_API_KEY or pass --key <value>.",
            file=sys.stderr,
        )
        sys.exit(1)

    entity_id = (
        args.entity_id
        if args.entity_id
        else extract_id_from_url(args.entity_url)
    )

    data = fetch_entity(entity_id, args.api_key)
    print(json.dumps(data, indent=2, default=str))


if __name__ == "__main__":
    main()
