import { ResumeData } from '../types/resume';

interface ResumePreviewProps {
    resume: ResumeData;
}

const ModernTemplate = ({ resume }: ResumePreviewProps) => (
    <div className="bg-white p-12 font-sans text-gray-800">
        <div className="border-b-4 border-blue-600 pb-6 mb-6">
            <h1 className="text-4xl font-bold text-blue-600 mb-2">{resume.name}</h1>
            <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                {resume.email && <span>{resume.email}</span>}
                {resume.phone && <span>•</span>}
                {resume.phone && <span>{resume.phone}</span>}
                {resume.location && <span>•</span>}
                {resume.location && <span>{resume.location}</span>}
                {resume.website && <span>•</span>}
                {resume.website && <span>{resume.website}</span>}
            </div>
        </div>

        {resume.summary && (
            <div className="mb-6">
                <h2 className="text-xl font-bold text-blue-600 mb-2">PROFESSIONAL SUMMARY</h2>
                <p className="text-sm text-gray-700 leading-relaxed">{resume.summary}</p>
            </div>
        )}

        {resume.education.length > 0 && (
            <div className="mb-6">
                <h2 className="text-xl font-bold text-blue-600 mb-3">EDUCATION</h2>
                <div className="space-y-3">
                    {resume.education.map((edu) => (
                        <div key={edu.id}>
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="font-bold text-gray-900">{edu.degree}</h3>
                                    {edu.field && <p className="text-sm text-gray-700">{edu.field}</p>}
                                    <p className="text-sm text-gray-600">{edu.school}</p>
                                </div>
                                <span className="text-sm text-gray-600">{edu.graduationDate}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )}

        {resume.experience.length > 0 && (
            <div className="mb-6">
                <h2 className="text-xl font-bold text-blue-600 mb-3">EXPERIENCE</h2>
                <div className="space-y-4">
                    {resume.experience.map((exp) => (
                        <div key={exp.id}>
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="font-bold text-gray-900">{exp.position}</h3>
                                    <p className="text-sm text-gray-600">{exp.company}</p>
                                </div>
                                <span className="text-sm text-gray-600">
                                    {exp.startDate} - {exp.currentlyWorking ? 'Present' : exp.endDate}
                                </span>
                            </div>
                            {exp.description && <p className="text-sm text-gray-700 mt-1">{exp.description}</p>}
                        </div>
                    ))}
                </div>
            </div>
        )}

        {resume.skills.length > 0 && (
            <div className="mb-6">
                <h2 className="text-xl font-bold text-blue-600 mb-2">SKILLS</h2>
                <div className="flex flex-wrap gap-2">
                    {resume.skills.map((skill, idx) => (
                        <span key={idx} className="text-sm bg-blue-100 text-blue-800 px-3 py-1 rounded">
                            {skill}
                        </span>
                    ))}
                </div>
            </div>
        )}

        {resume.projects.length > 0 && (
            <div className="mb-6">
                <h2 className="text-xl font-bold text-blue-600 mb-3">PROJECTS</h2>
                <div className="space-y-3">
                    {resume.projects.map((proj) => (
                        <div key={proj.id}>
                            <h3 className="font-bold text-gray-900">{proj.title}</h3>
                            {proj.technologies.length > 0 && (
                                <p className="text-sm text-gray-600">
                                    {proj.technologies.join(' • ')}
                                </p>
                            )}
                            {proj.description && <p className="text-sm text-gray-700 mt-1">{proj.description}</p>}
                            {proj.link && (
                                <p className="text-sm text-blue-600 mt-1">{proj.link}</p>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        )}

        {resume.certifications.length > 0 && (
            <div>
                <h2 className="text-xl font-bold text-blue-600 mb-3">CERTIFICATIONS</h2>
                <div className="space-y-2">
                    {resume.certifications.map((cert) => (
                        <div key={cert.id}>
                            <h3 className="font-bold text-gray-900">{cert.title}</h3>
                            <p className="text-sm text-gray-600">
                                {cert.issuer} • {cert.issueDate}
                                {cert.expirationDate && ` - ${cert.expirationDate}`}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        )}
    </div>
);

const ClassicTemplate = ({ resume }: ResumePreviewProps) => (
    <div className="bg-white p-12 font-serif text-gray-800">
        <div className="text-center mb-6 pb-6 border-b-2 border-gray-400">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">{resume.name}</h1>
            <div className="text-sm text-gray-700 space-x-2">
                {resume.email && <span>{resume.email}</span>}
                {resume.phone && <span>|</span>}
                {resume.phone && <span>{resume.phone}</span>}
                {resume.location && <span>|</span>}
                {resume.location && <span>{resume.location}</span>}
            </div>
        </div>

        {resume.summary && (
            <div className="mb-6">
                <h2 className="text-lg font-bold text-gray-900 uppercase border-b border-gray-300 mb-2">
                    Professional Summary
                </h2>
                <p className="text-sm text-gray-700">{resume.summary}</p>
            </div>
        )}

        {resume.education.length > 0 && (
            <div className="mb-6">
                <h2 className="text-lg font-bold text-gray-900 uppercase border-b border-gray-300 mb-3">
                    Education
                </h2>
                <div className="space-y-3">
                    {resume.education.map((edu) => (
                        <div key={edu.id}>
                            <div className="flex justify-between">
                                <h3 className="font-bold text-gray-900">
                                    {edu.degree} in {edu.field}
                                </h3>
                                <span className="text-sm text-gray-600">{edu.graduationDate}</span>
                            </div>
                            <p className="text-sm text-gray-700">{edu.school}</p>
                        </div>
                    ))}
                </div>
            </div>
        )}

        {resume.experience.length > 0 && (
            <div className="mb-6">
                <h2 className="text-lg font-bold text-gray-900 uppercase border-b border-gray-300 mb-3">
                    Experience
                </h2>
                <div className="space-y-4">
                    {resume.experience.map((exp) => (
                        <div key={exp.id}>
                            <div className="flex justify-between">
                                <h3 className="font-bold text-gray-900">{exp.position}</h3>
                                <span className="text-sm text-gray-600">
                                    {exp.startDate} - {exp.currentlyWorking ? 'Present' : exp.endDate}
                                </span>
                            </div>
                            <p className="text-sm font-semibold text-gray-700">{exp.company}</p>
                            {exp.description && <p className="text-sm text-gray-700 mt-1">{exp.description}</p>}
                        </div>
                    ))}
                </div>
            </div>
        )}

        {resume.skills.length > 0 && (
            <div className="mb-6">
                <h2 className="text-lg font-bold text-gray-900 uppercase border-b border-gray-300 mb-2">
                    Skills
                </h2>
                <p className="text-sm text-gray-700">{resume.skills.join(', ')}</p>
            </div>
        )}

        {resume.projects.length > 0 && (
            <div className="mb-6">
                <h2 className="text-lg font-bold text-gray-900 uppercase border-b border-gray-300 mb-3">
                    Projects
                </h2>
                <div className="space-y-3">
                    {resume.projects.map((proj) => (
                        <div key={proj.id}>
                            <h3 className="font-bold text-gray-900">{proj.title}</h3>
                            {proj.technologies.length > 0 && (
                                <p className="text-sm text-gray-600">{proj.technologies.join(', ')}</p>
                            )}
                            {proj.description && <p className="text-sm text-gray-700 mt-1">{proj.description}</p>}
                        </div>
                    ))}
                </div>
            </div>
        )}

        {resume.certifications.length > 0 && (
            <div>
                <h2 className="text-lg font-bold text-gray-900 uppercase border-b border-gray-300 mb-3">
                    Certifications
                </h2>
                <div className="space-y-2">
                    {resume.certifications.map((cert) => (
                        <div key={cert.id}>
                            <p className="font-bold text-gray-900">{cert.title}</p>
                            <p className="text-sm text-gray-700">{cert.issuer}</p>
                        </div>
                    ))}
                </div>
            </div>
        )}
    </div>
);

const MinimalTemplate = ({ resume }: ResumePreviewProps) => (
    <div className="bg-white p-12 font-sans text-gray-900 text-sm">
        <h1 className="text-2xl font-bold mb-1">{resume.name}</h1>
        <div className="text-xs text-gray-600 mb-6 space-x-2">
            {resume.email && <span>{resume.email}</span>}
            {resume.phone && <span>•</span>}
            {resume.phone && <span>{resume.phone}</span>}
            {resume.location && <span>•</span>}
            {resume.location && <span>{resume.location}</span>}
        </div>

        {resume.summary && (
            <div className="mb-4">
                <p className="text-xs leading-relaxed">{resume.summary}</p>
            </div>
        )}

        {resume.education.length > 0 && (
            <div className="mb-4">
                <div className="font-bold uppercase text-xs mb-2">Education</div>
                <div className="space-y-1">
                    {resume.education.map((edu) => (
                        <div key={edu.id} className="text-xs">
                            {edu.degree} in {edu.field} — {edu.school}
                        </div>
                    ))}
                </div>
            </div>
        )}

        {resume.experience.length > 0 && (
            <div className="mb-4">
                <div className="font-bold uppercase text-xs mb-2">Experience</div>
                <div className="space-y-2">
                    {resume.experience.map((exp) => (
                        <div key={exp.id} className="text-xs">
                            <div className="font-semibold">
                                {exp.position} — {exp.company}
                            </div>
                            {exp.description && <div className="text-gray-700">{exp.description}</div>}
                        </div>
                    ))}
                </div>
            </div>
        )}

        {resume.skills.length > 0 && (
            <div className="mb-4">
                <div className="font-bold uppercase text-xs mb-2">Skills</div>
                <div className="text-xs">{resume.skills.join(' • ')}</div>
            </div>
        )}

        {resume.projects.length > 0 && (
            <div className="mb-4">
                <div className="font-bold uppercase text-xs mb-2">Projects</div>
                <div className="space-y-1">
                    {resume.projects.map((proj) => (
                        <div key={proj.id} className="text-xs">
                            <div className="font-semibold">{proj.title}</div>
                            {proj.description && <div className="text-gray-700">{proj.description}</div>}
                        </div>
                    ))}
                </div>
            </div>
        )}

        {resume.certifications.length > 0 && (
            <div>
                <div className="font-bold uppercase text-xs mb-2">Certifications</div>
                <div className="space-y-1">
                    {resume.certifications.map((cert) => (
                        <div key={cert.id} className="text-xs">
                            {cert.title} — {cert.issuer}
                        </div>
                    ))}
                </div>
            </div>
        )}
    </div>
);

const ProfessionalTemplate = ({ resume }: ResumePreviewProps) => (
    <div className="bg-white p-12 font-serif text-gray-900">
        <div className="border-l-4 border-indigo-600 pl-6 mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-1">{resume.name}</h1>
            <div className="text-sm text-gray-600 space-x-3">
                {resume.email && <span>{resume.email}</span>}
                {resume.phone && <span>{resume.phone}</span>}
                {resume.location && <span>{resume.location}</span>}
            </div>
        </div>

        {resume.summary && (
            <div className="mb-8">
                <h2 className="text-sm font-bold uppercase text-indigo-600 tracking-wide mb-3">Summary</h2>
                <p className="text-sm leading-relaxed text-gray-700">{resume.summary}</p>
            </div>
        )}

        {resume.education.length > 0 && (
            <div className="mb-8">
                <h2 className="text-sm font-bold uppercase text-indigo-600 tracking-wide mb-4">Education</h2>
                <div className="space-y-3">
                    {resume.education.map((edu) => (
                        <div key={edu.id}>
                            <div className="flex justify-between">
                                <h3 className="text-sm font-bold text-gray-900">{edu.degree} in {edu.field}</h3>
                                <span className="text-xs text-gray-600">{edu.graduationDate}</span>
                            </div>
                            <p className="text-sm text-gray-600">{edu.school}</p>
                        </div>
                    ))}
                </div>
            </div>
        )}

        {resume.experience.length > 0 && (
            <div className="mb-8">
                <h2 className="text-sm font-bold uppercase text-indigo-600 tracking-wide mb-4">Professional Experience</h2>
                <div className="space-y-5">
                    {resume.experience.map((exp, idx) => (
                        <div key={exp.id} className={idx !== resume.experience.length - 1 ? 'pb-4 border-b border-gray-200' : ''}>
                            <div className="flex justify-between mb-1">
                                <h3 className="text-sm font-bold text-gray-900">{exp.position}</h3>
                                <span className="text-xs text-gray-600">
                                    {exp.startDate} – {exp.currentlyWorking ? 'Present' : exp.endDate}
                                </span>
                            </div>
                            <p className="text-sm text-gray-600 mb-2">{exp.company}</p>
                            {exp.description && <p className="text-sm text-gray-700 leading-relaxed">{exp.description}</p>}
                        </div>
                    ))}
                </div>
            </div>
        )}

        {resume.skills.length > 0 && (
            <div className="mb-8">
                <h2 className="text-sm font-bold uppercase text-indigo-600 tracking-wide mb-3">Skills</h2>
                <div className="grid grid-cols-2 gap-2">
                    {resume.skills.map((skill, idx) => (
                        <div key={idx} className="text-sm text-gray-700">• {skill}</div>
                    ))}
                </div>
            </div>
        )}

        {resume.projects.length > 0 && (
            <div className="mb-8">
                <h2 className="text-sm font-bold uppercase text-indigo-600 tracking-wide mb-4">Projects</h2>
                <div className="space-y-4">
                    {resume.projects.map((proj) => (
                        <div key={proj.id}>
                            <h3 className="text-sm font-bold text-gray-900">{proj.title}</h3>
                            {proj.technologies.length > 0 && (
                                <p className="text-xs text-gray-600 mb-1">{proj.technologies.join(' • ')}</p>
                            )}
                            {proj.description && <p className="text-sm text-gray-700">{proj.description}</p>}
                        </div>
                    ))}
                </div>
            </div>
        )}

        {resume.certifications.length > 0 && (
            <div>
                <h2 className="text-sm font-bold uppercase text-indigo-600 tracking-wide mb-3">Certifications</h2>
                <div className="space-y-2">
                    {resume.certifications.map((cert) => (
                        <div key={cert.id}>
                            <p className="text-sm font-bold text-gray-900">{cert.title}</p>
                            <p className="text-xs text-gray-600">{cert.issuer}</p>
                        </div>
                    ))}
                </div>
            </div>
        )}
    </div>
);

const CreativeTemplate = ({ resume }: ResumePreviewProps) => (
    <div className="bg-white p-12 font-sans">
        <div className="bg-gradient-to-r from-purple-500 via-pink-500 to-red-500 text-white p-8 rounded-lg mb-8">
            <h1 className="text-4xl font-bold mb-2">{resume.name}</h1>
            <div className="text-sm opacity-90">
                {resume.email && <span>{resume.email}</span>}
                {resume.phone && <span> • {resume.phone}</span>}
                {resume.location && <span> • {resume.location}</span>}
            </div>
        </div>

        {resume.summary && (
            <div className="mb-8 p-6 bg-purple-50 rounded-lg">
                <h2 className="text-lg font-bold text-purple-700 mb-3">About Me</h2>
                <p className="text-gray-700 leading-relaxed">{resume.summary}</p>
            </div>
        )}

        {resume.education.length > 0 && (
            <div className="mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Education</h2>
                <div className="grid grid-cols-2 gap-4">
                    {resume.education.map((edu) => (
                        <div key={edu.id} className="p-4 bg-pink-50 rounded-lg">
                            <h3 className="font-bold text-gray-900 text-sm">{edu.degree}</h3>
                            <p className="text-xs text-gray-600">{edu.field}</p>
                            <p className="text-xs text-gray-600 mt-1">{edu.school}</p>
                        </div>
                    ))}
                </div>
            </div>
        )}

        {resume.experience.length > 0 && (
            <div className="mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Experience</h2>
                <div className="space-y-6">
                    {resume.experience.map((exp) => (
                        <div key={exp.id} className="border-l-4 border-purple-400 pl-4">
                            <h3 className="text-lg font-bold text-gray-900">{exp.position}</h3>
                            <p className="text-sm text-purple-600 font-semibold">{exp.company}</p>
                            <p className="text-xs text-gray-500 mt-1">
                                {exp.startDate} – {exp.currentlyWorking ? 'Present' : exp.endDate}
                            </p>
                            {exp.description && <p className="text-sm text-gray-700 mt-2">{exp.description}</p>}
                        </div>
                    ))}
                </div>
            </div>
        )}

        {resume.skills.length > 0 && (
            <div className="mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Skills</h2>
                <div className="flex flex-wrap gap-3">
                    {resume.skills.map((skill, idx) => (
                        <span
                            key={idx}
                            className="px-4 py-2 bg-gradient-to-r from-purple-100 to-pink-100 text-gray-800 rounded-full text-sm font-semibold"
                        >
                            {skill}
                        </span>
                    ))}
                </div>
            </div>
        )}

        {resume.projects.length > 0 && (
            <div className="mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Projects</h2>
                <div className="grid grid-cols-2 gap-4">
                    {resume.projects.map((proj) => (
                        <div key={proj.id} className="p-4 border-2 border-purple-200 rounded-lg">
                            <h3 className="font-bold text-gray-900">{proj.title}</h3>
                            {proj.technologies.length > 0 && (
                                <p className="text-xs text-purple-600 mt-2">{proj.technologies.join(', ')}</p>
                            )}
                            {proj.description && <p className="text-xs text-gray-600 mt-2">{proj.description}</p>}
                        </div>
                    ))}
                </div>
            </div>
        )}

        {resume.certifications.length > 0 && (
            <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Certifications</h2>
                <div className="space-y-2">
                    {resume.certifications.map((cert) => (
                        <div key={cert.id} className="flex items-start gap-3">
                            <span className="text-purple-500 font-bold text-lg">✓</span>
                            <div>
                                <p className="font-bold text-gray-900 text-sm">{cert.title}</p>
                                <p className="text-xs text-gray-600">{cert.issuer}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )}
    </div>
);

export default function ResumePreview({ resume }: ResumePreviewProps) {
    // Normalize old/unsupported template ids to keep previews working for older saved resumes.
    const template =
        resume.template === 'executive'
            ? 'professional'
            : resume.template === 'ats' || resume.template === 'two-column' || resume.template === 'compact'
                ? 'modern'
                : resume.template;

    const supported = new Set(['modern', 'classic', 'minimal', 'professional', 'creative']);
    const normalizedTemplate = supported.has(template) ? template : 'modern';

    return (
        <div id="resume-preview" className="bg-white rounded-lg shadow-lg overflow-hidden">
            {normalizedTemplate === 'modern' && <ModernTemplate resume={resume} />}
            {normalizedTemplate === 'classic' && <ClassicTemplate resume={resume} />}
            {normalizedTemplate === 'minimal' && <MinimalTemplate resume={resume} />}
            {normalizedTemplate === 'professional' && <ProfessionalTemplate resume={resume} />}
            {normalizedTemplate === 'creative' && <CreativeTemplate resume={resume} />}
        </div>
    );
}
