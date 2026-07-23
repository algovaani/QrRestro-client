import React, { useState, useEffect } from 'react';
import API from '../../services/api';
import Sidebar from '../../components/common/Sidebar';
import Header from '../../components/common/Header';
import { useBranch } from '../../context/BranchContext';
import { Download, Printer, Calendar, BarChart2, DollarSign } from 'lucide-react';

export default function ReportsPage() {
  const { branchQueryParams, isAllBranches } = useBranch();
  const [reportType, setReportType] = useState('sales'); // 'sales', 'items', 'tables'
  const [salesData, setSalesData] = useState([]);
  const [itemsData, setItemsData] = useState([]);
  const [tablesData, setTablesData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReport();
  }, [reportType, branchQueryParams.branchId]);

  const fetchReport = async () => {
    setLoading(true);
    try {
      if (reportType === 'sales') {
        const res = await API.get('/reports/sales', { params: branchQueryParams });
        if (res.data.success) setSalesData(res.data.sales);
      } else if (reportType === 'items') {
        const res = await API.get('/reports/items', { params: branchQueryParams });
        if (res.data.success) setItemsData(res.data.items);
      } else if (reportType === 'tables') {
        const res = await API.get('/reports/tables', { params: branchQueryParams });
        if (res.data.success) setTablesData(res.data.tables);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const exportCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    if (reportType === 'sales') {
      csvContent += "Date,Total Orders,Subtotal,Tax,Total Revenue\n";
      salesData.forEach(row => {
        csvContent += `${row._id},${row.totalOrders},${row.subtotal},${row.tax},${row.totalRevenue}\n`;
      });
    } else if (reportType === 'items') {
      csvContent += "Item Name,Quantity Sold,Total Revenue\n";
      itemsData.forEach(row => {
        csvContent += `"${row._id}",${row.quantitySold},${row.totalRevenue}\n`;
      });
    } else if (reportType === 'tables') {
      csvContent += "Branch,Table Number,Total Orders,Total Revenue\n";
      tablesData.forEach(row => {
        csvContent += `"${row.branchName || ''}",Table ${row.tableNumber},${row.totalOrders},${row.totalRevenue}\n`;
      });
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Restaurant_${reportType}_report.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const printReport = () => {
    window.print();
  };

  return (
    <div className="admin-layout">
      <Sidebar />
      <div className="admin-main">
        <Header title="Analytics & Reports" />
        <div className="admin-content">

          {/* Action Bar */}
          <div className="admin-action-bar">
            <div>
              <button
                onClick={() => setReportType('sales')}
                className={`btn ${reportType === 'sales' ? 'btn-primary' : 'btn-secondary'}`}
              >
                Sales Report
              </button>
              <button
                onClick={() => setReportType('items')}
                className={`btn ${reportType === 'items' ? 'btn-primary' : 'btn-secondary'}`}
              >
                Item Sales
              </button>
              <button
                onClick={() => setReportType('tables')}
                className={`btn ${reportType === 'tables' ? 'btn-primary' : 'btn-secondary'}`}
              >
                Table Orders
              </button>
            </div>

            <div>
              <button onClick={exportCSV} className="btn btn-secondary">
                <Download size={16} /> Export CSV
              </button>
              <button onClick={printReport} className="btn btn-secondary">
                <Printer size={16} /> Print Report
              </button>
            </div>
          </div>

          {/* Report Data Tables */}
          <div className="admin-panel admin-table-wrap">
            {reportType === 'sales' && (
              <table className="admin-table-compact" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                <thead style={{ background: '#f8fafc', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                  <tr>
                    <th style={{ padding: '0.8rem 1rem' }}>DATE</th>
                    <th style={{ padding: '0.8rem 1rem' }}>ORDERS</th>
                    <th style={{ padding: '0.8rem 1rem' }}>SUBTOTAL</th>
                    <th style={{ padding: '0.8rem 1rem' }}>TAX</th>
                    <th style={{ padding: '0.8rem 1rem' }}>TOTAL REVENUE</th>
                  </tr>
                </thead>
                <tbody>
                  {salesData.map((row, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '1rem', fontWeight: '700' }}>{row._id}</td>
                      <td style={{ padding: '1rem' }}>{row.totalOrders}</td>
                      <td style={{ padding: '1rem' }}>₹{row.subtotal}</td>
                      <td style={{ padding: '1rem' }}>₹{row.tax}</td>
                      <td style={{ padding: '1rem', fontWeight: '800', color: 'var(--primary)' }}>₹{row.totalRevenue}</td>
                    </tr>
                  ))}
                  {salesData.length === 0 && !loading && (
                    <tr><td colSpan="5" style={{ textAlign: 'center', padding: '3rem' }}>No sales data logged yet.</td></tr>
                  )}
                </tbody>
              </table>
            )}

            {reportType === 'items' && (
              <table className="admin-table-compact" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                <thead style={{ background: '#f8fafc', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                  <tr>
                    <th style={{ padding: '0.8rem 1rem' }}>ITEM NAME</th>
                    <th style={{ padding: '0.8rem 1rem' }}>QUANTITY SOLD</th>
                    <th style={{ padding: '0.8rem 1rem' }}>TOTAL REVENUE</th>
                  </tr>
                </thead>
                <tbody>
                  {itemsData.map((row, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '1rem', fontWeight: '700' }}>{row._id}</td>
                      <td style={{ padding: '1rem' }}>{row.quantitySold} units</td>
                      <td style={{ padding: '1rem', fontWeight: '800', color: 'var(--primary)' }}>₹{row.totalRevenue}</td>
                    </tr>
                  ))}
                  {itemsData.length === 0 && !loading && (
                    <tr><td colSpan="3" style={{ textAlign: 'center', padding: '3rem' }}>No item sales logged yet.</td></tr>
                  )}
                </tbody>
              </table>
            )}

            {reportType === 'tables' && (
              <table className="admin-table-compact" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                <thead style={{ background: '#f8fafc', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                  <tr>
                    {isAllBranches && <th style={{ padding: '0.8rem 1rem' }}>BRANCH</th>}
                    <th style={{ padding: '0.8rem 1rem' }}>TABLE</th>
                    <th style={{ padding: '0.8rem 1rem' }}>TOTAL ORDERS</th>
                    <th style={{ padding: '0.8rem 1rem' }}>TOTAL REVENUE</th>
                  </tr>
                </thead>
                <tbody>
                  {tablesData.map((row, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      {isAllBranches && (
                        <td style={{ padding: '1rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                          {row.branchName || '—'}
                        </td>
                      )}
                      <td style={{ padding: '1rem', fontWeight: '700' }}>Table {row.tableNumber ?? row._id?.tableNumber ?? row._id}</td>
                      <td style={{ padding: '1rem' }}>{row.totalOrders}</td>
                      <td style={{ padding: '1rem', fontWeight: '800', color: 'var(--primary)' }}>₹{row.totalRevenue}</td>
                    </tr>
                  ))}
                  {tablesData.length === 0 && !loading && (
                    <tr><td colSpan="3" style={{ textAlign: 'center', padding: '3rem' }}>No table data logged yet.</td></tr>
                  )}
                </tbody>
              </table>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
