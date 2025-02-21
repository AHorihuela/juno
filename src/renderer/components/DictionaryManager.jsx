import React, { useState, useEffect } from 'react';
import { getIpcRenderer } from '../utils/electron';

const DictionaryManager = () => {
  const [entries, setEntries] = useState({});
  const [newIncorrect, setNewIncorrect] = useState('');
  const [newCorrect, setNewCorrect] = useState('');
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    loadEntries();
  }, []);

  const loadEntries = async () => {
    try {
      const ipcRenderer = getIpcRenderer();
      const loadedEntries = await ipcRenderer.invoke('get-dictionary-entries');
      setEntries(loadedEntries);
    } catch (error) {
      console.error('Error loading dictionary entries:', error);
      setError('Failed to load dictionary entries');
    }
  };

  const handleAddEntry = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (!newIncorrect || !newCorrect) {
      setError('Both words are required');
      return;
    }

    try {
      const ipcRenderer = getIpcRenderer();
      await ipcRenderer.invoke('add-dictionary-entry', {
        incorrect: newIncorrect,
        correct: newCorrect
      });
      
      // Reset form and reload entries
      setNewIncorrect('');
      setNewCorrect('');
      await loadEntries();
      setSuccess(true);
    } catch (error) {
      console.error('Error adding dictionary entry:', error);
      setError(error.message);
    }
  };

  const handleRemoveEntry = async (incorrect) => {
    try {
      const ipcRenderer = getIpcRenderer();
      await ipcRenderer.invoke('remove-dictionary-entry', incorrect);
      await loadEntries();
      setSuccess(true);
    } catch (error) {
      console.error('Error removing dictionary entry:', error);
      setError(error.message);
    }
  };

  return (
    <div className="setting-group">
      <h3>Custom Dictionary</h3>
      
      {error && (
        <div className="error-message">
          {error}
        </div>
      )}
      
      {success && (
        <div className="success-message">
          Dictionary updated successfully!
        </div>
      )}

      <form onSubmit={handleAddEntry} className="dictionary-form">
        <div className="form-row">
          <input
            type="text"
            value={newIncorrect}
            onChange={(e) => setNewIncorrect(e.target.value)}
            placeholder="Incorrect word"
            className="dictionary-input"
          />
          <span className="arrow">→</span>
          <input
            type="text"
            value={newCorrect}
            onChange={(e) => setNewCorrect(e.target.value)}
            placeholder="Correct word"
            className="dictionary-input"
          />
          <button type="submit" className="add-button">
            Add
          </button>
        </div>
      </form>

      <div className="dictionary-entries">
        {Object.entries(entries).length > 0 ? (
          <table>
            <thead>
              <tr>
                <th>Incorrect</th>
                <th>Correct</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(entries).map(([incorrect, correct]) => (
                <tr key={incorrect}>
                  <td>{incorrect}</td>
                  <td>{correct}</td>
                  <td>
                    <button
                      onClick={() => handleRemoveEntry(incorrect)}
                      className="remove-button"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="no-entries">No dictionary entries yet</p>
        )}
      </div>

      <style jsx>{`
        .dictionary-form {
          margin-bottom: 20px;
        }

        .form-row {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .dictionary-input {
          flex: 1;
          padding: 8px;
          border: 1px solid #ddd;
          border-radius: 4px;
        }

        .arrow {
          color: #666;
          font-weight: bold;
        }

        .add-button {
          padding: 8px 16px;
          background-color: #4caf50;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        }

        .add-button:hover {
          background-color: #45a049;
        }

        .dictionary-entries {
          margin-top: 20px;
        }

        table {
          width: 100%;
          border-collapse: collapse;
        }

        th, td {
          padding: 12px;
          text-align: left;
          border-bottom: 1px solid #ddd;
        }

        th {
          background-color: #f5f5f5;
        }

        .remove-button {
          padding: 6px 12px;
          background-color: #f44336;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        }

        .remove-button:hover {
          background-color: #d32f2f;
        }

        .no-entries {
          text-align: center;
          color: #666;
          font-style: italic;
        }

        .error-message {
          color: #d32f2f;
          margin-bottom: 10px;
        }

        .success-message {
          color: #4caf50;
          margin-bottom: 10px;
        }
      `}</style>
    </div>
  );
};

export default DictionaryManager; 