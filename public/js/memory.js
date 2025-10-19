(function () {
    document.addEventListener('DOMContentLoaded', () => {
        const projectsBody = document.getElementById('memory-projects-body');
        const projectsCount = document.getElementById('memory-projects-count');
        const errorsContainer = document.getElementById('memory-errors');
        const errorsCount = document.getElementById('memory-errors-count');
        const researchContainer = document.getElementById('memory-research');
        const researchCount = document.getElementById('memory-research-count');
        const bestPracticesList = document.getElementById('best-practices-list');
        const bestPracticesCount = document.getElementById('memory-best-count');
        const bestPracticesForm = document.getElementById('best-practices-form');

        if (!projectsBody || !projectsCount || !errorsContainer || !errorsCount || !researchContainer || !researchCount || !bestPracticesList || !bestPracticesCount || !bestPracticesForm) {
            return;
        }

        loadProjects();
        loadErrors();
        loadResearch();
        loadBestPractices();

        bestPracticesForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const formData = new FormData(bestPracticesForm);
            const topic = String(formData.get('topic') || '').trim();
            const guidance = String(formData.get('guidance') || '').trim();
            const source = String(formData.get('source') || '').trim();

            if (!topic || !guidance) {
                alert('Topic and guidance are required.');
                return;
            }

            try {
                const response = await fetch('/api/memory/best-practices', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ topic, guidance, source: source || undefined })
                });

                if (!response.ok) {
                    const error = await response.json().catch(() => ({}));
                    throw new Error(error.error || 'Failed to create best practice.');
                }

                bestPracticesForm.reset();
                await loadBestPractices();
            } catch (error) {
                console.error(error);
                alert(error.message);
            }
        });

        async function loadProjects() {
            const data = await fetchJson('/api/memory/projects');
            const projects = Array.isArray(data?.projects) ? data.projects : [];
            projectsCount.textContent = `${projects.length} stored`;
            projectsBody.replaceChildren();

            if (projects.length === 0) {
                const row = document.createElement('tr');
                row.className = 'bg-white dark:bg-gray-900';
                const cell = document.createElement('td');
                cell.colSpan = 4;
                cell.className = 'px-6 py-4 text-center text-gray-500 dark:text-gray-400';
                cell.textContent = 'No projects recorded yet.';
                row.appendChild(cell);
                projectsBody.appendChild(row);
                return;
            }

            projects.forEach((project) => {
                const plan = safeParse(project.plan_json);
                const row = document.createElement('tr');
                row.className = 'bg-white border-b dark:bg-gray-900 dark:border-gray-700';

                const nameCell = document.createElement('td');
                nameCell.className = 'px-6 py-4 font-medium text-gray-900 whitespace-nowrap dark:text-white';
                nameCell.textContent = project.name;
                row.appendChild(nameCell);

                const statusCell = document.createElement('td');
                statusCell.className = 'px-6 py-4';
                const statusBadge = document.createElement('span');
                statusBadge.className = 'inline-flex items-center px-2 py-1 text-xs font-semibold rounded bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200';
                statusBadge.textContent = project.status || 'pending';
                statusCell.appendChild(statusBadge);
                row.appendChild(statusCell);

                const repoCell = document.createElement('td');
                repoCell.className = 'px-6 py-4';
                if (project.github_url) {
                    const link = document.createElement('a');
                    link.href = project.github_url;
                    link.target = '_blank';
                    link.rel = 'noopener noreferrer';
                    link.className = 'text-blue-600 dark:text-blue-400 underline';
                    link.textContent = 'Repository';
                    repoCell.appendChild(link);
                } else {
                    const missing = document.createElement('span');
                    missing.className = 'text-sm text-gray-400';
                    missing.textContent = 'Not provided';
                    repoCell.appendChild(missing);
                }
                row.appendChild(repoCell);

                const summaryCell = document.createElement('td');
                summaryCell.className = 'px-6 py-4 text-sm text-gray-600 dark:text-gray-300';
                summaryCell.textContent = plan?.summary || 'No plan captured.';
                row.appendChild(summaryCell);

                projectsBody.appendChild(row);
            });
        }

        async function loadErrors() {
            const data = await fetchJson('/api/memory/errors');
            const consultations = Array.isArray(data?.consultations) ? data.consultations : [];
            errorsCount.textContent = `${consultations.length} records`;
            errorsContainer.replaceChildren();

            if (consultations.length === 0) {
                const empty = document.createElement('p');
                empty.className = 'p-6 text-gray-500 dark:text-gray-400';
                empty.textContent = 'No debugging requests saved yet.';
                errorsContainer.appendChild(empty);
                return;
            }

            consultations.forEach((item) => {
                const block = document.createElement('article');
                block.className = 'p-6 space-y-3 bg-white dark:bg-gray-900';

                const header = document.createElement('div');
                header.className = 'flex items-start justify-between gap-4';

                const details = document.createElement('div');
                const title = document.createElement('h3');
                title.className = 'text-lg font-semibold text-gray-900 dark:text-white';
                title.textContent = item.error_message;
                details.appendChild(title);

                const trace = document.createElement('p');
                trace.className = 'mt-1 text-sm text-gray-600 dark:text-gray-300';
                trace.textContent = item.stack_trace || 'No stack trace provided.';
                details.appendChild(trace);

                header.appendChild(details);

                const status = document.createElement('span');
                status.className = 'px-2 py-1 text-xs font-semibold rounded bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200';
                status.textContent = item.status || 'pending';
                header.appendChild(status);

                block.appendChild(header);

                const analysis = document.createElement('div');
                analysis.className = 'text-sm text-gray-600 dark:text-gray-300';
                analysis.textContent = item.analysis || 'Awaiting deep analysis.';
                block.appendChild(analysis);

                if (item.suggested_fix) {
                    const fix = document.createElement('div');
                    fix.className = 'text-sm text-emerald-600 dark:text-emerald-300';
                    fix.textContent = `Suggested fix: ${item.suggested_fix}`;
                    block.appendChild(fix);
                }

                errorsContainer.appendChild(block);
            });
        }

        async function loadResearch() {
            const data = await fetchJson('/api/memory/research');
            const briefs = Array.isArray(data?.briefs) ? data.briefs : [];
            researchCount.textContent = `${briefs.length} briefs`;
            researchContainer.replaceChildren();

            if (briefs.length === 0) {
                const empty = document.createElement('p');
                empty.className = 'p-6 text-gray-500 dark:text-gray-400';
                empty.textContent = 'No research briefs have been logged yet.';
                researchContainer.appendChild(empty);
                return;
            }

            briefs.forEach((brief) => {
                const card = document.createElement('article');
                card.className = 'p-6 space-y-2 bg-white dark:bg-gray-900';

                const header = document.createElement('div');
                header.className = 'flex items-center justify-between';

                const title = document.createElement('h3');
                title.className = 'text-lg font-semibold text-gray-900 dark:text-white';
                title.textContent = brief.topic;
                header.appendChild(title);

                const status = document.createElement('span');
                status.className = 'px-2 py-1 text-xs font-semibold rounded bg-purple-100 text-purple-800 dark:bg-purple-900/60 dark:text-purple-200';
                status.textContent = brief.status || 'pending';
                header.appendChild(status);

                card.appendChild(header);

                const summary = document.createElement('p');
                summary.className = 'text-sm text-gray-600 dark:text-gray-300';
                summary.textContent = brief.summary || 'No summary recorded.';
                card.appendChild(summary);

                if (brief.created_at) {
                    const created = document.createElement('p');
                    created.className = 'text-xs text-gray-400';
                    created.textContent = `Created at ${new Date(brief.created_at).toLocaleString()}`;
                    card.appendChild(created);
                }

                researchContainer.appendChild(card);
            });
        }

        async function loadBestPractices() {
            const data = await fetchJson('/api/memory/best-practices');
            const practices = Array.isArray(data?.bestPractices) ? data.bestPractices : [];
            bestPracticesCount.textContent = `${practices.length} entries`;
            bestPracticesList.replaceChildren();

            if (practices.length === 0) {
                const empty = document.createElement('p');
                empty.className = 'text-sm text-gray-500 dark:text-gray-400';
                empty.textContent = 'No best practices have been captured yet.';
                bestPracticesList.appendChild(empty);
                return;
            }

            practices.forEach((practice) => {
                bestPracticesList.appendChild(createBestPracticeCard(practice));
            });
        }

        function createBestPracticeCard(practice) {
            const card = document.createElement('article');
            card.className = 'p-6 space-y-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg';

            const header = document.createElement('div');
            header.className = 'flex items-start justify-between gap-4';

            const details = document.createElement('div');

            const title = document.createElement('h3');
            title.className = 'text-lg font-semibold text-gray-900 dark:text-white';
            title.textContent = practice.topic;
            details.appendChild(title);

            const source = document.createElement('p');
            source.className = 'text-xs text-gray-500 dark:text-gray-400';
            source.textContent = practice.source ? `Source: ${practice.source}` : 'Source: N/A';
            details.appendChild(source);

            header.appendChild(details);

            const actions = document.createElement('div');
            actions.className = 'flex items-center gap-2';

            const editButton = document.createElement('button');
            editButton.type = 'button';
            editButton.className = 'px-3 py-1 text-xs font-medium text-blue-600 border border-blue-200 rounded hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-300 dark:text-blue-300 dark:border-blue-500/60 dark:hover:bg-blue-900/40';
            editButton.textContent = 'Edit';
            editButton.addEventListener('click', () => openEditor(card, practice));
            actions.appendChild(editButton);

            const deleteButton = document.createElement('button');
            deleteButton.type = 'button';
            deleteButton.className = 'px-3 py-1 text-xs font-medium text-red-600 border border-red-200 rounded hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-300 dark:text-red-300 dark:border-red-500/60 dark:hover:bg-red-900/40';
            deleteButton.textContent = 'Delete';
            deleteButton.addEventListener('click', async () => {
                if (confirm('Delete this best practice?')) {
                    await deleteBestPractice(practice.id);
                }
            });
            actions.appendChild(deleteButton);

            header.appendChild(actions);
            card.appendChild(header);

            const guidance = document.createElement('p');
            guidance.className = 'text-sm text-gray-600 dark:text-gray-300';
            guidance.textContent = practice.guidance;
            card.appendChild(guidance);

            if (practice.created_at) {
                const created = document.createElement('p');
                created.className = 'text-xs text-gray-400';
                created.textContent = `Created at ${new Date(practice.created_at).toLocaleString()}`;
                card.appendChild(created);
            }

            return card;
        }

        function openEditor(card, practice) {
            card.replaceChildren();

            const form = document.createElement('form');
            form.className = 'space-y-4';

            const topicLabel = document.createElement('label');
            topicLabel.className = 'flex flex-col text-sm font-medium text-gray-700 dark:text-gray-200';
            topicLabel.textContent = 'Topic';
            const topicInput = document.createElement('input');
            topicInput.type = 'text';
            topicInput.required = true;
            topicInput.value = practice.topic;
            topicInput.className = 'mt-1 rounded-lg border border-gray-300 bg-gray-50 p-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white';
            topicLabel.appendChild(topicInput);
            form.appendChild(topicLabel);

            const guidanceLabel = document.createElement('label');
            guidanceLabel.className = 'flex flex-col text-sm font-medium text-gray-700 dark:text-gray-200';
            guidanceLabel.textContent = 'Guidance';
            const guidanceInput = document.createElement('textarea');
            guidanceInput.required = true;
            guidanceInput.rows = 3;
            guidanceInput.value = practice.guidance;
            guidanceInput.className = 'mt-1 rounded-lg border border-gray-300 bg-gray-50 p-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white';
            guidanceLabel.appendChild(guidanceInput);
            form.appendChild(guidanceLabel);

            const sourceLabel = document.createElement('label');
            sourceLabel.className = 'flex flex-col text-sm font-medium text-gray-700 dark:text-gray-200';
            sourceLabel.textContent = 'Source';
            const sourceInput = document.createElement('input');
            sourceInput.type = 'text';
            sourceInput.value = practice.source || '';
            sourceInput.className = 'mt-1 rounded-lg border border-gray-300 bg-gray-50 p-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white';
            sourceLabel.appendChild(sourceInput);
            form.appendChild(sourceLabel);

            const actions = document.createElement('div');
            actions.className = 'flex items-center gap-2';

            const saveButton = document.createElement('button');
            saveButton.type = 'submit';
            saveButton.className = 'px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-300 dark:bg-blue-500 dark:hover:bg-blue-600';
            saveButton.textContent = 'Save';
            actions.appendChild(saveButton);

            const cancelButton = document.createElement('button');
            cancelButton.type = 'button';
            cancelButton.className = 'px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-4 focus:ring-gray-200 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-800';
            cancelButton.textContent = 'Cancel';
            cancelButton.addEventListener('click', () => {
                const freshCard = createBestPracticeCard(practice);
                card.replaceWith(freshCard);
            });
            actions.appendChild(cancelButton);

            form.appendChild(actions);

            form.addEventListener('submit', async (event) => {
                event.preventDefault();
                const update = {
                    topic: topicInput.value.trim(),
                    guidance: guidanceInput.value.trim(),
                    source: sourceInput.value.trim()
                };

                if (!update.topic || !update.guidance) {
                    alert('Topic and guidance are required.');
                    return;
                }

                try {
                    await updateBestPractice(practice.id, update);
                    await loadBestPractices();
                } catch (error) {
                    console.error(error);
                    alert(error.message);
                }
            });

            card.appendChild(form);
        }

        async function updateBestPractice(id, updates) {
            const payload = {
                topic: updates.topic,
                guidance: updates.guidance,
                source: updates.source || undefined
            };
            const response = await fetch(`/api/memory/best-practices/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.error || 'Failed to update best practice.');
            }
        }

        async function deleteBestPractice(id) {
            try {
                const response = await fetch(`/api/memory/best-practices/${id}`, { method: 'DELETE' });
                if (!response.ok) {
                    const error = await response.json().catch(() => ({}));
                    throw new Error(error.error || 'Failed to delete best practice.');
                }
                await loadBestPractices();
            } catch (error) {
                console.error(error);
                alert(error.message);
            }
        }

        async function fetchJson(url) {
            try {
                const response = await fetch(url);
                if (!response.ok) {
                    throw new Error(`Failed to load ${url}`);
                }
                return await response.json();
            } catch (error) {
                console.error(error);
                return null;
            }
        }

        function safeParse(value) {
            if (!value || typeof value !== 'string') {
                return null;
            }
            try {
                return JSON.parse(value);
            } catch (error) {
                return null;
            }
        }
    });
})();
