"""
FastAPI server for man@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan event handler for startup and shutdown events."""
    # Startup
    print("🚀 FastAPI Application Starting...")
    
    # Clear port 8001 before starting
    clear_port_and_start(8001, force=True)
    
    init_database()
    populate_questions_from_md()
    print("✅ Database initialized and questions populated")
    
    yield
    
    # Shutdown
    print("👋 FastAPI Application Shutting Down...")docs question status tracking.
Provides thread-safe CRUD operations using SQLite database.
Extended with comprehensive task management system for jobseeker-orchestrator platform.
"""

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, Dict, List, Literal
from contextlib import asynccontextmanager, contextmanager
import sqlite3
import os
import threading
import uuid
from datetime import datetime
import re
from collections import defaultdict

# Import custom modules
from task_parser import parse_documentation_files
from agent_coordinator import assign_task_to_agent
from github_integration import create_pull_request
from port_utils import clear_port_and_start  # Temporarily commented out


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan event handler for startup and shutdown events."""
    # Startup
    print("🚀 FastAPI Application Starting...")
    
    # Clear port 8001 before starting (temporarily disabled)
    # clear_port_and_start(8001, force=True)
    
    init_database()
    populate_questions_from_md()
    print("✅ Database initialized and questions populated")
    
    yield
    
    # Shutdown
    print("👋 FastAPI Application Shutting Down...")


app = FastAPI(
    title="Cloudflare Docs Question Tracker & Task Management",
    description="API for coordinating multi-agent documentation research and task management",
    version="2.0.0",
    lifespan=lifespan
)

# CORS middleware for browser access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configuration
DB_FILE = os.path.join(os.path.dirname(__file__), "question_tracker.db")
QUESTIONS_FILE = os.path.join(os.path.dirname(__file__), "questions.md")

# Thread-local storage for database connections
thread_local = threading.local()

StatusType = Literal["not_started", "pending", "completed", "needs_review", "blocked", "in_progress"]

# Request/Response Models
class ClaimRequest(BaseModel):
    agent_id: str = Field(..., description="Unique identifier for the agent claiming the question")

class CompleteRequest(BaseModel):
    agent_id: str = Field(..., description="Agent ID that completed the question")
    filepath: str = Field(..., description="Path where the response was saved")
    notes: Optional[str] = Field(None, description="Optional notes about completion")

class UpdateStatusRequest(BaseModel):
    status: StatusType = Field(..., description="New status for the question")
    agent_id: Optional[str] = Field(None, description="Agent making the change")
    notes: Optional[str] = Field(None, description="Optional notes about the change")

class CompleteTaskRequest(BaseModel):
    agent_id: str
    branch_name: str
    pr_title: str
    pr_body: str

class SubmitWorkRequest(BaseModel):
    branch_name: str
    pr_title: str
    pr_body: str

class QuestionDetail(BaseModel):
    question_id: str
    category: str
    status: StatusType
    question_text: Optional[str] = None
    response_filepath: Optional[str] = None


def get_db_connection():
    """Get a thread-local database connection."""
    if not hasattr(thread_local, 'connection'):
        thread_local.connection = sqlite3.connect(DB_FILE, check_same_thread=False)
        thread_local.connection.row_factory = sqlite3.Row  # Enable dict-like access
    return thread_local.connection


@contextmanager
def get_db():
    """Context manager for database operations with automatic commit/rollback."""
    conn = get_db_connection()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise


