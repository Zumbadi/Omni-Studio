
import { ActivityItem } from '../types';

const STORAGE_KEY = 'omni_activity_log';

export const logActivity = (
  type: ActivityItem['type'],
  title: string,
  desc: string,
  projectId?: string
) => {
  const newItem: ActivityItem = {
    id: `act-${Date.now()}`,
    type,
    title,
    desc,
    time: 'Just now',
    projectId
  };

  const existing = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  // Keep last 50 activities
  const updated = [newItem, ...existing].slice(0, 50);
  
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  window.dispatchEvent(new Event('omniActivityUpdated'));
};

export const getActivities = (): ActivityItem[] => {
  const existing = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  return existing;
};
