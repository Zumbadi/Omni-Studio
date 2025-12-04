
import { useState, useEffect } from 'react';
import { SocialPost, Scene, Character, ReferenceAsset } from '../types';
import { MOCK_SOCIAL_POSTS } from '../constants';
import { useDebounce } from './useDebounce';

export const useMediaProject = () => {
  const [posts, setPosts] = useState<SocialPost[]>(() => {
    try {
      const saved = localStorage.getItem('omni_social_posts');
      return saved ? JSON.parse(saved) : MOCK_SOCIAL_POSTS;
    } catch (e) {
      return MOCK_SOCIAL_POSTS;
    }
  });

  const [brands, setBrands] = useState<string[]>(() => {
      try {
          const saved = localStorage.getItem('omni_media_brands');
          return saved ? JSON.parse(saved) : ['Nike', 'TechStart', 'Personal'];
      } catch {
          return ['Nike', 'TechStart', 'Personal'];
      }
  });

  const [selectedPost, setSelectedPost] = useState<SocialPost | null>(null);
  
  const debouncedPosts = useDebounce(posts, 1000);
  const debouncedBrands = useDebounce(brands, 1000);

  // Persist Posts
  useEffect(() => {
    const savePosts = () => {
        try {
            localStorage.setItem('omni_social_posts', JSON.stringify(debouncedPosts));
        } catch (e) {
            console.warn("Storage quota exceeded. Saving light version of posts.");
            const lightPosts = debouncedPosts.map(p => ({
                ...p,
                scenes: p.scenes?.map(s => ({
                    ...s,
                    imageUrl: s.imageUrl?.startsWith('data:') ? undefined : s.imageUrl,
                    videoUrl: s.videoUrl?.startsWith('data:') ? undefined : s.videoUrl
                })),
                characters: p.characters?.map(c => ({
                    ...c,
                    imageUrl: c.imageUrl?.startsWith('data:') ? undefined : c.imageUrl
                })),
                styleReferences: p.styleReferences?.map(r => ({
                    ...r,
                    url: r.url?.startsWith('data:') ? undefined : r.url
                }))
            }));
            try {
                localStorage.setItem('omni_social_posts', JSON.stringify(lightPosts));
            } catch (err) {
                console.error("Critical: Storage full even for metadata.", err);
            }
        }
        window.dispatchEvent(new Event('omniAssetsUpdated')); 
    };
    savePosts();
  }, [debouncedPosts]);

  // Persist Brands
  useEffect(() => {
      localStorage.setItem('omni_media_brands', JSON.stringify(debouncedBrands));
  }, [debouncedBrands]);

  const addBrand = (name: string) => {
      if (name && !brands.includes(name)) {
          setBrands(prev => [...prev, name]);
      }
  };

  const createPost = (post: SocialPost) => {
      setPosts([post, ...posts]);
      setSelectedPost(post);
  };

  const updatePost = (updates: Partial<SocialPost>) => {
      if (selectedPost) {
          const updated = { ...selectedPost, ...updates, lastModified: new Date().toISOString() };
          setPosts(prev => prev.map(p => p.id === selectedPost.id ? updated : p));
          setSelectedPost(updated);
      }
  };

  const updateScene = (sceneId: string, updates: Partial<Scene>) => {
      if (selectedPost) {
          const newScenes = selectedPost.scenes?.map(s => s.id === sceneId ? { ...s, ...updates } : s);
          updatePost({ scenes: newScenes });
      }
  };

  const addScene = () => {
      if (!selectedPost) return;
      const newScene: Scene = {
          id: `s-${Date.now()}`,
          description: 'New Scene',
          status: 'pending',
          duration: 5,
          transition: 'cut'
      };
      updatePost({ scenes: [...(selectedPost.scenes || []), newScene] });
  };

  const deleteScene = (index: number) => {
      if (!selectedPost?.scenes) return;
      const scenes = [...selectedPost.scenes];
      scenes.splice(index, 1);
      updatePost({ scenes });
  };

  const duplicateScene = (index: number) => {
      if (!selectedPost?.scenes) return;
      const scenes = [...selectedPost.scenes];
      const scene = scenes[index];
      const newScene = { ...scene, id: `s-${Date.now()}` };
      scenes.splice(index + 1, 0, newScene);
      updatePost({ scenes });
  };

  const reorderScenes = (from: number, to: number) => {
      if (!selectedPost?.scenes) return;
      const scenes = [...selectedPost.scenes];
      if (to < 0 || to >= scenes.length) return;
      const [moved] = scenes.splice(from, 1);
      scenes.splice(to, 0, moved);
      updatePost({ scenes });
  };

  return {
      posts,
      setPosts,
      brands,
      addBrand,
      selectedPost,
      setSelectedPost,
      createPost,
      updatePost,
      updateScene,
      addScene,
      deleteScene,
      duplicateScene,
      reorderScenes
  };
};
