#!/usr/bin/env python3
"""
Validates a draft craft.js design tree against the same rules Kiteframe's
server enforces in designSchema.ts, before it gets submitted. Purely local --
no network call. Catches structural mistakes early so a bad draft never
reaches the server (where it would 422 anyway), and gives a clearer error
message in the meantime.

Mirrors server-side validateCraftState():
  1. ROOT node must exist, and ROOT's resolvedName must be AstryxSection
  2. Every node's resolvedName must be in the allowed component enum
  3. Every "parent" reference must point to a real node in the map
  4. Every child in "nodes" must point to a real node in the map
  5. No cycles in the nodes graph
  6. At least one AstryxArtboard must exist directly under ROOT (the
     mandatory "screen" layer) -- this is a Kiteframe convention, not
     enforced by the generic node-shape rules alone, but required by the
     design system prompt's structural rule.
  7. AstryxCard nodes should have no children (treated as a leaf in
     skill-generated JSON, per Kiteframe's convention) -- this is a
     warning, not a hard failure, since the server itself doesn't reject it.

Usage:
  python3 validate_design.py --schema '<output_schema JSON string>' --craft-state '<tree JSON string>'
  # or, from files:
  python3 validate_design.py --schema-file schema.json --craft-state-file draft.json
"""

import argparse
import json
import sys

CONTAINER_TYPES = {"AstryxArtboard", "AstryxSection", "AstryxStack", "AstryxHStack"}


def _load(value, value_file):
    if value_file:
        with open(value_file) as f:
            return json.load(f)
    return json.loads(value)


def extract_allowed_components(schema: dict):
    """Pulls the allowed resolvedName enum out of the output_schema, however
    it's nested. Falls back to None (skip enum check) if not found, rather
    than failing validation on a schema-shape assumption that might be wrong."""
    try:
        return set(schema["properties"]["nodes"]["additionalProperties"]["properties"]["type"]["properties"]["resolvedName"]["enum"])
    except (KeyError, TypeError):
        return None


def validate_design(tree: dict, allowed_components):
    errors = []
    warnings = []

    if "ROOT" not in tree:
        errors.append("Missing ROOT node")
        return errors, warnings  # nothing else is meaningful without ROOT

    root = tree["ROOT"]
    root_type = root.get("type", {}).get("resolvedName")
    if root_type != "AstryxSection":
        errors.append(f"ROOT node must be AstryxSection, got '{root_type}'")

    node_ids = set(tree.keys())

    for node_id, node in tree.items():
        resolved_name = node.get("type", {}).get("resolvedName")
        if allowed_components is not None and resolved_name not in allowed_components:
            errors.append(f"Node '{node_id}': resolvedName '{resolved_name}' is not an allowed component")

        parent = node.get("parent")
        if node_id != "ROOT" and parent not in node_ids:
            errors.append(f"Node '{node_id}': parent '{parent}' does not reference an existing node")

        for child_id in node.get("nodes", []):
            if child_id not in node_ids:
                errors.append(f"Node '{node_id}': child '{child_id}' does not reference an existing node")

        if resolved_name == "AstryxCard" and node.get("nodes"):
            warnings.append(f"Node '{node_id}': AstryxCard has children -- treat as a leaf in generated JSON")

    # Cycle detection (simple DFS from ROOT)
    visited = set()
    def visit(node_id, stack):
        if node_id in stack:
            errors.append(f"Cycle detected involving node '{node_id}'")
            return
        if node_id in visited or node_id not in tree:
            return
        visited.add(node_id)
        for child_id in tree[node_id].get("nodes", []):
            visit(child_id, stack | {node_id})
    visit("ROOT", set())

    # Mandatory artboard-as-screen layer
    root_children = tree.get("ROOT", {}).get("nodes", [])
    has_artboard = any(
        tree.get(child_id, {}).get("type", {}).get("resolvedName") == "AstryxArtboard"
        for child_id in root_children
    )
    if not has_artboard:
        errors.append("No AstryxArtboard found directly under ROOT -- every design needs at least one screen/artboard")

    return errors, warnings


def main():
    parser = argparse.ArgumentParser(description="Validate a draft craft.js design tree before submission.")
    parser.add_argument("--schema", help="output_schema as a JSON string (from fetch_design_template.py)")
    parser.add_argument("--schema-file", help="Path to schema JSON file")
    parser.add_argument("--craft-state", help="Draft craft.js tree as a JSON string")
    parser.add_argument("--craft-state-file", help="Path to draft tree JSON file")
    args = parser.parse_args()

    if not (args.schema or args.schema_file):
        print("ERROR: provide --schema or --schema-file", file=sys.stderr)
        sys.exit(1)
    if not (args.craft_state or args.craft_state_file):
        print("ERROR: provide --craft-state or --craft-state-file", file=sys.stderr)
        sys.exit(1)

    schema = _load(args.schema, args.schema_file)
    tree = _load(args.craft_state, args.craft_state_file)

    allowed_components = extract_allowed_components(schema)
    if allowed_components is None:
        print("WARNING: could not locate component enum in schema -- skipping enum check", file=sys.stderr)

    errors, warnings = validate_design(tree, allowed_components)

    for w in warnings:
        print(f"WARNING: {w}", file=sys.stderr)

    if errors:
        print("VALIDATION FAILED:", file=sys.stderr)
        for e in errors:
            print(f"  - {e}", file=sys.stderr)
        sys.exit(1)
    else:
        print("OK: design tree is valid.")


if __name__ == "__main__":
    main()
