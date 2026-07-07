/**
 * Holder Wallet Component
 * 
 * Wallet for RWA token holders to:
 * - View owned assets
 * - Transfer tokens
 * - View transaction history
 * - Download compliance certificates
 * 
 * ADD-ON ONLY: Does not modify existing OmniLearn UI
 */

import React, { useState } from 'react';

interface Holding {
  assetId: string;
  assetName: string;
  assetType: string;
  tokens: number;
  value: number;
  acquiredAt: string;
}

interface Transaction {
  id: string;
  assetId: string;
  type: 'buy' | 'sell' | 'transfer-in' | 'transfer-out';
  tokens: number;
  timestamp: string;
  counterparty?: string;
}

export function HolderWallet() {
  const [holdings, setHoldings] = useState<Holding[]>([
    // Mock data for demo
    {
      assetId: 'rwa_001',
      assetName: 'Treasury Bond 2026-A',
      assetType: 'treasury-bond',
      tokens: 50,
      value: 50000,
      acquiredAt: '2026-06-15',
    },
  ]);

  const [transactions, setTransactions] = useState<Transaction[]>([
    {
      id: 'tx_001',
      assetId: 'rwa_001',
      type: 'buy',
      tokens: 50,
      timestamp: '2026-06-15T10:30:00Z',
    },
  ]);

  const [showTransferForm, setShowTransferForm] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<string>('');
  const [transferTokens, setTransferTokens] = useState(1);
  const [recipientDid, setRecipientDid] = useState('');

  const handleTransfer = async () => {
    try {
      const response = await fetch('/api/canton/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assetId: selectedAsset,
          tokens: transferTokens,
          to: recipientDid,
        }),
      });

      if (response.ok) {
        alert('Transfer successful!');
        setShowTransferForm(false);
        setTransferTokens(1);
        setRecipientDid('');
      }
    } catch (error) {
      console.error('Transfer failed:', error);
      alert('Transfer failed. Please check compliance requirements.');
    }
  };

  const totalValue = holdings.reduce((sum, h) => sum + h.value, 0);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        RWA Holder Wallet
      </h1>

      {/* Portfolio Summary */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">Total Value</div>
          <div className="text-2xl font-bold">${totalValue.toLocaleString()}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">Assets Held</div>
          <div className="text-2xl font-bold">{holdings.length}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">Transactions</div>
          <div className="text-2xl font-bold">{transactions.length}</div>
        </div>
      </div>

      {/* Holdings */}
      <div className="bg-white rounded-lg shadow mb-6">
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-lg font-semibold">Your Holdings</h2>
          <button
            onClick={() => setShowTransferForm(!showTransferForm)}
            className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
          >
            Transfer Tokens
          </button>
        </div>

        {holdings.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            No RWA tokens held yet.
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">Asset</th>
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">Type</th>
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">Tokens</th>
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">Value</th>
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">Acquired</th>
              </tr>
            </thead>
            <tbody>
              {holdings.map((holding) => (
                <tr key={holding.assetId} className="border-t">
                  <td className="px-4 py-3">{holding.assetName}</td>
                  <td className="px-4 py-3 capitalize">{holding.assetType.replace('-', ' ')}</td>
                  <td className="px-4 py-3">{holding.tokens.toLocaleString()}</td>
                  <td className="px-4 py-3">${holding.value.toLocaleString()}</td>
                  <td className="px-4 py-3">{holding.acquiredAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Transfer Form */}
      {showTransferForm && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h3 className="text-lg font-semibold mb-4">Transfer Tokens</h3>
          
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Asset
              </label>
              <select
                value={selectedAsset}
                onChange={(e) => setSelectedAsset(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="">Select asset</option>
                {holdings.map((h) => (
                  <option key={h.assetId} value={h.assetId}>
                    {h.assetName} ({h.tokens} tokens)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tokens to Transfer
              </label>
              <input
                type="number"
                value={transferTokens}
                onChange={(e) => setTransferTokens(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                min="1"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Recipient DID
              </label>
              <input
                type="text"
                value={recipientDid}
                onChange={(e) => setRecipientDid(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="did:example:..."
              />
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <button
              onClick={handleTransfer}
              disabled={!selectedAsset || !recipientDid}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400"
            >
              Transfer
            </button>
            <button
              onClick={() => setShowTransferForm(false)}
              className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Transaction History */}
      <div className="bg-white rounded-lg shadow">
        <h2 className="text-lg font-semibold p-4 border-b">Transaction History</h2>
        
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">Type</th>
              <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">Tokens</th>
              <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">Date</th>
              <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">ID</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((tx) => (
              <tr key={tx.id} className="border-t">
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded-full text-xs ${
                    tx.type === 'buy' || tx.type === 'transfer-in'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {tx.type}
                  </span>
                </td>
                <td className="px-4 py-3">{tx.tokens.toLocaleString()}</td>
                <td className="px-4 py-3">{new Date(tx.timestamp).toLocaleDateString()}</td>
                <td className="px-4 py-3 font-mono text-sm">{tx.id}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
