#!/usr/bin/env python3
"""Static checks for PostgreSQL seed SQL files.

This catches common init-script failures without starting Postgres:
- unterminated SQL strings or dollar-quoted blocks
- INSERT column/value count mismatches
- INSERTs into tables not present in the schema file
- literal UUID foreign-key references to rows inserted by earlier/current seed files

It is intentionally conservative. It does not validate foreign keys, CHECK
constraints, generated values, or PostgreSQL type casts beyond literal UUID
foreign-key references whose target rows are present in the checked SQL files.
"""

from __future__ import annotations

import argparse
import re
import sys
from dataclasses import dataclass
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_SCHEMA = REPO_ROOT / "backend" / "database" / "init_pg_ddl.sql"
DEFAULT_SEED = REPO_ROOT / "backend" / "database" / "init_syl_data.sql"
DEFAULT_PREVIOUS = [REPO_ROOT / "backend" / "database" / "init_pg_data.sql"]
UUID_RE = re.compile(
    r"^'([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-"
    r"[0-9a-fA-F]{4}-[0-9a-fA-F]{12})'(?:\s*::\s*uuid)?$"
)


@dataclass(frozen=True)
class Statement:
    line: int
    text: str


@dataclass(frozen=True)
class TableSchema:
    line: int
    columns: list[str]
    column_types: dict[str, str]
    primary_keys: list[str]
    foreign_keys: dict[str, str]


@dataclass(frozen=True)
class Issue:
    level: str
    line: int
    message: str


def split_sql(sql: str) -> tuple[list[Statement], list[Issue]]:
    statements: list[Statement] = []
    issues: list[Issue] = []
    start = 0
    line = 1
    statement_line = 1
    in_single = False
    in_double = False
    dollar_tag: str | None = None
    block_comment_depth = 0

    i = 0
    while i < len(sql):
        ch = sql[i]
        nxt = sql[i + 1] if i + 1 < len(sql) else ""

        if ch == "\n":
            line += 1

        if block_comment_depth:
            if ch == "/" and nxt == "*":
                block_comment_depth += 1
                i += 2
                continue
            if ch == "*" and nxt == "/":
                block_comment_depth -= 1
                i += 2
                continue
            i += 1
            continue

        if dollar_tag:
            if sql.startswith(dollar_tag, i):
                i += len(dollar_tag)
                dollar_tag = None
                continue
            i += 1
            continue

        if in_single:
            if ch == "'" and nxt == "'":
                i += 2
                continue
            if ch == "'":
                in_single = False
            i += 1
            continue

        if in_double:
            if ch == '"' and nxt == '"':
                i += 2
                continue
            if ch == '"':
                in_double = False
            i += 1
            continue

        if ch == "-" and nxt == "-":
            while i < len(sql) and sql[i] != "\n":
                i += 1
            continue

        if ch == "/" and nxt == "*":
            block_comment_depth = 1
            i += 2
            continue

        if ch == "'":
            in_single = True
            i += 1
            continue

        if ch == '"':
            in_double = True
            i += 1
            continue

        if ch == "$":
            match = re.match(r"\$[A-Za-z_][A-Za-z0-9_]*\$|\$\$", sql[i:])
            if match:
                dollar_tag = match.group(0)
                i += len(dollar_tag)
                continue

        if ch == ";":
            text = sql[start : i + 1].strip()
            if text:
                statements.append(Statement(statement_line, text))
            start = i + 1
            statement_line = line

        i += 1

    tail = sql[start:].strip()
    if tail:
        statements.append(Statement(statement_line, tail))

    if in_single:
        issues.append(Issue("error", line, "Unterminated single-quoted string"))
    if in_double:
        issues.append(Issue("error", line, "Unterminated double-quoted identifier"))
    if dollar_tag:
        issues.append(Issue("error", line, f"Unterminated dollar-quoted block {dollar_tag}"))
    if block_comment_depth:
        issues.append(Issue("error", line, "Unterminated block comment"))

    return statements, issues


