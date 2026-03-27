"""
Node i18n & Help Content — centralised Korean/English translations for all nodes.

Each built-in node type has:
  - Localised label, description
  - Localised parameter labels & descriptions
  - Localised output port labels
  - Localised group names
  - Detailed help guide with multiple sections

This module is imported by each node file to attach translations.
"""

from __future__ import annotations

from service.workflow.nodes.base import (
    HelpSection,
    NodeHelp,
    NodeI18n,
)


# ====================================================================
#  Helper — shorthand constructors
# ====================================================================

def _help(title: str, summary: str, sections: list[tuple[str, str]]) -> NodeHelp:
    return NodeHelp(
        title=title,
        summary=summary,
        sections=[HelpSection(t, c) for t, c in sections],
    )


# ====================================================================
#  MODEL NODES
# ====================================================================

LLM_CALL_I18N = {
    "en": NodeI18n(
        label="LLM Call",
        description="Universal LLM invocation node. Sends a configurable prompt template to the model with {field} state variable substitution. Supports conditional prompt switching, multiple output field mappings, and an optional completion flag. Can replicate most specialised model nodes through configuration alone.",
        parameters={
            "prompt_template": {
                "label": "Prompt Template",
                "description": (
                    "Prompt sent to the model. Use {field_name} for state variable substitution. "
                    "Available fields: input, answer, review_feedback, last_output, etc."
                ),
            },
            "conditional_field": {
                "label": "Conditional Prompt Field",
                "description": "State field to check for prompt switching. When set and condition is met, the Alternative Prompt is used.",
            },
            "conditional_check": {
                "label": "Conditional Check",
                "description": "How to evaluate the conditional field.",
            },
            "alternative_prompt": {
                "label": "Alternative Prompt",
                "description": "Prompt used when the conditional field check passes.",
            },
            "output_field": {
                "label": "Output State Field",
                "description": "State field to store the model response in.",
            },
            "output_mappings": {
                "label": "Additional Output Mappings (JSON)",
                "description": "Additional state fields to set from the response. Keys are field names, values are true to copy.",
            },
            "set_complete": {
                "label": "Mark Complete After",
                "description": "Set is_complete=True after execution.",
            },
        },
        output_ports={"default": {"label": "Next"}},
        groups={"prompt": "Prompt", "output": "Output"},
        help=_help(
            "LLM Call Node",
            "A generic LLM invocation node that sends a configurable prompt to the Claude model and stores the response.",
            [
                ("Overview", (
                    "The LLM Call node is the most fundamental model node. "
                    "It sends a prompt to Claude and stores the response in a configurable state field.\n\n"
                    "Use this node whenever you need a flexible, general-purpose model call "
                    "that doesn't fit into a specialised category like classification or review."
                )),
                ("Prompt Template", (
                    "The prompt template supports **state variable substitution** using `{field_name}` syntax.\n\n"
                    "**Available variables:**\n"
                    "- `{input}` — The original user request\n"
                    "- `{answer}` — The latest generated answer\n"
                    "- `{review_feedback}` — Feedback from a review node\n"
                    "- `{last_output}` — The most recent model output\n\n"
                    "**Example:**\n"
                    "```\nSummarise the following request:\n{input}\n```"
                )),
                ("Output Configuration", (
                    "- **Output State Field**: Choose which state field receives the model response. "
                    "Default is `last_output`. You can set it to `answer`, `final_answer`, or any custom field.\n"
                    "- **Mark Complete After**: When enabled, the workflow marks `is_complete=True` after this node runs, "
                    "which signals downstream gates and the executor to finish."
                )),
                ("Usage Tips", (
                    "1. Chain multiple LLM Call nodes for multi-step reasoning.\n"
                    "2. Use different `output_field` values to keep intermediate results separate.\n"
                    "3. Place a Context Guard before this node to prevent context overflow.\n"
                    "4. Place a Post Model node after to detect completion signals and record transcripts."
                )),
            ],
        ),
    ),
    "ko": NodeI18n(
        label="LLM Call",
        description="Universal LLM invocation node. Sends a configurable prompt template to the model with {field} state variable substitution. Supports conditional prompt switching, multiple output field mappings, and an optional completion flag. Can replicate most specialised model nodes through configuration alone.",
        parameters={
            "prompt_template": {
                "label": "Prompt Template",
                "description": (
                    "Prompt sent to the model. Use {field_name} for state variable substitution. "
                    "Available fields: input, answer, review_feedback, last_output, etc."
                ),
            },
            "conditional_field": {
                "label": "Conditional Prompt Field",
                "description": "State field to check for prompt switching. When set and condition is met, the Alternative Prompt is used.",
            },
            "conditional_check": {
                "label": "Conditional Check",
                "description": "How to evaluate the conditional field.",
            },
            "alternative_prompt": {
                "label": "Alternative Prompt",
                "description": "Prompt used when the conditional field check passes.",
            },
            "output_field": {
                "label": "Output State Field",
                "description": "State field to store the model response in.",
            },
            "output_mappings": {
                "label": "Additional Output Mappings (JSON)",
                "description": "Additional state fields to set from the response. Keys are field names, values are true to copy.",
            },
            "set_complete": {
                "label": "Mark Complete After",
                "description": "Set is_complete=True after execution.",
            },
        },
        output_ports={"default": {"label": "Next"}},
        groups={"prompt": "Prompt", "output": "Output"},
        help=_help(
            "LLM Call Node",
            "A generic LLM invocation node that sends a configurable prompt to the Claude model and stores the response.",
            [
                ("Overview", (
                    "The LLM Call node is the most fundamental model node. "
                    "It sends a prompt to Claude and stores the response in a configurable state field.\n\n"
                    "Use this node whenever you need a flexible, general-purpose model call "
                    "that doesn't fit into a specialised category like classification or review."
                )),
                ("Prompt Template", (
                    "The prompt template supports **state variable substitution** using `{field_name}` syntax.\n\n"
                    "**Available variables:**\n"
                    "- `{input}` — The original user request\n"
                    "- `{answer}` — The latest generated answer\n"
                    "- `{review_feedback}` — Feedback from a review node\n"
                    "- `{last_output}` — The most recent model output\n\n"
                    "**Example:**\n"
                    "```\nSummarise the following request:\n{input}\n```"
                )),
                ("Output Configuration", (
                    "- **Output State Field**: Choose which state field receives the model response. "
                    "Default is `last_output`. You can set it to `answer`, `final_answer`, or any custom field.\n"
                    "- **Mark Complete After**: When enabled, the workflow marks `is_complete=True` after this node runs, "
                    "which signals downstream gates and the executor to finish."
                )),
                ("Usage Tips", (
                    "1. Chain multiple LLM Call nodes for multi-step reasoning.\n"
                    "2. Use different `output_field` values to keep intermediate results separate.\n"
                    "3. Place a Context Guard before this node to prevent context overflow.\n"
                    "4. Place a Post Model node after to detect completion signals and record transcripts."
                )),
            ],
        ),
    ),
}

CLASSIFY_I18N = {
    "en": NodeI18n(
        label="Classify",
        description="General-purpose LLM classification node. Sends a prompt to the model, parses the response into a configured category, and routes execution directly through the matching output port. Default categories are easy/medium/hard but fully customizable to any set of labels.",
        parameters={
            "prompt_template": {
                "label": "Classification Prompt",
                "description": "Prompt sent to the model for classification. Use {input} for the user request.",
            },
            "categories": {
                "label": "Categories",
                "description": "Category names for classification (comma-separated). Each becomes an output port for routing.",
            },
            "default_category": {
                "label": "Default Category",
                "description": "Fallback category when the model response doesn't match any configured category.",
            },
            "output_field": {
                "label": "Output State Field",
                "description": "State field to store the classification result in.",
            },
        },
        output_ports={
            "easy": {"label": "Easy", "description": "Simple, direct tasks"},
            "medium": {"label": "Medium", "description": "Moderate complexity"},
            "hard": {"label": "Hard", "description": "Complex, multi-step tasks"},
            "end": {"label": "End", "description": "Error / early termination"},
        },
        groups={"prompt": "Prompt", "routing": "Routing", "output": "Output"},
        help=_help(
            "Classify Node",
            "Classifies input into configurable categories via LLM analysis and routes execution through the matching output port.",
            [
                ("Overview", (
                    "This is a **conditional model node** that acts as a decision hub. "
                    "It sends the user's input to the model with a classification prompt, "
                    "parses the response for category keywords, and routes execution "
                    "directly through the matching output port.\n\n"
                    "Default categories (easy/medium/hard) map to difficulty-based routing, "
                    "but you can configure **any set of categories** for any classification task:\n"
                    "- Sentiment: positive / negative / neutral\n"
                    "- Priority: low / medium / high / critical\n"
                    "- Type: question / request / complaint / feedback"
                )),
                ("How Classification Works", (
                    "1. The configured prompt is sent to the model (with `{input}` substitution).\n"
                    "2. A **JSON schema constraint** is automatically injected, requiring the model to respond with a structured ``ClassifyOutput`` object.\n"
                    "3. The response is parsed as JSON and validated against the Pydantic schema.\n"
                    "4. The ``classification`` field is coerced to match one of the configured categories (case-insensitive).\n"
                    "5. If JSON parsing fails, a **correction prompt** is sent automatically for one retry.\n"
                    "6. On error, execution routes to the **end** port.\n\n"
                    "The classification result is stored in the configured state field "
                    "(default: `difficulty`)."
                )),
                ("Customisation", (
                    "- **Categories**: Enter comma-separated category names (e.g. `low, medium, high, critical`). "
                    "Each category automatically becomes an output port.\n"
                    "- **Prompt**: Write a domain-specific prompt that asks the model "
                    "to respond with exactly one of your category names.\n"
                    "- **Output Field**: Store the result in any state field, not just `difficulty`.\n"
                    "- **Default**: Set which category to fall back to on ambiguous responses."
                )),
                ("Usage Tips", (
                    "1. Connect **all output ports** to valid downstream nodes (including 'end').\n"
                    "2. This node routes directly — no separate ConditionalRouter is needed.\n"
                    "3. Place a Context Guard before this node to check token budget.\n"
                    "4. Place Memory Inject before this node to provide context to the classifier."
                )),
            ],
        ),
    ),
    "ko": NodeI18n(
        label="Classify",
        description="General-purpose LLM classification node. Sends a prompt to the model, parses the response into a configured category, and routes execution directly through the matching output port. Default categories are easy/medium/hard but fully customizable to any set of labels.",
        parameters={
            "prompt_template": {
                "label": "Classification Prompt",
                "description": "Prompt sent to the model for classification. Use {input} for the user request.",
            },
            "categories": {
                "label": "Categories",
                "description": "Category names for classification (comma-separated). Each becomes an output port for routing.",
            },
            "default_category": {
                "label": "Default Category",
                "description": "Fallback category when the model response doesn't match any configured category.",
            },
            "output_field": {
                "label": "Output State Field",
                "description": "State field to store the classification result in.",
            },
        },
        output_ports={
            "easy": {"label": "Easy", "description": "Simple, direct tasks"},
            "medium": {"label": "Medium", "description": "Moderate complexity"},
            "hard": {"label": "Hard", "description": "Complex, multi-step tasks"},
            "end": {"label": "End", "description": "Error / early termination"},
        },
        groups={"prompt": "Prompt", "routing": "Routing", "output": "Output"},
        help=_help(
            "Classify Node",
            "Classifies input into configurable categories via LLM analysis and routes execution through the matching output port.",
            [
                ("Overview", (
                    "This is a **conditional model node** that acts as a decision hub. "
                    "It sends the user's input to the model with a classification prompt, "
                    "parses the response for category keywords, and routes execution "
                    "directly through the matching output port.\n\n"
                    "Default categories (easy/medium/hard) map to difficulty-based routing, "
                    "but you can configure **any set of categories** for any classification task:\n"
                    "- Sentiment: positive / negative / neutral\n"
                    "- Priority: low / medium / high / critical\n"
                    "- Type: question / request / complaint / feedback"
                )),
                ("How Classification Works", (
                    "1. The configured prompt is sent to the model (with `{input}` substitution).\n"
                    "2. A **JSON schema constraint** is automatically injected, requiring the model to respond with a structured ``ClassifyOutput`` object.\n"
                    "3. The response is parsed as JSON and validated against the Pydantic schema.\n"
                    "4. The ``classification`` field is coerced to match one of the configured categories (case-insensitive).\n"
                    "5. If JSON parsing fails, a **correction prompt** is sent automatically for one retry.\n"
                    "6. On error, execution routes to the **end** port.\n\n"
                    "The classification result is stored in the configured state field "
                    "(default: `difficulty`)."
                )),
                ("Customisation", (
                    "- **Categories**: Enter comma-separated category names (e.g. `low, medium, high, critical`). "
                    "Each category automatically becomes an output port.\n"
                    "- **Prompt**: Write a domain-specific prompt that asks the model "
                    "to respond with exactly one of your category names.\n"
                    "- **Output Field**: Store the result in any state field, not just `difficulty`.\n"
                    "- **Default**: Set which category to fall back to on ambiguous responses."
                )),
                ("Usage Tips", (
                    "1. Connect **all output ports** to valid downstream nodes (including 'end').\n"
                    "2. This node routes directly — no separate ConditionalRouter is needed.\n"
                    "3. Place a Context Guard before this node to check token budget.\n"
                    "4. Place Memory Inject before this node to provide context to the classifier."
                )),
            ],
        ),
    ),
}

