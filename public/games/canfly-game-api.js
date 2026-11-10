/* Canfly Games API v0.1 — works in any same-origin game.html. */
(function () {
  'use strict';
  var match = location.pathname.match(/^\/games\/([a-z0-9-]+)\/game\.html$/);
  if (!match) return;
  var slug = match[1];
  var endpoint = '/api/games/' + encodeURIComponent(slug) + '/progress';

  async function call(method, data) {
    var response = await fetch(endpoint, {
      method: method,
      credentials: 'same-origin',
      cache: 'no-store',
      headers: data ? { 'Content-Type': 'application/json' } : undefined,
      body: data ? JSON.stringify(data) : undefined
    });
    var result = await response.json();
    if (!response.ok) {
      var error = new Error(result.error || 'canfly_api_error');
      error.status = response.status;
      throw error;
    }
    return result;
  }
  window.CanflyGame = Object.freeze({
    version: '0.1',
    slug: slug,
    load: function () { return call('GET'); },
    save: function (kind, options) {
      var data = options || {};
      return call('POST', {
        requestId: data.requestId || crypto.randomUUID(),
        kind: kind,
        score: data.score,
        details: data.details || {}
      });
    }
  });
})();
