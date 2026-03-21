"""
Documentation API - Serves markdown documentation files.
"""
from pathlib import Path
from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/api/docs", tags=["docs"])

DOCS_DIR = Path(__file__).parent.parent / "docs"


@router.get("/")
async def list_docs(lang: str = "en"):
    """List all available documentation files."""
    if not DOCS_DIR.exists():
        return {"docs": []}

    suffix = "_KO.md" if lang == "ko" else ".md"
    exclude_suffix = "_KO.md"

    docs = []
    for f in sorted(DOCS_DIR.iterdir()):
        if not f.is_file():
            continue
        name = f.name

        if lang == "ko":
            if not name.endswith("_KO.md"):
                continue
            slug = name.replace("_KO.md", "")
        else:
            if name.endswith("_KO.md"):
                continue
            if not name.endswith(".md"):
                continue
            slug = name.replace(".md", "")

        docs.append({
            "slug": slug,
            "filename": name,
            "title": slug.replace("_", " ").title(),
        })

    # Also include backend README
    readme_dir = Path(__file__).parent.parent
    if lang == "ko":
        readme_path = readme_dir / "README_KO.md"
    else:
        readme_path = readme_dir / "README.md"

    if readme_path.exists():
        docs.insert(0, {
            "slug": "README",
            "filename": readme_path.name,
            "title": "Overview",
        })

    return {"docs": docs}


@router.get("/{slug}")
async def get_doc(slug: str, lang: str = "en"):
    """Get a single documentation file content by slug."""
    # Handle README specially (lives in backend/ not docs/)
    if slug == "README":
        base_dir = Path(__file__).parent.parent
        if lang == "ko":
            doc_path = base_dir / "README_KO.md"
        else:
            doc_path = base_dir / "README.md"
    else:
        if lang == "ko":
            doc_path = DOCS_DIR / f"{slug}_KO.md"
        else:
            doc_path = DOCS_DIR / f"{slug}.md"

    # Validate the resolved path is within expected directories
    try:
        resolved = doc_path.resolve()
        docs_resolved = DOCS_DIR.resolve()
        backend_resolved = Path(__file__).parent.parent.resolve()
        if not (str(resolved).startswith(str(docs_resolved)) or
                (slug == "README" and str(resolved).startswith(str(backend_resolved)))):
            raise HTTPException(status_code=403, detail="Access denied")
    except Exception:
        raise HTTPException(status_code=403, detail="Invalid path")

    if not doc_path.exists():
        # Fallback to English if Korean not available
        if lang == "ko":
            return await get_doc(slug, lang="en")
        raise HTTPException(status_code=404, detail=f"Document '{slug}' not found")

    content = doc_path.read_text(encoding="utf-8")
    return {
        "slug": slug,
        "filename": doc_path.name,
        "title": slug.replace("_", " ").title(),
        "content": content,
    }
