"""
Memory Controller — REST API for structured memory management.

Provides endpoints for browsing, searching, creating, updating, and
deleting structured memory notes within an agent session.

All endpoints are scoped to a session via ``/api/agents/{session_id}/memory``.
"""
import json
from logging import getLogger
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Path, Query
from pydantic import BaseModel, Field

from service.langgraph import get_agent_session_manager

logger = getLogger(__name__)

router = APIRouter(prefix="/api/agents", tags=["memory"])


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
    links_to: Optional[List[str]] = None


class LinkNotesRequest(BaseModel):
    source_filename: str
    target_filename: str


class SearchRequest(BaseModel):
    query: str
    max_results: int = 10
    category: Optional[str] = None
    tag: Optional[str] = None


# ============================================================================
# Helpers
# ============================================================================

def _get_memory_manager(session_id: str):
    """Get the SessionMemoryManager for a session, raising 404 if not found."""
    agent_manager = get_agent_session_manager()
    agent = agent_manager.get_agent(session_id)
    if agent is None:
        raise HTTPException(status_code=404, detail=f"Session not found: {session_id}")
    mm = agent.memory_manager
    if mm is None:
        raise HTTPException(status_code=503, detail="Memory manager not initialized")
    return mm


# ============================================================================
# Endpoints — Index & Stats
# ============================================================================

@router.get("/{session_id}/memory")
async def get_memory_index(session_id: str = Path(...)):
    """Get the full memory index (file list, tags, stats)."""
    mm = _get_memory_manager(session_id)
    index = mm.get_memory_index()
    stats = mm.get_stats()
    return {
        "index": index or {"files": {}, "tag_map": {}, "total_files": 0, "total_chars": 0},
        "stats": stats.to_dict(),
    }


@router.get("/{session_id}/memory/stats")
async def get_memory_stats(session_id: str = Path(...)):
    """Get memory statistics."""
    mm = _get_memory_manager(session_id)
    stats = mm.get_stats()
    return stats.to_dict()


@router.get("/{session_id}/memory/tags")
async def get_memory_tags(session_id: str = Path(...)):
    """Get all tags and their counts."""
    mm = _get_memory_manager(session_id)
    return {"tags": mm.get_memory_tags()}


@router.get("/{session_id}/memory/graph")
async def get_memory_graph(session_id: str = Path(...)):
    """Get link graph data for visualization."""
    mm = _get_memory_manager(session_id)
    return mm.get_memory_graph()


# ============================================================================
# Endpoints — CRUD
# ============================================================================

@router.get("/{session_id}/memory/files")
async def list_memory_files(
    session_id: str = Path(...),
    category: Optional[str] = Query(None),
    tag: Optional[str] = Query(None),
):
    """List memory files with optional filters."""
    mm = _get_memory_manager(session_id)
    notes = mm.list_notes(category=category, tag=tag)
    return {"files": notes, "total": len(notes)}


@router.get("/{session_id}/memory/files/{filename:path}")
async def read_memory_file(
    session_id: str = Path(...),
    filename: str = Path(...),
):
    """Read a single memory file with metadata and body."""
    mm = _get_memory_manager(session_id)
    result = mm.read_note(filename)
    if result is None:
        raise HTTPException(status_code=404, detail=f"File not found: {filename}")
    return result


@router.post("/{session_id}/memory/files")
async def create_memory_file(
    session_id: str = Path(...),
    req: WriteNoteRequest = ...,
):
    """Create a new structured memory note."""
    mm = _get_memory_manager(session_id)
    filename = mm.write_note(
        title=req.title,
        content=req.content,
        category=req.category,
        tags=req.tags,
        importance=req.importance,
        source=req.source,
        links_to=req.links_to,
    )
    if filename is None:
        raise HTTPException(status_code=500, detail="Failed to create memory note")
    return {"filename": filename, "message": "Note created successfully"}


@router.put("/{session_id}/memory/files/{filename:path}")
async def update_memory_file(
    session_id: str = Path(...),
    filename: str = Path(...),
    req: UpdateNoteRequest = ...,
):
    """Update an existing memory note."""
    mm = _get_memory_manager(session_id)
    ok = mm.update_note(
        filename,
        body=req.content,
        tags=req.tags,
        importance=req.importance,
    )
    if not ok:
        raise HTTPException(status_code=404, detail=f"File not found or update failed: {filename}")
    return {"filename": filename, "message": "Note updated successfully"}


@router.delete("/{session_id}/memory/files/{filename:path}")
async def delete_memory_file(
    session_id: str = Path(...),
    filename: str = Path(...),
):
    """Delete a memory note."""
    mm = _get_memory_manager(session_id)
    ok = mm.delete_note(filename)
    if not ok:
        raise HTTPException(status_code=404, detail=f"File not found or delete failed: {filename}")
    return {"message": "Note deleted successfully"}


# ============================================================================
# Endpoints — Search
# ============================================================================

@router.get("/{session_id}/memory/search")
async def search_memory(
    session_id: str = Path(...),
    q: str = Query(..., min_length=1),
    max_results: int = Query(10, ge=1, le=50),
    category: Optional[str] = Query(None),
    tag: Optional[str] = Query(None),
):
    """Search memory with keyword matching."""
    mm = _get_memory_manager(session_id)
    results = mm.search(q, max_results=max_results)

    # Convert to serializable format
    return {
        "query": q,
        "results": [r.to_dict() for r in results],
        "total": len(results),
    }


