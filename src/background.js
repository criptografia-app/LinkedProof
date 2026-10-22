// Background Script - Gist Storage Logic

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'HAS_TOKEN') {
        chrome.storage.sync.get({ githubToken: '' }).then(s => sendResponse(!!s.githubToken));
        return true;
    }
    if (request.type === 'SAVE_GIST') {
        handleSave(request.payload).then(sendResponse);
        return true;
    }
    // Forward to every frame of the sender's tab: the post composer is in a
    // child frame. Only the frame holding the editor answers.
    if (request.type === 'RELAY' && sender.tab) {
        chrome.tabs.sendMessage(sender.tab.id, request.msg)
            .then(sendResponse, () => sendResponse(null));
        return true;
    }
    // A composer button inside a child frame asks the top frame to sign.
    if (request.type === 'RELAY_TOP' && sender.tab) {
        chrome.tabs.sendMessage(sender.tab.id, request.msg, { frameId: 0 }).catch(() => {});
        return false;
    }
});

async function handleSave(data) {
    const result = await saveToGist(data);

    if (result.success) {
        await logHistory({
            timestamp: data.timestamp,
            signature: data.signature,
            url: result.url,
            htmlUrl: result.url
        });
    } else {
        console.warn('Gist save failed:', result.error);
    }

    return result;
}

// Save to Gist (POST /gists)
async function saveToGist(data) {
    try {
        const { signature, address, timestamp, rawData } = data;

        const storage = await chrome.storage.sync.get({ githubToken: '' });
        const token = storage.githubToken;

        if (!token) {
            return { success: false, error: 'NO_TOKEN' };
        }

        // Short hash for filename (e.g., PROOF_0x12345678.json)
        const shortHash = signature.substring(0, 12);
        const filename = `PROOF_${shortHash}.json`;

        // Full JSON dump, no cuts
        const content = JSON.stringify(rawData, null, 2);

        const response = await fetch('https://api.github.com/gists', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/vnd.github+json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                description: `CRIPTOGRAFIA Proof: Digital Signing`,
                public: true,
                files: {
                    [filename]: {
                        content: content
                    }
                }
            })
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.message || 'GitHub API Error');
        }

        const resData = await response.json();

        // Use the Human-Readable Gist Page URL for the signature link
        const gistUrl = resData.html_url;
        const rawUrl = resData.files[filename].raw_url;

        return { success: true, url: gistUrl, rawUrl: rawUrl };

    } catch (error) {
        console.error('Gist Error:', error);
        return { success: false, error: error.message };
    }
}

async function logHistory(entry) {
    try {
        const storage = await chrome.storage.local.get({ history: [] });
        const newHistory = [...storage.history, entry];
        if (newHistory.length > 50) newHistory.shift();
        await chrome.storage.local.set({ history: newHistory });
    } catch (e) {
        console.error('Failed to save history', e);
    }
}
