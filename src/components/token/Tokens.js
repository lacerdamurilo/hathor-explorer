/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { find, get, isEmpty, last } from 'lodash';
import { useHistory } from 'react-router-dom';
import TokensTable from './TokensTable';
import TokenSearchField from './TokenSearchField';
import tokensApi from '../../api/tokensApi';
import PaginationURL from '../../utils/pagination';
import ErrorMessageWithIcon from '../error/ErrorMessageWithIcon';

/**
 * Displays custom tokens in a table with pagination buttons and a search bar.
 */
function Tokens({ title, maintenanceMode }) {
  const history = useHistory();

  const [tokens, setTokens] = useState([]);
  const [hasAfter, setHasAfter] = useState(false);
  const [hasBefore, setHasBefore] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [sortBy, setSortBy] = useState('transaction_timestamp');
  const [order, setOrder] = useState('desc');
  const [page, setPage] = useState(1);
  const [pageSearchAfter, setPageSearchAfter] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSearchLoading, setIsSearchLoading] = useState(false);
  const [calculatingPage, setCalculatingPage] = useState(false);
  const [error, setError] = useState(false);

  /**
   * Structure that contains the attributes that will be part of the page URL
   */
  const pagination = useRef(
    new PaginationURL({
      searchText: { required: false },
      sortBy: { required: false },
      order: { required: false },
    })
  );

  useEffect(() => {
    // Abort this effect if the screen was called in maintenance mode
    if (maintenanceMode) {
      return;
    }

    // Fetches query parameters from url
    const queryParams = pagination.current.obtainQueryParams();

    setSearchText(get(queryParams, 'searchText', ''));
    setSortBy(get(queryParams, 'sortBy', ''));
    setOrder(get(queryParams, 'order', ''));
    setIsLoading(false);

    setIsSearchLoading(true); // Triggers the initial search query
  }, [maintenanceMode]);

  /**
   *
   * Call explorer-service to get list of tokens according to the search criteria
   *
   * @param {*} searchAfter Parameter needed by ElasticSearch for pagination purposes
   * @param {string} newSearchText
   * @param {string} newSortBy
   * @param {string} newOrder
   * @returns tokens
   */
  const getTokens = useCallback(async (searchAfter, newSearchText, newSortBy, newOrder) => {
    const tokensRequest = await tokensApi.getList(newSearchText, newSortBy, newOrder, searchAfter);

    setError(get(tokensRequest, 'error', false));

    const apiTokens = get(tokensRequest, 'data', { hits: [], has_next: false });
    apiTokens.hits = apiTokens.hits.map(token => ({
      ...token,
      uid: token.id,
      nft: get(token, 'nft', false),
    }));
    return apiTokens;
  }, []);

  // Identify a state flag to start executing the main search query
  useEffect(() => {
    // The `isSearchLoading` state variable is used as a flag to trigger this effect and execute the query
    if (!isSearchLoading) {
      return;
    }

    // Update the URL every time the state changes, so user can share the results of a search
    const newURL = pagination.current.setURLParameters({
      searchText: searchText || '',
      sortBy: sortBy || '',
      order: order || '',
    });

    history.push(newURL);

    getTokens([], searchText, sortBy, order).then(apiTokens => {
      setIsSearchLoading(false);

      // When search button is clicked, results return to the first page
      setPage(1);
      setTokens(apiTokens.hits);
      setHasAfter(apiTokens.has_next);
      setHasBefore(false);
      setPageSearchAfter([{ page: 1, searchAfter: [] }]);
    });
  }, [isSearchLoading, searchText, sortBy, order, getTokens, history]);

  /**
   * Process events when user clicks on search button
   */
  const onSearchButtonClicked = () => {
    setIsSearchLoading(true);
  };

  /**
   * Updates searchText state value when input field is changed
   *
   * @param {*} event
   */
  const onSearchTextChanged = event => {
    setSearchText(event.target.value);
  };

  /**
   * Checks if enter button is pressed. If so, treat as a button click on search icon
   *
   * @param {*} event
   */
  const onSearchTextKeyUp = event => {
    if (event.key === 'Enter') {
      setIsSearchLoading(true);
    }
  };

  /**
   * Process events when next page is requested by user
   *
   * @param {*} _event
   */
  const nextPageClicked = async _event => {
    setCalculatingPage(true);

    const nextPage = page + 1;
    let searchAfter = get(find(pageSearchAfter, { page: nextPage }), 'searchAfter', []);

    // Calculate searchAfter of next page if not already calculated
    if (isEmpty(searchAfter)) {
      const lastCurrentTokenSort = get(last(tokens), 'sort', []);

      const newEntry = {
        page: nextPage,
        searchAfter: lastCurrentTokenSort,
      };

      setPageSearchAfter([...pageSearchAfter, newEntry]);

      searchAfter = lastCurrentTokenSort;
    }

    const gottenTokens = await getTokens(searchAfter, searchText, sortBy, order);

    setTokens(gottenTokens.hits);
    setHasAfter(gottenTokens.has_next);
    setHasBefore(true);
    setPage(nextPage);
    setCalculatingPage(false);
  };

  /**
   * Process events when previous page is requested by user
   *
   * @param {*} _event
   */
  const previousPageClicked = async _event => {
    setCalculatingPage(true);

    const previousPage = page - 1;
    const searchAfter = get(find(pageSearchAfter, { page: previousPage }), 'searchAfter', []);
    const gottenTokens = await getTokens(searchAfter, searchText, sortBy, order);

    setTokens(gottenTokens.hits);
    setHasAfter(true);
    setHasBefore(previousPage !== 1);
    setPage(previousPage);
    setCalculatingPage(false);
  };

  /**
   * Process table header click. This indicates that user wants data to be sorted by a determined field
   *
   * @param {*} event
   * @param {*} headerName
   */
  const tableHeaderClicked = async (event, headerName) => {
    let newOrder;
    if (headerName === sortBy) {
      newOrder = order === 'asc' ? 'desc' : 'asc';
    } else {
      setSortBy(headerName);
      newOrder = 'asc';
    }
    setOrder(newOrder);

    setIsSearchLoading(true);
  };

  const renderSearchField = () => {
    if (maintenanceMode) {
      return (
        <ErrorMessageWithIcon message="This feature is under maintenance. Please try again after some time" />
      );
    }

    return (
      <TokenSearchField
        onSearchButtonClicked={onSearchButtonClicked}
        onSearchTextChanged={onSearchTextChanged}
        searchText={searchText}
        onSearchTextKeyUp={onSearchTextKeyUp}
        isSearchLoading={isSearchLoading}
        loading={isLoading}
      />
    );
  };

  const renderTokensTable = () => {
    if (maintenanceMode) {
      return null;
    }

    if (error) {
      return <ErrorMessageWithIcon message="Error loading tokens. Please try again." />;
    }

    return (
      <TokensTable
        data={tokens}
        hasBefore={hasBefore}
        hasAfter={hasAfter}
        onNextPageClicked={nextPageClicked}
        onPreviousPageClicked={previousPageClicked}
        loading={isLoading}
        sortBy={sortBy}
        order={order}
        tableHeaderClicked={tableHeaderClicked}
        calculatingPage={calculatingPage}
      />
    );
  };

  return (
    <div className="w-100">
      <div className="col-12">
        <h1>{title}</h1>
      </div>
      {renderSearchField()}
      {renderTokensTable()}
    </div>
  );
}

/**
 * title: Tokens Page title
 * maintenanceMode: A "circuit breaker" to remove additional load when a problem is affecting explorer-service or its downstream services
 */
Tokens.propTypes = {
  title: PropTypes.string.isRequired,
  maintenanceMode: PropTypes.bool.isRequired,
};

export default Tokens;
