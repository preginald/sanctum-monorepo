const MAX_HISTORY = 5;

/**
 * Saves an item to the local history stack.
 * Moves item to top if it already exists.
 * @param {string} type - Entity type (e.g., 'clients', 'projects')
 * @param {object} item - Minimal data { id, name, ... }
 */
export const recordVisit = (type, item) => {
    if (!item?.id) return;

    try {
        const key = `sanctum_history_${type}`;
        const raw = localStorage.getItem(key);
        let history = raw ? JSON.parse(raw) : [];

        // Remove if exists (to move to top)
        history = history.filter(h => h.id !== item.id);

        // Add to front
        history.unshift(item);

        // Limit size
        if (history.length > MAX_HISTORY) {
            history = history.slice(0, MAX_HISTORY);
        }

        localStorage.setItem(key, JSON.stringify(history));
    } catch (e) {
        console.warn("History write failed", e);
    }
};

/**
 * Retrieves the history list for a type.
 * @param {string} type 
 * @returns {Array} List of items
 */
export const getRecent = (type) => {
    try {
        const key = `sanctum_history_${type}`;
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : [];
    } catch (e) {
        return [];
    }
};

/**
 * Sorts a master list based on recency.
 * Recent items appear first, preserving original order for non-recents.
 */
export const sortByRecency = (masterList, type) => {
    const recents = getRecent(type);
    if (!recents.length) return masterList;

    const recentIds = new Set(recents.map(r => r.id));

    return [...masterList].sort((a, b) => {
        const aRecent = recentIds.has(a.id);
        const bRecent = recentIds.has(b.id);

        if (aRecent && !bRecent) return -1; // a comes first
        if (!aRecent && bRecent) return 1;  // b comes first
        
        // If both recent, sort by index in recent list (most recent first)
        if (aRecent && bRecent) {
            return recents.findIndex(r => r.id === a.id) - recents.findIndex(r => r.id === b.id);
        }
        
        return 0; // Keep original order
    });
};