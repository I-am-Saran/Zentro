from typing import Optional, List, Dict, Any
from mcp.server.fastmcp import FastMCP
import datetime

from backend.main import (
    _select_bugs_with_fallback,
    _insert_bug_with_fallback,
    _get_bug_by_id,
    _select_tasks_with_fallback,
    _get_task_by_id,
    _insert_task_with_fallback,
)


# Create the FastMCP server
mcp = FastMCP("Zentro")


# ---------- BUG TOOLS ----------

@mcp.tool()
def list_bugs() -> str:
    """
    List all bugs currently in the system.
    Returns a JSON-like string of the list of bugs (brief info).
    """
    result = _select_bugs_with_fallback()
    bugs = result.get("data", [])
    brief = []
    for b in bugs:
        brief.append({
            "Bug ID": b.get("Bug ID"),
            "Summary": b.get("Summary"),
            "Priority": b.get("Priority"),
            "Status": b.get("Status"),
            "Assignee": b.get("Assignee"),
        })
    return str(brief)


@mcp.tool()
def get_bug_details(bug_id: str) -> str:
    """
    Get detailed information about a specific bug by its ID (e.g. 'BUG-001' or '123').
    Returns a JSON-like string of the bug details.
    """
    bug = _get_bug_by_id(bug_id)
    if not bug:
        return f"Bug with ID {bug_id} not found."
    return str(bug)


@mcp.tool()
def create_bug(
    bug_id: str,
    summary: str,
    description: str,
    priority: str = "Medium",
    defect_type: str = "Functional",
    product: str = "",
    assignee: str = "",
) -> str:
    """
    Create a new bug report.

    Args:
        bug_id: Unique identifier for the bug (e.g. 'BUG-100')
        summary: Short title of the bug
        description: Detailed explanation of the bug
        priority: Priority of the bug (e.g. High, Medium, Low)
        defect_type: Type of defect (e.g. Functional)
        product: Product/module name
        assignee: Person responsible for the bug
    """
    if not bug_id or not bug_id.strip():
        return "Error: Bug ID is required."

    payload = {
        "Bug ID": bug_id,
        "Summary": summary,
        "Description": description,
        "Priority": priority,
        "Defect type": defect_type,
        "Product": product,
        "Assignee": assignee,
    }

    try:
        # Minimal defaults similar to main.py logic
        defaults = {
            "Status": "OPEN",
            "Resolution": "Unresolved",
            "Changed": datetime.datetime.now(
                datetime.timezone.utc
            ).isoformat(),
            "Automation Intent": "No",
            "Device type": "Web",
        }
        for k, v in defaults.items():
            payload.setdefault(k, v)

        result = _insert_bug_with_fallback(payload)
        return str(result)
    except Exception as e:
        return f"Error creating bug: {str(e)}"


# ---------- TASK TOOLS ----------

@mcp.tool()
def list_tasks() -> str:
    """
    List all tasks in the system.
    Returns a JSON-like string of task summaries.
    """
    result = _select_tasks_with_fallback()
    tasks = result.get("data", [])
    brief = []
    for t in tasks:
        brief.append({
            "Task ID": t.get("Task ID"),
            "Title": t.get("Title"),
            "Status": t.get("Status"),
            "Priority": t.get("Priority"),
            "Assignee": t.get("Assignee"),
            "Due Date": t.get("Due Date"),
        })
    return str(brief)


@mcp.tool()
def get_task_details(task_id: str) -> str:
    """
    Get detailed information about a specific task by its ID.
    """
    task = _get_task_by_id(task_id)
    if not task:
        return f"Task with ID {task_id} not found."
    return str(task)


@mcp.tool()
def create_task(
    task_id: str,
    title: str,
    description: str,
    priority: str = "Medium",
    status: str = "Todo",
    assignee: str = "",
    due_date: str = "",
) -> str:
    """
    Create a new task.
    """
    if not task_id or not task_id.strip():
        return "Error: Task ID is required."

    payload = {
        "Task ID": task_id,
        "Title": title,
        "Description": description,
        "Priority": priority,
        "Status": status,
        "Assignee": assignee,
        "Due Date": due_date,
    }

    try:
        result = _insert_task_with_fallback(payload)
        return str(result)
    except Exception as e:
        return f"Error creating task: {str(e)}"


# ---------- ENTRYPOINT ----------

if __name__ == "__main__":
    print("Starting Zentro MCP Server...")
    mcp.run()
