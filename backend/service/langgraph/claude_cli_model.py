"""
LangGraph + Claude CLI Integration

Integrates LangGraph's state management capabilities while fully leveraging
the session management and execution logic of the existing ClaudeProcess.

Usage example:
    from service.langgraph import ClaudeCLIChatModel

    # Create model with a new session
    model = ClaudeCLIChatModel(
        working_dir="/path/to/project",
        model_name="claude-sonnet-4-20250514"
    )
    await model.initialize()  # Session initialization is required

    # Use an existing ClaudeProcess session
    model = ClaudeCLIChatModel.from_process(existing_process)

    # Use as a LangGraph Agent
    from langgraph.prebuilt import create_react_agent
    agent = create_react_agent(model, tools=[])
"""

import asyncio
import json
from logging import getLogger
from typing import Any, Callable, Dict, List, Optional, Sequence, Union, AsyncIterator

from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.messages import (
    AIMessage,
    BaseMessage,
    HumanMessage,
    SystemMessage,
    ToolMessage,
    AIMessageChunk,
)
from langchain_core.outputs import ChatGeneration, ChatResult, ChatGenerationChunk
from langchain_core.callbacks.manager import (
    CallbackManagerForLLMRun,
    AsyncCallbackManagerForLLMRun,
)
from langchain_core.tools import BaseTool
from langchain_core.runnables import Runnable, RunnablePassthrough, RunnableLambda
from langchain_core.utils.function_calling import convert_to_openai_tool
from pydantic import BaseModel, Field, PrivateAttr

from service.claude_manager.process_manager import ClaudeProcess
from service.claude_manager.models import MCPConfig
from service.claude_manager.constants import CLAUDE_DEFAULT_TIMEOUT

logger = getLogger(__name__)


