import React from 'react';
import { Card } from "@/components/ui/card";
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
        }
    ];

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {templates.map((template) => (
                <Card
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
                </Card>
            ))}
        </div>
    );
}
