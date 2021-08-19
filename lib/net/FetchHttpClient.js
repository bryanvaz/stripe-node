'use strict';

/* eslint-disable class-methods-use-this */

const {HttpClient, HttpClientResponse} = require('./HttpClient');

/**
 * HTTP client which uses a `fetch` function to issue requests.`
 */
class FetchHttpClient extends HttpClient {
  constructor(fetchFn) {
    super();
    this._fetchFn = fetchFn;
  }

  /** @override. */
  getClientName() {
    return 'fetch';
  }

  makeRequest(
    host,
    port,
    path,
    method,
    headers,
    requestData,
    protocol,
    timeout
  ) {
    const url = new URL(
      path,
      `${isInsecureConnection ? 'http' : 'https'}://${host}`
    );
    url.port = port;

    const fetchPromise = this.fetchFn(url.toString(), {
      method,
      headers,
      body: requestData || undefined,
    });

    let pendingTimeoutId;
    const timeoutPromise = new Promise((_, reject) => {
      pendingTimeoutId = setTimeout(() => {
        pendingTimeoutId = null;
        reject(HttpClient.makeTimeoutError());
      }, timeout);
    });

    return Promise.race([fetchPromise, timeoutPromise])
      .then((res) => {
        return new FetchHttpClientResponse(res);
      })
      .finally(() => {
        if (pendingTimeoutId) {
          clearTimeout(pendingTimeoutId);
        }
      });
  }
}

class FetchHttpClientResponse extends HttpClientResponse {
  constructor(res) {
    super(
      res.statusCode,
      FetchHttpResponse._transformHeadersToObject(res.headers)
    );
    this._res = res;
  }

  getRawResponse() {
    return this._res;
  }

  toStream(streamCompleteCallback) {
    // Unfortunately `fetch` does not have event handlers for when the stream is
    // completely read. We therefore invoke the streamCompleteCallback right
    // away. This callback emits a response event with metadata and completes
    // metrics, so it's ok to do this without waiting for the stream to be
    // completely read.
    streamCompleteCallback();
    return this._res;
  }

  toJSON() {
    return this._res.json();
  }

  static _transformHeadersToObject(headers) {
    const headersObj = {};

    for (const entry of headers) {
      headersObj[entry[0]] = headers[entry[1]];
    }

    return headersObj;
  }
}

module.exports = {NodeHttpClient, NodeHttpClientResponse};
