import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import ModernTemplate from '../components/templates/ModernTemplate';
import ProfessionalTemplate from '../components/templates/ProfessionalTemplate';
import MinimalTemplate from '../components/templates/MinimalTemplate';
import CreativeTemplate from '../components/templates/CreativeTemplate';
import ClassicSidebarTemplate from '../components/templates/ClassicSidebarTemplate';
import ClassicPortraitSidebarTemplate from '../components/templates/ClassicPortraitSidebarTemplate';
import DarkSidebarProgressTemplate from '../components/templates/DarkSidebarProgressTemplate';
import DarkSidebarTemplate from '../components/templates/DarkSidebarTemplate';
import NavyHeaderSidebarTemplate from '../components/templates/NavyHeaderSidebarTemplate';
import TimelineBlueTemplate from '../components/templates/TimelineBlueTemplate';
import OliveClassicTemplate from '../components/templates/OliveClassicTemplate';
import { UniversalEditableWrapper } from '../components/templates/UniversalEditableWrapper';
import { Type, AlignLeft, Rows, RotateCcw, Lightbulb, Edit3 } from 'lucide-react';

export default function TemplateViewer() {
    const { templateName } = useParams<{ templateName: string }>();
    const [resumeData, setResumeData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [downloadingPdf, setDownloadingPdf] = useState(false);
    const [me, setMe] = useState<{
        is_authenticated: boolean;
        is_paid: boolean;
        free_revision_limit: number;
        revisions_used: number;
    } | null>(null);
    const [styleSettings, setStyleSettings] = useState({
        fontScale: 1,
        paragraphGapPx: 0,
        spacingScale: 1,
    });
    const [pdfPreviewPageScale, setPdfPreviewPageScale] = useState(1);
    const [pdfPreviewContentScale, setPdfPreviewContentScale] = useState(1);
    const [pdfPreviewPages, setPdfPreviewPages] = useState(1);
    const [pdfPreviewLastPageHeightPx, setPdfPreviewLastPageHeightPx] = useState(1056);
    const [pdfPreviewSnapshotHtml, setPdfPreviewSnapshotHtml] = useState<string>('');
    const pdfPreviewContainerRef = useRef<HTMLDivElement | null>(null);
    const pdfPreviewMeasureInnerRef = useRef<HTMLDivElement | null>(null);

    const [editSaving, setEditSaving] = useState(false);
    const [editSaveError, setEditSaveError] = useState<string | null>(null);
    const [editSaveSuccess, setEditSaveSuccess] = useState(false);
    const [editingExperienceIndex, setEditingExperienceIndex] = useState<number | null>(null);

    // Inline editing mode
    const [inlineEditMode, setInlineEditMode] = useState(false);
    const [sectionOrder, setSectionOrder] = useState<string[]>([]);
    const [inlineEditChanges, setInlineEditChanges] = useState<any>({});

    // Debug logging
    useEffect(() => {
        console.log('TemplateViewer: inlineEditMode changed to:', inlineEditMode);
        console.log('TemplateViewer: sectionOrder:', sectionOrder);
    }, [inlineEditMode, sectionOrder]);

    console.log('TemplateViewer: Template name:', templateName);

    useEffect(() => {
        fetch('/api/me', { credentials: 'same-origin' })
            .then(r => r.json())
            .then(data => setMe(data))
            .catch(() => setMe({ is_authenticated: false, is_paid: false, free_revision_limit: 2, revisions_used: 0 }));
    }, []);

    async function printElementViaHiddenIframe(el: HTMLElement) {
        // Popup-free export: print dialog using an isolated iframe (no popup), prints only the resume DOM.
        // We render into a fixed Letter canvas with @page margin 0, but add a controlled "print padding"
        // so the PDF matches the on-page HTML spacing.
        const stylesheetLinks = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
            .map(l => (l as HTMLLinkElement).href)
            .filter(Boolean);
        const inlineStyles = Array.from(document.querySelectorAll('style')).map(s => s.innerHTML || '');

        const clone = el.cloneNode(true) as HTMLElement;

        // CSS px are 96 per inch. Letter = 8.5in x 11in.
        const pageWidthPx = 816;
        const pageHeightPx = 1056;
        // True edge-to-edge PDF: do not add additional "page padding" in the print iframe.
        // (Templates can still have their own internal padding like p-8, which we preserve.)
        const printPadPx = 0;
        const availW = pageWidthPx - (printPadPx * 2);
        const availH = pageHeightPx - (printPadPx * 2);

        const isOnePage = false;

        const printCss = `
          @page { size: letter; margin: 0 !important; }
          html, body {
            width: ${pageWidthPx}px;
            margin: 0 !important;
            padding: 0 !important;
            ${isOnePage ? `height: ${pageHeightPx}px; overflow: hidden !important;` : `height: auto; overflow: visible !important;`}
            background: #fff !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          #printPage {
            position: relative;
            width: ${pageWidthPx}px;
            ${isOnePage ? `height: ${pageHeightPx}px; overflow: hidden;` : `height: auto; overflow: visible;`}
          }
          #printTarget {
            position: ${isOnePage ? 'absolute' : 'relative'};
            top: 0; left: 0;
            width: ${pageWidthPx}px;
            ${isOnePage ? `height: ${pageHeightPx}px; overflow: hidden;` : `height: auto; overflow: visible;`}
            box-sizing: border-box !important;
            padding: ${printPadPx}px !important;
          }
          /* Fill the printable canvas edge-to-edge (strip outer "card" gutters like mx-auto/max-w-*) */
          #printTarget > * {
            width: ${availW}px !important;
            max-width: none !important;
            margin: 0 !important;
          }
          #printTarget .mx-auto { margin-left: 0 !important; margin-right: 0 !important; }
          #printTarget .max-w-3xl,
          #printTarget .max-w-4xl,
          #printTarget .max-w-5xl,
          #printTarget .max-w-6xl,
          #printTarget .max-w-7xl {
            max-width: none !important;
            width: 100% !important;
          }
          /* Remove template "card" shadows in the PDF output (they can appear as a gray line at the bottom) */
          #printTarget .shadow,
          #printTarget .shadow-sm,
          #printTarget .shadow-md,
          #printTarget .shadow-lg,
          #printTarget .shadow-xl,
          #printTarget .shadow-2xl {
            box-shadow: none !important;
          }
          /*
            CreativeTemplate relies on Tailwind's responsive md:* utilities to switch to a two-column layout.
            If the user prints with Chrome "Margins: Default", the effective print width can drop below the md breakpoint,
            causing the sidebar to stack above the main content in the PDF.
            Force the md layout unconditionally in the print iframe so the PDF matches the on-screen (desktop) layout.
          */
          #printTarget .md\\:flex-row { flex-direction: row !important; }
          #printTarget .md\\:flex-row > * { min-width: 0 !important; }
          #printTarget .md\\:w-\\[300px\\] { width: 300px !important; }
          #printTarget .md\\:flex-shrink-0 { flex-shrink: 0 !important; }

          /* Ensure TemplateViewer "Customize" styles apply inside the print iframe too */
          /* Paragraph gap: apply even when a template only renders single <p> blocks */
          #printTarget .tv-style-root p { margin: 0 0 var(--tv-paragraph-gap, 0px) 0 !important; }

          #printTarget .tv-style-root { font-size: calc(1rem * var(--tv-font-scale, 1)) !important; }
          #printTarget .tv-style-root .text-xs { font-size: calc(0.75rem * var(--tv-font-scale, 1)) !important; line-height: calc(1rem * var(--tv-font-scale, 1)) !important; }
          #printTarget .tv-style-root .text-sm { font-size: calc(0.875rem * var(--tv-font-scale, 1)) !important; line-height: calc(1.25rem * var(--tv-font-scale, 1)) !important; }
          #printTarget .tv-style-root .text-base { font-size: calc(1rem * var(--tv-font-scale, 1)) !important; line-height: calc(1.5rem * var(--tv-font-scale, 1)) !important; }
          #printTarget .tv-style-root .text-lg { font-size: calc(1.125rem * var(--tv-font-scale, 1)) !important; line-height: calc(1.75rem * var(--tv-font-scale, 1)) !important; }
          #printTarget .tv-style-root .text-xl { font-size: calc(1.25rem * var(--tv-font-scale, 1)) !important; line-height: calc(1.75rem * var(--tv-font-scale, 1)) !important; }
          #printTarget .tv-style-root .text-2xl { font-size: calc(1.5rem * var(--tv-font-scale, 1)) !important; line-height: calc(2rem * var(--tv-font-scale, 1)) !important; }
          #printTarget .tv-style-root .text-3xl { font-size: calc(1.875rem * var(--tv-font-scale, 1)) !important; line-height: calc(2.25rem * var(--tv-font-scale, 1)) !important; }
          #printTarget .tv-style-root .text-4xl { font-size: calc(2.25rem * var(--tv-font-scale, 1)) !important; line-height: calc(2.5rem * var(--tv-font-scale, 1)) !important; }
          #printTarget .tv-style-root .text-5xl { font-size: calc(3rem * var(--tv-font-scale, 1)) !important; line-height: 1 !important; }

          /* Also scale Tailwind "arbitrary" font sizes used by some templates (e.g. text-[11px]) */
          #printTarget .tv-style-root .text-\\[10px\\] { font-size: calc(10px * var(--tv-font-scale, 1)) !important; }
          #printTarget .tv-style-root .text-\\[11px\\] { font-size: calc(11px * var(--tv-font-scale, 1)) !important; }
          #printTarget .tv-style-root .text-\\[12px\\] { font-size: calc(12px * var(--tv-font-scale, 1)) !important; }
          #printTarget .tv-style-root .text-\\[13px\\] { font-size: calc(13px * var(--tv-font-scale, 1)) !important; }
          #printTarget .tv-style-root .text-\\[34px\\] { font-size: calc(34px * var(--tv-font-scale, 1)) !important; }
          #printTarget .tv-style-root .text-\\[38px\\] { font-size: calc(38px * var(--tv-font-scale, 1)) !important; }

          #printTarget .tv-style-root .space-y-10 > :not([hidden]) ~ :not([hidden]) { margin-top: calc(2.5rem * var(--tv-space-scale, 1)) !important; }
          #printTarget .tv-style-root .space-y-8  > :not([hidden]) ~ :not([hidden]) { margin-top: calc(2rem * var(--tv-space-scale, 1)) !important; }
          #printTarget .tv-style-root .space-y-6  > :not([hidden]) ~ :not([hidden]) { margin-top: calc(1.5rem * var(--tv-space-scale, 1)) !important; }
          #printTarget .tv-style-root .space-y-5  > :not([hidden]) ~ :not([hidden]) { margin-top: calc(1.25rem * var(--tv-space-scale, 1)) !important; }
          #printTarget .tv-style-root .space-y-4  > :not([hidden]) ~ :not([hidden]) { margin-top: calc(1rem * var(--tv-space-scale, 1)) !important; }
          #printTarget .tv-style-root .space-y-3  > :not([hidden]) ~ :not([hidden]) { margin-top: calc(0.75rem * var(--tv-space-scale, 1)) !important; }
          #printTarget .tv-style-root .space-y-2  > :not([hidden]) ~ :not([hidden]) { margin-top: calc(0.5rem * var(--tv-space-scale, 1)) !important; }

          #printTarget .tv-style-root .mb-12 { margin-bottom: calc(3rem * var(--tv-space-scale, 1)) !important; }
          #printTarget .tv-style-root .mb-10 { margin-bottom: calc(2.5rem * var(--tv-space-scale, 1)) !important; }
          #printTarget .tv-style-root .mb-8  { margin-bottom: calc(2rem * var(--tv-space-scale, 1)) !important; }
          #printTarget .tv-style-root .mb-6  { margin-bottom: calc(1.5rem * var(--tv-space-scale, 1)) !important; }
          #printTarget .tv-style-root .mb-5  { margin-bottom: calc(1.25rem * var(--tv-space-scale, 1)) !important; }
          #printTarget .tv-style-root .mb-4  { margin-bottom: calc(1rem * var(--tv-space-scale, 1)) !important; }
          #printTarget .tv-style-root .mb-3  { margin-bottom: calc(0.75rem * var(--tv-space-scale, 1)) !important; }
          #printTarget .tv-style-root .mb-2  { margin-bottom: calc(0.5rem * var(--tv-space-scale, 1)) !important; }
          #printTarget .tv-style-root .mb-1  { margin-bottom: calc(0.25rem * var(--tv-space-scale, 1)) !important; }

          #printTarget .tv-style-root .mt-12 { margin-top: calc(3rem * var(--tv-space-scale, 1)) !important; }
          #printTarget .tv-style-root .mt-10 { margin-top: calc(2.5rem * var(--tv-space-scale, 1)) !important; }
          #printTarget .tv-style-root .mt-8  { margin-top: calc(2rem * var(--tv-space-scale, 1)) !important; }
          #printTarget .tv-style-root .mt-6  { margin-top: calc(1.5rem * var(--tv-space-scale, 1)) !important; }
          #printTarget .tv-style-root .mt-5  { margin-top: calc(1.25rem * var(--tv-space-scale, 1)) !important; }
          #printTarget .tv-style-root .mt-4  { margin-top: calc(1rem * var(--tv-space-scale, 1)) !important; }
          #printTarget .tv-style-root .mt-3  { margin-top: calc(0.75rem * var(--tv-space-scale, 1)) !important; }
          #printTarget .tv-style-root .mt-2  { margin-top: calc(0.5rem * var(--tv-space-scale, 1)) !important; }
          #printTarget .tv-style-root .mt-1  { margin-top: calc(0.25rem * var(--tv-space-scale, 1)) !important; }

          #printTarget .tv-style-root .gap-8 { gap: calc(2rem * var(--tv-space-scale, 1)) !important; }
          #printTarget .tv-style-root .gap-6 { gap: calc(1.5rem * var(--tv-space-scale, 1)) !important; }
          #printTarget .tv-style-root .gap-5 { gap: calc(1.25rem * var(--tv-space-scale, 1)) !important; }
          #printTarget .tv-style-root .gap-4 { gap: calc(1rem * var(--tv-space-scale, 1)) !important; }
          #printTarget .tv-style-root .gap-3 { gap: calc(0.75rem * var(--tv-space-scale, 1)) !important; }
          #printTarget .tv-style-root .gap-2 { gap: calc(0.5rem * var(--tv-space-scale, 1)) !important; }

          /* Scale common padding-bottom utilities used by templates for section/item spacing */
          #printTarget .tv-style-root .pb-4 { padding-bottom: calc(1rem * var(--tv-space-scale, 1)) !important; }
          #printTarget .tv-style-root .pb-3 { padding-bottom: calc(0.75rem * var(--tv-space-scale, 1)) !important; }
          #printTarget .tv-style-root .pb-2 { padding-bottom: calc(0.5rem * var(--tv-space-scale, 1)) !important; }
          #printTarget .tv-style-root .pb-0 { padding-bottom: 0 !important; }
          /* Scaling (set by JS) */
          #printTarget[data-scale] > * { transform-origin: top left !important; }
        `;

        const iframe = document.createElement('iframe');
        iframe.setAttribute('title', 'print-frame');
        iframe.style.position = 'fixed';
        iframe.style.left = '-10000px';
        iframe.style.top = '0';
        // IMPORTANT: give the iframe a real viewport so Tailwind responsive breakpoints (md:*) apply.
        iframe.style.width = `${pageWidthPx}px`;
        iframe.style.height = `${pageHeightPx}px`;
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
          <div id="printPage"><div id="printTarget"></div></div>
        </body></html>`);
        doc.close();

        const mount = doc.getElementById('printTarget');
        if (mount) mount.appendChild(clone);

        setTimeout(() => {
            try {
                // Fill width edge-to-edge. Height is allowed to paginate naturally.
                const target = doc.getElementById('printTarget') as HTMLElement | null;
                const child = target?.firstElementChild as HTMLElement | null;
                if (target && child) {
                    // Ensure layout is up to date after CSS overrides.
                    const contentW = Math.max(1, child.scrollWidth || child.getBoundingClientRect().width);
                    const contentH = Math.max(1, child.scrollHeight || child.getBoundingClientRect().height);
                    const scaleW = availW / contentW;
                    const scaleH = availH / contentH;
                    // Never upscale; only shrink if needed to fit the padded page area.
                    const s = Math.min(1, scaleW);
                    target.dataset.scale = String(s);
                    child.style.transform = `scale(${s})`;
                }
                win.focus();
                win.print();
            } finally {
                setTimeout(() => {
                    try { document.body.removeChild(iframe); } catch (_) { /* ignore */ }
                }, 1000);
            }
        }, 400);
    }

    async function downloadPdf() {
        if (downloadingPdf) return;
        setDownloadingPdf(true);
        try {
            // Print the unscaled resume DOM (not the scaled mobile wrapper) so the PDF export logic stays deterministic.
            const root =
                document.getElementById('templatePrintContent') ||
                pdfPreviewMeasureInnerRef.current ||
                document.getElementById('templatePrintRoot');
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

    const loadTemplateData = React.useCallback(async () => {
        console.log('TemplateViewer: Fetching template data...');
        try {
            const res = await fetch('/api/template-data');
            console.log('TemplateViewer: Response status:', res.status);
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || `HTTP error! status: ${res.status}`);
            }
            const data = await res.json();
            console.log('TemplateViewer: Received data:', data);
            console.log('TemplateViewer: Resume data type:', typeof data.resume);
            console.log('TemplateViewer: Resume data:', JSON.stringify(data.resume, null, 2));
            if (data.success) {
                if (!data.resume || Object.keys(data.resume).length === 0) {
                    setError('Resume data is empty. The resume may not have been parsed correctly.');
                } else {
                    setResumeData(data.resume);
                }
            } else {
                setError(data.error || 'Failed to load resume data');
            }
        } catch (err: any) {
            console.error('TemplateViewer: Error loading template data:', err);
            setError(`Error loading template data: ${err?.message || 'Please try again.'}`);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadTemplateData();
    }, [loadTemplateData]);

    async function saveEditedResume() {
        if (!resumeData) return;
        setEditSaving(true);
        setEditSaveError(null);
        setEditSaveSuccess(false);
        try {
            const res = await fetch('/api/template-data', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'same-origin',
                body: JSON.stringify({ resume: resumeData }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data?.success) {
                throw new Error(data?.error || `Failed to save (HTTP ${res.status})`);
            }
            setEditSaveSuccess(true);
            window.setTimeout(() => setEditSaveSuccess(false), 2000);
        } catch (e: any) {
            setEditSaveError(e?.message || 'Failed to save changes.');
        } finally {
            setEditSaving(false);
        }
    }

    const setField = (key: string, value: any) => {
        setResumeData((prev: any) => ({ ...(prev || {}), [key]: value }));
    };

    const normalizeList = (v: any): string[] => {
        if (!v) return [];
        if (Array.isArray(v)) return v.map((x) => String(x ?? '').trim()).filter(Boolean);
        return String(v)
            .split(/\n|,|•/g)
            .map((s) => s.trim())
            .filter(Boolean);
    };

    const experienceList: any[] = Array.isArray(resumeData?.experience) ? resumeData.experience : [];
    const updateExperienceDescription = (idx: number, nextDescription: string) => {
        setResumeData((prev: any) => {
            const prevExp: any[] = Array.isArray(prev?.experience) ? prev.experience : [];
            const nextExp = prevExp.map((e, i) => (i === idx ? { ...(e || {}), description: nextDescription } : e));
            return { ...(prev || {}), experience: nextExp };
        });
    };

    // Always default customization settings on page load / template change.
    // (No persistence via cookies/localStorage.)
    useEffect(() => {
        setStyleSettings({ fontScale: 1, paragraphGapPx: 0, spacingScale: 1 });
    }, [templateName]);

    // PDF preview sizing:
    // - "Page scale" fits the Letter page into the preview area visually
    // - "Content scale" matches the Save-as-PDF fit logic (width-fit)
    useEffect(() => {
        const PAGE_W = 816;
        const PAGE_H = 1056;
        const container = pdfPreviewContainerRef.current;
        const inner = pdfPreviewMeasureInnerRef.current;
        if (!container || !inner) return;

        const compute = () => {
            // Account for the preview container padding (p-4 => 16px on each side)
            const containerW = Math.max(1, container.clientWidth - 32);
            // Measure unscaled template content and compute the same shrink-to-fit as the print iframe
            const contentW = Math.max(1, inner.scrollWidth || inner.getBoundingClientRect().width);
            const contentH = Math.max(1, inner.scrollHeight || inner.getBoundingClientRect().height);
            const scaleW = PAGE_W / contentW;
            const scaleH = PAGE_H / contentH;
            const s = Math.min(1, scaleW);
            setPdfPreviewContentScale(s);

            const scaledH = contentH * s;
            // Page count: avoid false "extra page" due to tiny rounding / measurement noise.
            const EPS_PX = 2; // tolerate a couple pixels of measurement jitter
            const pages =
                scaledH <= (PAGE_H + EPS_PX)
                    ? 1
                    : Math.max(1, Math.ceil((scaledH - EPS_PX) / PAGE_H));
            setPdfPreviewPages(pages);

            // Prefer filling available width. If there are exactly 2 pages, scale so both pages can sit side-by-side.
            const twoUpGapPx = 24; // matches Tailwind gap-6 (1.5rem)
            const totalW = pages === 2 ? ((PAGE_W * 2) + twoUpGapPx) : PAGE_W;
            // Add a tiny safety margin to avoid accidental horizontal scroll due to rounding/subpixel layout.
            const pageScale = Math.min(1, (containerW / totalW) * 0.995);
            setPdfPreviewPageScale(pageScale);

            // Shrink the last "page frame" to the actual remaining content height to avoid a trailing bottom edge/shadow line.
            // Keep full-height pages for intermediate pages.
            const pagesForHeight = Math.max(1, Math.ceil(scaledH / PAGE_H));
            const remainder = Math.max(1, scaledH - (pagesForHeight - 1) * PAGE_H);
            setPdfPreviewLastPageHeightPx(Math.min(PAGE_H, Math.ceil(remainder)));

            // Snapshot the rendered resume HTML so we can "window" it across multiple pages without re-rendering N times.
            // But skip snapshot in edit mode so we see live updates
            if (!inlineEditMode) {
                try {
                    setPdfPreviewSnapshotHtml(inner.outerHTML || '');
                } catch {
                    setPdfPreviewSnapshotHtml('');
                }
            } else {
                setPdfPreviewSnapshotHtml('');
            }
        };

        compute();
        const t1 = window.setTimeout(compute, 0);
        const t2 = window.setTimeout(compute, 250);

        let ro: ResizeObserver | null = null;
        if (typeof ResizeObserver !== 'undefined') {
            ro = new ResizeObserver(() => compute());
            ro.observe(container);
        } else {
            window.addEventListener('resize', compute);
        }

        return () => {
            window.clearTimeout(t1);
            window.clearTimeout(t2);
            if (ro) ro.disconnect();
            else window.removeEventListener('resize', compute);
        };
    }, [templateName, resumeData, styleSettings, inlineEditMode]);

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
        case 'classicSidebar':
        case 'classic-sidebar':
        case 'classic_sidebar':
            TemplateComponent = ClassicSidebarTemplate;
            break;
        case 'classicPortrait':
        case 'classic-portrait':
        case 'classic_portrait':
            TemplateComponent = ClassicPortraitSidebarTemplate;
            break;
        case 'darkSidebar':
        case 'dark-sidebar':
        case 'dark_sidebar':
            TemplateComponent = DarkSidebarTemplate;
            break;
        case 'darkSidebarProgress':
        case 'dark-sidebar-progress':
        case 'dark_sidebar_progress':
            TemplateComponent = DarkSidebarProgressTemplate;
            break;
        case 'navyHeader':
        case 'navy-header':
        case 'navy_header':
            TemplateComponent = NavyHeaderSidebarTemplate;
            break;
        case 'timelineBlue':
        case 'timeline-blue':
        case 'timeline_blue':
            TemplateComponent = TimelineBlueTemplate;
            break;
        case 'oliveClassic':
        case 'olive-classic':
        case 'olive_classic':
            TemplateComponent = OliveClassicTemplate;
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

    return (
        <div className="min-h-screen bg-gray-100 py-8 px-4">
            <div className="max-w-7xl mx-auto">
                <style>{`
                  /* Mobile should match desktop: make key md:* utilities behave like desktop even on small viewports. */
                  #templatePrintRoot .md\\:flex-row { flex-direction: row !important; }
                  #templatePrintRoot .md\\:w-\\[300px\\] { width: 300px !important; }
                  #templatePrintRoot .md\\:flex-shrink-0 { flex-shrink: 0 !important; }
                  #templatePrintRoot .md\\:text-base { font-size: 1rem !important; line-height: 1.5rem !important; }
                  #templatePrintRoot .md\\:grid-cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; }

                  /* Resume customization: apply only inside the resume root */
                  /* Paragraph gap: apply even when a template only renders single <p> blocks */
                  #templatePrintRoot .tv-style-root p { margin: 0 0 var(--tv-paragraph-gap, 0px) 0 !important; }

                  /* Font scaling: override Tailwind text-* utilities to scale font sizes (causes reflow, not zoom). */
                  #templatePrintRoot .tv-style-root { font-size: calc(1rem * var(--tv-font-scale, 1)) !important; }
                  #templatePrintRoot .tv-style-root .text-xs { font-size: calc(0.75rem * var(--tv-font-scale, 1)) !important; line-height: calc(1rem * var(--tv-font-scale, 1)) !important; }
                  #templatePrintRoot .tv-style-root .text-sm { font-size: calc(0.875rem * var(--tv-font-scale, 1)) !important; line-height: calc(1.25rem * var(--tv-font-scale, 1)) !important; }
                  #templatePrintRoot .tv-style-root .text-base { font-size: calc(1rem * var(--tv-font-scale, 1)) !important; line-height: calc(1.5rem * var(--tv-font-scale, 1)) !important; }
                  #templatePrintRoot .tv-style-root .text-lg { font-size: calc(1.125rem * var(--tv-font-scale, 1)) !important; line-height: calc(1.75rem * var(--tv-font-scale, 1)) !important; }
                  #templatePrintRoot .tv-style-root .text-xl { font-size: calc(1.25rem * var(--tv-font-scale, 1)) !important; line-height: calc(1.75rem * var(--tv-font-scale, 1)) !important; }
                  #templatePrintRoot .tv-style-root .text-2xl { font-size: calc(1.5rem * var(--tv-font-scale, 1)) !important; line-height: calc(2rem * var(--tv-font-scale, 1)) !important; }
                  #templatePrintRoot .tv-style-root .text-3xl { font-size: calc(1.875rem * var(--tv-font-scale, 1)) !important; line-height: calc(2.25rem * var(--tv-font-scale, 1)) !important; }
                  #templatePrintRoot .tv-style-root .text-4xl { font-size: calc(2.25rem * var(--tv-font-scale, 1)) !important; line-height: calc(2.5rem * var(--tv-font-scale, 1)) !important; }
                  #templatePrintRoot .tv-style-root .text-5xl { font-size: calc(3rem * var(--tv-font-scale, 1)) !important; line-height: 1 !important; }

                  /* Also scale Tailwind "arbitrary" font sizes used by some templates (e.g. text-[11px]) */
                  #templatePrintRoot .tv-style-root .text-\\[10px\\] { font-size: calc(10px * var(--tv-font-scale, 1)) !important; }
                  #templatePrintRoot .tv-style-root .text-\\[11px\\] { font-size: calc(11px * var(--tv-font-scale, 1)) !important; }
                  #templatePrintRoot .tv-style-root .text-\\[12px\\] { font-size: calc(12px * var(--tv-font-scale, 1)) !important; }
                  #templatePrintRoot .tv-style-root .text-\\[13px\\] { font-size: calc(13px * var(--tv-font-scale, 1)) !important; }
                  #templatePrintRoot .tv-style-root .text-\\[34px\\] { font-size: calc(34px * var(--tv-font-scale, 1)) !important; }
                  #templatePrintRoot .tv-style-root .text-\\[38px\\] { font-size: calc(38px * var(--tv-font-scale, 1)) !important; }

                  /* Scale Tailwind space-y-* gaps with a single multiplier */
                  #templatePrintRoot .tv-style-root .space-y-10 > :not([hidden]) ~ :not([hidden]) { margin-top: calc(2.5rem * var(--tv-space-scale, 1)) !important; }
                  #templatePrintRoot .tv-style-root .space-y-8  > :not([hidden]) ~ :not([hidden]) { margin-top: calc(2rem * var(--tv-space-scale, 1)) !important; }
                  #templatePrintRoot .tv-style-root .space-y-6  > :not([hidden]) ~ :not([hidden]) { margin-top: calc(1.5rem * var(--tv-space-scale, 1)) !important; }
                  #templatePrintRoot .tv-style-root .space-y-5  > :not([hidden]) ~ :not([hidden]) { margin-top: calc(1.25rem * var(--tv-space-scale, 1)) !important; }
                  #templatePrintRoot .tv-style-root .space-y-4  > :not([hidden]) ~ :not([hidden]) { margin-top: calc(1rem * var(--tv-space-scale, 1)) !important; }
                  #templatePrintRoot .tv-style-root .space-y-3  > :not([hidden]) ~ :not([hidden]) { margin-top: calc(0.75rem * var(--tv-space-scale, 1)) !important; }
                  #templatePrintRoot .tv-style-root .space-y-2  > :not([hidden]) ~ :not([hidden]) { margin-top: calc(0.5rem * var(--tv-space-scale, 1)) !important; }

                  /* Also scale common Tailwind margin utilities used by templates for section separation */
                  #templatePrintRoot .tv-style-root .mb-12 { margin-bottom: calc(3rem * var(--tv-space-scale, 1)) !important; }
                  #templatePrintRoot .tv-style-root .mb-10 { margin-bottom: calc(2.5rem * var(--tv-space-scale, 1)) !important; }
                  #templatePrintRoot .tv-style-root .mb-8  { margin-bottom: calc(2rem * var(--tv-space-scale, 1)) !important; }
                  #templatePrintRoot .tv-style-root .mb-6  { margin-bottom: calc(1.5rem * var(--tv-space-scale, 1)) !important; }
                  #templatePrintRoot .tv-style-root .mb-5  { margin-bottom: calc(1.25rem * var(--tv-space-scale, 1)) !important; }
                  #templatePrintRoot .tv-style-root .mb-4  { margin-bottom: calc(1rem * var(--tv-space-scale, 1)) !important; }
                  #templatePrintRoot .tv-style-root .mb-3  { margin-bottom: calc(0.75rem * var(--tv-space-scale, 1)) !important; }
                  #templatePrintRoot .tv-style-root .mb-2  { margin-bottom: calc(0.5rem * var(--tv-space-scale, 1)) !important; }
                  #templatePrintRoot .tv-style-root .mb-1  { margin-bottom: calc(0.25rem * var(--tv-space-scale, 1)) !important; }

                  #templatePrintRoot .tv-style-root .mt-12 { margin-top: calc(3rem * var(--tv-space-scale, 1)) !important; }
                  #templatePrintRoot .tv-style-root .mt-10 { margin-top: calc(2.5rem * var(--tv-space-scale, 1)) !important; }
                  #templatePrintRoot .tv-style-root .mt-8  { margin-top: calc(2rem * var(--tv-space-scale, 1)) !important; }
                  #templatePrintRoot .tv-style-root .mt-6  { margin-top: calc(1.5rem * var(--tv-space-scale, 1)) !important; }
                  #templatePrintRoot .tv-style-root .mt-5  { margin-top: calc(1.25rem * var(--tv-space-scale, 1)) !important; }
                  #templatePrintRoot .tv-style-root .mt-4  { margin-top: calc(1rem * var(--tv-space-scale, 1)) !important; }
                  #templatePrintRoot .tv-style-root .mt-3  { margin-top: calc(0.75rem * var(--tv-space-scale, 1)) !important; }
                  #templatePrintRoot .tv-style-root .mt-2  { margin-top: calc(0.5rem * var(--tv-space-scale, 1)) !important; }
                  #templatePrintRoot .tv-style-root .mt-1  { margin-top: calc(0.25rem * var(--tv-space-scale, 1)) !important; }

                  /* Scale common flex/grid gaps too */
                  #templatePrintRoot .tv-style-root .gap-8 { gap: calc(2rem * var(--tv-space-scale, 1)) !important; }
                  #templatePrintRoot .tv-style-root .gap-6 { gap: calc(1.5rem * var(--tv-space-scale, 1)) !important; }
                  #templatePrintRoot .tv-style-root .gap-5 { gap: calc(1.25rem * var(--tv-space-scale, 1)) !important; }
                  #templatePrintRoot .tv-style-root .gap-4 { gap: calc(1rem * var(--tv-space-scale, 1)) !important; }
                  #templatePrintRoot .tv-style-root .gap-3 { gap: calc(0.75rem * var(--tv-space-scale, 1)) !important; }
                  #templatePrintRoot .tv-style-root .gap-2 { gap: calc(0.5rem * var(--tv-space-scale, 1)) !important; }

                  /* Scale common padding-bottom utilities used by templates for section/item spacing */
                  #templatePrintRoot .tv-style-root .pb-4 { padding-bottom: calc(1rem * var(--tv-space-scale, 1)) !important; }
                  #templatePrintRoot .tv-style-root .pb-3 { padding-bottom: calc(0.75rem * var(--tv-space-scale, 1)) !important; }
                  #templatePrintRoot .tv-style-root .pb-2 { padding-bottom: calc(0.5rem * var(--tv-space-scale, 1)) !important; }
                  #templatePrintRoot .tv-style-root .pb-0 { padding-bottom: 0 !important; }

                  /* PDF preview page styling (HTML-only simulation of the PDF) */
                  .pdfPreviewPage {
                    width: 816px;
                    min-height: var(--pdf-page-h, 1056px);
                    background: #fff;
                    position: relative;
                    overflow: visible;
                    box-shadow: 0 12px 30px rgba(0,0,0,0.12);
                  }
                  /* Remove the bottom "end-of-document" shadow line on the LAST page only */
                  .pdfPreviewPage:last-child {
                    box-shadow: none !important;
                  }
                  .pdfPreviewTarget {
                    position: relative;
                    top: 0;
                    left: 0;
                    width: 816px;
                    min-height: var(--pdf-page-h, 1056px);
                    overflow: visible;
                  }
                  /* Match the print iframe's outer-gutter stripping */
                  .pdfPreviewTarget > * {
                    width: 816px !important;
                    max-width: none !important;
                    margin: 0 !important;
                  }
                  .pdfPreviewTarget .mx-auto { margin-left: 0 !important; margin-right: 0 !important; }
                  .pdfPreviewTarget .max-w-3xl,
                  .pdfPreviewTarget .max-w-4xl,
                  .pdfPreviewTarget .max-w-5xl,
                  .pdfPreviewTarget .max-w-6xl,
                  .pdfPreviewTarget .max-w-7xl { max-width: none !important; width: 100% !important; }
                  .pdfPreviewTarget .md\\:flex-row { flex-direction: row !important; }
                  .pdfPreviewTarget .md\\:w-\\[300px\\] { width: 300px !important; }
                  .pdfPreviewTarget .md\\:flex-shrink-0 { flex-shrink: 0 !important; }

                  /* Apply Customize variables in the preview too */
                  .pdfPreviewTarget .tv-style-root p { margin: 0 0 var(--tv-paragraph-gap, 0px) 0 !important; }
                  .pdfPreviewTarget .tv-style-root { font-size: calc(1rem * var(--tv-font-scale, 1)) !important; }
                  .pdfPreviewTarget .tv-style-root .text-xs { font-size: calc(0.75rem * var(--tv-font-scale, 1)) !important; line-height: calc(1rem * var(--tv-font-scale, 1)) !important; }
                  .pdfPreviewTarget .tv-style-root .text-sm { font-size: calc(0.875rem * var(--tv-font-scale, 1)) !important; line-height: calc(1.25rem * var(--tv-font-scale, 1)) !important; }
                  .pdfPreviewTarget .tv-style-root .text-base { font-size: calc(1rem * var(--tv-font-scale, 1)) !important; line-height: calc(1.5rem * var(--tv-font-scale, 1)) !important; }
                  .pdfPreviewTarget .tv-style-root .text-lg { font-size: calc(1.125rem * var(--tv-font-scale, 1)) !important; line-height: calc(1.75rem * var(--tv-font-scale, 1)) !important; }
                  .pdfPreviewTarget .tv-style-root .text-xl { font-size: calc(1.25rem * var(--tv-font-scale, 1)) !important; line-height: calc(1.75rem * var(--tv-font-scale, 1)) !important; }
                  .pdfPreviewTarget .tv-style-root .text-2xl { font-size: calc(1.5rem * var(--tv-font-scale, 1)) !important; line-height: calc(2rem * var(--tv-font-scale, 1)) !important; }
                  .pdfPreviewTarget .tv-style-root .text-3xl { font-size: calc(1.875rem * var(--tv-font-scale, 1)) !important; line-height: calc(2.25rem * var(--tv-font-scale, 1)) !important; }
                  .pdfPreviewTarget .tv-style-root .text-4xl { font-size: calc(2.25rem * var(--tv-font-scale, 1)) !important; line-height: calc(2.5rem * var(--tv-font-scale, 1)) !important; }
                  .pdfPreviewTarget .tv-style-root .text-5xl { font-size: calc(3rem * var(--tv-font-scale, 1)) !important; line-height: 1 !important; }

                  /* Also scale Tailwind "arbitrary" font sizes used by some templates (e.g. text-[11px]) */
                  .pdfPreviewTarget .tv-style-root .text-\\[10px\\] { font-size: calc(10px * var(--tv-font-scale, 1)) !important; }
                  .pdfPreviewTarget .tv-style-root .text-\\[11px\\] { font-size: calc(11px * var(--tv-font-scale, 1)) !important; }
                  .pdfPreviewTarget .tv-style-root .text-\\[12px\\] { font-size: calc(12px * var(--tv-font-scale, 1)) !important; }
                  .pdfPreviewTarget .tv-style-root .text-\\[13px\\] { font-size: calc(13px * var(--tv-font-scale, 1)) !important; }
                  .pdfPreviewTarget .tv-style-root .text-\\[34px\\] { font-size: calc(34px * var(--tv-font-scale, 1)) !important; }
                  .pdfPreviewTarget .tv-style-root .text-\\[38px\\] { font-size: calc(38px * var(--tv-font-scale, 1)) !important; }

                  .pdfPreviewTarget .tv-style-root .space-y-10 > :not([hidden]) ~ :not([hidden]) { margin-top: calc(2.5rem * var(--tv-space-scale, 1)) !important; }
                  .pdfPreviewTarget .tv-style-root .space-y-8  > :not([hidden]) ~ :not([hidden]) { margin-top: calc(2rem * var(--tv-space-scale, 1)) !important; }
                  .pdfPreviewTarget .tv-style-root .space-y-6  > :not([hidden]) ~ :not([hidden]) { margin-top: calc(1.5rem * var(--tv-space-scale, 1)) !important; }
                  .pdfPreviewTarget .tv-style-root .space-y-5  > :not([hidden]) ~ :not([hidden]) { margin-top: calc(1.25rem * var(--tv-space-scale, 1)) !important; }
                  .pdfPreviewTarget .tv-style-root .space-y-4  > :not([hidden]) ~ :not([hidden]) { margin-top: calc(1rem * var(--tv-space-scale, 1)) !important; }
                  .pdfPreviewTarget .tv-style-root .space-y-3  > :not([hidden]) ~ :not([hidden]) { margin-top: calc(0.75rem * var(--tv-space-scale, 1)) !important; }
                  .pdfPreviewTarget .tv-style-root .space-y-2  > :not([hidden]) ~ :not([hidden]) { margin-top: calc(0.5rem * var(--tv-space-scale, 1)) !important; }

                  .pdfPreviewTarget .tv-style-root .mb-12 { margin-bottom: calc(3rem * var(--tv-space-scale, 1)) !important; }
                  .pdfPreviewTarget .tv-style-root .mb-10 { margin-bottom: calc(2.5rem * var(--tv-space-scale, 1)) !important; }
                  .pdfPreviewTarget .tv-style-root .mb-8  { margin-bottom: calc(2rem * var(--tv-space-scale, 1)) !important; }
                  .pdfPreviewTarget .tv-style-root .mb-6  { margin-bottom: calc(1.5rem * var(--tv-space-scale, 1)) !important; }
                  .pdfPreviewTarget .tv-style-root .mb-5  { margin-bottom: calc(1.25rem * var(--tv-space-scale, 1)) !important; }
                  .pdfPreviewTarget .tv-style-root .mb-4  { margin-bottom: calc(1rem * var(--tv-space-scale, 1)) !important; }
                  .pdfPreviewTarget .tv-style-root .mb-3  { margin-bottom: calc(0.75rem * var(--tv-space-scale, 1)) !important; }
                  .pdfPreviewTarget .tv-style-root .mb-2  { margin-bottom: calc(0.5rem * var(--tv-space-scale, 1)) !important; }
                  .pdfPreviewTarget .tv-style-root .mb-1  { margin-bottom: calc(0.25rem * var(--tv-space-scale, 1)) !important; }

                  .pdfPreviewTarget .tv-style-root .mt-12 { margin-top: calc(3rem * var(--tv-space-scale, 1)) !important; }
                  .pdfPreviewTarget .tv-style-root .mt-10 { margin-top: calc(2.5rem * var(--tv-space-scale, 1)) !important; }
                  .pdfPreviewTarget .tv-style-root .mt-8  { margin-top: calc(2rem * var(--tv-space-scale, 1)) !important; }
                  .pdfPreviewTarget .tv-style-root .mt-6  { margin-top: calc(1.5rem * var(--tv-space-scale, 1)) !important; }
                  .pdfPreviewTarget .tv-style-root .mt-5  { margin-top: calc(1.25rem * var(--tv-space-scale, 1)) !important; }
                  .pdfPreviewTarget .tv-style-root .mt-4  { margin-top: calc(1rem * var(--tv-space-scale, 1)) !important; }
                  .pdfPreviewTarget .tv-style-root .mt-3  { margin-top: calc(0.75rem * var(--tv-space-scale, 1)) !important; }
                  .pdfPreviewTarget .tv-style-root .mt-2  { margin-top: calc(0.5rem * var(--tv-space-scale, 1)) !important; }
                  .pdfPreviewTarget .tv-style-root .mt-1  { margin-top: calc(0.25rem * var(--tv-space-scale, 1)) !important; }

                  .pdfPreviewTarget .tv-style-root .gap-8 { gap: calc(2rem * var(--tv-space-scale, 1)) !important; }
                  .pdfPreviewTarget .tv-style-root .gap-6 { gap: calc(1.5rem * var(--tv-space-scale, 1)) !important; }
                  .pdfPreviewTarget .tv-style-root .gap-5 { gap: calc(1.25rem * var(--tv-space-scale, 1)) !important; }
                  .pdfPreviewTarget .tv-style-root .gap-4 { gap: calc(1rem * var(--tv-space-scale, 1)) !important; }
                  .pdfPreviewTarget .tv-style-root .gap-3 { gap: calc(0.75rem * var(--tv-space-scale, 1)) !important; }
                  .pdfPreviewTarget .tv-style-root .gap-2 { gap: calc(0.5rem * var(--tv-space-scale, 1)) !important; }

                  /* Scale common padding-bottom utilities used by templates for section/item spacing */
                  .pdfPreviewTarget .tv-style-root .pb-4 { padding-bottom: calc(1rem * var(--tv-space-scale, 1)) !important; }
                  .pdfPreviewTarget .tv-style-root .pb-3 { padding-bottom: calc(0.75rem * var(--tv-space-scale, 1)) !important; }
                  .pdfPreviewTarget .tv-style-root .pb-2 { padding-bottom: calc(0.5rem * var(--tv-space-scale, 1)) !important; }
                  .pdfPreviewTarget .tv-style-root .pb-0 { padding-bottom: 0 !important; }
                `}</style>
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
                        {/* Edit Mode now available for ALL templates */}
                        <button
                            onClick={() => setInlineEditMode(!inlineEditMode)}
                            className={`px-3 py-2 rounded-lg border transition-colors flex items-center gap-2 ${inlineEditMode
                                ? 'bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700'
                                : 'bg-white border-gray-200 text-gray-800 hover:bg-gray-50'
                                }`}
                        >
                            <Edit3 className="w-4 h-4" />
                            {inlineEditMode ? 'Exit Edit Mode' : 'Edit Mode'}
                        </button>
                        {inlineEditMode && Object.keys(inlineEditChanges).length > 0 && (
                            <button
                                onClick={() => {
                                    // Save inline edits
                                    setResumeData({ ...resumeData, ...inlineEditChanges });
                                    saveEditedResume();
                                    setInlineEditChanges({});
                                }}
                                className="px-3 py-2 rounded-lg bg-green-600 text-white border-green-600 hover:bg-green-700 transition-colors flex items-center gap-2"
                            >
                                Save Changes
                            </button>
                        )}
                        <button
                            onClick={() => {
                                if (downloadingPdf) return;
                                if (me?.is_paid) downloadPdf();
                                else window.location.href = '/plans';
                            }}
                            className={`px-3 py-2 rounded-lg bg-white border border-gray-200 text-gray-800 hover:bg-gray-50 transition-colors ${downloadingPdf ? 'opacity-60 cursor-not-allowed' : ''}`}
                            disabled={downloadingPdf}
                        >
                            Download PDF
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-6">
                    {/* Left settings panel */}
                    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden h-fit shadow-sm">
                        <div className="px-4 py-4 bg-gradient-to-r from-indigo-50 via-white to-emerald-50 border-b border-gray-100">
                            <div className="flex items-start">
                                <div className="flex-1">
                                    <div className="text-sm font-semibold text-gray-900">Tip: Aim for one page</div>
                                    <div className="mt-1 flex items-start gap-2 text-sm text-gray-700 leading-relaxed">
                                        <span className="mt-0.5 inline-flex items-center justify-center w-7 h-7 rounded-lg bg-sky-100 border border-sky-200 shrink-0 shadow-sm">
                                            <Lightbulb className="w-4.5 h-4.5 text-sky-700" />
                                        </span>
                                        <p>
                                            Most recruiters prefer a one‑page resume. Use the sliders below to adjust font size and spacing to fit cleanly.
                                        </p>
                                    </div>
                                    <div className="mt-2 inline-flex items-center gap-2 text-xs text-gray-500">
                                        <span className="inline-flex items-center px-2 py-1 rounded-full bg-gray-100 border border-gray-200">
                                            Preview: {pdfPreviewPages} page{pdfPreviewPages === 1 ? '' : 's'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="p-4">
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <h2 className="text-sm font-semibold text-gray-900">Settings</h2>
                                    <button
                                        className="inline-flex items-center gap-2 text-sm text-indigo-700 hover:text-indigo-800"
                                        onClick={() => setStyleSettings({ fontScale: 1, paragraphGapPx: 0, spacingScale: 1 })}
                                    >
                                        <RotateCcw className="w-4 h-4" />
                                        Reset
                                    </button>
                                </div>

                                <div className="space-y-4">
                                    <div className="rounded-xl border border-gray-200 bg-white p-3">
                                        <div className="flex items-center justify-between mb-2">
                                            <label className="text-xs font-semibold text-gray-800 flex items-center gap-2">
                                                <Type className="w-4 h-4 text-indigo-600" />
                                                Font size
                                            </label>
                                            <span className="text-xs text-gray-600">{Math.round(styleSettings.fontScale * 100)}%</span>
                                        </div>
                                        <input
                                            type="range"
                                            min={0.6}
                                            max={1.4}
                                            step={0.01}
                                            value={styleSettings.fontScale}
                                            onChange={(e) => setStyleSettings(s => ({ ...s, fontScale: Number(e.target.value) }))}
                                            className="w-full"
                                        />
                                    </div>

                                    <div className="rounded-xl border border-gray-200 bg-white p-3">
                                        <div className="flex items-center justify-between mb-2">
                                            <label className="text-xs font-semibold text-gray-800 flex items-center gap-2">
                                                <AlignLeft className="w-4 h-4 text-emerald-600" />
                                                Paragraph gap
                                            </label>
                                            <span className="text-xs text-gray-600">{styleSettings.paragraphGapPx}px</span>
                                        </div>
                                        <input
                                            type="range"
                                            min={-40}
                                            max={200}
                                            step={1}
                                            value={styleSettings.paragraphGapPx}
                                            onChange={(e) => setStyleSettings(s => ({ ...s, paragraphGapPx: Number(e.target.value) }))}
                                            className="w-full"
                                        />
                                    </div>

                                    <div className="rounded-xl border border-gray-200 bg-white p-3">
                                        <div className="flex items-center justify-between mb-2">
                                            <label className="text-xs font-semibold text-gray-800 flex items-center gap-2">
                                                <Rows className="w-4 h-4 text-purple-600" />
                                                Section spacing
                                            </label>
                                            <span className="text-xs text-gray-600">{Math.round(styleSettings.spacingScale * 100)}%</span>
                                        </div>
                                        <input
                                            type="range"
                                            min={0}
                                            max={5}
                                            step={0.01}
                                            value={styleSettings.spacingScale}
                                            onChange={(e) => setStyleSettings(s => ({ ...s, spacingScale: Number(e.target.value) }))}
                                            className="w-full"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Edit fields */}
                        <div className="px-4 pb-4">
                            <div className="rounded-2xl border border-gray-200 bg-white p-4">
                                <div className="flex items-center justify-between mb-3">
                                    <h2 className="text-sm font-semibold text-gray-900">Edit fields</h2>
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => loadTemplateData()}
                                            className="text-sm text-gray-600 hover:text-gray-800"
                                            disabled={editSaving}
                                        >
                                            Reset
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => saveEditedResume()}
                                            className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${editSaving
                                                ? 'bg-gray-100 text-gray-500 border-gray-200 cursor-not-allowed'
                                                : 'bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700'
                                                }`}
                                            disabled={editSaving}
                                        >
                                            {editSaving ? 'Saving…' : 'Save changes'}
                                        </button>
                                    </div>
                                </div>

                                {editSaveError && (
                                    <div className="mb-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-2">
                                        {editSaveError}
                                    </div>
                                )}
                                {editSaveSuccess && (
                                    <div className="mb-3 text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg p-2">
                                        Saved.
                                    </div>
                                )}

                                <div className="space-y-3">
                                    <Field label="Name">
                                        <input
                                            value={String(resumeData?.name ?? '')}
                                            onChange={(e) => setField('name', e.target.value)}
                                            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                                        />
                                    </Field>
                                    <Field label="Title">
                                        <input
                                            value={String(resumeData?.title ?? '')}
                                            onChange={(e) => setField('title', e.target.value)}
                                            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                                        />
                                    </Field>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <Field label="Email">
                                            <input
                                                value={String(resumeData?.email ?? '')}
                                                onChange={(e) => setField('email', e.target.value)}
                                                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                                            />
                                        </Field>
                                        <Field label="Phone">
                                            <input
                                                value={String(resumeData?.phone ?? '')}
                                                onChange={(e) => setField('phone', e.target.value)}
                                                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                                            />
                                        </Field>
                                    </div>
                                    <Field label="Location">
                                        <input
                                            value={String(resumeData?.location ?? '')}
                                            onChange={(e) => setField('location', e.target.value)}
                                            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                                        />
                                    </Field>
                                    <Field label="Professional summary">
                                        <textarea
                                            value={String(resumeData?.summary ?? '')}
                                            onChange={(e) => setField('summary', e.target.value)}
                                            rows={4}
                                            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                                        />
                                    </Field>

                                    <ListField
                                        label="Skills"
                                        values={normalizeList(resumeData?.skills)}
                                        onChange={(vals) => setField('skills', vals)}
                                    />
                                    <ListField
                                        label="Languages"
                                        values={normalizeList(resumeData?.languages)}
                                        onChange={(vals) => setField('languages', vals)}
                                    />

                                    {/* Work history: edit descriptions/bullets */}
                                    <div className="pt-1">
                                        <div className="flex items-center justify-between">
                                            <div className="text-xs font-semibold text-gray-700">Work history descriptions</div>
                                            {editingExperienceIndex !== null && (
                                                <button
                                                    type="button"
                                                    className="text-xs text-gray-600 hover:text-gray-800"
                                                    onClick={() => setEditingExperienceIndex(null)}
                                                >
                                                    Collapse
                                                </button>
                                            )}
                                        </div>

                                        {experienceList.length === 0 ? (
                                            <div className="mt-2 text-sm text-gray-500">No work history found in this resume.</div>
                                        ) : (
                                            <div className="mt-2 space-y-2">
                                                {experienceList.map((exp: any, idx: number) => {
                                                    const title = String(exp?.title || exp?.position || exp?.role || 'Role');
                                                    const company = String(exp?.company || exp?.organization || '');
                                                    const dates = String(exp?.duration || exp?.dates || [exp?.start, exp?.end].filter(Boolean).join(' - ') || '');
                                                    const isOpen = editingExperienceIndex === idx;
                                                    return (
                                                        <div key={idx} className="rounded-xl border border-gray-200 overflow-hidden">
                                                            <button
                                                                type="button"
                                                                onClick={() => setEditingExperienceIndex(isOpen ? null : idx)}
                                                                className="w-full px-3 py-2 bg-gray-50 hover:bg-gray-100 text-left flex items-start justify-between gap-3"
                                                            >
                                                                <div className="min-w-0">
                                                                    <div className="text-sm font-semibold text-gray-900 truncate">
                                                                        {title}
                                                                    </div>
                                                                    <div className="text-xs text-gray-600 truncate">
                                                                        {[company, dates].filter(Boolean).join(' · ')}
                                                                    </div>
                                                                </div>
                                                                <div className="text-xs text-indigo-700 shrink-0">
                                                                    {isOpen ? 'Hide' : 'Edit'}
                                                                </div>
                                                            </button>
                                                            {isOpen && (
                                                                <div className="p-3 bg-white">
                                                                    <label className="block">
                                                                        <div className="text-xs font-semibold text-gray-700 mb-1">
                                                                            Description / bullets
                                                                        </div>
                                                                        <textarea
                                                                            rows={6}
                                                                            value={String(exp?.description ?? '')}
                                                                            onChange={(e) => updateExperienceDescription(idx, e.target.value)}
                                                                            placeholder={"Use bullets like:\n- Did X\n- Improved Y\n- Shipped Z"}
                                                                            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                                                                        />
                                                                    </label>
                                                                    <div className="mt-2 text-xs text-gray-500">
                                                                        Tip: start lines with “- ” to render bullets.
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* PDF view */}
                    <div>
                        <div
                            ref={pdfPreviewContainerRef}
                            className="bg-gray-100 rounded-lg p-4"
                        >
                            {/* Hidden measurement render (used to compute pages + capture HTML snapshot) */}
                            <div style={{ position: 'absolute', left: '-100000px', top: 0, width: '816px', visibility: 'hidden' }}>
                                <div className="pdfPreviewPage">
                                    <div className="pdfPreviewTarget">
                                        <div
                                            ref={pdfPreviewMeasureInnerRef}
                                            className="tv-style-root"
                                            style={{
                                                // @ts-ignore
                                                ['--tv-paragraph-gap']: `${styleSettings.paragraphGapPx}px`,
                                                // @ts-ignore
                                                ['--tv-font-scale']: String(styleSettings.fontScale),
                                                // @ts-ignore
                                                ['--tv-space-scale']: String(styleSettings.spacingScale),
                                            }}
                                        >
                                            {/* Only pass edit mode props to supported templates */}
                                            {(templateName === 'modern' || templateName === 'timelineBlue' || templateName === 'timeline-blue' || templateName === 'timeline_blue') ? (
                                                <TemplateComponent
                                                    content={content}
                                                    editMode={false}
                                                    sectionOrder={sectionOrder}
                                                    onSectionOrderChange={setSectionOrder}
                                                    onContentChange={(changes: any) => setInlineEditChanges(changes)}
                                                />
                                            ) : (
                                                <TemplateComponent content={content} />
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {(() => {
                                const PAGE_W = 816;
                                const twoUpGapPx = 24;
                                const totalW = pdfPreviewPages === 2 ? ((PAGE_W * 2) + twoUpGapPx) : PAGE_W;
                                const scaledW = Math.max(1, Math.ceil(totalW * pdfPreviewPageScale));
                                return (
                                    <div style={{ width: `${scaledW}px`, margin: '0 auto' }}>
                                        <div style={{ transform: `scale(${pdfPreviewPageScale})`, transformOrigin: 'top left' }}>
                                            <div className={pdfPreviewPages === 2 ? 'grid grid-cols-[816px_816px] gap-6 items-start' : 'space-y-6'}>
                                                {Array.from({ length: pdfPreviewPages }).map((_, idx) => (
                                                    <div key={idx} className="space-y-8">
                                                        <div className="inline-flex items-center gap-2">
                                                            <div className="text-4xl leading-none font-serif font-semibold tracking-tight text-gray-900">
                                                                Page {idx + 1}
                                                            </div>
                                                            <div className="h-px flex-1 bg-gray-300/80" />
                                                        </div>
                                                        <div
                                                            className="pdfPreviewPage"
                                                            style={{
                                                                // Shrink only the last page frame to the remaining content height
                                                                // (removes trailing bottom edge/shadow line at end-of-document)
                                                                // @ts-ignore
                                                                ['--pdf-page-h']: `${(idx === pdfPreviewPages - 1) ? pdfPreviewLastPageHeightPx : 1056}px`,
                                                            }}
                                                        >
                                                            <div className="pdfPreviewTarget">
                                                                {inlineEditMode || !pdfPreviewSnapshotHtml ? (
                                                                    // In edit mode, render live template
                                                                    <div
                                                                        style={{
                                                                            transform: `translateY(-${idx * 1056}px) scale(${pdfPreviewContentScale})`,
                                                                            transformOrigin: 'top left',
                                                                        }}
                                                                    >
                                                                        <div
                                                                            className="tv-style-root"
                                                                            style={{
                                                                                // @ts-ignore
                                                                                ['--tv-paragraph-gap']: `${styleSettings.paragraphGapPx}px`,
                                                                                // @ts-ignore
                                                                                ['--tv-font-scale']: String(styleSettings.fontScale),
                                                                                // @ts-ignore
                                                                                ['--tv-space-scale']: String(styleSettings.spacingScale),
                                                                            }}
                                                                        >
                                                                            <UniversalEditableWrapper
                                                                                data={resumeData}
                                                                                editMode={inlineEditMode}
                                                                                onDataChange={(newData: any) => setInlineEditChanges(newData)}
                                                                            >
                                                                                {(templateName === 'modern' || templateName === 'timelineBlue' || templateName === 'timeline-blue' || templateName === 'timeline_blue') ? (
                                                                                    <TemplateComponent
                                                                                        content={content}
                                                                                        editMode={inlineEditMode}
                                                                                        sectionOrder={sectionOrder}
                                                                                        onSectionOrderChange={setSectionOrder}
                                                                                        onContentChange={(changes: any) => setInlineEditChanges(changes)}
                                                                                    />
                                                                                ) : (
                                                                                    <TemplateComponent content={content} />
                                                                                )}
                                                                            </UniversalEditableWrapper>
                                                                        </div>
                                                                    </div>
                                                                ) : (
                                                                    // In view mode, use snapshot
                                                                    <div
                                                                        style={{
                                                                            transform: `translateY(-${idx * 1056}px) scale(${pdfPreviewContentScale})`,
                                                                            transformOrigin: 'top left',
                                                                        }}
                                                                        // eslint-disable-next-line react/no-danger
                                                                        dangerouslySetInnerHTML={{ __html: pdfPreviewSnapshotHtml }}
                                                                    />
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <label className="block">
            <div className="text-xs font-semibold text-gray-700 mb-1">{label}</div>
            {children}
        </label>
    );
}

function ListField({
    label,
    values,
    onChange,
}: {
    label: string;
    values: string[];
    onChange: (vals: string[]) => void;
}) {
    const [draft, setDraft] = React.useState('');
    return (
        <div>
            <div className="flex items-center justify-between mb-1">
                <div className="text-xs font-semibold text-gray-700">{label}</div>
                <button
                    type="button"
                    className="text-xs text-indigo-700 hover:text-indigo-800"
                    onClick={() => {
                        const v = draft.trim();
                        if (!v) return;
                        onChange([...(values || []), v]);
                        setDraft('');
                    }}
                >
                    Add
                </button>
            </div>
            <div className="flex gap-2">
                <input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder={`Add ${label.toLowerCase()}…`}
                    className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm"
                />
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
                {(values || []).map((v, idx) => (
                    <span
                        key={`${v}-${idx}`}
                        className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-gray-100 border border-gray-200 text-sm text-gray-800"
                    >
                        {v}
                        <button
                            type="button"
                            className="text-gray-500 hover:text-gray-800"
                            onClick={() => onChange(values.filter((_, i) => i !== idx))}
                            aria-label={`Remove ${v}`}
                        >
                            ×
                        </button>
                    </span>
                ))}
            </div>
        </div>
    );
}