# Backward‐compatibility alias
CLASSIFY_DIFFICULTY_I18N = CLASSIFY_I18N

DIRECT_ANSWER_I18N = {
    "en": NodeI18n(
        label="Direct Answer",
        description="Generates a single-shot direct answer without review. Best for easy tasks that need no quality checking. Writes the response to configurable output fields and can mark the workflow as complete.",
        parameters={
            "prompt_template": {
                "label": "Prompt Template",
                "description": "Prompt template. {input} is the user request.",
            },
            "output_fields": {
                "label": "Output Fields (JSON)",
                "description": "State fields to store the response in. Example: [\"answer\", \"final_answer\"]",
            },
            "mark_complete": {
                "label": "Mark Complete",
                "description": "Set is_complete=True after execution.",
            },
        },
        output_ports={"default": {"label": "Next"}},
        groups={"prompt": "Prompt", "output": "Output"},
        help=_help(
            "Direct Answer Node",
            "Generates a single-shot answer for simple tasks without review or iteration.",
            [
                ("Overview", (
                    "The Direct Answer node handles the **easy path** of the autonomous workflow. "
                    "It generates a single response and immediately marks the task as complete.\n\n"
                    "This is the fastest execution path — no review loop, no TODO decomposition. "
                    "Ideal for straightforward questions, lookups, and simple requests."
                )),
                ("Prompt Configuration", (
                    "The prompt template receives `{input}` — the user's original request.\n\n"
                    "Since there is no review step, make your prompt as clear and complete as possible. "
                    "Consider including output format instructions if needed.\n\n"
                    "**Example:**\n"
                    "```\nProvide a clear, concise answer:\n{input}\n```"
                )),
                ("State Updates", (
                    "After execution, this node sets:\n"
                    "- `answer` — the generated response\n"
                    "- `final_answer` — same as answer (since no review)\n"
                    "- `is_complete = True` — signals workflow completion\n"
                    "- `last_output` — the raw model response"
                )),
                ("Usage Tips", (
                    "1. Connect from the 'Easy' port of Classify Difficulty.\n"
                    "2. Follow with a Post Model node for transcript recording.\n"
                    "3. No need for a review loop — this path is designed for speed.\n"
                    "4. If quality is important, route to Medium path instead."
                )),
            ],
        ),
    ),
    "ko": NodeI18n(
        label="Direct Answer",
        description="Generates a single-shot direct answer without review. Best for easy tasks that need no quality checking. Writes the response to configurable output fields and can mark the workflow as complete.",
        parameters={
            "prompt_template": {
                "label": "Prompt Template",
                "description": "Prompt template. {input} is the user request.",
            },
            "output_fields": {
                "label": "Output Fields (JSON)",
                "description": "State fields to store the response in. Example: [\"answer\", \"final_answer\"]",
            },
            "mark_complete": {
                "label": "Mark Complete",
                "description": "Set is_complete=True after execution.",
            },
        },
        output_ports={"default": {"label": "Next"}},
        groups={"prompt": "Prompt", "output": "Output"},
        help=_help(
            "Direct Answer Node",
            "Generates a single-shot answer for simple tasks without review or iteration.",
            [
                ("Overview", (
                    "The Direct Answer node handles the **easy path** of the autonomous workflow. "
                    "It generates a single response and immediately marks the task as complete.\n\n"
                    "This is the fastest execution path — no review loop, no TODO decomposition. "
                    "Ideal for straightforward questions, lookups, and simple requests."
                )),
                ("Prompt Configuration", (
                    "The prompt template receives `{input}` — the user's original request.\n\n"
                    "Since there is no review step, make your prompt as clear and complete as possible. "
                    "Consider including output format instructions if needed.\n\n"
                    "**Example:**\n"
                    "```\nProvide a clear, concise answer:\n{input}\n```"
                )),
                ("State Updates", (
                    "After execution, this node sets:\n"
                    "- `answer` — the generated response\n"
                    "- `final_answer` — same as answer (since no review)\n"
                    "- `is_complete = True` — signals workflow completion\n"
                    "- `last_output` — the raw model response"
                )),
                ("Usage Tips", (
                    "1. Connect from the 'Easy' port of Classify Difficulty.\n"
                    "2. Follow with a Post Model node for transcript recording.\n"
                    "3. No need for a review loop — this path is designed for speed.\n"
                    "4. If quality is important, route to Medium path instead."
                )),
            ],
        ),
    ),
}

ANSWER_I18N = {
    "en": NodeI18n(
        label="Answer",
        description="Generates an answer with optional review feedback integration for iterative improvement. Automatically switches to the retry template with feedback context on retries. Budget-aware prompt compaction.",
        parameters={
            "prompt_template": {
                "label": "Prompt Template",
                "description": "Prompt for the initial answer.",
            },
            "retry_template": {
                "label": "Retry Prompt Template",
                "description": "Prompt template when retrying after review rejection.",
            },
            "feedback_field": {
                "label": "Feedback State Field",
                "description": "State field containing review feedback.",
            },
            "count_field": {
                "label": "Review Count State Field",
                "description": "State field tracking the number of review cycles.",
            },
            "output_fields": {
                "label": "Output Fields (JSON)",
                "description": "State fields to store the response in.",
            },
        },
        output_ports={"default": {"label": "Next"}},
        groups={"prompt": "Prompt", "state_fields": "State Fields", "output": "Output"},
        help=_help(
            "Answer Node",
            "Generates answers for medium-complexity tasks, incorporating review feedback on retries.",
            [
                ("Overview", (
                    "The Answer node handles the **medium path** of the autonomous workflow. "
                    "It generates an answer that can be reviewed and refined through a feedback loop.\n\n"
                    "On the first run, it uses the main prompt template. "
                    "On subsequent retries (after review rejection), it switches to the retry template "
                    "which includes the review feedback."
                )),
                ("Prompt Templates", (
                    "**Initial Prompt**: Used for the first answer attempt. Receives `{input}`.\n\n"
                    "**Retry Prompt**: Used when the review node rejects the answer. Receives:\n"
                    "- `{input_text}` — the original request\n"
                    "- `{previous_feedback}` — the review feedback\n\n"
                    "The retry template is automatically activated when `review_count > 0`."
                )),
                ("Review Integration", (
                    "This node is designed to work with the **Review** node:\n\n"
                    "1. Answer generates a response\n"
                    "2. Review evaluates the response\n"
                    "3. If rejected, Answer is called again with feedback\n"
                    "4. Cycle repeats until approved or max retries reached"
                )),
                ("Usage Tips", (
                    "1. Connect to the 'Medium' port of Classify Difficulty.\n"
                    "2. Follow with a Review node for quality assurance.\n"
                    "3. Loop the Review's 'Retry' port back to this node.\n"
                    "4. The answer is stored in the `answer` state field."
                )),
            ],
        ),
    ),
    "ko": NodeI18n(
        label="Answer",
        description="Generates an answer with optional review feedback integration for iterative improvement. Automatically switches to the retry template with feedback context on retries. Budget-aware prompt compaction.",
        parameters={
            "prompt_template": {
                "label": "Prompt Template",
                "description": "Prompt for the initial answer.",
            },
            "retry_template": {
                "label": "Retry Prompt Template",
                "description": "Prompt template when retrying after review rejection.",
            },
            "feedback_field": {
                "label": "Feedback State Field",
                "description": "State field containing review feedback.",
            },
            "count_field": {
                "label": "Review Count State Field",
                "description": "State field tracking the number of review cycles.",
            },
            "output_fields": {
                "label": "Output Fields (JSON)",
                "description": "State fields to store the response in.",
            },
        },
        output_ports={"default": {"label": "Next"}},
        groups={"prompt": "Prompt", "state_fields": "State Fields", "output": "Output"},
        help=_help(
            "Answer Node",
            "Generates answers for medium-complexity tasks, incorporating review feedback on retries.",
            [
                ("Overview", (
                    "The Answer node handles the **medium path** of the autonomous workflow. "
                    "It generates an answer that can be reviewed and refined through a feedback loop.\n\n"
                    "On the first run, it uses the main prompt template. "
                    "On subsequent retries (after review rejection), it switches to the retry template "
                    "which includes the review feedback."
                )),
                ("Prompt Templates", (
                    "**Initial Prompt**: Used for the first answer attempt. Receives `{input}`.\n\n"
                    "**Retry Prompt**: Used when the review node rejects the answer. Receives:\n"
                    "- `{input_text}` — the original request\n"
                    "- `{previous_feedback}` — the review feedback\n\n"
                    "The retry template is automatically activated when `review_count > 0`."
                )),
                ("Review Integration", (
                    "This node is designed to work with the **Review** node:\n\n"
                    "1. Answer generates a response\n"
                    "2. Review evaluates the response\n"
                    "3. If rejected, Answer is called again with feedback\n"
                    "4. Cycle repeats until approved or max retries reached"
                )),
                ("Usage Tips", (
                    "1. Connect to the 'Medium' port of Classify Difficulty.\n"
                    "2. Follow with a Review node for quality assurance.\n"
                    "3. Loop the Review's 'Retry' port back to this node.\n"
                    "4. The answer is stored in the `answer` state field."
                )),
            ],
        ),
    ),
}

