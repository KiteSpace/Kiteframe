#!/usr/bin/env python3
"""
Validates a draft workflow JSON against the output_schema returned by
fetch_template.py, before it gets sent to Kiteframe. Purely local — no
network call, no AI call. Catches shape mistakes early so a bad draft
never reaches Kiteframe's storage.

Uses the `jsonschema` package if it's installed (pip install jsonschema),
otherwise falls back to a minimal built-in checker that covers the common
cases: required fields, type checks, enum checks, and array item shape.

Usage:
  python3 validate_workflow.py --schema '<schema JSON string>' --workflow '<workflow JSON string>'
  # or, from files:
  python3 validate_workflow.py --schema-file schema.json --workflow-file draft.json
"""

import argparse
import json
import sys


def _load(value, value_file):
    if value_file:
        with open(value_file) as f:
            return json.load(f)
    return json.loads(value)


def validate_with_jsonschema(instance, schema):
    import jsonschema  # type: ignore
    validator = jsonschema.Draft7Validator(schema)
    errors = sorted(validator.iter_errors(instance), key=lambda e: e.path)
    return [f"{'/'.join(str(p) for p in e.path) or '(root)'}: {e.message}" for e in errors]


def validate_minimal(instance, schema, path="(root)"):
    """A small, dependency-free subset validator: type, required, properties,
    items, enum. Not a full JSON Schema implementation, but catches the
    mistakes most likely to show up in an LLM-drafted workflow."""
    errors = []

    expected_type = schema.get("type")
    type_map = {
        "object": dict,
        "array": list,
        "string": str,
        "number": (int, float),
        "integer": int,
        "boolean": bool,
    }
    if expected_type and expected_type in type_map:
        if not isinstance(instance, type_map[expected_type]):
            errors.append(f"{path}: expected type '{expected_type}', got {type(instance).__name__}")
            return errors  # further checks won't be meaningful

    if "enum" in schema and instance not in schema["enum"]:
        errors.append(f"{path}: value '{instance}' not in allowed enum {schema['enum']}")

    if expected_type == "object" and isinstance(instance, dict):
        for req in schema.get("required", []):
            if req not in instance:
                errors.append(f"{path}: missing required field '{req}'")
        for key, subschema in schema.get("properties", {}).items():
            if key in instance:
                errors.extend(validate_minimal(instance[key], subschema, f"{path}/{key}"))

    if expected_type == "array" and isinstance(instance, list):
        item_schema = schema.get("items")
        if item_schema:
            for i, item in enumerate(instance):
                errors.extend(validate_minimal(item, item_schema, f"{path}[{i}]"))

    return errors


def main():
    parser = argparse.ArgumentParser(description="Validate a draft workflow against Kiteframe's output_schema.")
    parser.add_argument("--schema", help="Schema as a JSON string")
    parser.add_argument("--schema-file", help="Path to schema JSON file")
    parser.add_argument("--workflow", help="Draft workflow as a JSON string")
    parser.add_argument("--workflow-file", help="Path to draft workflow JSON file")
    args = parser.parse_args()

    if not (args.schema or args.schema_file):
        print("ERROR: provide --schema or --schema-file", file=sys.stderr)
        sys.exit(1)
    if not (args.workflow or args.workflow_file):
        print("ERROR: provide --workflow or --workflow-file", file=sys.stderr)
        sys.exit(1)

    schema = _load(args.schema, args.schema_file)
    workflow = _load(args.workflow, args.workflow_file)

    try:
        errors = validate_with_jsonschema(workflow, schema)
        engine = "jsonschema"
    except ImportError:
        errors = validate_minimal(workflow, schema)
        engine = "minimal built-in validator (install `jsonschema` for full coverage)"

    if errors:
        print(f"VALIDATION FAILED ({engine}):", file=sys.stderr)
        for e in errors:
            print(f"  - {e}", file=sys.stderr)
        sys.exit(1)
    else:
        print(f"OK: workflow is valid against schema ({engine}).")


if __name__ == "__main__":
    main()
