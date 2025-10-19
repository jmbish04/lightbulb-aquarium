# 🚀 Agent API Quick Reference

## Common API Commands for All Agents

### 📋 Task Management Commands

#### Check Available Tasks
```bash
# For VSCode Copilot (Frontend)
curl -s http://localhost:8001/tasks -G -d "agent_preference=vscode-copilot" | jq '.'

# For Codex CLI (Backend)
curl -s http://localhost:8001/tasks -G -d "agent_preference=codex-cli" | jq '.'

# For Gemini CLI (Queue/Integration)
curl -s http://localhost:8001/tasks -G -d "agent_preference=gemini-cli" | jq '.'

# For Claude CLI (Architecture/Docs)
curl -s http://localhost:8001/tasks -G -d "agent_preference=claude-cli" | jq '.'
```

#### Claim Next Task
```bash
# VSCode Copilot
curl -s -X POST http://localhost:8001/tasks/claim \
  -H 'Content-Type: application/json' \
  -d '{"agent_id":"vscode-copilot"}'

# Codex CLI
curl -s -X POST http://localhost:8001/tasks/claim \
  -H 'Content-Type: application/json' \
  -d '{"agent_id":"codex-cli"}'

# Gemini CLI
curl -s -X POST http://localhost:8001/tasks/claim \
  -H 'Content-Type: application/json' \
  -d '{"agent_id":"gemini-cli"}'

# Claude CLI
curl -s -X POST http://localhost:8001/tasks/claim \
  -H 'Content-Type: application/json' \
  -d '{"agent_id":"claude-cli"}'
```

#### Check Your Assignments
```bash
# Replace {agent-id} with your agent name
curl -s http://localhost:8001/tasks/assigned/{agent-id} | jq '.'

# Examples:
curl -s http://localhost:8001/tasks/assigned/vscode-copilot | jq '.'
curl -s http://localhost:8001/tasks/assigned/codex-cli | jq '.'
curl -s http://localhost:8001/tasks/assigned/gemini-cli | jq '.'
curl -s http://localhost:8001/tasks/assigned/claude-cli | jq '.'
```

#### Update Task Progress
```bash
# Template (replace TASK-XXX and {agent-id})
curl -s -X PUT http://localhost:8001/tasks/TASK-XXX/status \
  -H 'Content-Type: application/json' \
  -d '{
    "status":"in_progress",
    "agent_id":"{agent-id}",
    "notes":"Your progress update message"
  }'
```

#### Submit Completed Work
```bash
# Template (replace TASK-XXX, {agent-id}, and branch details)
curl -s -X POST http://localhost:8001/tasks/TASK-XXX/complete \
  -H 'Content-Type: application/json' \
  -d '{
    "agent_id":"{agent-id}",
    "branch":"{agent-id}/task-xxx-description",
    "files":["list", "of", "modified", "files"],
    "notes":"Implementation complete with details"
  }'
```

### 📊 Status and Monitoring

#### Overall System Status
```bash
curl -s http://localhost:8001/status | jq '.'
```

#### All Agents Status
```bash
curl -s http://localhost:8001/agents/status | jq '.'
```

#### Individual Agent Status
```bash
curl -s http://localhost:8001/agents/status | jq '.agents["vscode-copilot"]'
curl -s http://localhost:8001/agents/status | jq '.agents["codex-cli"]'
curl -s http://localhost:8001/agents/status | jq '.agents["gemini-cli"]'
curl -s http://localhost:8001/agents/status | jq '.agents["claude-cli"]'
```

### 🏗️ Epic Management

#### List All Epics
```bash
curl -s http://localhost:8001/epics | jq '.'
```

#### Get Epic Details
```bash
# Replace EPIC-XXX with actual epic ID
curl -s http://localhost:8001/epics/EPIC-XXX | jq '.'
```

#### Populate Tasks from Documentation
```bash
curl -s -X POST http://localhost:8001/epics/populate | jq '.'
```

## 🎯 Agent Specializations Summary

| Agent | Specialization | Primary Tasks |
|-------|---------------|---------------|
| **vscode-copilot** | Frontend & UI | React components, styling, user interfaces |
| **codex-cli** | Backend & API | Worker logic, database, API endpoints |
| **gemini-cli** | Queue & Integration | Message processing, orchestration, data flow |
| **claude-cli** | Architecture & Docs | System design, documentation, testing |

## 📁 Workspace Isolation

Each agent works in their own isolated workspace:
- `/Volumes/Projects/_ideas/lighbulb_aquarium/agents/vscode-copilot/`
- `/Volumes/Projects/_ideas/lighbulb_aquarium/agents/codex-cli/`
- `/Volumes/Projects/_ideas/lighbulb_aquarium/agents/gemini-cli/`
- `/Volumes/Projects/_ideas/lighbulb_aquarium/agents/claude-cli/`

**⚠️ IMPORTANT**: Never modify files in other agents' workspaces to prevent conflicts.

## 🌿 Branch Naming Conventions

- **vscode-copilot**: `vscode-copilot/task-XXX-description`
- **codex-cli**: `codex-cli/task-XXX-description`
- **gemini-cli**: `gemini-cli/task-XXX-description`
- **claude-cli**: `claude-cli/task-XXX-description`

## 🔄 Typical Workflow

1. **Check available tasks** for your specialization
2. **Claim a task** that matches your expertise
3. **Create a feature branch** with proper naming
4. **Implement the solution** in your workspace
5. **Update progress** as you work
6. **Submit completed work** with PR details
7. **Repeat** for the next task

Happy coding! 🚀