REVIEW_I18N = {
    "en": NodeI18n(
        label="Review",
        description=(
            "Self-routing quality gate that reviews a generated answer via LLM "
            "and routes to a configurable set of verdict ports. "
            "Uses Pydantic-validated structured JSON output for reliable verdict and feedback parsing. "
            "Each configured verdict becomes an output port. "
            "Forces the first verdict after max retries to prevent infinite loops."
        ),
        parameters={
            "prompt_template": {
                "label": "Review Prompt",
                "description": "Prompt template for the quality review.",
            },
            "verdicts": {
                "label": "Verdicts (JSON)",
                "description": (
                    "List of verdict names the LLM may emit. Each becomes an output port. "
                    'Example: ["approved", "retry"] or ["pass", "minor_fix", "major_rewrite"]'
                ),
            },
            "default_verdict": {
                "label": "Default Verdict",
                "description": "Verdict to use when the model's response doesn't match any configured verdict.",
            },
            "output_field": {
                "label": "Output State Field",
                "description": "State field to store the matched verdict string.",
            },
            "max_retries": {
                "label": "Max Review Retries",
                "description": "Force the first verdict (typically 'approved') after this many review cycles.",
            },
            "answer_field": {
                "label": "Answer State Field",
                "description": "State field containing the answer to review.",
            },
            "count_field": {
                "label": "Review Count State Field",
                "description": "State field tracking the review cycle count.",
            },
        },
        output_ports={
            "approved": {"label": "Approved", "description": "Answer passed review"},
            "retry": {"label": "Retry", "description": "Answer needs improvement"},
            "end": {"label": "End", "description": "Error or early termination"},
        },
        groups={
            "prompt": "Prompt",
            "routing": "Routing",
            "behavior": "Behavior",
            "output": "Output",
            "state_fields": "State Fields",
        },
        help=_help(
            "Review Node",
            "Self-routing quality gate that reviews answers and routes by verdict — like Classify, each verdict becomes a port.",
            [
                ("Overview", (
                    "The Review node is a **self-routing conditional node** that evaluates the quality of a generated answer. "
                    "It sends the question and answer to the model for assessment, "
                    "then parses a structured JSON verdict/feedback response.\n\n"
                    "Like the Classify node, the **Verdicts** parameter uses ``generates_ports``: "
                    "each configured verdict becomes a named output port. "
                    "An additional **End** port is always present for errors.\n\n"
                    "**Default ports (with default verdicts):**\n"
                    "- **Approved** — answer meets quality standards\n"
                    "- **Retry** — answer needs improvement (feedback provided)\n"
                    "- **End** — error or early termination"
                )),
                ("Configurable Verdicts", (
                    "The **Verdicts** parameter accepts a JSON list of verdict names:\n\n"
                    '- Default: ``["approved", "retry"]``\n'
                    '- Custom: ``["pass", "minor_fix", "major_rewrite"]``\n\n'
                    "Each verdict becomes an output port. The structured output ensures the LLM's "
                    "``verdict`` field exactly matches one of the configured values. "
                    "If no match after coercion, the **Default Verdict** is used."
                )),
                ("Review Format", (
                    "The model is required to respond with a **structured JSON output** "
                    "containing ``verdict`` and ``feedback`` fields:\n\n"
                    '```json\n{"verdict": "approved", "feedback": "Good answer."}\n```\n\n'
                    "The node uses Pydantic schema validation to enforce the output format. "
                    "If the initial response fails validation, an automatic correction retry is attempted."
                )),
                ("Max Retries", (
                    "The **Max Review Retries** parameter prevents infinite review loops. "
                    "After this many cycles, the **first verdict** in the list "
                    "(typically 'approved') is forced regardless of model output.\n\n"
                    "Default: 3 cycles. Range: 1–10."
                )),
                ("Usage Tips", (
                    "1. Connect after an Answer node (optionally via a Guard).\n"
                    "2. Wire verdict ports directly — no separate router node needed.\n"
                    "3. Loop 'Retry' back to a Guard node to re-enter the answer loop.\n"
                    "4. Review feedback is stored in ``review_feedback`` state field.\n"
                    "5. Review cycle count is tracked in the configured Count Field."
                )),
            ],
        ),
    ),
    "ko": NodeI18n(
        label="Review",
        description=(
            "Self-routing quality gate that reviews a generated answer via LLM "
            "and routes to a configurable set of verdict ports. "
            "Uses Pydantic-validated structured JSON output for reliable verdict and feedback parsing. "
            "Each configured verdict becomes an output port. "
            "Forces the first verdict after max retries to prevent infinite loops."
        ),
        parameters={
            "prompt_template": {
                "label": "Review Prompt",
                "description": "Prompt template for the quality review.",
            },
            "verdicts": {
                "label": "Verdicts (JSON)",
                "description": (
                    "List of verdict names the LLM may emit. Each becomes an output port. "
                    'Example: ["approved", "retry"] or ["pass", "minor_fix", "major_rewrite"]'
                ),
            },
            "default_verdict": {
                "label": "Default Verdict",
                "description": "Verdict to use when the model's response doesn't match any configured verdict.",
            },
            "output_field": {
                "label": "Output State Field",
                "description": "State field to store the matched verdict string.",
            },
            "max_retries": {
                "label": "Max Review Retries",
                "description": "Force the first verdict (typically 'approved') after this many review cycles.",
            },
            "answer_field": {
                "label": "Answer State Field",
                "description": "State field containing the answer to review.",
            },
            "count_field": {
                "label": "Review Count State Field",
                "description": "State field tracking the review cycle count.",
            },
        },
        output_ports={
            "approved": {"label": "Approved", "description": "Answer passed review"},
            "retry": {"label": "Retry", "description": "Answer needs improvement"},
            "end": {"label": "End", "description": "Error or early termination"},
        },
        groups={
            "prompt": "Prompt",
            "routing": "Routing",
            "behavior": "Behavior",
            "parsing": "Parsing",
            "output": "Output",
            "state_fields": "State Fields",
        },
        help=_help(
            "Review Node",
            "Self-routing quality gate that reviews answers and routes by verdict — like Classify, each verdict becomes a port.",
            [
                ("Overview", (
                    "The Review node is a **self-routing conditional node** that evaluates the quality of a generated answer. "
                    "It sends the question and answer to the model for assessment, "
                    "then parses a structured JSON verdict/feedback response.\n\n"
                    "Like the Classify node, the **Verdicts** parameter uses ``generates_ports``: "
                    "each configured verdict becomes a named output port. "
                    "An additional **End** port is always present for errors.\n\n"
                    "**Default ports (with default verdicts):**\n"
                    "- **Approved** — answer meets quality standards\n"
                    "- **Retry** — answer needs improvement (feedback provided)\n"
                    "- **End** — error or early termination"
                )),
                ("Configurable Verdicts", (
                    "The **Verdicts** parameter accepts a JSON list of verdict names:\n\n"
                    '- Default: ``["approved", "retry"]``\n'
                    '- Custom: ``["pass", "minor_fix", "major_rewrite"]``\n\n'
                    "Each verdict becomes an output port. The structured output ensures the LLM's "
                    "``verdict`` field exactly matches one of the configured values. "
                    "If no match after coercion, the **Default Verdict** is used."
                )),
                ("Review Format", (
                    "The model is required to respond with a **structured JSON output** "
                    "containing ``verdict`` and ``feedback`` fields:\n\n"
                    '```json\n{"verdict": "approved", "feedback": "Good answer."}\n```\n\n'
                    "The node uses Pydantic schema validation to enforce the output format. "
                    "If the initial response fails validation, an automatic correction retry is attempted."
                )),
                ("Max Retries", (
                    "The **Max Review Retries** parameter prevents infinite review loops. "
                    "After this many cycles, the **first verdict** in the list "
                    "(typically 'approved') is forced regardless of model output.\n\n"
                    "Default: 3 cycles. Range: 1–10."
                )),
                ("Usage Tips", (
                    "1. Connect after an Answer node (optionally via a Guard).\n"
                    "2. Wire verdict ports directly — no separate router node needed.\n"
                    "3. Loop 'Retry' back to a Guard node to re-enter the answer loop.\n"
                    "4. Review feedback is stored in ``review_feedback`` state field.\n"
                    "5. Review cycle count is tracked in the configured Count Field."
                )),
            ],
        ),
    ),
}


# ====================================================================
#  LOGIC NODES
# ====================================================================

CONDITIONAL_ROUTER_I18N = {
    "en": NodeI18n(
        label="Conditional Router",
        description="Pure state-based routing node. Reads a specified state field and maps its value to output ports via a configurable JSON route map. Handles enums, strings, and other types with automatic normalization.",
        parameters={
            "routing_field": {
                "label": "Routing State Field",
                "description": "Name of the state field to read for routing decisions.",
            },
            "route_map": {
                "label": "Route Mapping (JSON)",
                "description": (
                    "JSON object mapping field values to output port IDs. "
                    'Example: {"value1": "port_a", "value2": "port_b"}'
                ),
            },
            "default_port": {
                "label": "Default Port",
                "description": "Port to use when the field value doesn't match any route.",
            },
        },
        output_ports={"default": {"label": "Default", "description": "Fallback route"}},
        groups={"routing": "Routing"},
        help=_help(
            "Conditional Router Node",
            "A flexible routing node that reads a state field and routes to different output ports based on its value.",
            [
                ("Overview", (
                    "The Conditional Router is a **generic branching node** for building custom control flow. "
                    "It reads a configurable state field and maps its value to one of several output ports.\n\n"
                    "Unlike specialised conditional nodes (Classify Difficulty, Review), this router "
                    "lets you define your own routing logic for any state field."
                )),
                ("Route Mapping", (
                    "Define the routing rules as a JSON object:\n\n"
                    "```json\n{\n  \"easy\": \"simple_path\",\n  \"medium\": \"standard_path\",\n  \"hard\": \"complex_path\"\n}\n```\n\n"
                    "**Keys** are the possible values of the routing field.\n"
                    "**Values** are the output port IDs to route to.\n\n"
                    "Output ports are automatically generated from the route map values."
                )),
                ("Default Port", (
                    "When the state field value doesn't match any route in the map, "
                    "execution is sent to the **Default Port**.\n\n"
                    "Always ensure the default port connects to a valid node to prevent dead ends."
                )),
                ("Usage Tips", (
                    "1. Use for custom branching beyond the built-in difficulty classification.\n"
                    "2. The routing field can be any state field (e.g., `difficulty`, `status`, custom fields).\n"
                    "3. Enum values are automatically converted to their string representation.\n"
                    "4. All comparisons are case-insensitive."
                )),
            ],
        ),
    ),
    "ko": NodeI18n(
        label="Conditional Router",
        description="Pure state-based routing node. Reads a specified state field and maps its value to output ports via a configurable JSON route map. Handles enums, strings, and other types with automatic normalization.",
        parameters={
            "routing_field": {
                "label": "Routing State Field",
                "description": "Name of the state field to read for routing decisions.",
            },
            "route_map": {
                "label": "Route Mapping (JSON)",
                "description": (
                    "JSON object mapping field values to output port IDs. "
                    'Example: {"value1": "port_a", "value2": "port_b"}'
                ),
            },
            "default_port": {
                "label": "Default Port",
                "description": "Port to use when the field value doesn't match any route.",
            },
        },
        output_ports={"default": {"label": "Default", "description": "Fallback route"}},
        groups={"routing": "Routing"},
        help=_help(
            "Conditional Router Node",
            "A flexible routing node that reads a state field and routes to different output ports based on its value.",
            [
                ("Overview", (
                    "The Conditional Router is a **generic branching node** for building custom control flow. "
                    "It reads a configurable state field and maps its value to one of several output ports.\n\n"
                    "Unlike specialised conditional nodes (Classify Difficulty, Review), this router "
                    "lets you define your own routing logic for any state field."
                )),
                ("Route Mapping", (
                    "Define the routing rules as a JSON object:\n\n"
                    "```json\n{\n  \"easy\": \"simple_path\",\n  \"medium\": \"standard_path\",\n  \"hard\": \"complex_path\"\n}\n```\n\n"
                    "**Keys** are the possible values of the routing field.\n"
                    "**Values** are the output port IDs to route to.\n\n"
                    "Output ports are automatically generated from the route map values."
                )),
                ("Default Port", (
                    "When the state field value doesn't match any route in the map, "
                    "execution is sent to the **Default Port**.\n\n"
                    "Always ensure the default port connects to a valid node to prevent dead ends."
                )),
                ("Usage Tips", (
                    "1. Use for custom branching beyond the built-in difficulty classification.\n"
                    "2. The routing field can be any state field (e.g., `difficulty`, `status`, custom fields).\n"
                    "3. Enum values are automatically converted to their string representation.\n"
                    "4. All comparisons are case-insensitive."
                )),
            ],
        ),
    ),
}

ITERATION_GATE_I18N = {
    "en": NodeI18n(
        label="Iteration Gate",
        description="Loop prevention guard that checks multiple stop conditions: iteration count, context budget, completion signals, and an optional custom field. Sets is_complete=True when any limit is exceeded.",
        parameters={
            "max_iterations_override": {
                "label": "Max Iterations Override",
                "description": "Override the global max iterations. 0 = use default.",
            },
            "check_iteration": {
                "label": "Check Iteration Limit",
                "description": "Enable checking against the iteration counter.",
            },
            "check_budget": {
                "label": "Check Context Budget",
                "description": "Enable checking context window budget status.",
            },
            "check_completion": {
                "label": "Check Completion Signals",
                "description": "Enable checking for structured completion signals.",
            },
            "custom_stop_field": {
                "label": "Custom Stop Field",
                "description": "Additional state field to check. If truthy, the gate will stop. Leave empty to disable.",
            },
        },
        output_ports={
            "continue": {"label": "Continue", "description": "Loop can proceed"},
            "stop": {"label": "Stop", "description": "Limit exceeded, exit loop"},
        },
        groups={"behavior": "Behavior", "checks": "Checks"},
        help=_help(
            "Iteration Gate Node",
            "Safety gate that prevents infinite loops by checking iteration count, context budget, and completion signals.",
            [
                ("Overview", (
                    "The Iteration Gate is a critical **safety node** that prevents runaway execution. "
                    "It checks three conditions:\n\n"
                    "1. **Iteration limit** — has the loop exceeded the maximum allowed iterations?\n"
                    "2. **Context budget** — is the context window overflowing or blocked?\n"
                    "3. **Completion signal** — did a previous node signal completion?\n\n"
                    "If any condition triggers, execution routes to the **Stop** port."
                )),
                ("Iteration Tracking", (
                    "Each loop iteration increments the `iteration` state counter. "
                    "The gate compares this against the configured maximum.\n\n"
                    "- **Override = 0**: Uses the global `max_iterations` from state (default: 50)\n"
                    "- **Override > 0**: Uses the override value instead"
                )),
                ("Context Budget Check", (
                    "The gate reads `context_budget.status` from state. "
                    "If the status is `block` or `overflow`, the loop is stopped to prevent errors.\n\n"
                    "This works in conjunction with the Context Guard node."
                )),
                ("Usage Tips", (
                    "1. Place at the start of any loop to prevent infinite execution.\n"
                    "2. Essential in the hard path where TODO execution loops.\n"
                    "3. The 'Stop' port should connect to an end or synthesis node.\n"
                    "4. The 'Continue' port continues the loop."
                )),
            ],
        ),
    ),
    "ko": NodeI18n(
        label="Iteration Gate",
        description="Loop prevention guard that checks multiple stop conditions: iteration count, context budget, completion signals, and an optional custom field. Sets is_complete=True when any limit is exceeded.",
        parameters={
            "max_iterations_override": {
                "label": "Max Iterations Override",
                "description": "Override the global max iterations. 0 = use default.",
            },
            "check_iteration": {
                "label": "Check Iteration Limit",
                "description": "Enable checking against the iteration counter.",
            },
            "check_budget": {
                "label": "Check Context Budget",
                "description": "Enable checking context window budget status.",
            },
            "check_completion": {
                "label": "Check Completion Signals",
                "description": "Enable checking for structured completion signals.",
            },
            "custom_stop_field": {
                "label": "Custom Stop Field",
                "description": "Additional state field to check. If truthy, the gate will stop. Leave empty to disable.",
            },
        },
        output_ports={
            "continue": {"label": "Continue", "description": "Loop can proceed"},
            "stop": {"label": "Stop", "description": "Limit exceeded, exit loop"},
        },
        groups={"behavior": "Behavior", "checks": "Checks"},
        help=_help(
            "Iteration Gate Node",
            "Safety gate that prevents infinite loops by checking iteration count, context budget, and completion signals.",
            [
                ("Overview", (
                    "The Iteration Gate is a critical **safety node** that prevents runaway execution. "
                    "It checks three conditions:\n\n"
                    "1. **Iteration limit** — has the loop exceeded the maximum allowed iterations?\n"
                    "2. **Context budget** — is the context window overflowing or blocked?\n"
                    "3. **Completion signal** — did a previous node signal completion?\n\n"
                    "If any condition triggers, execution routes to the **Stop** port."
                )),
                ("Iteration Tracking", (
                    "Each loop iteration increments the `iteration` state counter. "
                    "The gate compares this against the configured maximum.\n\n"
                    "- **Override = 0**: Uses the global `max_iterations` from state (default: 50)\n"
                    "- **Override > 0**: Uses the override value instead"
                )),
                ("Context Budget Check", (
                    "The gate reads `context_budget.status` from state. "
                    "If the status is `block` or `overflow`, the loop is stopped to prevent errors.\n\n"
                    "This works in conjunction with the Context Guard node."
                )),
                ("Usage Tips", (
                    "1. Place at the start of any loop to prevent infinite execution.\n"
                    "2. Essential in the hard path where TODO execution loops.\n"
                    "3. The 'Stop' port should connect to an end or synthesis node.\n"
                    "4. The 'Continue' port continues the loop."
                )),
            ],
        ),
    ),
}

