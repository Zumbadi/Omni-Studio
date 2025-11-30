
import React from 'react';
import { SocialPost } from '../types';

interface MediaKanbanProps {
  posts: SocialPost[];
  onSelectPost: (post: SocialPost) => void;
}

export const MediaKanban: React.FC<MediaKanbanProps> = ({ posts, onSelectPost }) => {
  const KanbanColumn = ({ title, status, color }: { title: string, status: SocialPost['status'], color: string }) => (
    <div className="flex-1 min-w-[280px] bg-gray-900/50 rounded-xl p-4 border border-gray-800 flex flex-col h-full">
      <div className={`text-xs font-bold uppercase tracking-wider mb-4 flex items-center justify-between ${color} bg-gray-900/80 p-2 rounded-lg`}>
        {title}
        <span className="bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full text-[10px]">
          {posts.filter(p => p.status === status).length}
        </span>
      </div>
      <div className="space-y-3 overflow-y-auto flex-1 pr-1 scrollbar-thin scrollbar-thumb-gray-700">
        {posts.filter(p => p.status === status).map(post => (
          <div 
            key={post.id} 
            onClick={() => onSelectPost(post)} 
            className="bg-gray-800 p-3 rounded-lg border border-gray-700 shadow-sm hover:border-primary-500/50 hover:bg-gray-750 transition-all group cursor-pointer relative"
          >
            <div className="flex justify-between items-start mb-2">
                <span className={`text-[9px] px-1.5 py-0.5 rounded uppercase font-bold tracking-wide ${post.brandId ? 'bg-primary-900/30 text-primary-300 border border-primary-800' : 'bg-gray-700 text-gray-400'}`}>
                    {post.brandId || 'Personal'}
                </span>
            </div>
            <h4 className="text-sm font-medium text-gray-200 mb-2 line-clamp-2 group-hover:text-white">{post.title}</h4>
            <div className="flex justify-between items-center mt-2">
              <span className="text-[10px] text-gray-500 capitalize px-1.5 py-0.5 bg-black/30 rounded">{post.platform}</span>
              <span className="text-[10px] text-gray-500">{post.scenes?.length || 0} scenes</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="flex-1 p-4 md:p-8 overflow-x-auto">
      <div className="flex gap-6 h-full min-w-[1000px] md:min-w-0">
        <KanbanColumn title="Ideation" status="idea" color="text-yellow-400" />
        <KanbanColumn title="Scripting" status="scripting" color="text-blue-400" />
        <KanbanColumn title="In Production" status="generating" color="text-pink-400" />
        <KanbanColumn title="Ready" status="ready" color="text-green-400" />
      </div>
    </div>
  );
};