def split_top_level(text: str, sep: str = ",") -> list[str]:
    parts: list[str] = []
    start = 0
    parens = 0
    brackets = 0
    braces = 0
    in_single = False
    in_double = False
    dollar_tag: str | None = None

    i = 0
    while i < len(text):
        ch = text[i]
        nxt = text[i + 1] if i + 1 < len(text) else ""

        if dollar_tag:
            if text.startswith(dollar_tag, i):
                i += len(dollar_tag)
                dollar_tag = None
                continue
            i += 1
            continue

        if in_single:
            if ch == "'" and nxt == "'":
                i += 2
                continue
            if ch == "'":
                in_single = False
            i += 1
            continue

        if in_double:
            if ch == '"' and nxt == '"':
                i += 2
                continue
            if ch == '"':
                in_double = False
            i += 1
            continue

        if ch == "'":
            in_single = True
        elif ch == '"':
            in_double = True
        elif ch == "$":
            match = re.match(r"\$[A-Za-z_][A-Za-z0-9_]*\$|\$\$", text[i:])
            if match:
                dollar_tag = match.group(0)
                i += len(dollar_tag)
                continue
        elif ch == "(":
            parens += 1
        elif ch == ")":
            parens -= 1
        elif ch == "[":
            brackets += 1
        elif ch == "]":
            brackets -= 1
        elif ch == "{":
            braces += 1
        elif ch == "}":
            braces -= 1
        elif ch == sep and parens == 0 and brackets == 0 and braces == 0:
            parts.append(text[start:i].strip())
            start = i + 1

        i += 1

    parts.append(text[start:].strip())
    return parts


def find_matching_paren(text: str, open_index: int) -> int:
    depth = 0
    in_single = False
    in_double = False
    dollar_tag: str | None = None

    i = open_index
    while i < len(text):
        ch = text[i]
        nxt = text[i + 1] if i + 1 < len(text) else ""

        if dollar_tag:
            if text.startswith(dollar_tag, i):
                i += len(dollar_tag)
                dollar_tag = None
                continue
            i += 1
            continue

        if in_single:
            if ch == "'" and nxt == "'":
                i += 2
                continue
            if ch == "'":
                in_single = False
            i += 1
            continue

        if in_double:
            if ch == '"' and nxt == '"':
                i += 2
                continue
            if ch == '"':
                in_double = False
            i += 1
            continue

        if ch == "'":
            in_single = True
        elif ch == '"':
            in_double = True
        elif ch == "$":
            match = re.match(r"\$[A-Za-z_][A-Za-z0-9_]*\$|\$\$", text[i:])
            if match:
                dollar_tag = match.group(0)
                i += len(dollar_tag)
                continue
        elif ch == "(":
            depth += 1
        elif ch == ")":
            depth -= 1
            if depth == 0:
                return i

        i += 1

    return -1


def clean_identifier(identifier: str) -> str:
    identifier = identifier.strip()
    if "." in identifier:
        identifier = identifier.rsplit(".", 1)[1]
    return identifier.strip('"').lower()


def strip_leading_comments(statement: str) -> str:
    text = statement.lstrip()
    while True:
        if text.startswith("--"):
            newline = text.find("\n")
            if newline == -1:
                return ""
            text = text[newline + 1 :].lstrip()
            continue
        if text.startswith("/*"):
            end = text.find("*/")
            if end == -1:
                return text
            text = text[end + 2 :].lstrip()
            continue
        return text


