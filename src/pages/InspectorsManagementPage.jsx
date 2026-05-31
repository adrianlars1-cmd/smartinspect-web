import React, { useState, useEffect } from 'react';
import { apiClient } from '../services/api';
import './InspectorsManagementPage.css';

export default function InspectorsManagementPage() {
  const [inspectors, setInspectors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateInspector, setShowCreateInspector] = useState(false);
  const [createdInspectorPassword, setCreatedInspectorPassword] = useState('');

  // Form states
  const [inspectorEmail, setInspectorEmail] = useState('');
  const [inspectorName, setInspectorName] = useState('');

  useEffect(() => {
    fetchInspectors();
  }, []);

  const fetchInspectors = async () => {
    try {
      setLoading(true);
      // Fetch all users with inspector role in the current company
      const response = await apiClient.get('/users/list-technicians');
      setInspectors(response.data);
      setError('');
    } catch (err) {
      setError('Failed to load inspectors: ' + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleCreateInspector = async (e) => {
    e.preventDefault();
    if (!inspectorEmail.trim() || !inspectorName.trim()) {
      setError('Email and name are required');
      return;
    }

    try {
      const response = await apiClient.post('/users/create-technician', {
        email: inspectorEmail,
        full_name: inspectorName,
        password: 'TempPassword123!' // Temporary password, user should change it
      });
      
      setCreatedInspectorPassword(response.data.temporary_password || 'TempPassword123!');
      setInspectorEmail('');
      setInspectorName('');
      setError('');
      fetchInspectors();
    } catch (err) {
      setError('Failed to create inspector: ' + (err.response?.data?.detail || err.message));
    }
  };

  if (loading) {
    return <div className="inspectors-page loading">Loading inspectors...</div>;
  }

  return (
    <div className="inspectors-page">
      <div className="inspectors-header">
        <h2>Manage Inspectors</h2>
        <button 
          className="btn btn-primary"
          onClick={() => setShowCreateInspector(!showCreateInspector)}
        >
          {showCreateInspector ? 'Cancel' : '+ Add Inspector'}
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}

      {showCreateInspector && (
        <form className="create-inspector-form" onSubmit={handleCreateInspector}>
          <h3>Create New Inspector</h3>
          <input
            type="email"
            placeholder="Inspector Email"
            value={inspectorEmail}
            onChange={(e) => setInspectorEmail(e.target.value)}
            required
          />
          <input
            type="text"
            placeholder="Inspector Full Name"
            value={inspectorName}
            onChange={(e) => setInspectorName(e.target.value)}
            required
          />
          <button type="submit" className="btn btn-success">Create Inspector</button>
        </form>
      )}

      {createdInspectorPassword && (
        <div className="inspector-created-success">
          <h3>✓ Inspector Created Successfully!</h3>
          <p>Share these credentials:</p>
          <div className="credentials-box">
            <p><strong>Email:</strong> {inspectorEmail}</p>
            <p><strong>Temporary Password:</strong> <code>{createdInspectorPassword}</code></p>
          </div>
          <button 
            className="btn btn-primary"
            onClick={() => {
              setCreatedInspectorPassword('');
              setInspectorEmail('');
              setInspectorName('');
            }}
          >
            Create Another
          </button>
        </div>
      )}

      <div className="inspectors-list">
        <h3>Your Inspectors ({inspectors.length})</h3>
        {inspectors.length === 0 ? (
          <p className="empty-state">No inspectors yet. Create one to get started!</p>
        ) : (
          <div className="inspectors-grid">
            {inspectors.map(inspector => (
              <div key={inspector.id} className="inspector-card">
                <h4>{inspector.full_name}</h4>
                <p className="email">{inspector.email}</p>
                <p className="status">
                  {inspector.is_active ? '✓ Active' : '✗ Inactive'}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
