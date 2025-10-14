# 🎯 Comprehensive Task Management System Prompt

ROLE: You are a senior full-stack developer tasked with extending the existing Cloudflare docs question tracker into a comprehensive project task management system for building the jobseeker-orchestrator platform.

CONTEXT FILES TO ANALYZE:
- Read `/Volumes/Projects/_ideas/lighbulb_aquarium/context.md` (project vision)
- Read `/Volumes/Projects/_ideas/lighbulb_aquarium/1stdraft.md` (technical architecture)
- Parse ALL files in `/Volumes/Projects/_ideas/lighbulb_aquarium/cloudflare-docs/responses/` (excluding quarantine folder)

EXISTING SYSTEM:
- Extend `/Volumes/Projects/_ideas/lighbulb_aquarium/cloudflare-docs/api_server_sqlite.py`
- Keep all existing functionality intact
- Database file: `question_tracker.db`

TASK: Create a comprehensive epic and task management system with the following components:

---

## 1. DATABASE SCHEMA EXTENSION

Add these new tables to the existing SQLite database:

```sql
-- Epics table (high-level feature areas)
CREATE TABLE epics (
    epic_id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL,  -- e.g., "Assets Binding", "Queue System", "Authentication"
    priority TEXT NOT NULL,  -- "High", "Medium", "Low"
    status TEXT DEFAULT 'not_started',  -- "not_started", "in_progress", "completed", "blocked"
    estimated_story_points INTEGER,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Project tasks table (specific implementation tasks)
CREATE TABLE project_tasks (
    task_id TEXT PRIMARY KEY,  -- e.g., "TASK-001", "TASK-002"
    epic_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    deliverables TEXT NOT NULL,  -- JSON array of expected deliverables
    guidelines TEXT NOT NULL,   -- Extracted from impact.md files
    success_criteria TEXT NOT NULL,  -- Clear success metrics
    cloudflare_implementation TEXT NOT NULL,  -- JSON object with CF Workers specifics
    estimated_hours INTEGER,
    priority TEXT NOT NULL,
    status TEXT DEFAULT 'not_started',
    assigned_agent TEXT,
    branch_name TEXT,  -- Git branch for this task
    pr_url TEXT,       -- GitHub PR URL when submitted
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (epic_id) REFERENCES epics (epic_id)
);

-- Task assignments tracking
CREATE TABLE task_assignments (
    assignment_id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL,
    agent_id TEXT NOT NULL,  -- "vscode-copilot", "codex-cli", "gemini-cli", "claude-cli"
    assigned_at TEXT NOT NULL,
    started_at TEXT,
    completed_at TEXT,
    notes TEXT,
    FOREIGN KEY (task_id) REFERENCES project_tasks (task_id)
);
```

---

## 2. CONTENT PARSING REQUIREMENTS

Parse the following from ALL response.md and impact.md files:

### From Impact Files:
- **Epic category** (from the question category)
- **Implementation priority** (High/Medium/Low)
- **Affected files** (for deliverables)
- **Dependencies** (for task ordering)
- **Implementation notes** (for guidelines)
- **Testing checklist** (for success criteria)

### From Response Files:
- **Technical specifications** (API signatures, configurations)
- **Code examples** (for implementation guidelines)
- **Best practices** (for guidelines)
- **Cloudflare-specific patterns** (for cloudflare_implementation JSON)

### Epic Creation Logic:
Group tasks by category:
- "C1: ASSETS Binding" → Epic: "Static Asset Serving System"
- "C3: R2 Storage" → Epic: "File Storage and Management"
- "C5: Queues" → Epic: "Message Queue System"
- "C10: Observability" → Epic: "Monitoring and Logging"
- etc.

---

## 3. API ENDPOINTS TO IMPLEMENT

Extend api_server_sqlite.py with these new endpoints:

### Epic Management:
```
GET /epics - List all epics with status
POST /epics/populate - Parse files and create epics/tasks
GET /epics/{epic_id} - Get epic details with tasks
PUT /epics/{epic_id}/status - Update epic status
```

### Task Management:
```
GET /tasks - List available tasks (with filters)
POST /tasks/claim - Claim next available task
GET /tasks/{task_id} - Get task details
PUT /tasks/{task_id}/status - Update task status
POST /tasks/{task_id}/complete - Mark task complete with PR
GET /tasks/assigned/{agent_id} - Get tasks for specific agent
```

### Agent Coordination:
```
GET /agents/status - Show what each agent is working on
POST /agents/{agent_id}/checkout - Checkout next available task
PUT /agents/{agent_id}/submit - Submit completed work with PR
```

---

## 4. TASK ASSIGNMENT STRATEGY

Implement intelligent task assignment:

