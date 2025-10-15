(function () {
    document.addEventListener('DOMContentLoaded', () => {
        const form = document.getElementById('research-form');
        const statusEl = document.getElementById('research-status');
        const summarySection = document.getElementById('research-summary');
        const overviewEl = document.getElementById('research-overview');
        const repoGrid = document.getElementById('research-repos');

        if (!form || !statusEl || !summarySection || !overviewEl || !repoGrid) {
            return;
        }

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

            statusEl.textContent = 'Requesting GitHub research brief...';
            summarySection.classList.add('hidden');

            try {
                const response = await fetch('/api/github/research', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (!response.ok) {
                    const error = await response.json().catch(() => ({}));
                    throw new Error(error.error || 'Research workflow failed.');
                }

                const data = await response.json();
                statusEl.textContent = `Research brief ${data.briefId} completed.`;
                renderOverview(overviewEl, data.overview);
                renderRepos(repoGrid, data.repositories || []);
                summarySection.classList.remove('hidden');
            } catch (error) {
                statusEl.textContent = `Error: ${error.message}`;
            }
        });

        function renderOverview(container, overview) {
            container.innerHTML = '';
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
                    li.innerHTML = `<span class="font-semibold">${item.repo}</span> — ${item.rationale}`;
                    list.appendChild(li);
                });
                container.appendChild(list);
            }
        }

        function renderRepos(container, repos) {
            container.innerHTML = '';
            if (!Array.isArray(repos) || repos.length === 0) {
                container.innerHTML = '<p class="text-gray-500 dark:text-gray-400">No repositories analysed yet.</p>';
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
                    apis.innerHTML = `
                        <h3 class="text-sm font-semibold text-gray-900 dark:text-white">Notable APIs</h3>
                        <ul class="mt-1 flex flex-wrap gap-2 text-xs">
                            ${repo.notable_apis.map((api) => `<li class="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded">${api}</li>`).join('')}
                        </ul>
                    `;
                    card.appendChild(apis);
                }

                if (Array.isArray(repo.findings) && repo.findings.length > 0) {
                    const findings = document.createElement('div');
                    findings.innerHTML = `
                        <h3 class="text-sm font-semibold text-gray-900 dark:text-white mt-2">Key Findings</h3>
                        <ul class="mt-1 list-disc list-inside text-xs text-gray-600 dark:text-gray-300 space-y-1">
                            ${repo.findings.map((finding) => `<li>${finding}</li>`).join('')}
                        </ul>
                    `;
                    card.appendChild(findings);
                }

                container.appendChild(card);
            });
        }
    });
})();
