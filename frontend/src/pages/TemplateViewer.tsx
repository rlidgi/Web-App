import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import ModernTemplate from '../components/templates/ModernTemplate';
import ProfessionalTemplate from '../components/templates/ProfessionalTemplate';
import MinimalTemplate from '../components/templates/MinimalTemplate';
import CreativeTemplate from '../components/templates/CreativeTemplate';

export default function TemplateViewer() {
    const { templateName } = useParams<{ templateName: string }>();
    const location = useLocation();
    const [resumeData, setResumeData] = useState<any>(null);
    const [revisedResume, setRevisedResume] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [downloadingPdf, setDownloadingPdf] = useState(false);
    const [downloadingDocx, setDownloadingDocx] = useState(false);
    const autoPrintTriggeredRef = useRef(false);
    // PDF export mode:
    // A = exact like site (preserve wrapping), B = fill page (reflow), C = fit to one page (scale to fit)
    // User request: remove padding + fit to one page (does not need to match the site) => C.
    const pdfMode: 'A' | 'B' | 'C' = 'C';

    console.log('TemplateViewer: Template name:', templateName);

    async function printElementViaHiddenIframe(el: HTMLElement) {
        // Popup-free export: print dialog using an isolated iframe (no popup), prints only the resume DOM.
        // Print to a fixed Letter page and scale the already-laid-out resume with CSS transform.
        // IMPORTANT: transform-scaling preserves line breaks/wrapping (unlike changing layout width).
        const stylesheetLinks = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
            .map(l => (l as HTMLLinkElement).href)
            .filter(Boolean);
        const inlineStyles = Array.from(document.querySelectorAll('style')).map(s => s.innerHTML || '');

        const clone = el.cloneNode(true) as HTMLElement;

        // CSS px are 96 per inch. Letter = 8.5in x 11in.
        const pageWidthPx = 816;
        const pageHeightPx = 1056;

        const isExact = pdfMode === 'A';
        const isFill = pdfMode === 'B';
        const isOnePage = pdfMode === 'C';

        const printCss = isOnePage ? `
          @page { size: letter; margin: 0 !important; }
          html, body {
            width: ${pageWidthPx}px;
            height: ${pageHeightPx}px;
            margin: 0 !important;
            padding: 0 !important;
            overflow: hidden !important;
            background: #fff !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          #printPage {
            position: relative;
            width: ${pageWidthPx}px;
            height: ${pageHeightPx}px;
            overflow: hidden;
          }
          #printTarget { position: absolute; top: 0; left: 0; width: ${pageWidthPx}px; }
          /* Remove Tailwind gutters so the scaled content uses the full printable area */
          #printTarget .mx-auto { margin-left: 0 !important; margin-right: 0 !important; }
          #printTarget .max-w-3xl,
          #printTarget .max-w-4xl,
          #printTarget .max-w-5xl,
          #printTarget .max-w-6xl,
          #printTarget .max-w-7xl { max-width: none !important; width: 100% !important; }

          /* Dynamic compaction presets (applied by JS via data-compact on #printTarget) */
          #printTarget[data-compact="1"] .p-8 { padding: 18px !important; }
          #printTarget[data-compact="1"] .space-y-8 > :not([hidden]) ~ :not([hidden]) { margin-top: 16px !important; }

          #printTarget[data-compact="2"] .p-8 { padding: 14px !important; }
          #printTarget[data-compact="2"] .space-y-8 > :not([hidden]) ~ :not([hidden]) { margin-top: 12px !important; }
          #printTarget[data-compact="2"] .space-y-6 > :not([hidden]) ~ :not([hidden]) { margin-top: 10px !important; }
          #printTarget[data-compact="2"] .leading-relaxed { line-height: 1.32 !important; }
          #printTarget[data-compact="2"] .text-2xl { font-size: 20px !important; }
          #printTarget[data-compact="2"] .text-xl { font-size: 18px !important; }

          #printTarget[data-compact="3"] .p-8 { padding: 10px !important; }
          #printTarget[data-compact="3"] .space-y-8 > :not([hidden]) ~ :not([hidden]) { margin-top: 10px !important; }
          #printTarget[data-compact="3"] .space-y-6 > :not([hidden]) ~ :not([hidden]) { margin-top: 8px !important; }
          #printTarget[data-compact="3"] .space-y-5 > :not([hidden]) ~ :not([hidden]) { margin-top: 7px !important; }
          #printTarget[data-compact="3"] .space-y-4 > :not([hidden]) ~ :not([hidden]) { margin-top: 6px !important; }
          #printTarget[data-compact="3"] .leading-relaxed { line-height: 1.25 !important; }
          #printTarget[data-compact="3"] .text-2xl { font-size: 18px !important; }
          #printTarget[data-compact="3"] .text-xl { font-size: 16px !important; }
          #printTarget[data-compact="3"] .text-lg { font-size: 15px !important; }
          #printTarget[data-compact="3"] .text-sm { font-size: 12px !important; }
          #printTarget[data-compact="3"] .text-xs { font-size: 11px !important; }

          /* Level 4: aggressive compaction (last resort before vertical squeeze) */
          #printTarget[data-compact="4"] .p-8 { padding: 8px !important; }
          #printTarget[data-compact="4"] .p-5 { padding: 10px !important; }
          #printTarget[data-compact="4"] .p-4 { padding: 8px !important; }
          #printTarget[data-compact="4"] .space-y-8 > :not([hidden]) ~ :not([hidden]) { margin-top: 8px !important; }
          #printTarget[data-compact="4"] .space-y-6 > :not([hidden]) ~ :not([hidden]) { margin-top: 7px !important; }
          #printTarget[data-compact="4"] .space-y-5 > :not([hidden]) ~ :not([hidden]) { margin-top: 6px !important; }
          #printTarget[data-compact="4"] .space-y-4 > :not([hidden]) ~ :not([hidden]) { margin-top: 5px !important; }
          #printTarget[data-compact="4"] .leading-relaxed { line-height: 1.18 !important; }
          #printTarget[data-compact="4"] .text-2xl { font-size: 17px !important; }
          #printTarget[data-compact="4"] .text-xl { font-size: 15px !important; }
          #printTarget[data-compact="4"] .text-lg { font-size: 14px !important; }
          #printTarget[data-compact="4"] .text-sm { font-size: 11.5px !important; }
          #printTarget[data-compact="4"] .text-xs { font-size: 10.5px !important; }
        ` : `
          @page { size: letter; margin: 0 !important; }
          html, body {
            width: ${pageWidthPx}px;
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
            background: #fff !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          #printPage { position: relative; width: ${pageWidthPx}px; }
          #printTarget { position: relative; width: ${pageWidthPx}px; }

          ${isFill ? `
            /* Fill-page mode (B): remove gutters and let layout expand (reflow is expected) */
            #printTarget .mx-auto { margin-left: 0 !important; margin-right: 0 !important; }
            #printTarget .max-w-3xl,
            #printTarget .max-w-4xl,
            #printTarget .max-w-5xl,
            #printTarget .max-w-6xl,
            #printTarget .max-w-7xl { max-width: none !important; width: 100% !important; }
          ` : ''}
        `;

        const iframe = document.createElement('iframe');
        iframe.setAttribute('title', 'print-frame');
        // IMPORTANT: keep a real viewport size so Tailwind responsive breakpoints (md:*) apply.
        // If iframe is 0x0, it renders in "mobile" layout → skinny column + huge whitespace.
        iframe.style.position = 'fixed';
        iframe.style.left = '-10000px';
        iframe.style.top = '0';
        // IMPORTANT:
        // - Exact mode (A): match your current on-screen wrapping by using the current viewport width.
        // - Other modes: use Letter viewport.
        iframe.style.width = `${isExact ? Math.max(1024, window.innerWidth) : pageWidthPx}px`;
        iframe.style.height = `${isExact ? Math.max(768, window.innerHeight) : pageHeightPx}px`;
        iframe.style.border = '0';
        iframe.style.opacity = '0';
        iframe.style.pointerEvents = 'none';
        document.body.appendChild(iframe);

        const doc = iframe.contentDocument;
        const win = iframe.contentWindow;
        if (!doc || !win) {
            try { document.body.removeChild(iframe); } catch (_) { /* ignore */ }
            throw new Error('Unable to create print frame');
        }

        doc.open();
        doc.write(`<!doctype html><html><head><meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>Resume PDF</title>
          ${stylesheetLinks.map(href => `<link rel="stylesheet" href="${href}">`).join('\n')}
          <style>${printCss}</style>
          ${inlineStyles.map(css => `<style>${css}</style>`).join('\n')}
        </head><body>
          <div id="printPage">
            <div id="printTarget"></div>
          </div>
        </body></html>`);
        doc.close();

        const mount = doc.getElementById('printTarget');
        if (mount) mount.appendChild(clone);

        function applyScaleAndCenter() {
            try {
                const target = doc!.getElementById('printTarget') as HTMLElement | null;
                const child = target?.firstElementChild as HTMLElement | null;
                if (!target || !child) return;

                // Reset scaling
                (child.style as any).zoom = '';
                child.style.transform = '';
                child.style.transformOrigin = '';

                if (isFill) {
                    // B: do not scale; let it reflow to fill the page width.
                    child.style.position = 'relative';
                    target.style.left = '0';
                    target.style.top = '0';
                    return;
                }

                if (isExact) {
                    // A: preserve on-screen wrapping by scaling to page width without re-laying out.
                    // Chrome supports `zoom` for print and it paginates more reliably than transforms.
                    const contentW = Math.max(1, child.scrollWidth || child.getBoundingClientRect().width);
                    const scaleW = pageWidthPx / contentW;
                    const safety = 0.995;
                    const scale = scaleW * safety;
                    (child.style as any).zoom = String(scale);
                    child.style.position = 'relative';
                    target.style.left = '0';
                    target.style.top = '0';
                    return;
                }

                // C: fit to one page with NO left/right padding:
                // 1) Always scale to fill the page width
                // 2) If that would overflow the page height, progressively compact (print-only) until it fits.
                const safety = 0.999;

                const computeForWidthFill = () => {
                    const contentW = Math.max(1, child.scrollWidth || child.getBoundingClientRect().width);
                    const contentH = Math.max(1, child.scrollHeight || child.getBoundingClientRect().height);
                    const scaleW = (pageWidthPx / contentW) * safety;
                    const usedH = contentH * scaleW;
                    return { contentW, contentH, scaleW, usedH };
                };

                target.dataset.compact = '0';
                child.style.position = 'absolute';
                child.style.left = '0';
                child.style.top = '0';
                child.style.transformOrigin = 'top left';

                let final = computeForWidthFill();
                if (final.usedH > pageHeightPx) {
                    for (const level of ['1', '2', '3', '4']) {
                        target.dataset.compact = level;
                        final = computeForWidthFill();
                        if (final.usedH <= pageHeightPx) break;
                    }
                }

                // Prefer: full-width (no left/right whitespace). If we're still too tall after max compaction,
                // apply a small vertical squeeze (non-uniform scale) to keep width filled.
                let scaleX = final.scaleW;
                let scaleY = final.scaleW;

                if (final.usedH > pageHeightPx) {
                    const squishY = pageHeightPx / Math.max(1, final.contentH * scaleX);
                    // Only allow mild squeeze; if we'd need too much, fall back to uniform height-fit.
                    if (squishY >= 0.90) {
                        scaleY = scaleX * squishY;
                    } else {
                        const scaleH = (pageHeightPx / Math.max(1, final.contentH)) * safety;
                        const uniform = Math.min(scaleX, scaleH);
                        scaleX = uniform;
                        scaleY = uniform;
                    }
                }

                child.style.transform = `scale(${scaleX}, ${scaleY})`;

                // Force the resume container to reach the bottom of the page (no bottom whitespace).
                const unscaledPageH = pageHeightPx / Math.max(0.0001, scaleY);
                child.style.height = `${unscaledPageH}px`;
                child.style.minHeight = `${unscaledPageH}px`;

                // Align to top-left (no centering padding)
                target.style.left = '0px';
                target.style.top = '0px';
            } catch (_) { /* ignore */ }
        }

        // Wait for styles/fonts to apply, then scale+center, then print.
        const startPrint = () => {
            applyScaleAndCenter();
            setTimeout(() => {
                try {
                    win.focus();
                    win.print();
                } finally {
                    setTimeout(() => {
                        try { document.body.removeChild(iframe); } catch (_) { /* ignore */ }
                    }, 1000);
                }
            }, 120);
        };

        try {
            // @ts-ignore
            if (doc.fonts && doc.fonts.ready) {
                // @ts-ignore
                doc.fonts.ready.then(startPrint).catch(startPrint);
            } else {
                setTimeout(startPrint, 350);
            }
        } catch (_) {
            setTimeout(startPrint, 350);
        }
    }

    async function downloadPdf() {
        if (downloadingPdf) return;
        setDownloadingPdf(true);
        try {
            const root = document.getElementById('templatePrintRoot');
            if (!root) {
                alert('Could not find the resume element to export.');
                return;
            }
            // Use isolated iframe print to preserve layout (avoids OKLCH parsing issues in html2canvas)
            await printElementViaHiddenIframe(root);
        } catch (e: any) {
            console.error('PDF export failed:', e);
            alert(`PDF export failed (${e?.message || 'unknown error'}).`);
        } finally {
            setTimeout(() => setDownloadingPdf(false), 300);
        }
    }

    async function downloadDocx() {
        if (downloadingDocx) return;
        if (!revisedResume) {
            alert('DOCX is not available yet. Please go back to Results and select a template again.');
            return;
        }
        setDownloadingDocx(true);
        try {
            // Prefer fetch+blob download (more reliable than full-page form navigation)
            const body = new URLSearchParams();
            body.set('resume', revisedResume);

            const res = await fetch('/download_resume_docx', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
                body,
                credentials: 'same-origin',
            });

            const ct = (res.headers.get('content-type') || '').toLowerCase();
            // If the session expired, this endpoint redirects to /login and we'll likely get HTML back.
            if (!res.ok || ct.includes('text/html')) {
                const next = `/react/template-viewer/${encodeURIComponent(templateName || 'modern')}`;
                window.location.href = `/login?next=${encodeURIComponent(next)}`;
                return;
            }

            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${templateName || 'resume'}.docx`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
        } catch (e) {
            alert('Download failed. Please try again.');
        } finally {
            setDownloadingDocx(false);
        }
    }

    useEffect(() => {
        console.log('TemplateViewer: Fetching template data...');
        let cancelled = false;

        const LS_KEY = 'templateViewer:lastTemplateData';

        function tryLoadFromLocalStorage(): { resume?: any; revised_resume?: string; template?: string } | null {
            try {
                const raw = localStorage.getItem(LS_KEY);
                if (!raw) return null;
                const parsed = JSON.parse(raw);
                if (!parsed || typeof parsed !== 'object') return null;
                return parsed;
            } catch (_) {
                return null;
            }
        }

        function saveToLocalStorage(payload: { resume: any; revised_resume?: string; template?: string }) {
            try {
                localStorage.setItem(LS_KEY, JSON.stringify(payload));
            } catch (_) {
                // ignore
            }
        }

        async function fetchJson(res: Response) {
            const ct = (res.headers.get('content-type') || '').toLowerCase();
            if (ct.includes('application/json')) return await res.json();
            // Fall back to text to preserve useful server error messages
            const t = await res.text();
            return { error: t };
        }

        async function load() {
            try {
                // 0) Instant fallback: if the user refreshes or deep-links, use cached data if available.
                // This avoids a "blank" screen when the Flask session was cleared.
                const cached = tryLoadFromLocalStorage();
                if (cached?.resume && typeof cached.resume === 'object' && Object.keys(cached.resume).length > 0) {
                    if (!cancelled) {
                        setResumeData(cached.resume);
                        if (typeof cached.revised_resume === 'string') setRevisedResume(cached.revised_resume);
                        // Keep loading=true until we attempt a server refresh below; this prevents a flash of error UI.
                    }
                }

                // 1) Try to load existing session template_data
                const res = await fetch(`/api/template-data?template=${encodeURIComponent(templateName || 'modern')}`, { credentials: 'same-origin' });
                console.log('TemplateViewer: Response status:', res.status);
                if (res.ok) {
                    const data = await res.json();
                    if (cancelled) return;
                    console.log('TemplateViewer: Received data:', data);
                    if (data.success) {
                        if (!data.resume || Object.keys(data.resume).length === 0) {
                            setError('Resume data is empty. The resume may not have been parsed correctly.');
                        } else {
                            setResumeData(data.resume);
                        }
                        if (typeof data.revised_resume === 'string') {
                            setRevisedResume(data.revised_resume);
                        }
                        // Cache for refresh/deep-link reliability
                        saveToLocalStorage({
                            resume: data.resume,
                            revised_resume: typeof data.revised_resume === 'string' ? data.revised_resume : '',
                            template: templateName || data.template,
                        });
                        setLoading(false);
                        return;
                    }
                    throw new Error(data.error || 'Failed to load resume data');
                }

                // 2) If missing, attempt to rebuild template_data from the session results (best-effort)
                // This fixes direct navigation/refresh to /react/template-viewer/:templateName.
                if (res.status === 404) {
                    const parseRes = await fetch('/api/parse-resume-for-template', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'same-origin',
                        body: JSON.stringify({ template: templateName || 'modern' }),
                    });
                    if (!parseRes.ok) {
                        const parseErr = await fetchJson(parseRes);
                        throw new Error(parseErr?.error || `Unable to prepare template data (HTTP ${parseRes.status}).`);
                    }

                    const res2 = await fetch(`/api/template-data?template=${encodeURIComponent(templateName || 'modern')}`, { credentials: 'same-origin' });
                    if (!res2.ok) {
                        const err2 = await fetchJson(res2);
                        throw new Error(err2?.error || `Error loading template data (HTTP ${res2.status}).`);
                    }
                    const data2 = await res2.json();
                    if (cancelled) return;
                    if (data2.success) {
                        if (!data2.resume || Object.keys(data2.resume).length === 0) {
                            setError('Resume data is empty. The resume may not have been parsed correctly.');
                        } else {
                            setResumeData(data2.resume);
                        }
                        if (typeof data2.revised_resume === 'string') {
                            setRevisedResume(data2.revised_resume);
                        }
                        saveToLocalStorage({
                            resume: data2.resume,
                            revised_resume: typeof data2.revised_resume === 'string' ? data2.revised_resume : '',
                            template: templateName || data2.template,
                        });
                        setLoading(false);
                        return;
                    }
                    throw new Error(data2.error || 'Failed to load resume data');
                }

                // Other non-OK statuses
                const err = await fetchJson(res);
                throw new Error(err?.error || `HTTP error! status: ${res.status}`);
            } catch (err: any) {
                console.error('TemplateViewer: Error loading template data:', err);
                if (!cancelled) {
                    // Last-chance: if we already have cached resume data, keep showing it instead of erroring out.
                    const cached = tryLoadFromLocalStorage();
                    if (cached?.resume && typeof cached.resume === 'object' && Object.keys(cached.resume).length > 0) {
                        setError(null);
                        setLoading(false);
                        return;
                    }
                    setError(`Error loading template data: ${err?.message || 'Please try again.'}`);
                    setLoading(false);
                }
            }
        }

        load();
        return () => { cancelled = true; };
    }, []);

    // NOTE: Hooks must run before any conditional returns. Keep query parsing + effects above
    // the early returns (loading/error/no data) to avoid production Hook-order crashes.
    const standalone = (() => {
        const sp = new URLSearchParams(location.search || '');
        const v = (sp.get('standalone') || '').toLowerCase().trim();
        return v === '1' || v === 'true' || v === 'yes';
    })();

    const autoPrint = (() => {
        const sp = new URLSearchParams(location.search || '');
        const v = (sp.get('autoprint') || sp.get('pdf') || '').toLowerCase().trim();
        return v === '1' || v === 'true' || v === 'yes';
    })();

    useEffect(() => {
        // In standalone mode, allow opening a "PDF tab" which auto-triggers the print dialog
        // (users can choose "Save as PDF" in the browser print destination).
        if (!standalone || !autoPrint) return;
        if (loading || error || !resumeData) return;
        if (autoPrintTriggeredRef.current) return;

        autoPrintTriggeredRef.current = true;
        const t = window.setTimeout(() => {
            // Best-effort: browsers may block print() without a user gesture; we show a fallback button below.
            downloadPdf().catch(() => { /* ignore */ });
        }, 350);

        return () => window.clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [standalone, autoPrint, loading, error, resumeData]);

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-100 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading template...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
                <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
                    <div className="text-red-500 text-5xl mb-4">⚠️</div>
                    <h2 className="text-xl font-bold text-gray-800 mb-2">Error</h2>
                    <p className="text-gray-600 mb-6">{error}</p>
                    <button
                        onClick={() => window.location.href = '/results'}
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        Go Back
                    </button>
                </div>
            </div>
        );
    }

    if (!resumeData) {
        return (
            <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
                <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
                    <h2 className="text-xl font-bold text-gray-800 mb-2">No Resume Data</h2>
                    <p className="text-gray-600 mb-6">No resume data found. Please submit a resume first.</p>
                    <button
                        onClick={() => window.location.href = '/'}
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        Go Home
                    </button>
                </div>
            </div>
        );
    }

    // Convert structured data to JSON string for templates
    // The templates expect a JSON string that parseResumeContent can parse
    const content = JSON.stringify(resumeData);
    console.log('TemplateViewer: Content being passed to template:', content.substring(0, 200) + '...');

    // Render appropriate template based on templateName
    let TemplateComponent;
    switch (templateName) {
        case 'modern':
            TemplateComponent = ModernTemplate;
            break;
        case 'professional':
            TemplateComponent = ProfessionalTemplate;
            break;
        case 'minimal':
            TemplateComponent = MinimalTemplate;
            break;
        case 'creative':
            TemplateComponent = CreativeTemplate;
            break;
        default:
            return (
                <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
                    <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
                        <h2 className="text-xl font-bold text-gray-800 mb-2">Template Not Found</h2>
                        <p className="text-gray-600 mb-6">The template "{templateName}" does not exist.</p>
                        <button
                            onClick={() => window.location.href = '/results'}
                            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                            Go Back
                        </button>
                    </div>
                </div>
            );
    }

    if (standalone) {
        return (
            <div className="min-h-screen bg-white">
                {autoPrint && (
                    <div className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-gray-200">
                        <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between gap-3">
                            <div className="text-sm text-gray-700">
                                PDF view: if the print dialog didn’t open automatically, click “Open print dialog”.
                            </div>
                            <button
                                onClick={downloadPdf}
                                disabled={downloadingPdf}
                                className={`px-3 py-2 rounded-lg bg-white border border-gray-200 text-gray-800 hover:bg-gray-50 transition-colors ${downloadingPdf ? 'opacity-60 cursor-not-allowed' : ''}`}
                            >
                                {downloadingPdf ? 'Opening…' : 'Open print dialog'}
                            </button>
                        </div>
                    </div>
                )}
                <div id="templatePrintRoot">
                    <TemplateComponent content={content} />
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-100 py-8 px-4">
            <div className="max-w-7xl mx-auto">
                {/* Header with back button and template name */}
                <div id="templateViewerHeader" className="mb-6 flex items-center justify-between">
                    <button
                        onClick={() => window.location.href = '/results'}
                        className="flex items-center text-gray-600 hover:text-gray-800 transition-colors"
                    >
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                        Back to Results
                    </button>
                    <h1 className="text-2xl font-bold text-gray-800 capitalize">{templateName} Template</h1>
                    <div className="flex items-center gap-2">
                        <a
                            href={`/react/template-viewer/${encodeURIComponent(templateName || 'modern')}?standalone=1`}
                            target="_blank"
                            rel="noreferrer"
                            className="px-3 py-2 rounded-lg bg-white border border-gray-200 text-gray-800 hover:bg-gray-50 transition-colors"
                            title="Open the resume in a new tab (standalone view)"
                        >
                            Open in new tab
                        </a>
                        <a
                            href={`/api/template-pdf/${encodeURIComponent(templateName || 'modern')}.pdf`}
                            target="_blank"
                            rel="noreferrer"
                            className="px-3 py-2 rounded-lg bg-white border border-gray-200 text-gray-800 hover:bg-gray-50 transition-colors"
                            title="Open an inline PDF of your resume in a new tab"
                        >
                            View PDF
                        </a>
                        <span className="hidden sm:inline-flex items-center gap-2 text-sm text-gray-600 mr-2">
                            PDF mode: Fit to 1 page (C)
                        </span>
                        <button
                            onClick={downloadPdf}
                            disabled={downloadingPdf}
                            className={`px-3 py-2 rounded-lg bg-white border border-gray-200 text-gray-800 hover:bg-gray-50 transition-colors ${downloadingPdf ? 'opacity-60 cursor-not-allowed' : ''}`}
                        >
                            {downloadingPdf ? 'Opening…' : 'Save as PDF'}
                        </button>
                        <button
                            onClick={downloadDocx}
                            disabled={!revisedResume || downloadingDocx}
                            className={`px-3 py-2 rounded-lg text-white transition-colors ${(revisedResume && !downloadingDocx) ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-300 cursor-not-allowed'}`}
                        >
                            {downloadingDocx ? 'Preparing…' : 'Download DOCX'}
                        </button>
                    </div>
                </div>

                {/* Template Component */}
                <div id="templatePrintRoot">
                    <TemplateComponent content={content} />
                </div>
            </div>
        </div>
    );
}