@router.post("/{session_id}/memory/search")
async def search_memory_post(
    session_id: str = Path(...),
    req: SearchRequest = ...,
):
    """Search memory (POST variant for complex queries)."""
    mm = _get_memory_manager(session_id)
    results = mm.search(req.query, max_results=req.max_results)
    return {
        "query": req.query,
        "results": [r.to_dict() for r in results],
        "total": len(results),
    }


# ============================================================================
# Endpoints — Links
# ============================================================================

@router.post("/{session_id}/memory/links")
async def create_memory_link(
    session_id: str = Path(...),
    req: LinkNotesRequest = ...,
):
    """Create a wikilink between two notes."""
    mm = _get_memory_manager(session_id)
    ok = mm.link_notes(req.source_filename, req.target_filename)
    if not ok:
        raise HTTPException(status_code=400, detail="Failed to create link")
    return {"message": "Link created successfully"}


# ============================================================================
# Endpoints — Maintenance
# ============================================================================

@router.post("/{session_id}/memory/reindex")
async def reindex_memory(session_id: str = Path(...)):
    """Force a full rebuild of the memory index."""
    mm = _get_memory_manager(session_id)
    count = mm.reindex_memory()
    return {"message": "Reindex complete", "total_files": count}


@router.post("/{session_id}/memory/migrate")
async def migrate_memory(session_id: str = Path(...)):
    """Run memory migration (convert legacy files to structured format)."""
    mm = _get_memory_manager(session_id)
    try:
        from service.memory.migrator import MemoryMigrator
        memory_dir = mm.long_term.memory_dir
        migrator = MemoryMigrator(str(memory_dir), session_id)
        report = migrator.migrate()
        return {
            "message": "Migration complete",
            "summary": report.summary if report else "No changes needed",
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Memory migration failed: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=f"Migration failed: {e}")


# ============================================================================
# Endpoints — Promote (Session → Global)
# ============================================================================

@router.post("/{session_id}/memory/promote")
async def promote_to_global(
    session_id: str = Path(...),
    req: dict = ...,
):
    """Promote a session memory note to global memory."""
    filename = req.get("filename")
    if not filename:
        raise HTTPException(status_code=400, detail="filename is required")
    mm = _get_memory_manager(session_id)
    from service.memory.global_memory import get_global_memory_manager
    gmm = get_global_memory_manager()
    global_fn = gmm.promote(mm, filename, session_id=session_id)
    if global_fn is None:
        raise HTTPException(status_code=404, detail=f"Failed to promote: {filename}")
    return {"message": "Note promoted to global memory", "global_filename": global_fn}


# ============================================================================
# Endpoints — Global Memory
# ============================================================================

global_router = APIRouter(prefix="/api/memory/global", tags=["global-memory"])


@global_router.get("")
async def get_global_index():
    """Get the global memory index and stats."""
    from service.memory.global_memory import get_global_memory_manager
    gmm = get_global_memory_manager()
    return {
        "index": gmm.get_index() or {"files": {}, "tag_map": {}, "total_files": 0, "total_chars": 0},
        "stats": gmm.get_stats(),
    }


@global_router.get("/files")
async def list_global_files(
    category: Optional[str] = Query(None),
    tag: Optional[str] = Query(None),
):
    """List global memory files."""
    from service.memory.global_memory import get_global_memory_manager
    gmm = get_global_memory_manager()
    notes = gmm.list_notes(category=category, tag=tag)
    return {"files": notes, "total": len(notes)}


@global_router.get("/files/{filename:path}")
async def read_global_file(filename: str = Path(...)):
    """Read a global memory file."""
    from service.memory.global_memory import get_global_memory_manager
    gmm = get_global_memory_manager()
    result = gmm.read_note(filename)
    if result is None:
        raise HTTPException(status_code=404, detail=f"File not found: {filename}")
    return result


@global_router.post("/files")
async def create_global_file(req: WriteNoteRequest = ...):
    """Create a new global memory note."""
    from service.memory.global_memory import get_global_memory_manager
    gmm = get_global_memory_manager()
    filename = gmm.write_note(
        title=req.title,
        content=req.content,
        category=req.category,
        tags=req.tags,
        importance=req.importance,
        source=req.source,
    )
    if filename is None:
        raise HTTPException(status_code=500, detail="Failed to create global note")
    return {"filename": filename, "message": "Global note created"}


@global_router.put("/files/{filename:path}")
async def update_global_file(
    filename: str = Path(...),
    req: UpdateNoteRequest = ...,
):
    """Update a global memory note."""
    from service.memory.global_memory import get_global_memory_manager
    gmm = get_global_memory_manager()
    ok = gmm.update_note(
        filename, body=req.content, tags=req.tags,
        importance=req.importance,
    )
    if not ok:
        raise HTTPException(status_code=404, detail=f"Update failed: {filename}")
    return {"message": "Global note updated"}


@global_router.delete("/files/{filename:path}")
async def delete_global_file(filename: str = Path(...)):
    """Delete a global memory note."""
    from service.memory.global_memory import get_global_memory_manager
    gmm = get_global_memory_manager()
    ok = gmm.delete_note(filename)
    if not ok:
        raise HTTPException(status_code=404, detail=f"Delete failed: {filename}")
    return {"message": "Global note deleted"}


@global_router.get("/search")
async def search_global(
    q: str = Query(..., min_length=1),
    max_results: int = Query(5, ge=1, le=20),
):
    """Search global memory."""
    from service.memory.global_memory import get_global_memory_manager
    gmm = get_global_memory_manager()
    results = gmm.search(q, max_results=max_results)
    return {"query": q, "results": results, "total": len(results)}