def init_database():
    """Initialize the SQLite database with required tables."""
    with get_db() as conn:
        cursor = conn.cursor()

        # Create questions table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS questions (
                question_id TEXT PRIMARY KEY,
                category TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'not_started',
                question_text TEXT,
                response_filepath TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
        """)

        # Create metadata table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS metadata (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
        """)

        # Create agents_working table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS agents_working (
                agent_id TEXT PRIMARY KEY,
                question_id TEXT NOT NULL,
                started_at TEXT NOT NULL,
                FOREIGN KEY (question_id) REFERENCES questions (question_id)
            )
        """)

        # Create epics table for task management
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS epics (
                epic_id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                description TEXT,
                category TEXT,
                priority TEXT NOT NULL DEFAULT 'medium',
                status TEXT NOT NULL DEFAULT 'not_started',
                estimated_story_points INTEGER DEFAULT 0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
        """)

        # Create project_tasks table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS project_tasks (
                task_id TEXT PRIMARY KEY,
                epic_id TEXT NOT NULL,
                title TEXT NOT NULL,
                description TEXT,
                deliverables TEXT,
                guidelines TEXT,
                success_criteria TEXT,
                cloudflare_implementation TEXT,
                estimated_hours INTEGER DEFAULT 0,
                priority TEXT NOT NULL DEFAULT 'medium',
                status TEXT NOT NULL DEFAULT 'not_started',
                assigned_agent TEXT,
                pr_url TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (epic_id) REFERENCES epics (epic_id)
            )
        """)

        # Task assignments tracking
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS task_assignments (
                assignment_id TEXT PRIMARY KEY,
                task_id TEXT NOT NULL,
                agent_id TEXT NOT NULL,
                assigned_at TEXT NOT NULL,
                started_at TEXT,
                completed_at TEXT,
                notes TEXT,
                FOREIGN KEY (task_id) REFERENCES project_tasks (task_id)
            )
        """)

        # Initialize metadata if not exists
        now = datetime.utcnow().isoformat()
        cursor.execute("""
            INSERT OR IGNORE INTO metadata (key, value, updated_at)
            VALUES ('created_at', ?, ?)
        """, (now, now))

        cursor.execute("""
            INSERT OR IGNORE INTO metadata (key, value, updated_at)
            VALUES ('last_updated', ?, ?)
        """, (now, now))


def populate_questions_from_md():
    """Parse questions.md and populate the database if empty."""
    if not os.path.exists(QUESTIONS_FILE):
        return

    with get_db() as conn:
        cursor = conn.cursor()

        # Check if questions already exist
        cursor.execute("SELECT COUNT(*) FROM questions")
        if cursor.fetchone()[0] > 0:
            return  # Already populated

        # Read and parse questions.md
        with open(QUESTIONS_FILE, 'r') as f:
            content = f.read()

        # Pattern to match question sections
        pattern = r'### (C\d+Q\d+):[^\n]+\n\*\*Question:\*\*\s+([^\n]+(?:\n(?!\*\*Response filepath:\*\*)[^\n]+)*)\n\n\*\*Response filepath:\*\*\s+`([^`]+)`'

        matches = re.findall(pattern, content)
        now = datetime.utcnow().isoformat()

        for question_id, question_text, response_filepath in matches:
            category = question_id[:3]  # Extract C01, C02, etc.

            cursor.execute("""
                INSERT OR IGNORE INTO questions
                (question_id, category, question_text, response_filepath, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (question_id, category, question_text.strip(), response_filepath, now, now))


def update_last_updated():
    """Update the last_updated metadata timestamp."""
    now = datetime.utcnow().isoformat()
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE metadata SET value = ?, updated_at = ?
            WHERE key = 'last_updated'
        """, (now, now))


# --- Original Question Management Endpoints ---

@app.get("/")
def read_root():
    """Health check and API information."""
    return {
        "message": "Cloudflare Docs Question Tracker & Task Management API",
        "version": "2.0.0",
        "endpoints": {
            "questions": "/docs#/Questions",
            "tasks": "/docs#/Tasks",
            "epics": "/docs#/Epics",
            "agents": "/docs#/Agents"
        }
    }


