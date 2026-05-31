import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../services/api';
import './SuperAdminPage.css';

export default function SuperAdminPage() {
  const navigate = useNavigate();
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateCompany, setShowCreateCompany] = useState(false);
  const [showCreateAdmin, setShowCreateAdmin] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [companyStats, setCompanyStats] = useState({});

  // Form states
  const [newCompanyName, setNewCompanyName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminName, setAdminName] = useState('');
  const [createdAdminPassword, setCreatedAdminPassword] = useState('');

  useEffect(() => {
    fetchCompanies();
  }, []);

  const fetchCompanies = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/admin/companies');
      setCompanies(response.data);
      setError('');
    } catch (err) {
      setError('Failed to load companies: ' + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  };

  const fetchCompanyStats = async (companyId) => {
    try {
      const response = await apiClient.get(`/admin/companies/${companyId}/stats`);
      setCompanyStats(prev => ({
        ...prev,
        [companyId]: response.data
      }));
    } catch (err) {
      console.error('Failed to load company stats:', err);
    }
  };

  const handleCreateCompany = async (e) => {
    e.preventDefault();
    if (!newCompanyName.trim()) {
      setError('Company name is required');
      return;
    }

    try {
      const response = await apiClient.post('/admin/companies', {
        name: newCompanyName
      });
      setCompanies([...companies, response.data]);
      setNewCompanyName('');
      setShowCreateCompany(false);
      setError('');
    } catch (err) {
      setError('Failed to create company: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleCreateAdmin = async (e) => {
    e.preventDefault();
    if (!adminEmail.trim() || !adminName.trim()) {
      setError('Email and name are required');
      return;
    }
    if (!selectedCompany) {
      setError('Please select a company');
      return;
    }

    try {
      const response = await apiClient.post(`/admin/companies/${selectedCompany.id}/admin`, {
        email: adminEmail,
        full_name: adminName
      });
      
      setCreatedAdminPassword(response.data.temporary_password);
      setAdminEmail('');
      setAdminName('');
      setError('');
      
      // Refresh company stats
      fetchCompanyStats(selectedCompany.id);
    } catch (err) {
      setError('Failed to create admin: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleSelectCompany = (company) => {
    setSelectedCompany(company);
    fetchCompanyStats(company.id);
    setShowCreateAdmin(true);
  };

  if (loading) {
    return <div className="super-admin-page loading">Loading companies...</div>;
  }

  return (
    <div className="super-admin-page">
      <div className="super-admin-header">
        <h1>SmartInspect AI - Super Admin Dashboard</h1>
        <p>Manage all companies and their administrators</p>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="super-admin-content">
        {/* Companies Section */}
        <div className="companies-section">
          <div className="section-header">
            <h2>Companies</h2>
            <button 
              className="btn btn-primary"
              onClick={() => setShowCreateCompany(!showCreateCompany)}
            >
              {showCreateCompany ? 'Cancel' : '+ New Company'}
            </button>
          </div>

          {showCreateCompany && (
            <form className="create-company-form" onSubmit={handleCreateCompany}>
              <input
                type="text"
                placeholder="Company Name"
                value={newCompanyName}
                onChange={(e) => setNewCompanyName(e.target.value)}
                required
              />
              <button type="submit" className="btn btn-success">Create Company</button>
            </form>
          )}

          <div className="companies-grid">
            {companies.length === 0 ? (
              <p className="empty-state">No companies yet. Create one to get started!</p>
            ) : (
              companies.map(company => (
                <div key={company.id} className="company-card">
                  <h3>{company.name}</h3>
                  <p className="company-id">ID: {company.id}</p>
                  
                  {companyStats[company.id] && (
                    <div className="company-stats">
                      <div className="stat">
                        <span className="stat-label">Users:</span>
                        <span className="stat-value">{companyStats[company.id].user_count}</span>
                      </div>
                      <div className="stat">
                        <span className="stat-label">Jobs:</span>
                        <span className="stat-value">{companyStats[company.id].job_count}</span>
                      </div>
                      <div className="stat">
                        <span className="stat-label">Inspections:</span>
                        <span className="stat-value">{companyStats[company.id].inspection_count}</span>
                      </div>
                    </div>
                  )}

                  <button 
                    className="btn btn-secondary"
                    onClick={() => handleSelectCompany(company)}
                  >
                    Manage Admin
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Create Admin Section */}
        {showCreateAdmin && selectedCompany && (
          <div className="create-admin-section">
            <div className="section-header">
              <h2>Create Admin for {selectedCompany.name}</h2>
              <button 
                className="btn btn-link"
                onClick={() => {
                  setShowCreateAdmin(false);
                  setSelectedCompany(null);
                  setCreatedAdminPassword('');
                }}
              >
                Close
              </button>
            </div>

            {createdAdminPassword ? (
              <div className="admin-created-success">
                <h3>✓ Admin Created Successfully!</h3>
                <p>Share these credentials with the admin:</p>
                <div className="credentials-box">
                  <p><strong>Email:</strong> {adminEmail}</p>
                  <p><strong>Temporary Password:</strong> <code>{createdAdminPassword}</code></p>
                </div>
                <p className="warning">⚠️ This password will only be shown once. Make sure to save it!</p>
                <button 
                  className="btn btn-primary"
                  onClick={() => {
                    setCreatedAdminPassword('');
                    fetchCompanies();
                  }}
                >
                  Create Another Admin
                </button>
              </div>
            ) : (
              <form className="create-admin-form" onSubmit={handleCreateAdmin}>
                <input
                  type="email"
                  placeholder="Admin Email"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  required
                />
                <input
                  type="text"
                  placeholder="Admin Full Name"
                  value={adminName}
                  onChange={(e) => setAdminName(e.target.value)}
                  required
                />
                <button type="submit" className="btn btn-success">Create Admin User</button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
