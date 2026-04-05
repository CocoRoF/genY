"""
User Opsidian Controller — REST API for the personal knowledge vault.

Provides endpoints for browsing, searching, creating, updating, and
deleting structured notes in a user's personal Opsidian vault.

All endpoints require authentication and are scoped to the current user
via ``/api/opsidian/*``.
"""
from logging import getLogger
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Path, Query
from pydantic import BaseModel, Field

from service.auth.auth_middleware import require_auth

logger = getLogger(__name__)

router = APIRouter(prefix="/api/opsidian", tags=["user-opsidian"])


# ============================================================================
# Request / Response Models
# ============================================================================

class WriteNoteRequest(BaseModel):
    title: str
    content: str
    category: str = "topics"
    tags: List[str] = Field(default_factory=list)
    importance: str = "medium"
    source: str = "user"
    links_to: List[str] = Field(default_factory=list)


class UpdateNoteRequest(BaseModel):
    content: Optional[str] = None
    tags: Optional[List[str]] = None
    importance: Optional[str] = None


class LinkNotesRequest(BaseModel):
    source_filename: str
    target_filename: str


# ============================================================================
# Helper
# ============================================================================

def _get_manager(username: str):
    """Get the UserOpsidianManager for the authenticated user."""
    from service.memory.user_opsidian import get_user_opsidian_manager
    return get_user_opsidian_manager(username)


# ============================================================================
# Endpoints — Index & Stats
# ============================================================================

@router.get("")
async def get_opsidian_index(auth: dict = Depends(require_auth)):
    """Get the user's Opsidian index and stats."""
    username = auth.get("sub", "anonymous")
    mgr = _get_manager(username)
    return {
        "index": mgr.get_index() or {"files": {}, "tag_map": {}, "total_files": 0, "total_chars": 0},
        "stats": mgr.get_stats(),
        "username": username,
    }


@router.get("/stats")
async def get_opsidian_stats(auth: dict = Depends(require_auth)):
    """Get user Opsidian statistics."""
    username = auth.get("sub", "anonymous")
    mgr = _get_manager(username)
    return mgr.get_stats()


@router.get("/graph")
async def get_opsidian_graph(auth: dict = Depends(require_auth)):
    """Get link graph data for visualization."""
    username = auth.get("sub", "anonymous")
    mgr = _get_manager(username)
    return mgr.get_graph()


@router.get("/tags")
async def get_opsidian_tags(auth: dict = Depends(require_auth)):
    """Get all tags and their file counts."""
    username = auth.get("sub", "anonymous")
    mgr = _get_manager(username)
    idx = mgr.get_index()
    if idx is None:
        return {"tags": {}}
    return {"tags": idx.get("tag_map", {})}


# ============================================================================
# Endpoints — CRUD
# ============================================================================

@router.get("/files")
async def list_opsidian_files(
    category: Optional[str] = Query(None),
    tag: Optional[str] = Query(None),
    auth: dict = Depends(require_auth),
):
    """List files in the user's Opsidian vault."""
    username = auth.get("sub", "anonymous")
    mgr = _get_manager(username)
    notes = mgr.list_notes(category=category, tag=tag)
    return {"files": notes, "total": len(notes)}


@router.get("/files/{filename:path}")
async def read_opsidian_file(
    filename: str = Path(...),
    auth: dict = Depends(require_auth),
):
    """Read a single note from the user's vault."""
    username = auth.get("sub", "anonymous")
    mgr = _get_manager(username)
    result = mgr.read_note(filename)
    if result is None:
        raise HTTPException(status_code=404, detail=f"File not found: {filename}")
    return result


@router.post("/files")
async def create_opsidian_file(
    req: WriteNoteRequest,
    auth: dict = Depends(require_auth),
):
    """Create a new note in the user's vault."""
    username = auth.get("sub", "anonymous")
    mgr = _get_manager(username)
    filename = mgr.write_note(
        title=req.title,
        content=req.content,
        category=req.category,
        tags=req.tags,
        importance=req.importance,
        source=req.source,
        links_to=req.links_to,
    )
    if filename is None:
        raise HTTPException(status_code=500, detail="Failed to create note")
    return {"filename": filename, "message": "Note created successfully"}


@router.put("/files/{filename:path}")
async def update_opsidian_file(
    req: UpdateNoteRequest,
    filename: str = Path(...),
    auth: dict = Depends(require_auth),
):
    """Update an existing note in the user's vault."""
    username = auth.get("sub", "anonymous")
    mgr = _get_manager(username)
    ok = mgr.update_note(
        filename, body=req.content, tags=req.tags, importance=req.importance,
    )
    if not ok:
        raise HTTPException(status_code=404, detail=f"Update failed: {filename}")
    return {"filename": filename, "message": "Note updated successfully"}


@router.delete("/files/{filename:path}")
async def delete_opsidian_file(
    filename: str = Path(...),
    auth: dict = Depends(require_auth),
):
    """Delete a note from the user's vault."""
    username = auth.get("sub", "anonymous")
    mgr = _get_manager(username)
    ok = mgr.delete_note(filename)
    if not ok:
        raise HTTPException(status_code=404, detail=f"Delete failed: {filename}")
    return {"message": "Note deleted successfully"}


# ============================================================================
# Endpoints — Search
# ============================================================================

@router.get("/search")
async def search_opsidian(
    q: str = Query(..., min_length=1),
    max_results: int = Query(10, ge=1, le=50),
    auth: dict = Depends(require_auth),
):
    """Search across the user's personal notes."""
    username = auth.get("sub", "anonymous")
    mgr = _get_manager(username)
    results = mgr.search(q, max_results=max_results)
    return {"query": q, "results": results, "total": len(results)}


# ============================================================================
# Endpoints — Links & Reindex
# ============================================================================

@router.post("/links")
async def create_opsidian_link(
    req: LinkNotesRequest,
    auth: dict = Depends(require_auth),
):
    """Create a wikilink between two notes."""
    username = auth.get("sub", "anonymous")
    mgr = _get_manager(username)
    ok = mgr.create_link(req.source_filename, req.target_filename)
    if not ok:
        raise HTTPException(status_code=404, detail="Failed to create link")
    return {"message": "Link created"}


@router.post("/reindex")
async def reindex_opsidian(auth: dict = Depends(require_auth)):
    """Rebuild the full index from disk."""
    username = auth.get("sub", "anonymous")
    mgr = _get_manager(username)
    total = mgr.reindex()
    return {"message": "Reindex complete", "total_files": total}