@app.get("/questions")
def list_questions(
    category: Optional[str] = None,
    status: Optional[StatusType] = None,
    agent: Optional[str] = None
):
    """List all questions with optional filtering."""
    with get_db() as conn:
        cursor = conn.cursor()

        query = "SELECT * FROM questions"
        filters = []
        params = []

        if category:
            filters.append("category = ?")
            params.append(category)
        if status:
            filters.append("status = ?")
            params.append(status)
        if agent:
            # Join with agents_working to filter by agent
            query = """
                SELECT q.* FROM questions q
                JOIN agents_working aw ON q.question_id = aw.question_id
            """
            filters.append("aw.agent_id = ?")
            params.append(agent)

        if filters:
            query += " WHERE " + " AND ".join(filters)

        query += " ORDER BY question_id"

        cursor.execute(query, params)
        questions = cursor.fetchall()

        return [dict(row) for row in questions]


@app.get("/questions/{question_id}")
def get_question(question_id: str):
    """Get detailed information about a specific question."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM questions WHERE question_id = ?", (question_id,))
        question = cursor.fetchone()

        if not question:
            raise HTTPException(status_code=404, detail="Question not found")

        return dict(question)


@app.post("/questions/{question_id}/claim")
def claim_question(question_id: str, request: ClaimRequest):
    """Claim a question for processing by an agent."""
    with get_db() as conn:
        cursor = conn.cursor()

        # Check if question exists and is available
        cursor.execute("SELECT status FROM questions WHERE question_id = ?", (question_id,))
        row = cursor.fetchone()

        if not row:
            raise HTTPException(status_code=404, detail="Question not found")

        if row["status"] != "not_started":
            raise HTTPException(
                status_code=400,
                detail=f"Question is already {row['status']} and cannot be claimed"
            )

        # Check if agent is already working on something
        cursor.execute("SELECT question_id FROM agents_working WHERE agent_id = ?", (request.agent_id,))
        existing = cursor.fetchone()

        if existing:
            raise HTTPException(
                status_code=400,
                detail=f"Agent {request.agent_id} is already working on {existing['question_id']}"
            )

        # Claim the question
        now = datetime.utcnow().isoformat()

        cursor.execute("""
            UPDATE questions
            SET status = 'pending', updated_at = ?
            WHERE question_id = ?
        """, (now, question_id))

        cursor.execute("""
            INSERT INTO agents_working (agent_id, question_id, started_at)
            VALUES (?, ?, ?)
        """, (request.agent_id, question_id, now))

        update_last_updated()

        return {
            "question_id": question_id,
            "agent_id": request.agent_id,
            "status": "pending",
            "started_at": now
        }


@app.put("/questions/{question_id}/status")
def update_question_status(question_id: str, request: UpdateStatusRequest):
    """Update the status of a question."""
    with get_db() as conn:
        cursor = conn.cursor()

        # Get current status
        cursor.execute("SELECT status FROM questions WHERE question_id = ?", (question_id,))
        row = cursor.fetchone()

        if not row:
            raise HTTPException(status_code=404, detail="Question not found")

        old_status = row["status"]
        category = question_id[:3]
        now = datetime.utcnow().isoformat()

        # Update question status
        cursor.execute("""
            UPDATE questions
            SET status = ?, updated_at = ?
            WHERE question_id = ?
        """, (request.status, now, question_id))

        # Remove agent from working list if completed
        if request.status == "completed" and request.agent_id:
            cursor.execute("""
                DELETE FROM agents_working WHERE agent_id = ?
            """, (request.agent_id,))

        update_last_updated()

        return {
            "question_id": question_id,
            "category": category,
            "old_status": old_status,
            "new_status": request.status,
            "updated_by": request.agent_id,
            "notes": request.notes,
            "updated_at": now
        }


@app.post("/questions/{question_id}/complete")
def complete_question(question_id: str, request: CompleteRequest):
    """Mark a question as completed after the response has been saved."""
    update_req = UpdateStatusRequest(
        status="completed",
        agent_id=request.agent_id,
        notes=f"Response saved to {request.filepath}. {request.notes or ''}"
    )

    return update_question_status(question_id, update_req)


@app.get("/status")
def get_overall_status():
    """Get overall progress statistics."""
    with get_db() as conn:
        cursor = conn.cursor()

        # Get overall stats
        cursor.execute("""
            SELECT status, COUNT(*) as count
            FROM questions
            GROUP BY status
        """)

        stats = {
            "not_started": 0,
            "pending": 0,
            "completed": 0,
            "needs_review": 0,
            "blocked": 0
        }

        total = 0
        for row in cursor.fetchall():
            stats[row["status"]] = row["count"]
            total += row["count"]

        # Get category stats
        cursor.execute("""
            SELECT category, status, COUNT(*) as count
            FROM questions
            GROUP BY category, status
            ORDER BY category
        """)

        categories = {}
        for row in cursor.fetchall():
            cat = row["category"]
            if cat not in categories:
                categories[cat] = {
                    "not_started": 0,
                    "pending": 0,
                    "completed": 0,
                    "needs_review": 0,
                    "blocked": 0
                }
            categories[cat][row["status"]] = row["count"]

        # Get metadata
        cursor.execute("""
            SELECT key, value FROM metadata
            WHERE key IN ('created_at', 'last_updated')
        """)
        metadata = dict(cursor.fetchall())

        # Get working agents
        cursor.execute("SELECT agent_id FROM agents_working")
        agents_working = [row["agent_id"] for row in cursor.fetchall()]

        return {
            "total_questions": total,
            "status_breakdown": stats,
            "categories": categories,
            "agents_working": agents_working,
            "metadata": metadata
        }


# --- Epic Management Endpoints ---

@app.post("/epics/populate")
def populate_epics_and_tasks():
    """Parse documentation files and populate the database with epics and tasks."""
    epics, tasks = parse_documentation_files()

    with get_db() as conn:
        cursor = conn.cursor()

        # Insert epics
        for epic in epics:
            cursor.execute("""
                INSERT OR REPLACE INTO epics
                (epic_id, title, description, category, priority, status, estimated_story_points, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (epic.epic_id, epic.title, epic.description, epic.category, epic.priority,
                  epic.status, epic.estimated_story_points, epic.created_at, epic.updated_at))

        # Insert tasks
        for task in tasks:
            cursor.execute("""
                INSERT OR REPLACE INTO project_tasks
                (task_id, epic_id, title, description, deliverables, guidelines, success_criteria,
                 cloudflare_implementation, estimated_hours, priority, status, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (task.task_id, task.epic_id, task.title, task.description, task.deliverables,
                  task.guidelines, task.success_criteria, task.cloudflare_implementation,
                  task.estimated_hours, task.priority, task.status, task.created_at, task.updated_at))

    update_last_updated()
    return {
        "status": "success",
        "epics_created": len(epics),
        "tasks_created": len(tasks),
        "message": "Successfully populated epics and tasks from documentation files"
    }


@app.get("/epics")
def list_epics():
    """List all epics with their status."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT epic_id, title, category, priority, status FROM epics ORDER BY created_at")
        epics = cursor.fetchall()
        return [dict(row) for row in epics]


