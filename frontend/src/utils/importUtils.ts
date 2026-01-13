import * as pdfjsLib from 'pdfjs-dist';
import * as mammoth from 'mammoth';
import { ResumeData } from '../types/resume';

// Set up the worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

// Helper function to normalize whitespace
function normalizeText(text: string): string {
    return text
        // Normalize CRLF/CR to LF but preserve multiple blank lines
        .replace(/\r\n?/g, '\n')
        // Collapse spaces/tabs but not newlines
        .replace(/[ \t]+/g, ' ')
        .trim();
}

// Helper to split sections by headers (ALL CAPS or common Title Case headings)
function splitBySections(text: string): { [key: string]: string } {
    const sections: { [key: string]: string } = {};
    const lines = text.split('\n');

    const knownHeadings = [
        'SUMMARY',
        'PROFESSIONAL SUMMARY',
        'OBJECTIVE',
        'EXPERIENCE',
        'PROFESSIONAL EXPERIENCE',
        'WORK EXPERIENCE',
        'EDUCATION',
        'PROJECTS',
        'FEATURED WORK',
        'PORTFOLIO',
        'SKILLS',
        'TECHNICAL SKILLS',
        'CORE COMPETENCIES',
        'CERTIFICATIONS',
        'LICENSES',
        'CREDENTIALS',
    ];

    function normalizeHeading(line: string): string | null {
        const t = line.trim().replace(/:$/, '');
        if (!t) return null;
        // Accept ALL CAPS headings with spaces and common symbols (&, /, -)
        if (/^[A-Z][A-Z\s&/\-]+$/.test(t)) {
            const upper = t.toUpperCase();
            // Map compound headings to canonical keys
            if (upper.includes('SKILLS')) return 'SKILLS';
            if (upper.includes('EXPERIENCE')) return 'EXPERIENCE';
            if (upper.includes('EDUCATION')) return 'EDUCATION';
            if (upper.includes('PROJECTS') || upper.includes('PORTFOLIO')) return 'PROJECTS';
            if (upper.includes('CERTIFICATIONS') || upper.includes('CREDENTIALS') || upper.includes('LICENSES') || upper.includes('ACTUARIAL EXAMS')) return 'CERTIFICATIONS';
            return upper;
        }
        const upper = t.toUpperCase();
        if (knownHeadings.includes(upper)) return upper;
        return null;
    }

    let currentKey: string | null = null;
    let buffer: string[] = [];

    const flush = () => {
        if (currentKey) {
            sections[currentKey] = buffer.join('\n').trim();
        }
        buffer = [];
    };

    for (const line of lines) {
        const key = normalizeHeading(line);
        if (key) {
            flush();
            currentKey = key;
        } else {
            buffer.push(line);
        }
    }
    flush();

    return sections;
}

// Parse contact info from first line (pipe-separated)
function parseContactInfo(text: string): { name?: string; email?: string; phone?: string; location?: string } {
    const result: { name?: string; email?: string; phone?: string; location?: string } = {};

    const lines = text.split('\n');
    if (lines.length === 0) return result;

    // First non-empty line is likely the name (avoid lines that obviously look like contact info)
    const nameLine = lines.find((l) => l.trim().length > 0) || '';
    if (nameLine && nameLine.length < 100 && !/@|\d/.test(nameLine)) {
        result.name = nameLine.trim();
    }

    // Search the first few lines for email/phone/location
    const header = lines.slice(0, 5).join(' | ');

    const emailMatch = header.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[A-Za-z]{2,})/);
    if (emailMatch) result.email = emailMatch[1];

    const phoneMatch = header.match(/(\+?\d{1,2}[\s.-])?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/);
    if (phoneMatch) result.phone = phoneMatch[0];

    const locationMatch = header.match(/([A-Za-z .'-]+,\s*[A-Za-z .'-]+(?:,\s*[A-Z]{2})?)/);
    if (locationMatch) result.location = locationMatch[1];

    return result;
}

