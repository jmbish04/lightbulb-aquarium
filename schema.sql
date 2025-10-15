-- This file contains the complete D1 schema for the platform.
-- Apply it using: npx wrangler d1 execute lightbulb-aquarium-db --file=schema.sql

-- Best Practices Service
CREATE TABLE best_practices (
  id TEXT PRIMARY KEY,
  topic TEXT NOT NULL,
  guidance TEXT NOT NULL,
  source TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Development Projects Service
CREATE TABLE development_projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    github_url TEXT,
    status TEXT DEFAULT 'planning', -- e.g., planning, active, completed, archived
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE development_consultations (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    question TEXT NOT NULL,
    context TEXT,
    agent_response TEXT,
    status TEXT DEFAULT 'pending', -- e.g., pending, answered, resolved
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES development_projects(id)
);

-- Error Consultation Service
CREATE TABLE error_consultations (
    id TEXT PRIMARY KEY,
    error_message TEXT NOT NULL,
    stack_trace TEXT,
    code_snippet TEXT,
    analysis TEXT,
    suggested_fix TEXT,
    status TEXT DEFAULT 'reported', -- e.g., reported, analyzing, fixed, unresolved
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Research Service
CREATE TABLE research_briefs (
    id TEXT PRIMARY KEY,
    topic TEXT NOT NULL,
    summary TEXT,
    status TEXT DEFAULT 'pending', -- e.g., pending, researching, complete
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE research_repos_reviewed (
    id TEXT PRIMARY KEY,
    brief_id TEXT NOT NULL,
    repo_url TEXT NOT NULL,
    review_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (brief_id) REFERENCES research_briefs(id)
);

CREATE TABLE research_findings (
    id TEXT PRIMARY KEY,
    brief_id TEXT NOT NULL,
    finding TEXT NOT NULL,
    source_repo_id TEXT,
    source_file_path TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (brief_id) REFERENCES research_briefs(id),
    FOREIGN KEY (source_repo_id) REFERENCES research_repos_reviewed(id)
);