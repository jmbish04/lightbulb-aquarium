"""
Agent Coordinator Module
Handles intelligent task assignment based on agent specializations.
"""

from typing import Dict, List, Optional
import re


def assign_task_to_agent(task: Dict) -> str:
    """
    Intelligently assign a task to the most suitable agent based on:
    - Task description and type
    - Agent specializations
    - Current workload (future enhancement)

    Agent Specializations:
    - vscode-copilot: Frontend, UI/UX, React, JavaScript, CSS
    - codex-cli: Backend, APIs, Server logic, Database integration
    - gemini-cli: Queue systems, Integrations, Third-party services
    - claude-cli: Architecture, Design patterns, Code organization

    Args:
        task: Dictionary containing task details (title, description, etc.)

    Returns:
        str: Agent ID that should handle this task
    """

    task_title = task.get('title', '').lower()
    task_description = task.get('description', '').lower()
    task_text = f"{task_title} {task_description}"

    # Frontend/UI keywords for vscode-copilot
    frontend_keywords = [
        'ui', 'interface', 'frontend', 'react', 'component', 'dashboard',
        'form', 'input', 'button', 'css', 'styling', 'responsive',
        'javascript', 'typescript', 'jsx', 'html', 'dom', 'browser',
        'client-side', 'user experience', 'ux', 'design'
    ]

    # Backend/API keywords for codex-cli
    backend_keywords = [
        'api', 'server', 'backend', 'database', 'sql', 'crud',
        'endpoint', 'route', 'middleware', 'authentication', 'auth',
        'validation', 'schema', 'model', 'controller', 'service',
        'fastapi', 'flask', 'django', 'express', 'node'
    ]

    # Integration/Queue keywords for gemini-cli
    integration_keywords = [
        'queue', 'message', 'webhook', 'integration', 'third-party',
        'external api', 'sync', 'async', 'batch', 'worker',
        'job', 'task queue', 'redis', 'rabbitmq', 'kafka',
        'email', 'notification', 'sms', 'payment', 'stripe'
    ]

    # Architecture/Design keywords for claude-cli
    architecture_keywords = [
        'architecture', 'design pattern', 'structure', 'organization',
        'framework', 'system design', 'scalability', 'performance',
        'optimization', 'refactor', 'code review', 'best practices',
        'documentation', 'planning', 'strategy', 'security'
    ]

    # Count keyword matches for each agent
    scores = {
        'vscode-copilot': sum(1 for keyword in frontend_keywords if keyword in task_text),
        'codex-cli': sum(1 for keyword in backend_keywords if keyword in task_text),
        'gemini-cli': sum(1 for keyword in integration_keywords if keyword in task_text),
        'claude-cli': sum(1 for keyword in architecture_keywords if keyword in task_text)
    }

    # Special rules based on task patterns

    # If it's a Workers API or server task, prefer codex-cli
    if any(term in task_text for term in ['worker api', 'server', 'fastapi', 'sqlite']):
        scores['codex-cli'] += 3

    # If it's about UI components or frontend, prefer vscode-copilot
    if any(term in task_text for term in ['component', 'dashboard', 'frontend', 'react']):
        scores['vscode-copilot'] += 3

    # If it's about integrations or external services, prefer gemini-cli
    if any(term in task_text for term in ['integration', 'webhook', 'external', 'queue']):
        scores['gemini-cli'] += 3

    # If it's about documentation or architecture, prefer claude-cli
    if any(term in task_text for term in ['documentation', 'architecture', 'design', 'planning']):
        scores['claude-cli'] += 3

    # Find the agent with the highest score
    best_agent = max(scores, key=scores.get)

    # If no clear winner (all scores are 0 or tied), use round-robin or default
    if scores[best_agent] == 0:
        # Default assignment based on task epic or fallback to codex-cli
        epic_id = task.get('epic_id', '')
        if 'ui' in epic_id or 'frontend' in epic_id:
            return 'vscode-copilot'
        elif 'integration' in epic_id or 'queue' in epic_id:
            return 'gemini-cli'
        elif 'docs' in epic_id or 'architecture' in epic_id:
            return 'claude-cli'
        else:
            return 'codex-cli'  # Default to backend specialist

    return best_agent


def get_agent_specializations() -> Dict[str, Dict]:
    """
    Return detailed information about each agent's specializations.

    Returns:
        Dict: Agent specializations and capabilities
    """
    return {
        'vscode-copilot': {
            'name': 'VSCode Copilot',
            'specialization': 'Frontend Development',
            'skills': [
                'React Components',
                'JavaScript/TypeScript',
                'CSS/Styling',
                'UI/UX Design',
                'Client-side Logic',
                'Browser APIs',
                'Responsive Design'
            ],
            'preferred_tasks': [
                'Dashboard creation',
                'Form components',
                'User interfaces',
                'Frontend logic'
            ]
        },
        'codex-cli': {
            'name': 'Codex CLI',
            'specialization': 'Backend Development',
            'skills': [
                'API Development',
                'Database Design',
                'Server Logic',
                'Authentication',
                'FastAPI/Flask',
                'SQL/Database Operations',
                'Server Configuration'
            ],
            'preferred_tasks': [
                'API endpoints',
                'Database schemas',
                'Server setup',
                'Backend services'
            ]
        },
        'gemini-cli': {
            'name': 'Gemini CLI',
            'specialization': 'Integrations & Queues',
            'skills': [
                'Third-party APIs',
                'Message Queues',
                'Webhooks',
                'Background Jobs',
                'External Services',
                'Async Processing',
                'Data Synchronization'
            ],
            'preferred_tasks': [
                'API integrations',
                'Queue systems',
                'Webhook handlers',
                'Background processing'
            ]
        },
        'claude-cli': {
            'name': 'Claude CLI',
            'specialization': 'Architecture & Design',
            'skills': [
                'System Architecture',
                'Design Patterns',
                'Code Organization',
                'Documentation',
                'Best Practices',
                'Performance Optimization',
                'Security Review'
            ],
            'preferred_tasks': [
                'Architecture planning',
                'Code organization',
                'Documentation',
                'Design reviews'
            ]
        }
    }


def get_agent_workload(agent_id: str) -> int:
    """
    Get the current workload for an agent.

    This is a placeholder for future implementation that would
    check the database for active tasks assigned to the agent.

    Args:
        agent_id: The agent to check workload for

    Returns:
        int: Number of active tasks (0 for now)
    """
    # TODO: Implement actual workload checking from database
    return 0


def balance_workload(task: Dict, preferred_agents: List[str]) -> str:
    """
    Balance workload across agents when multiple agents could handle a task.

    Args:
        task: The task to assign
        preferred_agents: List of agents that could handle the task

    Returns:
        str: The chosen agent ID
    """
    if not preferred_agents:
        return 'codex-cli'  # Default fallback

    if len(preferred_agents) == 1:
        return preferred_agents[0]

    # For now, return the first preferred agent
    # TODO: Implement actual workload balancing
    return preferred_agents[0]
