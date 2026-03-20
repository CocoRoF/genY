#!/usr/bin/env python3
"""
Auto-generated MCP Server for tools/
This file is auto-generated. Do not edit manually.
"""
import sys
import functools
import asyncio
from pathlib import Path

# Add project root to path
PROJECT_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

try:
    from mcp.server.fastmcp import FastMCP
except ImportError:
    print("Error: MCP SDK not installed. Run: pip install mcp", file=sys.stderr)
    sys.exit(1)

from tools.browser_tools import TOOLS as browser_tools_TOOLS
from tools.geny_tools import TOOLS as geny_tools_TOOLS
from tools.web_fetch_tools import TOOLS as web_fetch_tools_TOOLS
from tools.web_search_tools import TOOLS as web_search_tools_TOOLS

_tools = []
_tools.extend(browser_tools_TOOLS)
_tools.extend(geny_tools_TOOLS)
_tools.extend(web_fetch_tools_TOOLS)
_tools.extend(web_search_tools_TOOLS)

# Create MCP server
mcp = FastMCP("builtin-tools")


def _register_tool(tool_obj, mcp_server):
    """Register a single tool with proper name, description, and parameter schema."""
    name = getattr(tool_obj, 'name', None)
    if not name and hasattr(tool_obj, '__name__'):
        name = tool_obj.__name__
    if not name:
        return

    description = (
        getattr(tool_obj, 'description', '')
        or getattr(tool_obj, '__doc__', '')
        or f"Tool: {name}"
    )

    if hasattr(tool_obj, 'run') and callable(tool_obj.run):
        source_fn = tool_obj.run
    elif callable(tool_obj):
        source_fn = tool_obj
    else:
        return

    @functools.wraps(source_fn)
    async def async_wrapper(*args, **kwargs):
        if asyncio.iscoroutinefunction(source_fn):
            return await source_fn(*args, **kwargs)
        return source_fn(*args, **kwargs)

    async_wrapper.__name__ = name

    source_doc = source_fn.__doc__ or ""
    args_section = ""
    if "Args:" in source_doc:
        args_idx = source_doc.index("Args:")
        args_section = source_doc[args_idx:]
    async_wrapper.__doc__ = (
        f"{description}\n\n{args_section}" if args_section else description
    )

    mcp_server.tool(name=name, description=description)(async_wrapper)


for tool_obj in _tools:
    _register_tool(tool_obj, mcp)

if __name__ == "__main__":
    mcp.run(transport="stdio")
