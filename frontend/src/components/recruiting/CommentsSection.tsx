import React, { useState } from 'react';
import { useComments, useAddComment } from '../../hooks/useRecruiting';
import { Button, Input } from '../ui-mocks';
import { Send, MessageSquare, Bot } from 'lucide-react';
import { formatDateTime } from '../../utils';
import { useSnapshot } from '../../context/SnapshotContext';

export const CommentsSection: React.FC<{ targetType: "vacancy" | "candidate", targetId: number }> = ({ targetType, targetId }) => {
    const { data: comments = [], isLoading } = useComments(targetType, targetId);
    const addComment = useAddComment();
    const { snapshotDate } = useSnapshot();
    const isHistorical = !!snapshotDate;
    const [content, setContent] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!content.trim() || isHistorical) return;

        addComment.mutate({
            target_type: targetType,
            target_id: targetId,
            content: content.trim()
        }, {
            onSuccess: () => setContent('')
        });
    };

    return (
        <div className="flex flex-col h-full bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center gap-2 bg-slate-50/50">
                <div className="p-2 bg-indigo-100 text-indigo-700 rounded-lg">
                    <MessageSquare className="w-5 h-5" />
                </div>
                <div>
                    <h3 className="font-bold text-slate-800">Комментарии и история</h3>
                    <p className="text-xs text-slate-500 font-medium">Обсуждение {targetType === 'vacancy' ? 'вакансии' : 'кандидата'}</p>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {isLoading ? (
                    <div className="flex justify-center items-center h-full">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div>
                    </div>
                ) : comments.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400">
                        <MessageSquare className="w-8 h-8 mb-2 opacity-20" />
                        <p className="text-sm">Нет комментариев</p>
                    </div>
                ) : (
                    comments.map(comment => (
                        <div key={comment.id} className={`flex flex-col ${comment.is_system ? 'items-center my-2' : ''}`}>
                            {comment.is_system ? (
                                <div className="bg-slate-100/50 border border-slate-200 px-4 py-1.5 rounded-full flex items-center gap-2 max-w-[80%] mx-auto shadow-sm">
                                    <Bot className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                                    <p className="text-[11px] font-medium text-slate-600 text-center">{comment.content}</p>
                                    <span className="text-[10px] text-slate-400 shrink-0">{formatDateTime(comment.created_at).split(' ')[1]}</span>
                                </div>
                            ) : (
                                <div className="flex flex-col bg-slate-50 rounded-2xl rounded-tl-sm border border-slate-200 p-3 max-w-[90%] self-start shadow-sm relative">
                                    <div className="flex items-baseline gap-2 mb-1 border-b border-slate-200/60 pb-1.5">
                                        <span className="font-bold text-xs text-slate-700">{comment.author_name || 'Пользователь'}</span>
                                        <span className="text-[10px] font-medium text-slate-400">{formatDateTime(comment.created_at)}</span>
                                    </div>
                                    <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed mt-1">
                                        {comment.content}
                                    </p>
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>

            {!isHistorical && (
                <div className="p-4 bg-slate-50 border-t border-slate-100">
                    <form onSubmit={handleSubmit} className="flex gap-2">
                        <Input
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            placeholder="Написать комментарий..."
                            className="bg-white border-slate-200 shadow-sm rounded-xl focus:ring-indigo-500/20"
                        />
                        <Button
                            type="submit"
                            disabled={!content.trim() || addComment.isPending}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-sm px-4"
                        >
                            <Send className="w-4 h-4 mr-2" />
                            ОТПРАВИТЬ
                        </Button>
                    </form>
                </div>
            )}
        </div>
    );
};
