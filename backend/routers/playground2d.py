"""
Playground 2D Controller

REST API endpoints for the 2D world playground:
- World layout CRUD (load / save)
- World state query (active agents / avatars)
"""

import json
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from logging import getLogger

logger = getLogger(__name__)

router = APIRouter(prefix="/api/playground2d", tags=["playground2d"])

# ── Paths ──────────────────────────────────────────────────────
_DATA_DIR = Path(__file__).resolve().parent.parent / "data" / "playground2d"
_LAYOUT_FILE = _DATA_DIR / "world-layout.json"
_DEFAULT_LAYOUT_FILE = _DATA_DIR / "world-layout.default.json"


# ── Pydantic Models ───────────────────────────────────────────

class Building(BaseModel):
    id: str
    name: str
    type: str
    x: int
    y: int
    w: int
    h: int


class IndoorStation(BaseModel):
    id: str
    locationId: str
    kind: str
    type: str
    dx: int
    dy: int
    label: str
    flipX: Optional[bool] = None
    flipY: Optional[bool] = None


class OutdoorStation(BaseModel):
    id: str
    kind: str
    type: str
    x: int
    y: int
    dx: int = 0
    dy: int = 0
    label: str
    activity: Optional[str] = None
    flipX: Optional[bool] = None
    flipY: Optional[bool] = None


class Tree(BaseModel):
    x: int
    y: int
    type: str
    flipX: Optional[bool] = None
    flipY: Optional[bool] = None


class WorldLayout(BaseModel):
    version: int = 2
    buildings: List[Building] = Field(default_factory=list)
    indoorStations: List[IndoorStation] = Field(default_factory=list)
    outdoorStations: List[OutdoorStation] = Field(default_factory=list)
    trees: List[Tree] = Field(default_factory=list)


class AgentAvatar(BaseModel):
    session_id: str
    name: str
    x: int
    y: int
    location_id: Optional[str] = None
    activity: Optional[str] = None


class WorldState(BaseModel):
    agents: List[AgentAvatar] = Field(default_factory=list)


# ── Helpers ────────────────────────────────────────────────────

def _load_layout() -> dict:
    """Load the saved layout, falling back to the default layout file."""
    if _LAYOUT_FILE.exists():
        try:
            return json.loads(_LAYOUT_FILE.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError) as exc:
            logger.warning(f"Failed to read {_LAYOUT_FILE}: {exc}")

    # Fall back to default
    if _DEFAULT_LAYOUT_FILE.exists():
        try:
            return json.loads(_DEFAULT_LAYOUT_FILE.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError) as exc:
            logger.warning(f"Failed to read default layout: {exc}")

    # Ultimate fallback — minimal empty layout
    return {"version": 2, "buildings": [], "indoorStations": [], "outdoorStations": [], "trees": []}


def _save_layout(data: dict) -> None:
    """Persist layout JSON to disk."""
    _DATA_DIR.mkdir(parents=True, exist_ok=True)
    _LAYOUT_FILE.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")


# ── Endpoints ──────────────────────────────────────────────────

@router.get("/layout", response_model=WorldLayout)
async def get_layout():
    """Return the current world layout (buildings, stations, trees)."""
    data = _load_layout()
    return data


@router.put("/layout", response_model=WorldLayout)
async def save_layout(layout: WorldLayout):
    """Save a new world layout. Performs basic structural validation via the Pydantic model."""
    data = layout.model_dump()
    _save_layout(data)
    logger.info(f"World layout saved ({len(layout.buildings)} buildings, "
                f"{len(layout.indoorStations)} indoor stations, "
                f"{len(layout.outdoorStations)} outdoor stations, "
                f"{len(layout.trees)} trees)")
    return data


@router.get("/state", response_model=WorldState)
async def get_state():
    """Return the current world state (active agent avatars).

    This is a stub — a future implementation will derive agent positions
    from active sessions and their assigned locations.
    """
    # TODO: integrate with agent_manager to derive live positions
    return WorldState(agents=[])
