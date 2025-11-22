
import React, { useState } from 'react';
import { SocialPost } from '../types';
import { X } from 'lucide-react';
import { Button } from './Button';

interface MediaCalendarProps {
  posts: SocialPost[];
  onSelectPost: (post: SocialPost) => void;
}

export const MediaCalendar: React.FC<MediaCalendarProps> = ({ posts, onSelectPost }) => {
  const days = Array.from({length: 35}, (_, i) => { const d = new Date(); d.setDate(d.getDate() - d.getDay() + i); return d; });
  const today = new Date();
  const [selectedDayPost, setSelectedDayPost] = useState<SocialPost | null>(null);

  const getPlatformColor = (p: string) => {
      if(p === 'youtube') return 'bg-red-500';
      if(p === 'twitter') return 'bg-blue-500';
      if(p === 'instagram') return 'bg-pink-500';
      if(p === 'tiktok') return 'bg-black border border-gray-700';
      return 'bg-gray-500';
  };

  return (
      <div className="flex-1 p-4 md:p-8 overflow-hidden flex gap-4">
         <div className="flex-1 flex flex-col">
             <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-white">Content Schedule</h2>
                <div className="text-sm text-gray-500">{today.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</div>
             </div>
             <div className="bg-gray-900 border border-gray-800 rounded-xl flex-1 overflow-x-auto flex flex-col shadow-xl">
                 <div className="min-w-[600px] grid grid-cols-7 border-b border-gray-800 bg-gray-850">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                        <div key={day} className="p-3 text-center text-xs font-medium text-gray-500 uppercase">{day}</div>
                    ))}
                 </div>
                 <div className="min-w-[600px] grid grid-cols-7 grid-rows-5 flex-1">
                     {days.map((date, i) => {
                         const dayPosts = posts.filter(p => { 
                             if (p.scheduledDate) return new Date(p.scheduledDate).toDateString() === date.toDateString(); 
                             return !p.scheduledDate && parseInt(p.id.slice(-2)) % 30 === i; // Mock distribution
                         });
                         const isToday = date.toDateString() === today.toDateString();
                         return (
                             <div key={i} className={`border border-gray-800/50 p-2 flex flex-col gap-1 min-h-[100px] transition-colors ${date.getMonth() !== today.getMonth() ? 'bg-gray-900/30 text-gray-600' : 'bg-gray-900 hover:bg-gray-800'}`}>
                                 <div className={`text-xs mb-1 font-mono ${isToday ? 'text-primary-400 font-bold' : 'text-gray-500'}`}>{date.getDate()}</div>
                                 {dayPosts.map(post => (
                                     <div 
                                        key={post.id} 
                                        onClick={() => setSelectedDayPost(post)} 
                                        className={`text-[10px] p-1 rounded truncate cursor-pointer text-white shadow-sm hover:scale-105 transition-transform ${getPlatformColor(post.platform)}`}
                                        title={post.title}
                                     >
                                        {post.title}
                                     </div>
                                 ))}
                             </div>
                         );
                     })}
                 </div>
             </div>
         </div>
         
         {/* Side Detail Panel */}
         <div className={`w-80 bg-gray-900 border-l border-gray-800 flex-shrink-0 transition-all duration-300 flex flex-col ${selectedDayPost ? 'mr-0' : '-mr-80 hidden'}`}>
             {selectedDayPost && (
                 <div className="p-6 h-full flex flex-col">
                     <div className="flex justify-between items-start mb-4">
                         <h3 className="font-bold text-white text-lg line-clamp-2">{selectedDayPost.title}</h3>
                         <button onClick={() => setSelectedDayPost(null)} className="text-gray-500 hover:text-white"><X size={20}/></button>
                     </div>
                     <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold text-white mb-4 w-fit ${getPlatformColor(selectedDayPost.platform)}`}>
                         <span className="capitalize">{selectedDayPost.platform}</span>
                     </div>
                     
                     <div className="space-y-4 flex-1 overflow-y-auto">
                         <div className="bg-black/30 p-3 rounded-lg border border-gray-800">
                             <div className="text-xs text-gray-500 uppercase font-bold mb-1">Status</div>
                             <div className="text-sm text-white capitalize">{selectedDayPost.status}</div>
                         </div>
                         <div className="bg-black/30 p-3 rounded-lg border border-gray-800">
                             <div className="text-xs text-gray-500 uppercase font-bold mb-1">Scheduled</div>
                             <div className="text-sm text-white">{selectedDayPost.scheduledDate ? new Date(selectedDayPost.scheduledDate).toDateString() : 'Unscheduled'}</div>
                         </div>
                         {selectedDayPost.thumbnail && (
                             <div className="rounded-lg overflow-hidden border border-gray-800">
                                 <img src={selectedDayPost.thumbnail} className="w-full h-32 object-cover" alt="Thumbnail" />
                             </div>
                         )}
                     </div>
                     
                     <Button className="mt-4 w-full" onClick={() => onSelectPost(selectedDayPost)}>
                         Open Editor
                     </Button>
                 </div>
             )}
         </div>
      </div>
  );
};