def extract_create_tables(statements: list[Statement]) -> dict[str, TableSchema]:
    schemas: dict[str, TableSchema] = {}
    for statement in statements:
        statement_text = strip_leading_comments(statement.text)
        match = re.match(
            r"CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([A-Za-z_][\w.]*|\"[^\"]+\")\s*\(",
            statement_text,
            flags=re.IGNORECASE | re.DOTALL,
        )
        if not match:
            continue

        table = clean_identifier(match.group(1))
        open_index = statement_text.find("(", match.end() - 1)
        close_index = find_matching_paren(statement_text, open_index)
        if close_index == -1:
            continue

        body = statement_text[open_index + 1 : close_index]
        columns: list[str] = []
        column_types: dict[str, str] = {}
        primary_keys: list[str] = []
        foreign_keys: dict[str, str] = {}
        for definition in split_top_level(body):
            stripped = definition.strip()
            first_word = stripped.split(maxsplit=1)[0].upper() if stripped else ""
            table_pk_match = re.match(r"PRIMARY\s+KEY\s*\((.*?)\)", stripped, flags=re.IGNORECASE | re.DOTALL)
            if table_pk_match:
                primary_keys.extend(clean_identifier(col) for col in split_top_level(table_pk_match.group(1)))
                continue

            table_fk_match = re.match(
                r"(?:CONSTRAINT\s+\S+\s+)?FOREIGN\s+KEY\s*\((.*?)\)\s+REFERENCES\s+([A-Za-z_][\w.]*|\"[^\"]+\")",
                stripped,
                flags=re.IGNORECASE | re.DOTALL,
            )
            if table_fk_match:
                referenced_table = clean_identifier(table_fk_match.group(2))
                for column in split_top_level(table_fk_match.group(1)):
                    foreign_keys[clean_identifier(column)] = referenced_table
                continue

            if first_word in {
                "CHECK",
                "CONSTRAINT",
                "EXCLUDE",
                "FOREIGN",
                "PRIMARY",
                "UNIQUE",
            }:
                continue

            col_match = re.match(r'"([^"]+)"|([A-Za-z_][\w]*)', stripped)
            if col_match:
                column = (col_match.group(1) or col_match.group(2)).lower()
                columns.append(column)
                remainder = stripped[col_match.end() :].strip()
                column_types[column] = remainder.split(maxsplit=1)[0].lower() if remainder else ""
                if re.search(r"\bPRIMARY\s+KEY\b", stripped, flags=re.IGNORECASE):
                    primary_keys.append(column)
                references = re.search(
                    r"\bREFERENCES\s+([A-Za-z_][\w.]*|\"[^\"]+\")",
                    stripped,
                    flags=re.IGNORECASE,
                )
                if references:
                    foreign_keys[column] = clean_identifier(references.group(1))

        # Docker executes CREATE TABLE IF NOT EXISTS in file order, so the first
        # definition is the one that matters for duplicated table names.
        schemas.setdefault(
            table,
            TableSchema(statement.line, columns, column_types, primary_keys, foreign_keys),
        )

    return schemas


def extract_insert_rows(statement: str, values_index: int) -> list[tuple[int, list[str]]] | None:
    rows: list[tuple[int, list[str]]] = []
    i = values_index
    while i < len(statement):
        while i < len(statement) and statement[i].isspace():
            i += 1
        if i >= len(statement) or statement[i] != "(":
            break

        close_index = find_matching_paren(statement, i)
        if close_index == -1:
            return None

        rows.append((i, split_top_level(statement[i + 1 : close_index])))
        i = close_index + 1

        while i < len(statement) and statement[i].isspace():
            i += 1
        if i < len(statement) and statement[i] == ",":
            i += 1
            continue
        break

    return rows


def check_inserts(statements: list[Statement], schemas: dict[str, TableSchema]) -> list[Issue]:
    issues: list[Issue] = []
    insert_re = re.compile(
        r"INSERT\s+INTO\s+([A-Za-z_][\w.]*|\"[^\"]+\")\s*(?:\((.*?)\))?\s+VALUES\s*",
        flags=re.IGNORECASE | re.DOTALL,
    )

    for statement in statements:
        statement_text = strip_leading_comments(statement.text)
        match = insert_re.match(statement_text)
        if not match:
            continue

        table = clean_identifier(match.group(1))
        explicit_columns = match.group(2)
        if explicit_columns is not None:
            expected = len(split_top_level(explicit_columns))
            expected_source = "target column list"
        elif table in schemas:
            expected = len(schemas[table].columns)
            expected_source = f"schema table '{table}'"
        else:
            issues.append(
                Issue("warning", statement.line, f"INSERT targets unknown table '{table}'")
            )
            continue

        rows = extract_insert_rows(statement_text, match.end())
        if rows is None:
            issues.append(
                Issue("error", statement.line, f"INSERT into '{table}' has unbalanced VALUES parentheses")
            )
            continue
        if not rows:
            issues.append(Issue("error", statement.line, f"INSERT into '{table}' has no VALUES rows"))
            continue

        for index, (_, row) in enumerate(rows, start=1):
            actual = len(row)
            if actual != expected:
                row_suffix = f" row {index}" if len(rows) > 1 else ""
                issues.append(
                    Issue(
                        "error",
                        statement.line,
                        f"INSERT into '{table}'{row_suffix} has {actual} values, "
                        f"but {expected_source} expects {expected}",
                    )
                )

    return issues


