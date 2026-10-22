document.addEventListener('DOMContentLoaded', () => {
    const tokenInput = document.getElementById('token');
    const saveBtn = document.getElementById('save');
    const settingsPanel = document.getElementById('settings_panel');
    const dashboardPanel = document.getElementById('dashboard_panel');
    const settingsToggle = document.getElementById('settings_toggle');
    const statusDot = document.getElementById('connection_status');
    const statusText = document.getElementById('connection_text');
    const historyList = document.getElementById('history_list');
    const emptyHistory = document.getElementById('empty_history');

    // LOAD STATE
    chrome.storage.sync.get(['githubToken'], (sync) => {
        chrome.storage.local.get(['history'], (local) => {
            const token = sync.githubToken;
            const history = local.history || [];

            // UI State
            if (token) {
                tokenInput.value = token;
                statusDot.classList.add('active');
                statusText.innerText = "Gist Linked (Ready)";
            } else {
                statusDot.classList.remove('active');
                statusText.innerText = "No token: signing is off";
                settingsPanel.classList.remove('hidden'); // Show settings if no token
            }

            // Render History
            renderHistory(history);
        });
    });

    // RENDER HELPER
    function renderHistory(items) {
        historyList.innerHTML = '';
        if (!items || items.length === 0) {
            emptyHistory.style.display = 'block';
            return;
        }

        emptyHistory.style.display = 'none';
        // Show last 5
        const recent = items.slice().reverse().slice(0, 5);

        recent.forEach(item => {
            const li = document.createElement('li');
            li.className = 'history-item';

            const dateObj = new Date(item.timestamp);
            const dateStr = dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

            const shortSig = item.signature.substring(0, 6) + '...' + item.signature.substring(item.signature.length - 4);

            li.innerHTML = `
                <div class="row">
                    <span class="date">${dateStr}</span>
                    <a href="${item.url}" target="_blank">View Gist ↗</a>
                </div>
                <div class="row" style="color:#444; font-family:monospace; font-size:10px;">
                    ${shortSig}
                </div>
            `;
            historyList.appendChild(li);
        });
    }

    // EVENT HANDLERS
    settingsToggle.addEventListener('click', () => {
        settingsPanel.classList.toggle('hidden');
    });

    saveBtn.addEventListener('click', () => {
        const val = tokenInput.value.trim();
        chrome.storage.sync.set({ githubToken: val }, () => {
            const msg = document.getElementById('status_msg');
            msg.style.display = 'block';

            // Update UI
            if (val) {
                statusDot.classList.add('active');
                statusText.innerText = "Gist Linked (Ready)";
            } else {
                statusDot.classList.remove('active');
                statusText.innerText = "Disconnected";
            }

            setTimeout(() => {
                msg.style.display = 'none';
                settingsPanel.classList.add('hidden');
            }, 1000);
        });
    });
});
