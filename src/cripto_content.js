// CRIPTOGRAFIA LINKEDIN SIGNER - Content Script
// Runs in Isolated World, in every frame: LinkedIn's post composer lives in
// its own frame, so each frame can read/fill an editor, and only the top frame
// shows the button and talks to the wallet (cripto_page.js).

(function () {
    const isTop = window === window.top;
    const { normalizePost, NORMALIZATION } = window.CRIPTO_NORMALIZE;

    // Editor this frame read the post from; the signature line goes back into it.
    let capturedEditor = null;

    // Post composer only: never the messaging box or a comment box.
    const EDITOR_SELECTORS = [
        '.ql-editor[contenteditable="true"]',
        'div[data-test-ql-editor-content="true"]',
        'div[aria-label="Text editor for creating content"]',
        '.share-creation-state__text-editor [contenteditable="true"]',
        '[role="dialog"] [contenteditable="true"]',
        '.artdeco-modal [contenteditable="true"]'
    ];
    const EXCLUDED = '.msg-form, .msg-overlay-conversation-bubble, .comments-comment-box, .comments-comment-texteditor';

    function visible(el) {
        return el.getClientRects().length > 0;
    }

    // LinkedIn renders the composer inside open shadow roots (e.g. #interop-outlet),
    // which document.querySelectorAll does not search.
    function roots() {
        const out = [document];
        for (let i = 0; i < out.length; i++) {
            for (const el of out[i].querySelectorAll('*')) {
                if (el.shadowRoot) out.push(el.shadowRoot);
            }
        }
        return out;
    }

    // closest() that also climbs out of shadow roots.
    function composedClosest(el, sel) {
        while (el) {
            const hit = el.closest(sel);
            if (hit) return hit;
            const root = el.getRootNode();
            el = root instanceof ShadowRoot ? root.host : null;
        }
        return null;
    }

    function findEditor() {
        const rs = roots();
        for (const sel of EDITOR_SELECTORS) {
            for (const r of rs) {
                for (const el of r.querySelectorAll(sel)) {
                    if (visible(el) && !composedClosest(el, EXCLUDED)) return el;
                }
            }
        }
        // Fallback: a large rich-text box inside a dialog, wherever the dialog is.
        for (const r of rs) {
            for (const el of r.querySelectorAll('[contenteditable="true"]')) {
                if (visible(el) && el.getBoundingClientRect().height >= 60 &&
                    composedClosest(el, 'dialog, [role="dialog"], .artdeco-modal') &&
                    !composedClosest(el, EXCLUDED)) return el;
            }
        }
        return null;
    }

    function moveCursorToEnd(el) {
        el.focus();
        const range = document.createRange();
        range.selectNodeContents(el);
        range.collapse(false);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
    }

    function insertLine(el, line) {
        moveCursorToEnd(el);
        document.execCommand('insertParagraph');
        return document.execCommand('insertText', false, line);
    }

    // Frames that have no editor stay silent, so the frame that has one answers.
    chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
        if (msg.type === 'READ_EDITOR') {
            const el = findEditor();
            if (!el) return false;
            capturedEditor = el;
            el.style.outline = '2px solid #00ff00';
            setTimeout(() => el.style.outline = '', 1000);
            sendResponse({ text: el.innerText });
            return false;
        }
        if (msg.type === 'INSERT_SIGNATURE') {
            const el = capturedEditor && capturedEditor.isConnected ? capturedEditor : null;
            if (!el) return false;
            let ok = false;
            try { ok = insertLine(el, msg.line); } catch (e) { console.error('[CRIPTOGRAFIA] Insert error:', e); }
            sendResponse({ ok });
            return false;
        }
        if (msg.type === 'START_SIGN' && startSign) {
            startSign();
            return false;
        }
        return false;
    });

    // Set by the top frame, which owns the wallet bridge (cripto_page.js).
    let startSign = null;

    function makeButton(id, size, onClick) {
        const btn = document.createElement('div');
        btn.id = id;
        btn.title = 'Sign this post with CRIPTOGRAFIA';
        const img = document.createElement('img');
        img.src = chrome.runtime.getURL('icons/icon128.png');
        img.alt = '🔐';
        img.style.cssText = 'width: 100%; height: 100%; border-radius: 50%; object-fit: cover; pointer-events: none;';
        btn.appendChild(img);
        btn.style.cssText = `
            width: ${size}px;
            height: ${size}px;
            background: #f4f1e8;
            border: ${size > 40 ? 3 : 2}px solid #00ff41;
            box-sizing: border-box;
            overflow: hidden;
            border-radius: 50%;
            box-shadow: 0 2px 10px rgba(0,0,0,0.4);
            cursor: pointer;
            z-index: 2147483647;
            opacity: 0.75;
            transition: opacity 0.2s, transform 0.2s;
        `;
        btn.onmouseover = () => { btn.style.opacity = '1'; btn.style.transform = 'scale(1.1)'; };
        btn.onmouseout = () => { btn.style.opacity = '0.75'; btn.style.transform = 'scale(1)'; };
        // Keep focus (and the caret) in the composer when the button is pressed.
        btn.onmousedown = (e) => e.preventDefault();
        btn.onclick = (e) => { e.preventDefault(); e.stopPropagation(); onClick(); };
        return btn;
    }

    // The composer is a modal: everything outside it is inert, so the sign
    // button has to live inside it, pinned to the editor's top-right corner.
    // Part of el actually on screen: long posts scroll inside the composer, so
    // the editor's own top edge is often hidden under the dialog header.
    function visibleRect(el) {
        const r = el.getBoundingClientRect();
        let top = Math.max(r.top, 0), bottom = Math.min(r.bottom, innerHeight);
        let left = Math.max(r.left, 0), right = Math.min(r.right, innerWidth);
        for (let n = el.parentElement || el.getRootNode().host; n; n = n.parentElement || (n.getRootNode() instanceof ShadowRoot ? n.getRootNode().host : null)) {
            const cs = getComputedStyle(n);
            if (cs.overflowY === 'visible' && cs.overflowX === 'visible') continue;
            const c = n.getBoundingClientRect();
            top = Math.max(top, c.top + n.clientTop);
            bottom = Math.min(bottom, c.top + n.clientTop + n.clientHeight);
            left = Math.max(left, c.left + n.clientLeft);
            right = Math.min(right, c.left + n.clientLeft + n.clientWidth);
        }
        return { top, bottom, left, right };
    }

    // The composer is a modal: everything outside it is inert, so the sign
    // button has to live inside it, pinned to the top-right of the visible text.
    let composerEditor = null;
    let ticks = 0;

    function placeComposerButton() {
        // Re-search for the editor every second; reposition in between.
        if (!composerEditor || !composerEditor.isConnected || !visible(composerEditor) || ticks++ % 4 === 0) {
            composerEditor = findEditor();
        }
        const el = composerEditor;
        let btn = document.getElementById('cripto-composer-btn') ||
            (el && el.getRootNode().getElementById && el.getRootNode().getElementById('cripto-composer-btn'));
        if (!el) {
            if (btn) btn.remove();
            return;
        }
        // Stay in the editor's own tree: a light-DOM ancestor of a shadow root
        // would not render the button.
        const inShadow = el.getRootNode() instanceof ShadowRoot;
        const host = el.closest('dialog, [role="dialog"], .artdeco-modal') ||
            (inShadow ? el.parentElement : document.body);
        if (!btn) {
            btn = makeButton('cripto-composer-btn', 34, () => {
                if (startSign) startSign();
                else chrome.runtime.sendMessage({ type: 'RELAY_TOP', msg: { type: 'START_SIGN' } });
            });
        }
        if (btn.parentElement !== host) host.appendChild(btn);

        const v = visibleRect(el);
        const x = v.right - 46, y = v.top + 8;
        if (host === document.body) {
            btn.style.position = 'fixed';
            btn.style.left = x + 'px';
            btn.style.top = y + 'px';
        } else {
            if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
            const h = host.getBoundingClientRect();
            btn.style.position = 'absolute';
            btn.style.left = (x - h.left - host.clientLeft + host.scrollLeft) + 'px';
            btn.style.top = (y - h.top - host.clientTop + host.scrollTop) + 'px';
        }
    }

    setInterval(() => {
        if (!document.hidden) placeComposerButton();
    }, 250);

    if (!isTop) return;

    console.log('[CRIPTOGRAFIA] script loaded (post hash version)');

    document.addEventListener('CRIPTOGRAFIA_RESP', (event) => {
        const data = event.detail;
        if (!data) return;

        if (data.type === 'SUCCESS') {
            handleSuccess(data.payload);
        } else if (data.type === 'ERROR') {
            if (data.error && data.error.includes('User rejected')) {
                console.log('[CRIPTOGRAFIA] User rejected.');
            } else {
                alert('CRIPTOGRAFIA Error: ' + data.error);
            }
        }
    });

    async function handleSuccess(payload) {
        const { signature, address, timestamp } = payload;

        showNotification('⏳ Saving proof...', '#ffff00', 4000);

        let response = null;
        try {
            const savePromise = chrome.runtime.sendMessage({
                type: 'SAVE_GIST',
                payload: { signature, address, timestamp, rawData: payload }
            });
            const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('timed out after 15 s')), 15000));
            response = await Promise.race([savePromise, timeoutPromise]);
        } catch (e) {
            response = { success: false, error: e.message };
        }

        // Only a saved Gist goes into the post. A signature line without a
        // working proof link would look verified and prove nothing.
        if (!response || !response.success) {
            const why = response && response.error === 'NO_TOKEN' ? 'no GitHub token set' : (response && response.error) || 'unknown error';
            console.warn('[CRIPTOGRAFIA] Save failed:', why);
            showNotification('⚠️ Proof not saved: ' + why + '. Nothing was added to the post.', '#ffa500', 8000);
            return;
        }
        console.log('[CRIPTOGRAFIA] Gist Saved:', response.url);
        appendSignature(signature, response.url);
    }

    function showNotification(text, color, duration = 4000) {
        const existing = document.getElementById('cripto-notif');
        if (existing) existing.remove();

        const n = document.createElement('div');
        n.id = 'cripto-notif';
        n.innerText = text;
        n.style.cssText = `position: fixed; top: 20px; right: 20px; background: ${color}; color: #000; padding: 15px 25px; border-radius: 8px; z-index: 2147483647; font-weight: bold; box-shadow: 0 4px 15px rgba(0,0,0,0.4); font-family: sans-serif; pointer-events: none;`;
        document.body.appendChild(n);
        setTimeout(() => n.remove(), duration);
    }

    async function appendSignature(signature, proofUrl) {
        const shortHash = signature.substring(0, 12) + "...";
        const line = `🔐 Digitally Signed by CRIPTOGRAFIA [${shortHash}](${proofUrl})`;
        console.log('[CRIPTOGRAFIA] Appending signature:', proofUrl);

        let res = null;
        try {
            res = await chrome.runtime.sendMessage({ type: 'RELAY', msg: { type: 'INSERT_SIGNATURE', line } });
        } catch (e) { console.error('[CRIPTOGRAFIA] Relay error:', e); }

        if (res && res.ok) {
            showNotification('✅ Signed & Embedded!', '#00ff00');
        } else {
            console.log('[CRIPTOGRAFIA] Direct insert failed. Using Clipboard.');
            showNotification('📋 Copied! Paste (Ctrl+V) at the end of the post.', '#00ff00', 6000);
            navigator.clipboard.writeText(line).catch(() => prompt("Copy signature:", line));
        }
    }

    async function sha256Hex(str) {
        const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
        return Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, '0')).join('');
    }

    async function requestSign() {
        // No token, no proof: stop before the wallet prompt, not after it.
        let hasToken = false;
        try { hasToken = await chrome.runtime.sendMessage({ type: 'HAS_TOKEN' }); } catch (e) { }
        if (!hasToken) {
            alert('CRIPTOGRAFIA: add a GitHub token first. Click the extension icon, open Settings and paste a token with Gists read/write. The proof is saved to a public Gist, so signing without one would leave the post with no proof.');
            return;
        }

        let res = null;
        try {
            res = await chrome.runtime.sendMessage({ type: 'RELAY', msg: { type: 'READ_EDITOR' } });
        } catch (e) { console.error('[CRIPTOGRAFIA] Relay error:', e); }

        const postText = normalizePost(res && res.text);
        if (!postText) {
            alert('CRIPTOGRAFIA: open "Start a post" and write your post first. The signature covers the post text, so there is nothing to sign yet.');
            return;
        }

        const postHash = await sha256Hex(postText);
        const timestamp = new Date().toISOString();
        const nonce = Math.random().toString(36).substring(2, 10);
        const message = `LinkedIn post signature\nsha256: ${postHash}\nTime: ${timestamp}\nRef: ${nonce}`;

        document.dispatchEvent(new CustomEvent('CRIPTOGRAFIA_REQ', {
            detail: { message, timestamp, postText, postHash, normalization: NORMALIZATION }
        }));
    }

    startSign = requestSign;

    function injectUI() {
        if (document.getElementById('cripto-float-btn')) return;
        const btn = makeButton('cripto-float-btn', 56, requestSign);
        btn.style.position = 'fixed';
        btn.style.bottom = '30px';
        btn.style.right = '30px';
        document.body.appendChild(btn);
    }

    setInterval(() => {
        if (document.hidden) return;
        injectUI();
    }, 2000);

    injectUI();

})();
