import asyncio
import importlib
import sys
from pathlib import Path

REPOSITORY_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPOSITORY_ROOT / "apps" / "api" / "src"))
sys.path.insert(0, str(REPOSITORY_ROOT / "packages" / "finance-engine" / "src"))
ai_client = importlib.import_module("finadvisor_api.ai_client")


async def run_smoke() -> int:
    try:
        await ai_client.generate(
            "Reply with the single word OK.",
            {"purpose": "configuration smoke test"},
        )
    except ai_client.AIClientError as error:
        print(f"AI smoke failed: {error}", file=sys.stderr)
        return 1

    print("AI smoke OK")
    return 0


def main() -> int:
    return asyncio.run(run_smoke())


if __name__ == "__main__":
    raise SystemExit(main())