CHECK_PROGRESS_I18N = {
    "en": NodeI18n(
        label="Check Progress",
        description="Checks completion progress of a configurable list field. Routes to 'continue' when items remain or 'complete' when all items are processed. Respects completion signals and error flags.",
        parameters={
            "list_field": {
                "label": "List State Field",
                "description": "State field containing the list to check progress on.",
            },
            "index_field": {
                "label": "Index State Field",
                "description": "State field tracking the current index in the list.",
            },
            "completed_status": {
                "label": "Completed Status Value",
                "description": "Status value that counts an item as completed.",
            },
            "failed_status": {
                "label": "Failed Status Value",
                "description": "Status value that counts an item as failed.",
            },
        },
        output_ports={
            "continue": {"label": "Continue", "description": "More TODOs remaining"},
            "complete": {"label": "Complete", "description": "All TODOs done"},
        },
        groups={"state_fields": "State Fields", "behavior": "Behavior"},
        help=_help(
            "Check Progress Node",
            "Checks TODO list completion and routes to continue or complete.",
            [
                ("Overview", (
                    "The Check Progress node is a **conditional node** used in the hard path "
                    "to track TODO list completion. It examines the TODO list state "
                    "and determines whether there are more items to execute.\n\n"
                    "**Routes:**\n"
                    "- **Continue** — more TODO items remain\n"
                    "- **Complete** — all TODOs are done (or a completion signal was received)"
                )),
                ("Progress Tracking", (
                    "The node reads:\n"
                    "- `current_todo_index` — which TODO is next\n"
                    "- `todos` — the full TODO list\n"
                    "- `completion_signal` — any external completion signal\n\n"
                    "It also records progress metrics in the `metadata` state field."
                )),
                ("Usage Tips", (
                    "1. Place after Execute TODO and its Post Model node.\n"
                    "2. Loop 'Continue' back to the Execute TODO sequence.\n"
                    "3. Connect 'Complete' to Final Review or Final Answer.\n"
                    "4. No parameters needed — works entirely from state."
                )),
            ],
        ),
    ),
    "ko": NodeI18n(
        label="Check Progress",
        description="Checks completion progress of a configurable list field. Routes to 'continue' when items remain or 'complete' when all items are processed. Respects completion signals and error flags.",
        parameters={
            "list_field": {
                "label": "List State Field",
                "description": "State field containing the list to check progress on.",
            },
            "index_field": {
                "label": "Index State Field",
                "description": "State field tracking the current index in the list.",
            },
            "completed_status": {
                "label": "Completed Status Value",
                "description": "Status value that counts an item as completed.",
            },
            "failed_status": {
                "label": "Failed Status Value",
                "description": "Status value that counts an item as failed.",
            },
        },
        output_ports={
            "continue": {"label": "Continue", "description": "More TODOs remaining"},
            "complete": {"label": "Complete", "description": "All TODOs done"},
        },
        groups={"state_fields": "State Fields", "behavior": "Behavior"},
        help=_help(
            "Check Progress Node",
            "Checks TODO list completion and routes to continue or complete.",
            [
                ("Overview", (
                    "The Check Progress node is a **conditional node** used in the hard path "
                    "to track TODO list completion. It examines the TODO list state "
                    "and determines whether there are more items to execute.\n\n"
                    "**Routes:**\n"
                    "- **Continue** — more TODO items remain\n"
                    "- **Complete** — all TODOs are done (or a completion signal was received)"
                )),
                ("Progress Tracking", (
                    "The node reads:\n"
                    "- `current_todo_index` — which TODO is next\n"
                    "- `todos` — the full TODO list\n"
                    "- `completion_signal` — any external completion signal\n\n"
                    "It also records progress metrics in the `metadata` state field."
                )),
                ("Usage Tips", (
                    "1. Place after Execute TODO and its Post Model node.\n"
                    "2. Loop 'Continue' back to the Execute TODO sequence.\n"
                    "3. Connect 'Complete' to Final Review or Final Answer.\n"
                    "4. No parameters needed — works entirely from state."
                )),
            ],
        ),
    ),
}

STATE_SETTER_I18N = {
    "en": NodeI18n(
        label="State Setter",
        description="Directly manipulates state fields by setting them to configured JSON values. Useful for initializing state, resetting counters, or injecting static configuration.",
        parameters={
            "state_updates": {
                "label": "State Updates (JSON)",
                "description": 'JSON object of state field updates. Example: {"is_complete": true, "review_count": 0}',
            },
        },
        output_ports={"default": {"label": "Next"}},
        groups={"general": "General"},
        help=_help(
            "State Setter Node",
            "Directly manipulates state fields by setting them to configured values.",
            [
                ("Overview", (
                    "The State Setter is a utility node that sets specific state fields "
                    "to configured values. It doesn't involve the model — it's a pure "
                    "state manipulation node.\n\n"
                    "Useful for initialising state, resetting counters, or setting flags."
                )),
                ("State Updates JSON", (
                    "Provide a JSON object where each key is a state field name "
                    "and each value is what to set it to:\n\n"
                    "```json\n{\n  \"is_complete\": true,\n  \"review_count\": 0,\n  \"current_step\": \"reset\"\n}\n```\n\n"
                    "Supported value types: string, number, boolean, null, arrays, objects."
                )),
                ("Usage Tips", (
                    "1. Use at the start of a workflow to initialise state.\n"
                    "2. Use before a loop to reset counters.\n"
                    "3. Use to set `is_complete = true` to force workflow completion.\n"
                    "4. Any valid JSON object will be merged into the state."
                )),
            ],
        ),
    ),
    "ko": NodeI18n(
        label="State Setter",
        description="Directly manipulates state fields by setting them to configured JSON values. Useful for initializing state, resetting counters, or injecting static configuration.",
        parameters={
            "state_updates": {
                "label": "State Updates (JSON)",
                "description": 'JSON object of state field updates. Example: {"is_complete": true, "review_count": 0}',
            },
        },
        output_ports={"default": {"label": "Next"}},
        groups={"general": "General"},
        help=_help(
            "State Setter Node",
            "Directly manipulates state fields by setting them to configured values.",
            [
                ("Overview", (
                    "The State Setter is a utility node that sets specific state fields "
                    "to configured values. It doesn't involve the model — it's a pure "
                    "state manipulation node.\n\n"
                    "Useful for initialising state, resetting counters, or setting flags."
                )),
                ("State Updates JSON", (
                    "Provide a JSON object where each key is a state field name "
                    "and each value is what to set it to:\n\n"
                    "```json\n{\n  \"is_complete\": true,\n  \"review_count\": 0,\n  \"current_step\": \"reset\"\n}\n```\n\n"
                    "Supported value types: string, number, boolean, null, arrays, objects."
                )),
                ("Usage Tips", (
                    "1. Use at the start of a workflow to initialise state.\n"
                    "2. Use before a loop to reset counters.\n"
                    "3. Use to set `is_complete = true` to force workflow completion.\n"
                    "4. Any valid JSON object will be merged into the state."
                )),
            ],
        ),
    ),
}


# ====================================================================
#  MEMORY NODES
# ====================================================================

MEMORY_INJECT_I18N = {
    "en": NodeI18n(
        label="Memory Inject",
        description="LLM-gated memory injection. The LLM decides whether the input needs long-term memory context. When activated, performs vector semantic search and keyword search, then injects both memory_refs (metadata) and memory_context (formatted text) into state.",
        parameters={
            "max_results": {
                "label": "Max Memory Results",
                "description": "Maximum number of memory chunks to load per search type.",
            },
            "search_chars": {
                "label": "Search Input Length",
                "description": "Character limit of input text used for memory search.",
            },
            "max_inject_chars": {
                "label": "Max Inject Characters",
                "description": "Maximum total characters of memory context to inject into state.",
            },
            "enable_llm_gate": {
                "label": "Enable LLM Gate",
                "description": "Use the LLM to decide whether memory retrieval is needed. When disabled, memory is always retrieved for non-empty inputs.",
            },
            "enable_vector_search": {
                "label": "Enable Vector Search",
                "description": "Enable FAISS vector semantic search. When disabled, only keyword search is used.",
            },
            "search_field": {
                "label": "Search Source Field",
                "description": "State field whose value is used as the memory search query.",
            },
        },
        output_ports={"default": {"label": "Next"}},
        groups={"behavior": "Behavior", "state_fields": "State Fields"},
        help=_help(
            "Memory Inject Node",
            "LLM-gated memory injection — the model itself decides whether long-term memory retrieval is needed.",
            [
                ("Overview", (
                    "The Memory Inject node connects the workflow to the session's **long-term and short-term memory**. "
                    "Instead of hardcoded rules, the **LLM itself** decides whether the input warrants "
                    "memory retrieval via a lightweight structured-output call.\n\n"
                    "When activated, it loads both structured metadata (`memory_refs`) and formatted context text "
                    "(`memory_context`) into state. Downstream model nodes can reference `{memory_context}` "
                    "in their prompt templates for automatic injection."
                )),
                ("LLM Gate", (
                    "The node asks the LLM: *\"Does this input need long-term memory context?\"*\n\n"
                    "The LLM considers:\n"
                    "- Whether the input references past work or prior context\n"
                    "- Whether the task is complex enough to benefit from memory\n"
                    "- Whether it's a trivial greeting/acknowledgment that needs no context\n\n"
                    "If the gate fails (e.g., model error), memory is retrieved as a safe default. "
                    "Disable the gate to always retrieve memory for every input."
                )),
                ("Memory Retrieval Pipeline", (
                    "When the LLM gate approves retrieval, the node runs a multi-stage pipeline:\n\n"
                    "1. **Session Summary** — Latest short-term memory state\n"
                    "2. **MEMORY.md** — Persistent long-term notes\n"
                    "3. **Vector Search** — FAISS semantic similarity search (if enabled)\n"
                    "4. **Keyword Search** — Traditional keyword-based recall\n\n"
                    "Results are combined within the character budget (`max_inject_chars`)."
                )),
                ("Usage Tips", (
                    "1. Place at the very beginning of the workflow, right after Start.\n"
                    "2. The memory manager must be configured for the session.\n"
                    "3. Use `{memory_context}` in downstream prompt templates to inject the retrieved context.\n"
                    "4. Increase max_results for tasks that benefit from richer context.\n"
                    "5. Disable vector search if the embedding model is not configured.\n"
                    "6. Disable the LLM gate to always retrieve memory (useful for debugging)."
                )),
            ],
        ),
    ),
    "ko": NodeI18n(
        label="Memory Inject",
        description="LLM-gated memory injection. The LLM decides whether the input needs long-term memory context. When activated, performs vector semantic search and keyword search, then injects both memory_refs (metadata) and memory_context (formatted text) into state.",
        parameters={
            "max_results": {
                "label": "Max Memory Results",
                "description": "Maximum number of memory chunks to load per search type.",
            },
            "search_chars": {
                "label": "Search Input Length",
                "description": "Character limit of input text used for memory search.",
            },
            "max_inject_chars": {
                "label": "Max Inject Characters",
                "description": "Maximum total characters of memory context to inject into state.",
            },
            "enable_llm_gate": {
                "label": "Enable LLM Gate",
                "description": "Use the LLM to decide whether memory retrieval is needed. When disabled, memory is always retrieved for non-empty inputs.",
            },
            "enable_vector_search": {
                "label": "Enable Vector Search",
                "description": "Enable FAISS vector semantic search. When disabled, only keyword search is used.",
            },
            "search_field": {
                "label": "Search Source Field",
                "description": "State field whose value is used as the memory search query.",
            },
        },
        output_ports={"default": {"label": "Next"}},
        groups={"behavior": "Behavior", "state_fields": "State Fields"},
        help=_help(
            "Memory Inject Node",
            "LLM-gated memory injection — the model itself decides whether long-term memory retrieval is needed.",
            [
                ("Overview", (
                    "The Memory Inject node connects the workflow to the session's **long-term and short-term memory**. "
                    "Instead of hardcoded rules, the **LLM itself** decides whether the input warrants "
                    "memory retrieval via a lightweight structured-output call.\n\n"
                    "When activated, it loads both structured metadata (`memory_refs`) and formatted context text "
                    "(`memory_context`) into state. Downstream model nodes can reference `{memory_context}` "
                    "in their prompt templates for automatic injection."
                )),
                ("LLM Gate", (
                    "The node asks the LLM: *\"Does this input need long-term memory context?\"*\n\n"
                    "The LLM considers:\n"
                    "- Whether the input references past work or prior context\n"
                    "- Whether the task is complex enough to benefit from memory\n"
                    "- Whether it's a trivial greeting/acknowledgment that needs no context\n\n"
                    "If the gate fails (e.g., model error), memory is retrieved as a safe default. "
                    "Disable the gate to always retrieve memory for every input."
                )),
                ("Memory Retrieval Pipeline", (
                    "When the LLM gate approves retrieval, the node runs a multi-stage pipeline:\n\n"
                    "1. **Session Summary** — Latest short-term memory state\n"
                    "2. **MEMORY.md** — Persistent long-term notes\n"
                    "3. **Vector Search** — FAISS semantic similarity search (if enabled)\n"
                    "4. **Keyword Search** — Traditional keyword-based recall\n\n"
                    "Results are combined within the character budget (`max_inject_chars`)."
                )),
                ("Usage Tips", (
                    "1. Place at the very beginning of the workflow, right after Start.\n"
                    "2. The memory manager must be configured for the session.\n"
                    "3. Use `{memory_context}` in downstream prompt templates to inject the retrieved context.\n"
                    "4. Increase max_results for tasks that benefit from richer context.\n"
                    "5. Disable vector search if the embedding model is not configured.\n"
                    "6. Disable the LLM gate to always retrieve memory (useful for debugging)."
                )),
            ],
        ),
    ),
}

