/*
 * Company matching — shared by the browser form and the server.
 * Plain script (no imports) so the same file runs in both places.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Mindful12Match = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Words that don't help distinguish one company from another.
  var STOP_WORDS = ['inc', 'incorporated', 'llc', 'llp', 'ltd', 'limited', 'corp', 'corporation',
    'co', 'company', 'the', 'of', 'and'];

  // Public mailbox providers — an address on one of these says nothing about the sender's company.
  var FREE_EMAIL_DOMAINS = ['gmail.com', 'googlemail.com', 'yahoo.com', 'ymail.com', 'rocketmail.com',
    'hotmail.com', 'outlook.com', 'live.com', 'msn.com', 'aol.com', 'icloud.com', 'me.com', 'mac.com',
    'comcast.net', 'xfinity.com', 'verizon.net', 'att.net', 'sbcglobal.net', 'bellsouth.net', 'cox.net',
    'charter.net', 'spectrum.net', 'optonline.net', 'earthlink.net', 'protonmail.com', 'proton.me', 'pm.me',
    'mail.com', 'email.com', 'zoho.com', 'gmx.com', 'gmx.net', 'yandex.com', 'fastmail.com', 'hey.com',
    'duck.com', 'yahoo.co.uk', 'hotmail.co.uk', 'outlook.co.uk', 'live.co.uk'];

  // Score at/above which a typed name is treated as the registered company without asking.
  var AUTO_MATCH = 0.92;
  // Score at/above which we show "Did you mean ...?"
  var SUGGEST = 0.5;

  function normalize(s) {
    return String(s || '')
      .toLowerCase()
      .replace(/[’'`]/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
      .replace(/\s+/g, ' ');
  }

  function tokens(s) {
    return normalize(s).split(' ').filter(function (t) { return t && STOP_WORDS.indexOf(t) === -1; });
  }

  function bigrams(s) {
    var out = {}; var str = s.replace(/ /g, '');
    for (var i = 0; i < str.length - 1; i++) { var b = str.substr(i, 2); out[b] = (out[b] || 0) + 1; }
    return out;
  }

  // Sorensen-Dice similarity on character bigrams. Robust to typos and word-order noise.
  function dice(a, b) {
    if (!a || !b) return 0;
    if (a === b) return 1;
    var ba = bigrams(a), bb = bigrams(b), inter = 0, na = 0, nb = 0, k;
    for (k in ba) { na += ba[k]; if (bb[k]) inter += Math.min(ba[k], bb[k]); }
    for (k in bb) nb += bb[k];
    return na + nb ? (2 * inter) / (na + nb) : 0;
  }

  function levenshtein(a, b) {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;
    var prev = [], cur = [], i, j;
    for (j = 0; j <= b.length; j++) prev[j] = j;
    for (i = 1; i <= a.length; i++) {
      cur = [i];
      for (j = 1; j <= b.length; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      }
      prev = cur;
    }
    return prev[b.length];
  }

  function initials(toks) { return toks.map(function (t) { return t[0]; }).join(''); }

  /** 0..1 similarity between a typed company name and a registered company name. */
  function scoreName(input, candidate) {
    var a = normalize(input), b = normalize(candidate);
    if (!a || !b) return 0;
    if (a === b) return 1;

    var ta = tokens(input), tb = tokens(candidate);
    var ca = ta.join(' '), cb = tb.join(' ');
    if (ca && ca === cb) return 0.98;                          // differs only by Inc/LLC/The
    if (ca.length >= 4 && cb.indexOf(ca) === 0) return 0.9;    // typed a prefix: "baystate ben"
    if (ca.length >= 5 && cb.indexOf(ca) !== -1) return 0.85;  // typed a chunk: "elder services"
    if (a.replace(/ /g, '') === initials(tb)) return 0.85;     // acronym: "cbes"

    // Word-level: fraction of words that closely match a candidate word.
    var hit = 0;
    ta.forEach(function (w) {
      for (var i = 0; i < tb.length; i++) {
        var d = levenshtein(w, tb[i]);
        if (d === 0 || (w.length >= 4 && d <= Math.max(1, Math.floor(w.length / 4)))) { hit++; return; }
      }
    });
    var wordScore = ta.length ? hit / Math.max(ta.length, tb.length) : 0;
    var charScore = dice(ca || a, cb || b);
    return Math.max(wordScore, charScore);
  }

  /** Root registrable domain: "mail.centralboston.org" -> "centralboston.org". */
  function rootDomain(host) {
    var h = String(host || '').toLowerCase().trim()
      .replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
    var parts = h.split('.').filter(Boolean);
    if (parts.length <= 2) return parts.join('.');
    var tld2 = ['co.uk', 'org.uk', 'ac.uk', 'com.au', 'net.au', 'co.nz', 'co.jp', 'com.br'];
    var last2 = parts.slice(-2).join('.');
    return tld2.indexOf(last2) !== -1 ? parts.slice(-3).join('.') : last2;
  }

  function emailDomain(email) {
    var m = String(email || '').toLowerCase().trim().match(/@([^@\s]+)$/);
    return m ? m[1] : '';
  }

  function isFreeEmailDomain(domain) {
    var d = rootDomain(domain);
    return !d || FREE_EMAIL_DOMAINS.indexOf(d) !== -1;
  }

  /**
   * companies: [{ id, name, domain }]
   * Returns:
   *   best        {company, score} — closest registered company above the suggest threshold, or null
   *   autoMatch   company — when `best` is close enough to accept without asking, else null
   *   byDomain    company — whose domain equals the email's (non-free) domain, else null
   *   suggestions [{company, score}] — up to 3, for "Did you mean...?"
   */
  function match(companies, companyName, email) {
    var scored = (companies || []).map(function (c) {
      return { company: c, score: scoreName(companyName, c.name) };
    }).sort(function (x, y) { return y.score - x.score; });

    var best = scored.length && scored[0].score >= SUGGEST ? scored[0] : null;

    var byDomain = null;
    var dom = rootDomain(emailDomain(email));
    if (dom && !isFreeEmailDomain(dom)) {
      for (var i = 0; i < (companies || []).length; i++) {
        if (rootDomain(companies[i].domain) === dom) { byDomain = companies[i]; break; }
      }
    }

    return {
      best: best,
      autoMatch: best && best.score >= AUTO_MATCH ? best.company : null,
      byDomain: byDomain,
      suggestions: scored.filter(function (s) { return s.score >= SUGGEST; }).slice(0, 3)
    };
  }

  return {
    AUTO_MATCH: AUTO_MATCH, SUGGEST: SUGGEST, FREE_EMAIL_DOMAINS: FREE_EMAIL_DOMAINS,
    normalize: normalize, scoreName: scoreName, rootDomain: rootDomain, emailDomain: emailDomain,
    isFreeEmailDomain: isFreeEmailDomain, match: match
  };
});
