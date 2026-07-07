/**
 * Issuer Dashboard Component
 * 
 * Dashboard for RWA issuers to:
 * - Create new assets
 * - Mint tokens
 * - View holder distribution
 * - Generate audit reports
 * 
 * ADD-ON ONLY: Does not modify existing OmniLearn UI
 */

import React, { useState } from 'react';

interface Asset {
  id: string;
  name: string;
  type: string;
  totalValue: number;
  tokensMinted: number;
  status: 'active' | 'pending' | 'completed';
}

export function IssuerDashboard() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Form state
  const [assetName, setAssetName] = useState('');
  const [assetType, setAssetType] = useState('treasury-bond');
  const [totalValue, setTotalValue] = useState(1000000);
  const [tokensCount, setTokensCount] = useState(1000);

  const handleCreateAsset = async () => {
    setLoading(true);
    try {
      // TODO: Call Canton API
      const response = await fetch('/api/canton/assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: assetName,
          type: assetType,
          totalValue,
          tokensCount,
        }),
      });

      if (response.ok) {
        const newAsset = await response.json();
        setAssets([...assets, newAsset]);
        setShowCreateForm(false);
        setAssetName('');
        setTotalValue(1000000);
        setTokensCount(1000);
      }
    } catch (error) {
      console.error('Failed to create asset:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateAudit = async (assetId: string) => {
    try {
      const response = await fetch(`/api/canton/audit?assetId=${assetId}`);
      const report = await response.json();
      // Download or display report
      console.log('Audit report:', report);
    } catch (error) {
      console.error('Failed to generate audit:', error);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          RWA Issuer Dashboard
        </h1>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          {showCreateForm ? 'Cancel' : 'Create Asset'}
        </button>
      </div>

      {/* Create Asset Form */}
      {showCreateForm && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Create New RWA Asset</h2>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Asset Name
              </label>
              <input
                type="text"
                value={assetName}
                onChange={(e) => setAssetName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="e.g., Treasury Bond 2026-A"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Asset Type
              </label>
              <select
                value={assetType}
                onChange={(e) => setAssetType(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="treasury-bond">Treasury Bond</option>
                <option value="corporate-bond">Corporate Bond</option>
                <option value="equity">Equity</option>
                <option value="real-estate">Real Estate</option>
                <option value="fund-share">Fund Share</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Total Value (USD)
              </label>
              <input
                type="number"
                value={totalValue}
                onChange={(e) => setTotalValue(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Number of Tokens
              </label>
              <input
                type="number"
                value={tokensCount}
                onChange={(e) => setTokensCount(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
          </div>

          <button
            onClick={handleCreateAsset}
            disabled={loading || !assetName}
            className="mt-4 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400"
          >
            {loading ? 'Creating...' : 'Create & Mint Tokens'}
          </button>
        </div>
      )}

      {/* Assets List */}
      <div className="bg-white rounded-lg shadow">
        <h2 className="text-lg font-semibold p-4 border-b">Your Assets</h2>
        
        {assets.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            No assets issued yet. Create your first RWA asset above.
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">Name</th>
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">Type</th>
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">Total Value</th>
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">Tokens</th>
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">Status</th>
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {assets.map((asset) => (
                <tr key={asset.id} className="border-t">
                  <td className="px-4 py-3">{asset.name}</td>
                  <td className="px-4 py-3 capitalize">{asset.type.replace('-', ' ')}</td>
                  <td className="px-4 py-3">${asset.totalValue.toLocaleString()}</td>
                  <td className="px-4 py-3">{asset.tokensMinted.toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      asset.status === 'active' ? 'bg-green-100 text-green-800' :
                      asset.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {asset.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleGenerateAudit(asset.id)}
                      className="text-blue-600 hover:text-blue-800 text-sm"
                    >
                      Audit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
