from __future__ import annotations

import argparse
import csv
import json
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SCHEMA_PATH = PROJECT_ROOT / "schemas" / "output_contracts.json"
MAX_ERRORS_PER_CHECK = 8


@dataclass
class CheckResult:
    name: str
    ok: bool
    detail: str


def project_path(relative_path: str) -> Path:
    return PROJECT_ROOT / relative_path


def add_error(errors: list[str], message: str) -> None:
    if len(errors) < MAX_ERRORS_PER_CHECK:
        errors.append(message)


def load_schema(path: Path) -> dict[str, Any]:
    if not path.exists():
        raise FileNotFoundError(f"Schema file not found: {path}")
    return json.loads(path.read_text(encoding="utf-8"))


def read_csv_header(path: Path) -> list[str]:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.reader(handle)
        try:
            return next(reader)
        except StopIteration as exc:
            raise ValueError(f"CSV is empty: {path}") from exc


def parse_number(value: str, path: Path, row_number: int, column: str, errors: list[str]) -> float | None:
    if value is None or value == "":
        add_error(errors, f"{path}: row {row_number} column '{column}' is empty")
        return None
    try:
        return float(value)
    except ValueError:
        add_error(errors, f"{path}: row {row_number} column '{column}' is not numeric: {value!r}")
        return None


def validate_csv_output(contract: dict[str, Any]) -> CheckResult:
    path = project_path(contract["path"])
    errors: list[str] = []

    if not path.exists():
        return CheckResult(contract["path"], False, "missing file")

    header = read_csv_header(path)
    header_set = set(header)
    required_columns = set(contract.get("required_columns", []))
    missing_columns = sorted(required_columns - header_set)
    if missing_columns:
        add_error(errors, f"missing columns: {', '.join(missing_columns)}")

    min_columns = contract.get("min_columns")
    if min_columns is not None and len(header) < min_columns:
        add_error(errors, f"expected at least {min_columns} columns, found {len(header)}")

    unique_values: dict[str, set[str]] = {column: set() for column in contract.get("unique_columns", [])}
    duplicates: dict[str, int] = {column: 0 for column in unique_values}
    constant_values = contract.get("constant_values", {})
    allowed_values = contract.get("allowed_values", {})
    numeric_ranges = contract.get("numeric_ranges", {})
    required_non_empty_columns = contract.get("required_non_empty_columns", [])
    ordered_numeric_columns = contract.get("ordered_numeric_columns", [])

    row_count = 0
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        for row_count, row in enumerate(reader, start=1):
            for column in required_non_empty_columns:
                if row.get(column, "") == "":
                    add_error(errors, f"{path}: row {row_count} column '{column}' is empty")

            for column, valid_values in constant_values.items():
                value = row.get(column, "")
                if value not in valid_values:
                    add_error(errors, f"{path}: row {row_count} column '{column}' expected one of {valid_values}, got {value!r}")

            for column, valid_values in allowed_values.items():
                value = row.get(column, "")
                if value not in valid_values:
                    add_error(errors, f"{path}: row {row_count} column '{column}' expected one of {valid_values}, got {value!r}")

            for column, bounds in numeric_ranges.items():
                value = parse_number(row.get(column, ""), path, row_count, column, errors)
                if value is None:
                    continue
                if "min" in bounds and value < bounds["min"]:
                    add_error(errors, f"{path}: row {row_count} column '{column}' below min {bounds['min']}: {value}")
                if "max" in bounds and value > bounds["max"]:
                    add_error(errors, f"{path}: row {row_count} column '{column}' above max {bounds['max']}: {value}")

            for columns in ordered_numeric_columns:
                values: list[float] = []
                for column in columns:
                    value = parse_number(row.get(column, ""), path, row_count, column, errors)
                    if value is None:
                        values = []
                        break
                    values.append(value)
                if values and values != sorted(values):
                    add_error(errors, f"{path}: row {row_count} expected {' <= '.join(columns)}, got {values}")

            for column, seen_values in unique_values.items():
                value = row.get(column, "")
                if value in seen_values:
                    duplicates[column] += 1
                    add_error(errors, f"{path}: duplicate {column} value {value!r}")
                seen_values.add(value)

    exact_rows = contract.get("exact_rows")
    if exact_rows is not None and row_count != exact_rows:
        add_error(errors, f"expected {exact_rows} data rows, found {row_count}")

    min_rows = contract.get("min_rows")
    if min_rows is not None and row_count < min_rows:
        add_error(errors, f"expected at least {min_rows} data rows, found {row_count}")

    for column, duplicate_count in duplicates.items():
        if duplicate_count:
            add_error(errors, f"column '{column}' has {duplicate_count} duplicate values")

    ok = not errors
    detail = f"{row_count} rows, {len(header)} columns"
    if errors:
        detail = "; ".join(errors)
    return CheckResult(contract["path"], ok, detail)


def get_nested_value(payload: Any, dotted_path: str) -> Any:
    current = payload
    for part in dotted_path.split("."):
        if isinstance(current, dict) and part in current:
            current = current[part]
        else:
            raise KeyError(dotted_path)
    return current