TRANSCRIPT_RECORD_I18N = {
    "en": NodeI18n(
        label="Transcript Record",
        description="Records a state field's content to the short-term memory transcript with a configurable message role. Use for explicit transcript control when PostModel's built-in recording is insufficient.",
        parameters={
            "max_length": {
                "label": "Max Content Length",
                "description": "Maximum characters to record from the output.",
            },
            "source_field": {
                "label": "Source State Field",
                "description": "State field whose content is recorded to the transcript.",
            },
            "role": {
                "label": "Message Role",
                "description": "Role label for the transcript entry.",
            },
        },
        output_ports={"default": {"label": "Next"}},
        groups={"behavior": "Behavior", "state_fields": "State Fields"},
        help=_help(
            "Transcript Record Node",
            "Records the latest model output to the session's short-term memory transcript.",
            [
                ("Overview", (
                    "The Transcript Record node saves the latest model output to the session's "
                    "short-term memory. This builds up a conversation history that can be used "
                    "by Memory Inject in future turns.\n\n"
                    "This is a standalone node version of the transcript recording "
                    "that Post Model does automatically."
                )),
                ("Content Length", (
                    "The **Max Content Length** parameter limits how many characters are recorded.\n\n"
                    "Default: 5000 characters. For long outputs, only the first N characters are saved. "
                    "Increase this for tasks that produce detailed, important outputs."
                )),
                ("Usage Tips", (
                    "1. Use when you want explicit transcript recording without Post Model.\n"
                    "2. Place after any model node to record its output.\n"
                    "3. The memory manager must be configured for the session.\n"
                    "4. If no memory manager is present, the node silently does nothing."
                )),
            ],
        ),
    ),
    "ko": NodeI18n(
        label="Transcript Record",
        description="Records a state field's content to the short-term memory transcript with a configurable message role. Use for explicit transcript control when PostModel's built-in recording is insufficient.",
        parameters={
            "max_length": {
                "label": "Max Content Length",
                "description": "Maximum characters to record from the output.",
            },
            "source_field": {
                "label": "Source State Field",
                "description": "State field whose content is recorded to the transcript.",
            },
            "role": {
                "label": "Message Role",
                "description": "Role label for the transcript entry.",
            },
        },
        output_ports={"default": {"label": "Next"}},
        groups={"behavior": "Behavior", "state_fields": "State Fields"},
        help=_help(
            "Transcript Record Node",
            "Records the latest model output to the session's short-term memory transcript.",
            [
                ("Overview", (
                    "The Transcript Record node saves the latest model output to the session's "
                    "short-term memory. This builds up a conversation history that can be used "
                    "by Memory Inject in future turns.\n\n"
                    "This is a standalone node version of the transcript recording "
                    "that Post Model does automatically."
                )),
                ("Content Length", (
                    "The **Max Content Length** parameter limits how many characters are recorded.\n\n"
                    "Default: 5000 characters. For long outputs, only the first N characters are saved. "
                    "Increase this for tasks that produce detailed, important outputs."
                )),
                ("Usage Tips", (
                    "1. Use when you want explicit transcript recording without Post Model.\n"
                    "2. Place after any model node to record its output.\n"
                    "3. The memory manager must be configured for the session.\n"
                    "4. If no memory manager is present, the node silently does nothing."
                )),
            ],
        ),
    ),
}


# ====================================================================
#  GUARD / RESILIENCE NODES
# ====================================================================

CONTEXT_GUARD_I18N = {
    "en": NodeI18n(
        label="Context Guard",
        description="Checks context window token budget before model calls. Estimates token usage from accumulated messages and writes budget status to state. Downstream nodes read this to compact prompts when tight.",
        parameters={
            "position_label": {
                "label": "Position Label",
                "description": "Descriptive label for logging (e.g. 'classify', 'execute').",
            },
            "messages_field": {
                "label": "Messages State Field",
                "description": "State field containing the message list to measure.",
            },
        },
        output_ports={"default": {"label": "Next"}},
        groups={"general": "General", "state_fields": "State Fields"},
        help=_help(
            "Context Guard Node",
            "Monitors the context window token budget and warns or blocks when limits are approached.",
            [
                ("Overview", (
                    "The Context Guard node is a **resilience infrastructure** node that monitors "
                    "how much of the model's context window has been consumed.\n\n"
                    "It estimates token usage from accumulated messages and writes a budget status "
                    "to state. Downstream nodes can read this to compact prompts, "
                    "truncate content, or skip calls entirely."
                )),
                ("Budget Status", (
                    "The node writes a `context_budget` object to state with:\n\n"
                    "- `estimated_tokens` — estimated token count\n"
                    "- `context_limit` — the model's context window size\n"
                    "- `usage_ratio` — how full the context window is (0.0 to 1.0)\n"
                    "- `status` — 'ok', 'warning', 'overflow', or 'block'\n"
                    "- `compaction_count` — how many times compaction was triggered"
                )),
                ("Position Label", (
                    "The position label is used for logging only. It helps identify "
                    "which guard node triggered in the logs.\n\n"
                    "Example labels: 'classify', 'answer', 'execute', 'review'"
                )),
                ("Usage Tips", (
                    "1. Place before every model node to monitor context usage.\n"
                    "2. Multiple guards can be placed at different points in the workflow.\n"
                    "3. The Iteration Gate also checks context_budget — they work together.\n"
                    "4. Use different position labels to identify which guard triggered."
                )),
            ],
        ),
    ),
    "ko": NodeI18n(
        label="Context Guard",
        description="Checks context window token budget before model calls. Estimates token usage from accumulated messages and writes budget status to state. Downstream nodes read this to compact prompts when tight.",
        parameters={
            "position_label": {
                "label": "Position Label",
                "description": "Descriptive label for logging (e.g. 'classify', 'execute').",
            },
            "messages_field": {
                "label": "Messages State Field",
                "description": "State field containing the message list to measure.",
            },
        },
        output_ports={"default": {"label": "Next"}},
        groups={"general": "General", "state_fields": "State Fields"},
        help=_help(
            "Context Guard Node",
            "Monitors the context window token budget and warns or blocks when limits are approached.",
            [
                ("Overview", (
                    "The Context Guard node is a **resilience infrastructure** node that monitors "
                    "how much of the model's context window has been consumed.\n\n"
                    "It estimates token usage from accumulated messages and writes a budget status "
                    "to state. Downstream nodes can read this to compact prompts, "
                    "truncate content, or skip calls entirely."
                )),
                ("Budget Status", (
                    "The node writes a `context_budget` object to state with:\n\n"
                    "- `estimated_tokens` — estimated token count\n"
                    "- `context_limit` — the model's context window size\n"
                    "- `usage_ratio` — how full the context window is (0.0 to 1.0)\n"
                    "- `status` — 'ok', 'warning', 'overflow', or 'block'\n"
                    "- `compaction_count` — how many times compaction was triggered"
                )),
                ("Position Label", (
                    "The position label is used for logging only. It helps identify "
                    "which guard node triggered in the logs.\n\n"
                    "Example labels: 'classify', 'answer', 'execute', 'review'"
                )),
                ("Usage Tips", (
                    "1. Place before every model node to monitor context usage.\n"
                    "2. Multiple guards can be placed at different points in the workflow.\n"
                    "3. The Iteration Gate also checks context_budget — they work together.\n"
                    "4. Use different position labels to identify which guard triggered."
                )),
            ],
        ),
    ),
}

