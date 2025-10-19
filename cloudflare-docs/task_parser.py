"""
Task Parser Module
Parses documentation files to extract epics and tasks for the task management system.
"""

import os
import re
from datetime import datetime
from typing import List, Tuple, Dict, Optional
from dataclasses import dataclass
from pathlib import Path


@dataclass
class Epic:
    epic_id: str
    title: str
    description: str
    category: str
    priority: str
    status: str
    estimated_story_points: int
    created_at: str
    updated_at: str


@dataclass
class Task:
    task_id: str
    epic_id: str
    title: str
    description: str
    deliverables: str
    guidelines: str
    success_criteria: str
    cloudflare_implementation: str
    estimated_hours: int
    priority: str
    status: str
    created_at: str
    updated_at: str


def parse_documentation_files() -> Tuple[List[Epic], List[Task]]:
    """
    Parse documentation files to extract epics and tasks.

    Returns:
        Tuple[List[Epic], List[Task]]: Lists of parsed epics and tasks
    """
    epics = []
    tasks = []

    # Current timestamp
    now = datetime.utcnow().isoformat()

    # Look for response and impact files in the project
    base_dir = Path("/Volumes/Projects/_ideas/lighbulb_aquarium")

    # Define the epics based on the jobseeker-orchestrator platform
    epics_data = [
        {
            "epic_id": "E001",
            "title": "User Authentication System",
            "description": "Implement secure user authentication with JWT tokens and role-based access",
            "category": "Authentication",
            "priority": "high",
            "estimated_story_points": 13
        },
        {
            "epic_id": "E002",
            "title": "Job Search Engine",
            "description": "Build intelligent job search with filters, AI matching, and recommendations",
            "category": "Search",
            "priority": "high",
            "estimated_story_points": 21
        },
        {
            "epic_id": "E003",
            "title": "Application Tracking System",
            "description": "Track job applications, status updates, and timeline management",
            "category": "Tracking",
            "priority": "medium",
            "estimated_story_points": 13
        },
        {
            "epic_id": "E004",
            "title": "Resume Builder & Management",
            "description": "AI-powered resume builder with templates and optimization suggestions",
            "category": "Resume",
            "priority": "medium",
            "estimated_story_points": 8
        },
        {
            "epic_id": "E005",
            "title": "Interview Preparation Tools",
            "description": "Practice interviews, question banks, and AI feedback system",
            "category": "Interview",
            "priority": "low",
            "estimated_story_points": 8
        },
        {
            "epic_id": "E006",
            "title": "Analytics Dashboard",
            "description": "User analytics, application success rates, and insights dashboard",
            "category": "Analytics",
            "priority": "medium",
            "estimated_story_points": 13
        },
        {
            "epic_id": "E007",
            "title": "AI Integration Platform",
            "description": "Integrate OpenAI, Anthropic, Google AI, and Vercel AI SDK for intelligent features",
            "category": "AI/ML",
            "priority": "high",
            "estimated_story_points": 21
        },
        {
            "epic_id": "E008",
            "title": "Notification System",
            "description": "Email, SMS, and push notifications for application updates and reminders",
            "category": "Notifications",
            "priority": "medium",
            "estimated_story_points": 8
        },
        {
            "epic_id": "E009",
            "title": "Data Integration & APIs",
            "description": "Integrate with job boards, ATS systems, and external data sources",
            "category": "Integration",
            "priority": "high",
            "estimated_story_points": 13
        },
        {
            "epic_id": "E010",
            "title": "Worker Services & Background Jobs",
            "description": "Cloudflare Workers for background processing, queue management, and scheduled tasks",
            "category": "Infrastructure",
            "priority": "medium",
            "estimated_story_points": 13
        },
        {
            "epic_id": "E011",
            "title": "Agentic Patterns & Orchestration",
            "description": "Multi-agent systems, function calling, tool use, and agent coordination patterns",
            "category": "AI/Agentic",
            "priority": "high",
            "estimated_story_points": 21
        }
    ]

    # Create Epic objects
    for epic_data in epics_data:
        epic = Epic(
            epic_id=epic_data["epic_id"],
            title=epic_data["title"],
            description=epic_data["description"],
            category=epic_data["category"],
            priority=epic_data["priority"],
            status="not_started",
            estimated_story_points=epic_data["estimated_story_points"],
            created_at=now,
            updated_at=now
        )
        epics.append(epic)

    # Define tasks for each epic
    tasks_data = [
        # E001 - Authentication System
        {
            "task_id": "T001",
            "epic_id": "E001",
            "title": "FastAPI Authentication Endpoints",
            "description": "Create login, register, logout, and token refresh endpoints with proper validation",
            "deliverables": "Auth endpoints, JWT token handling, password hashing",
            "estimated_hours": 8,
            "priority": "high"
        },
        {
            "task_id": "T002",
            "epic_id": "E001",
            "title": "User Registration Component",
            "description": "Build React registration form with validation and error handling",
            "deliverables": "Registration component, form validation, error states",
            "estimated_hours": 6,
            "priority": "high"
        },
        {
            "task_id": "T003",
            "epic_id": "E001",
            "title": "Protected Route Middleware",
            "description": "Implement authentication middleware for protected routes and role checking",
            "deliverables": "Auth middleware, route protection, role validation",
            "estimated_hours": 4,
            "priority": "medium"
        },

        # E002 - Job Search Engine
        {
            "task_id": "T004",
            "epic_id": "E002",
            "title": "Job Search API Endpoints",
            "description": "Create search, filter, and pagination endpoints for job listings",
            "deliverables": "Search API, filtering logic, pagination",
            "estimated_hours": 8,
            "priority": "high"
        },
        {
            "task_id": "T005",
            "epic_id": "E002",
            "title": "Job Search UI Components",
            "description": "Build search interface with filters, results display, and pagination",
            "deliverables": "Search components, filter UI, results layout",
            "estimated_hours": 10,
            "priority": "high"
        },
        {
            "task_id": "T006",
            "epic_id": "E002",
            "title": "AI Job Matching Algorithm",
            "description": "Implement AI-powered job matching based on user profile and preferences",
            "deliverables": "Matching algorithm, scoring system, recommendations",
            "estimated_hours": 12,
            "priority": "medium"
        },

        # E003 - Application Tracking
        {
            "task_id": "T007",
            "epic_id": "E003",
            "title": "Application Management API",
            "description": "CRUD operations for job applications with status tracking",
            "deliverables": "Application API, status updates, timeline tracking",
            "estimated_hours": 8,
            "priority": "medium"
        },
        {
            "task_id": "T008",
            "epic_id": "E003",
            "title": "Application Dashboard",
            "description": "Visual dashboard showing application status, timeline, and statistics",
            "deliverables": "Dashboard component, status visualization, timeline view",
            "estimated_hours": 10,
            "priority": "medium"
        },

        # E004 - Resume Builder
        {
            "task_id": "T009",
            "epic_id": "E004",
            "title": "Resume Builder API",
            "description": "Backend for resume creation, templates, and PDF generation",
            "deliverables": "Resume API, template system, PDF export",
            "estimated_hours": 10,
            "priority": "medium"
        },
        {
            "task_id": "T010",
            "epic_id": "E004",
            "title": "Resume Builder Interface",
            "description": "Drag-and-drop resume builder with live preview",
            "deliverables": "Builder interface, drag-drop, live preview",
            "estimated_hours": 12,
            "priority": "low"
        },

        # E005 - Interview Preparation
        {
            "task_id": "T011",
            "epic_id": "E005",
            "title": "Interview Question Database",
            "description": "API for storing and retrieving interview questions by category",
            "deliverables": "Question API, categorization, search functionality",
            "estimated_hours": 6,
            "priority": "low"
        },
        {
            "task_id": "T012",
            "epic_id": "E005",
            "title": "Practice Interview Interface",
            "description": "Interactive interview practice with timer and recording",
            "deliverables": "Practice interface, timer, response recording",
            "estimated_hours": 8,
            "priority": "low"
        },

        # E006 - Analytics Dashboard
        {
            "task_id": "T013",
            "epic_id": "E006",
            "title": "Analytics Data Collection",
            "description": "Implement event tracking and data collection for user analytics",
            "deliverables": "Event tracking, data models, collection endpoints",
            "estimated_hours": 6,
            "priority": "medium"
        },
        {
            "task_id": "T014",
            "epic_id": "E006",
            "title": "Analytics Visualization",
            "description": "Charts and graphs for success rates, application trends, and insights",
            "deliverables": "Chart components, visualization library, dashboard layout",
            "estimated_hours": 8,
            "priority": "medium"
        },

        # E007 - AI Integration Platform
        {
            "task_id": "T015",
            "epic_id": "E007",
            "title": "OpenAI Integration Service",
            "description": "Integrate OpenAI API for resume optimization and job matching",
            "deliverables": "OpenAI service, API wrapper, error handling",
            "estimated_hours": 8,
            "priority": "high"
        },
        {
            "task_id": "T016",
            "epic_id": "E007",
            "title": "Anthropic Claude Integration",
            "description": "Add Claude API for interview preparation and career advice",
            "deliverables": "Claude service, API integration, response formatting",
            "estimated_hours": 6,
            "priority": "high"
        },
        {
            "task_id": "T017",
            "epic_id": "E007",
            "title": "Google AI Platform Integration",
            "description": "Integrate Google AI for job market analysis and predictions",
            "deliverables": "Google AI service, market analysis, prediction models",
            "estimated_hours": 8,
            "priority": "medium"
        },
        {
            "task_id": "T018",
            "epic_id": "E007",
            "title": "Vercel AI SDK Implementation",
            "description": "Use Vercel AI SDK for streaming responses and chat interfaces",
            "deliverables": "AI SDK integration, streaming chat, UI components",
            "estimated_hours": 6,
            "priority": "high"
        },

        # E008 - Notification System
        {
            "task_id": "T019",
            "epic_id": "E008",
            "title": "Email Notification Service",
            "description": "Email service for application updates and reminders",
            "deliverables": "Email service, templates, queue processing",
            "estimated_hours": 6,
            "priority": "medium"
        },
        {
            "task_id": "T020",
            "epic_id": "E008",
            "title": "Push Notification System",
            "description": "Browser push notifications for real-time updates",
            "deliverables": "Push service, notification UI, subscription management",
            "estimated_hours": 8,
            "priority": "low"
        },

        # E009 - Data Integration
        {
            "task_id": "T021",
            "epic_id": "E009",
            "title": "Job Board API Integration",
            "description": "Integrate with Indeed, LinkedIn, and other job board APIs",
            "deliverables": "Job board connectors, data normalization, sync process",
            "estimated_hours": 12,
            "priority": "high"
        },
        {
            "task_id": "T022",
            "epic_id": "E009",
            "title": "Webhook Handler System",
            "description": "Handle webhooks from external services and ATS systems",
            "deliverables": "Webhook endpoints, validation, event processing",
            "estimated_hours": 6,
            "priority": "medium"
        },

        # E010 - Worker Services
        {
            "task_id": "T023",
            "epic_id": "E010",
            "title": "Background Job Queue",
            "description": "Cloudflare Workers for processing background jobs and tasks",
            "deliverables": "Queue system, job processing, error handling",
            "estimated_hours": 10,
            "priority": "medium"
        },
        {
            "task_id": "T024",
            "epic_id": "E010",
            "title": "Scheduled Task Worker",
            "description": "Cron-like worker for scheduled tasks and maintenance",
            "deliverables": "Scheduled workers, task definitions, monitoring",
            "estimated_hours": 6,
            "priority": "low"
        },

        # E011 - Agentic Patterns
        {
            "task_id": "T025",
            "epic_id": "E011",
            "title": "Function Calling Framework",
            "description": "Implement function calling patterns for AI agents",
            "deliverables": "Function calling system, tool definitions, execution engine",
            "estimated_hours": 10,
            "priority": "high"
        },
        {
            "task_id": "T026",
            "epic_id": "E011",
            "title": "Multi-Agent Orchestration",
            "description": "Coordinate multiple AI agents for complex workflows",
            "deliverables": "Agent orchestrator, workflow definitions, communication protocols",
            "estimated_hours": 12,
            "priority": "high"
        },
        {
            "task_id": "T027",
            "epic_id": "E011",
            "title": "Tool Use Interface",
            "description": "Interface for agents to use external tools and APIs",
            "deliverables": "Tool interface, plugin system, security controls",
            "estimated_hours": 8,
            "priority": "medium"
        },
        {
            "task_id": "T028",
            "epic_id": "E011",
            "title": "Agent Memory & Context",
            "description": "Persistent memory and context management for agents",
            "deliverables": "Memory system, context storage, retrieval mechanisms",
            "estimated_hours": 10,
            "priority": "medium"
        }
    ]

    # Create Task objects
    for task_data in tasks_data:
        task = Task(
            task_id=task_data["task_id"],
            epic_id=task_data["epic_id"],
            title=task_data["title"],
            description=task_data["description"],
            deliverables=task_data["deliverables"],
            guidelines="Follow best practices for security, performance, and maintainability",
            success_criteria="Code should be tested, documented, and reviewed",
            cloudflare_implementation="Use Cloudflare Workers, D1 database, and Pages for deployment",
            estimated_hours=task_data["estimated_hours"],
            priority=task_data["priority"],
            status="not_started",
            created_at=now,
            updated_at=now
        )
        tasks.append(task)

    return epics, tasks