// Parse education entries
function parseEducation(text: string): Array<{ school: string; degree: string; field: string; graduationDate: string }> {
    const entries: Array<{ school: string; degree: string; field: string; graduationDate: string }> = [];

    if (!text) return entries;

    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

    for (const raw of lines) {
        const entry = { school: '', degree: '', field: '', graduationDate: '' };

        // Extract GPA and date mentions
        const gpaMatch = raw.match(/gpa\s*[:)]?\s*([\d.]+)/i);
        const dateMatch = raw.match(/expected\s+graduation\s*:\s*([A-Za-z]+\s+\d{4})/i) || raw.match(/\b([A-Za-z]+\s+\d{4})\b/);
        if (dateMatch) entry.graduationDate = (dateMatch[1] || '').trim();

        // Try pipe format first
        const pipeParts = raw.split('|').map((p) => p.trim());
        if (pipeParts.length >= 2) {
            const uniIdx = pipeParts.findIndex((p) => /university|college|institute|school/i.test(p));
            if (uniIdx >= 0) {
                entry.school = pipeParts[uniIdx];
                entry.degree = pipeParts.slice(0, uniIdx).join(' ').trim();
            } else {
                entry.degree = pipeParts[0];
                entry.school = pipeParts[1] || '';
            }
        } else {
            // Comma-delimited heuristic
            const parts = raw.split(',').map((p) => p.trim()).filter(Boolean);
            const uniIdx = parts.findIndex((p) => /university|college|institute|school/i.test(p));
            if (uniIdx >= 0) {
                // School may span two tokens (e.g., University, Campus)
                const schoolTokens = [parts[uniIdx]];
                if (parts[uniIdx + 1] && !/expected|gpa|\b(bachelor|master|degree)\b/i.test(parts[uniIdx + 1])) {
                    schoolTokens.push(parts[uniIdx + 1]);
                }
                entry.school = schoolTokens.join(', ');
                const degreeText = parts.slice(0, uniIdx).join(', ');
                // Extract field via " in X" if present
                const inMatch = degreeText.match(/\bin\s+([^,]+)/i);
                if (inMatch) entry.field = inMatch[1].trim();
                entry.degree = degreeText.replace(/\bin\s+[^,]+/i, '').trim();
            } else {
                entry.degree = parts[0] || raw;
            }
        }

        if (!entry.field && gpaMatch) {
            // Append GPA to degree details minimally (avoid bold 'in GPA')
            entry.field = `GPA ${gpaMatch[1]}`;
        }

        if (entry.degree || entry.school) entries.push(entry);
    }

    return entries;
}

// Parse experience entries
function parseExperience(
    text: string
): Array<{
    position: string;
    company: string;
    startDate: string;
    endDate: string;
    description: string;
    currentlyWorking: boolean;
}> {
    const entries: Array<{
        position: string;
        company: string;
        startDate: string;
        endDate: string;
        description: string;
        currentlyWorking: boolean;
    }> = [];

    if (!text) return entries;

    const lines = text.split('\n').map((l) => l.trim());
    let i = 0;
    while (i < lines.length) {
        const line = lines[i];
        if (!line) { i++; continue; }

        // Header line: either "Position | Company | Dates", "Position | Company" or comma-delimited
        let header = line;
        let next = (i + 1 < lines.length) ? lines[i + 1] : '';
        let usedNextAsHeaderInfo = false;
        if (!header.includes('|') && next && next.includes('|')) {
            // Two-line header format
            header = `${header} | ${next}`;
            usedNextAsHeaderInfo = true;
        }

        let parts = header.split('|').map((p) => p.trim());
        if (parts.length === 1) {
            // Try comma-delimited fallback
            const cparts = header.split(',').map((p) => p.trim()).filter(Boolean);
            // Attempt to extract dates from the last token
            const last = cparts[cparts.length - 1] || '';
            const datePattern = /(\d{1,2}\/\d{4}|[A-Za-z]{3,9}\s+\d{4})\s*(?:–|-|—)\s*(Present|Now|Current|Ongoing|\d{1,2}\/\d{4}|[A-Za-z]{3,9}\s+\d{4})/i;
            const dm = last.match(datePattern);
            if (dm) {
                // position, company, dates
                parts = [cparts[0] || '', cparts.slice(1, -1).join(', '), last];
            } else {
                parts = [cparts[0] || '', cparts.slice(1).join(', ')];
            }
        }
        const entry = {
            position: parts[0] || '',
            company: parts[1] || '',
            startDate: '',
            endDate: '',
            description: '',
            currentlyWorking: false,
        };

        // Dates might be in parts[2] or included in parts[1]
        const dateSource = (parts[2] || parts[1] || '');
        const datePattern = /(\d{1,2}\/\d{4}|[A-Za-z]{3,9}\s+\d{4})\s*(?:–|-|—)\s*(Present|Now|Current|Ongoing|\d{1,2}\/\d{4}|[A-Za-z]{3,9}\s+\d{4})/i;
        const dateMatch = dateSource.match(datePattern);
        if (dateMatch) {
            entry.startDate = dateMatch[1];
            entry.endDate = dateMatch[2];
            entry.currentlyWorking = /present|now|current|ongoing/i.test(dateMatch[2]);
        }
        // Clean company if it had dates appended
        if (entry.company) {
            entry.company = entry.company.replace(datePattern, '').replace(/\s*[|,;]\s*$/, '').trim();
        }

        // Collect bullet lines following
        const bullets: string[] = [];
        let j = i + (usedNextAsHeaderInfo ? 2 : 1);
        while (j < lines.length) {
            const l = lines[j];
            if (!l) { j++; continue; }
            if (/^[-•*]/.test(l)) {
                bullets.push(l.replace(/^(−|–|—|[-•*])\s*/, ''));
                j++;
            } else {
                break;
            }
        }
        entry.description = bullets.join(' ').substring(0, 600);
        entries.push(entry);
        i = j;
    }

    return entries;
}

