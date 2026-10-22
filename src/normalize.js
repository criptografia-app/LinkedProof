// Post text normalization, shared by the extension and tools/verify.js.
// LinkedIn rewrites whitespace, paragraphs and hashtags between the composer
// and the published post, so both sides hash this canonical form instead.

(function (root) {
    const NORMALIZATION = 'v1: NFC; CRLF->LF; NBSP->space; zero-width chars removed; ' +
        '"hashtag#"->"#"; runs of spaces/tabs collapsed; lines trimmed; ' +
        'blank lines and the "Signed by CRIPTOGRAFIA" line removed';

    function normalizePost(text) {
        return String(text || '')
            .normalize('NFC')
            .replace(/\r\n?/g, '\n')
            .replace(/[  ]/g, ' ')
            .replace(/[​-‍⁠﻿]/g, '')
            // Published posts render hashtags as a hidden "hashtag" label plus "#Tag".
            .replace(/hashtag\s*#/gi, '#')
            .split('\n')
            .map(l => l.replace(/[ \t]+/g, ' ').trim())
            .filter(l => l && !/Signed by @?CRIPTOGRAFIA/i.test(l))
            .join('\n');
    }

    const api = { normalizePost, NORMALIZATION };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.CRIPTO_NORMALIZE = api;
})(this);
