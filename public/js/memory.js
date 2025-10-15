(function () {
    document.addEventListener('DOMContentLoaded', () => {
        const projectsBody = document.getElementById('memory-projects-body');
        const projectsCount = document.getElementById('memory-projects-count');
        const errorsContainer = document.getElementById('memory-errors');
        const errorsCount = document.getElementById('memory-errors-count');
        const researchContainer = document.getElementById('memory-research');
        const researchCount = document.getElementById('memory-research-count');

        if (!projectsBody || !errorsContainer || !researchContainer) {
            return;
        }

        loadProjects();
        loadErrors();
        loadResearch();

        async function loadProjects() {
            const data = await fetchJson('/api/memory/projects');
            const projects = data?.projects || [];
            projectsCount.textContent = `${projects.length} stored`;
            projectsBody.innerHTML = '';

            if (projects.length === 0) {
                const row = document.createElement('tr');
                row.innerHTML = '<td colspan="4" class="px-6 py-4 text-center text-gray-500">No projects recorded yet.</td>';
                projectsBody.appendChild(row);
                return;
            }

            projects.forEach((project) => {
                const plan = safeParse(project.plan_json);
                const row = document.createElement('tr');
                row.className = 'bg-white border-b dark:bg-gray-900 dark:border-gray-700';
                row.innerHTML = `
                    <td class="px-6 py-4 font-medium text-gray-900 whitespace-nowrap dark:text-white">${project.name}</td>
                    <td class="px-6 py-4"><span class="inline-flex items-center px-2 py-1 text-xs font-semibold rounded bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200">${project.status}</span></td>
                    <td class="px-6 py-4"><a class="text-blue-600 dark:text-blue-400 underline" target="_blank" rel="noopener" href="${project.github_url}">Repository</a></td>
                    <td class="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">${plan?.summary || 'No plan captured.'}</td>
                `;
                projectsBody.appendChild(row);
            });
        }

        async function loadErrors() {
            const data = await fetchJson('/api/memory/errors');
            const consultations = data?.consultations || [];
            errorsCount.textContent = `${consultations.length} records`;
            errorsContainer.innerHTML = '';

            if (consultations.length === 0) {
                errorsContainer.innerHTML = '<p class="p-6 text-gray-500">No debugging requests saved yet.</p>';
                return;
            }

            consultations.forEach((item) => {
                const block = document.createElement('article');
                block.className = 'p-6 space-y-3 bg-white dark:bg-gray-900';
                block.innerHTML = `
                    <div class="flex items-start justify-between">
                        <div>
                            <h3 class="text-lg font-semibold text-gray-900 dark:text-white">${item.error_message}</h3>
                            <p class="mt-1 text-sm text-gray-600 dark:text-gray-300">${item.stack_trace || 'No stack trace provided.'}</p>
                        </div>
                        <span class="px-2 py-1 text-xs font-semibold rounded bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200">${item.status || 'pending'}</span>
                    </div>
                    <div class="text-sm text-gray-600 dark:text-gray-300">${item.analysis || 'Awaiting deep analysis.'}</div>
                    ${item.suggested_fix ? `<div class="text-sm text-emerald-600 dark:text-emerald-300">Suggested fix: ${item.suggested_fix}</div>` : ''}
                `;
                errorsContainer.appendChild(block);
            });
        }

        async function loadResearch() {
            const data = await fetchJson('/api/memory/research');
            const briefs = data?.briefs || [];
            researchCount.textContent = `${briefs.length} briefs`;
            researchContainer.innerHTML = '';

            if (briefs.length === 0) {
                researchContainer.innerHTML = '<p class="p-6 text-gray-500">No research briefs have been logged yet.</p>';
                return;
            }

            briefs.forEach((brief) => {
                const card = document.createElement('article');
                card.className = 'p-6 space-y-2 bg-white dark:bg-gray-900';
                card.innerHTML = `
                    <div class="flex items-center justify-between">
                        <h3 class="text-lg font-semibold text-gray-900 dark:text-white">${brief.topic}</h3>
                        <span class="px-2 py-1 text-xs font-semibold rounded bg-purple-100 text-purple-800 dark:bg-purple-900/60 dark:text-purple-200">${brief.status}</span>
                    </div>
                    <p class="text-sm text-gray-600 dark:text-gray-300">${brief.summary || 'No summary recorded.'}</p>
                    <p class="text-xs text-gray-400">Created at ${new Date(brief.created_at).toLocaleString()}</p>
                `;
                researchContainer.appendChild(card);
            });
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
