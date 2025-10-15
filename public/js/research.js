(function () {
    document.addEventListener('DOMContentLoaded', () => {
        const form = document.getElementById('research-form');
        const statusEl = document.getElementById('research-status');
        const summarySection = document.getElementById('research-summary');
        const overviewEl = document.getElementById('research-overview');
        const repoGrid = document.getElementById('research-repos');
        const historyButton = document.getElementById('research-history-button');
        const historyContainer = document.getElementById('research-history');

        if (!form || !statusEl || !summarySection || !overviewEl || !repoGrid || !historyButton || !historyContainer) {
            return;
        }

        historyContainer.classList.add('hidden');

        let ws = null;
        let pendingPayload = null;
        const statusMessages = [];

        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            const formData = new FormData(form);
            const seedInput = String(formData.get('seedRepos') || '').trim();
            const seeds = seedInput
                ? seedInput.split(',').map((value) => value.trim()).filter(Boolean)
                : [];

            const payload = {
                topic: formData.get('topic'),
                seedRepos: seeds,
                maxRepos: formData.get('maxRepos') ? Number(formData.get('maxRepos')) : undefined,
                token: formData.get('token') ? String(formData.get('token')) : undefined
            };

            statusMessages.length = 0;
            statusMessages.push('Connecting to DynamicAgent...');
            statusEl.textContent = statusMessages.join(' • ');
            summarySection.classList.add('hidden');

            try {
                startResearch(payload);
            } catch (error) {
                statusEl.textContent = `Error: ${error.message}`;
            }
        });

        historyButton.addEventListener('click', async () => {
            const isHidden = historyContainer.classList.toggle('hidden');
            historyButton.textContent = isHidden ? 'View Past Research' : 'Hide Past Research';
            if (!isHidden) {
                await loadHistory();
            }
        });

        async function loadHistory() {
            try {
                historyContainer.replaceChildren();
                const response = await fetch('/api/memory/research');
                if (!response.ok) {
                    throw new Error('Unable to load research briefs.');
                }
                const data = await response.json();
                const briefs = Array.isArray(data?.briefs) ? data.briefs : [];

                if (briefs.length === 0) {
                    const empty = document.createElement('p');
                    empty.className = 'p-6 text-gray-500 dark:text-gray-400';
                    empty.textContent = 'No research briefs have been logged yet.';
                    historyContainer.appendChild(empty);
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

                    historyContainer.appendChild(card);
                });
            } catch (error) {
                const message = document.createElement('p');
                message.className = 'p-6 text-sm text-red-600 dark:text-red-400';
                message.textContent = error.message;
                historyContainer.appendChild(message);
            }
        }

        function startResearch(payload) {
            const message = {
                agent: 'github_agent',
                tool: 'startGithubResearch',
                params: payload
            };

            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify(message));
                return;
            }

            pendingPayload = message;
            if (ws && ws.readyState === WebSocket.CONNECTING) {
                return;
            }

            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = `${protocol}//${window.location.host}/`;
            ws = new WebSocket(wsUrl);

            ws.addEventListener('open', () => {
                if (pendingPayload) {
                    ws.send(JSON.stringify(pendingPayload));
                    pendingPayload = null;
                }
            });

            ws.addEventListener('message', (event) => {
                handleSocketMessage(event);
            });

            ws.addEventListener('close', () => {
                ws = null;
            });

            ws.addEventListener('error', () => {
                ws = null;
                statusEl.textContent = 'WebSocket connection failed.';
            });
        }

        function handleSocketMessage(event) {
            try {
                const data = JSON.parse(event.data);
                if (data.type === 'status') {
                    statusMessages.push(data.message);
                    statusEl.textContent = statusMessages.join(' • ');
                } else if (data.type === 'result' && data.tool === 'startGithubResearch') {
                    const result = data.result || {};
                    const briefId = result.briefId ? `Research brief ${result.briefId} completed.` : 'Research brief completed.';
                    statusMessages.push(briefId);
                    statusEl.textContent = statusMessages.join(' • ');
                    renderOverview(overviewEl, result.overview);
                    renderRepos(repoGrid, result.repositories || []);
                    summarySection.classList.remove('hidden');
                    if (!historyContainer.classList.contains('hidden')) {
                        loadHistory();
                    }
                } else if (data.type === 'error') {
                    statusEl.textContent = `Error: ${data.message}`;
                }
            } catch (error) {
                statusEl.textContent = `Error: ${error.message}`;
            }
        }

        function renderOverview(container, overview) {
            container.replaceChildren();
            if (!overview) {
                container.textContent = 'No overview returned by the agent.';
                return;
            }

            const paragraph = document.createElement('p');
            paragraph.textContent = overview.overall_summary || overview;
            container.appendChild(paragraph);

            if (Array.isArray(overview.top_recommendations) && overview.top_recommendations.length > 0) {
                const list = document.createElement('ul');
                list.className = 'list-disc list-inside text-sm text-gray-700 dark:text-gray-200 space-y-1';
                overview.top_recommendations.forEach((item) => {
                    const li = document.createElement('li');
                    const repoName = document.createElement('span');
                    repoName.className = 'font-semibold';
                    repoName.textContent = item.repo;
                    li.appendChild(repoName);

                    li.appendChild(document.createTextNode(' — '));
                    li.appendChild(document.createTextNode(item.rationale));
                    list.appendChild(li);
                });
                container.appendChild(list);
            }
        }

        function renderRepos(container, repos) {
            container.replaceChildren();
            if (!Array.isArray(repos) || repos.length === 0) {
                const empty = document.createElement('p');
                empty.className = 'text-gray-500 dark:text-gray-400';
                empty.textContent = 'No repositories analysed yet.';
                container.appendChild(empty);
                return;
            }

            repos.forEach((repo) => {
                const card = document.createElement('article');
                card.className = 'border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 p-5 shadow-sm flex flex-col space-y-3';

                const header = document.createElement('div');
                header.className = 'flex items-start justify-between';

                const link = document.createElement('a');
                link.href = repo.url;
                link.target = '_blank';
                link.rel = 'noopener noreferrer';
                link.className = 'text-blue-600 dark:text-blue-400 font-semibold hover:underline';
                link.textContent = repo.repo;

                const badge = document.createElement('span');
                badge.className = 'px-2 py-1 text-xs font-semibold rounded bg-green-100 text-green-800 dark:bg-green-900/60 dark:text-green-200';
                const numericFit = typeof repo.fit_score === 'number' ? repo.fit_score : Number(repo.fit_score || 0);
                const clamped = Math.max(0, Math.min(1, isNaN(numericFit) ? 0 : numericFit));
                badge.textContent = `Fit ${(clamped * 100).toFixed(0)}%`;

                header.appendChild(link);
                header.appendChild(badge);
                card.appendChild(header);

                const summary = document.createElement('p');
                summary.className = 'text-sm text-gray-700 dark:text-gray-200';
                summary.textContent = repo.summary;
                card.appendChild(summary);

                if (Array.isArray(repo.notable_apis) && repo.notable_apis.length > 0) {
                    const apis = document.createElement('div');
                    const apiTitle = document.createElement('h3');
                    apiTitle.className = 'text-sm font-semibold text-gray-900 dark:text-white';
                    apiTitle.textContent = 'Notable APIs';
                    apis.appendChild(apiTitle);

                    const apiList = document.createElement('ul');
                    apiList.className = 'mt-1 flex flex-wrap gap-2 text-xs';
                    repo.notable_apis.forEach((api) => {
                        const apiItem = document.createElement('li');
                        apiItem.className = 'px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded';
                        apiItem.textContent = api;
                        apiList.appendChild(apiItem);
                    });

                    apis.appendChild(apiList);
                    card.appendChild(apis);
                }

                if (Array.isArray(repo.findings) && repo.findings.length > 0) {
                    const findings = document.createElement('div');
                    const findingsTitle = document.createElement('h3');
                    findingsTitle.className = 'text-sm font-semibold text-gray-900 dark:text-white mt-2';
                    findingsTitle.textContent = 'Key Findings';
                    findings.appendChild(findingsTitle);

                    const findingsList = document.createElement('ul');
                    findingsList.className = 'mt-1 list-disc list-inside text-xs text-gray-600 dark:text-gray-300 space-y-1';
                    repo.findings.forEach((finding) => {
                        const findingItem = document.createElement('li');
                        findingItem.textContent = finding;
                        findingsList.appendChild(findingItem);
                    });

                    findings.appendChild(findingsList);
                    card.appendChild(findings);
                }

                container.appendChild(card);
            });
        }
    });
})();