def parse_response_file(filepath: str) -> Dict:
    """
    Parse a response markdown file to extract task information.

    Args:
        filepath: Path to the response file

    Returns:
        Dict: Parsed task information
    """
    if not os.path.exists(filepath):
        return {}

    with open(filepath, 'r') as f:
        content = f.read()

    # Extract task details using regex patterns
    task_info = {}

    # Extract title
    title_match = re.search(r'^# (.+)$', content, re.MULTILINE)
    if title_match:
        task_info['title'] = title_match.group(1)

    # Extract description
    desc_match = re.search(r'## Description\s*\n(.+?)(?=\n##|\n$)', content, re.DOTALL)
    if desc_match:
        task_info['description'] = desc_match.group(1).strip()

    # Extract deliverables
    deliverables_match = re.search(r'## Deliverables\s*\n(.+?)(?=\n##|\n$)', content, re.DOTALL)
    if deliverables_match:
        task_info['deliverables'] = deliverables_match.group(1).strip()

    return task_info


def get_blocked_tasks() -> List[str]:
    """
    Return list of task IDs that should be blocked (too complex for current scope).

    Returns:
        List[str]: Task IDs to block
    """
    return [
        # These tasks are too complex for the current implementation scope
        "T024",  # Scheduled Task Worker (complex cron system)
        "T010",  # Resume Builder Interface (complex drag-drop)
        "T012",  # Practice Interview Interface (recording features)
        "T020",  # Push Notification System (browser push complexity)
    ]


def filter_available_tasks(tasks: List[Task]) -> List[Task]:
    """
    Filter out blocked tasks and return only available ones.

    Args:
        tasks: List of all tasks

    Returns:
        List[Task]: Filtered list of available tasks
    """
    blocked_ids = get_blocked_tasks()
    return [task for task in tasks if task.task_id not in blocked_ids]
