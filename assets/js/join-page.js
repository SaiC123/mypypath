/* PyPath — the invite-link landing page.

   One job: turn "?code=ABC234" into a class someone has deliberately joined.

   The deliberate part is the whole design. A link that joined on arrival would
   be a link that shares a learner's work with a stranger's dashboard before
   they have read what is shared, and an invite link gets forwarded, screenshot
   and pasted into group chats. So the page always ends on a button, with the
   disclosure panel above it, and the only thing the link itself does is fill
   in the code.

   What a signed-out visitor is shown is limited by the rules rather than by
   choice: reading `joinCodes/{code}` requires being signed in, so the class
   cannot be named until they are. Hence two steps for them -- the code they
   hold, then the class it belongs to. */
import { currentUser } from '/assets/js/auth.js';

const ROLES = window.PyPathRoles;
const INVITE = window.PyPathInvite;

const state = { code: '' };

function qs(sel) { return document.querySelector(sel); }
function all(sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); }

// Exactly one state is visible at a time. Driving it by attribute rather than
// by juggling `hidden` on individual nodes means a state that is forgotten
// stays hidden, rather than appearing under the one that was meant.
function show(name) {
  all('[data-join-state]').forEach((el) => {
    el.hidden = el.dataset.joinState !== name;
  });
}

function text(sel, value) {
  all(sel).forEach((el) => { el.textContent = value; });
}

/* Where to send someone who has to authenticate first.

   The code travels in `next` so it survives the round trip in the URL, and is
   stashed as well. The two cover different paths: `next` brings back anyone who
   uses the buttons on this page, and the stash catches anyone who signs in from
   the account menu in the header instead, who would otherwise come back with no
   invite at all.

   `next` is read back through PyPathGate.safeNext(), which rejects anything that
   is not a same-origin path -- the invite code is attacker-supplied text, and a
   redirect target built from it without that check is an open redirect. */
function authHref(base, code) {
  const back = ROLES.INVITE_PATH + '?' + ROLES.INVITE_PARAM + '=' + code;
  return base + '?next=' + encodeURIComponent(back);
}

function renderSignedOut() {
  text('[data-join-code]', state.code);
  const signup = qs('[data-join-signup]');
  const signin = qs('[data-join-signin]');
  if (signup) signup.href = authHref('/signup.html', state.code);
  if (signin) signin.href = authHref('/login.html', state.code);
  show('signedout');
}

async function apply(user) {
  if (!state.code) {
    // Nothing usable in the link. Clear any stale invite rather than leaving
    // one to fire on a later page: this visit says the link was the thing that
    // did not work, and a silent join from an older code would be a surprise.
    INVITE.clear();
    show('nocode');
    return;
  }

  if (!user) {
    INVITE.stash(state.code);
    renderSignedOut();
    return;
  }

  // Signed in: the class itself is resolved against Firestore, which the next
  // commit wires up. Until then the invite is held rather than dropped.
  INVITE.stash(state.code);
  show('loading');
}

function start() {
  if (!ROLES || !INVITE) return;
  state.code = ROLES.codeFromQuery(window.location.search);
  show('loading');
  document.addEventListener('pypath:auth', (e) => apply(e.detail.user));
  // auth.js may have announced before this module finished loading, in which
  // case the event above never arrives.
  apply(currentUser());
}

start();