POST_MODEL_I18N = {
    "en": NodeI18n(
        label="Post Model",
        description="Post-processing node placed after every model call. Performs: (1) iteration counter increment, (2) optional completion signal detection, (3) optional transcript recording. Essential resilience infrastructure.",
        parameters={
            "detect_completion": {
                "label": "Detect Completion Signals",
                "description": "Parse structured completion signals from the output.",
            },
            "record_transcript": {
                "label": "Record Transcript",
                "description": "Record the output to short-term memory.",
            },
            "increment_field": {
                "label": "Iteration Counter Field",
                "description": "State field to increment as the iteration counter.",
            },
            "source_field": {
                "label": "Source State Field",
                "description": "State field to read for signal detection and transcript recording.",
            },
        },
        output_ports={"default": {"label": "Next"}},
        groups={"behavior": "Behavior", "state_fields": "State Fields"},
        help=_help(
            "Post Model Node",
            "Performs essential post-processing after every model call: iteration tracking, signal detection, and transcript recording.",
            [
                ("Overview", (
                    "The Post Model node is a **resilience infrastructure** node that should be placed "
                    "after every model node. It handles three concerns:\n\n"
                    "1. **Iteration increment** — tracks how many model calls have been made\n"
                    "2. **Completion signal detection** — parses structured signals from the output\n"
                    "3. **Transcript recording** — saves the output to short-term memory"
                )),
                ("Completion Signals", (
                    "The node scans the model output for structured completion signals:\n\n"
                    "- `COMPLETE` — task is fully done\n"
                    "- `BLOCKED` — cannot proceed (missing info, permissions, etc.)\n"
                    "- `ERROR` — an error was encountered\n\n"
                    "Detected signals are written to `completion_signal` and `completion_detail` state fields."
                )),
                ("Transcript Recording", (
                    "When enabled, the node records the model output to the session's "
                    "short-term memory transcript. Up to 5000 characters are saved.\n\n"
                    "This builds the conversation history for Memory Inject to use."
                )),
                ("Usage Tips", (
                    "1. Place after every model node (LLM Call, Answer, Direct Answer, etc.).\n"
                    "2. Keep both features enabled for full resilience.\n"
                    "3. Disable transcript recording for intermediate steps to save memory.\n"
                    "4. The iteration count is critical for Iteration Gate to work correctly."
                )),
            ],
        ),
    ),
    "ko": NodeI18n(
        label="Post Model",
        description="Post-processing node placed after every model call. Performs: (1) iteration counter increment, (2) optional completion signal detection, (3) optional transcript recording. Essential resilience infrastructure.",
        parameters={
            "detect_completion": {
                "label": "Detect Completion Signals",
                "description": "Parse structured completion signals from the output.",
            },
            "record_transcript": {
                "label": "Record Transcript",
                "description": "Record the output to short-term memory.",
            },
            "increment_field": {
                "label": "Iteration Counter Field",
                "description": "State field to increment as the iteration counter.",
            },
            "source_field": {
                "label": "Source State Field",
                "description": "State field to read for signal detection and transcript recording.",
            },
        },
        output_ports={"default": {"label": "Next"}},
        groups={"behavior": "Behavior", "state_fields": "State Fields"},
        help=_help(
            "Post Model Node",
            "Performs essential post-processing after every model call: iteration tracking, signal detection, and transcript recording.",
            [
                ("Overview", (
                    "The Post Model node is a **resilience infrastructure** node that should be placed "
                    "after every model node. It handles three concerns:\n\n"
                    "1. **Iteration increment** — tracks how many model calls have been made\n"
                    "2. **Completion signal detection** — parses structured signals from the output\n"
                    "3. **Transcript recording** — saves the output to short-term memory"
                )),
                ("Completion Signals", (
                    "The node scans the model output for structured completion signals:\n\n"
                    "- `COMPLETE` — task is fully done\n"
                    "- `BLOCKED` — cannot proceed (missing info, permissions, etc.)\n"
                    "- `ERROR` — an error was encountered\n\n"
                    "Detected signals are written to `completion_signal` and `completion_detail` state fields."
                )),
                ("Transcript Recording", (
                    "When enabled, the node records the model output to the session's "
                    "short-term memory transcript. Up to 5000 characters are saved.\n\n"
                    "This builds the conversation history for Memory Inject to use."
                )),
                ("Usage Tips", (
                    "1. Place after every model node (LLM Call, Answer, Direct Answer, etc.).\n"
                    "2. Keep both features enabled for full resilience.\n"
                    "3. Disable transcript recording for intermediate steps to save memory.\n"
                    "4. The iteration count is critical for Iteration Gate to work correctly."
                )),
            ],
        ),
    ),
}


# ====================================================================
#  TASK NODES
# ====================================================================

CREATE_TODOS_I18N = {
    "en": NodeI18n(
        label="Create TODOs",
        description="Breaks a complex task into a structured JSON TODO list via LLM. Uses Pydantic-validated structured output for reliable parsing, converts to TodoItem format, and caps item count to prevent runaway execution.",
        parameters={
            "prompt_template": {
                "label": "Prompt Template",
                "description": "Prompt template for generating the TODO list.",
            },
            "max_todos": {
                "label": "Max TODO Items",
                "description": "Maximum number of TODO items to prevent runaway execution.",
            },
            "output_list_field": {
                "label": "Output List Field",
                "description": "State field to store the generated list in.",
            },
            "output_index_field": {
                "label": "Output Index Field",
                "description": "State field for the current index (reset to 0).",
            },
        },
        output_ports={"default": {"label": "Next"}},
        groups={"prompt": "Prompt", "behavior": "Behavior", "state_fields": "State Fields"},
        help=_help(
            "Create TODOs Node",
            "Decomposes complex tasks into a structured TODO list for step-by-step execution.",
            [
                ("Overview", (
                    "The Create TODOs node handles the entry point of the **hard path**. "
                    "It sends the user's complex task to the model, which breaks it down "
                    "into a structured JSON TODO list.\n\n"
                    "Each TODO item has an ID, title, and description. "
                    "The items are then executed sequentially by Execute TODO nodes."
                )),
                ("TODO Format", (
                    "The model is required to produce a **structured JSON output** "
                    "validated by a Pydantic schema:\n\n"
                    '```json\n{"todos": [{"id": 1, "title": "Step 1", "description": "Do X"}, '
                    '{"id": 2, "title": "Step 2", "description": "Do Y"}]}\n```\n\n'
                    "The node also handles bare JSON arrays (auto-wrapped into the schema). "
                    "If the initial response fails validation, an automatic correction retry is attempted."
                )),
                ("Max TODO Items", (
                    "The **Max TODO Items** parameter caps the list to prevent runaway execution.\n\n"
                    "Default: 20. If the model generates more items than the limit, "
                    "only the first N are kept."
                )),
                ("Usage Tips", (
                    "1. Connect from the 'Hard' port of Classify Difficulty.\n"
                    "2. Follow with an Iteration Gate → Execute TODO loop.\n"
                    "3. The TODO list is stored in the `todos` state field.\n"
                    "4. Customize the prompt to get domain-specific decomposition.\n"
                    "5. `current_todo_index` is set to 0 after creation."
                )),
            ],
        ),
    ),
    "ko": NodeI18n(
        label="Create TODOs",
        description="Breaks a complex task into a structured JSON TODO list via LLM. Uses Pydantic-validated structured output for reliable parsing, converts to TodoItem format, and caps item count to prevent runaway execution.",
        parameters={
            "prompt_template": {
                "label": "Prompt Template",
                "description": "Prompt template for generating the TODO list.",
            },
            "max_todos": {
                "label": "Max TODO Items",
                "description": "Maximum number of TODO items to prevent runaway execution.",
            },
            "output_list_field": {
                "label": "Output List Field",
                "description": "State field to store the generated list in.",
            },
            "output_index_field": {
                "label": "Output Index Field",
                "description": "State field for the current index (reset to 0).",
            },
        },
        output_ports={"default": {"label": "Next"}},
        groups={"prompt": "Prompt", "behavior": "Behavior", "state_fields": "State Fields"},
        help=_help(
            "Create TODOs Node",
            "Decomposes complex tasks into a structured TODO list for step-by-step execution.",
            [
                ("Overview", (
                    "The Create TODOs node handles the entry point of the **hard path**. "
                    "It sends the user's complex task to the model, which breaks it down "
                    "into a structured JSON TODO list.\n\n"
                    "Each TODO item has an ID, title, and description. "
                    "The items are then executed sequentially by Execute TODO nodes."
                )),
                ("TODO Format", (
                    "The model must produce a JSON array:\n\n"
                    "```json\n[\n  {\"id\": 1, \"title\": \"Step 1\", \"description\": \"Do X\"},\n  {\"id\": 2, \"title\": \"Step 2\", \"description\": \"Do Y\"}\n]\n```\n\n"
                    "The node handles plain text or JSON wrapped in markdown code blocks."
                )),
                ("Max TODO Items", (
                    "The **Max TODO Items** parameter caps the list to prevent runaway execution.\n\n"
                    "Default: 20. If the model generates more items than the limit, "
                    "only the first N are kept."
                )),
                ("Usage Tips", (
                    "1. Connect from the 'Hard' port of Classify Difficulty.\n"
                    "2. Follow with an Iteration Gate → Execute TODO loop.\n"
                    "3. The TODO list is stored in the `todos` state field.\n"
                    "4. Customize the prompt to get domain-specific decomposition.\n"
                    "5. `current_todo_index` is set to 0 after creation."
                )),
            ],
        ),
    ),
}

EXECUTE_TODO_I18N = {
    "en": NodeI18n(
        label="Execute TODO",
        description="Executes a single TODO item from the plan. Builds a prompt with the item's context and budget-aware previous results. Marks the item as completed or failed and advances the index. Designed for loop use with CheckProgress.",
        parameters={
            "prompt_template": {
                "label": "Prompt Template",
                "description": "Prompt for executing a TODO item.",
            },
            "list_field": {
                "label": "List State Field",
                "description": "State field containing the TODO list.",
            },
            "index_field": {
                "label": "Index State Field",
                "description": "State field tracking the current TODO index.",
            },
            "max_context_chars": {
                "label": "Max Context Chars",
                "description": "Max characters per previous result in the context window.",
            },
            "compact_context_chars": {
                "label": "Compact Context Chars",
                "description": "Max characters per previous result when context budget is tight.",
            },
        },
        output_ports={"default": {"label": "Next"}},
        groups={"prompt": "Prompt", "state_fields": "State Fields", "behavior": "Behavior"},
        help=_help(
            "Execute TODO Node",
            "Executes one TODO item at a time, incorporating results from previously completed items.",
            [
                ("Overview", (
                    "The Execute TODO node processes individual items from the TODO list "
                    "created by Create TODOs. It executes one item per invocation "
                    "and advances the `current_todo_index`.\n\n"
                    "Each execution includes context from previously completed items "
                    "to ensure coherent, progressive work."
                )),
                ("Execution Context", (
                    "The prompt includes:\n"
                    "- `{goal}` — the original user request\n"
                    "- `{title}` — the current TODO item title\n"
                    "- `{description}` — the current TODO item description\n"
                    "- `{previous_results}` — results from already-completed items\n\n"
                    "If the context budget is strained, previous results are truncated."
                )),
                ("State Updates", (
                    "After execution:\n"
                    "- The TODO item's status is set to `completed` (or `failed` on error)\n"
                    "- `current_todo_index` is incremented\n"
                    "- The result is stored in the TODO item's `result` field"
                )),
                ("Usage Tips", (
                    "1. Place inside a loop: Iteration Gate → Context Guard → Execute TODO → Post Model → Check Progress.\n"
                    "2. Check Progress routes back to Iteration Gate (continue) or to Final Review (complete).\n"
                    "3. If the context budget is tight, previous results are automatically truncated.\n"
                    "4. Failed TODO items are recorded but execution continues with the next item."
                )),
            ],
        ),
    ),
    "ko": NodeI18n(
        label="Execute TODO",
        description="Executes a single TODO item from the plan. Builds a prompt with the item's context and budget-aware previous results. Marks the item as completed or failed and advances the index. Designed for loop use with CheckProgress.",
        parameters={
            "prompt_template": {
                "label": "Prompt Template",
                "description": "Prompt for executing a TODO item.",
            },
            "list_field": {
                "label": "List State Field",
                "description": "State field containing the TODO list.",
            },
            "index_field": {
                "label": "Index State Field",
                "description": "State field tracking the current TODO index.",
            },
            "max_context_chars": {
                "label": "Max Context Chars",
                "description": "Max characters per previous result in the context window.",
            },
            "compact_context_chars": {
                "label": "Compact Context Chars",
                "description": "Max characters per previous result when context budget is tight.",
            },
        },
        output_ports={"default": {"label": "Next"}},
        groups={"prompt": "Prompt", "state_fields": "State Fields", "behavior": "Behavior"},
        help=_help(
            "Execute TODO Node",
            "Executes one TODO item at a time, incorporating results from previously completed items.",
            [
                ("Overview", (
                    "The Execute TODO node processes individual items from the TODO list "
                    "created by Create TODOs. It executes one item per invocation "
                    "and advances the `current_todo_index`.\n\n"
                    "Each execution includes context from previously completed items "
                    "to ensure coherent, progressive work."
                )),
                ("Execution Context", (
                    "The prompt includes:\n"
                    "- `{goal}` — the original user request\n"
                    "- `{title}` — the current TODO item title\n"
                    "- `{description}` — the current TODO item description\n"
                    "- `{previous_results}` — results from already-completed items\n\n"
                    "If the context budget is strained, previous results are truncated."
                )),
                ("State Updates", (
                    "After execution:\n"
                    "- The TODO item's status is set to `completed` (or `failed` on error)\n"
                    "- `current_todo_index` is incremented\n"
                    "- The result is stored in the TODO item's `result` field"
                )),
                ("Usage Tips", (
                    "1. Place inside a loop: Iteration Gate → Context Guard → Execute TODO → Post Model → Check Progress.\n"
                    "2. Check Progress routes back to Iteration Gate (continue) or to Final Review (complete).\n"
                    "3. If the context budget is tight, previous results are automatically truncated.\n"
                    "4. Failed TODO items are recorded but execution continues with the next item."
                )),
            ],
        ),
    ),
}