def check_literal_value_types(
    statements: list[Statement],
    schemas: dict[str, TableSchema],
) -> list[Issue]:
    issues: list[Issue] = []
    insert_re = re.compile(
        r"INSERT\s+INTO\s+([A-Za-z_][\w.]*|\"[^\"]+\")\s*(?:\((.*?)\))?\s+VALUES\s*",
        flags=re.IGNORECASE | re.DOTALL,
    )

    for statement in statements:
        statement_text = strip_leading_comments(statement.text)
        match = insert_re.match(statement_text)
        if not match:
            continue

        table = clean_identifier(match.group(1))
        schema = schemas.get(table)
        if not schema:
            continue

        columns = (
            [clean_identifier(column) for column in split_top_level(match.group(2))]
            if match.group(2)
            else schema.columns
        )
        rows = extract_insert_rows(statement_text, match.end())
        if rows is None:
            continue

        for row_index, (_, row) in enumerate(rows, start=1):
            for index, raw_value in enumerate(row):
                if index >= len(columns):
                    continue

                column = columns[index]
                column_type = schema.column_types.get(column, "")
                value = strip_cast(raw_value)
                if value.upper() == "NULL":
                    continue

                if column_type == "uuid" and value.startswith("'") and not unquote_uuid_literal(value):
                    row_suffix = f" row {row_index}" if len(rows) > 1 else ""
                    issues.append(
                        Issue(
                            "error",
                            statement.line,
                            f"INSERT into '{table}'{row_suffix} puts non-UUID literal "
                            f"into UUID column '{column}': {value}",
                        )
                    )

    return issues


def unquote_uuid_literal(value: str) -> str | None:
    match = UUID_RE.match(value.strip())
    return match.group(1).lower() if match else None


def strip_cast(value: str) -> str:
    return re.sub(r"\s*::\s*[A-Za-z_][\w.]*\s*$", "", value.strip())


def collect_primary_key_values(
    statements: list[Statement],
    schemas: dict[str, TableSchema],
) -> dict[tuple[str, str], set[str]]:
    values: dict[tuple[str, str], set[str]] = {}
    insert_re = re.compile(
        r"INSERT\s+INTO\s+([A-Za-z_][\w.]*|\"[^\"]+\")\s*(?:\((.*?)\))?\s+VALUES\s*",
        flags=re.IGNORECASE | re.DOTALL,
    )

    for statement in statements:
        statement_text = strip_leading_comments(statement.text)
        match = insert_re.match(statement_text)
        if not match:
            continue

        table = clean_identifier(match.group(1))
        schema = schemas.get(table)
        if not schema:
            continue

        columns = (
            [clean_identifier(column) for column in split_top_level(match.group(2))]
            if match.group(2)
            else schema.columns
        )
        pk_columns = schema.primary_keys or (["id"] if "id" in schema.columns else [])
        pk_indexes = [(column, columns.index(column)) for column in pk_columns if column in columns]
        if not pk_indexes:
            continue

        rows = extract_insert_rows(statement_text, match.end())
        if rows is None:
            continue

        for _, row in rows:
            for column, index in pk_indexes:
                if index >= len(row):
                    continue
                pk = unquote_uuid_literal(row[index])
                if pk:
                    values.setdefault((table, column), set()).add(pk)

    return values


