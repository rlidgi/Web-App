import React, { useState } from 'react';
import { EditableText } from './EditableSection';
import { X, Plus } from 'lucide-react';

interface EditableContentProps {
    data: any;
    onChange: (newData: any) => void;
    editMode: boolean;
    renderView: (data: any) => React.ReactNode;
    fieldPath?: string;
}

/**
 * Generic editable content wrapper that handles different data types:
 * - Strings: Direct text editing
 * - Arrays of strings: List editing with add/remove
 * - Arrays of objects: Complex object editing
 * - Objects: Key-value pair editing
 */
export function EditableContent({ data, onChange, editMode, renderView, fieldPath = '' }: EditableContentProps) {
    if (!editMode) {
        return <>{renderView(data)}</>;
    }

    // String - simple text editing
    if (typeof data === 'string') {
        return (
            <EditableText
                value={data}
                onChange={onChange}
                editMode={editMode}
                className=""
                as="div"
                multiline={data.length > 100}
            />
        );
    }

    // Array of strings - list editing
    if (Array.isArray(data) && data.every(item => typeof item === 'string')) {
        return <EditableStringList items={data} onChange={onChange} />;
    }

    // Array of objects - complex editing
    if (Array.isArray(data) && data.length > 0 && typeof data[0] === 'object') {
        return <EditableObjectList items={data} onChange={onChange} renderView={renderView} />;
    }

    // Object - key-value editing
    if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
        return <EditableObject obj={data} onChange={onChange} />;
    }

    // Fallback - just render the view
    return <>{renderView(data)}</>;
}

/**
 * Editable list of strings (e.g., skills, languages)
 */
function EditableStringList({ items, onChange }: { items: string[]; onChange: (newItems: string[]) => void }) {
    const [newItem, setNewItem] = useState('');

    const handleAdd = () => {
        if (newItem.trim()) {
            onChange([...items, newItem.trim()]);
            setNewItem('');
        }
    };

    const handleRemove = (index: number) => {
        onChange(items.filter((_, i) => i !== index));
    };

    const handleEdit = (index: number, value: string) => {
        const updated = [...items];
        updated[index] = value;
        onChange(updated);
    };

    return (
        <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
                {items.map((item, idx) => (
                    <div key={idx} className="group relative inline-flex items-center gap-1 bg-white border border-indigo-200 rounded px-2 py-1">
                        <EditableText
                            value={item}
                            onChange={(v) => handleEdit(idx, v)}
                            editMode={true}
                            className="text-xs"
                            as="span"
                        />
                        <button
                            onClick={() => handleRemove(idx)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity text-red-500 hover:text-red-700"
                            type="button"
                        >
                            <X className="w-3 h-3" />
                        </button>
                    </div>
                ))}
            </div>
            <div className="flex gap-2">
                <input
                    type="text"
                    value={newItem}
                    onChange={(e) => setNewItem(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAdd()}
                    placeholder="Add new item..."
                    className="flex-1 text-xs px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-400 outline-none"
                />
                <button
                    onClick={handleAdd}
                    className="px-2 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors"
                    type="button"
                >
                    <Plus className="w-3 h-3" />
                </button>
            </div>
        </div>
    );
}

/**
 * Editable list of objects (e.g., experience, education)
 */
function EditableObjectList({
    items,
    onChange,
    renderView
}: {
    items: any[];
    onChange: (newItems: any[]) => void;
    renderView: (data: any) => React.ReactNode;
}) {
    const handleUpdateItem = (index: number, field: string, value: any) => {
        const updated = [...items];
        updated[index] = { ...updated[index], [field]: value };
        onChange(updated);
    };

    const handleRemoveItem = (index: number) => {
        onChange(items.filter((_, i) => i !== index));
    };

    return (
        <div className="space-y-4">
            {items.map((item, idx) => (
                <div key={idx} className="relative border border-indigo-200 rounded-lg p-2 bg-white">
                    <button
                        onClick={() => handleRemoveItem(idx)}
                        className="absolute top-2 right-2 text-red-500 hover:text-red-700 opacity-0 hover:opacity-100 transition-opacity z-10"
                        type="button"
                        title="Remove this item"
                    >
                        <X className="w-4 h-4" />
                    </button>
                    <EditableObjectFields
                        obj={item}
                        onChange={(newObj) => {
                            const updated = [...items];
                            updated[idx] = newObj;
                            onChange(updated);
                        }}
                    />
                </div>
            ))}
        </div>
    );
}

/**
 * Editable object with key-value pairs
 */
function EditableObject({ obj, onChange }: { obj: any; onChange: (newObj: any) => void }) {
    return <EditableObjectFields obj={obj} onChange={onChange} />;
}

/**
 * Render editable fields for all keys in an object
 */
function EditableObjectFields({ obj, onChange }: { obj: any; onChange: (newObj: any) => void }) {
    const handleFieldChange = (key: string, value: any) => {
        onChange({ ...obj, [key]: value });
    };

    return (
        <div className="space-y-2">
            {Object.keys(obj).map((key) => {
                const value = obj[key];
                const isLongText = typeof value === 'string' && value.length > 100;

                return (
                    <div key={key} className="flex flex-col gap-1">
                        <label className="text-[10px] font-semibold text-gray-600 uppercase tracking-wider">
                            {key.replace(/_/g, ' ')}
                        </label>
                        {typeof value === 'string' ? (
                            <EditableText
                                value={value}
                                onChange={(v) => handleFieldChange(key, v)}
                                editMode={true}
                                className="text-xs"
                                as="div"
                                multiline={isLongText}
                            />
                        ) : Array.isArray(value) ? (
                            <div className="text-xs text-gray-500 italic">
                                [Array - use left panel to edit]
                            </div>
                        ) : typeof value === 'object' && value !== null ? (
                            <div className="text-xs text-gray-500 italic">
                                [Object - use left panel to edit]
                            </div>
                        ) : (
                            <div className="text-xs">{String(value)}</div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

