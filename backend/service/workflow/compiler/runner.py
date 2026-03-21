"""
Sudo Runner — CLI entry point for running sudo-compiled workflow tests.

Run from the backend directory::

    python -m service.workflow.compiler.runner                          # all templates
    python -m service.workflow.compiler.runner --workflow template-autonomous
    python -m service.workflow.compiler.runner --workflow template-simple --input "Hello"
    python -m service.workflow.compiler.runner --all-paths              # test every classify branch
    python -m service.workflow.compiler.runner --validate               # quick pass/fail
    python -m service.workflow.compiler.runner --override classify=hard # force path
    python -m service.workflow.compiler.runner --json                   # JSON output
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
from logging import getLogger
from pathlib import Path
from typing import Optional

logger = getLogger(__name__)


def _load_workflow(name_or_path: str):
    """Load a WorkflowDefinition from a template name or file path."""
    from service.workflow.workflow_model import WorkflowDefinition

    # Try as file path first
    path = Path(name_or_path)
    if path.exists() and path.suffix == ".json":
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return WorkflowDefinition(**data)

    # Try as template name (look in workflows/ directory)
    backend_dir = Path(__file__).resolve().parent.parent.parent.parent
    workflows_dir = backend_dir / "workflows"

    # Try exact match
    candidate = workflows_dir / f"{name_or_path}.json"
    if candidate.exists():
        with open(candidate, "r", encoding="utf-8") as f:
            data = json.load(f)
        return WorkflowDefinition(**data)

    # Try with template- prefix
    candidate = workflows_dir / f"template-{name_or_path}.json"
    if candidate.exists():
        with open(candidate, "r", encoding="utf-8") as f:
            data = json.load(f)
        return WorkflowDefinition(**data)

    raise FileNotFoundError(
        f"Workflow not found: '{name_or_path}'. "
        f"Checked: {path}, {workflows_dir / f'{name_or_path}.json'}, "
        f"{workflows_dir / f'template-{name_or_path}.json'}"
    )


def _list_workflows() -> list:
    """List available workflow templates."""
    backend_dir = Path(__file__).resolve().parent.parent.parent.parent
    workflows_dir = backend_dir / "workflows"
    if not workflows_dir.exists():
        return []
    return sorted(p.stem for p in workflows_dir.glob("*.json"))


def _parse_overrides(override_args: list) -> dict:
    """Parse 'key=value' override arguments into a dict."""
    overrides = {}
    for arg in override_args:
        if "=" not in arg:
            print(f"⚠ Invalid override format: '{arg}' (expected key=value)", file=sys.stderr)
            continue
        key, value = arg.split("=", 1)
        overrides[key.strip()] = value.strip()
    return overrides


async def _run_single(args: argparse.Namespace) -> int:
    """Run a single workflow through the sudo compiler."""
    from service.workflow.compiler.compiler import SudoCompiler

    workflow = _load_workflow(args.workflow)
    overrides = _parse_overrides(args.override) if args.override else {}

    if args.validate:
        result = await SudoCompiler.validate(workflow, args.input)
        if args.json:
            print(json.dumps(result, indent=2, ensure_ascii=False))
        else:
            status = "✅ VALID" if result["valid"] else "❌ INVALID"
            print(f"\n{status} — {result['total_paths']} path(s) tested")
            for p in result["paths"]:
                icon = "✅" if p["success"] else "❌"
                print(f"  {icon} {p['path']}")
                if "error" in p:
                    print(f"     Error: {p['error']}")
        return 0 if result["valid"] else 1

    if args.all_paths:
        reports = await SudoCompiler.run_all_paths(
            workflow, args.input,
            max_iterations=args.max_iterations,
        )
        if args.json:
            print(json.dumps(
                [r.to_dict() for r in reports],
                indent=2, ensure_ascii=False,
            ))
        else:
            for i, r in enumerate(reports):
                if i > 0:
                    print()
                print(r.summary())
        return 0 if all(r.success for r in reports) else 1

    # Single run
    compiler = SudoCompiler(
        workflow,
        seed=args.seed,
        overrides=overrides,
        max_iterations=args.max_iterations,
    )
    report = await compiler.run(args.input)

    if args.json:
        print(report.to_json())
    else:
        print(report.summary())

    return 0 if report.success else 1


async def _run_all_templates(args: argparse.Namespace) -> int:
    """Run all available workflow templates through the sudo compiler."""
    from service.workflow.compiler.compiler import SudoCompiler

    templates = _list_workflows()
    if not templates:
        print("No workflow templates found.", file=sys.stderr)
        return 1

    all_results = []
    exit_code = 0

    for name in templates:
        try:
            workflow = _load_workflow(name)
        except Exception as e:
            print(f"⚠ Skipping {name}: {e}", file=sys.stderr)
            continue

        if args.validate:
            result = await SudoCompiler.validate(workflow, args.input)
            all_results.append({"workflow": name, **result})
            if not result["valid"]:
                exit_code = 1
        else:
            reports = await SudoCompiler.run_all_paths(
                workflow, args.input,
                max_iterations=args.max_iterations,
            )
            for r in reports:
                all_results.append(r)
                if not r.success:
                    exit_code = 1

    if args.json:
        if args.validate:
            print(json.dumps(all_results, indent=2, ensure_ascii=False))
        else:
            print(json.dumps(
                [r.to_dict() for r in all_results],
                indent=2, ensure_ascii=False,
            ))
    else:
        if args.validate:
            print(f"\n{'═' * 50}")
            print("Sudo Validation — All Templates")
            print(f"{'═' * 50}")
            for r in all_results:
                status = "✅" if r["valid"] else "❌"
                print(f"  {status} {r['workflow']} ({r['total_paths']} paths)")
                for p in r.get("paths", []):
                    icon = "✅" if p["success"] else "❌"
                    print(f"     {icon} {p['path']}")
        else:
            for i, r in enumerate(all_results):
                if i > 0:
                    print()
                print(r.summary())

    return exit_code


def main() -> None:
    parser = argparse.ArgumentParser(
        prog="sudo-runner",
        description="Dry-run workflow graphs with mock LLM responses.",
    )
    parser.add_argument(
        "--workflow", "-w",
        help="Workflow template name or JSON file path. "
             "Omit to run all available templates.",
    )
    parser.add_argument(
        "--input", "-i",
        default="Sudo test: validate graph execution paths.",
        help="Input text for the sudo run (default: test string).",
    )
    parser.add_argument(
        "--all-paths", "-a",
        action="store_true",
        help="Test all classification paths (one run per category).",
    )
    parser.add_argument(
        "--validate", "-v",
        action="store_true",
        help="Quick validation mode: run all paths, report pass/fail.",
    )
    parser.add_argument(
        "--override", "-o",
        action="append",
        default=[],
        help="Override a node response: 'classify=hard' (repeatable).",
    )
    parser.add_argument(
        "--seed", "-s",
        type=int,
        default=42,
        help="Random seed for reproducibility (default: 42).",
    )
    parser.add_argument(
        "--max-iterations", "-m",
        type=int,
        default=50,
        help="Maximum graph iterations (default: 50).",
    )
    parser.add_argument(
        "--json", "-j",
        action="store_true",
        help="Output results as JSON instead of human-readable text.",
    )
    parser.add_argument(
        "--list", "-l",
        action="store_true",
        help="List available workflow templates and exit.",
    )

    args = parser.parse_args()

    if args.list:
        templates = _list_workflows()
        if templates:
            print("Available workflow templates:")
            for t in templates:
                print(f"  • {t}")
        else:
            print("No workflow templates found.")
        return

    # Import nodes to trigger registration
    try:
        import service.workflow.nodes  # noqa: F401
    except ImportError:
        pass

    if args.workflow:
        exit_code = asyncio.run(_run_single(args))
    else:
        exit_code = asyncio.run(_run_all_templates(args))

    sys.exit(exit_code)


if __name__ == "__main__":
    main()