FINAL_REVIEW_I18N = {
    "en": NodeI18n(
        label="Final Review",
        description="Comprehensive review of all completed list item results using Pydantic-validated structured output. Evaluates overall quality, summarizes accomplishments, identifies issues, and provides actionable recommendations for final answer synthesis.",
        parameters={
            "prompt_template": {
                "label": "Prompt Template",
                "description": "Prompt for the final review of all work.",
            },
            "list_field": {
                "label": "List State Field",
                "description": "State field containing the list to review.",
            },
            "output_field": {
                "label": "Output State Field",
                "description": "State field to store the formatted review output.",
            },
            "quality_levels": {
                "label": "Quality Levels (JSON)",
                "description": "Allowed values for the overall_quality assessment in the structured output.",
            },
            "max_item_chars": {
                "label": "Max Chars per Item",
                "description": "Maximum characters per list item result in the prompt.",
            },
            "compact_item_chars": {
                "label": "Compact Chars per Item",
                "description": "Maximum characters per item when context budget is tight.",
            },
        },
        output_ports={"default": {"label": "Next"}},
        groups={"prompt": "Prompt", "state_fields": "State Fields", "output": "Output", "behavior": "Behavior"},
        help=_help(
            "Final Review Node",
            "Performs a comprehensive Pydantic-validated review of all completed TODO items before synthesis.",
            [
                ("Overview", (
                    "The Final Review node is part of the **hard path** completion sequence. "
                    "It reviews all TODO results together using **structured output** — the LLM "
                    "must return a JSON object matching the `FinalReviewOutput` schema.\n\n"
                    "The structured output includes overall quality, completion summary, "
                    "issues found, and recommendations. This ensures the final answer "
                    "considers the quality and completeness of all individual results."
                )),
                ("Structured Output Format", (
                    "The LLM response is validated against this schema:\n"
                    "- `overall_quality` — one of the configured quality levels "
                    "(default: excellent / good / needs_improvement / poor)\n"
                    "- `completed_summary` — description of what was accomplished\n"
                    "- `issues_found` — list of specific issues identified (optional)\n"
                    "- `recommendations` — suggestions for the final answer\n\n"
                    "If JSON parsing fails, a correction prompt is sent automatically."
                )),
                ("Quality Levels", (
                    "The `quality_levels` parameter controls which values are accepted "
                    "for `overall_quality`. The LLM's response is coerced to the nearest "
                    "match if it doesn't exactly match.\n\n"
                    "Customize for different review criteria:\n"
                    "- Production: `[\"pass\", \"fail\"]`\n"
                    "- Detailed: `[\"excellent\", \"good\", \"acceptable\", \"poor\"]`\n"
                    "- Default: `[\"excellent\", \"good\", \"needs_improvement\", \"poor\"]`"
                )),
                ("Usage Tips", (
                    "1. Place after Check Progress routes to 'Complete'.\n"
                    "2. Follow with Final Answer for synthesis.\n"
                    "3. The formatted review is stored in `review_feedback` state field.\n"
                    "4. Quality metadata is written to `metadata.review_quality`.\n"
                    "5. This is different from the Review node — it reviews ALL results, not one answer."
                )),
            ],
        ),
    ),
    "ko": NodeI18n(
        label="Final Review",
        description="Comprehensive review of all completed list item results using Pydantic-validated structured output. Evaluates overall quality, summarizes accomplishments, identifies issues, and provides actionable recommendations for final answer synthesis.",
        parameters={
            "prompt_template": {
                "label": "Prompt Template",
                "description": "Prompt for the final review of all work.",
            },
            "list_field": {
                "label": "List State Field",
                "description": "State field containing the list to review.",
            },
            "output_field": {
                "label": "Output State Field",
                "description": "State field to store the formatted review output.",
            },
            "quality_levels": {
                "label": "Quality Levels (JSON)",
                "description": "Allowed values for the overall_quality assessment in the structured output.",
            },
            "max_item_chars": {
                "label": "Max Chars per Item",
                "description": "Maximum characters per list item result in the prompt.",
            },
            "compact_item_chars": {
                "label": "Compact Chars per Item",
                "description": "Maximum characters per item when context budget is tight.",
            },
        },
        output_ports={"default": {"label": "Next"}},
        groups={"prompt": "Prompt", "state_fields": "State Fields", "output": "Output", "behavior": "Behavior"},
        help=_help(
            "Final Review Node",
            "Performs a comprehensive Pydantic-validated review of all completed TODO items before synthesis.",
            [
                ("Overview", (
                    "The Final Review node is part of the **hard path** completion sequence. "
                    "It reviews all TODO results together using **structured output** — the LLM "
                    "must return a JSON object matching the `FinalReviewOutput` schema.\n\n"
                    "The structured output includes overall quality, completion summary, "
                    "issues found, and recommendations. This ensures the final answer "
                    "considers the quality and completeness of all individual results."
                )),
                ("Structured Output Format", (
                    "The LLM response is validated against this schema:\n"
                    "- `overall_quality` — one of the configured quality levels "
                    "(default: excellent / good / needs_improvement / poor)\n"
                    "- `completed_summary` — description of what was accomplished\n"
                    "- `issues_found` — list of specific issues identified (optional)\n"
                    "- `recommendations` — suggestions for the final answer\n\n"
                    "If JSON parsing fails, a correction prompt is sent automatically."
                )),
                ("Quality Levels", (
                    "The `quality_levels` parameter controls which values are accepted "
                    "for `overall_quality`. The LLM's response is coerced to the nearest "
                    "match if it doesn't exactly match.\n\n"
                    "Customize for different review criteria:\n"
                    "- Production: `[\"pass\", \"fail\"]`\n"
                    "- Detailed: `[\"excellent\", \"good\", \"acceptable\", \"poor\"]`\n"
                    "- Default: `[\"excellent\", \"good\", \"needs_improvement\", \"poor\"]`"
                )),
                ("Usage Tips", (
                    "1. Place after Check Progress routes to 'Complete'.\n"
                    "2. Follow with Final Answer for synthesis.\n"
                    "3. The formatted review is stored in `review_feedback` state field.\n"
                    "4. Quality metadata is written to `metadata.review_quality`.\n"
                    "5. This is different from the Review node — it reviews ALL results, not one answer."
                )),
            ],
        ),
    ),
}

FINAL_ANSWER_I18N = {
    "en": NodeI18n(
        label="Final Answer",
        description="Synthesizes the final comprehensive answer from all list item results and review feedback. Combines completed work with budget-aware truncation. Marks the workflow as complete upon success.",
        parameters={
            "prompt_template": {
                "label": "Prompt Template",
                "description": "Prompt for synthesizing the final answer.",
            },
            "list_field": {
                "label": "List State Field",
                "description": "State field containing the list of results.",
            },
            "feedback_field": {
                "label": "Feedback State Field",
                "description": "State field containing review feedback to incorporate.",
            },
            "output_field": {
                "label": "Output State Field",
                "description": "State field to store the synthesized answer.",
            },
            "max_item_chars": {
                "label": "Max Chars per Item",
                "description": "Maximum characters per list item result in the prompt.",
            },
            "compact_item_chars": {
                "label": "Compact Chars per Item",
                "description": "Maximum characters per item when context budget is tight.",
            },
        },
        output_ports={"default": {"label": "Next"}},
        groups={"prompt": "Prompt", "state_fields": "State Fields", "output": "Output", "behavior": "Behavior"},
        help=_help(
            "Final Answer Node",
            "Synthesizes all TODO results and review feedback into a single comprehensive final answer.",
            [
                ("Overview", (
                    "The Final Answer node is the **terminal node** of the hard path. "
                    "It takes all TODO results and the final review feedback, "
                    "then synthesizes them into a single comprehensive response.\n\n"
                    "After execution, `is_complete` is set to True, ending the workflow."
                )),
                ("Synthesis Content", (
                    "The prompt includes:\n"
                    "- `{input}` — the original user request\n"
                    "- `{todo_results}` — all TODO results with their status\n"
                    "- `{review_feedback}` — feedback from the final review\n\n"
                    "The model combines all this information into a cohesive final answer."
                )),
                ("State Updates", (
                    "After execution:\n"
                    "- `final_answer` — the synthesized answer\n"
                    "- `is_complete = True` — signals workflow completion\n"
                    "- `current_step = 'complete'`"
                )),
                ("Usage Tips", (
                    "1. Place after Final Review.\n"
                    "2. Connect to End node (or Post Model → End).\n"
                    "3. If the Final Review failed, the node still attempts synthesis from TODO results.\n"
                    "4. On error, it provides a fallback answer with raw TODO results."
                )),
            ],
        ),
    ),
    "ko": NodeI18n(
        label="Final Answer",
        description="Synthesizes the final comprehensive answer from all list item results and review feedback. Combines completed work with budget-aware truncation. Marks the workflow as complete upon success.",
        parameters={
            "prompt_template": {
                "label": "Prompt Template",
                "description": "Prompt for synthesizing the final answer.",
            },
            "list_field": {
                "label": "List State Field",
                "description": "State field containing the list of results.",
            },
            "feedback_field": {
                "label": "Feedback State Field",
                "description": "State field containing review feedback to incorporate.",
            },
            "output_field": {
                "label": "Output State Field",
                "description": "State field to store the synthesized answer.",
            },
            "max_item_chars": {
                "label": "Max Chars per Item",
                "description": "Maximum characters per list item result in the prompt.",
            },
            "compact_item_chars": {
                "label": "Compact Chars per Item",
                "description": "Maximum characters per item when context budget is tight.",
            },
        },
        output_ports={"default": {"label": "Next"}},
        groups={"prompt": "Prompt", "state_fields": "State Fields", "output": "Output", "behavior": "Behavior"},
        help=_help(
            "Final Answer Node",
            "Synthesizes all TODO results and review feedback into a single comprehensive final answer.",
            [
                ("Overview", (
                    "The Final Answer node is the **terminal node** of the hard path. "
                    "It takes all TODO results and the final review feedback, "
                    "then synthesizes them into a single comprehensive response.\n\n"
                    "After execution, `is_complete` is set to True, ending the workflow."
                )),
                ("Synthesis Content", (
                    "The prompt includes:\n"
                    "- `{input}` — the original user request\n"
                    "- `{todo_results}` — all TODO results with their status\n"
                    "- `{review_feedback}` — feedback from the final review\n\n"
                    "The model combines all this information into a cohesive final answer."
                )),
                ("State Updates", (
                    "After execution:\n"
                    "- `final_answer` — the synthesized answer\n"
                    "- `is_complete = True` — signals workflow completion\n"
                    "- `current_step = 'complete'`"
                )),
                ("Usage Tips", (
                    "1. Place after Final Review.\n"
                    "2. Connect to End node (or Post Model → End).\n"
                    "3. If the Final Review failed, the node still attempts synthesis from TODO results.\n"
                    "4. On error, it provides a fallback answer with raw TODO results."
                )),
            ],
        ),
    ),
}


# ====================================================================
#  RELEVANCE GATE NODE
# ====================================================================

RELEVANCE_GATE_I18N = {
    "en": NodeI18n(
        label="Relevance Gate",
        description="Chat/broadcast relevance filter. Uses a lightweight LLM call to determine if a broadcast message is relevant to this agent's role and persona. Irrelevant messages skip to END.",
        parameters={},
        output_ports={
            "continue": {"label": "Continue", "description": "Message is relevant — proceed with normal execution"},
            "skip": {"label": "Skip", "description": "Message is not relevant — skip to END"},
        },
        groups={},
        help=_help(
            "Relevance Gate Node",
            "Filters broadcast/chat messages based on agent role relevance.",
            [
                ("Overview", (
                    "The Relevance Gate activates only for **chat/broadcast messages** "
                    "(when `is_chat_message=True` in state). For normal single-session "
                    "commands, it passes through without any LLM call.\n\n"
                    "When active, it performs a lightweight yes/no LLM query to determine "
                    "if the broadcast message is relevant to this agent's role and expertise."
                )),
                ("Routing", (
                    "- **Continue**: Message is relevant → proceed to difficulty classification\n"
                    "- **Skip**: Message is not relevant → exit to END with empty output"
                )),
                ("Usage Tips", (
                    "1. Place between Memory Inject and Context Guard (Classify).\n"
                    "2. Only activates for broadcast messages — transparent for normal execution.\n"
                    "3. On error, defaults to 'relevant' to avoid blocking legitimate work."
                )),
            ],
        ),
    ),
    "ko": NodeI18n(
        label="Relevance Gate",
        description="Chat/broadcast relevance filter. Uses a lightweight LLM call to determine if a broadcast message is relevant to this agent's role and persona. Irrelevant messages skip to END.",
        parameters={},
        output_ports={
            "continue": {"label": "Continue", "description": "Message is relevant — proceed with normal execution"},
            "skip": {"label": "Skip", "description": "Message is not relevant — skip to END"},
        },
        groups={},
        help=_help(
            "Relevance Gate Node",
            "Filters broadcast/chat messages based on agent role relevance.",
            [
                ("Overview", (
                    "The Relevance Gate activates only for **chat/broadcast messages** "
                    "(when `is_chat_message=True` in state). For normal single-session "
                    "commands, it passes through without any LLM call."
                )),
                ("Routing", (
                    "- **Continue**: Message is relevant → proceed to difficulty classification\n"
                    "- **Skip**: Message is not relevant → exit to END with empty output"
                )),
                ("Usage Tips", (
                    "1. Place between Memory Inject and Context Guard (Classify).\n"
                    "2. Only activates for broadcast messages — transparent for normal execution.\n"
                    "3. On error, defaults to 'relevant' to avoid blocking legitimate work."
                )),
            ],
        ),
    ),
}


