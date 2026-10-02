import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import fs from 'node:fs';

let INVITE;

// A storage double, so the rules can be checked without leaning on jsdom's
// sessionStorage and without one test's leftovers reaching the next.
function fakeStore(initial) {
  const map = new Map(Object.entries(initial || {}));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
    removeItem: (k) => { map.delete(k); },
    size: () => map.size,
  };
}

// Storage that refuses everything, as Safari does in private browsing.
function hostileStore() {
  return {
    getItem() { throw new Error('denied'); },
    setItem() { throw new Error('denied'); },
    removeItem() { throw new Error('denied'); },
  };
}

beforeAll(() => {
  new Function(fs.readFileSync('assets/js/roles.js', 'utf8')).call(window);
  new Function(fs.readFileSync('assets/js/invite-store.js', 'utf8')).call(window);
  INVITE = window.PyPathInvite;
});

let store;
beforeEach(() => { store = fakeStore(); });

describe('stash', () => {
  it('keeps a valid code and says so', () => {
    expect(INVITE.stash('ABC234', store)).toBe(true);
    expect(INVITE.peek(store)).toBe('ABC234');
  });

  it('normalizes before keeping, so a pasted link is stored once', () => {
    INVITE.stash('abc-234', store);
    expect(INVITE.peek(store)).toBe('ABC234');
  });

  it('refuses a code that could never be joined with', () => {
    ['', null, undefined, 'NOPE', 'ABC01I', 'ABC2345'].forEach((bad) => {
      expect(INVITE.stash(bad, store)).toBe(false);
    });
    expect(store.size()).toBe(0);
  });
});

describe('consume', () => {
  it('returns the code and leaves nothing behind', () => {
    INVITE.stash('ABC234', store);
    expect(INVITE.consume(store)).toBe('ABC234');
    expect(INVITE.peek(store)).toBe('');
    expect(store.size()).toBe(0);
  });

  // Joining is one-shot. An invite still present after it was acted on would
  // re-offer the same class on the next page load.
  it('does not offer the same invite twice', () => {
    INVITE.stash('ABC234', store);
    INVITE.consume(store);
    expect(INVITE.consume(store)).toBe('');
  });

  it('is empty when nothing was ever stashed', () => {
    expect(INVITE.consume(store)).toBe('');
  });
});

describe('peek', () => {
  it('does not clear what it reads', () => {
    INVITE.stash('ABC234', store);
    expect(INVITE.peek(store)).toBe('ABC234');
    expect(INVITE.peek(store)).toBe('ABC234');
  });

  // A value written by an older version of the site, or edited by hand, is not
  // worth acting on -- and not worth keeping around to be re-read.
  it('drops a stored value that is no longer valid', () => {
    const dirty = fakeStore({ [INVITE.KEY]: 'NOT-A-CODE' });
    expect(INVITE.peek(dirty)).toBe('');
    expect(dirty.size()).toBe(0);
  });
});

describe('storage that refuses', () => {
  // Private browsing throws on access rather than returning null. An invite is
  // a convenience; losing it must never take the page down with it.
  it('reports failure instead of throwing', () => {
    const hostile = hostileStore();
    expect(() => INVITE.stash('ABC234', hostile)).not.toThrow();
    expect(INVITE.stash('ABC234', hostile)).toBe(false);
    expect(() => INVITE.peek(hostile)).not.toThrow();
    expect(INVITE.peek(hostile)).toBe('');
    expect(() => INVITE.consume(hostile)).not.toThrow();
    expect(() => INVITE.clear(hostile)).not.toThrow();
  });

  it('is inert when there is no storage at all', () => {
    expect(INVITE.stash('ABC234', null)).toBe(false);
    expect(INVITE.peek(null)).toBe('');
    expect(INVITE.consume(null)).toBe('');
    expect(() => INVITE.clear(null)).not.toThrow();
  });
});
