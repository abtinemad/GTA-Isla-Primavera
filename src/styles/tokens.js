export const palette = { primary:'#EA4423', primaryBright:'#FF6A4A', cash:'#46AE3C', cashBright:'#7CE86C', goldA:'#F7C84A', goldB:'#E08A1E' };
export const categories = {
  qg:{label:'QG',color:'#EDEFF2'}, ravito:{label:'Ravitaillement',color:'#46AE3C'},
  bars:{label:'Bars',color:'#E0479B'}, missions:{label:'Missions',color:'#EA4423'},
  escapades:{label:'Escapades',color:'#9E7AD2'}, plages:{label:'Plages',color:'#3F6CC4'},
  restaurants:{label:'Restaurants',color:'#F0941E'},
  beachclub:{label:'Beach Club',color:'#FF6F61'},
};
export const typography = {
  fonts:{ display:"'Space Grotesk',sans-serif", body:"'Inter',sans-serif", mono:"'JetBrains Mono',monospace" },
  scale:{
    display:{size:20,weight:700,letterSpacing:-0.3}, title:{size:17,weight:700},
    body:{size:12.5,weight:400,lineHeight:1.45}, label:{size:10,weight:500,letterSpacing:1,transform:'uppercase',font:'mono'},
    data:{size:14,weight:700,font:'mono'}, score:{size:30,weight:700,letterSpacing:-1,font:'mono'},
  },
};
export const shape = { radiusCard:16, radiusPill:99, radiusBadge:8, railAccent:3, blurGlass:14 };
export const themes = {
  dark:{ bgBase:'#160E22', bgScreen:'#17101F', surface:'#1D1530', surface2:'#241636', text:'#EFF0F2', textMuted:'#9A9CA4', textFaint:'#6A6C74', hairline:'rgba(255,255,255,.07)', glassBg:'rgba(20,12,32,.96)', scrim:'rgba(14,8,20,.50)', neutralArt:'#F2F2F2', cardShadow:'0 8px 24px rgba(0,0,0,.35)' },
  light:{ bgBase:'#F7EFE6', bgScreen:'#F1EAD9', surface:'#FFFFFF', surface2:'#FAF9F6', text:'#16161A', textMuted:'#5B5D66', textFaint:'#9A9CA4', hairline:'rgba(0,0,0,.07)', glassBg:'rgba(255,255,255,.96)', scrim:'rgba(247,243,233,.58)', neutralArt:'#0A0A0A', cash:'#2F8A2A', cardShadow:'0 4px 16px rgba(0,0,0,.06)' },
};
export default { palette, categories, typography, shape, themes };
