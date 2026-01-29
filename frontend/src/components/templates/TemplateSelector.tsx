import React from 'react';
import { Check } from 'lucide-react';

export default function TemplateSelector({ selectedTemplate, onSelect }) {
    const templates = [
        {
            id: 'modern',
            name: 'Modern',
            description: 'Clean and contemporary design with accent colors',
            preview: (
                <div className="bg-white p-4 rounded-lg border border-slate-200 h-32">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-teal-500" />
                        <div className="space-y-1">
                            <div className="h-2 bg-slate-800 rounded w-16" />
                            <div className="h-1.5 bg-slate-400 rounded w-12" />
                        </div>
                    </div>
                    <div className="space-y-1 mt-3">
                        <div className="h-1.5 bg-blue-200 rounded w-full" />
                        <div className="h-1.5 bg-slate-200 rounded w-3/4" />
                        <div className="h-1.5 bg-slate-200 rounded w-5/6" />
                    </div>
                </div>
            )
        },
        {
            id: 'professional',
            name: 'Professional',
            description: 'Traditional layout perfect for corporate roles',
            preview: (
                <div className="bg-white p-4 rounded-lg border border-slate-300 h-32">
                    <div className="border-b-2 border-slate-800 pb-2 mb-2">
                        <div className="h-2.5 bg-slate-800 rounded w-20 mb-1" />
                        <div className="h-1.5 bg-slate-600 rounded w-16" />
                    </div>
                    <div className="space-y-1.5">
                        <div className="h-1.5 bg-slate-300 rounded w-full" />
                        <div className="h-1.5 bg-slate-300 rounded w-4/5" />
                        <div className="h-1.5 bg-slate-300 rounded w-3/4" />
                    </div>
                </div>
            )
        },
        {
            id: 'minimal',
            name: 'Minimal',
            description: 'Simple and elegant with maximum whitespace',
            preview: (
                <div className="bg-white p-4 rounded-lg border border-slate-100 h-32">
                    <div className="text-center mb-3">
                        <div className="h-2 bg-slate-700 rounded w-16 mx-auto mb-1" />
                        <div className="h-1 bg-slate-400 rounded w-12 mx-auto" />
                    </div>
                    <div className="space-y-2">
                        <div className="h-1 bg-slate-200 rounded w-full" />
                        <div className="h-1 bg-slate-200 rounded w-5/6 mx-auto" />
                    </div>
                </div>
            )
        },
        {
            id: 'creative',
            name: 'Creative',
            description: 'Bold design for creative and design roles',
            preview: (
                <div className="bg-gradient-to-br from-purple-50 to-pink-50 p-4 rounded-lg border border-purple-200 h-32">
                    <div className="flex gap-2 mb-2">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500" />
                        <div className="space-y-1">
                            <div className="h-2 bg-purple-600 rounded w-16" />
                            <div className="h-1.5 bg-purple-400 rounded w-12" />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-1 mt-2">
                        <div className="h-1.5 bg-purple-200 rounded" />
                        <div className="h-1.5 bg-pink-200 rounded" />
                        <div className="h-1.5 bg-purple-300 rounded" />
                        <div className="h-1.5 bg-pink-300 rounded" />
                    </div>
                </div>
            )
        },
        {
            id: 'timelineBlue',
            name: 'Timeline Blue',
            description: 'Blue header with vertical timeline and section labels',
            preview: (
                <div className="bg-white p-4 rounded-lg border border-slate-200 h-32 overflow-hidden">
                    <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full border border-slate-300 text-slate-700 grid place-items-center text-xs font-semibold">
                            JC
                        </div>
                        <div className="h-2 bg-sky-300 rounded w-20" />
                    </div>
                    <div className="mt-3 grid grid-cols-12 gap-2 h-[76px]">
                        <div className="col-span-4 space-y-2">
                            <div className="h-1.5 bg-sky-200 rounded w-10" />
                            <div className="h-1.5 bg-sky-200 rounded w-8" />
                            <div className="h-1.5 bg-sky-200 rounded w-9" />
                        </div>
                        <div className="col-span-1 relative">
                            <div className="absolute left-1/2 top-0 bottom-0 w-px bg-slate-200 -translate-x-1/2" />
                            <div className="absolute left-1/2 top-1 w-2 h-2 rounded-full bg-white border-2 border-slate-300 -translate-x-1/2" />
                        </div>
                        <div className="col-span-7 space-y-2">
                            <div className="h-1.5 bg-slate-200 rounded w-full" />
                            <div className="h-1.5 bg-slate-200 rounded w-5/6" />
                            <div className="h-1.5 bg-slate-200 rounded w-2/3" />
                        </div>
                    </div>
                </div>
            )
        },
    ];

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.map((template) => (
                <div
                    key={template.id}
                    className={`cursor-pointer transition-all duration-200 hover:shadow-md ${selectedTemplate === template.id
                        ? 'ring-2 ring-blue-500 shadow-md'
                        : 'hover:shadow-sm'
                        }`}
                    onClick={() => onSelect(template.id)}
                >
                    <div className="p-4">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="font-semibold text-slate-800">{template.name}</h3>
                            {selectedTemplate === template.id && (
                                <Check className="w-5 h-5 text-blue-500" />
                            )}
                        </div>
                        <p className="text-sm text-slate-600 mb-3">{template.description}</p>
                        {template.preview}
                    </div>
                </div>
            ))}
        </div>
    );
}
