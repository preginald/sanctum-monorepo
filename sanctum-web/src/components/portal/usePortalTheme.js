/**
 * usePortalTheme - Centralized theme logic for portal pages
 * 
 * Returns theme object based on account brand affinity
 * Eliminates 30+ lines of duplicate theme code across portal pages
 */
export default function usePortalTheme(account) {
  const isNaked = account?.brand_affinity === 'nt';

  return {
    isNaked,
    
    // Background colors
    bg: isNaked ? 'bg-slate-50' : 'bg-slate-900',
    
    // Card/widget backgrounds
    card: isNaked ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-800 border-slate-700',
    
    // Text colors
    textMain: isNaked ? 'text-slate-900' : 'text-white',
    textSub: isNaked ? 'text-slate-500' : 'text-slate-400',
    
    // Accent colors (brand primary)
    accent: isNaked ? 'text-naked-pink' : 'text-sanctum-gold',
    accentBg: isNaked ? 'bg-naked-pink' : 'bg-sanctum-gold',
    
    // Navigation
    navBg: isNaked ? 'bg-white border-b border-slate-200' : 'bg-slate-900 border-b border-slate-800',
    
    // Buttons
    btn: isNaked 
      ? 'bg-naked-pink hover:bg-pink-600 text-white' 
      : 'bg-sanctum-gold hover:bg-yellow-500 text-slate-900',
    
    // Brand name
    brandName: isNaked ? 'Naked Tech' : 'SANCTUM',
    
    // Logo text style
    logoStyle: isNaked ? 'font-bold' : 'font-bold tracking-wider'
  };
}