### Agent Specializations:
- **vscode-copilot**: Frontend components, UI/UX, TypeScript interfaces
- **codex-cli**: Core Worker logic, API endpoints, backend systems
- **gemini-cli**: Queue processing, data handling, integration logic

### Assignment Logic:
```typescript
// Example task assignment based on content
if (task.title.includes("frontend") || task.deliverables.includes("component")) {
    preferredAgent = "vscode-copilot";
} else if (task.title.includes("api") || task.deliverables.includes("endpoint")) {
    preferredAgent = "codex-cli";
} else if (task.title.includes("queue") || task.title.includes("processing")) {
    preferredAgent = "gemini-cli";
}
```

### Parallel Work Prevention:
- Ensure no two agents work on the same files
- Create dependency chains for sequential tasks
- Use branch naming convention: `agent-name/task-id-short-description`

---

## 5. CLOUDFLARE IMPLEMENTATION JSON FORMAT

Each task should include a cloudflare_implementation JSON field:

```json
{
    "wrangler_config": {
        "bindings_required": ["ASSETS", "QUEUE", "D1"],
        "compatibility_date": "2025-04-01",
        "environment_vars": ["API_KEY", "SECRET"]
    },
    "worker_structure": {
        "main_handler": "src/index.ts",
        "additional_files": ["src/queue-consumer.ts", "src/types.ts"]
    },
    "api_patterns": {
        "request_handling": "fetch(request, env, ctx)",
        "response_format": "JSON | HTML | Stream",
        "error_handling": "try/catch with custom Response"
    },
    "performance_considerations": [
        "Use streaming for large responses",
        "Implement proper caching headers",
        "Handle Worker memory limits"
    ],
    "testing_requirements": [
        "Unit tests with Vitest",
        "Integration tests with wrangler dev",
        "Performance testing with load"
    ]
}
```

---

## 6. GITHUB INTEGRATION

Implement GitHub workflow automation:

### Branch Management:
```typescript
// Create branch for each task
const branchName = `${agentId}/${taskId}-${slugify(taskTitle)}`;
```

### PR Submission Format:
```markdown
# Task: {task.title}

## Epic: {epic.title}

## Implementation Details
{task.description}

## Deliverables Completed
- [ ] {deliverable1}
- [ ] {deliverable2}

## Testing Completed
- [ ] {success_criteria1}
- [ ] {success_criteria2}

## Cloudflare Workers Specifics
{cloudflare_implementation.summary}

Closes #{task_id}
```

### Repository Details:
- **Target repo**: `jmbish04/lightbulb-aquarium`
- **Base branch**: `main`
- **PR title format**: `[{epic.category}] {task.title}`

---

## 7. IMPLEMENTATION REQUIREMENTS

### File Organization:
```
/cloudflare-docs/
├── api_server_sqlite.py (extend existing)
├── task_parser.py (new - parse response/impact files)
├── github_integration.py (new - GitHub API calls)
├── agent_coordinator.py (new - task assignment logic)
└── models/
    ├── epic.py (new - Epic data model)
    ├── task.py (new - Task data model)
    └── assignment.py (new - Assignment data model)
```

### Key Functions to Implement:
1. `parse_documentation_files()` - Extract tasks from markdown
2. `create_epics_and_tasks()` - Populate database from parsed content
3. `assign_task_to_agent()` - Intelligent task assignment
4. `create_github_branch()` - Git branch creation
5. `submit_pull_request()` - PR submission automation
6. `update_task_status()` - Status tracking with notifications

---

## 8. SUCCESS CRITERIA

The system should:
✅ Parse 28+ completed response/impact files successfully
✅ Create 8-12 epics representing major feature areas
✅ Generate 50-100 specific implementation tasks
✅ Support 3 agents working in parallel without conflicts
✅ Automatically create GitHub branches and PRs
✅ Track progress from task assignment to PR merge
✅ Provide real-time status dashboard for all agents
✅ Maintain backward compatibility with existing question tracker

---

## 9. EXAMPLE USAGE WORKFLOW

```bash
# 1. Populate epics and tasks from documentation
curl -X POST http://localhost:8001/epics/populate

# 2. Agent claims next available task
curl -X POST http://localhost:8001/tasks/claim \
  -d '{"agent_id":"vscode-copilot"}'

# 3. Agent updates progress
curl -X PUT http://localhost:8001/tasks/TASK-001/status \
  -d '{"status":"in_progress","notes":"Started implementing component"}'

# 4. Agent submits completed work
curl -X POST http://localhost:8001/tasks/TASK-001/complete \
  -d '{"agent_id":"vscode-copilot","branch":"vscode-copilot/task-001-assets-component","files":["src/components/AssetViewer.tsx"]}'
```

START IMPLEMENTATION: Begin by extending the database schema, then implement the content parsing logic, followed by the API endpoints and GitHub integration.
