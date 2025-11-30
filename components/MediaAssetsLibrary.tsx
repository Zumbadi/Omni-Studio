
import React, { useState, useMemo } from 'react';
import { Image as ImageIcon, Video, Search, Download, Filter, Grid, Trash2, ExternalLink, Check, Layers } from 'lucide-react';
import { SocialPost } from '../types';
import { Button } from './Button';

interface MediaAssetsLibraryProps {
  posts: SocialPost[];
  onDeleteAsset?: (postId: string, sceneId: string) => void;
  onCreateMontage?: (assets: any[]) => void;
}

export const MediaAssetsLibrary: React.FC<MediaAssetsLibraryProps> = ({ posts, onDeleteAsset, onCreateMontage }) => {
  const [filterType, setFilterType] = useState<'all' | 'image' | 'video'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);

  const assets = useMemo(() => {
    const allAssets: any[] = [];
    posts.forEach(post => {
      post.scenes?.forEach(scene => {
        if (scene.imageUrl) {
          allAssets.push({
            id: scene.id,
            postId: post.id,
            postTitle: post.title,
            type: 'image',
            url: scene.imageUrl,
            description: scene.description,
            date: post.lastModified || new Date().toISOString()
          });
        }
        if (scene.videoUrl) {
          allAssets.push({
            id: scene.id + '_vid',
            postId: post.id,
            postTitle: post.title,
            type: 'video',
            url: scene.videoUrl,
            description: scene.description,
            date: post.lastModified || new Date().toISOString()
          });
        }
      });
    });
    return allAssets;
  }, [posts]);

  const filteredAssets = assets.filter(asset => {
    const matchesType = filterType === 'all' || asset.type === filterType;
    const matchesSearch = asset.description.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          asset.postTitle.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesType && matchesSearch;
  });

  const toggleSelection = (id: string) => {
      if (selectedAssetIds.includes(id)) {
          setSelectedAssetIds(prev => prev.filter(aid => aid !== id));
      } else {
          setSelectedAssetIds(prev => [...prev, id]);
      }
  };

  const handleCreateMontage = () => {
      if (!onCreateMontage) return;
      const selectedItems = assets.filter(a => selectedAssetIds.includes(a.id));
      onCreateMontage(selectedItems);
      setSelectedAssetIds([]);
  };

  return (
    <div className="flex-1 p-6 bg-gray-950 overflow-y-auto">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <Grid className="text-primary-500" /> Asset Library
            </h2>
            <p className="text-gray-400 text-sm mt-1">Manage all generated media across your campaigns.</p>
          </div>
          
          <div className="flex flex-col md:flex-row gap-3 items-start md:items-center">
            {selectedAssetIds.length > 0 && (
                <div className="flex items-center gap-3 animate-in fade-in slide-in-from-right-4">
                    <span className="text-sm text-primary-400 font-bold">{selectedAssetIds.length} Selected</span>
                    <Button size="sm" onClick={handleCreateMontage}>
                        <Layers size={14} className="mr-2"/> Create Montage
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => setSelectedAssetIds([])}>Clear</Button>
                </div>
            )}
            
            <div className="flex flex-wrap gap-3">
                <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input 
                    type="text" 
                    placeholder="Search assets..." 
                    className="bg-gray-900 border border-gray-700 rounded-lg pl-9 pr-4 py-2 text-sm text-white focus:border-primary-500 focus:outline-none w-64"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
                </div>
                <div className="flex bg-gray-900 p-1 rounded-lg border border-gray-700">
                <button 
                    onClick={() => setFilterType('all')} 
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${filterType === 'all' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'}`}
                >
                    All
                </button>
                <button 
                    onClick={() => setFilterType('image')} 
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1 ${filterType === 'image' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'}`}
                >
                    <ImageIcon size={12}/> Images
                </button>
                <button 
                    onClick={() => setFilterType('video')} 
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1 ${filterType === 'video' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'}`}
                >
                    <Video size={12}/> Videos
                </button>
                </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {filteredAssets.map((asset, i) => {
            const isSelected = selectedAssetIds.includes(asset.id);
            return (
                <div key={i} className={`group bg-gray-900 rounded-xl border overflow-hidden transition-all shadow-lg hover:shadow-primary-900/10 ${isSelected ? 'border-primary-500 ring-2 ring-primary-500/50' : 'border-gray-800 hover:border-primary-500/50'}`}>
                <div className="aspect-square bg-black relative overflow-hidden cursor-pointer" onClick={() => toggleSelection(asset.id)}>
                    {asset.type === 'image' ? (
                    <img src={asset.url} className={`w-full h-full object-cover transition-transform duration-500 ${isSelected ? 'scale-105' : 'group-hover:scale-105'}`} alt={asset.description} />
                    ) : (
                    <video src={asset.url} className="w-full h-full object-cover" />
                    )}
                    
                    {/* Selection Indicator */}
                    <div className={`absolute top-2 left-2 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-primary-500 border-primary-500' : 'border-white/50 bg-black/30'}`}>
                        {isSelected && <Check size={12} className="text-white"/>}
                    </div>

                    {/* Overlay Actions */}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 pointer-events-none">
                    <a 
                        href={asset.url} 
                        download={`asset-${asset.id}.${asset.type === 'image' ? 'png' : 'mp4'}`}
                        className="p-2 bg-white/10 hover:bg-white/20 rounded-full text-white backdrop-blur-sm transition-colors pointer-events-auto"
                        title="Download"
                        onClick={e => e.stopPropagation()}
                    >
                        <Download size={16} />
                    </a>
                    <button 
                        className="p-2 bg-white/10 hover:bg-white/20 rounded-full text-white backdrop-blur-sm transition-colors pointer-events-auto" 
                        title="Open in New Tab" 
                        onClick={(e) => { e.stopPropagation(); window.open(asset.url, '_blank'); }}
                    >
                        <ExternalLink size={16} />
                    </button>
                    {onDeleteAsset && (
                        <button 
                        onClick={(e) => { e.stopPropagation(); onDeleteAsset(asset.postId, asset.id.replace('_vid', '')); }}
                        className="p-2 bg-red-500/20 hover:bg-red-500/40 text-red-400 rounded-full backdrop-blur-sm transition-colors pointer-events-auto" 
                        title="Delete"
                        >
                        <Trash2 size={16} />
                        </button>
                    )}
                    </div>

                    <div className="absolute top-2 right-2 px-2 py-1 bg-black/60 backdrop-blur-md rounded text-[10px] font-bold uppercase text-white flex items-center gap-1">
                    {asset.type === 'image' ? <ImageIcon size={10}/> : <Video size={10}/>} {asset.type}
                    </div>
                </div>
                
                <div className="p-4" onClick={() => toggleSelection(asset.id)}>
                    <div className="text-xs text-primary-400 font-bold mb-1 truncate">{asset.postTitle}</div>
                    <p className="text-sm text-gray-300 line-clamp-2 mb-3 h-10">{asset.description}</p>
                    <div className="flex justify-between items-center text-[10px] text-gray-500 border-t border-gray-800 pt-3">
                    <span>ID: {asset.id.slice(0,6)}</span>
                    <span className="uppercase tracking-wider">Generated</span>
                    </div>
                </div>
                </div>
            );
          })}
        </div>

        {filteredAssets.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-gray-500 border-2 border-dashed border-gray-800 rounded-xl">
            <Filter size={48} className="mb-4 opacity-20" />
            <p className="text-lg font-medium">No assets found</p>
            <p className="text-sm">Try changing filters or generate some content in the Director view.</p>
          </div>
        )}
      </div>
    </div>
  );
};