@app.get("/epics/{epic_id}")
def get_epic_details(epic_id: str):
    """Get epic details with its associated tasks."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM epics WHERE epic_id = ?", (epic_id,))
        epic = cursor.fetchone()
        if not epic:
            raise HTTPException(status_code=404, detail="Epic not found")

        cursor.execute("SELECT task_id, title, status, priority, assigned_agent FROM project_tasks WHERE epic_id = ? ORDER BY created_at", (epic_id,))
        tasks = cursor.fetchall()

        return {"epic": dict(epic), "tasks": [dict(row) for row in tasks]}


@app.put("/epics/{epic_id}/status")
def update_epic_status(epic_id: str, status_update: UpdateStatusRequest):
    """Update the status of an epic."""
    with get_db() as conn:
        cursor = conn.cursor()
        now = datetime.utcnow().isoformat()
        cursor.execute("UPDATE epics SET status = ?, updated_at = ? WHERE epic_id = ?", (status_update.status, now, epic_id))
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Epic not found")

        update_last_updated()
        return {"epic_id": epic_id, "status": status_update.status, "updated_at": now}


# --- Task Management Endpoints ---

@app.get("/tasks")
def list_tasks(status: Optional[str] = None, priority: Optional[str] = None, agent: Optional[str] = None):
    """List available tasks with optional filters."""
    with get_db() as conn:
        cursor = conn.cursor()
        query = "SELECT task_id, epic_id, title, status, priority, assigned_agent FROM project_tasks"
        filters = []
        params = []
        if status:
            filters.append("status = ?")
            params.append(status)
        if priority:
            filters.append("priority = ?")
            params.append(priority)
        if agent:
            filters.append("assigned_agent = ?")
            params.append(agent)

        if filters:
            query += " WHERE " + " AND ".join(filters)

        cursor.execute(query, params)
        tasks = cursor.fetchall()
        return [dict(row) for row in tasks]


@app.post("/tasks/claim")
def claim_task(request: ClaimRequest):
    """Claim the next available task for a given agent."""
    with get_db() as conn:
        cursor = conn.cursor()

        # Find next available task
        cursor.execute("SELECT * FROM project_tasks WHERE status = 'not_started' ORDER BY priority, created_at LIMIT 1")
        task = cursor.fetchone()

        if not task:
            raise HTTPException(status_code=404, detail="No available tasks to claim")

        task_id = task["task_id"]
        now = datetime.utcnow().isoformat()

        # Assign agent based on logic
        assigned_agent = assign_task_to_agent(dict(task))

        # Update task status and assign agent
        cursor.execute("""
            UPDATE project_tasks
            SET status = 'in_progress', assigned_agent = ?, updated_at = ?
            WHERE task_id = ?
        """, (assigned_agent, now, task_id))

        # Create a task assignment record
        assignment_id = str(uuid.uuid4())
        cursor.execute("""
            INSERT INTO task_assignments (assignment_id, task_id, agent_id, assigned_at, started_at)
            VALUES (?, ?, ?, ?, ?)
        """, (assignment_id, task_id, assigned_agent, now, now))

        update_last_updated()

        cursor.execute("SELECT * FROM project_tasks WHERE task_id = ?", (task_id,))
        updated_task = cursor.fetchone()

        return dict(updated_task)


@app.get("/tasks/{task_id}")
def get_task_details(task_id: str):
    """Get full details for a specific task."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM project_tasks WHERE task_id = ?", (task_id,))
        task = cursor.fetchone()
        if not task:
            raise HTTPException(status_code=404, detail="Task not found")
        return dict(task)


