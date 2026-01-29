import React from "react";
import { Mail, Phone, MapPin, Globe, Linkedin } from "lucide-react";
import { parseResumeContent } from "../../utils/resumeUtils";
import { RenderMaybeBullets } from "./RenderMaybeBullets";

export default function DarkSidebarProgressTemplate({ content }: { content: string }) {
    const sections: any = parseResumeContent(content);

    const photoUrl =
        sections.photoUrl || sections.photo || sections.avatar || sections.image || "/avatar-placeholder.png";

    const links = sections.links || sections.socialLinks || [];
    const references = sections.references || [];
    const languages = sections.languages || [];
    const additionalDetails = sections.additional_details || sections.additionalDetails || [];

    const skills: string[] = Array.isArray(sections.skills) ? sections.skills : [];
    const skillPairs = skills.map((s) => ({ name: String(s), level: guessSkillLevel(String(s)) }));

    return (
        <div className="bg-white rounded-lg shadow-lg ring-1 ring-black/5 overflow-hidden max-w-5xl mx-auto font-sans">
            <div className="grid grid-cols-12">
                {/* LEFT SIDEBAR */}
                <aside className="col-span-4 bg-[#3d3d3d] text-white px-6 py-7">
                    <div className="flex justify-center mb-6">
                        <div className="w-[128px] h-[128px] rounded-full bg-white/10 border border-white/10 grid place-items-center">
                            <img
                                src={photoUrl}
                                alt="Profile"
                                className="w-[116px] h-[116px] rounded-full object-cover border-4 border-white/80 bg-white/20"
                            />
                        </div>
                    </div>

                    {sections.summary && (
                        <SideSection title="ABOUT ME">
                            <p className="text-[11px] leading-relaxed text-white/85 whitespace-pre-line">
                                {sections.summary}
                            </p>
                        </SideSection>
                    )}

                    {(sections.email || sections.phone || sections.location) && (
                        <SideSection title="CONTACT">
                            <div className="space-y-2">
                                {sections.location && (
                                    <SideRow icon={<MapPin className="w-4 h-4" />} value={sections.location} />
                                )}
                                {sections.phone && (
                                    <SideRow icon={<Phone className="w-4 h-4" />} value={sections.phone} />
                                )}
                                {sections.email && (
                                    <SideRow icon={<Mail className="w-4 h-4" />} value={sections.email} />
                                )}
                            </div>
                        </SideSection>
                    )}

                    {Array.isArray(links) && links.length > 0 && (
                        <SideSection title="LINKS">
                            <div className="space-y-2">
                                {links.map((l: any, idx: number) => {
                                    const label = l.label || l.name || "Link";
                                    const url = l.url || l.href;
                                    const display = l.display || l.text || url || "";
                                    const icon = pickLinkIcon(label, url);
                                    return (
                                        <div key={idx} className="grid grid-cols-[18px_1fr] gap-2 items-start">
                                            <div className="text-white/70 mt-[1px]">{icon}</div>
                                            <div className="text-[11px] text-white/80 break-words">
                                                <div className="font-semibold text-white/85">{label}</div>
                                                {url ? (
                                                    <a
                                                        href={url}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="border-b border-white/20 hover:border-white/40"
                                                    >
                                                        {display}
                                                    </a>
                                                ) : (
                                                    <span>{display}</span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </SideSection>
                    )}

                    {Array.isArray(references) && references.length > 0 && (
                        <SideSection title="REFERENCES">
                            <div className="space-y-3">
                                {references.slice(0, 2).map((r: any, idx: number) => (
                                    <div key={idx} className="text-[11px] text-white/80">
                                        <div className="font-semibold text-white/90">{r.name}</div>
                                        {r.title && <div className="text-white/70">{r.title}</div>}
                                        {r.organization && <div className="text-white/70">{r.organization}</div>}
                                        {r.phone && <div className="text-white/70">T: {r.phone}</div>}
                                        {r.email && <div className="text-white/70">E: {r.email}</div>}
                                    </div>
                                ))}
                            </div>
                        </SideSection>
                    )}

                    {Array.isArray(languages) && languages.length > 0 && (
                        <SideSection title="LANGUAGES">
                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-white/85">
                                {languages.map((lang: any, idx: number) => (
                                    <div key={idx} className="inline-flex items-center gap-2">
                                        <span className="w-1.5 h-1.5 rounded-full bg-white/60" />
                                        <span>{String(lang)}</span>
                                    </div>
                                ))}
                            </div>
                        </SideSection>
                    )}

                    {Array.isArray(additionalDetails) && additionalDetails.length > 0 && (
                        <SideSection title="ADDITIONAL DETAILS">
                            <div className="space-y-2">
                                {additionalDetails.map((it: any, idx: number) => (
                                    <div key={idx} className="text-[11px] text-white/80">
                                        <div className="font-semibold text-white/90">{it.label}</div>
                                        <div className="text-white/70">{it.value}</div>
                                    </div>
                                ))}
                            </div>
                        </SideSection>
                    )}
                </aside>

                {/* RIGHT CONTENT */}
                <section className="col-span-8 bg-white px-7 py-6">
                    {/* Header */}
                    <header className="flex items-start justify-between gap-6 pb-5 border-b border-slate-200">
                        <div>
                            <div className="text-3xl font-semibold tracking-tight text-slate-900 uppercase leading-none">
                                {sections.name || "Your Name"}
                            </div>
                            <div className="mt-2 text-xs uppercase tracking-[0.28em] text-slate-500">
                                {sections.title || "Professional Title"}
                            </div>
                        </div>

                        <div className="space-y-2 text-[11px] text-slate-600 shrink-0">
                            {sections.location && <TopContactRow icon={<MapPin className="w-4 h-4" />} value={sections.location} />}
                            {sections.phone && <TopContactRow icon={<Phone className="w-4 h-4" />} value={sections.phone} />}
                            {sections.email && <TopContactRow icon={<Mail className="w-4 h-4" />} value={sections.email} />}
                        </div>
                    </header>

                    <div className="pt-5 space-y-7">
                        {Array.isArray(sections.experience) && sections.experience.length > 0 && (
                            <MainSection title="WORK EXPERIENCE">
                                <div className="space-y-5">
                                    {sections.experience.map((exp: any, idx: number) => (
                                        <ExperienceRow key={idx} exp={exp} />
                                    ))}
                                </div>
                            </MainSection>
                        )}

                        <div className="grid grid-cols-12 gap-6">
                            <div className="col-span-6 space-y-7">
                                {Array.isArray(sections.education) && sections.education.length > 0 && (
                                    <MainSection title="EDUCATION">
                                        <div className="space-y-5">
                                            {sections.education.map((edu: any, idx: number) => (
                                                <TwoColRow
                                                    key={idx}
                                                    leftTitle={edu.institution || edu.school || ""}
                                                    leftSub={[edu.location, edu.year || edu.dates].filter(Boolean).join(" • ")}
                                                    rightTitle={edu.degree || edu.title || "Degree"}
                                                    rightBody={edu.description}
                                                />
                                            ))}
                                        </div>
                                    </MainSection>
                                )}
                            </div>

                            <div className="col-span-6 space-y-7">
                                {skillPairs.length > 0 && (
                                    <MainSection title="SKILLS">
                                        <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                                            {skillPairs.slice(0, 8).map((s, idx) => (
                                                <SkillBar key={idx} name={s.name} level={s.level} />
                                            ))}
                                        </div>
                                    </MainSection>
                                )}

                                {sections.hobbies && (
                                    <MainSection title="HOBBIES">
                                        <div className="text-[11px] text-slate-600 flex flex-wrap gap-x-4 gap-y-1">
                                            {String(sections.hobbies)
                                                .split(/[,•]|\\n/g)
                                                .map((h: string) => h.trim())
                                                .filter(Boolean)
                                                .map((h: string, idx: number) => (
                                                    <span key={idx} className="inline-flex items-center gap-2">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                                                        <span>{h}</span>
                                                    </span>
                                                ))}
                                        </div>
                                    </MainSection>
                                )}
                            </div>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
}

function SideSection({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <section className="mt-6">
            <h3 className="text-xs font-semibold tracking-[0.18em] uppercase text-white/90">{title}</h3>
            <div className="h-px bg-white/25 my-3" />
            {children}
        </section>
    );
}

function SideRow({ icon, value }: { icon: React.ReactNode; value: string }) {
    return (
        <div className="grid grid-cols-[18px_1fr] gap-2 items-start text-[11px] text-white/80">
            <div className="text-white/70 mt-[2px]">{icon}</div>
            <div className="break-words">{value}</div>
        </div>
    );
}

function TopContactRow({ icon, value }: { icon: React.ReactNode; value: string }) {
    return (
        <div className="flex items-center justify-end gap-2">
            <span className="w-6 h-6 rounded-full bg-slate-800 text-white grid place-items-center">
                <span className="scale-90">{icon}</span>
            </span>
            <span className="whitespace-nowrap">{value}</span>
        </div>
    );
}

function MainSection({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <section>
            <h2 className="text-xs font-bold tracking-[0.18em] uppercase text-slate-800">{title}</h2>
            <div className="h-px bg-slate-200 my-3" />
            {children}
        </section>
    );
}

function ExperienceRow({ exp }: { exp: any }) {
    const company = exp.company || exp.organization || "";
    const location = exp.location || exp.city || "";
    const dates = exp.duration || exp.dates || [exp.start, exp.end].filter(Boolean).join(" - ");
    const role = exp.title || exp.position || "Role";

    return (
        <div className="grid grid-cols-12 gap-4">
            <div className="col-span-4">
                <div className="text-[11px] font-semibold text-slate-900">{company}</div>
                <div className="mt-0.5 text-[10px] text-slate-500">{location}</div>
                <div className="mt-0.5 text-[10px] text-slate-500">{dates}</div>
            </div>
            <div className="col-span-8">
                <div className="text-[12px] font-semibold text-slate-900 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-slate-900/70" />
                    <span>{role}</span>
                </div>
                {exp.description && (
                    <div className="mt-2">
                        <RenderMaybeBullets
                            text={exp.description}
                            forceBullets
                            className="text-[11px] leading-relaxed text-slate-600"
                        />
                    </div>
                )}
            </div>
        </div>
    );
}

function TwoColRow({
    leftTitle,
    leftSub,
    rightTitle,
    rightBody,
}: {
    leftTitle: string;
    leftSub?: string;
    rightTitle: string;
    rightBody?: any;
}) {
    return (
        <div className="grid grid-cols-12 gap-4">
            <div className="col-span-4">
                {leftTitle && <div className="text-[11px] font-semibold text-slate-900">{leftTitle}</div>}
                {leftSub && <div className="mt-0.5 text-[10px] text-slate-500">{leftSub}</div>}
            </div>
            <div className="col-span-8">
                <div className="text-[11px] font-semibold text-slate-900">{rightTitle}</div>
                {rightBody && (
                    <div className="mt-2">
                        <RenderMaybeBullets text={rightBody} className="text-[11px] leading-relaxed text-slate-600" />
                    </div>
                )}
            </div>
        </div>
    );
}

function SkillBar({ name, level }: { name: string; level: number }) {
    const pct = Math.max(5, Math.min(100, Math.round(level * 100)));
    return (
        <div>
            <div className="text-[11px] font-semibold text-slate-700 uppercase tracking-[0.12em]">{name}</div>
            <div className="mt-1 h-1.5 bg-slate-200">
                <div className="h-1.5 bg-slate-700" style={{ width: `${pct}%` }} />
            </div>
        </div>
    );
}

function guessSkillLevel(name: string): number {
    // Deterministic but varied so it looks like the screenshot even without per-skill levels.
    const s = (name || "").toLowerCase().trim();
    let acc = 0;
    for (let i = 0; i < s.length; i++) acc = (acc * 31 + s.charCodeAt(i)) >>> 0;
    // map to [0.55 .. 0.95]
    return 0.55 + ((acc % 41) / 100);
}

function pickLinkIcon(label: string, url?: string) {
    const s = `${label || ""} ${url || ""}`.toLowerCase();
    if (s.includes("linkedin")) return <Linkedin className="w-4 h-4" />;
    return <Globe className="w-4 h-4" />;
}


