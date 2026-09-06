// Tests for src/lib/email.js - the "someone typed an email into the name
// field" tolerance that keeps a group member linked to their real account.
import test from 'node:test'
import assert from 'node:assert/strict'
import { looksLikeEmail, splitNameOrEmail } from '../src/lib/email.js'

test('looksLikeEmail: accepts real-looking addresses, rejects plain names', () => {
  assert.equal(looksLikeEmail('9akash.roy@gmail.com'), true)
  assert.equal(looksLikeEmail('a@b.co'), true)
  assert.equal(looksLikeEmail('  spaced@example.com  '), true)
  assert.equal(looksLikeEmail('Akash'), false)
  assert.equal(looksLikeEmail('Akash Roy'), false)
  assert.equal(looksLikeEmail('not an email@'), false)
  assert.equal(looksLikeEmail('missing@dot'), false)
  assert.equal(looksLikeEmail(''), false)
  assert.equal(looksLikeEmail(null), false)
})

test('an email typed into the name field becomes the invite email', () => {
  assert.deepEqual(splitNameOrEmail('9akash.roy@gmail.com', ''), {
    name: '9akash.roy',
    inviteEmail: '9akash.roy@gmail.com',
  })
})

test('a plain name stays a plain name (no invite email)', () => {
  assert.deepEqual(splitNameOrEmail('Rohit', ''), { name: 'Rohit', inviteEmail: undefined })
})

test('an explicit email field always wins - the name is left alone', () => {
  assert.deepEqual(splitNameOrEmail('Akash', 'akash@work.com'), { name: 'Akash', inviteEmail: 'akash@work.com' })
  // even if BOTH look like emails, the dedicated field is authoritative
  assert.deepEqual(splitNameOrEmail('typo@name.com', 'real@email.com'), {
    name: 'typo@name.com',
    inviteEmail: 'real@email.com',
  })
})

test('whitespace is trimmed', () => {
  assert.deepEqual(splitNameOrEmail('  Kundar  ', '  '), { name: 'Kundar', inviteEmail: undefined })
})
