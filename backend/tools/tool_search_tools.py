"""
Tool Search Tools — agent-facing tools for dynamic tool discovery.

These tools are the core of the "deferred tool" pattern inspired by
graph-tool-call. Instead of receiving all tool definitions in their
context window, agents receive only these search tools and use them
to discover and retrieve the specific tools they need.

Workflow:
    1. Agent receives a task
    2. Agent calls `tool_search` to find relevant tools
    3. Agent calls `tool_schema` to get the full parameter schema
    4. Agent calls the discovered tool with the correct parameters

This file is auto-loaded by MCPLoader (matches *_tools.py pattern).
"""

import json
from tools.base import BaseTool


class ToolSearchTool(BaseTool):
    """Search for available tools by natural language query.

    Given a description of what you need to do, this tool searches the
    tool registry and returns the most relevant tools with their names
    and descriptions. Use this as the first step to discover which tools
    are available for a task.

    After finding a tool, use `tool_schema` to get its full parameter
    schema before calling it.
    """

    name = "tool_search"
    description = (
        "Search for available tools by describing what you need. "
        "Returns matching tool names and descriptions ranked by relevance. "
        "Use this to discover which tools can help with your current task."
    )

    def run(self, query: str, top_k: int = 5) -> str:
        """Search for tools matching a natural language query.

        Args:
            query: What you need to do (e.g. "read a file", "search git history")
            top_k: Maximum number of results to return (default: 5)
        """
        from service.tool_registry import get_tool_registry
        registry = get_tool_registry()

        results = registry.search(query, top_k=top_k)

        if not results:
            return json.dumps({
                "matches": [],
                "message": f"No tools found matching '{query}'. Try broader search terms.",
                "total_available": registry.tool_count,
            }, indent=2)

        matches = []
        for entry in results:
            match = {
                "name": entry.name,
                "description": entry.description,
                "server": entry.server_name,
            }
            if entry.tags:
                match["tags"] = entry.tags
            matches.append(match)

        return json.dumps({
            "matches": matches,
            "result_count": len(matches),
            "hint": "Use tool_schema(tool_name) to get full parameter details before calling a tool.",
        }, indent=2)


class ToolSchemaTool(BaseTool):
    """Get the full schema for a specific tool.

    After discovering a tool via `tool_search`, use this to retrieve its
    complete parameter schema including required fields, types, and
    descriptions. This gives you everything needed to call the tool correctly.
    """

    name = "tool_schema"
    description = (
        "Get the full parameter schema for a specific tool by name. "
        "Returns the complete definition needed to call the tool correctly, "
        "including all parameters, their types, and which are required."
    )

    def run(self, tool_name: str) -> str:
        """Get the full schema for a tool.

        Args:
            tool_name: Exact name of the tool (from tool_search results)
        """
        from service.tool_registry import get_tool_registry
        registry = get_tool_registry()

        schema = registry.get_tool_schema(tool_name)

        if schema is None:
            # Try fuzzy match
            all_tools = registry.list_all_tools()
            suggestions = [
                t for t in all_tools
                if tool_name.lower() in t.lower() or t.lower() in tool_name.lower()
            ]

            result = {
                "error": f"Tool '{tool_name}' not found.",
            }
            if suggestions:
                result["did_you_mean"] = suggestions[:5]
            else:
                result["hint"] = "Use tool_search(query) to find available tools."

            return json.dumps(result, indent=2)

        return json.dumps(schema, indent=2)


class BrowseToolCategoriesTool(BaseTool):
    """Browse all available tools organized by category/server.

    Use this to get an overview of what tool categories are available
    without searching for a specific capability. Helpful when you want
    to understand the full scope of available tools.
    """

    name = "tool_browse"
    description = (
        "Browse all available tools organized by server/category. "
        "Returns a tree of tool groups with tool counts. "
        "Use this to explore what types of tools are available."
    )

    def run(self) -> str:
        """Browse tool categories."""
        from service.tool_registry import get_tool_registry
        registry = get_tool_registry()

        categories = registry.browse_categories()
        return json.dumps(categories, indent=2)


class ToolWorkflowTool(BaseTool):
    """Get the recommended workflow chain for a tool.

    Some tools are typically called in sequence (e.g. list_orders ->
    get_order -> cancel_order -> process_refund). This tool reveals
    the typical execution flow for a given tool.
    """

    name = "tool_workflow"
    description = (
        "Get the recommended execution sequence for a tool. "
        "Shows which tools typically precede or follow the given tool. "
        "Useful for understanding multi-step workflows."
    )

    def run(self, tool_name: str) -> str:
        """Get the workflow chain for a tool.

        Args:
            tool_name: Name of the tool to get the workflow for
        """
        from service.tool_registry import get_tool_registry
        registry = get_tool_registry()

        workflow = registry.get_workflow(tool_name)

        if not workflow:
            return json.dumps({
                "tool": tool_name,
                "workflow": [],
                "message": "No workflow chain detected for this tool.",
            }, indent=2)

        return json.dumps({
            "tool": tool_name,
            "workflow": workflow,
            "step_count": len(workflow),
        }, indent=2)


# =============================================================================
# Export list — MCPLoader auto-collects these
# =============================================================================

TOOLS = [
    ToolSearchTool(),
    ToolSchemaTool(),
    BrowseToolCategoriesTool(),
    ToolWorkflowTool(),
]