// Parse projects
function parseProjects(text: string): Array<{ title: string; description: string; technologies: string[] }> {
    const entries: Array<{ title: string; description: string; technologies: string[] }> = [];

    if (!text) return entries;

    // Split by double newlines
    const blocks = text.split(/\n(?=[A-Z])/);

    for (const block of blocks) {
        const lines = block.split('\n').filter((l) => l.trim());
        if (lines.length < 1) continue;

        const entry: { title: string; description: string; technologies: string[] } = {
            title: lines[0].trim(),
            description: '',
            technologies: [],
        };

        // Remove project title, keep the rest including company/context line and bullets
        const content = lines.slice(1).join(' ').trim();

        // Extract technologies if mentioned
        const techMatch = content.match(/(?:used|implemented|built with|using|technologies?:?)\s*([^.]+?)(?:\.|$)/i);
        if (techMatch) {
            entry.technologies = techMatch[1]
                .split(/[,;]/)
                .map((t) => t.trim())
                .filter((t) => t.length > 0 && t.length < 30)
                .slice(0, 10);
        }

        entry.description = content.substring(0, 250);
        entries.push(entry);
    }

    return entries;
}

// Parse skills - handles category-based format
function parseSkills(text: string): string[] {
    const skills: string[] = [];

    if (!text) return skills;

    // Split by category headers (lines ending with colon)
    const lines = text.split('\n');

    for (const line of lines) {
        const effective = line.includes(':') ? line.split(':').slice(1).join(':') : line;
        const items = effective
            .split(/[,;|]/)
            .map((s) => s.trim().replace(/^(−|–|—|[-•*])\s*/, ''));
        for (const item of items) {
            if (item.length > 0 && item.length < 80 && !item.match(/^(category|section|header)/i)) {
                skills.push(item);
            }
        }
    }

    return skills.slice(0, 30);
}

// Parse certifications/exams
function parseCertifications(text: string): Array<{ name: string; issuer: string; issueDate: string; expiryDate: string }> {
    const entries: Array<{ name: string; issuer: string; issueDate: string; expiryDate: string }> = [];

    if (!text) return entries;

    // Each bullet point is a certification
    const lines = text.split('\n').filter((l) => l.trim());

    for (const line of lines) {
        const certName = line.replace(/^[-•*]\s*/, '').trim();
        if (certName.length > 0) {
            entries.push({
                name: certName,
                issuer: '',
                issueDate: '',
                expiryDate: '',
            });
        }
    }

    return entries.slice(0, 10);
}

export async function parseJSONResume(file: File): Promise<Partial<ResumeData>> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const json = JSON.parse(e.target?.result as string);
                resolve(json);
            } catch (error) {
                reject(new Error('Invalid JSON file'));
            }
        };
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsText(file);
    });
}

export async function parsePDFResume(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const pdf = await pdfjsLib.getDocument({
                    data: e.target?.result as ArrayBuffer,
                }).promise;

                let fullText = '';
                for (let i = 1; i <= pdf.numPages; i++) {
                    const page = await pdf.getPage(i);
                    const textContent = await page.getTextContent({
                        normalizeWhitespace: true,
                        disableCombineTextItems: false,
                    } as any);

                    // Use hasEOL to keep intended newlines; otherwise add spaces
                    let pageText = '';
                    for (const item of textContent.items as any[]) {
                        const str = (item && (item as any).str) ? (item as any).str : '';
                        const eol = (item && (item as any).hasEOL) ? '\n' : ' ';
                        // If a text item starts with a bullet marker and the previous
                        // content didn't end with a newline, insert one to avoid
                        // bullets merging with preceding subheadings.
                        if (pageText && !pageText.endsWith('\n') && /^\s*[•*\-–—]\s+/.test(str)) {
                            pageText += '\n';
                        }
                        pageText += str + eol;
                    }

                    // De-hyphenation across line breaks: "exam-\nple" -> "example"
                    pageText = pageText.replace(/([a-z])\-\n([a-z])/g, '$1$2');
                    fullText += pageText + '\n';
                }
                resolve(normalizeText(fullText));
            } catch (error) {
                reject(new Error('Failed to parse PDF'));
            }
        };
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsArrayBuffer(file);
    });
}

