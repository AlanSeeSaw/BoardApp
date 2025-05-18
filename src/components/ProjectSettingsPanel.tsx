import React, { useState, useEffect } from 'react';
import { BoardType, ColumnType } from '../types';
import './ProjectSettingsPanel.css';

interface ProjectSettingsPanelProps {
    board: BoardType;
    onSave: (columns: ColumnType[]) => void;
    onClose: () => void;
}

const ProjectSettingsPanel: React.FC<ProjectSettingsPanelProps> = ({ board, onSave, onClose }) => {
    const [columns, setColumns] = useState<ColumnType[]>(board.columns);

    const toggleEnabled = (id: string) => {
        setColumns(prevCols => {
            const newCols = prevCols.map(col =>
                col.id === id
                    ? { ...col, timeEstimationEnabled: !col.timeEstimationEnabled }
                    : col
            );
            return newCols;
        });
    };

    const updateDescription = (id: string, value: string) => {
        setColumns(prevCols => {
            const newCols = prevCols.map(col =>
                col.id === id
                    ? { ...col, description: value }
                    : col
            );
            return newCols;
        });
    };

    const handleSave = () => {
        onSave(columns);
    };

    return (
        <div className="project-settings-panel">
            <h2>Project Settings</h2>
            <div className="project-settings-list">
                {columns.map(col => (
                    <div key={col.id} className="project-settings-item">
                        <div className="column-title-setting">
                            <h3>{col.title}</h3>
                            <label className="toggle-switch-label">
                                <span className="toggle-label-text">Use for card estimates:</span>
                                <input
                                    type="checkbox"
                                    className="toggle-switch"
                                    checked={!!col.timeEstimationEnabled}
                                    onChange={() => toggleEnabled(col.id)}
                                />
                            </label>
                        </div>
                        <textarea
                            placeholder={`Description for ${col.title} (optional)`}
                            value={col.description || ''}
                            onChange={e => updateDescription(col.id, e.target.value)}
                            className="column-description-input"
                        />
                    </div>
                ))}
            </div>
            <div className="project-settings-actions">
                <button className="primary-button" onClick={handleSave}>Save</button>
                <button className="secondary-button" onClick={onClose}>Cancel</button>
            </div>
        </div>
    );
};

export default ProjectSettingsPanel; 