import React from "react";
import { Mail, Phone, MapPin } from "lucide-react";
import { parseResumeContent } from "../../utils/resumeUtils";
import { RenderMaybeBullets } from "./RenderMaybeBullets";

/**
 * NavyHeaderSidebarTemplate
 * Pixel-close recreation of the uploaded navy-top-band template:
 * - Full-width navy header with name + title + 3 contact blocks separated by dividers
 * - Left light sidebar with photo + Education + Languages (with progress bars)
 * - Right content with About Me + Work Experience + Skills (two-column progress bars)
 */
export default function NavyHeaderSidebarTemplate({ content }: { content: string }) {
    const sections: any = parseResumeContent(content);

    const photoUrl =
        sections.photoUrl || sections.photo || sections.avatar || sections.image || "/avatar-placeholder.png";

    const education = Array.isArray(sections.education) ? sections.education : [];
    const experience = Array.isArray(sections.experience) ? sections.experience : [];
    const skills = Array.isArray(sections.skills) ? sections.skills : [];
    const languages = normalizeLanguages(sections.languages);

    const fullName = String(sections.name || "Your Name");
    const initials = getInitials(fullName);
    const name = fullName.toUpperCase();
    const title = String(sections.title || "Professional Title").toUpperCase();

    return (
        <div className="bg-white rounded-lg shadow-lg ring-1 ring-black/5 overflow-hidden max-w-5xl mx-auto font-sans">
            {/* TOP HEADER BAND */}
            <header className="bg-[#253040] text-white px-8 py-7">
                <div className="flex flex-col items-center text-center">
                    <div className="tracking-[0.5em] text-[10px] text-white/60">{initials}</div>
                    <div className="mt-2 text-[34px] font-semibold tracking-[0.28em]">{name}</div>
                    <div className="mt-1 text-[11px] uppercase tracking-[0.42em] text-[#c6b37b]">
                        {title}
                    </div>
                </div>

                <div className="mt-5 grid grid-cols-3 gap-0 border-t border-white/15 pt-4">
                    <HeaderContact
                        icon={<MapPin className="w-4 h-4" />}
                        value={String(sections.location || "").trim() || "City, Country"}
                        withDivider
                    />
                    <HeaderContact
                        icon={<Phone className="w-4 h-4" />}
                        value={String(sections.phone || "").trim() || "+00 000 000 000"}
                        withDivider
                    />
                    <HeaderContact
                        icon={<Mail className="w-4 h-4" />}
                        value={String(sections.email || "").trim() || "email@example.com"}
                    />
                </div>
            </header>

            {/* BODY */}
            <div className="grid grid-cols-12">
                {/* LEFT SIDEBAR */}
                <aside className="col-span-4 bg-[#f3f3f3] px-7 py-7">
                    <div className="flex justify-center">
                        <div className="w-[140px] h-[140px] rounded-full bg-white shadow-sm ring-1 ring-black/10 grid place-items-center overflow-hidden">
                            <img
                                src={photoUrl}
                                alt="Profile"
                                className="w-[130px] h-[130px] rounded-full object-cover bg-white"
                            />
                        </div>
                    </div>

                    <div className="mt-8 space-y-8">
                        {education.length > 0 && (
                            <LeftSection title="EDUCATION">
                                <div className="space-y-6">
                                    {education.slice(0, 4).map((edu: any, idx: number) => (
                                        <div key={idx}>
                                            <div className="text-[11px] uppercase tracking-[0.22em] text-slate-700 font-semibold">
                                                {String(edu.degree || edu.title || "Degree")}
                                            </div>
                                            <div className="mt-1 text-[11px] text-slate-500">
                                                {String(edu.institution || edu.school || "").trim() || "Institution"}
                                            </div>
                                            {(edu.year || edu.dates || edu.graduationDate) && (
                                                <div className="mt-1 text-[11px] text-slate-500">
                                                    {String(edu.year || edu.dates || edu.graduationDate)}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </LeftSection>
                        )}

                        {languages.length > 0 && (
                            <LeftSection title="LANGUAGES">
                                <div className="space-y-5">
                                    {languages.slice(0, 4).map((lng, idx) => (
                                        <LanguageBar key={idx} label={lng} level={inferLevel(lng, idx)} />
                                    ))}
                                </div>
                            </LeftSection>
                        )}
                    </div>
                </aside>

                {/* RIGHT CONTENT */}
                <main className="col-span-8 bg-white px-8 py-7">
                    <div className="space-y-9">
                        {sections.summary && (
                            <RightSection title="ABOUT ME">
                                <p className="text-[11px] leading-relaxed text-slate-600 whitespace-pre-line">
                                    {String(sections.summary)}
                                </p>
                            </RightSection>
                        )}

                        {experience.length > 0 && (
                            <RightSection title="WORK EXPERIENCE">
                                <div className="space-y-7">
                                    {experience.slice(0, 4).map((exp: any, idx: number) => (
                                        <div key={idx}>
                                            <div className="text-[11px] uppercase tracking-[0.22em] text-slate-700 font-semibold">
                                                {String(exp.title || exp.position || "Role")}
                                            </div>
                                            <div className="mt-1 text-[11px] text-slate-500">
                                                {String(exp.company || exp.organization || "Company")}
                                                {(exp.duration || exp.dates || exp.start || exp.end || exp.location || exp.city) ? (
                                                    <>
                                                        {" / "}
                                                        <span>
                                                            {String(exp.duration || exp.dates || [exp.start, exp.end].filter(Boolean).join(" - "))}
                                                            {(exp.location || exp.city) ? ` / ${String(exp.location || exp.city)}` : ""}
                                                        </span>
                                                    </>
                                                ) : null}
                                            </div>
                                            {exp.description && (
                                                <div className="mt-3">
                                                    <RenderMaybeBullets
                                                        text={exp.description}
                                                        forceBullets
                                                        className="text-[11px] leading-relaxed text-slate-600"
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </RightSection>
                        )}

                        {skills.length > 0 && (
                            <RightSection title="SKILLS">
                                <div className="grid grid-cols-2 gap-x-10 gap-y-4">
                                    {skills.slice(0, 8).map((skill: any, idx: number) => {
                                        const label = typeof skill === "string" ? skill : (skill.name || skill.title || String(skill));
                                        return (
                                            <SkillBar
                                                key={idx}
                                                label={label}
                                                level={inferLevel(label, idx)}
                                            />
                                        );
                                    })}
                                </div>
                            </RightSection>
                        )}
                    </div>
                </main>
            </div>
        </div>
    );
}

function HeaderContact({
    icon,
    value,
    withDivider,
}: {
    icon: React.ReactNode;
    value: string;
    withDivider?: boolean;
}) {
    return (
        <div className={`flex items-center justify-center gap-3 px-4 ${withDivider ? "border-r border-white/15" : ""}`}>
            <span className="w-8 h-8 rounded-full bg-white/10 grid place-items-center text-[#c6b37b]">
                <span className="scale-95">{icon}</span>
            </span>
            <span className="text-[11px] text-white/80">{value}</span>
        </div>
    );
}

function LeftSection({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <section>
            <div className="text-[12px] font-bold tracking-[0.22em] text-slate-700">{title}</div>
            <div className="h-px bg-slate-300 my-3" />
            {children}
        </section>
    );
}

function RightSection({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <section>
            <div className="flex items-end justify-between">
                <div className="text-[12px] font-bold tracking-[0.22em] text-slate-700">{title}</div>
            </div>
            <div className="h-px bg-slate-300 my-3" />
            {children}
        </section>
    );
}

function SkillBar({ label, level }: { label: string; level: number }) {
    const pct = Math.max(0.18, Math.min(0.98, level));
    return (
        <div>
            <div className="text-[11px] text-slate-600">{label}</div>
            <div className="mt-1 h-[4px] bg-slate-200">
                <div className="h-[4px] bg-[#c6b37b]" style={{ width: `${Math.round(pct * 100)}%` }} />
            </div>
        </div>
    );
}

function LanguageBar({ label, level }: { label: string; level: number }) {
    const pct = Math.max(0.25, Math.min(0.95, level));
    return (
        <div>
            <div className="text-[11px] text-slate-600 capitalize">{label}</div>
            <div className="mt-1 h-[4px] bg-slate-200">
                <div className="h-[4px] bg-[#c6b37b]" style={{ width: `${Math.round(pct * 100)}%` }} />
            </div>
        </div>
    );
}

function normalizeLanguages(v: any): string[] {
    if (!v) return [];
    if (Array.isArray(v)) return v.map(x => String(x?.name || x?.language || x?.title || x).trim()).filter(Boolean);
    if (typeof v === "string") return v.split(/[,\n]/g).map(x => x.trim()).filter(Boolean);
    return [];
}

function inferLevel(label: string, idx: number): number {
    const s = String(label || "");
    const pctMatch = s.match(/(\d{1,3})\s*%/);
    if (pctMatch) return Math.max(0, Math.min(1, Number(pctMatch[1]) / 100));

    // deterministic stable variation
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    const r = (h % 1000) / 1000;
    const base = 0.55 + (r * 0.35);
    return Math.max(0.45, Math.min(0.95, base - (idx % 4) * 0.03));
}

function getInitials(name: string): string {
    const cleaned = String(name || "")
        .trim()
        .replace(/\s+/g, " ");
    if (!cleaned) return "R | S";

    const parts = cleaned.split(" ").filter(Boolean);
    const first = parts[0]?.[0] || "R";
    const last = (parts.length > 1 ? parts[parts.length - 1]?.[0] : parts[0]?.[1]) || "S";
    return `${String(first).toUpperCase()} | ${String(last).toUpperCase()}`;
}


