#!/usr/bin/env node
// Verify a LinkedProof signature.
//
//   node tools/verify.js <gist-url | proof.json> [post.txt]
//
// post.txt is the post as copied from LinkedIn; without it the text stored in
// the proof is checked. Signature recovery uses ethers if it can be required
// (npm i ethers); otherwise paste address/message/signature into
// https://etherscan.io/verifiedSignatures.

const fs = require('fs');
const crypto = require('crypto');
const { normalizePost, NORMALIZATION } = require('../src/normalize.js');

async function loadProof(src) {
    if (!/^https?:/.test(src)) return JSON.parse(fs.readFileSync(src, 'utf8'));
    const id = src.replace(/\/+$/, '').split('/').pop();
    const res = await fetch(`https://api.github.com/gists/${id}`);
    if (!res.ok) throw new Error(`GitHub ${res.status} for gist ${id}`);
    const files = Object.values((await res.json()).files);
    const f = files.find(x => x.filename.startsWith('PROOF_')) || files[0];
    return JSON.parse(f.content);
}

function recover(message, signature) {
    try {
        return require('ethers').verifyMessage(message, signature);
    } catch (e) {
        return null;
    }
}

(async () => {
    const [src, postFile] = process.argv.slice(2);
    if (!src) {
        console.error('usage: node tools/verify.js <gist-url | proof.json> [post.txt]');
        process.exit(2);
    }
    const proof = await loadProof(src);
    const signed = (proof.message.match(/^sha256: ([0-9a-f]{64})$/m) || [])[1];
    if (!signed) {
        console.log('FAIL  this proof does not cover any post text (signed before v1.3.0)');
        process.exit(1);
    }

    const text = postFile ? fs.readFileSync(postFile, 'utf8') : proof.post_text;
    const hash = crypto.createHash('sha256').update(normalizePost(text)).digest('hex');
    const hashOk = hash === signed;
    console.log(`${hashOk ? 'OK  ' : 'FAIL'}  post sha256 ${hash}`);
    if (!hashOk) console.log(`      signed sha256 ${signed}`);

    const signer = recover(proof.message, proof.signature);
    let sigOk = null;
    if (signer) {
        sigOk = signer.toLowerCase() === proof.address.toLowerCase();
        console.log(`${sigOk ? 'OK  ' : 'FAIL'}  signer ${signer} (claimed ${proof.address})`);
    } else {
        console.log('SKIP  signature check (ethers not installed). Check it at https://etherscan.io/verifiedSignatures with:');
        console.log(`      address:   ${proof.address}\n      signature: ${proof.signature}\n      message:\n${proof.message}`);
    }
    if (proof.normalization && proof.normalization !== NORMALIZATION) {
        console.log(`NOTE  proof was made with normalization "${proof.normalization}"`);
    }
    process.exit(hashOk && sigOk !== false ? 0 : 1);
})().catch((e) => {
    console.error(e.message);
    process.exit(2);
});