# ====================================================================
#  Adaptive Classify Node
# ====================================================================

ADAPTIVE_CLASSIFY_I18N = {
    "en": NodeI18n(
        label="Adaptive Classify",
        description="Rule-based fast classification with LLM fallback. Short/trivial inputs are classified instantly without an LLM call, saving 8-15 seconds. Uncertain inputs fall back to structured-output LLM classification. Includes inline context-guard and post-model.",
        parameters={
            "prompt_template": {
                "label": "Classification Prompt",
                "description": "Prompt for LLM classification (used only when rules are uncertain).",
            },
            "categories": {
                "label": "Categories",
                "description": "Comma-separated category names. Each becomes an output port.",
            },
            "default_category": {
                "label": "Default Category",
                "description": "Fallback when the LLM response doesn't match any category.",
            },
            "output_field": {
                "label": "Output State Field",
                "description": "State field to store the classification result.",
            },
            "enable_rules": {
                "label": "Enable Rule-Based Fast Path",
                "description": "Use rule-based pre-check before LLM. Disable to always use LLM.",
            },
        },
        output_ports={
            "easy": {"label": "Easy", "description": "Simple, direct tasks"},
            "tool_direct": {"label": "Tool Direct", "description": "Direct tool execution"},
            "medium": {"label": "Medium", "description": "Moderate complexity"},
            "hard": {"label": "Hard", "description": "Complex, multi-step tasks"},
            "extreme": {"label": "Extreme", "description": "Very high complexity"},
            "end": {"label": "End", "description": "Error / early termination"},
        },
        groups={"prompt": "Prompt", "routing": "Routing", "output": "Output", "behavior": "Behavior"},
        help=_help(
            "Adaptive Classify Node",
            "Rule-based + LLM hybrid classifier that skips LLM calls for trivially classifiable inputs.",
            [
                ("Overview", (
                    "A **conditional model node** that first tries fast rule-based "
                    "classification. Greetings, short factual questions, and simple "
                    "calculations are classified as 'easy' instantly. Complex multi-step "
                    "requests are classified as 'hard' by pattern matching.\n\n"
                    "When rules cannot determine the category, falls back to the "
                    "standard LLM-based structured-output classification."
                )),
                ("Inline Hooks", (
                    "Includes **inline context-guard** (token estimation) and "
                    "**inline post-model** (iteration increment) to eliminate the need "
                    "for surrounding Guard and PostModel nodes."
                )),
                ("Usage Tips", (
                    "1. Place after Memory Inject / Relevance Gate in the entry chain.\n"
                    "2. Connect output ports to difficulty-specific paths.\n"
                    "3. Disable `enable_rules` to force LLM classification on every input.\n"
                    "4. Customize categories for non-difficulty use cases."
                )),
            ],
        ),
    ),
    "ko": NodeI18n(
        label="Adaptive Classify",
        description="Rule-based fast classification with LLM fallback. Short/trivial inputs are classified instantly without an LLM call, saving 8-15 seconds. Uncertain inputs fall back to structured-output LLM classification. Includes inline context-guard and post-model.",
        parameters={
            "prompt_template": {
                "label": "Classification Prompt",
                "description": "Prompt for LLM classification (used only when rules are uncertain).",
            },
            "categories": {
                "label": "Categories",
                "description": "Comma-separated category names. Each becomes an output port.",
            },
            "default_category": {
                "label": "Default Category",
                "description": "Fallback when the LLM response doesn't match any category.",
            },
            "output_field": {
                "label": "Output State Field",
                "description": "State field to store the classification result.",
            },
            "enable_rules": {
                "label": "Enable Rule-Based Fast Path",
                "description": "Use rule-based pre-check before LLM. Disable to always use LLM.",
            },
        },
        output_ports={
            "easy": {"label": "Easy", "description": "Simple, direct tasks"},
            "tool_direct": {"label": "Tool Direct", "description": "Direct tool execution"},
            "medium": {"label": "Medium", "description": "Moderate complexity"},
            "hard": {"label": "Hard", "description": "Complex, multi-step tasks"},
            "extreme": {"label": "Extreme", "description": "Very high complexity"},
            "end": {"label": "End", "description": "Error / early termination"},
        },
        groups={"prompt": "Prompt", "routing": "Routing", "output": "Output", "behavior": "Behavior"},
        help=_help(
            "Adaptive Classify Node",
            "Rule-based + LLM hybrid classifier that skips LLM calls for trivially classifiable inputs.",
            [
                ("Overview", (
                    "A **conditional model node** that first tries fast rule-based "
                    "classification. Greetings, short factual questions, and simple "
                    "calculations are classified as 'easy' instantly. "
                    "When rules cannot determine the category, falls back to the "
                    "standard LLM-based structured-output classification."
                )),
                ("Inline Hooks", (
                    "Includes **inline context-guard** (token estimation) and "
                    "**inline post-model** (iteration increment) to eliminate the need "
                    "for surrounding Guard and PostModel nodes."
                )),
                ("Usage Tips", (
                    "1. Place after Memory Inject / Relevance Gate in the entry chain.\n"
                    "2. Connect output ports to difficulty-specific paths.\n"
                    "3. Disable `enable_rules` to force LLM classification on every input.\n"
                    "4. Customize categories for non-difficulty use cases."
                )),
            ],
        ),
    ),
}


# ====================================================================
#  Direct Tool Node
# ====================================================================

DIRECT_TOOL_I18N = {
    "en": NodeI18n(
        label="Direct Tool",
        description="Single-shot tool execution node. For tasks where the essence IS a tool operation, executes it in one LLM call without planning. Marks workflow complete after execution.",
        parameters={
            "prompt_template": {
                "label": "Tool Execution Prompt",
                "description": "Prompt instructing the LLM to execute the tool directly.",
            },
            "output_field": {
                "label": "Output State Field",
                "description": "State field to store the execution result.",
            },
        },
        output_ports={"default": {"label": "Next"}},
        groups={"prompt": "Prompt", "output": "Output"},
    ),
    "ko": NodeI18n(
        label="Direct Tool",
        description="Single-shot tool execution node. For tasks where the essence IS a tool operation, executes it in one LLM call without planning. Marks workflow complete after execution.",
        parameters={
            "prompt_template": {
                "label": "Tool Execution Prompt",
                "description": "Prompt instructing the LLM to execute the tool directly.",
            },
            "output_field": {
                "label": "Output State Field",
                "description": "State field to store the execution result.",
            },
        },
        output_ports={"default": {"label": "Next"}},
        groups={"prompt": "Prompt", "output": "Output"},
    ),
}


# ====================================================================
#  Batch Execute TODO Node
# ====================================================================

BATCH_EXECUTE_TODO_I18N = {
    "en": NodeI18n(
        label="Batch Execute TODOs",
        description="Executes all pending TODO items in a single LLM call. Reduces N individual LLM calls to 1. Best for HARD-path tasks with a small number of predictable, independent TODO items.",
        parameters={
            "prompt_template": {
                "label": "Batch Prompt",
                "description": "Prompt for batch executing TODO items. Use {input} for the goal and {todo_list} for formatted items.",
            },
            "list_field": {
                "label": "List State Field",
                "description": "State field containing the TODO list.",
            },
            "index_field": {
                "label": "Index State Field",
                "description": "State field tracking the current TODO index.",
            },
        },
        output_ports={"default": {"label": "Next"}},
        groups={"prompt": "Prompt", "state_fields": "State Fields"},
    ),
    "ko": NodeI18n(
        label="Batch Execute TODOs",
        description="Executes all pending TODO items in a single LLM call. Reduces N individual LLM calls to 1. Best for HARD-path tasks with a small number of predictable, independent TODO items.",
        parameters={
            "prompt_template": {
                "label": "Batch Prompt",
                "description": "Prompt for batch executing TODO items. Use {input} for the goal and {todo_list} for formatted items.",
            },
            "list_field": {
                "label": "List State Field",
                "description": "State field containing the TODO list.",
            },
            "index_field": {
                "label": "Index State Field",
                "description": "State field tracking the current TODO index.",
            },
        },
        output_ports={"default": {"label": "Next"}},
        groups={"prompt": "Prompt", "state_fields": "State Fields"},
    ),
}


# ====================================================================
#  Final Synthesis Node
# ====================================================================

FINAL_SYNTHESIS_I18N = {
    "en": NodeI18n(
        label="Final Synthesis",
        description="Merged final-review + final-answer node. Reviews all completed list item results and synthesizes them into a polished final answer in a single LLM call. Budget-aware truncation prevents context overflow.",
        parameters={
            "prompt_template": {
                "label": "Synthesis Prompt",
                "description": "Prompt for reviewing and synthesising the final answer.",
            },
            "list_field": {
                "label": "List State Field",
                "description": "State field containing the list of completed items.",
            },
            "output_field": {
                "label": "Output State Field",
                "description": "State field to store the synthesised answer.",
            },
            "max_item_chars": {
                "label": "Max Chars per Item",
                "description": "Maximum characters per list item result in the prompt.",
            },
            "compact_item_chars": {
                "label": "Compact Chars per Item",
                "description": "Maximum characters per item when context budget is tight.",
            },
        },
        output_ports={"default": {"label": "Next"}},
        groups={"prompt": "Prompt", "state_fields": "State Fields", "output": "Output", "behavior": "Behavior"},
        help=_help(
            "Final Synthesis Node",
            "Reviews and synthesises all TODO results into a single comprehensive answer in one LLM call.",
            [
                ("Overview", (
                    "The Final Synthesis node merges the responsibilities of "
                    "**Final Review** and **Final Answer** into a single LLM call. "
                    "The prompt instructs the model to:\n"
                    "1. Review the quality of completed work.\n"
                    "2. Synthesize all results into a polished final response.\n\n"
                    "This saves one full LLM round-trip (10-20 seconds) on the hard path."
                )),
                ("Budget Awareness", (
                    "When context budget is tight (block/overflow), each item's result "
                    "is truncated to `compact_item_chars` instead of `max_item_chars`."
                )),
                ("State Updates", (
                    "After execution:\n"
                    "- `final_answer` — the synthesized answer\n"
                    "- `is_complete = True` — signals workflow completion\n"
                    "- `iteration` is incremented"
                )),
                ("Usage Tips", (
                    "1. Place after Check Progress in the hard path.\n"
                    "2. Connect directly to End node — no Post Model needed.\n"
                    "3. Replace the 6-node chain: guard_fr → fin_rev → post_fr → guard_fa → fin_ans → post_fa."
                )),
            ],
        ),
    ),
    "ko": NodeI18n(
        label="Final Synthesis",
        description="Merged final-review + final-answer node. Reviews all completed list item results and synthesizes them into a polished final answer in a single LLM call. Budget-aware truncation prevents context overflow.",
        parameters={
            "prompt_template": {
                "label": "Synthesis Prompt",
                "description": "Prompt for reviewing and synthesising the final answer.",
            },
            "list_field": {
                "label": "List State Field",
                "description": "State field containing the list of completed items.",
            },
            "output_field": {
                "label": "Output State Field",
                "description": "State field to store the synthesised answer.",
            },
            "max_item_chars": {
                "label": "Max Chars per Item",
                "description": "Maximum characters per list item result in the prompt.",
            },
            "compact_item_chars": {
                "label": "Compact Chars per Item",
                "description": "Maximum characters per item when context budget is tight.",
            },
        },
        output_ports={"default": {"label": "Next"}},
        groups={"prompt": "Prompt", "state_fields": "State Fields", "output": "Output", "behavior": "Behavior"},
        help=_help(
            "Final Synthesis Node",
            "Reviews and synthesises all TODO results into a single comprehensive answer in one LLM call.",
            [
                ("Overview", (
                    "The Final Synthesis node merges the responsibilities of "
                    "**Final Review** and **Final Answer** into a single LLM call. "
                    "The prompt instructs the model to:\n"
                    "1. Review the quality of completed work.\n"
                    "2. Synthesize all results into a polished final response.\n\n"
                    "This saves one full LLM round-trip (10-20 seconds) on the hard path."
                )),
                ("Budget Awareness", (
                    "When context budget is tight (block/overflow), each item's result "
                    "is truncated to `compact_item_chars` instead of `max_item_chars`."
                )),
                ("Usage Tips", (
                    "1. Place after Check Progress in the hard path.\n"
                    "2. Connect directly to End node — no Post Model needed.\n"
                    "3. Replace the 6-node chain: guard_fr → fin_rev → post_fr → guard_fa → fin_ans → post_fa."
                )),
            ],
        ),
    ),
}
