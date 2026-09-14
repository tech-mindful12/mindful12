'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const security = require('../src/security');

test('allowed hosts: exact subdomain, apex, wildcard subdomains', () => {
  assert.equal(security.hostAllowed('mindful12.mycoursecreator360.com'), true);
  assert.equal(security.hostAllowed('other.mycoursecreator360.com'), false);
  assert.equal(security.hostAllowed('mycoursecreator360.com'), false);
  assert.equal(security.hostAllowed('mindful12.com'), true);
  assert.equal(security.hostAllowed('www.mindful12.com'), true);
  assert.equal(security.hostAllowed('app.preview.mindful12.com'), true);
  assert.equal(security.hostAllowed('notmindful12.com'), false);
  assert.equal(security.hostAllowed('mindful12.com.evil.com'), false);
  assert.equal(security.hostAllowed(''), false);
});

test('safeRedirect only accepts https URLs on allowed hosts', () => {
  assert.equal(security.safeRedirect('https://mindful12.com/thanks?x=1'), 'https://mindful12.com/thanks?x=1');
  assert.equal(security.safeRedirect('https://mindful12.mycoursecreator360.com/next'), 'https://mindful12.mycoursecreator360.com/next');
  assert.equal(security.safeRedirect('https://evil.com/phish'), null);
  assert.equal(security.safeRedirect('http://mindful12.com/'), null);
  assert.equal(security.safeRedirect('javascript:alert(1)'), null);
  assert.equal(security.safeRedirect('//evil.com'), null);
  assert.equal(security.safeRedirect(''), null);
});

test('frameAncestors lists self plus every allowed host over https', () => {
  const v = security.frameAncestors();
  assert.ok(v.startsWith("'self'"));
  assert.ok(v.includes('https://mindful12.mycoursecreator360.com'));
  assert.ok(v.includes('https://*.mindful12.com'));
});

test('safeEqual is strict and never true for empty', () => {
  assert.equal(security.safeEqual('abc', 'abc'), true);
  assert.equal(security.safeEqual('abc', 'abd'), false);
  assert.equal(security.safeEqual('abc', 'abcd'), false);
  assert.equal(security.safeEqual('', ''), false);
});
