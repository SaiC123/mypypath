import { describe, it, expect } from 'vitest';
import fs from 'node:fs';

/* The invite page's markup, checked for the properties that make a forwarded
   link safe: every path ends on a deliberate button, the disclosure is above
   the ones that join, and the page is not advertised to search engines. */

const html = fs.readFileSync('join.html', 'utf8');
const js = fs.readFileSync('assets/js/join-page.js', 'utf8');

const STATES = [
  'loading', 'nocode', 'signedout', 'confirm',
  'switch', 'already', 'own', 'error', 'joined',
];

describe('the page loads what it needs', () => {
  it('defines the code helpers before the page that calls them', () => {
    expect(html.indexOf('/assets/js/roles.js'))
      .toBeLessThan(html.indexOf('/assets/js/join-page.js'));
  });

  it('loads the invite store and the disclosure panel', () => {
    expect(html).toContain('/assets/js/invite-store.js');
    expect(html).toContain('/assets/js/join-disclosure.js');
  });

  // bake_layout.py currently strips this element, so the page carries its
  // header from the committed markup instead of being regenerated.
  it('keeps the account-menu role label the rest of the site has', () => {
    expect(html).toContain('data-account-role');
  });
});

describe('states', () => {
  it('has every state the page can be in', () => {
    STATES.forEach((name) => {
      expect(html).toContain(`data-join-state="${name}"`);
    });
  });

  it('starts on loading, with every other state hidden', () => {
    STATES.filter((s) => s !== 'loading').forEach((name) => {
      const at = html.indexOf(`data-join-state="${name}"`);
      expect(html.slice(at, at + 120)).toContain('hidden');
    });
  });
});

describe('an invite link never joins on its own', () => {
  /* The core safety property. An invite link gets forwarded, screenshot and
     pasted into group chats, so arriving at one must not share a learner's
     work with whoever sent it. */
  it('ends both joining paths on a button the visitor presses', () => {
    ['confirm', 'switch'].forEach((name) => {
      const at = html.indexOf(`data-join-state="${name}"`);
      const section = html.slice(at, html.indexOf('</section>', at));
      expect(section).toContain('data-join-accept');
    });
  });

  it('shows what a teacher can see above each of those buttons', () => {
    ['confirm', 'switch'].forEach((name) => {
      const at = html.indexOf(`data-join-state="${name}"`);
      const section = html.slice(at, html.indexOf('</section>', at));
      expect(section).toContain('data-join-disclosure');
      expect(section.indexOf('data-join-disclosure'))
        .toBeLessThan(section.indexOf('data-join-accept'));
    });
  });

  it('warns that moving class deletes the old class copy of the work', () => {
    const at = html.indexOf('data-join-state="switch"');
    const section = html.slice(at, html.indexOf('</section>', at));
    expect(section).toMatch(/deleted/i);
    expect(section).toMatch(/progress is untouched/i);
  });
});

describe('the signed-out path', () => {
  it('offers both signing up and signing in', () => {
    expect(html).toContain('data-join-signup');
    expect(html).toContain('data-join-signin');
  });

  it('sends the code back through next, and validates it on return', () => {
    expect(js).toContain('next=');
    // safeNext() is what stops an attacker-supplied code becoming an open
    // redirect; the comment naming it is load-bearing documentation.
    expect(js).toContain('safeNext');
  });

  it('holds the invite while they authenticate', () => {
    expect(js).toContain('INVITE.stash');
  });
});

describe('search engines', () => {
  it('is not advertised for indexing', () => {
    expect(html).toMatch(/<meta\s+name="robots"\s+content="noindex/);
  });

  it('still has a description, like every other page', () => {
    expect(html).toMatch(/<meta name="description" content="[^"]+"/);
  });
});
