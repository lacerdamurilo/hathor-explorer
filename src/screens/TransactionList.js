import React from 'react';
import Transactions from '../components/Transactions';


class TransactionList extends React.Component {
  render() {
    return (
      <div className="content-wrapper">
        <Transactions type="tx" />
      </div>
    );
  }
}

export default TransactionList;