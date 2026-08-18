#!/usr/bin/env python3
"""
Fetches the current workflow-reasoning template from Kiteframe. This is a
plain GET — Kiteframe does not run any model inference to serve this; it's
just returning the tuned system prompt + schema + examples that Claude
(running in the user's own session) should use to reason about the workflow.

Env vars required:
  KITEFRAME_API_BASE   e.g. https://api.kiteframe.space
  EXTERNAL_API_KEY     scoped API key for the external endpoints

Usage:
  python3 fetch_template.py
"""

import json
import os
import sys
import urllib.request
import urllib.error


def fetch_template() -> dict:
    base = os.environ.get("KITEFRAME_API_BASE")
    key = os.environ.get("EXTERNAL_API_KEY")

    if not base or not key:
        print(
            "ERROR: KITEFRAME_API_BASE and/or EXTERNAL_API_KEY are not set.\n"
            "Set them in your shell environment before running this script.",
            file=sys.stderr,
        )
        sys.exit(1)

    # NOTE: placeholder path until the real route ships.
    # Expected response shape:
    # {
    #   "system_prompt": "...",
    #   "output_schema": { ... JSON-schema-like dict ... },
    #   "few_shot_examples": [ { "description": "...", "workflow": {...} }, ... ]
    # }
    url = f"{base.rstrip('/')}/api/external/workflows/prompt-template"

    req = urllib.request.Request(
        url,
        method="GET",
        headers={"Authorization": f"Bearer {key}"},
    )

    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        print(f"ERROR: Kiteframe API returned {e.code}: {e.read().decode('utf-8', 'ignore')}", file=sys.stderr)
        sys.exit(1)
    except urllib.error.URLError as e:
        print(f"ERROR: could not reach Kiteframe API at {url}: {e.reason}", file=sys.stderr)
        sys.exit(1)


def main():
    result = fetch_template()
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
