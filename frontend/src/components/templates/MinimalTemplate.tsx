import React from 'react';
import { parseResumeContent } from '../../utils/resumeUtils';

export default function MinimalTemplate({ content }) {
    const sections = parseResumeContent(content);

    return (
        <div className="bg-white rounded-lg shadow-xl overflow-hidden max-w-3xl mx-auto">
            {/* Header */}
            <div className="text-center p-8 border-b border-slate-200">
                <h1 className="text-4xl font-light text-slate-900 mb-2 tracking-tight">{sections.name || 'Your Name'}</h1>
                <p className="text-base text-slate-600 font-light mb-3">{sections.title || 'Professional Title'}</p>
                <div className="flex justify-center flex-wrap gap-2.5 text-xs text-slate-500">
                    {sections.email && <span>{sections.email}</span>}
                    {sections.phone && <span className="text-slate-300">|</span>}
                    {sections.phone && <span>{sections.phone}</span>}
                    {sections.location && <span className="text-slate-300">|</span>}
                    {sections.location && <span>{sections.location}</span>}
                </div>
            </div>

            {/* Body */}
            <div className="p-8 space-y-8">
                {sections.summary && (
                    <Section title="Summary">
                        <p className="text-slate-700 leading-snug font-light text-sm">{sections.summary}</p>
                    </Section>
                )}

                {sections.experience && sections.experience.length > 0 && (
                    <Section title="Experience">
                        <div className="space-y-5">
                            {sections.experience.map((exp: any, idx: number) => (
                                <div key={idx}>
                                    <div className="mb-1.5">
                                        <h4 className="font-medium text-slate-900 text-base">{exp.title}</h4>
                                        <div className="flex justify-between items-center text-slate-600 text-xs mt-1 gap-3">
                                            <span className="font-light">{exp.company}</span>
                                            <span className="font-light whitespace-nowrap">{exp.duration}</span>
                                        </div>
                                    </div>
                                    <p className="text-slate-700 leading-snug font-light text-sm">{exp.description}</p>
                                </div>
                            ))}
                        </div>
                    </Section>
                )}

                {sections.education && sections.education.length > 0 && (
                    <Section title="Education">
                        <div className="space-y-3.5">
                            {sections.education.map((edu: any, idx: number) => (
                                <div key={idx}>
                                    <h4 className="font-medium text-slate-900 text-sm">{edu.degree}</h4>
                                    <div className="flex justify-between items-center text-slate-600 text-xs mt-1 gap-3">
                                        <span className="font-light">{edu.institution}</span>
                                        <span className="font-light whitespace-nowrap">{edu.year}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </Section>
                )}

                {sections.projects && sections.projects.length > 0 && (
                    <Section title="Projects">
                        <div className="space-y-5">
                            {sections.projects.map((proj: any, idx: number) => (
                                <div key={idx}>
                                    <div className="flex justify-between items-baseline mb-1 gap-3">
                                        <h4 className="font-medium text-slate-900 text-base">{proj.title}</h4>
                                        {proj.link && (
                                            <a
                                                href={proj.link}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-xs text-slate-600 hover:underline whitespace-nowrap"
                                            >
                                                Link
                                            </a>
                                        )}
                                    </div>
                                    {proj.technologies && (
                                        <div className="text-slate-600 text-xs font-light mb-1">
                                            {proj.technologies}
                                        </div>
                                    )}
                                    {proj.description && (
                                        <p className="text-slate-700 leading-snug font-light text-sm">{proj.description}</p>
                                    )}
                                </div>
                            ))}
                        </div>
                    </Section>
                )}

                {sections.custom_sections && sections.custom_sections.length > 0 && (
                    <>
                        {sections.custom_sections.map((section: any, idx: number) => (
                            <Section key={idx} title={section.heading}>
                                <div className="space-y-3">
                                    {(section.items || []).map((item: any, i: number) => (
                                        <div key={i}>
                                            <div className="flex justify-between items-baseline mb-1">
                                                <h4 className="font-medium text-slate-900 text-sm">{item.title}</h4>
                                                {item.date && <span className="text-xs text-slate-600 font-light whitespace-nowrap">{item.date}</span>}
                                            </div>
                                            {item.subtitle && <p className="text-slate-600 text-xs font-light mb-1">{item.subtitle}</p>}
                                            {item.content && <p className="text-slate-700 leading-snug font-light text-sm">{item.content}</p>}
                                        </div>
                                    ))}
                                </div>
                            </Section>
                        ))}
                    </>
                )}

                {sections.certifications && sections.certifications.length > 0 && (
                    <Section title="Certifications">
                        <div className="space-y-3">
                            {sections.certifications.map((cert: any, idx: number) => {
                                if (typeof cert === 'string') {
                                    return (
                                        <div key={idx} className="text-slate-700 font-light leading-snug text-sm">
                                            {cert}
                                        </div>
                                    );
                                }

                                const name = cert?.name || '';
                                const issuer = cert?.issuer || '';
                                const year = cert?.year || '';

                                return (
                                    <div key={idx}>
                                        <div className="font-medium text-slate-900 text-sm">{name}</div>
                                        {(issuer || year) && (
                                            <div className="text-slate-600 text-xs font-light">
                                                {[issuer, year].filter(Boolean).join(' • ')}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </Section>
                )}

                {sections.skills && sections.skills.length > 0 && (
                    <Section title="Skills">
                        <div className="text-slate-700 font-light leading-snug text-sm">
                            {sections.skills.join(' • ')}
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
            <h3 className="text-xs font-semibold text-slate-900 tracking-widest uppercase mb-3 pb-1.5 border-b border-slate-200">
                {title}
            </h3>
            {children}
        </div>
    );
}