@app.put("/tasks/{task_id}/status")
def update_task_status(task_id: str, status_update: UpdateStatusRequest):
    """Update the status of a project task."""
    with get_db() as conn:
        cursor = conn.cursor()
        now = datetime.utcnow().isoformat()

        cursor.execute("UPDATE project_tasks SET status = ?, updated_at = ? WHERE task_id = ?", (status_update.status, now, task_id))
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Task not found")

        if status_update.status == 'completed' and status_update.agent_id:
            cursor.execute("UPDATE task_assignments SET completed_at = ? WHERE task_id = ? AND agent_id = ?", (now, task_id, status_update.agent_id))

        update_last_updated()
        return {"task_id": task_id, "status": status_update.status, "updated_at": now}


@app.post("/tasks/{task_id}/complete")
def complete_task(task_id: str, request: CompleteTaskRequest):
    """Mark a task as complete and create a pull request."""
    with get_db() as conn:
        cursor = conn.cursor()
        now = datetime.utcnow().isoformat()

        # Verify task exists and is in progress
        cursor.execute("SELECT * FROM project_tasks WHERE task_id = ? AND status = 'in_progress'", (task_id,))
        task = cursor.fetchone()
        if not task:
            raise HTTPException(status_code=404, detail="Task not found or not in progress")

        # Create pull request
        pr_url = create_pull_request(request.branch_name, request.pr_title, request.pr_body)

        # Update task
        cursor.execute("""
            UPDATE project_tasks
            SET status = 'completed', pr_url = ?, updated_at = ?
            WHERE task_id = ?
        """, (pr_url, now, task_id))

        # Update assignment
        cursor.execute("UPDATE task_assignments SET completed_at = ? WHERE task_id = ? AND agent_id = ?", (now, task_id, request.agent_id))

        update_last_updated()
        return {"task_id": task_id, "status": "completed", "pr_url": pr_url}


