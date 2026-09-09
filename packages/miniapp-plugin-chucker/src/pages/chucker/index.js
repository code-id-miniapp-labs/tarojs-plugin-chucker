// miniapp-chucker: Chucker Inspector Page (native Page())
// This file is intentionally plain JS (no TypeScript) so it can be
// used directly in native WeApp / TCMPP projects without a compile step.

// ──────────────────────────────────────────────
// Runtime helpers (duplicated inline to avoid import issues in native WeApp)
// ──────────────────────────────────────────────

function getGlobalApi() {
  if (typeof wx !== 'undefined') return wx;
  if (typeof my !== 'undefined') return my;
  if (typeof tt !== 'undefined') return tt;
  // TCMPP
  try { if (typeof tx !== 'undefined') return tx; } catch (e) {}
  return null;
}

function formatJson(val) {
  if (val === undefined || val === null) return '';
  if (typeof val === 'string') {
    try { return JSON.stringify(JSON.parse(val.trim()), null, 2); } catch (e) { return val; }
  }
  try { return JSON.stringify(val, null, 2); } catch (e) { return String(val); }
}

function generateCurl(url, method, headers, data) {
  headers = headers || {};
  let curl = 'curl -X ' + method.toUpperCase() + ' "' + url + '"';
  Object.keys(headers).forEach(function (key) {
    curl += ' -H "' + key + ': ' + String(headers[key]).replace(/"/g, '\\"') + '"';
  });
  if (data !== undefined && data !== null) {
    var dataStr = typeof data === 'object' ? JSON.stringify(data) : String(data);
    curl += " -d '" + dataStr.replace(/'/g, "'\\''") + "'";
  }
  return curl;
}

function formatTime(ts) {
  var d = new Date(ts);
  var pad = function (n) { return String(n).padStart(2, '0'); };
  return pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
}

function getStatusClass(status) {
  if (status === undefined || status === 'pending') return 'pending';
  if (status === 'fail' || (typeof status === 'number' && status >= 400)) return 'error';
  if (status === 'success') return 'success';
  return 'success';
}

function methodClass(method) {
  switch (String(method).toUpperCase()) {
    case 'GET': return 'get';
    case 'POST': return 'post';
    case 'PUT': return 'put';
    case 'DELETE': return 'delete';
    case 'NATIVE': return 'native';
    case 'UPLOAD':
    case 'DOWNLOAD': return 'upload';
    default: return 'default';
  }
}

/**
 * Enrich a raw ChuckerLog for display in WXML.
 * Adds computed text fields so templates stay simple.
 */
function enrichLog(log) {
  return Object.assign({}, log, {
    timeLabel: formatTime(log.startTime),
    startTimeLabel: new Date(log.startTime).toLocaleString(),
    statusClass: getStatusClass(log.status),
    methodClass: methodClass(log.method),
    requestHeadersText: log.requestHeaders && Object.keys(log.requestHeaders).length
      ? formatJson(log.requestHeaders)
      : '',
    requestDataText: log.requestData != null ? formatJson(log.requestData) : '',
    responseHeadersText: log.responseHeaders && Object.keys(log.responseHeaders).length
      ? formatJson(log.responseHeaders)
      : '',
    responseDataText: log.responseData != null ? formatJson(log.responseData) : '',
  });
}

// ──────────────────────────────────────────────
// Resolve chuckerStore from global singleton
// ──────────────────────────────────────────────
function getStore() {
  var g = typeof globalThis !== 'undefined' ? globalThis
    : typeof global !== 'undefined' ? global
    : typeof window !== 'undefined' ? window : {};
  return g.__CHUCKER_STORE__;
}

// ──────────────────────────────────────────────
// Page definition
// ──────────────────────────────────────────────
Page({
  data: {
    // All logs from the store
    logs: [],
    // Logs after filter/search applied
    filteredLogs: [],
    // 'all' | 'network' | 'native'
    filterType: 'all',
    searchQuery: '',
    // 'list' | 'detail'
    view: 'list',
    selectedLog: null,
    // 'overview' | 'request' | 'response'
    detailTab: 'overview',
    errorCount: 0,
  },

  _unsubscribe: null,

  onLoad: function () {
    var self = this;
    var store = getStore();

    if (!store) {
      console.warn('[miniapp-chucker] Store not found. Did you call initChucker() in app.js?');
      return;
    }

    this._unsubscribe = store.subscribe(function (logs) {
      self._onLogsUpdate(logs);
    });
  },

  onUnload: function () {
    if (typeof this._unsubscribe === 'function') {
      this._unsubscribe();
    }
  },

  // ──────────────────────────────────────────────
  // Internal: update displayed logs
  // ──────────────────────────────────────────────
  _onLogsUpdate: function (logs) {
    var filterType = this.data.filterType;
    var searchQuery = (this.data.searchQuery || '').toLowerCase();

    var filtered = logs.filter(function (log) {
      if (filterType === 'network' && log.type !== 'network') return false;
      if (filterType === 'native' && log.type !== 'native') return false;
      if (searchQuery) {
        var inUrl = log.url && log.url.toLowerCase().indexOf(searchQuery) !== -1;
        var inHeaders = log.requestHeaders && JSON.stringify(log.requestHeaders).toLowerCase().indexOf(searchQuery) !== -1;
        var inBody = log.requestData && JSON.stringify(log.requestData).toLowerCase().indexOf(searchQuery) !== -1;
        if (!inUrl && !inHeaders && !inBody) return false;
      }
      return true;
    });

    var errorCount = logs.filter(function (log) {
      return log.status === 'fail' || (typeof log.status === 'number' && log.status >= 400);
    }).length;

    this.setData({
      logs: logs.map(enrichLog),
      filteredLogs: filtered.map(enrichLog),
      errorCount: errorCount,
    });
  },

  // ──────────────────────────────────────────────
  // Handlers
  // ──────────────────────────────────────────────

  onSetFilter: function (e) {
    var type = e.currentTarget.dataset.type;
    this.setData({ filterType: type }, function () {
      var store = getStore();
      if (store) this._onLogsUpdate(store.getLogs());
    }.bind(this));
  },

  onSearch: function (e) {
    this.setData({ searchQuery: e.detail.value }, function () {
      var store = getStore();
      if (store) this._onLogsUpdate(store.getLogs());
    }.bind(this));
  },

  onClearSearch: function () {
    this.setData({ searchQuery: '' }, function () {
      var store = getStore();
      if (store) this._onLogsUpdate(store.getLogs());
    }.bind(this));
  },

  onTapLog: function (e) {
    var id = e.currentTarget.dataset.id;
    var log = this.data.logs.find(function (l) { return l.id === id; });
    if (!log) return;
    this.setData({
      view: 'detail',
      selectedLog: enrichLog(log),
      detailTab: 'overview',
    });
  },

  onBack: function () {
    this.setData({ view: 'list', selectedLog: null });
  },

  onSetDetailTab: function (e) {
    this.setData({ detailTab: e.currentTarget.dataset.tab });
  },

  onClear: function () {
    var api = getGlobalApi();
    if (!api) return;
    var self = this;
    api.showModal({
      title: 'Clear Logs',
      content: 'Delete all logged requests?',
      success: function (res) {
        if (res.confirm) {
          var store = getStore();
          if (store) store.clear();
          self.setData({ view: 'list', selectedLog: null });
        }
      },
    });
  },

  onCopyCurl: function () {
    var log = this.data.selectedLog;
    if (!log) return;
    var curl = generateCurl(log.url, log.method, log.requestHeaders, log.requestData);
    this._copyToClipboard(curl, 'cURL Copied!');
  },

  onCopyRequestHeaders: function () {
    var log = this.data.selectedLog;
    if (log && log.requestHeadersText) this._copyToClipboard(log.requestHeadersText, 'Copied!');
  },

  onCopyRequestBody: function () {
    var log = this.data.selectedLog;
    if (log && log.requestDataText) this._copyToClipboard(log.requestDataText, 'Copied!');
  },

  onCopyResponseHeaders: function () {
    var log = this.data.selectedLog;
    if (log && log.responseHeadersText) this._copyToClipboard(log.responseHeadersText, 'Copied!');
  },

  onCopyResponseBody: function () {
    var log = this.data.selectedLog;
    if (log && log.responseDataText) this._copyToClipboard(log.responseDataText, 'Copied!');
  },

  _copyToClipboard: function (text, title) {
    var api = getGlobalApi();
    if (!api) return;
    api.setClipboardData({
      data: text,
      success: function () {
        api.showToast({ title: title || 'Copied!', icon: 'success', duration: 1500 });
      },
    });
  },
});
