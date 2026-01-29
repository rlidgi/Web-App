import React from "react";
import { Mail, Phone, MapPin, Globe, Linkedin } from "lucide-react";
import { parseResumeContent } from "../../utils/resumeUtils";
import { RenderMaybeBullets } from "./RenderMaybeBullets";

export default function ClassicPortraitSidebarTemplate({ content }: { content: string }) {
    const sections: any = parseResumeContent(content);

    const photoUrl =
        sections.photoUrl || sections.photo || sections.avatar || sections.image || "/avatar-placeholder.png";

    const personalDetails = sections.personal_details || sections.personalDetails || [];
    const references = sections.references || [];
    const links = sections.links || sections.socialLinks || [];

    return (
        <div className="bg-white rounded-lg shadow-lg ring-1 ring-black/5 overflow-hidden max-w-4xl mx-auto font-sans">
            <div className="grid grid-cols-12">
                {/* LEFT SIDEBAR */}
                <aside className="col-span-4 bg-[#e9ddd4] px-6 py-7">
                    {/* Avatar */}
                    <div className="flex justify-center mb-6">
                        <div className="w-[132px] h-[132px] rounded-full bg-[#d7e2ea] border border-black/10 grid place-items-center">
                            <img
                                src={photoUrl}
                                alt="Profile"
                                className="w-[118px] h-[118px] rounded-full object-cover border-[3px] border-white/90 bg-white/60"
                            />
                        </div>
                    </div>

                    {/* Contact */}
                    <div className="space-y-3 mb-7">
                        {sections.phone && <ContactRow icon={<Phone className="w-4 h-4" />} value={sections.phone} />}
                        {sections.email && <ContactRow icon={<Mail className="w-4 h-4" />} value={sections.email} />}
                        {sections.location && <ContactRow icon={<MapPin className="w-4 h-4" />} value={sections.location} />}
                    </div>

                    {/* Personal Details */}
                    {Array.isArray(personalDetails) && personalDetails.length > 0 && (
                        <SideSection title="PERSONAL DETAILS">
                            <div className="space-y-3">
                                {personalDetails.map((it: any, idx: number) => (
                                    <div key={idx}>
                                        <div className="text-xs font-semibold text-slate-900">{it.label}</div>
                                        <div className="text-xs text-black/65 leading-snug">{it.value}</div>
                                    </div>
                                ))}
                            </div>
                        </SideSection>
                    )}

                    {/* References */}
                    {Array.isArray(references) && references.length > 0 && (
                        <SideSection title="REFERENCES">
                            <div className="space-y-4">
                                {references.map((r: any, idx: number) => (
                                    <div key={idx}>
                                        <div className="text-xs font-bold text-slate-900">{r.name}</div>
                                        {r.organization && <div className="text-xs text-black/65">{r.organization}</div>}
                                        {r.phone && <div className="text-xs text-black/65">{r.phone}</div>}
                                        {r.email && <div className="text-xs text-black/65">{r.email}</div>}
                                    </div>
                                ))}
                            </div>
                        </SideSection>
                    )}

                    {/* Websites & Social Links */}
                    {Array.isArray(links) && links.length > 0 && (
                        <SideSection title="WEBSITES &amp; SOCIAL LINKS">
                            <div className="space-y-3">
                                {links.map((l: any, idx: number) => {
                                    const label = l.label || l.name || "Link";
                                    const display = l.display || l.text || l.url || "";
                                    const url = l.url;

                                    const icon = pickLinkIcon(label, url);
                                    return (
                                        <div key={idx} className="grid grid-cols-[18px_1fr] gap-2 items-start">
                                            <div className="text-black/70 mt-[2px]">{icon}</div>
                                            <div>
                                                <div className="text-xs font-semibold text-slate-900">{label}</div>
                                                <div className="text-xs text-black/65">
                                                    {url ? (
                                                        <a
                                                            href={url}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            className="border-b border-black/20 hover:border-black/40"
                                                        >
                                                            {display}
                                                        </a>
                                                    ) : (
                                                        <span>{display}</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </SideSection>
                    )}
                </aside>

                {/* RIGHT CONTENT */}
                <section className="col-span-8 bg-white">
                    {/* Header band */}
                    <header className="bg-[#2f3133] px-7 py-6">
                        <div className="text-[#f2f2f2] text-4xl leading-[1.05] font-serif font-semibold tracking-tight">
                            {sections.name || "Your Name"}
                        </div>
                        <div className="mt-2 text-white/75 text-xs uppercase tracking-[0.28em]">
                            {sections.title || "Professional Title"}
                        </div>
                    </header>

                    <div className="px-7 py-6 space-y-7">
                        {sections.summary && (
                            <MainSection title="ABOUT ME">
                                <p className="text-xs leading-relaxed text-slate-700 whitespace-pre-line">
                                    {sections.summary}
                                </p>
                            </MainSection>
                        )}

                        {Array.isArray(sections.experience) && sections.experience.length > 0 && (
                            <MainSection title="WORK EXPERIENCE">
                                <div className="space-y-5">
                                    {sections.experience.map((exp: any, idx: number) => (
                                        <div key={idx}>
                                            <div className="text-sm font-semibold text-slate-900">
                                                {exp.title || exp.position || "Role"}
                                            </div>

                                            <div className="mt-1 text-xs text-slate-500 flex flex-wrap items-baseline gap-2">
                                                {(exp.company || exp.organization) && <span>{exp.company || exp.organization}</span>}
                                                {(exp.company || exp.organization) && (exp.location || exp.city) && (
                                                    <span className="opacity-70">/</span>
                                                )}
                                                {(exp.location || exp.city) && <span>{exp.location || exp.city}</span>}
                                                {(exp.duration || exp.dates || exp.start || exp.end) && <span className="opacity-70">/</span>}
                                                <span>
                                                    {exp.duration || exp.dates || [exp.start, exp.end].filter(Boolean).join(" - ")}
                                                </span>
                                            </div>

                                            {exp.description && (
                                                <div className="mt-2">
                                                    <RenderMaybeBullets
                                                        text={exp.description}
                                                        forceBullets
                                                        className="text-xs leading-relaxed text-slate-600"
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </MainSection>
                        )}

                        {Array.isArray(sections.education) && sections.education.length > 0 && (
                            <MainSection title="EDUCATION">
                                <div className="space-y-5">
                                    {sections.education.map((edu: any, idx: number) => (
                                        <div key={idx}>
                                            <div className="text-sm font-semibold text-slate-900">
                                                {edu.degree || edu.title || "Degree"}
                                            </div>

                                            <div className="mt-1 text-xs text-slate-500 flex flex-wrap items-baseline gap-2">
                                                {edu.institution && <span>{edu.institution}</span>}
                                                {edu.institution && edu.location && <span className="opacity-70">/</span>}
                                                {edu.location && <span>{edu.location}</span>}
                                                {(edu.year || edu.dates) && <span className="opacity-70">/</span>}
                                                {(edu.year || edu.dates) && <span>{edu.year || edu.dates}</span>}
                                            </div>

                                            {edu.description && (
                                                <div className="mt-2">
                                                    <RenderMaybeBullets
                                                        text={edu.description}
                                                        forceBullets
                                                        className="text-xs leading-relaxed text-slate-600"
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </MainSection>
                        )}
                    </div>
                </section>
            </div>
        </div>
    );
}

function ContactRow({ icon, value }: { icon: React.ReactNode; value: string }) {
    return (
        <div className="grid grid-cols-[26px_1fr] items-center gap-2 text-sm text-slate-900">
            <div className="w-[22px] h-[22px] rounded-full bg-black/65 text-white grid place-items-center">
                {icon}
            </div>
            <div className="text-black/70 text-xs break-words">{value}</div>
        </div>
    );
}

function SideSection({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <section className="mt-6">
            <h3 className="text-xs font-semibold tracking-[0.14em] text-slate-900 uppercase">{title}</h3>
            <div className="h-[2px] bg-black/35 my-3" />
            {children}
        </section>
    );
}

function MainSection({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <section>
            <h2 className="text-sm font-bold tracking-[0.18em] text-slate-800 uppercase">{title}</h2>
            <div className="h-px bg-slate-200 my-3" />
            {children}
        </section>
    );
}

function pickLinkIcon(label: string, url?: string) {
    const s = `${label || ""} ${url || ""}`.toLowerCase();
    if (s.includes("linkedin")) return <Linkedin className="w-4 h-4" />;
    return <Globe className="w-4 h-4" />;
}


