// CRIPTOGRAFIA Page Script
// Runs in the MAIN world

console.log('[CRIPTOGRAFIA] Page script loaded (cripto_page.js)');

// EIP-6963: wallets announce themselves by name, so MetaMask is reachable even
// when another wallet (e.g. Brave Wallet) owns window.ethereum.
const providers = [];
window.addEventListener('eip6963:announceProvider', (e) => {
    if (e.detail && e.detail.provider) providers.push(e.detail);
});
window.dispatchEvent(new Event('eip6963:requestProvider'));

function getProvider() {
    const mm = providers.find(p => p.info && p.info.rdns === 'io.metamask');
    if (mm) return mm.provider;
    if (window.ethereum) return window.ethereum;
    throw new Error('MetaMask is not installed!');
}

// personal_sign takes hex of the UTF-8 bytes; charCodeAt breaks on accents and emoji.
function utf8Hex(str) {
    return '0x' + Array.from(new TextEncoder().encode(str), b => b.toString(16).padStart(2, '0')).join('');
}

document.addEventListener('CRIPTOGRAFIA_REQ', async (event) => {
    const data = event.detail;
    if (!data) return;

    try {
        const ethereum = getProvider();
        const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
        const account = accounts[0];
        if (!account) throw new Error('No account found');

        const message = data.message;
        const signature = await ethereum.request({
            method: 'personal_sign',
            params: [utf8Hex(message), account],
        });

        const payload = {
            message: message,
            signature: signature,
            address: account,
            timestamp: data.timestamp,
            post_text: data.postText,
            post_sha256: data.postHash,
            normalization: data.normalization,
            website: "https://criptografia.app",
            application: "CRIPTOGRAFIA LinkedIn Signer",
            proof_type: "linkedin_post_signature",
            platform: "LinkedIn",
            signer_version: "1.4.0",
            content_type: "text_post"
        };

        document.dispatchEvent(new CustomEvent('CRIPTOGRAFIA_RESP', {
            detail: {
                type: 'SUCCESS',
                payload: payload
            }
        }));

    } catch (err) {
        console.error('[CRIPTOGRAFIA-PAGE] Error:', err);
        document.dispatchEvent(new CustomEvent('CRIPTOGRAFIA_RESP', {
            detail: { type: 'ERROR', error: err.message || 'Unknown error' }
        }));
    }
});
