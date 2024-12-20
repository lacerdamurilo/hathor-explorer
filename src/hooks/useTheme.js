/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { useEffect } from 'react';
import { useSelector } from 'react-redux';

export const useTheme = () => {
  const theme = useSelector(state => state.theme);

  useEffect(() => {
    document.body.className = theme;
  }, [theme]);
};
