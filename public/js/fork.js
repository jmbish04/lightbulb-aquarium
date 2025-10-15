(function () {
    document.addEventListener('DOMContentLoaded', () => {
        const form = document.getElementById('fork-plan-form');
        const statusEl = document.getElementById('fork-status');
        const resultCard = document.getElementById('fork-result-card');
        const resultEl = document.getElementById('fork-result');

        if (!form || !statusEl || !resultCard || !resultEl) {
            return;
        }

        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            const formData = new FormData(form);
            const payload = {
                repoUrl: formData.get('repoUrl'),
                newRepoName: formData.get('newRepoName'),
                taskDescription: formData.get('taskDescription'),
                token: formData.get('token') ? String(formData.get('token')) : undefined
            };

            statusEl.textContent = 'Launching forkAndPlan workflow...';
            resultCard.classList.add('hidden');

            try {
                const response = await fetch('/api/github/fork-plan', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (!response.ok) {
                    const error = await response.json().catch(() => ({}));
                    throw new Error(error.error || 'Unable to start workflow.');
                }

                const data = await response.json();
                statusEl.textContent = data.message || 'Workflow complete.';

                renderPlan(resultEl, data);
                resultCard.classList.remove('hidden');
            } catch (error) {
                statusEl.textContent = `Error: ${error.message}`;
            }
        });

        function renderPlan(container, data) {
            container.innerHTML = '';
            const repoLink = document.createElement('a');
            repoLink.href = data.newRepoUrl;
            repoLink.target = '_blank';
            repoLink.rel = 'noopener noreferrer';
            repoLink.className = 'text-blue-600 dark:text-blue-400 underline';
            repoLink.textContent = data.newRepoUrl;

            const summary = document.createElement('p');
            summary.className = 'text-base';
            summary.textContent = data.plan?.summary || 'No summary returned by the agent.';

            const list = document.createElement('div');
            list.className = 'space-y-4';

            (data.plan?.milestones || []).forEach((milestone, index) => {
                const card = document.createElement('div');
                card.className = 'border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-800';

                const title = document.createElement('h3');
                title.className = 'font-semibold text-gray-900 dark:text-white';
                title.textContent = `${index + 1}. ${milestone.title}`;
                card.appendChild(title);

                const goal = document.createElement('p');
                goal.className = 'text-sm text-gray-600 dark:text-gray-300 mt-1';
                goal.textContent = milestone.goal;
                card.appendChild(goal);

                if (Array.isArray(milestone.tasks) && milestone.tasks.length > 0) {
                    const taskList = document.createElement('ul');
                    taskList.className = 'mt-3 space-y-1 list-disc list-inside text-sm text-gray-700 dark:text-gray-200';
                    milestone.tasks.forEach((task) => {
                        const li = document.createElement('li');
                        li.textContent = task;
                        taskList.appendChild(li);
                    });
                    card.appendChild(taskList);
                }

                const hoursValue = Number(milestone.estimated_hours);
                if (!isNaN(hoursValue) && hoursValue > 0) {
                    const hours = document.createElement('p');
                    hours.className = 'mt-2 text-xs text-gray-500';
                    hours.textContent = `Estimated effort: ${hoursValue}h`;
                    card.appendChild(hours);
                }

                list.appendChild(card);
            });

            container.appendChild(repoLink);
            container.appendChild(summary);
            container.appendChild(list);

            if (Array.isArray(data.plan?.risk_register) && data.plan.risk_register.length > 0) {
                const risks = document.createElement('div');
                risks.className = 'mt-6';

                const title = document.createElement('h3');
                title.className = 'text-lg font-semibold text-gray-900 dark:text-white';
                title.textContent = 'Risk Register';
                risks.appendChild(title);

                const riskList = document.createElement('ul');
                riskList.className = 'mt-2 space-y-2';

                data.plan.risk_register.forEach((entry) => {
                    const li = document.createElement('li');
                    li.className = 'p-3 rounded border border-amber-300 bg-amber-50 dark:bg-amber-900/40 dark:border-amber-700';
                    li.innerHTML = `<strong class="block text-amber-800 dark:text-amber-300">${entry.risk}</strong><span class="text-sm text-amber-700 dark:text-amber-200">Mitigation: ${entry.mitigation}</span>`;
                    riskList.appendChild(li);
                });

                risks.appendChild(riskList);
                container.appendChild(risks);
            }

            if (Array.isArray(data.plan?.success_metrics) && data.plan.success_metrics.length > 0) {
                const metrics = document.createElement('div');
                metrics.className = 'mt-6';
                metrics.innerHTML = `
                    <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">Success Metrics</h3>
                    <ul class="list-disc list-inside text-sm text-gray-700 dark:text-gray-200 space-y-1">
                        ${data.plan.success_metrics.map((metric) => `<li>${metric}</li>`).join('')}
                    </ul>
                `;
                container.appendChild(metrics);
            }
        }
    });
})();
