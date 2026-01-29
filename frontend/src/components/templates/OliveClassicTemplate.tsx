import React from "react";
import { parseResumeContent } from "../../utils/resumeUtils";
import { RenderMaybeBullets } from "./RenderMaybeBullets";

export default function OliveClassicTemplate({ content }: { content: string }) {
    const sections: any = parseResumeContent(content);

    const name = String(sections.name || "Your Name");
    const initials = getInitials(name);

    const phone = sections.phone ? String(sections.phone) : "";
    const email = sections.email ? String(sections.email) : "";
    const location = sections.location ? String(sections.location) : "";

    const skills = normalizeToStringList(sections.skills || sections.skill || sections.skill_list);
    const certifications = normalizeToStringList(
        sections.certifications || sections.certification || sections.certs || sections.certificates
    );
    const languages = normalizeToStringList(sections.languages || sections.language || sections.langs);

    const experience = Array.isArray(sections.experience) ? sections.experience : [];
    const education = Array.isArray(sections.education) ? sections.education : [];

    return (
        <div className="bg-white rounded-lg shadow-lg ring-1 ring-black/5 overflow-hidden max-w-4xl mx-auto font-sans">
            <div className="px-10 py-8">
                {/* Header */}
                <div>
                    <div className="grid grid-cols-[1fr_auto_1fr] items-center">
                        <div className="justify-self-start">
                            <div className="inline-flex items-center justify-center px-4 h-8 rounded-full border border-lime-700/60 text-lime-700 font-semibold text-sm tracking-wide">
                                {initials}
                            </div>
                        </div>
                        <div className="justify-self-center text-2xl font-semibold text-lime-700">
                            {name}
                        </div>
                        <div />
                    </div>

                    <div className="mt-3 h-[2px] bg-lime-700/60" />

                    <div className="mt-2 text-[11px] text-slate-600 flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
                        {location && <span>{location}</span>}
                        {location && phone && <span className="text-slate-300">|</span>}
                        {phone && <span>{phone}</span>}
                        {(location || phone) && email && <span className="text-slate-300">|</span>}
                        {email && <span>{email}</span>}
                    </div>

                    <div className="mt-2 h-px bg-lime-700/35" />
                </div>

                {/* Body */}
                <div className="mt-7 grid grid-cols-1 md:grid-cols-[1.15fr_0.85fr] gap-10">
                    {/* Left column */}
                    <div className="space-y-8">
                        <OliveSection title="Professional Summary">
                            {sections.summary ? (
                                <p className="text-[11px] leading-relaxed text-slate-700 whitespace-pre-line">
                                    {String(sections.summary)}
                                </p>
                            ) : (
                                <span className="text-slate-400 text-[11px]">Summary goes here.</span>
                            )}
                        </OliveSection>

                        <OliveSection title="Work History">
                            {experience.length > 0 ? (
                                <div className="space-y-5">
                                    {experience.map((exp: any, idx: number) => {
                                        const title = String(exp.title || exp.position || exp.role || "Role");
                                        const company = String(exp.company || exp.organization || "");
                                        const city = String(exp.location || exp.city || "");
                                        const dates = String(
                                            exp.duration ||
                                                exp.dates ||
                                                [exp.start, exp.end].filter(Boolean).join(" to ") ||
                                                ""
                                        );
                                        const desc = exp.description || exp.details || exp.bullets || "";

                                        return (
                                            <div key={idx}>
                                                <div className="text-[12px] font-bold text-slate-900">
                                                    {title}
                                                    {dates ? <span className="font-semibold">, {dates}</span> : null}
                                                </div>
                                                {(company || city) && (
                                                    <div className="mt-0.5 text-[11px] text-slate-600">
                                                        {company && <span className="font-semibold text-slate-800">{company}</span>}
                                                        {company && city ? <span> — </span> : null}
                                                        {city ? <span>{city}</span> : null}
                                                    </div>
                                                )}

                                                {desc ? (
                                                    <div className="mt-2 text-[11px] leading-relaxed text-slate-700">
                                                        <RenderMaybeBullets
                                                            text={desc}
                                                            forceBullets
                                                            className="text-[11px] leading-relaxed text-slate-700"
                                                        />
                                                    </div>
                                                ) : null}
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <span className="text-slate-400 text-[11px]">Work history goes here.</span>
                            )}
                        </OliveSection>

                        <OliveSection title="Languages">
                            {languages.length > 0 ? (
                                <div className="flex flex-wrap gap-2">
                                    {languages.map((l) => (
                                        <span
                                            key={l}
                                            className="px-2.5 py-1 rounded border border-lime-700/35 text-[11px] text-slate-700 bg-white"
                                        >
                                            {l}
                                        </span>
                                    ))}
                                </div>
                            ) : (
                                <span className="text-slate-400 text-[11px]">Languages go here.</span>
                            )}
                        </OliveSection>
                    </div>

                    {/* Right column */}
                    <div className="space-y-8">
                        <OliveSection title="Skills">
                            {skills.length > 0 ? (
                                <div className="space-y-2">
                                    {skills.map((s) => (
                                        <div
                                            key={s}
                                            className="w-full border border-lime-700/35 px-2.5 py-1.5 text-[11px] text-slate-700 bg-white"
                                        >
                                            {s}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <span className="text-slate-400 text-[11px]">Skills go here.</span>
                            )}
                        </OliveSection>

                        <OliveSection title="Certifications">
                            {certifications.length > 0 ? (
                                <ul className="list-disc pl-5 text-[11px] leading-relaxed text-slate-700">
                                    {certifications.map((c) => (
                                        <li key={c} className="marker:text-lime-700/70">
                                            {c}
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <span className="text-slate-400 text-[11px]">Certifications go here.</span>
                            )}
                        </OliveSection>

                        <OliveSection title="Education">
                            {education.length > 0 ? (
                                <div className="space-y-4">
                                    {education.map((edu: any, idx: number) => {
                                        const degree = String(edu.degree || edu.title || "Degree");
                                        const school = String(edu.school || edu.institution || "");
                                        const city = String(edu.location || edu.city || "");
                                        const dates = String(edu.year || edu.dates || edu.graduationDate || "");
                                        const field = String(edu.field || edu.major || "");
                                        return (
                                            <div key={idx}>
                                                <div className="text-[12px] font-bold text-slate-900">
                                                    {degree}
                                                    {field ? <span className="font-normal">: {field}</span> : null}
                                                    {dates ? <span className="font-semibold">, {dates}</span> : null}
                                                </div>
                                                {(school || city) && (
                                                    <div className="mt-0.5 text-[11px] text-slate-600">
                                                        {school && <span className="font-semibold text-slate-800">{school}</span>}
                                                        {school && city ? <span> - </span> : null}
                                                        {city ? <span>{city}</span> : null}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <span className="text-slate-400 text-[11px]">Education goes here.</span>
                            )}
                        </OliveSection>
                    </div>
                </div>
            </div>
        </div>
    );
}

function OliveSection({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <section>
            <h2 className="text-[13px] font-semibold text-lime-700">{title}</h2>
            <div className="mt-3">{children}</div>
        </section>
    );
}

function normalizeToStringList(value: any): string[] {
    if (!value) return [];
    if (Array.isArray(value)) {
        return value
            .flatMap((v) => {
                if (v == null) return [];
                if (typeof v === "string") return [v];
                if (typeof v === "object") return [v.name || v.title || v.label || v.value || ""];
                return [String(v)];
            })
            .map((s) => String(s).trim())
            .filter(Boolean);
    }
    if (typeof value === "string") {
        return value
            .split(/\n|,|•/g)
            .map((s) => s.trim())
            .filter(Boolean);
    }
    return [String(value)].map((s) => s.trim()).filter(Boolean);
}

function getInitials(fullName: string): string {
    const cleaned = String(fullName || "").trim().replace(/\s+/g, " ");
    if (!cleaned) return "YK";
    const parts = cleaned.split(" ").filter(Boolean);
    const first = parts[0]?.[0] || "";
    const last = parts.length > 1 ? parts[parts.length - 1]?.[0] || "" : "";
    const out = (first + last).toUpperCase();
    return out || "YK";
}


