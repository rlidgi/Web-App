import React from 'react';
import { Mail, Phone, MapPin, Linkedin, Globe, Briefcase, Award, Code, BookOpen, Star, Layers } from 'lucide-react';
import { parseResumeContent } from '../../utils/resumeUtils';

export default function ModernTemplate({ content }) {
    const sections = parseResumeContent(content);

    return (
        <div className="bg-white rounded-lg shadow-xl overflow-hidden max-w-4xl mx-auto font-sans">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-teal-500 text-white p-6">
                <h1 className="text-3xl font-bold mb-1.5 tracking-tight">{sections.name || 'Your Name'}</h1>
                <p className="text-base text-blue-100 mb-3 font-medium">{sections.title || 'Professional Title'}</p>
                <div className="flex flex-wrap gap-3 text-xs text-blue-100">
                    {sections.email && (
                        <div className="flex items-center gap-1">
                            <Mail className="w-3.5 h-3.5" />
                            <span>{sections.email}</span>
                        </div>
                    )}
                    {sections.phone && (
                        <div className="flex items-center gap-1">
                            <Phone className="w-3.5 h-3.5" />
                            <span>{sections.phone}</span>
                        </div>
                    )}
                    {sections.location && (
                        <div className="flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5" />
                            <span>{sections.location}</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Body */}
            <div className="p-6 space-y-6">
                {sections.summary && (
                    <Section title="Professional Summary" icon={<Briefcase className="w-4 h-4" />}>
                        <p className="text-slate-700 leading-snug text-sm md:text-sm">{sections.summary}</p>
                    </Section>
                )}

                {/* Experience Section */}
                {sections.experience && sections.experience.length > 0 && (
                    <Section title="Experience" icon={<Briefcase className="w-4 h-4" />}>
                        {sections.experience.map((exp: any, idx: number) => (
                            <div key={idx} className="mb-4 last:mb-0 relative pl-3 border-l-2 border-slate-200">
                                <div className="absolute -left-[7px] top-1.5 w-3 h-3 rounded-full bg-slate-200 border-2 border-white"></div>
                                <div className="flex justify-between items-baseline mb-1 gap-3">
                                    <h4 className="font-bold text-slate-900 text-base">{exp.title}</h4>
                                    <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">{exp.duration}</span>
                                </div>
                                <p className="text-xs font-medium text-blue-600 mb-1.5">{exp.company}</p>
                                <p className="text-slate-700 text-sm leading-snug whitespace-pre-line">{exp.description}</p>
                            </div>
                        ))}
                    </Section>
                )}

                {/* Projects Section */}
                {sections.projects && sections.projects.length > 0 && (
                    <Section title="Key Projects" icon={<Code className="w-4 h-4" />}>
                        <div className="grid gap-3">
                            {sections.projects.map((proj: any, idx: number) => (
                                <div key={idx} className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                                    <div className="flex justify-between items-start mb-1 gap-3">
                                        <h4 className="font-bold text-slate-900 text-sm">{proj.title}</h4>
                                        {proj.link && <a href={proj.link} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-600 hover:underline whitespace-nowrap">View Project</a>}
                                    </div>
                                    <p className="text-xs text-slate-700 mb-1.5">{proj.description}</p>
                                    {proj.technologies && (
                                        <div className="flex flex-wrap gap-1">
                                            {proj.technologies.split(',').map((tech: string, i: number) => (
                                                <span key={i} className="text-[10px] px-1.5 py-0.5 bg-white border border-slate-200 rounded text-slate-600">
                                                    {tech.trim()}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </Section>
                )}

                {/* Dynamic Custom Sections */}
                {sections.custom_sections && sections.custom_sections.map((section: any, idx: number) => (
                    <Section key={idx} title={section.heading} icon={<Layers className="w-4 h-4" />}>
                        <div className="space-y-3">
                            {section.items.map((item: any, i: number) => (
                                <div key={i} className="border-b border-slate-100 last:border-0 pb-4 last:pb-0">
                                    <div className="flex justify-between items-baseline mb-1">
                                        <h4 className="font-bold text-slate-900 text-sm">{item.title}</h4>
                                        {item.date && <span className="text-[10px] text-slate-500 whitespace-nowrap">{item.date}</span>}
                                    </div>
                                    {item.subtitle && <p className="text-xs text-blue-600 mb-1">{item.subtitle}</p>}
                                    <p className="text-xs text-slate-700 leading-snug">{item.content}</p>
                                </div>
                            ))}
                        </div>
                    </Section>
                ))}

                {/* Certifications Section */}
                {sections.certifications && sections.certifications.length > 0 && (
                    <Section title="Certifications" icon={<Award className="w-4 h-4" />}>
                        <div className="grid sm:grid-cols-2 gap-4">
                            {sections.certifications.map((cert: any, idx: number) => (
                                <div key={idx} className="flex items-start gap-3">
                                    <Award className="w-3.5 h-3.5 text-blue-500 mt-0.5 shrink-0" />
                                    <div>
                                        <h4 className="font-semibold text-slate-900 text-xs">{cert.name}</h4>
                                        <p className="text-[10px] text-slate-500">{cert.issuer} • {cert.year}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </Section>
                )}

                {/* Education Section */}
                {sections.education && sections.education.length > 0 && (
                    <Section title="Education" icon={<BookOpen className="w-4 h-4" />}>
                        {sections.education.map((edu: any, idx: number) => (
                            <div key={idx} className="mb-3 last:mb-0 flex justify-between items-center border-b border-slate-100 last:border-0 pb-3 last:pb-0">
                                <div>
                                    <h4 className="font-semibold text-slate-900 text-sm">{edu.degree}</h4>
                                    <p className="text-xs text-slate-600">{edu.institution}</p>
                                </div>
                                <span className="text-xs font-medium text-slate-500 whitespace-nowrap">{edu.year}</span>
                            </div>
                        ))}
                    </Section>
                )}

                {/* Skills Section */}
                {sections.skills && sections.skills.length > 0 && (
                    <Section title="Skills" icon={<Code className="w-4 h-4" />}>
                        <div className="flex flex-wrap gap-1.5">
                            {sections.skills.map((skill: string, idx: number) => (
                                <span
                                    key={idx}
                                    className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-100 rounded-md text-xs font-medium hover:bg-blue-100 transition-colors"
                                >
                                    {skill}
                                </span>
                            ))}
                        </div>
                    </Section>
                )}
            </div>
        </div>
    );
}

function Section({ title, icon, children }: { title: string, icon?: React.ReactNode, children: React.ReactNode }) {
    return (
        <div className="mb-6 last:mb-0">
            <div className="flex items-center gap-2 mb-3 pb-1.5 border-b border-slate-100">
                {icon && <span className="text-blue-500">{icon}</span>}
                <h3 className="text-lg font-bold text-slate-800 tracking-tight">{title}</h3>
            </div>
            {children}
        </div>
    );
}
