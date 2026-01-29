import React from "react";
import { Mail, Phone, MapPin, Globe, Linkedin } from "lucide-react";
import { parseResumeContent } from "../../utils/resumeUtils";
import { RenderMaybeBullets } from "./RenderMaybeBullets";

/**
 * DarkSidebarTemplate
 * Recreates the uploaded "dark left sidebar + clean right content" layout:
 * - Dark sidebar with ABOUT ME, LINKS, REFERENCES, LANGUAGES, ADDITIONAL DETAILS.
 * - Right header with name/title and a contact block on the top-right.
 * - Work experience with left metadata column + right role/bullets column.
 * - Education with similar two-column structure.
 * - Skills displayed as two-column progress bars.
 * - Hobbies displayed as a row of small dot bullets.
 */
export default function DarkSidebarTemplate({ content }: { content: string }) {
    const sections: any = parseResumeContent(content);

    const photoUrl =
        sections.photoUrl || sections.photo || sections.avatar || sections.image || "/avatar-placeholder.png";

    const links = toArray(sections.links || sections.socialLinks || sections.websites || sections.website_links);
    const references = toArray(sections.references);
    const languages = normalizeLanguages(sections.languages);
    const additionalDetails =
        toArray(sections.additional_details || sections.additionalDetails || sections.personal_details || sections.personalDetails);

    const hobbies =
        normalizeHobbies(sections.hobbies) ||
        normalizeHobbies(findCustomSectionItems(sections.custom_sections, "Hobbies")?.map((x: any) => x.title || x.content || x));

    const work = Array.isArray(sections.experience) ? sections.experience : [];
    const education = Array.isArray(sections.education) ? sections.education : [];
    const skills = Array.isArray(sections.skills) ? sections.skills : [];

    const nameLines = splitNameLines(sections.name || "Your Name");

    return (
        <div className="bg-white rounded-lg shadow-lg ring-1 ring-black/5 overflow-hidden max-w-5xl mx-auto font-sans">
            <div className="grid grid-cols-12">
                {/* LEFT SIDEBAR */}
                <aside className="col-span-4 bg-[#3f3f3f] text-white px-6 py-7">
                    {/* Avatar */}
                    <div className="flex justify-center">
                        <div className="w-[128px] h-[128px] rounded-full bg-white/10 border border-white/10 grid place-items-center overflow-hidden">
                            <img
                                src={photoUrl}
                                alt="Profile"
                                className="w-[120px] h-[120px] rounded-full object-cover bg-white/10"
                            />
                        </div>
                    </div>

                    <div className="mt-6 space-y-6">
                        {/* About Me */}
                        {sections.summary && (
                            <SideSection title="ABOUT ME">
                                <p className="text-[11px] leading-relaxed text-white/80 whitespace-pre-line">
                                    {String(sections.summary)}
                                </p>
                            </SideSection>
                        )}

                        {/* Links */}
                        {(links.length > 0 || findCustomSectionItems(sections.custom_sections, "Links")) && (
                            <SideSection title="LINKS">
                                <div className="space-y-2">
                                    {(links.length > 0 ? links : findCustomSectionItems(sections.custom_sections, "Links") || []).map(
                                        (l: any, idx: number) => {
                                            const label = l.label || l.name || l.title || "Link";
                                            const url = l.url || l.link || l.href;
                                            const display = l.display || l.text || url || l.content || "";
                                            return (
                                                <div key={idx} className="text-[11px] text-white/80">
                                                    <div className="font-semibold text-white/90">{label}:</div>
                                                    <div className="truncate">
                                                        {url ? (
                                                            <a
                                                                href={url}
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                className="border-b border-white/25 hover:border-white/50"
                                                            >
                                                                {display}
                                                            </a>
                                                        ) : (
                                                            <span>{String(display)}</span>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        }
                                    )}
                                </div>
                            </SideSection>
                        )}

                        {/* References */}
                        {(references.length > 0 || findCustomSectionItems(sections.custom_sections, "References")) && (
                            <SideSection title="REFERENCES">
                                <div className="space-y-3">
                                    {(references.length > 0 ? references : findCustomSectionItems(sections.custom_sections, "References") || []).map(
                                        (r: any, idx: number) => (
                                            <div key={idx} className="text-[11px] text-white/80">
                                                <div className="font-bold text-white/90">{r.name || r.title || "Reference"}</div>
                                                {(r.role || r.subtitle) && <div className="text-white/75">{r.role || r.subtitle}</div>}
                                                {(r.phone || r.tel) && <div className="text-white/75">T: {r.phone || r.tel}</div>}
                                                {(r.email) && <div className="text-white/75">E: {r.email}</div>}
                                                {r.content && <div className="text-white/75">{r.content}</div>}
                                            </div>
                                        )
                                    )}
                                </div>
                            </SideSection>
                        )}

                        {/* Languages */}
                        {languages.length > 0 && (
                            <SideSection title="LANGUAGES">
                                <div className="space-y-2">
                                    {languages.map((lng, idx) => (
                                        <div key={idx} className="flex items-center gap-2 text-[11px] text-white/85">
                                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-white/70" />
                                            <span className="font-semibold text-white/90">{lng}</span>
                                        </div>
                                    ))}
                                </div>
                            </SideSection>
                        )}

                        {/* Additional Details */}
                        {additionalDetails.length > 0 && (
                            <SideSection title="ADDITIONAL DETAILS">
                                <div className="space-y-2">
                                    {additionalDetails.map((it: any, idx: number) => (
                                        <div key={idx} className="text-[11px] text-white/80">
                                            {typeof it === "string" ? (
                                                <span>{it}</span>
                                            ) : (
                                                <span>
                                                    <span className="font-semibold text-white/90">{it.label || it.title || "Detail"}:</span>{" "}
                                                    <span className="text-white/75">{it.value || it.content || ""}</span>
                                                </span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </SideSection>
                        )}
                    </div>
                </aside>

                {/* RIGHT CONTENT */}
                <section className="col-span-8 bg-white px-7 py-7">
                    {/* Header row: name/title left, contact right */}
                    <div className="flex items-start justify-between gap-8">
                        <div>
                            <div className="text-slate-900 font-extrabold tracking-tight leading-[0.95]">
                                <div className="text-[38px]">{nameLines[0]}</div>
                                {nameLines[1] && <div className="text-[38px] -mt-1">{nameLines[1]}</div>}
                            </div>
                            <div className="mt-2 text-slate-500 text-[11px] uppercase tracking-[0.28em]">
                                {sections.title || "Professional Title"}
                            </div>
                        </div>

                        <div className="space-y-2">
                            {sections.location && (
                                <HeaderContactRow icon={<MapPin className="w-4 h-4" />} value={sections.location} />
                            )}
                            {sections.phone && (
                                <HeaderContactRow icon={<Phone className="w-4 h-4" />} value={sections.phone} />
                            )}
                            {sections.email && (
                                <HeaderContactRow icon={<Mail className="w-4 h-4" />} value={sections.email} />
                            )}
                            {bestLink(links)?.url && (
                                <HeaderContactRow
                                    icon={bestLink(links)!.isLinkedIn ? <Linkedin className="w-4 h-4" /> : <Globe className="w-4 h-4" />}
                                    value={bestLink(links)!.display}
                                />
                            )}
                        </div>
                    </div>

                    <div className="mt-6 space-y-8">
                        {/* Work Experience */}
                        {work.length > 0 && (
                            <MainSection title="WORK EXPERIENCE">
                                <div className="space-y-6">
                                    {work.map((exp: any, idx: number) => (
                                        <TwoColEntry
                                            key={idx}
                                            leftTop={(exp.company || exp.organization || "").toString() || "Company"}
                                            leftSub={(exp.location || exp.city || "").toString()}
                                            leftMeta={(exp.duration || exp.dates || [exp.start, exp.end].filter(Boolean).join(" - ")).toString()}
                                            rightTitle={(exp.title || exp.position || "").toString() || "Role"}
                                            rightSubtitle={""}
                                            rightBody={exp.description}
                                        />
                                    ))}
                                </div>
                            </MainSection>
                        )}

                        {/* Education */}
                        {education.length > 0 && (
                            <MainSection title="EDUCATION">
                                <div className="space-y-6">
                                    {education.map((edu: any, idx: number) => (
                                        <TwoColEntry
                                            key={idx}
                                            leftTop={(edu.institution || edu.school || "").toString() || "Institution"}
                                            leftSub={(edu.location || edu.city || "").toString()}
                                            leftMeta={(edu.year || edu.dates || edu.graduationDate || "").toString()}
                                            rightTitle={(edu.degree || edu.title || "").toString() || "Degree"}
                                            rightSubtitle={(edu.field || "").toString()}
                                            rightBody={edu.description}
                                            bodyClassName="text-[11px] leading-relaxed text-slate-600"
                                        />
                                    ))}
                                </div>
                            </MainSection>
                        )}

                        {/* Skills */}
                        {skills.length > 0 && (
                            <MainSection title="SKILLS">
                                <div className="grid grid-cols-2 gap-x-10 gap-y-4">
                                    {skills.slice(0, 10).map((skill: any, idx: number) => {
                                        const label = typeof skill === "string" ? skill : (skill.name || skill.title || String(skill));
                                        const level = inferLevel(label, idx);
                                        return <SkillBar key={idx} label={label} level={level} />;
                                    })}
                                </div>
                            </MainSection>
                        )}

                        {/* Hobbies */}
                        {Array.isArray(hobbies) && hobbies.length > 0 && (
                            <MainSection title="HOBBIES">
                                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-slate-700">
                                    {hobbies.slice(0, 10).map((h, idx) => (
                                        <div key={idx} className="flex items-center gap-2">
                                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-slate-400" />
                                            <span className="uppercase tracking-wide">{h}</span>
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

function SideSection({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <section>
            <div className="text-[12px] font-bold tracking-[0.18em] uppercase text-white/90">{title}</div>
            <div className="h-px bg-white/30 my-3" />
            {children}
        </section>
    );
}

function MainSection({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <section>
            <div className="text-[12px] font-bold tracking-[0.18em] uppercase text-slate-800">{title}</div>
            <div className="h-px bg-slate-200 my-3" />
            {children}
        </section>
    );
}

function HeaderContactRow({ icon, value }: { icon: React.ReactNode; value: string }) {
    return (
        <div className="grid grid-cols-[22px_1fr] items-center gap-2 text-[11px] text-slate-600">
            <div className="w-[18px] h-[18px] rounded-full bg-slate-800 text-white grid place-items-center">
                {icon}
            </div>
            <div className="truncate max-w-[240px]">{value}</div>
        </div>
    );
}

function TwoColEntry({
    leftTop,
    leftSub,
    leftMeta,
    rightTitle,
    rightSubtitle,
    rightBody,
    bodyClassName,
}: {
    leftTop: string;
    leftSub?: string;
    leftMeta?: string;
    rightTitle: string;
    rightSubtitle?: string;
    rightBody?: any;
    bodyClassName?: string;
}) {
    return (
        <div className="grid grid-cols-[170px_1fr] gap-6">
            <div>
                <div className="text-[10px] uppercase tracking-[0.22em] text-slate-700 font-semibold">{leftTop}</div>
                {leftSub && <div className="mt-1 text-[11px] text-slate-500">{leftSub}</div>}
                {leftMeta && <div className="mt-1 text-[11px] text-slate-500">{leftMeta}</div>}
            </div>

            <div>
                <div className="flex items-center gap-2">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-slate-400" />
                    <div className="text-[12px] font-bold text-slate-900">{rightTitle}</div>
                </div>
                {rightSubtitle && <div className="mt-1 text-[11px] text-slate-500">{rightSubtitle}</div>}

                {rightBody ? (
                    <div className="mt-2">
                        <RenderMaybeBullets
                            text={rightBody}
                            forceBullets
                            className={bodyClassName || "text-[11px] leading-relaxed text-slate-600"}
                        />
                    </div>
                ) : null}
            </div>
        </div>
    );
}

function SkillBar({ label, level }: { label: string; level: number }) {
    const pct = Math.max(0.15, Math.min(0.95, level));
    return (
        <div className="grid grid-cols-[1fr_140px] items-center gap-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-700">{label}</div>
            <div className="h-[4px] bg-slate-200 rounded overflow-hidden">
                <div className="h-full bg-slate-800" style={{ width: `${Math.round(pct * 100)}%` }} />
            </div>
        </div>
    );
}

function splitNameLines(full: string): [string, string?] {
    const s = String(full || "").trim();
    if (!s) return ["YOUR", "NAME"];
    const parts = s.split(/\s+/g);
    if (parts.length === 1) return [parts[0].toUpperCase()];
    const first = parts[0].toUpperCase();
    const rest = parts.slice(1).join(" ").toUpperCase();
    return [first, rest];
}

function toArray(v: any): any[] {
    if (!v) return [];
    return Array.isArray(v) ? v : [v];
}

function normalizeLanguages(v: any): string[] {
    if (!v) return [];
    if (Array.isArray(v)) return v.map(x => String(x?.name || x?.language || x?.title || x).trim()).filter(Boolean);
    if (typeof v === "string") return v.split(/[,\n]/g).map(x => x.trim()).filter(Boolean);
    return [];
}

function normalizeHobbies(v: any): string[] | null {
    if (!v) return null;
    if (Array.isArray(v)) return v.map(x => String(x?.name || x?.title || x).trim()).filter(Boolean);
    if (typeof v === "string") return v.split(/[,\n•]/g).map(x => x.trim()).filter(Boolean);
    return null;
}

function findCustomSectionItems(customSections: any, heading: string) {
    if (!Array.isArray(customSections)) return null;
    const target = heading.toLowerCase();
    const match = customSections.find((s: any) => String(s?.heading || s?.title || "").toLowerCase().includes(target));
    if (!match) return null;
    if (Array.isArray(match.items)) return match.items;
    if (Array.isArray(match.content)) return match.content;
    if (typeof match.content === "string") return [match.content];
    return null;
}

function bestLink(links: any[]) {
    const normalized = (links || []).map((l: any) => {
        const url = l?.url || l?.link || l?.href;
        const label = l?.label || l?.name || l?.title || "";
        const display = l?.display || l?.text || url || "";
        const isLinkedIn = `${label} ${url}`.toLowerCase().includes("linkedin");
        return { url, label, display, isLinkedIn };
    }).filter((x: any) => x.url || x.display);
    const li = normalized.find((x: any) => x.isLinkedIn);
    return li || normalized[0] || null;
}

function inferLevel(label: string, idx: number): number {
    // If label includes a numeric rating, try to parse it.
    const s = String(label || "");
    const pctMatch = s.match(/(\d{1,3})\s*%/);
    if (pctMatch) return Math.max(0, Math.min(1, Number(pctMatch[1]) / 100));
    const fracMatch = s.match(/(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/);
    if (fracMatch) return Math.max(0, Math.min(1, Number(fracMatch[1]) / Number(fracMatch[2])));

    // Stable pseudo-random based on label content.
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    const r = (h % 1000) / 1000; // 0..0.999
    const base = 0.55 + (r * 0.35); // 0.55..0.90
    // Slightly vary by index too.
    return Math.max(0.45, Math.min(0.92, base - (idx % 5) * 0.02));
}


