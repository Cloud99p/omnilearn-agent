/**
 * Observer/Regulator View Component
 * 
 * Dashboard for auditors and regulators to:
 * - View all assets on Canton
 * - Generate compliance reports
 * - Audit transaction history
 * - Download regulatory exports
 * 
 * ADD-ON ONLY: Does not modify existing OmniLearn UI
 */

import React, { useState } from 'react';

interface AssetSummary {
  assetId: string;
  name: string;
  totalValue: number;
  tokensMinted: number;
  holders: number;
  jurisdiction: string;
  complianceScore: number;
}

interface ComplianceReport {
  totalAssets: number;
  totalValue: number;
  totalHolders: number;
  kycCompliance: number;
  amlCompliance: number;
  violations: Array<{
    assetId: string;
    type: string;
    severity: 'low' | 'medium' | 'high';
    description: string;
  }>;
}

export function ObserverView() {
  const [assets, setAssets] = useState<AssetSummary[]>([
    // Mock data for demo
    {
      assetId: 'rwa_001',
      name: 'Treasury Bond 2026-A',
      totalValue: 1000000,
      tokensMinted: 1000,
      holders: 15,
      jurisdiction: 'US',
      complianceScore: 95,
    },
  ]);

  const [showReport, setShowReport] = useState(false);
  const [reportType, setReportType] = useState('full');
  const [reportLoading, setReportLoading] = useState(false);

  const totalValue = assets.reduce((sum, a) => sum + a.totalValue, 0);
  const totalHolders = assets.reduce((sum, a) => sum + a.holders, 0);

  const handleGenerateReport = async () => {
    setReportLoading(true);
    try {
      const response = await fetch('/api/canton/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: reportType }),
      });

      if (response.ok) {
        const report = await response.json();
        alert(`Report generated: ${report.id}`);
        console.log('Compliance report:', report);
      }
    } catch (error) {
      console.error('Report generation failed:', error);
    } finally {
      setReportLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        RWA Observer & Regulator View
      </h1>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">Total Assets</div>
          <div className="text-2xl font-bold">{assets.length}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">Total Value</div>
          <div className="text-2xl font-bold">${(totalValue / 1000000).toFixed(1)}M</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">Total Holders</div>
          <div className="text-2xl font-bold">{totalHolders}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">Avg Compliance</div>
          <div className="text-2xl font-bold">
            {Math.round(assets.reduce((sum, a) => sum + a.complianceScore, 0) / assets.length)}%
          </div>
        </div>
      </div>

      {/* Report Generation */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <h2 className="text-lg font-semibold mb-3">Generate Compliance Report</h2>
        
        <div className="flex gap-4 items-center">
          <select
            value={reportType}
            onChange={(e) => setReportType(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md"
          >
            <option value="full">Full Compliance Report</option>
            <option value="asset">Asset-Specific Report</option>
            <option value="transaction">Transaction Audit</option>
            <option value="regulatory">Regulatory Export (MiFID II)</option>
          </select>

          <button
            onClick={handleGenerateReport}
            disabled={reportLoading}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
          >
            {reportLoading ? 'Generating...' : 'Generate Report'}
          </button>

          <button
            onClick={() => alert('Download sample report')}
            className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
          >
            Download Sample
          </button>
        </div>
      </div>

      {/* Asset List */}
      <div className="bg-white rounded-lg shadow">
        <h2 className="text-lg font-semibold p-4 border-b">All RWA Assets</h2>
        
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">Asset</th>
              <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">Total Value</th>
              <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">Tokens</th>
              <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">Holders</th>
              <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">Jurisdiction</th>
              <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">Compliance</th>
              <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody>
            {assets.map((asset) => (
              <tr key={asset.assetId} className="border-t">
                <td className="px-4 py-3">{asset.name}</td>
                <td className="px-4 py-3">${asset.totalValue.toLocaleString()}</td>
                <td className="px-4 py-3">{asset.tokensMinted.toLocaleString()}</td>
                <td className="px-4 py-3">{asset.holders}</td>
                <td className="px-4 py-3">{asset.jurisdiction}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-24 bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${
                          asset.complianceScore >= 90 ? 'bg-green-500' :
                          asset.complianceScore >= 70 ? 'bg-yellow-500' :
                          'bg-red-500'
                        }`}
                        style={{ width: `${asset.complianceScore}%` }}
                      />
                    </div>
                    <span className="text-sm">{asset.complianceScore}%</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => alert(`View details for ${asset.assetId}`)}
                    className="text-blue-600 hover:text-blue-800 text-sm"
                  >
                    View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Compliance Status Legend */}
      <div className="mt-6 text-sm text-gray-600">
        <p className="font-semibold mb-2">Compliance Score Legend:</p>
        <div className="flex gap-4">
          <span className="inline-flex items-center gap-1">
            <span className="w-3 h-3 bg-green-500 rounded-full"></span> 90%+ (Excellent)
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-3 h-3 bg-yellow-500 rounded-full"></span> 70-89% (Good)
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-3 h-3 bg-red-500 rounded-full"></span> &lt;70% (Needs Review)
          </span>
        </div>
      </div>
    </div>
  );
}