export function extractResumeDataFromText(text: string): Partial<ResumeData> {
    const normalizedText = normalizeText(text);
    const data: Partial<ResumeData> = {
        skills: [],
        experience: [],
        education: [],
        projects: [],
        certifications: [],
    };

    // Parse contact info from header
    const contactInfo = parseContactInfo(normalizedText);
    data.name = contactInfo.name;
    data.email = contactInfo.email;
    data.phone = contactInfo.phone;
    data.location = contactInfo.location;

    // Split into sections by headers (ALL CAPS or Title Case)
    const sections = splitBySections(normalizedText);

    // Parse each section
    if (sections.EDUCATION || sections['EDUCATION BACKGROUND'] || sections['ACADEMIC']) {
        data.education = parseEducation(sections.EDUCATION || sections['EDUCATION BACKGROUND'] || sections.ACADEMIC || '') as any;
    }

    if (sections.EXPERIENCE || sections['PROFESSIONAL EXPERIENCE'] || sections['WORK EXPERIENCE']) {
        data.experience = parseExperience(
            sections.EXPERIENCE || sections['PROFESSIONAL EXPERIENCE'] || sections['WORK EXPERIENCE'] || ''
        ) as any;
    }

    if (sections.PROJECTS || sections['FEATURED WORK'] || sections.PORTFOLIO) {
        data.projects = parseProjects(sections.PROJECTS || sections['FEATURED WORK'] || sections.PORTFOLIO || '') as any;
    }

    const skillsText =
        sections['TECHNICAL SKILLS'] || sections.SKILLS || sections['CORE COMPETENCIES'] || sections.PROGRAMMING || '';
    if (skillsText) {
        data.skills = parseSkills(skillsText);
    }

    if (
        sections.CERTIFICATIONS ||
        sections.LICENSES ||
        sections['ACTUARIAL EXAMS PASSED'] ||
        sections.CREDENTIALS
    ) {
        data.certifications = parseCertifications(
            sections.CERTIFICATIONS ||
            sections.LICENSES ||
            sections['ACTUARIAL EXAMS PASSED'] ||
            sections.CREDENTIALS ||
            ''
        ) as any;
    }

    // Extract summary only if explicitly present in sections
    if (sections.SUMMARY || sections['PROFESSIONAL SUMMARY'] || sections.OBJECTIVE) {
        data.summary = (sections.SUMMARY || sections['PROFESSIONAL SUMMARY'] || sections.OBJECTIVE || '')
            .substring(0, 200)
            .trim();
    }

    const hasScalars = Boolean((data.name || data.email || data.phone || data.location || data.summary || '').trim());
    const hasLists = Boolean(
        (data.skills && data.skills.length) ||
        (data.experience && data.experience.length) ||
        (data.education && data.education.length) ||
        (data.projects && data.projects.length) ||
        (data.certifications && data.certifications.length)
    );
    // Do not auto-fill summary when no explicit summary exists

    return data;
}

export async function parseDocResume(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const arrayBuffer = e.target?.result as ArrayBuffer;
                const result = await mammoth.extractRawText({ arrayBuffer });

                if (!result.value || !result.value.trim()) {
                    throw new Error('Could not extract text from Word document');
                }

                resolve(normalizeText(result.value));
            } catch (error) {
                reject(new Error('Failed to parse Word document. Make sure it is a valid .docx file'));
            }
        };
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsArrayBuffer(file);
    });
}

export async function importResume(file: File): Promise<Partial<ResumeData>> {
    if (file.type === 'application/json') {
        return parseJSONResume(file);
    } else if (file.type === 'application/pdf') {
        const text = await parsePDFResume(file);
        return extractResumeDataFromText(text);
    } else if (
        file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        file.name.endsWith('.docx')
    ) {
        const text = await parseDocResume(file);
        return extractResumeDataFromText(text);
    } else {
        throw new Error('Unsupported file type. Please upload a PDF, Word (.docx), or JSON file.');
    }
}
