/* PyPath — an invite code held across the sign-in round trip.

   Most people opening an invite link are not signed in yet: the link is how
   they heard of the class, and often how they hear of the site. They go off to
   sign up and come back, and the code has to still be there when they do.

   The join page carries the code in `next` as well, which handles the ordinary
   path. This exists for the one that is not ordinary: someone who opens the
   link, signs in from the account menu in the header rather than the button on
   the page, and would otherwise land on their progress page with the invite
   silently dropped and no idea a class was ever involved.

   sessionStorage, not localStorage, and deliberately: a pending invite belongs
   to this one visit. In a shared computer lab, an invite left in localStorage
   is an invite the next person to sit down gets offered.

   The storage object is injectable so the rules can be tested without a DOM. */
(function () {
  'use strict';

  var KEY = 'pypath-pending-invite';

  function roles() {
    return window.PyPathRoles || null;
  }

  // A code is only worth keeping if it could actually be joined with. Checking
  // on the way in means nothing downstream has to re-validate what it reads.
  function usable(code) {
    var R = roles();
    return !!(R && R.isValidCode(code));
  }

  function defaultStore() {
    try { return window.sessionStorage; } catch (e) { return null; }
  }

  function pick(storage) {
    return storage === undefined ? defaultStore() : storage;
  }

  // Returns whether anything was kept, so a caller can tell "held for later"
  // apart from "that code was junk and has been dropped".
  function stash(rawCode, storage) {
    var R = roles();
    var code = R ? R.normalizeCode(rawCode) : '';
    if (!usable(code)) return false;
    var s = pick(storage);
    if (!s) return false;
    try { s.setItem(KEY, code); return true; }
    catch (e) { return false; }
  }

  // Read without clearing, for deciding what to render.
  function peek(storage) {
    var s = pick(storage);
    if (!s) return '';
    var raw;
    try { raw = s.getItem(KEY); } catch (e) { return ''; }
    var R = roles();
    var code = R ? R.normalizeCode(raw) : '';
    // A value that is no longer valid -- hand-edited, or written by an older
    // version of the site -- is not worth acting on and not worth keeping.
    if (!usable(code)) {
      clear(storage);
      return '';
    }
    return code;
  }

  function clear(storage) {
    var s = pick(storage);
    if (!s) return;
    try { s.removeItem(KEY); } catch (e) {}
  }

  // Read and clear in one step. Joining is a one-shot action, and an invite
  // left in place after it was acted on would re-offer the same class on the
  // next page load.
  function consume(storage) {
    var code = peek(storage);
    clear(storage);
    return code;
  }

  window.PyPathInvite = {
    KEY: KEY,
    stash: stash,
    peek: peek,
    consume: consume,
    clear: clear
  };
})();