class ClaudeCLIChatModel(BaseChatModel):
    """
    Wraps Claude CLI as a LangChain ChatModel.

    Internally uses ClaudeProcess to manage CLI sessions.
    Leverages all ClaudeProcess features (MCP integration, file management, session persistence) as-is.

    Key features:
    - CLI invocation via ClaudeProcess.execute()
    - Maintains conversation context with CLI's --resume option
    - CLI MCP server integration (.mcp.json)
    - CLI filesystem access
    - LangGraph state management and checkpointing support

    Usage:
    ```python
    # Create a new session
    model = ClaudeCLIChatModel(
        working_dir="/path/to/project",
        model_name="claude-sonnet-4-20250514"
    )
    await model.initialize()  # Session initialization is required

    # Direct invocation
    response = await model.ainvoke([HumanMessage(content="Hello")])

    # Use an existing ClaudeProcess
    model = ClaudeCLIChatModel.from_process(existing_process)

    # Use with LangGraph
    from langgraph.prebuilt import create_react_agent
    agent = create_react_agent(model, tools=[])
    ```
    """

    # === Pydantic Configuration Fields ===
    session_id: Optional[str] = Field(
        default=None,
        description="Session ID (auto-generated if not provided)"
    )
    session_name: Optional[str] = Field(
        default=None,
        description="Human-readable session name"
    )
    working_dir: Optional[str] = Field(
        default=None,
        description="Working directory for CLI execution (None = use session storage path)"
    )
    model_name: Optional[str] = Field(
        default=None,
        description="Claude model to use (e.g., claude-sonnet-4-20250514)"
    )
    max_turns: int = Field(
        default=100,
        description="Maximum turns per execution"
    )
    timeout: float = Field(
        default=CLAUDE_DEFAULT_TIMEOUT,
        description="Execution timeout in seconds"
    )
    system_prompt: Optional[str] = Field(
        default=None,
        description="System prompt to append"
    )
    env_vars: Dict[str, str] = Field(
        default_factory=dict,
        description="Additional environment variables"
    )
    mcp_config: Optional[MCPConfig] = Field(
        default=None,
        description="MCP configuration for tool servers"
    )

    # === Private Attributes ===
    _process: Optional[ClaudeProcess] = PrivateAttr(default=None)
    _initialized: bool = PrivateAttr(default=False)

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self._process = None
        self._initialized = False

    @classmethod
    def from_process(cls, process: ClaudeProcess) -> "ClaudeCLIChatModel":
        """
        Create a model using an existing ClaudeProcess.

        Args:
            process: An initialized ClaudeProcess instance

        Returns:
            ClaudeCLIChatModel instance
        """
        model = cls(
            session_id=process.session_id,
            session_name=process.session_name,
            working_dir=process.working_dir,
            model_name=process.model,
            max_turns=process.max_turns,
            timeout=process.timeout,
            system_prompt=process.system_prompt,
            env_vars=process.env_vars or {},
            mcp_config=process.mcp_config,
        )
        model._process = process
        model._initialized = True
        return model

    @property
    def process(self) -> Optional[ClaudeProcess]:
        """Return the internal ClaudeProcess instance"""
        return self._process

    @property
    def is_initialized(self) -> bool:
        """Whether the session is initialized"""
        return self._initialized

    @property
    def _llm_type(self) -> str:
        return "claude-cli"

    @property
    def _identifying_params(self) -> Dict[str, Any]:
        return {
            "session_id": self.session_id or (self._process.session_id if self._process else None),
            "model_name": self.model_name,
            "working_dir": self.working_dir,
            "max_turns": self.max_turns,
        }

    async def initialize(self) -> bool:
        """
        Initialize the session.

        Creates and initializes a ClaudeProcess.
        If created via from_process(), it is already initialized.

        Returns:
            Whether initialization succeeded
        """
        if self._initialized and self._process:
            logger.info(f"Session already initialized: {self._process.session_id}")
            return True

        import uuid

        # Generate session ID
        session_id = self.session_id or str(uuid.uuid4())

        # Create ClaudeProcess
        self._process = ClaudeProcess(
            session_id=session_id,
            session_name=self.session_name,
            working_dir=self.working_dir,
            env_vars=self.env_vars,
            model=self.model_name,
            max_turns=self.max_turns,
            timeout=self.timeout,
            mcp_config=self.mcp_config,
            system_prompt=self.system_prompt,
        )

        # Run initialization
        success = await self._process.initialize()

        if success:
            self._initialized = True
            self.session_id = session_id
            logger.info(f"ClaudeCLIChatModel initialized: {session_id}")
        else:
            logger.error(f"Failed to initialize ClaudeCLIChatModel: {self._process.error_message}")

        return success

    async def cleanup(self):
        """
        Clean up the session.

        Stops the ClaudeProcess and releases resources.
        Storage is preserved (removed only on full deletion).
        """
        if self._process:
            await self._process.stop()
            self._process = None
            self._initialized = False
            logger.info(f"ClaudeCLIChatModel cleaned up: {self.session_id}")

    def _generate(
        self,
        messages: List[BaseMessage],
        stop: Optional[List[str]] = None,
        run_manager: Optional[CallbackManagerForLLMRun] = None,
        **kwargs: Any,
    ) -> ChatResult:
        """
        Synchronous generation method (required LangChain implementation).
        """
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                import concurrent.futures
                with concurrent.futures.ThreadPoolExecutor() as executor:
                    future = executor.submit(
                        asyncio.run,
                        self._agenerate(messages, stop, None, **kwargs)
                    )
                    return future.result()
            else:
                return loop.run_until_complete(
                    self._agenerate(messages, stop, None, **kwargs)
                )
        except RuntimeError:
            return asyncio.run(self._agenerate(messages, stop, None, **kwargs))

    async def _agenerate(
        self,
        messages: List[BaseMessage],
        stop: Optional[List[str]] = None,
        run_manager: Optional[AsyncCallbackManagerForLLMRun] = None,
        **kwargs: Any,
    ) -> ChatResult:
        """
        Asynchronous generation method.

        Calls ClaudeProcess.execute() to generate a response.
        """
        # Auto-initialize
        if not self._initialized:
            success = await self.initialize()
            if not success:
                error_msg = self._process.error_message if self._process else "Initialization failed"
                message = AIMessage(
                    content=f"Error: {error_msg}",
                    additional_kwargs={"error": True, "error_message": error_msg}
                )
                return ChatResult(generations=[ChatGeneration(message=message)])

        prompt = self._messages_to_prompt(messages)

        # Extract override parameters from kwargs
        system_prompt = kwargs.get("system_prompt", self.system_prompt)
        max_turns = kwargs.get("max_turns", self.max_turns)
        timeout = kwargs.get("timeout", self.timeout)
        resume = kwargs.get("resume")  # None means auto-determine

        # Call ClaudeProcess.execute()
        result = await self._process.execute(
            prompt=prompt,
            timeout=timeout,
            system_prompt=system_prompt,
            max_turns=max_turns,
            resume=resume,
        )

        if result.get("success"):
            content = result.get("output", "")

            additional_kwargs = {
                "execution_count": result.get("execution_count", 0),
                "duration_ms": result.get("duration_ms", 0),
                "session_id": self._process.session_id,
                "conversation_id": self._process._conversation_id,
                "cost_usd": result.get("cost_usd", 0.0),
            }

            message = AIMessage(
                content=content,
                additional_kwargs=additional_kwargs
            )
        else:
            error_msg = result.get("error", "Unknown error")
            message = AIMessage(
                content=f"Error: {error_msg}",
                additional_kwargs={
                    "error": True,
                    "error_message": error_msg,
                    "output": result.get("output", ""),
                }
            )

        generation = ChatGeneration(message=message)
        return ChatResult(generations=[generation])

    def _messages_to_prompt(self, messages: List[BaseMessage]) -> str:
        """
        Convert LangChain messages to a prompt string.

        On first execution or when resume is disabled, includes the full conversation.
        In resume mode, only the last HumanMessage is passed.
        """
        if not messages:
            return ""

        # If first execution, include the full conversation
        if self._process and self._process._execution_count == 0:
            parts = []
            for msg in messages:
                if isinstance(msg, SystemMessage):
                    parts.append(f"[System]: {msg.content}")
                elif isinstance(msg, HumanMessage):
                    parts.append(f"[User]: {msg.content}")
                elif isinstance(msg, AIMessage):
                    parts.append(f"[Assistant]: {msg.content}")
                elif isinstance(msg, ToolMessage):
                    parts.append(f"[Tool Result]: {msg.content}")
            return "\n\n".join(parts)

        # Resume mode: pass only the last HumanMessage
        for msg in reversed(messages):
            if isinstance(msg, HumanMessage):
                return str(msg.content)

        return str(messages[-1].content)

    # === Streaming Support ===

    async def _astream(
        self,
        messages: List[BaseMessage],
        stop: Optional[List[str]] = None,
        run_manager: Optional[AsyncCallbackManagerForLLMRun] = None,
        **kwargs: Any,
    ) -> AsyncIterator[ChatGenerationChunk]:
        """
        Asynchronous streaming generation.

        Currently receives the full response and returns it split into chunks.
        """
        result = await self._agenerate(messages, stop, run_manager, **kwargs)

        if result.generations:
            content = result.generations[0].message.content
            chunk_size = 100
            for i in range(0, len(content), chunk_size):
                chunk_content = content[i:i + chunk_size]
                chunk = ChatGenerationChunk(
                    message=AIMessageChunk(content=chunk_content)
                )
                yield chunk

    # === Tool Binding Support ===

    def bind_tools(
        self,
        tools: Sequence[Union[Dict[str, Any], type, Callable, BaseTool]],
        *,
        tool_choice: Optional[str] = None,
        **kwargs: Any,
    ) -> Runnable:
        """
        Bind tools to the model.

        Since Claude CLI uses its own tool processing system (MCP),
        this method adds tool definitions to the system prompt so
        the CLI can recognize the tools.

        Args:
            tools: List of tools to bind
            tool_choice: Tool selection mode (optional)
            **kwargs: Additional arguments

        Returns:
            Runnable with tools bound
        """
        # Convert tool definitions to JSON schema
        tool_descriptions = []
        for tool in tools:
            try:
                tool_schema = convert_to_openai_tool(tool)
                tool_descriptions.append(tool_schema)
            except Exception as e:
                logger.warning(f"Failed to convert tool: {e}")
                continue

        # Add tool descriptions to system prompt
        tools_prompt = self._format_tools_prompt(tool_descriptions)

        # Create new instance with updated system_prompt
        bound_model = ClaudeCLIChatModel(
            session_id=None,  # New session
            session_name=self.session_name,
            working_dir=self.working_dir,
            model_name=self.model_name,
            max_turns=self.max_turns,
            timeout=self.timeout,
            system_prompt=self._merge_system_prompt(tools_prompt),
            env_vars=self.env_vars,
            mcp_config=self.mcp_config,
        )

        return bound_model

    def _format_tools_prompt(self, tool_schemas: List[Dict]) -> str:
        """Convert tool schemas to prompt format"""
        if not tool_schemas:
            return ""

        lines = ["You have access to the following tools:"]
        for schema in tool_schemas:
            func = schema.get("function", {})
            name = func.get("name", "unknown")
            desc = func.get("description", "No description")
            params = func.get("parameters", {})

            lines.append(f"\n### {name}")
            lines.append(f"Description: {desc}")
            if params.get("properties"):
                lines.append("Parameters:")
                for pname, pdef in params["properties"].items():
                    ptype = pdef.get("type", "any")
                    pdesc = pdef.get("description", "")
                    lines.append(f"  - {pname} ({ptype}): {pdesc}")

        lines.append("\nWhen you need to use a tool, describe what you're doing and execute it.")
        return "\n".join(lines)

    def _merge_system_prompt(self, additional: str) -> str:
        """Merge system prompts"""
        if not additional:
            return self.system_prompt or ""
        if not self.system_prompt:
            return additional
        return f"{self.system_prompt}\n\n{additional}"

    def with_structured_output(
        self,
        schema: Union[Dict[str, Any], type],
        *,
        include_raw: bool = False,
        **kwargs: Any,
    ) -> Runnable:
        """
        Configure the model to produce structured output.

        Parses the Claude CLI response to match the specified schema.

        Args:
            schema: Pydantic model or JSON schema
            include_raw: Whether to include the raw response
            **kwargs: Additional arguments

        Returns:
            Runnable that produces structured output
        """
        # Extract schema information
        if isinstance(schema, type) and issubclass(schema, BaseModel):
            schema_json = schema.model_json_schema()
            schema_name = schema.__name__
        else:
            schema_json = schema
            schema_name = schema.get("title", "Response")

        # Add schema to prompt
        schema_prompt = f"""
Please respond with a JSON object that matches this schema:
```json
{json.dumps(schema_json, indent=2)}
```
Only output the JSON object, no additional text."""

        # Create new model with schema prompt
        structured_model = ClaudeCLIChatModel(
            session_id=None,
            session_name=self.session_name,
            working_dir=self.working_dir,
            model_name=self.model_name,
            max_turns=self.max_turns,
            timeout=self.timeout,
            system_prompt=self._merge_system_prompt(schema_prompt),
            env_vars=self.env_vars,
            mcp_config=self.mcp_config,
        )

        # Parsing function
        def parse_output(response: AIMessage) -> Union[Dict, BaseModel]:
            content = response.content
            # Attempt to extract JSON block
            if "```json" in content:
                start = content.find("```json") + 7
                end = content.find("```", start)
                if end > start:
                    content = content[start:end].strip()
            elif "```" in content:
                start = content.find("```") + 3
                end = content.find("```", start)
                if end > start:
                    content = content[start:end].strip()

            try:
                parsed = json.loads(content)
                if isinstance(schema, type) and issubclass(schema, BaseModel):
                    return schema.model_validate(parsed)
                return parsed
            except (json.JSONDecodeError, Exception) as e:
                logger.warning(f"Failed to parse structured output: {e}")
                return {"raw": response.content, "error": str(e)}

        if include_raw:
            def with_raw(response: AIMessage) -> Dict:
                return {
                    "raw": response,
                    "parsed": parse_output(response),
                }
            return structured_model | RunnableLambda(with_raw)
        else:
            return structured_model | RunnableLambda(parse_output)

    # === Utility Methods ===

    def get_storage_path(self) -> Optional[str]:
        """Return the session storage path"""
        return self._process.storage_path if self._process else None

    def list_storage_files(self, subpath: str = "") -> List[Dict]:
        """Return a list of files in session storage"""
        if self._process:
            return self._process.list_storage_files(subpath)
        return []

    def read_storage_file(self, filepath: str) -> Optional[str]:
        """Read the contents of a file in session storage"""
        if self._process:
            return self._process.read_storage_file(filepath)
        return None
