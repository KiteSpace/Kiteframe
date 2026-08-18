#!/usr/bin/env python3
"""
Fetches the current UI-design reasoning template from Kiteframe. Plain GET —
no model inference happens on Kiteframe's side to serve this; it returns the
tuned system prompt + craft.js output schema + few-shot examples that Claude
(running in the user's own session) should use to reason about the design.

Env vars required:
  KITEFRAME_API_BASE   e.g. https://kiteframe.space
  EXTERNAL_API_KEY     scoped API key for the external endpoints

Usage:
  python3 fetch_design_template.py
"""

import json
import os
import sys
import urllib.request
import urllib.error


def fetch_design_template() -> dict:
    base = os.environ.get("KITEFRAME_API_BASE")
    key = os.environ.get("EXTERNAL_API_KEY")

    if not base or not key:
        print(
            "ERROR: KITEFRAME_API_BASE and/or EXTERNAL_API_KEY are not set.\n"
            "Set them in your shell environment before running this script.",
            file=sys.stderr,
        )
        sys.exit(1)

    # Expected response shape:
    # {
    #   "version": "1.0.0",
    #   "system_prompt": "...",
    #   "output_schema": { ... craft.js tree schema, incl. SERVER_ALLOWED_CRAFT_COMPONENTS enum ... },
    #   "few_shot_examples": [ { "description": "...", "craft_state": {...} }, ... ]
    # }
    url = f"{base.rstrip('/')}/api/external/designs/prompt-template"

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
    result = fetch_design_template()
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
