// Builds examples/proof.json exactly as the extension does (v1.4.0), signed by a
// throwaway key generated on the spot. Its only job is to give verify.js
// something real to check without a wallet or a network.
const fs = require('fs');
const crypto = require('crypto');
const { Wallet } = require('ethers');
const { normalizePost, NORMALIZATION } = require('../src/normalize.js');

(async () => {
    const wallet = Wallet.createRandom();
    const postText = normalizePost(fs.readFileSync(__dirname + '/post.txt', 'utf8'));
    const postHash = crypto.createHash('sha256').update(postText).digest('hex');
    const timestamp = new Date().toISOString();
    const nonce = Math.random().toString(36).substring(2, 10);
    const message = `LinkedIn post signature\nsha256: ${postHash}\nTime: ${timestamp}\nRef: ${nonce}`;
    const signature = await wallet.signMessage(message); // same as MetaMask personal_sign
    const proof = {
        message, signature, address: wallet.address.toLowerCase(), timestamp,
        post_text: postText, post_sha256: postHash, normalization: NORMALIZATION,
        website: 'https://criptografia.app', application: 'CRIPTOGRAFIA LinkedIn Signer',
        proof_type: 'linkedin_post_signature', platform: 'LinkedIn', signer_version: '1.4.0',
        content_type: 'text_post', note: 'EXAMPLE: signed by a throwaway key, not a real author'
    };
    fs.writeFileSync(__dirname + '/proof.json', JSON.stringify(proof, null, 2) + '\n');
    console.log('wrote examples/proof.json, signer', wallet.address);
})();
