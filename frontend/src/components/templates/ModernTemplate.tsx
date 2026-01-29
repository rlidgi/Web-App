import React, { useEffect, useMemo } from 'react';
import { Mail, Phone, MapPin, Linkedin, Globe, Briefcase, Award, Code, BookOpen, Star, Layers } from 'lucide-react';
import { parseResumeContent } from '../../utils/resumeUtils';
import { RenderMaybeBullets } from './RenderMaybeBullets';
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
import { EditableSection } from './EditableSection';

interface ModernTemplateProps {
    content: string;
    editMode?: boolean;
    sectionOrder?: string[];
    onSectionOrderChange?: (order: string[]) => void;
    onContentChange?: (changes: any) => void;
}

export default function ModernTemplate({
    content,
    editMode = false,
    sectionOrder = [],
    onSectionOrderChange,
    onContentChange
}: ModernTemplateProps) {
    console.log('ModernTemplate: Rendering with editMode=', editMode, 'sectionOrder=', sectionOrder);
    const sections = parseResumeContent(content);

    // Define available sections with their IDs
    const availableSections = useMemo(() => {
        const sectionsList: Array<{ id: string; title: string; }> = [];
        if (sections.summary) sectionsList.push({ id: 'summary', title: 'Professional Summary' });
        if (sections.experience && sections.experience.length > 0) sectionsList.push({ id: 'experience', title: 'Experience' });
        if (sections.projects && sections.projects.length > 0) sectionsList.push({ id: 'projects', title: 'Key Projects' });
        if (sections.certifications && sections.certifications.length > 0) sectionsList.push({ id: 'certifications', title: 'Certifications' });
        if (sections.education && sections.education.length > 0) sectionsList.push({ id: 'education', title: 'Education' });
        if (sections.skills && sections.skills.length > 0) sectionsList.push({ id: 'skills', title: 'Skills' });
        return sectionsList;
    }, [sections]);

    // Initialize section order if empty
    useEffect(() => {
        if (editMode && sectionOrder.length === 0 && availableSections.length > 0 && onSectionOrderChange) {
            onSectionOrderChange(availableSections.map(s => s.id));
        }
    }, [editMode, sectionOrder, availableSections, onSectionOrderChange]);

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

    // Ordered sections for rendering
    const orderedSections = useMemo(() => {
        if (!editMode || sectionOrder.length === 0) {
            return availableSections;
        }
        const ordered = sectionOrder
            .map(id => availableSections.find(s => s.id === id))
            .filter(Boolean) as Array<{ id: string; title: string; }>;

        // Add any new sections that aren't in the order yet
        availableSections.forEach(section => {
            if (!sectionOrder.includes(section.id)) {
                ordered.push(section);
            }
        });

        return ordered;
    }, [editMode, sectionOrder, availableSections]);

    const renderSection = (sectionId: string) => {
        switch (sectionId) {
            case 'summary':
                return sections.summary ? (
                    <EditableSection id="summary" editMode={editMode} sectionTitle="Professional Summary">
                        <Section title="Professional Summary" icon={<Briefcase className="w-5 h-5" />}>
                            <p className="text-slate-700/90 leading-relaxed text-sm md:text-base">{sections.summary}</p>
                        </Section>
                    </EditableSection>
                ) : null;

            case 'experience':
                return sections.experience && sections.experience.length > 0 ? (
                    <EditableSection id="experience" editMode={editMode} sectionTitle="Experience">
                        <Section title="Experience" icon={<Briefcase className="w-5 h-5" />}>
                            {sections.experience.map((exp: any, idx: number) => (
                                <div key={idx} className="mb-6 last:mb-0 relative pl-4 border-l-2 border-slate-200">
                                    <div className="absolute -left-[9px] top-1.5 w-4 h-4 rounded-full bg-slate-200 border-2 border-white"></div>
                                    <div className="flex justify-between items-baseline mb-1">
                                        <h4 className="font-semibold text-slate-900 text-lg">{exp.title}</h4>
                                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{exp.duration}</span>
                                    </div>
                                    <p className="text-sm font-medium text-blue-700 mb-2">{exp.company}</p>
                                    <RenderMaybeBullets
                                        text={exp.description}
                                        forceBullets
                                        className="text-slate-700 text-sm leading-relaxed"
                                    />
                                </div>
                            ))}
                        </Section>
                    </EditableSection>
                ) : null;

            case 'projects':
                return sections.projects && sections.projects.length > 0 ? (
                    <EditableSection id="projects" editMode={editMode} sectionTitle="Key Projects">
                        <Section title="Key Projects" icon={<Code className="w-5 h-5" />}>
                            <div className="grid gap-4">
                                {sections.projects.map((proj: any, idx: number) => (
                                    <div key={idx} className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                                        <div className="flex justify-between items-start mb-2">
                                            <h4 className="font-bold text-slate-900">{proj.title}</h4>
                                            {proj.link && <a href={proj.link} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">View Project</a>}
                                        </div>
                                        <p className="text-sm text-slate-700 mb-2">{proj.description}</p>
                                        {proj.technologies && (
                                            <div className="flex flex-wrap gap-1">
                                                {proj.technologies.split(',').map((tech: string, i: number) => (
                                                    <span key={i} className="text-xs px-2 py-0.5 bg-white border border-slate-200 rounded text-slate-600">
                                                        {tech.trim()}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </Section>
                    </EditableSection>
                ) : null;

            case 'certifications':
                return sections.certifications && sections.certifications.length > 0 ? (
                    <EditableSection id="certifications" editMode={editMode} sectionTitle="Certifications">
                        <Section title="Certifications" icon={<Award className="w-5 h-5" />}>
                            <div className="grid sm:grid-cols-2 gap-4">
                                {sections.certifications.map((cert: any, idx: number) => (
                                    <div key={idx} className="flex items-start gap-3">
                                        <Award className="w-4 h-4 text-blue-500 mt-1 shrink-0" />
                                        <div>
                                            <h4 className="font-semibold text-slate-900 text-sm">{cert.name}</h4>
                                            <p className="text-xs text-slate-500">{cert.issuer} • {cert.year}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </Section>
                    </EditableSection>
                ) : null;

            case 'education':
                return sections.education && sections.education.length > 0 ? (
                    <EditableSection id="education" editMode={editMode} sectionTitle="Education">
                        <Section title="Education" icon={<BookOpen className="w-5 h-5" />}>
                            {sections.education.map((edu: any, idx: number) => (
                                <div key={idx} className="mb-3 last:mb-0 flex justify-between items-center border-b border-slate-100 last:border-0 pb-3 last:pb-0">
                                    <div>
                                        <h4 className="font-semibold text-slate-900">{edu.degree}</h4>
                                        <p className="text-sm text-slate-600">{edu.institution}</p>
                                    </div>
                                    <span className="text-sm font-medium text-slate-500">{edu.year}</span>
                                </div>
                            ))}
                        </Section>
                    </EditableSection>
                ) : null;

            case 'skills':
                return sections.skills && sections.skills.length > 0 ? (
                    <EditableSection id="skills" editMode={editMode} sectionTitle="Skills">
                        <Section title="Skills" icon={<Code className="w-5 h-5" />}>
                            <div className="flex flex-wrap gap-2">
                                {sections.skills.map((skill: string, idx: number) => (
                                    <span
                                        key={idx}
                                        className="px-3 py-1 bg-blue-50 text-blue-700 border border-blue-100 rounded-md text-sm font-medium hover:bg-blue-100 transition-colors"
                                    >
                                        {skill}
                                    </span>
                                ))}
                            </div>
                        </Section>
                    </EditableSection>
                ) : null;

            default:
                return null;
        }
    };

    const bodyContent = (
        <div className={`p-8 space-y-8 ${editMode ? 'pl-14' : ''}`}>
            {orderedSections.map((section) => (
                <React.Fragment key={section.id}>
                    {renderSection(section.id)}
                </React.Fragment>
            ))}
        </div>
    );

    return (
        <div className="bg-white rounded-lg shadow-lg ring-1 ring-black/5 overflow-hidden max-w-4xl mx-auto font-sans">
            {/* Header */}
            <div className="bg-gradient-to-r from-slate-900 via-blue-700 to-teal-600 text-white p-8">
                <h1 className="text-4xl font-bold mb-2 tracking-tight">{sections.name || 'Your Name'}</h1>
                <p className="text-xl text-white/85 mb-4 font-medium">{sections.title || 'Professional Title'}</p>
                <div className="flex flex-wrap gap-4 text-sm text-white/80">
                    {sections.email && (
                        <div className="flex items-center gap-1">
                            <Mail className="w-4 h-4" />
                            <span>{sections.email}</span>
                        </div>
                    )}
                    {sections.phone && (
                        <div className="flex items-center gap-1">
                            <Phone className="w-4 h-4" />
                            <span>{sections.phone}</span>
                        </div>
                    )}
                    {sections.location && (
                        <div className="flex items-center gap-1">
                            <MapPin className="w-4 h-4" />
                            <span>{sections.location}</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Body */}
            {editMode ? (
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                >
                    <SortableContext
                        items={sectionOrder.length > 0 ? sectionOrder : availableSections.map(s => s.id)}
                        strategy={verticalListSortingStrategy}
                    >
                        {bodyContent}
                    </SortableContext>
                </DndContext>
            ) : (
                bodyContent
            )}
        </div>
    );
}

function Section({ title, icon, children }: { title: string, icon?: React.ReactNode, children: React.ReactNode }) {
    return (
        <div className="mb-8 last:mb-0">
            <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-200/80">
                {icon && <span className="text-blue-600">{icon}</span>}
                <h3 className="text-lg font-bold text-slate-900 tracking-tight">{title}</h3>
            </div>
            {children}
        </div>
    );
}
