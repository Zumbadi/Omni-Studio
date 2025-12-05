
import React, { memo, useMemo } from 'react';
import { SocialPost } from '../types';

interface MediaKanbanProps {
  posts: SocialPost[];
  onSelectPost: (post: SocialPost) => void;
}

interface KanbanColumnProps {
  title: string;
  color: string;
  posts: SocialPost[];
  onSelectPost: (post: SocialPost) => void;
}

const KanbanColumn = memo(({ title, color, posts, onSelectPost }: KanbanColumnProps) => (
  <div className="flex-1 min-w-[280px] bg-gray-900/50 rounded-xl p-4 border border-gray-800 flex flex-col h-full">
    <div className={`text-xs font-bold uppercase tracking-wider mb-4 flex items-center justify-between ${color} bg-gray-900/80 p-2 rounded-lg`}>
      {title}
      <span className="bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full text-[10px]">
        {posts.length}
      </span>
    </div>
    <div className="space-y-3 overflow-y-auto flex-1 pr-1 scrollbar-thin scrollbar-thumb-gray-700">
      {posts.map(post => (
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
));

KanbanColumn.displayName = 'KanbanColumn';

export const MediaKanban: React.FC<MediaKanbanProps> = ({ posts, onSelectPost }) => {
  const ideaPosts = useMemo(() => posts.filter(p => p.status === 'idea'), [posts]);
  const scriptingPosts = useMemo(() => posts.filter(p => p.status === 'scripting'), [posts]);
  const generatingPosts = useMemo(() => posts.filter(p => p.status === 'generating'), [posts]);
  const readyPosts = useMemo(() => posts.filter(p => p.status === 'ready' || p.status === 'uploaded'), [posts]);

  return (
    <div className="flex-1 p-4 md:p-8 overflow-x-auto">
      <div className="flex gap-6 h-full min-w-[1000px] md:min-w-0">
        <KanbanColumn title="Ideation" color="text-yellow-400" posts={ideaPosts} onSelectPost={onSelectPost} />
        <KanbanColumn title="Scripting" color="text-blue-400" posts={scriptingPosts} onSelectPost={onSelectPost} />
        <KanbanColumn title="In Production" color="text-pink-400" posts={generatingPosts} onSelectPost={onSelectPost} />
        <KanbanColumn title="Ready" color="text-green-400" posts={readyPosts} onSelectPost={onSelectPost} />
      </div>
    </div>
  );
};
