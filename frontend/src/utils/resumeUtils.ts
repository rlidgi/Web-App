/**
 * Parses structured resume content from JSON string or object
 * Returns formatted sections for template rendering
 */
export function parseResumeContent(content: string | any): any {
    let resumeData: any;
    
    // If content is a string, try to parse it as JSON
    if (typeof content === 'string') {
        try {
            resumeData = JSON.parse(content);
        } catch (e) {
            // If parsing fails, assume it's plain text and create a basic structure
            return {
                name: '',
                title: '',
                summary: content,
                experience: [],
                education: [],
                projects: [],
                skills: [],
                certifications: [],
                custom_sections: []
            };
        }
    } else {
        resumeData = content;
    }
    
    // Normalize the data structure - handle both direct structure and nested 'resume' key.
    // IMPORTANT: many templates rely on additional keys that may exist on the parsed resume
    // (e.g., links, references, languages). Preserve unknown keys via a shallow spread.
    const data = resumeData.resume || resumeData;

    return {
        ...(data || {}),
        name: data?.name || '',
        title: data?.title || '',
        email: data?.email || '',
        phone: data?.phone || '',
        location: data?.location || '',
        summary: data?.summary || '',
        experience: Array.isArray(data?.experience) ? data.experience : [],
        education: Array.isArray(data?.education) ? data.education : [],
        projects: Array.isArray(data?.projects) ? data.projects : [],
        skills: Array.isArray(data?.skills) ? data.skills : [],
        certifications: Array.isArray(data?.certifications) ? data.certifications : [],
        custom_sections: Array.isArray(data?.custom_sections) ? data.custom_sections : [],
    };
}