def check_literal_foreign_keys(
    statements: list[Statement],
    schemas: dict[str, TableSchema],
    known_primary_keys: dict[tuple[str, str], set[str]],
) -> list[Issue]:
    issues: list[Issue] = []
    insert_re = re.compile(
        r"INSERT\s+INTO\s+([A-Za-z_][\w.]*|\"[^\"]+\")\s*(?:\((.*?)\))?\s+VALUES\s*",
        flags=re.IGNORECASE | re.DOTALL,
    )

    for statement in statements:
        statement_text = strip_leading_comments(statement.text)
        match = insert_re.match(statement_text)
        if not match:
            continue

        table = clean_identifier(match.group(1))
        schema = schemas.get(table)
        if not schema:
            continue

        columns = (
            [clean_identifier(column) for column in split_top_level(match.group(2))]
            if match.group(2)
            else schema.columns
        )
        rows = extract_insert_rows(statement_text, match.end())
        if rows is None:
            continue

        for row_index, (_, row) in enumerate(rows, start=1):
            for column, referenced_table in schema.foreign_keys.items():
                if column not in columns:
                    continue
                value_index = columns.index(column)
                if value_index >= len(row):
                    continue

                raw_value = strip_cast(row[value_index])
                if raw_value.upper() == "NULL":
                    continue

                fk_value = unquote_uuid_literal(raw_value)
                if not fk_value:
                    continue

                referenced_schema = schemas.get(referenced_table)
                referenced_pk_columns = (
                    referenced_schema.primary_keys if referenced_schema else []
                ) or ["id"]
                known_values: set[str] = set()
                for pk_column in referenced_pk_columns:
                    known_values.update(known_primary_keys.get((referenced_table, pk_column), set()))

                if not known_values:
                    row_suffix = f" row {row_index}" if len(rows) > 1 else ""
                    issues.append(
                        Issue(
                            "error",
                            statement.line,
                            f"INSERT into '{table}'{row_suffix} references "
                            f"{referenced_table}.id via column '{column}', but no "
                            f"seeded {referenced_table}.id values were found: {fk_value}",
                        )
                    )
                    continue

                if fk_value not in known_values:
                    row_suffix = f" row {row_index}" if len(rows) > 1 else ""
                    issues.append(
                        Issue(
                            "error",
                            statement.line,
                            f"INSERT into '{table}'{row_suffix} references missing "
                            f"{referenced_table}.id via column '{column}': {fk_value}",
                        )
                    )

    return issues


def main() -> int:
    parser = argparse.ArgumentParser(description="Statically check PostgreSQL seed SQL files.")
    parser.add_argument(
        "seed",
        nargs="?",
        type=Path,
        default=DEFAULT_SEED,
        help=f"Seed/data SQL file to check. Default: {DEFAULT_SEED}",
    )
    parser.add_argument(
        "--schema",
        type=Path,
        default=DEFAULT_SCHEMA,
        help=f"Schema SQL file containing CREATE TABLE statements. Default: {DEFAULT_SCHEMA}",
    )
    parser.add_argument(
        "--previous",
        type=Path,
        action="append",
        default=DEFAULT_PREVIOUS.copy(),
        help=(
            "SQL file executed before the target seed. Can be passed multiple times. "
            f"Default: {', '.join(str(path) for path in DEFAULT_PREVIOUS)}"
        ),
    )
    args = parser.parse_args()

    schema_sql = args.schema.read_text(encoding="utf-8")
    seed_sql = args.seed.read_text(encoding="utf-8")
    previous_sql = "\n".join(path.read_text(encoding="utf-8") for path in args.previous)

    schema_statements, schema_issues = split_sql(schema_sql)
    previous_statements, previous_issues = split_sql(previous_sql)
    seed_statements, seed_issues = split_sql(seed_sql)
    schemas = extract_create_tables(schema_statements + seed_statements)
    known_primary_keys = collect_primary_key_values(
        [*previous_statements, *seed_statements],
        schemas,
    )
    issues = [
        *schema_issues,
        *previous_issues,
        *seed_issues,
        *check_inserts(seed_statements, schemas),
        *check_literal_value_types(seed_statements, schemas),
        *check_literal_foreign_keys(seed_statements, schemas, known_primary_keys),
    ]

    for issue in issues:
        print(f"{issue.level.upper()} line {issue.line}: {issue.message}")

    error_count = sum(1 for issue in issues if issue.level == "error")
    warning_count = sum(1 for issue in issues if issue.level == "warning")
    print(
        f"Checked {len(seed_statements)} statements in {args.seed} "
        f"against {len(schemas)} tables from {args.schema}."
    )
    print(f"Result: {error_count} error(s), {warning_count} warning(s).")

    return 1 if error_count else 0


if __name__ == "__main__":
    sys.exit(main())
