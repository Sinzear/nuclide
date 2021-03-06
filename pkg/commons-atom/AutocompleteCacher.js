/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow
 */

export type AutocompleteCacherConfig<T> = {|
 updateResults: (
   request: atom$AutocompleteRequest,
   firstResult: T,
 ) => T,
 // If this is provided, we will ask it whether we can filter on the given request after first
 // verifying that the cursor has only moved by one column since the last request.
 shouldFilter?: (
   lastRequest: atom$AutocompleteRequest,
   currentRequest: atom$AutocompleteRequest,
   // TODO pass originalResult here if any client requires it
 ) => boolean,
|};

type AutocompleteSession<T> = {
  firstResult: Promise<T>,
  lastRequest: atom$AutocompleteRequest,
};

export default class AutocompleteCacher<T> {
  _getSuggestions: (request: atom$AutocompleteRequest) => Promise<T>;
  _config: AutocompleteCacherConfig<T>;

  _session: ?AutocompleteSession<T>;

  constructor(
    // If getSuggestions returns null or undefined, it means that we should not filter that result
    // to serve later queries, even if shouldFilter returns true. If there are truly no results, it
    // is recommended that getSuggestions return an empty Array.
    getSuggestions: (request: atom$AutocompleteRequest) => Promise<T>,
    config: AutocompleteCacherConfig<T>,
  ) {
    this._getSuggestions = getSuggestions;
    this._config = config;
  }

  getSuggestions(request: atom$AutocompleteRequest): Promise<T> {
    const session = this._session;
    if (session != null && this._canMaybeFilterResults(session, request)) {
      // We need to send this request speculatively because if firstResult resolves to `null`, we'll
      // need this result. If we wait for firstResult to resolve before sending it, satisfying this
      // request could take as much as two round trips to the server. We could avoid this in some
      // cases by checking if firstResult has already been resolved. If it has already resolved to a
      // non-null value, we can skip this request.
      const resultFromLanguageService = this._getSuggestions(request);
      const result = this._filterSuggestionsIfPossible(
        request,
        session.firstResult,
        resultFromLanguageService,
      );
      this._session = {
        firstResult: getNewFirstResult(session.firstResult, resultFromLanguageService),
        lastRequest: request,
      };
      return result;
    } else {
      const result = this._getSuggestions(request);
      this._session = {
        firstResult: result,
        lastRequest: request,
      };
      return result;
    }
  }

  async _filterSuggestionsIfPossible(
    request: atom$AutocompleteRequest,
    firstResultPromise: Promise<T>,
    resultFromLanguageService: Promise<T>,
  ): Promise<T> {
    const firstResult = await firstResultPromise;
    if (firstResult != null) {
      return this._config.updateResults(request, firstResult);
    } else {
      return resultFromLanguageService;
    }
  }

  // This doesn't guarantee we can filter results -- if the previous result turns out to be null, we
  // may still have to use the results from the language service.
  _canMaybeFilterResults(
    session: AutocompleteSession<T>,
    currentRequest: atom$AutocompleteRequest,
  ): boolean {
    const {lastRequest} = session;
    const shouldFilter = this._config.shouldFilter != null ?
      this._config.shouldFilter :
      defaultShouldFilter;
    return lastRequest.bufferPosition.row === currentRequest.bufferPosition.row &&
        lastRequest.bufferPosition.column + 1 === currentRequest.bufferPosition.column &&
        shouldFilter(lastRequest, currentRequest);
  }
}

async function getNewFirstResult<T>(
  firstResultPromise: Promise<T>,
  resultFromLanguageService: Promise<T>,
): Promise<T> {
  const firstResult = await firstResultPromise;
  if (firstResult != null) {
    return firstResult;
  } else {
    return resultFromLanguageService;
  }
}

const IDENTIFIER_CHAR_REGEX = /[a-zA-Z_]/;

function defaultShouldFilter(
  lastRequest: atom$AutocompleteRequest,
  currentRequest: atom$AutocompleteRequest,
) {
  return currentRequest.prefix.startsWith(lastRequest.prefix) &&
    IDENTIFIER_CHAR_REGEX.test(currentRequest.prefix.charAt(currentRequest.prefix.length - 1));
}