def validate_json_output(contract: dict[str, Any]) -> CheckResult:
    path = project_path(contract["path"])
    errors: list[str] = []

    if not path.exists():
        return CheckResult(contract["path"], False, "missing file")

    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        return CheckResult(contract["path"], False, f"invalid JSON: {exc}")

    for key in contract.get("required_keys", []):
        if key not in payload:
            add_error(errors, f"missing top-level key '{key}'")

    for check in contract.get("value_checks", []):
        try:
            value = get_nested_value(payload, check["path"])
        except KeyError:
            add_error(errors, f"missing nested path '{check['path']}'")
            continue
        if value != check["equals"]:
            add_error(errors, f"path '{check['path']}' expected {check['equals']!r}, got {value!r}")

    for key, expected_values in contract.get("contains_all", {}).items():
        values = payload.get(key, [])
        missing_values = sorted(set(expected_values) - set(values))
        if missing_values:
            add_error(errors, f"path '{key}' missing values: {', '.join(missing_values)}")

    for check in contract.get("list_checks", []):
        try:
            values = get_nested_value(payload, check["path"])
        except KeyError:
            add_error(errors, f"missing list path '{check['path']}'")
            continue

        if not isinstance(values, list):
            add_error(errors, f"path '{check['path']}' is not a list")
            continue

        if "exact_length" in check and len(values) != check["exact_length"]:
            add_error(errors, f"path '{check['path']}' expected length {check['exact_length']}, got {len(values)}")

        unique_key = check.get("unique_key")
        if unique_key:
            seen: set[Any] = set()
            for item in values:
                if not isinstance(item, dict):
                    add_error(errors, f"path '{check['path']}' contains a non-object item")
                    continue
                value = item.get(unique_key)
                if value in seen:
                    add_error(errors, f"path '{check['path']}' duplicate {unique_key}: {value!r}")
                seen.add(value)

        required_keys = check.get("required_keys", [])
        for index, item in enumerate(values):
            if not isinstance(item, dict):
                continue
            missing = sorted(set(required_keys) - item.keys())
            if missing:
                add_error(errors, f"path '{check['path']}[{index}]' missing keys: {', '.join(missing)}")

    ok = not errors
    detail = "JSON contract satisfied"
    if errors:
        detail = "; ".join(errors)
    return CheckResult(contract["path"], ok, detail)


def validate_package_lock(contract: dict[str, Any], path: Path) -> list[str]:
    errors: list[str] = []
    package_json_path = project_path(contract["package_json"])

    try:
        lock_payload = json.loads(path.read_text(encoding="utf-8"))
        package_payload = json.loads(package_json_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        return [f"invalid package JSON: {exc}"]

    if lock_payload.get("lockfileVersion", 0) < 2:
        add_error(errors, "package-lock.json must use lockfileVersion >= 2")

    root_package = lock_payload.get("packages", {}).get("", {})
    lock_dependencies = root_package.get("dependencies", {})
    package_dependencies = package_payload.get("dependencies", {})
    if lock_dependencies != package_dependencies:
        add_error(errors, "package-lock root dependencies do not match package.json dependencies")

    return errors


def validate_artifact(contract: dict[str, Any]) -> CheckResult:
    path = project_path(contract["path"])
    errors: list[str] = []

    if not path.exists():
        return CheckResult(contract["path"], False, "missing file")

    min_bytes = contract.get("min_bytes")
    size = path.stat().st_size
    if min_bytes is not None and size < min_bytes:
        add_error(errors, f"expected at least {min_bytes} bytes, found {size}")

    kind = contract.get("kind", "text")
    if kind == "json":
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:
            add_error(errors, f"invalid JSON: {exc}")
        else:
            for key in contract.get("required_keys", []):
                if key not in payload:
                    add_error(errors, f"missing top-level key '{key}'")
    elif kind == "text":
        text = path.read_text(encoding="utf-8", errors="replace")
        lower_text = text.lower()
        for expected in contract.get("required_text", []):
            if expected.lower() not in lower_text:
                add_error(errors, f"missing expected text {expected!r}")
    elif kind == "package_lock":
        errors.extend(validate_package_lock(contract, path))
    elif kind == "binary":
        pass
    else:
        add_error(errors, f"unknown artifact kind: {kind}")

    ok = not errors
    detail = f"{size} bytes"
    if errors:
        detail = "; ".join(errors)
    return CheckResult(contract["path"], ok, detail)


def run_checks(schema: dict[str, Any]) -> list[CheckResult]:
    results: list[CheckResult] = []

    for contract in schema.get("csv_outputs", []):
        results.append(validate_csv_output(contract))

    for contract in schema.get("json_outputs", []):
        results.append(validate_json_output(contract))

    for contract in schema.get("model_artifacts", []):
        results.append(validate_artifact(contract))

    for contract in schema.get("dependency_files", []):
        results.append(validate_artifact(contract))

    return results


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Validate ARIA committed data/model output contracts.")
    parser.add_argument("--schema", type=Path, default=DEFAULT_SCHEMA_PATH)
    parser.add_argument("--json", action="store_true", help="Print machine-readable JSON results")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv or sys.argv[1:])
    schema = load_schema(args.schema)
    results = run_checks(schema)
    failures = [result for result in results if not result.ok]

    if args.json:
        print(json.dumps([result.__dict__ for result in results], indent=2))
    else:
        for result in results:
            status = "PASS" if result.ok else "FAIL"
            print(f"[{status}] {result.name} - {result.detail}")

        print()
        print(f"Validated {len(results)} contracts: {len(results) - len(failures)} passed, {len(failures)} failed.")

    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
