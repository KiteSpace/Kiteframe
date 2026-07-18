#!/usr/bin/env python3
"""
Submits a confirmed, locally-validated craft.js design tree to Kiteframe for
storage and rendering. Plain POST -- creates an unclaimed design (no
Anthropic API involvement; Kiteframe does not run inference on this route).

Env vars required:
  KITEFRAME_API_BASE   e.g. https://kiteframe.space
  EXTERNAL_API_KEY     scoped API key for the external endpoints

Usage:
  python3 submit_design.py --craft-state '<tree JSON string>'
  # or
  python3 submit_design.py --craft-state-file draft.json
"""

import argparse
import json
import os
import sys
import urllib.request
import urllib.error


def submit_design(craft_state: dict) -> dict:
    base = os.environ.get("KITEFRAME_API_BASE")
    key = os.environ.get("EXTERNAL_API_KEY")

    if not base or not key:
        print(
            "ERROR: KITEFRAME_API_BASE and/or EXTERNAL_API_KEY are not set.\n"
            "Set them in your shell environment before running this script.",
            file=sys.stderr,
        )
        sys.exit(1)

    # Server expects: { "data": <craft.js state object> }
    # Expected response shape: { "id": "...", "url": "/designs/..." }
    url = f"{base.rstrip('/')}/api/external/designs"

    payload = json.dumps({"data": craft_state}).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=payload,
        method="POST",
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {key}",
        },
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
    parser = argparse.ArgumentParser(description="Submit a confirmed design tree to Kiteframe for storage/rendering.")
    parser.add_argument("--craft-state", help="Design tree as a JSON string")
    parser.add_argument("--craft-state-file", help="Path to design tree JSON file")
    args = parser.parse_args()

    if args.craft_state_file:
        with open(args.craft_state_file) as f:
            craft_state = json.load(f)
    elif args.craft_state:
        craft_state = json.loads(args.craft_state)
    else:
        print("ERROR: provide --craft-state or --craft-state-file", file=sys.stderr)
        sys.exit(1)

    result = submit_design(craft_state)
    print(json.dumps(result, indent=2))
    if result.get("url"):
        print(f"\nView it at: {result['url']}")


if __name__ == "__main__":
    main()
