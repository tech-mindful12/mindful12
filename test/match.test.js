'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../public/match.js');

const companies = [
  { id: 1, name: 'Baystate Benefit Services', domain: 'baystatebenefits.com' },
  { id: 2, name: 'Central Boston Elder Services', domain: 'centralboston.org' },
];

test('exact and near-exact names auto-match', () => {
  for (const typed of ['Baystate Benefit Services', 'baystate benefit services inc', 'Bay State Benefit Services', 'Baystate Benfit Servces']) {
    assert.equal(M.match(companies, typed, '').autoMatch?.id, 1, typed);
  }
  assert.equal(M.match(companies, 'Central Bostan Elder Services', '').autoMatch?.id, 2);
});

test('variations surface a "did you mean" suggestion without auto-matching', () => {
  for (const typed of ['baystate benefits', 'Baystate', 'CBES', 'central boston elder', 'Boston Elder Services']) {
    const r = M.match(companies, typed, '');
    assert.ok(r.best, typed);
    assert.equal(r.autoMatch, null, typed);
  }
  assert.equal(M.match(companies, 'baystate benefits', '').best.company.id, 1);
  assert.equal(M.match(companies, 'CBES', '').best.company.id, 2);
});

test('unrelated names produce nothing', () => {
  for (const typed of ['Acme Widgets', 'Smarter Flow', 'bay', '']) {
    const r = M.match(companies, typed, '');
    assert.equal(r.best, null, typed);
    assert.equal(r.suggestions.length, 0, typed);
  }
});

test('email domain identifies the company, ignoring free mailboxes and subdomains', () => {
  assert.equal(M.match(companies, '', 'jo@centralboston.org').byDomain?.id, 2);
  assert.equal(M.match(companies, '', 'jo@mail.centralboston.org').byDomain?.id, 2);
  assert.equal(M.match(companies, '', 'Jo@BaystateBenefits.com').byDomain?.id, 1);
  assert.equal(M.match(companies, '', 'jo@gmail.com').byDomain, null);
  assert.equal(M.match(companies, '', 'jo@example.com').byDomain, null);
  assert.equal(M.match(companies, '', 'not-an-email').byDomain, null);
});

test('rootDomain normalizes URLs and hosts', () => {
  assert.equal(M.rootDomain('https://www.baystatebenefits.com/'), 'baystatebenefits.com');
  assert.equal(M.rootDomain('mail.centralboston.org'), 'centralboston.org');
  assert.equal(M.rootDomain('foo.example.co.uk'), 'example.co.uk');
});