@app.get("/tasks/assigned/{agent_id}")
def get_assigned_tasks(agent_id: str):
    """Get all tasks assigned to a specific agent."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM project_tasks WHERE assigned_agent = ?", (agent_id,))
        tasks = cursor.fetchall()
        return [dict(row) for row in tasks]


# --- Agent Coordination Endpoints ---

@app.get("/agents/status")
def get_agents_status():
    """Show what each agent is currently working on."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT T.assigned_agent, T.task_id, T.title, A.started_at
            FROM project_tasks T
            JOIN task_assignments A ON T.task_id = A.task_id
            WHERE T.status = 'in_progress' AND A.completed_at IS NULL
        """)

        status = {}
        for row in cursor.fetchall():
            agent = row["assigned_agent"]
            if agent not in status:
                status[agent] = []
            status[agent].append(dict(row))
        return status


@app.post("/agents/{agent_id}/checkout")
def agent_checkout(agent_id: str):
    """Checkout the next available task for a specific agent."""
    with get_db() as conn:
        cursor = conn.cursor()

        # Find a task that is a good fit for the agent
        cursor.execute("SELECT * FROM project_tasks WHERE status = 'not_started' ORDER BY priority, created_at")
        tasks = cursor.fetchall()

        chosen_task = None
        for task_row in tasks:
            task = dict(task_row)
            preferred_agent = assign_task_to_agent(task)
            if preferred_agent == agent_id:
                chosen_task = task
                break

        if not chosen_task:
            # If no preferred task, just take the highest priority one
            if tasks:
                chosen_task = dict(tasks[0])
            else:
                raise HTTPException(status_code=404, detail="No available tasks for this agent")

        task_id = chosen_task["task_id"]
        now = datetime.utcnow().isoformat()

        # Update task status and assign agent
        cursor.execute("""
            UPDATE project_tasks
            SET status = 'in_progress', assigned_agent = ?, updated_at = ?
            WHERE task_id = ?
        """, (agent_id, now, task_id))

        # Create a task assignment record
        assignment_id = str(uuid.uuid4())
        cursor.execute("""
            INSERT INTO task_assignments (assignment_id, task_id, agent_id, assigned_at, started_at)
            VALUES (?, ?, ?, ?, ?)
        """, (assignment_id, task_id, agent_id, now, now))

        update_last_updated()

        cursor.execute("SELECT * FROM project_tasks WHERE task_id = ?", (task_id,))
        updated_task = cursor.fetchone()

        return dict(updated_task)


@app.put("/agents/{agent_id}/submit")
def agent_submit(agent_id: str, request: SubmitWorkRequest):
    """Submit completed work for the agent's active task."""
    with get_db() as conn:
        cursor = conn.cursor()

        # Find the agent's active task
        cursor.execute("SELECT * FROM project_tasks WHERE assigned_agent = ? AND status = 'in_progress'", (agent_id,))
        task = cursor.fetchone()
        if not task:
            raise HTTPException(status_code=404, detail="No active task found for this agent")

        task_id = task["task_id"]
        now = datetime.utcnow().isoformat()

        # Create pull request
        pr_url = create_pull_request(request.branch_name, request.pr_title, request.pr_body)

        # Update task
        cursor.execute("""
            UPDATE project_tasks
            SET status = 'completed', pr_url = ?, updated_at = ?
            WHERE task_id = ?
        """, (pr_url, now, task_id))

        # Update assignment
        cursor.execute("UPDATE task_assignments SET completed_at = ? WHERE task_id = ? AND agent_id = ?", (now, task_id, agent_id))

        update_last_updated()
        return {"task_id": task_id, "status": "completed", "pr_url": pr_url}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
