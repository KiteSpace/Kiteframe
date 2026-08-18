#!/usr/bin/env python3
"""
Submits a confirmed, locally-validated workflow JSON to Kiteframe for
storage and rendering. Plain POST — Kiteframe does not run any model
inference here, it just validates shape server-side (again, as a safety
net) and persists it.

Env vars required:
  KITEFRAME_API_BASE   e.g. https://api.kiteframe.space
  EXTERNAL_API_KEY     scoped API key for the external endpoints

Usage:
  python3 submit_workflow.py --workflow '<workflow JSON string>'
  # or
  python3 submit_workflow.py --workflow-file draft.json
"""

import argparse
import json
import os
import sys
import urllib.request
import urllib.error


def submit_workflow(workflow: dict) -> dict:
    base = os.environ.get("KITEFRAME_API_BASE")
    key = os.environ.get("EXTERNAL_API_KEY")

    if not base or not key:
        print(
            "ERROR: KITEFRAME_API_BASE and/or EXTERNAL_API_KEY are not set.\n"
            "Set them in your shell environment before running this script.",
            file=sys.stderr,
        )
        sys.exit(1)

    # Server expects: { "data": <workflow object> }
    url = f"{base.rstrip('/')}/api/external/workflows"

    payload = json.dumps({"data": workflow}).encode("utf-8")
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
    parser = argparse.ArgumentParser(description="Submit a confirmed workflow to Kiteframe for storage/rendering.")
    parser.add_argument("--workflow", help="Workflow as a JSON string")
    parser.add_argument("--workflow-file", help="Path to workflow JSON file")
    args = parser.parse_args()

    if args.workflow_file:
        with open(args.workflow_file) as f:
            workflow = json.load(f)
    elif args.workflow:
        workflow = json.loads(args.workflow)
    else:
        print("ERROR: provide --workflow or --workflow-file", file=sys.stderr)
        sys.exit(1)

    result = submit_workflow(workflow)
    print(json.dumps(result, indent=2))
    base = os.environ.get("KITEFRAME_API_BASE", "").rstrip("/")
    if base and result.get("url"):
        print(f"\nView it at: {result['url']}")


if __name__ == "__main__":
    main()
