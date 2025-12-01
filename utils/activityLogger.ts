
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

  try {
      let existing: ActivityItem[] = [];
      try {
          existing = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      } catch (e) {
          // If parse fails, ignore existing
          existing = [];
      }
      
      // Keep last 50 activities
      const updated = [newItem, ...existing].slice(0, 50);
      
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      window.dispatchEvent(new Event('omniActivityUpdated'));
  } catch (e) {
      console.error("Failed to log activity to localStorage", e);
      // Try to clear old logs and retry with just new item if full
      try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify([newItem]));
      } catch (retryError) {
          console.error("Activity logging failed completely", retryError);
      }
  }
};

export const getActivities = (): ActivityItem[] => {
  try {
      const existing = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(existing) ? existing : [];
  } catch (e) {
      console.error("Failed to read activities", e);
      return [];
  }
};
