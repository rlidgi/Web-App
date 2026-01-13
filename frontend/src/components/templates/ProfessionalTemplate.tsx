import React from 'react';
import { parseResumeContent } from '../../utils/resumeUtils';

export default function ProfessionalTemplate({ content }) {
    const sections = parseResumeContent(content);

    return (
        <div className="bg-white rounded-lg shadow-xl overflow-hidden max-w-4xl mx-auto border-t-4 border-slate-800">
            {/* Header */}
            <div className="border-b-2 border-slate-800 p-6 text-center">
                <h1 className="text-3xl font-bold text-slate-900 mb-1.5">{sections.name || 'YOUR NAME'}</h1>
                <p className="text-base text-slate-700 font-medium mb-2">{sections.title || 'Professional Title'}</p>
                <div className="flex justify-center flex-wrap gap-3 text-xs text-slate-600">
                    {sections.email && <span>{sections.email}</span>}
                    {sections.phone && <span>•</span>}
                    {sections.phone && <span>{sections.phone}</span>}
                    {sections.location && <span>•</span>}
                    {sections.location && <span>{sections.location}</span>}
                </div>
            </div>

            {/* Body */}
            <div className="p-6 space-y-6">
                {sections.summary && (
                    <Section title="PROFESSIONAL SUMMARY">
                        <p className="text-slate-700 leading-snug text-sm text-justify">{sections.summary}</p>
                    </Section>
                )}

                {sections.experience && sections.experience.length > 0 && (
                    <Section title="PROFESSIONAL EXPERIENCE">
                        {sections.experience.map((exp: any, idx: number) => (
                            <div key={idx} className="mb-4 last:mb-0">
                                <div className="flex justify-between items-start mb-1.5 gap-3">
                                    <div>
                                        <h4 className="font-bold text-slate-900 text-base">{exp.title}</h4>
                                        <p className="text-slate-700 font-medium text-sm">{exp.company}</p>
                                    </div>
                                    <span className="text-xs text-slate-600 font-medium whitespace-nowrap">{exp.duration}</span>
                                </div>
                                <p className="text-slate-700 leading-snug text-sm">{exp.description}</p>
                            </div>
                        ))}
                    </Section>
                )}

                {sections.education && sections.education.length > 0 && (
                    <Section title="EDUCATION">
                        {sections.education.map((edu: any, idx: number) => (
                            <div key={idx} className="mb-2.5 last:mb-0 flex justify-between items-start gap-3">
                                <div>
                                    <h4 className="font-bold text-slate-900 text-sm">{edu.degree}</h4>
                                    <p className="text-slate-700 text-sm">{edu.institution}</p>
                                </div>
                                <span className="text-xs text-slate-600 font-medium whitespace-nowrap">{edu.year}</span>
                            </div>
                        ))}
                    </Section>
                )}

                {sections.projects && sections.projects.length > 0 && (
                    <Section title="PROJECTS">
                        {sections.projects.map((proj: any, idx: number) => (
                            <div key={idx} className="mb-4 last:mb-0">
                                <div className="flex justify-between items-start mb-1 gap-3">
                                    <h4 className="font-bold text-slate-900 text-base">{proj.title}</h4>
                                    {proj.link && (
                                        <a
                                            href={proj.link}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-xs text-slate-700 underline underline-offset-2 hover:text-slate-900 whitespace-nowrap"
                                        >
                                            Link
                                        </a>
                                    )}
                                </div>
                                {proj.technologies && (
                                    <p className="text-xs text-slate-600 mb-1.5">
                                        {proj.technologies}
                                    </p>
                                )}
                                {proj.description && (
                                    <p className="text-slate-700 leading-snug text-sm">{proj.description}</p>
                                )}
                            </div>
                        ))}
                    </Section>
                )}

                {sections.custom_sections && sections.custom_sections.length > 0 && (
                    <>
                        {sections.custom_sections.map((section: any, idx: number) => (
                            <Section key={idx} title={(section.heading || '').toUpperCase()}>
                                <div className="space-y-4">
                                    {(section.items || []).map((item: any, i: number) => (
                                        <div key={i} className="border-b border-slate-200 pb-3 last:border-0 last:pb-0">
                                            <div className="flex justify-between items-baseline mb-1">
                                                <h4 className="font-bold text-slate-900 text-sm">{item.title}</h4>
                                                {item.date && <span className="text-xs text-slate-600 font-medium">{item.date}</span>}
                                            </div>
                                            {item.subtitle && <p className="text-slate-700 font-medium text-sm">{item.subtitle}</p>}
                                            {item.content && <p className="text-slate-700 leading-snug text-sm">{item.content}</p>}
                                        </div>
                                    ))}
                                </div>
                            </Section>
                        ))}
                    </>
                )}

                {sections.certifications && sections.certifications.length > 0 && (
                    <Section title="CERTIFICATIONS">
                        <div className="space-y-3">
                            {sections.certifications.map((cert: any, idx: number) => {
                                if (typeof cert === 'string') {
                                    return (
                                        <div key={idx} className="text-slate-700 text-sm">
                                            • {cert}
                                        </div>
                                    );
                                }

                                const name = cert?.name || '';
                                const issuer = cert?.issuer || '';
                                const year = cert?.year || '';

                                return (
                                    <div key={idx} className="flex items-baseline justify-between gap-4">
                                        <div className="min-w-0">
                                            <div className="font-bold text-slate-900 text-sm">{name}</div>
                                            {(issuer || year) && (
                                                <div className="text-xs text-slate-600">
                                                    {[issuer, year].filter(Boolean).join(' • ')}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </Section>
                )}

                {sections.skills && sections.skills.length > 0 && (
                    <Section title="CORE COMPETENCIES">
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                            {sections.skills.map((skill: string, idx: number) => (
                                <div key={idx} className="text-slate-700 font-medium text-sm">
                                    • {skill}
                                </div>
                            ))}
                        </div>
                    </Section>
                )}
            </div>
        </div>
    );
}

function Section({ title, children }: { title: string, children: React.ReactNode }) {
    return (
        <div>
            <h3 className="text-xs font-bold text-slate-900 tracking-wider border-b-2 border-slate-300 pb-1.5 mb-3">
                {title}
            </h3>
            {children}
        </div>
    );
}
