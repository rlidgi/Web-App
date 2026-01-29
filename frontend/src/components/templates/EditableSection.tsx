import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';

interface EditableSectionProps {
    id: string;
    children: React.ReactNode;
    editMode: boolean;
    sectionTitle?: string;
}

export function EditableSection({ id, children, editMode, sectionTitle }: EditableSectionProps) {
    // Debug logging
    React.useEffect(() => {
        console.log(`EditableSection[${id}]: editMode=${editMode}, sectionTitle=${sectionTitle}`);
    }, [id, editMode, sectionTitle]);

    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    console.log(`EditableSection[${id}]: Rendering with editMode=${editMode}`);

    if (!editMode) {
        console.log(`EditableSection[${id}]: Returning plain children (editMode is false)`);
        return <>{children}</>;
    }

    return (
        <div
            ref={setNodeRef}
            style={style}
            className="relative group"
        >
            {/* Drag handle - absolutely positioned outside the content flow */}
            <div
                className="absolute -left-8 top-0 opacity-0 group-hover:opacity-100 transition-opacity z-20"
                style={{ width: '32px' }}
            >
                <button
                    {...attributes}
                    {...listeners}
                    className="p-1 hover:bg-indigo-100 rounded cursor-grab active:cursor-grabbing touch-none border border-indigo-200 bg-white shadow-sm"
                    aria-label={`Drag to reorder ${sectionTitle || 'section'}`}
                    type="button"
                >
                    <GripVertical className="w-4 h-4 text-indigo-600" />
                </button>
            </div>

            {/* Visual indicator - subtle border */}
            <div className="border-2 border-indigo-300 rounded-lg shadow-sm bg-indigo-50/20 hover:bg-indigo-50/40 transition-colors p-2">
                <div className="bg-white rounded">
                    {children}
                </div>
            </div>
        </div>
    );
}

interface EditableTextProps {
    value: string;
    onChange: (value: string) => void;
    editMode: boolean;
    className?: string;
    as?: 'h1' | 'h2' | 'h3' | 'p' | 'span' | 'div';
    multiline?: boolean;
}

export function EditableText({
    value,
    onChange,
    editMode,
    className = '',
    as: Component = 'p',
    multiline = false,
}: EditableTextProps) {
    const [isFocused, setIsFocused] = React.useState(false);

    const handleBlur = (e: React.FocusEvent<HTMLElement>) => {
        const newValue = e.currentTarget.textContent || '';
        if (newValue !== value) {
            onChange(newValue);
        }
        setIsFocused(false);
    };

    const handleFocus = () => {
        setIsFocused(true);
    };

    if (!editMode) {
        return React.createElement(Component, { className }, value);
    }

    return React.createElement('div', {
        className: 'relative',
        children: [
            React.createElement(Component, {
                key: 'field',
                contentEditable: true,
                suppressContentEditableWarning: true,
                onBlur: handleBlur,
                onFocus: handleFocus,
                className: `${className} ${editMode ? 'cursor-text hover:bg-yellow-50/50 outline-none focus:ring-2 focus:ring-indigo-400 focus:bg-white rounded px-2 py-1 transition-colors' : ''}`,
                dangerouslySetInnerHTML: { __html: value },
            })
        ]
    });
}

