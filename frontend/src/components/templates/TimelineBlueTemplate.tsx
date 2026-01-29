import React, { useEffect, useMemo, useState, useCallback } from "react";
import { parseResumeContent } from "../../utils/resumeUtils";
import { RenderMaybeBullets } from "./RenderMaybeBullets";
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { EditableSection, EditableText } from './EditableSection';

interface TimelineBlueTemplateProps {
    content: string;
    editMode?: boolean;
    sectionOrder?: string[];
    onSectionOrderChange?: (order: string[]) => void;
    onContentChange?: (changes: any) => void;
}

/**
 * TimelineBlueTemplate
 * Recreates the uploaded "blue timeline" layout:
 * - Header row: initials badge + name + contact line
 * - Left column: section labels (PROFESSIONAL SUMMARY / SKILLS / WORK HISTORY / EDUCATION)
 * - Middle: vertical timeline line with dots
 * - Right: section contents
 */
export default function TimelineBlueTemplate({
    content,
    editMode = false,
    sectionOrder = [],
    onSectionOrderChange,
    onContentChange
}: TimelineBlueTemplateProps) {
    const sections: any = parseResumeContent(content);

    // Local state for inline editing - store entire sections object
    const [editedData, setEditedData] = useState(sections);

    useEffect(() => {
        if (sections) {
            setEditedData(sections);
        }
    }, [content]);

    // Generic update function
    const updateField = useCallback((field: string, value: string) => {
        setEditedData((prev) => {
            const updated = { ...prev, [field]: value };
            if (onContentChange) {
                onContentChange(updated);
            }
            return updated;
        });
    }, [onContentChange]);

    // Update experience field
    const updateExperience = useCallback((index: number, field: string, value: string) => {
        setEditedData((prev) => {
            const updatedExp = [...(prev.experience || [])];
            updatedExp[index] = { ...updatedExp[index], [field]: value };
            const updated = { ...prev, experience: updatedExp };
            if (onContentChange) {
                onContentChange(updated);
            }
            return updated;
        });
    }, [onContentChange]);

    // Update education field
    const updateEducation = useCallback((index: number, field: string, value: string) => {
        setEditedData((prev) => {
            const updatedEdu = [...(prev.education || [])];
            updatedEdu[index] = { ...updatedEdu[index], [field]: value };
            const updated = { ...prev, education: updatedEdu };
            if (onContentChange) {
                onContentChange(updated);
            }
            return updated;
        });
    }, [onContentChange]);

    const name = String(editedData.name || "Your Name");
    const initials = getInitials(name);
    const phone = String(editedData.phone || "").trim();
    const email = String(editedData.email || "").trim();
    const location = String(editedData.location || "").trim();

    const summary = String(editedData.summary || "").trim();
    const skills: string[] = Array.isArray(editedData.skills) ? editedData.skills : [];
    const experience = Array.isArray(editedData.experience) ? editedData.experience : [];
    const education = Array.isArray(editedData.education) ? editedData.education : [];

    // Drag and drop sensors
    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id && onSectionOrderChange) {
            const oldIndex = sectionOrder.indexOf(String(active.id));
            const newIndex = sectionOrder.indexOf(String(over.id));
            onSectionOrderChange(arrayMove(sectionOrder, oldIndex, newIndex));
        }
    };

    const allRows = useMemo(() => [
        {
            key: "summary",
            label: "PROFESSIONAL\nSUMMARY",
            content: (
                <div className="text-[11px] text-slate-600 leading-relaxed">
                    {editMode ? (
                        <EditableText
                            value={summary || "Summary goes here."}
                            onChange={(v) => updateField('summary', v)}
                            editMode={editMode}
                            className="text-[11px] leading-relaxed text-slate-600"
                            as="div"
                            multiline={true}
                        />
                    ) : summary ? (
                        <RenderMaybeBullets text={summary} className="text-[11px] leading-relaxed text-slate-600" />
                    ) : (
                        <span className="text-slate-400">Summary goes here.</span>
                    )}
                </div>
            ),
        },
        {
            key: "skills",
            label: "SKILLS",
            content: (
                <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-[11px] text-slate-700">
                    {skills.length > 0 ? (
                        skills.slice(0, 12).map((s, idx) => (
                            <div key={idx} className="flex items-start gap-2">
                                <span className="mt-[5px] w-1.5 h-1.5 rounded-full bg-slate-400" />
                                <span>{s}</span>
                            </div>
                        ))
                    ) : (
                        <span className="text-slate-400">Skills go here.</span>
                    )}
                </div>
            ),
        },
        {
            key: "work",
            label: "WORK HISTORY",
            content: (
                <div className="space-y-6">
                    {experience.length > 0 ? (
                        experience.slice(0, 4).map((exp: any, idx: number) => {
                            const title = exp.title || exp.position || "Role";
                            const company = exp.company || exp.organization || "";
                            const dates = exp.duration || exp.dates || [exp.start, exp.end].filter(Boolean).join(" - ");
                            const city = exp.location || exp.city || "";
                            return (
                                <div key={idx}>
                                    <div className="flex items-baseline justify-between gap-3">
                                        <EditableText
                                            value={String(title)}
                                            onChange={(v) => updateExperience(idx, 'title', v)}
                                            editMode={editMode}
                                            className="text-[11px] font-bold text-slate-800 uppercase tracking-[0.14em]"
                                            as="div"
                                        />
                                        <EditableText
                                            value={dates ? String(dates) : ""}
                                            onChange={(v) => updateExperience(idx, 'duration', v)}
                                            editMode={editMode}
                                            className="text-[11px] text-slate-500"
                                            as="div"
                                        />
                                    </div>
                                    <div className="mt-1 text-[11px] text-slate-600">
                                        <EditableText
                                            value={company ? String(company) : ""}
                                            onChange={(v) => updateExperience(idx, 'company', v)}
                                            editMode={editMode}
                                            className="inline text-[11px] text-slate-600"
                                            as="span"
                                        />
                                        {(company && city) ? ", " : ""}
                                        <EditableText
                                            value={city ? String(city) : ""}
                                            onChange={(v) => updateExperience(idx, 'location', v)}
                                            editMode={editMode}
                                            className="inline text-[11px] text-slate-600"
                                            as="span"
                                        />
                                    </div>
                                    {exp.description && (
                                        <div className="mt-2">
                                            {editMode ? (
                                                <EditableText
                                                    value={exp.description}
                                                    onChange={(v) => updateExperience(idx, 'description', v)}
                                                    editMode={editMode}
                                                    className="text-[11px] leading-relaxed text-slate-600"
                                                    as="div"
                                                    multiline={true}
                                                />
                                            ) : (
                                                <RenderMaybeBullets
                                                    text={exp.description}
                                                    forceBullets
                                                    className="text-[11px] leading-relaxed text-slate-600"
                                                />
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    ) : (
                        <span className="text-slate-400 text-[11px]">Work history goes here.</span>
                    )}
                </div>
            ),
        },
        {
            key: "education",
            label: "EDUCATION",
            content: (
                <div className="space-y-3">
                    {education.length > 0 ? (
                        education.slice(0, 3).map((edu: any, idx: number) => (
                            <div key={idx} className="flex items-baseline justify-between gap-3">
                                <div>
                                    <EditableText
                                        value={String(edu.degree || edu.title || "Degree")}
                                        onChange={(v) => updateEducation(idx, 'degree', v)}
                                        editMode={editMode}
                                        className="text-[11px] font-bold text-slate-800"
                                        as="div"
                                    />
                                    <EditableText
                                        value={String(edu.institution || edu.school || "")}
                                        onChange={(v) => updateEducation(idx, 'institution', v)}
                                        editMode={editMode}
                                        className="text-[11px] text-slate-600"
                                        as="div"
                                    />
                                </div>
                                <EditableText
                                    value={String(edu.year || edu.dates || edu.graduationDate || "")}
                                    onChange={(v) => updateEducation(idx, 'year', v)}
                                    editMode={editMode}
                                    className="text-[11px] text-slate-500"
                                    as="div"
                                />
                            </div>
                        ))
                    ) : (
                        <span className="text-slate-400 text-[11px]">Education goes here.</span>
                    )}
                </div>
            ),
        },
    ], [summary, skills, experience, education, editMode]);

    // Initialize section order if empty
    useEffect(() => {
        if (editMode && sectionOrder.length === 0 && allRows.length > 0 && onSectionOrderChange) {
            onSectionOrderChange(allRows.map(r => r.key));
        }
    }, [editMode, sectionOrder, allRows, onSectionOrderChange]);

    // Ordered rows for rendering
    const rows = useMemo(() => {
        if (!editMode || sectionOrder.length === 0) {
            return allRows;
        }
        const ordered = sectionOrder
            .map(key => allRows.find(r => r.key === key))
            .filter(Boolean) as Array<{ key: string; label: string; content: React.ReactNode; }>;

        // Add any new rows that aren't in the order yet
        allRows.forEach(row => {
            if (!sectionOrder.includes(row.key)) {
                ordered.push(row);
            }
        });

        return ordered;
    }, [editMode, sectionOrder, allRows]);

    return (
        <div className="bg-white rounded-lg shadow-lg ring-1 ring-black/5 overflow-hidden max-w-4xl mx-auto font-sans">
            <div className={`px-10 py-8 ${editMode ? 'pl-16' : ''}`}>
                {/* Header */}
                <div className="grid grid-cols-[135px_22px_1fr] gap-x-1 items-start">
                    <div />
                    <div />
                    <div className="flex items-start gap-4 min-w-0">
                        <div className="w-10 h-10 rounded-full border-2 border-sky-500/60 text-slate-700 flex items-center justify-center font-semibold text-sm">
                            {initials}
                        </div>
                        <div className="min-w-0">
                            <EditableText
                                value={name}
                                onChange={(v) => updateField('name', v)}
                                editMode={editMode}
                                className="text-3xl font-light text-sky-600 leading-tight"
                                as="div"
                            />
                            <div className="mt-1 text-xs text-slate-500 flex flex-wrap items-center gap-x-2 gap-y-1">
                                {phone && <span>{phone}</span>}
                                {phone && email && <span className="text-slate-300">|</span>}
                                {email && <span>E: {email}</span>}
                                {(phone || email) && location && <span className="text-slate-300">|</span>}
                                {location && <span>{location}</span>}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Body */}
                <div className="mt-8">
                    <div className="relative">
                        {/* Continuous timeline line (centered in the 22px middle column) */}
                        <div
                            className="absolute top-0 bottom-0 w-px bg-slate-200 z-0 pointer-events-none"
                            style={{ left: "calc(135px + 4px + 11px)" }}
                        />

                        {editMode ? (
                            <DndContext
                                sensors={sensors}
                                collisionDetection={closestCenter}
                                onDragEnd={handleDragEnd}
                            >
                                <SortableContext
                                    items={sectionOrder.length > 0 ? sectionOrder : allRows.map(r => r.key)}
                                    strategy={verticalListSortingStrategy}
                                >
                                    <div className="space-y-10">
                                        {rows.map((row) => (
                                            <EditableSection key={row.key} id={row.key} editMode={editMode} sectionTitle={row.label.replace('\n', ' ')}>
                                                <div className="grid grid-cols-[135px_22px_1fr] gap-x-1">
                                                    <div className="pt-1 text-[11px] font-bold tracking-[0.18em] text-sky-700 whitespace-pre-line">
                                                        {row.label}
                                                    </div>
                                                    <div className="pt-2 flex justify-center">
                                                        <span className="relative z-10 w-2.5 h-2.5 rounded-full bg-white border-2 border-slate-300" />
                                                    </div>
                                                    <div>{row.content}</div>
                                                </div>
                                            </EditableSection>
                                        ))}
                                    </div>
                                </SortableContext>
                            </DndContext>
                        ) : (
                            <div className="space-y-10">
                                {rows.map((row) => (
                                    <div key={row.key} className="grid grid-cols-[135px_22px_1fr] gap-x-1">
                                        <div className="pt-1 text-[11px] font-bold tracking-[0.18em] text-sky-700 whitespace-pre-line">
                                            {row.label}
                                        </div>
                                        <div className="pt-2 flex justify-center">
                                            <span className="relative z-10 w-2.5 h-2.5 rounded-full bg-white border-2 border-slate-300" />
                                        </div>
                                        <div>{row.content}</div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

function getInitials(fullName: string): string {
    const cleaned = String(fullName || "").trim().replace(/\s+/g, " ");
    if (!cleaned) return "JD";
    const parts = cleaned.split(" ").filter(Boolean);
    const first = parts[0]?.[0] || "J";
    const last = (parts.length > 1 ? parts[parts.length - 1]?.[0] : parts[0]?.[1]) || "D";
    return `${String(first).toUpperCase()}${String(last).toUpperCase()}`;
}


