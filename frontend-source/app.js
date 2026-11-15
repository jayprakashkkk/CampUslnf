// Universal API Base configuration for Cloudflare Pages + Railway
const RAILWAY_BACKEND = 'https://campuslnf-production.up.railway.app';
const CAMPUS_API_BASE = (function() {
  if (typeof window === 'undefined') return '';
  if (window.CAMPUS_API_BASE) return window.CAMPUS_API_BASE;
  const stored = localStorage.getItem('CAMPUS_API_BASE');
  if (stored) return stored;
  return '';
})();

let activeForegroundRequests = 0;
let spinnerShowTimer = null;
let spinnerHideTimer = null;

function showGlobalSpinner() {
  activeForegroundRequests++;
  clearTimeout(spinnerHideTimer);
  if (!spinnerShowTimer) {
    // Apple iOS HIG debounce: do not flash spinner for snappy network responses (< 280ms)
    spinnerShowTimer = setTimeout(() => {
      if (activeForegroundRequests > 0) {
        const overlay = document.getElementById('appleLoadingOverlay');
        if (overlay) {
          overlay.classList.remove('hide');
          overlay.setAttribute('aria-hidden', 'false');
          // Safety watchdog: Auto-hide spinner if requests stall beyond 4.5s
          setTimeout(() => {
            if (activeForegroundRequests > 0) {
              activeForegroundRequests = 0;
              overlay.classList.add('hide');
              overlay.setAttribute('aria-hidden', 'true');
            }
          }, 4500);
        }
      }
    }, 280);
  }
}

function hideGlobalSpinner() {
  activeForegroundRequests = Math.max(0, activeForegroundRequests - 1);
  if (activeForegroundRequests === 0) {
    clearTimeout(spinnerShowTimer);
    spinnerShowTimer = null;
    clearTimeout(spinnerHideTimer);
    spinnerHideTimer = setTimeout(() => {
      if (activeForegroundRequests === 0) {
        const overlay = document.getElementById('appleLoadingOverlay');
        if (overlay) {
          overlay.classList.add('hide');
          overlay.setAttribute('aria-hidden', 'true');
        }
      }
    }, 80);
  }
}

const _origFetch = window.fetch;
window.fetch = async function(input, init) {
  let url = typeof input === 'string' ? input : (input instanceof Request ? input.url : String(input));
  init = init || {};
  const isBackgroundPoll = 
    url.includes('/api/notifications') || 
    url.includes('/api/community-chat') || 
    url.includes('/api/auth/check-username') || 
    url.includes('/api/users/search') || 
    url.includes('/like') || 
    Boolean(init.isBackground || init.background);

  if (!isBackgroundPoll) {
    showGlobalSpinner();
  }
  try {
    if (url.startsWith('/api/') || url.includes('/api/')) {
      if (url.startsWith('/api/') && CAMPUS_API_BASE) {
        url = CAMPUS_API_BASE.replace(/\/+$/, '') + url;
      }
      if (!init.credentials) {
        init.credentials = 'include';
      }
      // Attach X-Auth-Token from localStorage for bulletproof cross-domain sessions
      const authToken = localStorage.getItem('campus_auth_token');
      if (authToken) {
        if (!init.headers) init.headers = {};
        if (init.headers instanceof Headers) {
          if (!init.headers.has('X-Auth-Token')) init.headers.set('X-Auth-Token', authToken);
        } else if (Array.isArray(init.headers)) {
          init.headers.push(['X-Auth-Token', authToken]);
        } else {
          if (!init.headers['X-Auth-Token']) init.headers['X-Auth-Token'] = authToken;
        }
      }
      const getFallbackUrl = (currentUrl) => {
        const apiPath = currentUrl.includes('/api/') ? currentUrl.substring(currentUrl.indexOf('/api/')) : currentUrl;
        return RAILWAY_BACKEND.replace(/\/+$/, '') + (apiPath.startsWith('/') ? apiPath : '/' + apiPath);
      };
      try {
        const response = await _origFetch.call(this, url, init);
        if (response.status === 404 && !url.includes('railway.app') && window.location.hostname.includes('pages.dev')) {
          const fallbackUrl = getFallbackUrl(url);
          return await _origFetch.call(this, fallbackUrl, init);
        }
        return response;
      } catch (err) {
        if (!url.includes('railway.app') && window.location.hostname.includes('pages.dev')) {
          const fallbackUrl = getFallbackUrl(url);
          return await _origFetch.call(this, fallbackUrl, init);
        }
        throw err;
      }
    }
    return await _origFetch.call(this, url, init);
  } finally {
    if (!isBackgroundPoll) {
      hideGlobalSpinner();
    }
  }
};

let chosenType='', myReportsOnly=false, statFilter='', currentUser=null, authMode='login';
let cachedAllReports=[], exploreSearchQuery='', exploreTypeFilter='', exploreCategoryFilter='', exploreSearchTimer=null, exploreMemberSearchSeq=0;
let notificationRefreshTimer=null, communityMuted=false, notificationHasInitialLoad=false, latestNotificationId=0;
let profileImageDataDraft='', bannerImageDataDraft='';
const $=id=>document.getElementById(id);
// CampUs manages its own in-app history. Do not let the browser restore a
// stale scroll offset when returning from login, profile, or another full-screen layer.
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
function resetCampusScrollToTop(){
  const reset=()=>{
    window.scrollTo(0,0);
    document.documentElement.scrollTop=0;
    if(document.body)document.body.scrollTop=0;
  };
  requestAnimationFrame(()=>requestAnimationFrame(reset));
}
// Add a same-URL history entry for each in-app overlay so the browser/device Back
// button dismisses the top overlay instead of navigating away from CampUs.
const campusUiHistoryStack=[];
let ignoreCampusUiPopstate=false, campusUiToken=0;
function pushCampusBackGuard(){
 const state=history.state&&typeof history.state==='object'?history.state:{};
 history.pushState({...state,campusFindBackGuard:true,campusFindGuardToken:++campusUiToken},'',location.href);
}
function installCampusBackGuard(){
 const state=history.state&&typeof history.state==='object'?history.state:{};
 history.replaceState({...state,campusFindBackGuard:true},'',location.href);
 pushCampusBackGuard();
}
function pushCampusUiLayer(layer){
 if(campusUiHistoryStack[campusUiHistoryStack.length-1]===layer)return;
 campusUiHistoryStack.push(layer);
 const state=history.state&&typeof history.state==='object'?history.state:{};
 history.pushState({...state,campusFindUiLayer:layer,campusFindUiToken:++campusUiToken},'',location.href);
}
function finishCampusUiLayer(layer,fromPopstate=false){
 if(fromPopstate)return;
 const last=campusUiHistoryStack[campusUiHistoryStack.length-1];
 if(last===layer){campusUiHistoryStack.pop();ignoreCampusUiPopstate=true;history.back();return;}
 const index=campusUiHistoryStack.lastIndexOf(layer);if(index>=0)campusUiHistoryStack.splice(index,1);
}
function closeCampusUiLayerFromBack(layer){
  if(layer==='adminDashboardModal')closeAdminDashboard(true);
  else if(layer==='navDrawer')closeNavDrawer(true);
  else if(layer==='postDetailViewer')closePostDetailViewer(true);
  else if(layer==='explorePage')closeExplorePage(true);
  else if(layer==='activityCenterModal')closeActivityCenter(true);
  else if(layer==='privacySettingsModal')closePrivacySettingsModal(true);
  else if(layer==='termsModal')closeTermsModal(true);
  else if(layer==='helpSupportModal')closeHelpSupportModal(true);
  else if(layer==='aboutCampusModal')closeAboutCampusModal(true);
  else if(layer==='leaderboardModal')closeLeaderboardModal(true);
  else if(layer==='claimsViewerModal')closeClaimsViewer(true);
  else if(layer==='claimItemModal')closeClaimModal(true);
  else if(layer==='marketModal')closeMarketModal(true);
  else if(layer==='profileEditor')closeProfileEditorPage(true);
  else if(layer==='publicProfile')closeChatUserProfile(true);
  else if(layer==='communityChat')closeCommunityChat(true);
  else if(layer==='reportForm')closeForm(true);
  else if(layer==='navPopup')closeNavPopup(true);
  else if(layer==='authForm')backToAuthChoices(true);
  else if(layer==='phoneMenu')closeMenu(true);
  else if(layer==='profileDropdown')closeProfileDropdown(true);
}
function closeTopUntrackedUiLayer(){
  if($('imageLightbox')&&!$('imageLightbox').classList.contains('hide')){closeLightbox();return true;}
  if($('adminDashboardModal')&&!$('adminDashboardModal').classList.contains('hide')){closeAdminDashboard(true);return true;}
  if(navDrawerOpen){closeNavDrawer(true);return true;}
  if($('postDetailViewer')&&!$('postDetailViewer').classList.contains('hide')){closePostDetailViewer(true);return true;}
  if($('explorePage')&&!$('explorePage').classList.contains('hide')){closeExplorePage(true);return true;}
  if($('leaderboardModal')&&!$('leaderboardModal').classList.contains('hide')){closeLeaderboardModal(true);return true;}
  if($('claimsViewerModal')&&!$('claimsViewerModal').classList.contains('hide')){closeClaimsViewer(true);return true;}
  if($('claimItemModal')&&!$('claimItemModal').classList.contains('hide')){closeClaimModal(true);return true;}
  if($('marketModal')&&!$('marketModal').classList.contains('hide')){closeMarketModal(true);return true;}
  if($('privacySettingsModal')&&!$('privacySettingsModal').classList.contains('hide')){closePrivacySettingsModal(true);return true;}
  if($('termsModal')&&!$('termsModal').classList.contains('hide')){closeTermsModal(true);return true;}
  if($('helpSupportModal')&&!$('helpSupportModal').classList.contains('hide')){closeHelpSupportModal(true);return true;}
  if($('aboutCampusModal')&&!$('aboutCampusModal').classList.contains('hide')){closeAboutCampusModal(true);return true;}
  if($('commentsModal')&&!$('commentsModal').classList.contains('hide')){closeCommentsModal();return true;}
  if($('activityCenterModal')&&!$('activityCenterModal').classList.contains('hide')){closeActivityCenter();return true;}
  if($('profileEditorPage')&&!$('profileEditorPage').classList.contains('hide')){closeProfileEditorPage(true);return true;}
  if($('communityProfilePage')&&!$('communityProfilePage').classList.contains('hide')){closeChatUserProfile(true);return true;}
  if(communityChatOpen){closeCommunityChat(true);return true;}
  if($('modal')&&!$('modal').classList.contains('hide')){closeForm(true);return true;}
  if($('navPopup')&&!$('navPopup').classList.contains('hide')){closeNavPopup(true);return true;}
  if($('authFormPanel')&&!$('authFormPanel').classList.contains('hide')){backToAuthChoices(true);return true;}
  if(menuOpen){closeMenu(true);return true;}
  if(profileMenuOpen){closeProfileDropdown(true);return true;}
  return false;
}
window.addEventListener('popstate',()=>{
 if(ignoreCampusUiPopstate){ignoreCampusUiPopstate=false;return;}
 const layer=campusUiHistoryStack.pop();
 if(layer){
   closeCampusUiLayerFromBack(layer);
   // Re-arm the same-URL guard after every intercepted Back action. Without
   // this, the next Back can leave the site or appear to stop working.
   pushCampusBackGuard();
   return;
 }
 if(closeTopUntrackedUiLayer()){pushCampusBackGuard();return;}
 const intro=document.getElementById('firstVisitIntro');
 if(intro && intro.hidden){
   intro.hidden=false;
   intro.style.display='block';
   document.body.classList.add('intro-open');
   resetCampusScrollToTop();
   intro.scrollTop=0;
   pushCampusBackGuard();
   return;
 }
 pushCampusBackGuard();
});
installCampusBackGuard();
function openForm(type){$('form').reset();$('name').value=currentUser?.displayName||currentUser?.username||'';$('phone').value=currentUser?.phone||'';$('photoPreview').src='';$('photoPreview').classList.add('hide');setFormType(type||'LOST');pushCampusUiLayer('reportForm');$('modal').classList.remove('hide');$('error').textContent=''}
function closeForm(fromPopstate=false){const wasOpen=!$('modal').classList.contains('hide');$('modal').classList.add('hide');if(wasOpen)finishCampusUiLayer('reportForm',fromPopstate)}
function filterType(type,btn){chosenType=type;document.querySelectorAll('.type-tabs .tab').forEach(x=>x.classList.remove('active'));btn.classList.add('active');load()}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function validAvatarId(id){const v=String(id||'');return /^avatar-(0[1-9]|[12][0-9]|30)$/.test(v)?v:''}
function avatarInner(id,name,photoData=''){const photo=String(photoData||'');if(photo&&(photo.startsWith('data:image/')||photo.startsWith('/api/users/')))return `<img class="avatar-image" src="${esc(photo)}" alt="" loading="lazy">`; const safeId=validAvatarId(id);if(safeId)return `<img class="avatar-image" src="/avatars/${safeId}.png" alt="" loading="lazy">`;const clean=String(name||'User').trim();return esc((clean.charAt(0)||'?').toUpperCase())}
function avatarMarkup(id,name,extraClass='avatar-image',photoData=''){const photo=String(photoData||'');if(photo&&(photo.startsWith('data:image/')||photo.startsWith('/api/users/')))return `<img class="${extraClass}" src="${esc(photo)}" alt="" loading="lazy">`; const safeId=validAvatarId(id);return safeId?`<img class="${extraClass}" src="/avatars/${safeId}.png" alt="" loading="lazy">`:esc((String(name||'User').trim().charAt(0)||'?').toUpperCase())}
function roleLabel(role){const r=String(role||'MEMBER').toUpperCase();return ({OWNER:'Owner',ADMIN:'Admin',LEADER:'Leader',MODERATOR:'Moderator'})[r]||''}
function roleCanChangeUsername(role){return ['OWNER','ADMIN'].includes(String(role||'MEMBER').toUpperCase())}
function roleCanUploadPhoto(role){return true}
function roleCanUploadBanner(role){return true}
function roleCanManageMembers(role){return ['OWNER','ADMIN'].includes(String(role||'MEMBER').toUpperCase())}
function roleBadgeMarkup(role){return ''}

function toast(s){$('toast').textContent=s;$('toast').style.display='block';setTimeout(()=>$('toast').style.display='none',3200)}
function startNotificationPolling(){
 stopNotificationPolling();
 if(!currentUser)return;
 notificationHasInitialLoad=false;latestNotificationId=0;
 refreshNotifications();
 notificationRefreshTimer=setInterval(()=>{if(currentUser)refreshNotifications()},12000);
}
function stopNotificationPolling(){
 if(notificationRefreshTimer){clearInterval(notificationRefreshTimer);notificationRefreshTimer=null;}
 notificationHasInitialLoad=false;latestNotificationId=0;
 communityMuted=false;
 syncCommunityMuteControls();
}
async function refreshNotifications(){
 if(!currentUser)return;
 try{
  const response=await fetch('/api/notifications',{headers:{'Accept':'application/json'}});
  if(response.status===401)return;
  if(!response.ok)throw new Error('notifications unavailable');
  const data=await response.json(),items=Array.isArray(data.notifications)?data.notifications:[];
  communityMuted=!!data.communityMuted;
  syncCommunityMuteControls();
  const newestId=items.reduce((max,n)=>Math.max(max,Number(n.id||0)),0);
  if(notificationHasInitialLoad&&newestId>latestNotificationId){
   const newReports=items.filter(n=>Number(n.id||0)>latestNotificationId&&String(n.type||'').startsWith('REPORT_'))
     .sort((a,b)=>Number(a.id||0)-Number(b.id||0));
   const incoming=newReports[newReports.length-1];
   if(incoming)toast(`${incoming.title||'New Lost & Found post'}: ${incoming.message||''}`);
  }
  notificationHasInitialLoad=true;
  latestNotificationId=Math.max(latestNotificationId,newestId);
 }catch{/* Keep the app usable if notifications are temporarily unavailable. */}
}
function syncCommunityMuteControls(){
 const button=$('chatMuteButton'),icon=$('chatMuteIcon');
 if(button){
  button.setAttribute('aria-pressed',String(communityMuted));
  button.setAttribute('aria-label',communityMuted?'Unmute community chat notifications':'Mute community chat notifications');
  button.title=communityMuted?'Unmute community chat notifications':'Mute community chat notifications';
  button.classList.toggle('is-muted',communityMuted);
 }
 if(icon)icon.textContent=communityMuted?'🔕':'🔔';
}
async function toggleCommunityMute(){
 const next=!communityMuted,button=$('chatMuteButton');if(button)button.disabled=true;
 try{
  const response=await fetch('/api/notifications/community-mute',{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({muted:next})});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(data.message||'Could not change mute setting.');
  communityMuted=!!data.communityMuted;syncCommunityMuteControls();
  toast(communityMuted?'Community chat notifications muted.':'Community chat notifications unmuted.');
 }catch(error){toast(error.message||'Could not change mute setting.');}
 finally{if(button)button.disabled=false;}
}
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&currentUser)refreshNotifications()});
function timeAgo(dateString) {
  if (!dateString) return 'Recently';
  try {
    const s = String(dateString).trim();
    let d = new Date(s.includes('T') ? s : s.replace(' ', 'T'));
    if (isNaN(d.getTime())) return dateString;
    const diff = Math.floor((Date.now() - d.getTime()) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
    if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
    if (diff < 604800) return Math.floor(diff / 86400) + 'd ago';
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return dateString;
  }
}

function categoryEmoji(category) {
  const cat = String(category || '').toLowerCase();
  if (cat.includes('elect')) return '📱';
  if (cat.includes('id')) return '🪪';
  if (cat.includes('key')) return '🔑';
  if (cat.includes('wallet') || cat.includes('purse')) return '👛';
  if (cat.includes('book') || cat.includes('stationery')) return '📚';
  if (cat.includes('cloth')) return '👕';
  if (cat.includes('bottle')) return '💧';
  return '🏷️';
}

function askAboutItemInChat(reportId, title) {
  openCommunityChat();
  const input = $('communityChatInput');
  if (input) {
    input.value = `Hi everyone, regarding the "${title}" posted on CampUs — is this still available or has anyone claimed it?`;
    input.focus();
  }
}

function viewFullImage(src) {
  const box = $('imageLightbox');
  const img = $('lightboxImg');
  if (box && img) {
    img.src = src;
    box.classList.remove('hide');
  }
}

function closeLightbox() {
  const box = $('imageLightbox');
  if (box) box.classList.add('hide');
}

function setFormType(type) {
  const t = $('type');
  if (t) t.value = type;
  const lostBtn = $('modalTypeLost');
  const foundBtn = $('modalTypeFound');
  const title = $('formTitle');
  const secWrap = $('foundSecretQuestionWrap');
  if (type === 'LOST') {
    if (lostBtn) {
      lostBtn.style.background = '#FEECE9';
      lostBtn.style.color = '#E05A47';
      lostBtn.style.borderColor = '#E05A47';
    }
    if (foundBtn) {
      foundBtn.style.background = '#ffffff';
      foundBtn.style.color = '#79512E';
      foundBtn.style.borderColor = '#EFE6DC';
    }
    if (title) title.textContent = 'Report a Lost Item';
    if (secWrap) secWrap.classList.add('hide');
  } else {
    if (foundBtn) {
      foundBtn.style.background = '#E8F8F0';
      foundBtn.style.color = '#2E9D64';
      foundBtn.style.borderColor = '#2E9D64';
    }
    if (lostBtn) {
      lostBtn.style.background = '#ffffff';
      lostBtn.style.color = '#79512E';
      lostBtn.style.borderColor = '#EFE6DC';
    }
    if (title) title.textContent = 'Report a Found Item';
    if (secWrap) secWrap.classList.remove('hide');
  }
}

function filterByCategory(cat) {
  const catInput = $('filterCategory');
  if (catInput) catInput.value = cat;
  document.querySelectorAll('.category-chip').forEach(chip => {
    const text = chip.textContent;
    chip.classList.toggle('active', (cat === '' && text.includes('All')) || text.includes(cat));
  });
  load();
}

function switchNavTab(tab) {
  document.querySelectorAll('.bottom-nav-item').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.nav === tab);
  });
  document.querySelectorAll('.desk-nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.deskNav === tab);
  });
  if (tab === 'feed') {
    closeExplorePage(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    myReportsOnly = false;
    statFilter = '';
    load();
  } else if (tab === 'explore') {
    openExplorePage();
  } else if (tab === 'chat') {
    openCommunityChat();
  } else if (tab === 'profile') {
    openDesktopProfile();
  }
}

let mobileSearchTimer = null;
function syncMobileSearch(val) {
  const qEl = $('q');
  if (qEl) qEl.value = val;
  const deskSearch = $('boardSearch');
  if (deskSearch && deskSearch.value !== val) {
    deskSearch.value = val;
  }
  clearTimeout(mobileSearchTimer);
  mobileSearchTimer = setTimeout(load, 180);
}

function openOwnProfileTab() {
  openDesktopProfile();
}

function normWords(s){return String(s||'').toLowerCase().replace(/[^a-z0-9\s]/g,' ').split(/\s+/).filter(w=>w.length>2&&!['the','and','for','with','item','lost','found'].includes(w))}
function matchScore(a,b){const aw=new Set(normWords((a.title||'')+' '+(a.description||''))),bw=new Set(normWords((b.title||'')+' '+(b.description||'')));const common=[...aw].filter(w=>bw.has(w)).length;const sameTitle=String(a.title||'').trim().toLowerCase()===String(b.title||'').trim().toLowerCase();const sameCat=String(a.category||'').toLowerCase()===String(b.category||'').toLowerCase();if(sameTitle)return 10+(sameCat?2:0);if(common===0)return 0;return common+(sameCat?1:0)}
function bestMatch(r,all){return all.filter(x=>x.type!==r.type&&x.status!=='RETURNED').map(x=>({item:x,score:matchScore(r,x)})).filter(x=>x.score>=2).sort((a,b)=>b.score-a.score)[0]?.item||null}
function updatePoster(all){const returned=all.filter(x=>String(x.status||'').toUpperCase()==='RETURNED').sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||'')));if(!returned.length){if($('matchIcon'))$('matchIcon').textContent='⌕';if($('matchName'))$('matchName').textContent='No items returned yet';if($('matchMeta'))$('matchMeta').textContent='Successfully returned items will appear here';if($('matchBadge')){$('matchBadge').textContent='WAITING FOR RETURN';$('matchBadge').classList.remove('match-yes');}return}const item=returned[0];if($('matchIcon'))$('matchIcon').textContent=String(item.category||'').toLowerCase().includes('id')?'🪪':String(item.category||'').toLowerCase().includes('electronic')?'🎧':'✓';if($('matchName'))$('matchName').textContent=item.title||'Returned item';if($('matchMeta'))$('matchMeta').textContent=`Returned · ${item.location||'Location not specified'}${item.itemDate?' · '+item.itemDate:''}`;if($('matchBadge')){$('matchBadge').textContent='SUCCESSFULLY RETURNED';$('matchBadge').classList.add('match-yes');}}
function clearFilters(){['q','filterCategory','filterLocation','dateFrom','dateTo'].forEach(id=>{const field=$(id);if(field)field.value=''});if($('boardSearch'))$('boardSearch').value='';if($('mobileBoardSearch'))$('mobileBoardSearch').value='';chosenType='';statFilter='';myReportsOnly=false;document.querySelectorAll('.status-tab').forEach(x=>x.classList.toggle('active',x.dataset.tabStatus==='ALL'));document.querySelectorAll('.category-chip').forEach(c=>c.classList.toggle('active',c.textContent.includes('All')));if($('myReports'))$('myReports').textContent='My reports';load()}
function filterStats(which){statFilter=which;chosenType='';myReportsOnly=false;document.querySelectorAll('.status-tab').forEach(x=>x.classList.toggle('active',x.dataset.tabStatus===which));load();const board=$('board');if(board)board.scrollIntoView({behavior:'smooth',block:'start'});}
function toggleMyReports(){statFilter='';myReportsOnly=!myReportsOnly;if($('myReports'))$('myReports').textContent=myReportsOnly?'Show all reports':'My reports';load()}
function showMyReports(e){if(e)e.preventDefault();showNavPopup('myReports')}
function passesFilters(r){const q=($('q')?.value||'').trim().toLowerCase(),cat=$('filterCategory')?.value||'',loc=($('filterLocation')?.value||'').trim().toLowerCase(),from=$('dateFrom')?.value||'',to=$('dateTo')?.value||'';const text=[r.title,r.category,r.location,r.description].join(' ').toLowerCase();if(q&&!text.includes(q))return false;if(cat&&r.category!==cat)return false;if(loc&&!String(r.location||'').toLowerCase().includes(loc))return false;if(from&&r.itemDate&&r.itemDate<from)return false;if(to&&r.itemDate&&r.itemDate>to)return false;return true}
function renderPostCardMarkup(r, all) {
  const m = bestMatch(r, all || cachedAllReports || []);
  const authorName = String(r.ownerDisplayName || r.reporterName || 'CampUs user').trim() || 'CampUs user';
  const ownerUsername = String(r.accountUsername || '');
  const avatarContent = avatarInner(r.ownerAvatarId, authorName, r.ownerProfileImageUrl);
  const roleBadge = roleBadgeMarkup(r.ownerRole);
  const canEdit = !!(currentUser && ownerUsername && ownerUsername.toLowerCase() === currentUser.username.toLowerCase());
  const typeIsFound = String(r.type || '').toUpperCase() === 'FOUND';
  const cleanPhone = String(r.reporterPhone || '').replace(/[^0-9]/g, '');
  const waPhone = cleanPhone.length === 10 ? '91' + cleanPhone : cleanPhone;
  const waText = encodeURIComponent(`Hi ${authorName}! I saw your ${r.type} report for "${r.title}" on CampUs.`);
  const waUrl = cleanPhone ? `https://wa.me/${waPhone}?text=${waText}` : '';
  const postTime = timeAgo(r.createdAt || r.itemDate);
  const collegeTag = r.college ? collegeDisplayName(r.college) : (currentUser ? currentUser.collegeName : 'Campus');

  const statusControl = canEdit
   ? `<select class="action-status-select" onchange="updateStatus(${r.id},this.value)" aria-label="Update status"><option value="OPEN" ${r.status==='OPEN'?'selected':''}>● Open</option><option value="MATCHED" ${r.status==='MATCHED'?'selected':''}>● Matched</option><option value="RETURNED" ${r.status==='RETURNED'?'selected':''}>✓ Returned</option></select>`
   : `<span class="insta-status-badge ${String(r.status||'').toUpperCase()==='RETURNED'?'returned':''}">${esc(r.status)}</span>`;

  let claimActionHtml = '';
  if (typeIsFound && String(r.status || '').toUpperCase() !== 'RETURNED') {
    if (canEdit) {
      claimActionHtml = `<button type="button" class="view-claims-btn" onclick="openClaimsViewer(${r.id})" title="Review submitted ownership claims"><span>👀 View Claims (${r.claimCount || 0})</span></button>`;
    } else {
      claimActionHtml = `<button type="button" class="claim-action-btn" onclick="openClaimModal(${r.id},'${esc(r.title)}','${esc(r.secretQuestion||'')}')"><span>✋ Claim Item</span></button>`;
    }
  }

  return `<article class="insta-post-card" id="post-card-${r.id}" data-report-id="${r.id}">
    <div class="insta-post-header">
      <button type="button" class="insta-post-author" onclick="openChatUserProfile('${esc(authorName)}','${esc(ownerUsername)}')" aria-label="View ${esc(authorName)}'s profile">
        <div class="insta-post-avatar">${avatarContent}</div>
        <div class="insta-post-author-text">
          <span class="insta-post-author-name">${esc(authorName)} ${roleBadge}</span>
          <span class="insta-post-author-sub">@${esc(ownerUsername||'student')} · ${esc(postTime)} · ${esc(collegeTag)}</span>
        </div>
      </button>
      <div class="insta-post-badges">
        <span class="insta-type-badge ${typeIsFound?'found':'lost'}">${typeIsFound?'🟢 FOUND':'🔴 LOST'}</span>
        ${r.matchScore && r.matchScore >= 40 ? `<span class="smart-match-score-pill" title="AI Match Confidence">✨ ${r.matchScore}% Match</span>` : ''}
        ${!canEdit?statusControl:''}
      </div>
    </div>
    ${r.imageData?`<div class="insta-post-media" onclick="viewFullImage('${esc(r.imageData)}')" title="Click to view full photo"><img src="${esc(r.imageData)}" alt="Photo of ${esc(r.title)}" loading="lazy"></div>`:`<div class="insta-post-no-media"><div class="insta-no-media-icon">${categoryEmoji(r.category)}</div><div class="insta-no-media-text"><b>${esc(r.category||'Item')}</b><small>No photo attached by reporter</small></div></div>`}
    <div class="insta-post-body">
      <div class="insta-post-tags">
        <span class="insta-meta-tag">${categoryEmoji(r.category)} ${esc(r.category)}</span>
        <span class="insta-meta-tag">📍 ${esc(r.location)}</span>
        ${r.itemDate?`<span class="insta-meta-tag">📅 ${esc(r.itemDate)}</span>`:''}
      </div>
      <h3 class="insta-post-title">${esc(r.title)}</h3>
      ${r.description?`<p class="insta-post-desc">${esc(r.description)}</p>`:''}
      ${m?`<div class="insta-match-banner"><span>✦ Possible Match:</span><b>${esc(m.title)}</b> (${esc(m.type)} at ${esc(m.location)})</div>`:''}
    </div>

    <!-- Instagram-style Social Bar (Like, Comment, Share, Archive) -->
    <div class="insta-social-bar">
      <div class="insta-social-left">
        <button type="button" class="insta-social-btn like-btn like-btn-${r.id} ${r.likedByMe ? 'active' : ''}" onclick="togglePostLike(${r.id}, this)" aria-label="Like post">
          <span class="social-icon heart-icon-${r.id}">${r.likedByMe ? '❤️' : '🤍'}</span>
          <span class="social-count like-count-${r.id}">${r.likeCount || 0}</span>
        </button>
        <button type="button" class="insta-social-btn comment-btn" onclick="openPostComments(${r.id})" aria-label="Comments">
          <span class="social-icon">💬</span>
          <span class="social-count comment-count-${r.id}">${r.commentCount || 0}</span>
        </button>
        <button type="button" class="insta-social-btn share-btn" onclick="sharePost(${r.id}, '${esc(r.title)}')" aria-label="Share post">
          <span class="social-icon">🔗</span>
          <span class="social-text">Share</span>
        </button>
      </div>
      ${canEdit ? `
        <div class="insta-social-right">
          <button type="button" class="insta-action-pill archive-pill" onclick="archiveReport(${r.id})" title="Archive post (hides from feed)">📁 Archive</button>
        </div>
      ` : ''}
    </div>

    <div class="insta-post-actions">
      ${canEdit ? `
        <div class="insta-owner-actions">
          <label class="owner-status-label">
            Status: ${statusControl}
          </label>
          ${claimActionHtml}
          <button type="button" class="action-btn-del" onclick="deleteReport(${r.id})" title="Move to Recently Deleted (restorable for 30 days)">🗑 Delete</button>
        </div>
      ` : `
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;width:100%;">
          ${claimActionHtml}
          ${waUrl?`<a class="action-btn-whatsapp" href="${waUrl}" target="_blank" rel="noopener noreferrer"><span>💬 WhatsApp</span></a>`:''}
          ${cleanPhone?`<a class="action-btn-call" href="tel:${cleanPhone}"><span>📞 Call</span></a>`:''}
          <button type="button" class="action-btn-chat" onclick="askAboutItemInChat(${r.id},'${esc(r.title)}')"><span>💬 Ask in Chat</span></button>
        </div>
      `}
    </div>
  </article>`;
}

async function load(){
  try{
    const allRes=await fetch(myReportsOnly?'/api/reports?mine=true':'/api/reports');
    if(!allRes.ok){
      if(allRes.status===401){
        $('total').textContent='0';$('lost').textContent='0';$('found').textContent='0';$('returned').textContent='0';$('resultCount').textContent='Backend connection required';$('grid').innerHTML='<div class="empty"><b>Welcome to CampUs</b><p>The website is open. Connect the CampUs backend to load reports and enable submissions.</p></div>';
        return;
      }
      throw 0;
    }
    const all=await allRes.json();
    if(!myReportsOnly){
      cachedAllReports=all;
      renderExploreGrid();
    }
    updatePoster(all);
    $('total').textContent=all.length;
    $('lost').textContent=all.filter(x=>x.type==='LOST').length;
    $('found').textContent=all.filter(x=>x.type==='FOUND').length;
    $('returned').textContent=all.filter(x=>x.status==='RETURNED').length;
    let rows=all.filter(r=>(!chosenType||r.type===chosenType)&&(!statFilter||statFilter==='ALL'||(statFilter==='LOST'&&r.type==='LOST')||(statFilter==='FOUND'&&r.type==='FOUND')||(statFilter==='RETURNED'&&r.status==='RETURNED'))&&passesFilters(r));
    $('resultCount').textContent=`${rows.length} report${rows.length===1?'':'s'} shown`;
    if(!rows.length){
      const hasSearch=($('q')?.value||'').trim()||$('filterCategory')?.value||($('filterLocation')?.value||'').trim()||$('dateFrom')?.value||$('dateTo')?.value||chosenType;
      const heading=myReportsOnly?'You have not submitted any reports yet':(hasSearch?'No matching reports found':'No lost or found items reported yet');
      const message=myReportsOnly?'Reports submitted from your account will appear here.':(hasSearch?'Try changing your search or filters, or clear them to see all reports.':'When someone reports a lost or found item, it will appear here. You can post a report anytime using the + button.');
      $('grid').innerHTML=`<div class="empty"><b>${heading}</b><p>${message}</p>${hasSearch?'<button type="button" class="light" onclick="clearFilters()" style="margin-top:12px;">Clear filters</button>':''}</div>`;
      return;
    }
    $('grid').innerHTML=rows.map(r=>renderPostCardMarkup(r,all)).join('');
    checkDirectPostLink();
  }
  catch{
    $('grid').innerHTML='<div class="empty"><b>Backend not connected</b><p>Start the Java app, then refresh this page.</p></div>';
  }
}
$('photo').addEventListener('change',()=>{const file=$('photo').files[0];if(!file){$('photoPreview').src='';$('photoPreview').classList.add('hide');return}if(!file.type.startsWith('image/')){toast('Please choose an image file.');$('photo').value='';return}const reader=new FileReader();reader.onload=()=>{$('photoPreview').src=reader.result;$('photoPreview').classList.remove('hide')};reader.onerror=()=>{toast('Could not read the photo. Please try another image.');$('photo').value='';$('photoPreview').src='';$('photoPreview').classList.add('hide')};reader.readAsDataURL(file)});
$('modal').addEventListener('click',e=>{if(e.target===$('modal'))closeForm()});document.addEventListener('keydown',e=>{if(e.key==='Escape')closeForm()});
$('form').addEventListener('submit',async e=>{e.preventDefault();const file=$('photo').files[0];let imageData=null;if(file){try{imageData=await compressProfileImage(file,1200,1200,0.8)}catch{try{imageData=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file)})}catch{$('error').textContent='Could not read the photo. Please try another image.';return}}}
let payload={imageData,type:$('type').value,title:$('title').value.trim(),category:$('category').value,location:$('location').value.trim(),itemDate:$('itemDate').value||null,reporterName:$('name').value.trim(),reporterPhone:$('phone').value.trim(),description:$('description').value.trim(),secretQuestion:$('secretQuestion')?$('secretQuestion').value.trim():''};
try{let res=await fetch('/api/reports',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});if(!res.ok){let d=await res.json().catch(()=>({}));throw Error(d.message||'Please check the form and try again.')}const created=await res.json().catch(()=>null);$('form').reset();if($('secretQuestion'))$('secretQuestion').value='';$('photoPreview').src='';$('photoPreview').classList.add('hide');closeForm();toast('Report submitted. Thanks for helping your campus! 💜');load()}catch(err){$('error').textContent=err.message||'Could not submit report.'}});
async function updateStatus(id,status){try{let r=await fetch(`/api/reports/${id}/status`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status})});if(!r.ok)throw 0;toast('Status updated');load()}catch{toast('Could not update status')}}

/* --------------------------------------------------------------------------
   SOCIAL FEATURES: LIKES, SHARE, ARCHIVE, RECYCLE BIN & THREADED COMMENTS
   -------------------------------------------------------------------------- */
async function togglePostLike(id, btnEl) {
  try {
    const res = await fetch(`/api/reports/${id}/like`, { method: 'POST' });
    if (!res.ok) throw 0;
    const data = await res.json();
    document.querySelectorAll(`.like-count-${id}`).forEach(el => el.textContent = data.count || 0);
    document.querySelectorAll(`.heart-icon-${id}`).forEach(el => el.textContent = data.liked ? '❤️' : '🤍');
    document.querySelectorAll(`.like-btn-${id}`).forEach(el => el.classList.toggle('active', data.liked));
    const cached = (cachedAllReports || []).find(x => x.id === id);
    if (cached) {
      cached.likedByMe = data.liked;
      cached.likeCount = data.count || 0;
    }
  } catch {
    toast('Could not update like.');
  }
}

async function sharePost(id, title) {
  const postUrl = `${window.location.origin}/?report=${id}`;
  const shareData = {
    title: `CampUs: ${title}`,
    text: `Lost & Found Report on CampUs: "${title}"`,
    url: postUrl
  };

  if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
    try {
      await navigator.share(shareData);
      return;
    } catch (err) {
      if (err.name === 'AbortError') return;
    }
  }

  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(postUrl);
      toast('Post link copied to clipboard! 📋');
    } else {
      const temp = document.createElement('input');
      temp.value = postUrl;
      document.body.appendChild(temp);
      temp.select();
      document.execCommand('copy');
      document.body.removeChild(temp);
      toast('Post link copied to clipboard! 📋');
    }
  } catch {
    prompt('Copy this link to share the post:', postUrl);
  }
}

function checkDirectPostLink() {
  try {
    const params = new URLSearchParams(window.location.search);
    const reportId = params.get('report') || (window.location.hash.startsWith('#report-') ? window.location.hash.replace('#report-', '') : null);
    if (reportId) {
      setTimeout(() => {
        const card = document.querySelector(`[data-report-id="${reportId}"]`);
        if (card) {
          card.scrollIntoView({ behavior: 'smooth', block: 'center' });
          card.classList.add('post-card-highlight');
          setTimeout(() => card.classList.remove('post-card-highlight'), 3500);
        }
      }, 350);
    }
  } catch {}
}

async function archiveReport(id) {
  if (!confirm('Archive this post? It will be hidden from the campus feed and saved in Your Activity > Archive.')) return;
  try {
    const res = await fetch(`/api/reports/${id}/archive`, { method: 'POST' });
    if (!res.ok) throw 0;
    toast('Post moved to Archive 📁');
    if ($('postDetailViewer') && !$('postDetailViewer').classList.contains('hide')) {
      closePostDetailViewer();
    }
    load();
    if ($('communityProfilePage') && !$('communityProfilePage').classList.contains('hide')) {
      openOwnPublicProfile();
    }
  } catch {
    toast('Could not archive post.');
  }
}

async function unarchiveReport(id) {
  try {
    const res = await fetch(`/api/reports/${id}/unarchive`, { method: 'POST' });
    if (!res.ok) throw 0;
    toast('Post restored to the campus feed! 🏠');
    switchActivityTab('archive');
    load();
  } catch {
    toast('Could not unarchive post.');
  }
}

async function deleteReport(id, fromActivity = false) {
  if (!confirm('Move this post to Recently Deleted? You can restore it anytime within 30 days.')) return;
  try {
    const res = await fetch(`/api/reports/${id}`, { method: 'DELETE', headers: { 'Accept': 'application/json' } });
    if (!res.ok) throw 0;
    toast('Post moved to Recently Deleted (Restorable for 30 days) 🗑️');
    if ($('postDetailViewer') && !$('postDetailViewer').classList.contains('hide')) {
      closePostDetailViewer();
    }
    load();
    if (fromActivity) {
      switchActivityTab('archive');
    }
    if ($('communityProfilePage') && !$('communityProfilePage').classList.contains('hide')) {
      openOwnPublicProfile();
    }
  } catch {
    toast('Could not delete post.');
  }
}

async function restoreReport(id) {
  try {
    const res = await fetch(`/api/reports/${id}/restore`, { method: 'POST' });
    if (!res.ok) throw 0;
    toast('Post restored to the campus feed! 🎉');
    switchActivityTab('deleted');
    load();
  } catch {
    toast('Could not restore post.');
  }
}

async function permanentlyDeleteReport(id) {
  if (!confirm('Permanently delete this report? This cannot be undone.')) return;
  try {
    const res = await fetch(`/api/reports/${id}/permanent`, { method: 'DELETE' });
    if (!res.ok) throw 0;
    toast('Post permanently deleted.');
    switchActivityTab('deleted');
  } catch {
    toast('Could not permanently delete post.');
  }
}

/* --------------------------------------------------------------------------
   YOUR ACTIVITY CENTER (Archive, Recently Deleted, Likes)
   -------------------------------------------------------------------------- */
let currentActivityTab = 'archive';

function openActivityCenter(defaultTab = 'archive') {
  closeNavDrawer();
  const modal = $('activityCenterModal');
  if (!modal) return;
  pushCampusUiLayer('activityCenterModal');
  modal.classList.remove('hide');
  document.body.classList.add('fullscreen-page-open');
  switchActivityTab(defaultTab);
}

function closeActivityCenter(fromPopstate = false) {
  const modal = $('activityCenterModal');
  if (modal && !modal.classList.contains('hide')) {
    modal.classList.add('hide');
    document.body.classList.remove('fullscreen-page-open');
    finishCampusUiLayer('activityCenterModal', fromPopstate);
  }
}

async function switchActivityTab(tab) {
  currentActivityTab = tab;
  document.querySelectorAll('.activity-tab').forEach(b => {
    b.classList.toggle('active', b.dataset.actTab === tab);
  });
  const container = $('activityContent');
  if (!container) return;
  container.innerHTML = '<div class="empty">Loading…</div>';

  try {
    if (tab === 'archive') {
      const res = await fetch('/api/reports/archived');
      const list = await res.json().catch(() => []);
      const badge = $('activityArchiveBadge');
      if (badge) badge.textContent = list.length;
      if (!list.length) {
        container.innerHTML = `
          <div class="empty">
            <span class="activity-empty-icon" style="font-size:32px;display:block;margin-bottom:8px;">📁</span>
            <b>No Archived Posts</b>
            <p>Posts you archive will appear here. Only you can see them.</p>
          </div>`;
        return;
      }
      container.innerHTML = `
        <div class="activity-info-banner">
          <span>📁</span>
          <p><b>Archive:</b> These reports are hidden from the public feed. You can unarchive them anytime to show them back on the feed.</p>
        </div>
        <div class="activity-cards-list">
          ${list.map(r => `
            <article class="activity-post-card" id="act-post-${r.id}">
              <div class="activity-card-meta">
                <span class="pill ${r.type === 'FOUND' ? 'found' : ''}">● ${r.type}</span>
                <span class="activity-date" style="font-size:11px;color:#A49385;">Archived ${timeAgo(r.archivedAt || r.createdAt)}</span>
              </div>
              <h3 class="activity-card-title">${esc(r.title)}</h3>
              <p class="activity-card-desc">${esc(r.description || 'No description provided')}</p>
              <div class="activity-card-tags">
                <span>${categoryEmoji(r.category)} ${esc(r.category)}</span>
                <span>📍 ${esc(r.location)}</span>
              </div>
              <div class="activity-card-actions">
                <button type="button" class="act-btn-restore" onclick="unarchiveReport(${r.id})">↺ Unarchive (Show on Feed)</button>
                <button type="button" class="act-btn-delete" onclick="deleteReport(${r.id}, true)">🗑 Move to Trash</button>
              </div>
            </article>
          `).join('')}
        </div>`;
    } else if (tab === 'deleted') {
      const res = await fetch('/api/reports/deleted');
      const list = await res.json().catch(() => []);
      const badge = $('activityDeletedBadge');
      if (badge) badge.textContent = list.length;
      if (!list.length) {
        container.innerHTML = `
          <div class="empty">
            <span class="activity-empty-icon" style="font-size:32px;display:block;margin-bottom:8px;">🗑️</span>
            <b>Recently Deleted is Empty</b>
            <p>Deleted posts stay here for 30 days before permanent removal.</p>
          </div>`;
        return;
      }
      container.innerHTML = `
        <div class="activity-info-banner warning">
          <span>⏳</span>
          <p><b>Recently Deleted:</b> Items remain here for 30 days. You can restore them to the feed anytime. After 30 days, they are permanently deleted.</p>
        </div>
        <div class="activity-cards-list">
          ${list.map(r => `
            <article class="activity-post-card deleted" id="act-post-${r.id}">
              <div class="activity-card-meta">
                <span class="pill ${r.type === 'FOUND' ? 'found' : ''}">● ${r.type}</span>
                <span class="activity-countdown-badge">⏳ ${r.daysRemaining != null ? r.daysRemaining : 30} days left</span>
              </div>
              <h3 class="activity-card-title">${esc(r.title)}</h3>
              <p class="activity-card-desc">${esc(r.description || 'No description provided')}</p>
              <div class="activity-card-tags">
                <span>${categoryEmoji(r.category)} ${esc(r.category)}</span>
                <span>📍 ${esc(r.location)}</span>
              </div>
              <div class="activity-card-actions">
                <button type="button" class="act-btn-restore" onclick="restoreReport(${r.id})">↺ Restore to Feed</button>
                <button type="button" class="act-btn-permanent" onclick="permanentlyDeleteReport(${r.id})">✕ Delete Forever</button>
              </div>
            </article>
          `).join('')}
        </div>`;
    } else if (tab === 'likes') {
      const res = await fetch('/api/reports/liked');
      const list = await res.json().catch(() => []);
      const badge = $('activityLikesBadge');
      if (badge) badge.textContent = list.length;
      if (!list.length) {
        container.innerHTML = `
          <div class="empty">
            <span class="activity-empty-icon" style="font-size:32px;display:block;margin-bottom:8px;">❤️</span>
            <b>No Liked Posts Yet</b>
            <p>Tap the heart icon on any post in the feed to save it to your likes.</p>
          </div>`;
        return;
      }
      container.innerHTML = `
        <div class="activity-info-banner">
          <span>❤️</span>
          <p><b>Posts You Liked:</b> A collection of campus reports you showed support for.</p>
        </div>
        <div class="activity-cards-list">
          ${list.map(r => `
            <article class="activity-post-card" id="act-post-${r.id}">
              <div class="activity-card-meta">
                <span class="pill ${r.type === 'FOUND' ? 'found' : ''}">● ${r.type}</span>
                <span class="activity-date" style="font-size:11px;color:#A49385;">${timeAgo(r.createdAt)}</span>
              </div>
              <h3 class="activity-card-title">${esc(r.title)}</h3>
              <p class="activity-card-desc">${esc(r.description || 'No description provided')}</p>
              <div class="activity-card-tags">
                <span>${categoryEmoji(r.category)} ${esc(r.category)}</span>
                <span>📍 ${esc(r.location)}</span>
              </div>
              <div class="activity-card-actions">
                <button type="button" class="act-btn-view" onclick="viewPostFromActivity(${r.id})">👀 View Post</button>
                <button type="button" class="act-btn-share" onclick="sharePost(${r.id}, '${esc(r.title)}')">🔗 Share</button>
              </div>
            </article>
          `).join('')}
        </div>`;
    }
  } catch (err) {
    container.innerHTML = `<div class="empty"><b>Could not load activity</b><p>${esc(err.message || 'Please try again.')}</p></div>`;
  }
}

function viewPostFromActivity(reportId) {
  closeActivityCenter();
  myReportsOnly = false;
  chosenType = '';
  statFilter = '';
  load();
  setTimeout(() => {
    const card = document.querySelector(`[data-report-id="${reportId}"]`);
    if (card) {
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      card.classList.add('post-card-highlight');
      setTimeout(() => card.classList.remove('post-card-highlight'), 3500);
    }
  }, 400);
}

/* --------------------------------------------------------------------------
   INSTAGRAM-STYLE EXPLORE & SEARCH PAGE
   -------------------------------------------------------------------------- */
async function ensureExploreReports() {
  if (cachedAllReports && cachedAllReports.length > 0) {
    renderExploreGrid();
    return;
  }
  try {
    const res = await fetch('/api/reports');
    if (res.ok) {
      cachedAllReports = await res.json();
      renderExploreGrid();
    }
  } catch (err) {
    console.error('Failed to load explore reports', err);
  }
}

function openExplorePage() {
  const page = $('explorePage');
  if (!page) return;
  pushCampusUiLayer('explorePage');
  page.classList.remove('hide');
  document.body.classList.add('explore-open');
  document.querySelectorAll('.bottom-nav-item').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.nav === 'explore');
  });
  document.querySelectorAll('.desk-nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.deskNav === 'explore');
  });
  ensureExploreReports();
  setTimeout(() => {
    const input = $('exploreSearchInput');
    if (input) {
      input.focus();
    }
  }, 100);
}

function closeExplorePage(fromPopstate = false) {
  const page = $('explorePage');
  if (!page || page.classList.contains('hide')) return;
  page.classList.add('hide');
  document.body.classList.remove('explore-open');
  document.querySelectorAll('.bottom-nav-item').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.nav === 'feed');
  });
  document.querySelectorAll('.desk-nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.deskNav === 'feed');
  });
  finishCampusUiLayer('explorePage', fromPopstate);
}

function filterExploreType(type) {
  exploreTypeFilter = type || '';
  document.querySelectorAll('.explore-type-pill').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.expType === exploreTypeFilter);
  });
  renderExploreGrid();
}

function filterExploreCategory(cat) {
  exploreCategoryFilter = cat || '';
  document.querySelectorAll('.explore-cat-chip').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.expCat === exploreCategoryFilter);
  });
  renderExploreGrid();
}

function clearExploreFilters() {
  exploreTypeFilter = '';
  exploreCategoryFilter = '';
  exploreSearchQuery = '';
  const input = $('exploreSearchInput');
  if (input) input.value = '';
  const clearBtn = $('exploreSearchClear');
  if (clearBtn) clearBtn.classList.add('hide');
  document.querySelectorAll('.explore-type-pill').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.expType === '');
  });
  document.querySelectorAll('.explore-cat-chip').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.expCat === '');
  });
  const memberWrap = $('exploreMemberResults');
  if (memberWrap) {
    memberWrap.innerHTML = '';
    memberWrap.classList.add('hide');
  }
  renderExploreGrid();
}

function handleExploreSearch(val) {
  exploreSearchQuery = String(val || '').trim();
  const clearBtn = $('exploreSearchClear');
  if (clearBtn) {
    clearBtn.classList.toggle('hide', !exploreSearchQuery);
  }
  clearTimeout(exploreSearchTimer);
  exploreSearchTimer = setTimeout(() => {
    renderExploreGrid();
    searchExploreMembers(exploreSearchQuery);
  }, 150);
}

function clearExploreSearch() {
  const input = $('exploreSearchInput');
  if (input) {
    input.value = '';
    input.focus();
  }
  handleExploreSearch('');
}

async function searchExploreMembers(query) {
  const wrap = $('exploreMemberResults');
  if (!wrap) return;
  const needle = String(query || '').trim().replace(/^@/, '').toLowerCase();
  if (!needle || needle.length < 2) {
    wrap.innerHTML = '';
    wrap.classList.add('hide');
    return;
  }
  const seq = ++exploreMemberSearchSeq;
  try {
    const res = await fetch(`/api/users/search?q=${encodeURIComponent(needle)}`, {
      headers: { 'Accept': 'application/json' }
    });
    if (seq !== exploreMemberSearchSeq) return;
    if (!res.ok) {
      wrap.innerHTML = '';
      wrap.classList.add('hide');
      return;
    }
    const data = await res.json();
    const members = Array.isArray(data.members) ? data.members : [];
    if (!members.length) {
      wrap.innerHTML = '';
      wrap.classList.add('hide');
      return;
    }
    wrap.innerHTML = members.slice(0, 4).map(m => {
      const name = m.displayName || m.username || 'Member';
      return `<button type="button" class="explore-member-item" onclick="openChatUserProfile('${esc(name)}','${esc(m.username)}')">
        <div class="explore-member-avatar">${avatarInner(m.avatarId, name, m.profileImageUrl)}</div>
        <div class="explore-member-info">
          <b>${esc(name)} ${roleBadgeMarkup(m.role)}</b>
          <small>@${esc(m.username || 'user')} · ${esc(m.course || collegeDisplayName(m.college) || 'Student')}</small>
        </div>
      </button>`;
    }).join('');
    wrap.classList.remove('hide');
  } catch {
    wrap.innerHTML = '';
    wrap.classList.add('hide');
  }
}

function renderExploreGrid() {
  const grid = $('exploreGrid');
  if (!grid) return;
  let list = Array.isArray(cachedAllReports) ? cachedAllReports : [];

  if (exploreTypeFilter) {
    if (exploreTypeFilter === 'RETURNED') {
      list = list.filter(r => String(r.status || '').toUpperCase() === 'RETURNED');
    } else {
      list = list.filter(r => String(r.type || '').toUpperCase() === exploreTypeFilter);
    }
  }

  if (exploreCategoryFilter) {
    list = list.filter(r => String(r.category || '').toLowerCase() === exploreCategoryFilter.toLowerCase());
  }

  if (exploreSearchQuery) {
    const q = exploreSearchQuery.toLowerCase();
    list = list.filter(r => {
      const text = [
        r.title,
        r.category,
        r.location,
        r.description,
        r.ownerDisplayName,
        r.reporterName,
        r.accountUsername
      ].join(' ').toLowerCase();
      return text.includes(q);
    });
  }

  const countBadge = $('exploreCountTotal');
  if (countBadge) {
    countBadge.textContent = list.length;
  }

  if (!list.length) {
    grid.innerHTML = `
      <div class="explore-empty-state">
        <span class="explore-empty-icon">🔍</span>
        <b>No matching posts</b>
        <p>Try searching for a different item name or clear your filters.</p>
        ${(exploreTypeFilter || exploreCategoryFilter || exploreSearchQuery) ? '<button type="button" class="insta-action-pill" onclick="clearExploreFilters()" style="margin-top:12px;">Clear filters</button>' : ''}
      </div>
    `;
    return;
  }

  grid.innerHTML = list.map(r => {
    const isFound = String(r.type || '').toUpperCase() === 'FOUND';
    const isReturned = String(r.status || '').toUpperCase() === 'RETURNED';
    const badgeClass = isReturned ? 'returned' : (isFound ? 'found' : 'lost');
    const badgeText = isReturned ? '✨ RETURNED' : (isFound ? '🟢 FOUND' : '🔴 LOST');
    const likes = r.likeCount || 0;
    const comments = r.commentCount || 0;
    const hasImage = Boolean(r.imageData);

    const mediaMarkup = hasImage
      ? `<img src="${esc(r.imageData)}" alt="${esc(r.title)}" class="explore-tile-img" loading="lazy">`
      : `<div class="explore-tile-nophoto">
           <span class="explore-tile-nophoto-emoji">${categoryEmoji(r.category)}</span>
           <span class="explore-tile-nophoto-title">${esc(r.title)}</span>
         </div>`;

    return `<button type="button" class="explore-tile" onclick="openPostDetail(${r.id})" aria-label="View ${esc(r.title)}">
      ${mediaMarkup}
      <span class="explore-tile-badge ${badgeClass}">${badgeText}</span>
      <div class="explore-tile-overlay">
        <div class="explore-tile-overlay-stats">
          <span>❤️ ${likes}</span>
          <span>💬 ${comments}</span>
        </div>
        <div class="explore-tile-overlay-title">${esc(r.title)}</div>
      </div>
    </button>`;
  }).join('');
}

function openPostDetail(reportId) {
  const viewer = $('postDetailViewer');
  const body = $('postDetailBody');
  if (!viewer || !body) return;

  const r = (cachedAllReports || []).find(x => x.id === reportId);
  if (!r) {
    toast('Post details not found.');
    return;
  }

  pushCampusUiLayer('postDetailViewer');
  const titleEl = $('postDetailTitle');
  const subEl = $('postDetailSubtitle');
  if (titleEl) titleEl.textContent = r.type === 'LOST' ? 'Lost Item' : 'Found Item';
  if (subEl) subEl.textContent = r.title || 'CampUs Post';

  body.innerHTML = renderPostCardMarkup(r, cachedAllReports);
  viewer.classList.remove('hide');
  document.body.classList.add('fullscreen-page-open');
  loadSmartMatchesForDetail(r, body);
}

function closePostDetailViewer(fromPopstate = false) {
  const viewer = $('postDetailViewer');
  if (!viewer || viewer.classList.contains('hide')) return;
  viewer.classList.add('hide');
  if ((!$('activityCenterModal') || $('activityCenterModal').classList.contains('hide')) &&
      (!$('privacySettingsModal') || $('privacySettingsModal').classList.contains('hide')) &&
      (!$('termsModal') || $('termsModal').classList.contains('hide')) &&
      (!$('helpSupportModal') || $('helpSupportModal').classList.contains('hide')) &&
      (!$('aboutCampusModal') || $('aboutCampusModal').classList.contains('hide'))) {
    document.body.classList.remove('fullscreen-page-open');
  }
  finishCampusUiLayer('postDetailViewer', fromPopstate);
}

/* --------------------------------------------------------------------------
   THREADED COMMENTS SYSTEM
   -------------------------------------------------------------------------- */
let currentCommentsReportId = null;
let activeReplyCommentId = null;
let activeReplyUsername = null;

async function openPostComments(reportId) {
  currentCommentsReportId = reportId;
  activeReplyCommentId = null;
  activeReplyUsername = null;
  cancelCommentReply();

  const modal = $('commentsModal');
  if (!modal) return;
  modal.classList.remove('hide');
  document.body.classList.add('comments-modal-open');

  const avatar = $('commentUserAvatar');
  if (avatar) {
    const initial = firstNameOfUser().charAt(0).toUpperCase();
    if (currentUser?.profileImageData) {
      avatar.innerHTML = `<img src="${currentUser.profileImageData}" alt="" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`;
    } else {
      avatar.textContent = initial;
    }
  }

  const listEl = $('commentsList');
  const snippetEl = $('commentsPostSnippet');
  if (listEl) listEl.innerHTML = '<div class="empty">Loading comments…</div>';

  try {
    const [reportRes, commentsRes] = await Promise.all([
      fetch(`/api/reports/${reportId}`),
      fetch(`/api/reports/${reportId}/comments`)
    ]);

    if (reportRes.ok) {
      const rep = await reportRes.json();
      if (snippetEl) {
        snippetEl.innerHTML = `
          <div class="snippet-content">
            <span class="pill ${rep.type === 'FOUND' ? 'found' : ''}">● ${rep.type}</span>
            <b class="snippet-title">${esc(rep.title)}</b>
            <span class="snippet-meta">by @${esc(rep.accountUsername || 'student')} · 📍 ${esc(rep.location)}</span>
          </div>`;
      }
    }

    const comments = commentsRes.ok ? await commentsRes.json() : [];
    renderCommentsList(comments);
  } catch (err) {
    if (listEl) listEl.innerHTML = '<div class="empty">Could not load comments.</div>';
  }
}

function closeCommentsModal() {
  const modal = $('commentsModal');
  if (modal) modal.classList.add('hide');
  document.body.classList.remove('comments-modal-open');
  currentCommentsReportId = null;
  cancelCommentReply();
}

function cancelCommentReply() {
  activeReplyCommentId = null;
  activeReplyUsername = null;
  const banner = $('commentReplyBanner');
  if (banner) banner.classList.add('hide');
  const input = $('commentInput');
  if (input) input.placeholder = 'Add a comment or reply...';
}

function setCommentReply(commentId, authorUsername) {
  activeReplyCommentId = commentId;
  activeReplyUsername = authorUsername;
  const banner = $('commentReplyBanner');
  const target = $('commentReplyTarget');
  if (banner && target) {
    target.textContent = `@${authorUsername}`;
    banner.classList.remove('hide');
  }
  const input = $('commentInput');
  if (input) {
    input.placeholder = `Reply to @${authorUsername}…`;
    input.focus();
  }
}

function renderCommentsList(comments) {
  const listEl = $('commentsList');
  if (!listEl) return;
  if (!comments || !comments.length) {
    listEl.innerHTML = `
      <div class="empty">
        <span class="comments-empty-icon" style="font-size:32px;display:block;margin-bottom:8px;">💬</span>
        <b>No comments yet</b>
        <p>Be the first to share clues, contact details, or congratulations!</p>
      </div>`;
    return;
  }

  listEl.innerHTML = comments.map(c => renderSingleCommentTree(c)).join('');
}

function renderSingleCommentTree(c) {
  const isMine = currentUser && c.username && c.username.toLowerCase() === currentUser.username.toLowerCase();
  const authorName = c.userDisplayName || c.username;
  const initial = (authorName.charAt(0) || 'U').toUpperCase();
  const avatarHtml = c.userProfileImageUrl 
    ? `<img src="${esc(c.userProfileImageUrl)}" alt="" class="c-avatar-img">`
    : `<div class="c-avatar-initial">${esc(initial)}</div>`;

  const repliesHtml = (c.replies && c.replies.length) ? `
    <div class="comment-replies-thread">
      ${c.replies.map(r => {
        const rIsMine = currentUser && r.username && r.username.toLowerCase() === currentUser.username.toLowerCase();
        const rName = r.userDisplayName || r.username;
        const rInitial = (rName.charAt(0) || 'U').toUpperCase();
        const rAvatar = r.userProfileImageUrl 
          ? `<img src="${esc(r.userProfileImageUrl)}" alt="" class="c-avatar-img">`
          : `<div class="c-avatar-initial">${esc(rInitial)}</div>`;
        return `
          <div class="comment-item reply-item" id="comment-${r.id}">
            <div class="comment-avatar">${rAvatar}</div>
            <div class="comment-body">
              <div class="comment-header-row">
                <span class="comment-author" onclick="openChatUserProfile('${esc(rName)}','${esc(r.username)}')">${esc(rName)}</span>
                <span class="comment-handle">@${esc(r.username)}</span>
                <span class="comment-dot">·</span>
                <span class="comment-time">${timeAgo(r.createdAt)}</span>
              </div>
              <div class="comment-text">
                ${r.replyToUsername ? `<span class="reply-mention">@${esc(r.replyToUsername)}</span> ` : ''}
                ${esc(r.content)}
              </div>
              <div class="comment-actions">
                <button type="button" class="c-reply-btn" onclick="setCommentReply(${c.id}, '${esc(r.username)}')">Reply</button>
                ${rIsMine ? `<button type="button" class="c-del-btn" onclick="deletePostComment(${r.id})">Delete</button>` : ''}
              </div>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  ` : '';

  return `
    <div class="comment-item" id="comment-${c.id}">
      <div class="comment-avatar">${avatarHtml}</div>
      <div class="comment-body">
        <div class="comment-header-row">
          <span class="comment-author" onclick="openChatUserProfile('${esc(authorName)}','${esc(c.username)}')">${esc(authorName)}</span>
          <span class="comment-handle">@${esc(c.username)}</span>
          <span class="comment-dot">·</span>
          <span class="comment-time">${timeAgo(c.createdAt)}</span>
        </div>
        <div class="comment-text">${esc(c.content)}</div>
        <div class="comment-actions">
          <button type="button" class="c-reply-btn" onclick="setCommentReply(${c.id}, '${esc(c.username)}')">Reply</button>
          ${isMine ? `<button type="button" class="c-del-btn" onclick="deletePostComment(${c.id})">Delete</button>` : ''}
        </div>
        ${repliesHtml}
      </div>
    </div>
  `;
}

async function submitPostComment(event) {
  if (event) event.preventDefault();
  if (!currentCommentsReportId) return;
  const input = $('commentInput');
  const content = (input ? input.value : '').trim();
  if (!content) return;

  const submitBtn = $('commentSubmitBtn');
  if (submitBtn) submitBtn.disabled = true;

  try {
    const payload = {
      content,
      parentCommentId: activeReplyCommentId,
      replyToUsername: activeReplyUsername
    };
    const res = await fetch(`/api/reports/${currentCommentsReportId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw 0;

    if (input) input.value = '';
    cancelCommentReply();

    const commentsRes = await fetch(`/api/reports/${currentCommentsReportId}/comments`);
    if (commentsRes.ok) {
      const comments = await commentsRes.json();
      renderCommentsList(comments);
      const listEl = $('commentsList');
      if (listEl) listEl.scrollTop = listEl.scrollHeight;

      const countEl = document.querySelector(`.comment-count-${currentCommentsReportId}`);
      if (countEl) {
        let totalCount = 0;
        comments.forEach(c => {
          totalCount += 1 + (c.replies ? c.replies.length : 0);
        });
        countEl.textContent = totalCount;
      }
    }
  } catch {
    toast('Could not post comment. Please try again.');
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
}

async function deletePostComment(commentId) {
  if (!currentCommentsReportId) return;
  if (!confirm('Delete this comment?')) return;
  try {
    const res = await fetch(`/api/reports/${currentCommentsReportId}/comments/${commentId}`, { method: 'DELETE' });
    if (!res.ok) throw 0;
    toast('Comment deleted');
    const commentsRes = await fetch(`/api/reports/${currentCommentsReportId}/comments`);
    if (commentsRes.ok) {
      const comments = await commentsRes.json();
      renderCommentsList(comments);
    }
  } catch {
    toast('Could not delete comment.');
  }
}
const boardSearch=$('boardSearch');
let memberSearchTimer=null, memberSearchSequence=0;
if(boardSearch){
 boardSearch.value=$('q').value||'';
 let searchTimer;
 boardSearch.addEventListener('input',()=>{
  $('q').value=boardSearch.value;
  const mobSearch=$('mobileBoardSearch');
  if(mobSearch&&mobSearch.value!==boardSearch.value)mobSearch.value=boardSearch.value;
  clearTimeout(searchTimer); searchTimer=setTimeout(load,180);
  clearTimeout(memberSearchTimer);
  const query=boardSearch.value.trim();
  if(!query){hideUserSearchResults();return;}
  memberSearchTimer=setTimeout(()=>searchMembersInBar(query),220);
 });
 boardSearch.addEventListener('search',()=>{ $('q').value=boardSearch.value;load();searchMembersInBar(boardSearch.value.trim()); });
 boardSearch.addEventListener('keydown',event=>{if(event.key==='Escape')hideUserSearchResults();});
}
function hideUserSearchResults(){const results=$('userSearchResults');if(results){results.hidden=true;results.innerHTML='';}}
async function searchMembersInBar(query){
 const results=$('userSearchResults');if(!results)return;
 const needle=String(query||'').trim().replace(/^@/,'').toLowerCase();
 if(!needle){hideUserSearchResults();return;}
 const sequence=++memberSearchSequence;
 try{
  const response=await fetch(`/api/users/search?q=${encodeURIComponent(needle)}`,{headers:{'Accept':'application/json'}});
  if(sequence!==memberSearchSequence)return;
  if(!response.ok){hideUserSearchResults();return;}
  const data=await response.json(),members=Array.isArray(data.members)?data.members:[];
  if(!members.length){hideUserSearchResults();return;}
  results.innerHTML=`<div class="user-search-results-heading">Members</div>`+members.map(member=>{
   const name=String(member.displayName||member.username||'CampUs user');
   const username=String(member.username||'');
   return `<button type="button" role="option" class="user-search-result" data-user-search-username="${esc(username)}" data-profile-name="${esc(name)}"><span class="user-search-avatar">${avatarInner(member.avatarId,name,member.profileImageUrl)}</span><span class="user-search-result-copy"><b>${esc(name)}${roleBadgeMarkup(member.role)}</b><small>@${esc(username)} · ${esc(member.course||'Course not provided')}</small></span><span class="user-search-open" aria-hidden="true">›</span></button>`;
  }).join('');
  results.hidden=false;
 }catch{if(sequence===memberSearchSequence)hideUserSearchResults();}
}
document.addEventListener('click',event=>{
 const results=$('userSearchResults');
 if(results&&!results.hidden&&!event.target.closest('.board-search'))hideUserSearchResults();
 if(!event.target.closest('#publicProfileOwnerActions'))closePublicProfileRoleMenu();
});
let timer;['q','filterCategory','filterLocation','dateFrom','dateTo'].forEach(id=>{const el=$(id);if(el)el.addEventListener(id==='q'||id==='filterLocation'?'input':'change',()=>{clearTimeout(timer);timer=setTimeout(load,220)})});initAuth();loadPrivacyPreferences();
/* Profile button opens the phone navigation or the profile editor on desktop. */
let menuOpen=false, profileMenuOpen=false, activeNavPopup='', selectedProfileAvatarId='';
let mobileNavHomeParent=null, mobileNavHomeNextSibling=null;
let navDrawerOpen = false;

function toggleNavDrawer() {
  if (navDrawerOpen) closeNavDrawer();
  else openNavDrawer();
}

function openNavDrawer() {
  navDrawerOpen = true;
  pushCampusUiLayer('navDrawer');
  const overlay = $('navDrawerOverlay');
  const btn = $('menuToggleBtn');
  if (overlay) overlay.classList.remove('hide');
  if (btn) {
    btn.classList.add('active');
    btn.setAttribute('aria-expanded', 'true');
  }
  updateGreeting();
}

function closeNavDrawer(fromPopstate = false) {
  if (!navDrawerOpen) return;
  navDrawerOpen = false;
  const overlay = $('navDrawerOverlay');
  const btn = $('menuToggleBtn');
  if (overlay) overlay.classList.add('hide');
  if (btn) {
    btn.classList.remove('active');
    btn.setAttribute('aria-expanded', 'false');
  }
  if (!fromPopstate) {
    finishCampusUiLayer('navDrawer');
  }
}

function handleDrawerBackdropClick(event) {
  if (event.target === $('navDrawerOverlay')) {
    closeNavDrawer();
  }
}

function handleDrawerNav(action) {
  closeNavDrawer();
  if (action === 'adminDashboard') {
    openAdminDashboard();
  } else if (action === 'myReports') {
    openMyReportsView();
  } else if (action === 'activity') {
    openActivityCenter('archive');
  } else if (action === 'privacySettings') {
    openPrivacySettingsModal();
  } else if (action === 'termsConditions') {
    openTermsModal();
  } else if (action === 'campusInfo') {
    const college = currentUser ? currentUser.collegeName : 'University Network';
    toast(`Verified Campus: ${college} 🏛️`);
  } else if (action === 'helpSupport') {
    openHelpSupportModal();
  } else if (action === 'leaderboard') {
    openLeaderboardModal();
  } else if (action === 'aboutCampus') {
    openAboutCampusModal();
  }
}

function logoutFromDrawer() {
  closeNavDrawer();
  logout();
}

/* --------------------------------------------------------------------------
   NOTIFICATION & PRIVACY SETTINGS
   -------------------------------------------------------------------------- */
function loadPrivacyPreferences() {
  let prefs = {
    postAlerts: true,
    chatAlerts: true,
    soundAlerts: !communityMuted,
    claimAlerts: true,
    phoneVisibility: 'campus',
    activeStatus: true,
    memberSearch: true
  };
  try {
    const saved = localStorage.getItem('campus_privacy_settings');
    if (saved) {
      prefs = { ...prefs, ...JSON.parse(saved) };
    }
  } catch {}

  if ($('prefPostAlerts')) $('prefPostAlerts').checked = !!prefs.postAlerts;
  if ($('prefChatAlerts')) $('prefChatAlerts').checked = !!prefs.chatAlerts;
  if ($('prefSoundAlerts')) $('prefSoundAlerts').checked = !communityMuted && !!prefs.soundAlerts;
  if ($('prefClaimAlerts')) $('prefClaimAlerts').checked = !!prefs.claimAlerts;
  if ($('prefActiveStatus')) $('prefActiveStatus').checked = !!prefs.activeStatus;
  if ($('prefMemberSearch')) $('prefMemberSearch').checked = !!prefs.memberSearch;

  const phoneRadios = document.querySelectorAll('input[name="phoneVisibility"]');
  phoneRadios.forEach(r => {
    r.checked = (r.value === (prefs.phoneVisibility || 'campus'));
  });
}

function savePrivacyPreferences(showToast = false) {
  const phoneVal = document.querySelector('input[name="phoneVisibility"]:checked')?.value || 'campus';
  const prefs = {
    postAlerts: $('prefPostAlerts') ? $('prefPostAlerts').checked : true,
    chatAlerts: $('prefChatAlerts') ? $('prefChatAlerts').checked : true,
    soundAlerts: $('prefSoundAlerts') ? $('prefSoundAlerts').checked : true,
    claimAlerts: $('prefClaimAlerts') ? $('prefClaimAlerts').checked : true,
    phoneVisibility: phoneVal,
    activeStatus: $('prefActiveStatus') ? $('prefActiveStatus').checked : true,
    memberSearch: $('prefMemberSearch') ? $('prefMemberSearch').checked : true
  };
  try {
    localStorage.setItem('campus_privacy_settings', JSON.stringify(prefs));
  } catch {}
  if (showToast) {
    toast('Notification & privacy preferences saved! 🔒');
    closePrivacySettingsModal();
  }
}

function toggleSoundPreference(enabled) {
  if (enabled === communityMuted) {
    toggleCommunityMute();
  }
  savePrivacyPreferences(false);
}

function openActivityFromPrivacy(tab) {
  closePrivacySettingsModal();
  openActivityCenter(tab);
}

function openPrivacySettingsModal() {
  closeNavDrawer();
  loadPrivacyPreferences();
  const modal = $('privacySettingsModal');
  if (modal) {
    pushCampusUiLayer('privacySettingsModal');
    modal.classList.remove('hide');
    document.body.classList.add('fullscreen-page-open');
  }
}

function closePrivacySettingsModal(fromPopstate = false) {
  const modal = $('privacySettingsModal');
  if (modal && !modal.classList.contains('hide')) {
    modal.classList.add('hide');
    document.body.classList.remove('fullscreen-page-open');
    finishCampusUiLayer('privacySettingsModal', fromPopstate);
  }
}

/* --------------------------------------------------------------------------
   TERMS & CONDITIONS MODAL
   -------------------------------------------------------------------------- */
function openTermsModal() {
  closeNavDrawer();
  const modal = $('termsModal');
  if (modal) {
    pushCampusUiLayer('termsModal');
    modal.classList.remove('hide');
    document.body.classList.add('fullscreen-page-open');
  }
}

function closeTermsModal(fromPopstate = false) {
  const modal = $('termsModal');
  if (modal && !modal.classList.contains('hide')) {
    modal.classList.add('hide');
    document.body.classList.remove('fullscreen-page-open');
    finishCampusUiLayer('termsModal', fromPopstate);
  }
}

function acceptCampusTerms() {
  closeTermsModal();
  toast('Terms & Community Guidelines accepted! 🤝');
}

/* --------------------------------------------------------------------------
   HELP & SUPPORT MODAL
   -------------------------------------------------------------------------- */
function openHelpSupportModal() {
  closeNavDrawer();
  const modal = $('helpSupportModal');
  if (modal) {
    pushCampusUiLayer('helpSupportModal');
    modal.classList.remove('hide');
    document.body.classList.add('fullscreen-page-open');
  }
}

function closeHelpSupportModal(fromPopstate = false) {
  const modal = $('helpSupportModal');
  if (modal && !modal.classList.contains('hide')) {
    modal.classList.add('hide');
    document.body.classList.remove('fullscreen-page-open');
    finishCampusUiLayer('helpSupportModal', fromPopstate);
  }
}

/* --------------------------------------------------------------------------
   ABOUT CAMPUS MODAL
   -------------------------------------------------------------------------- */
function openAboutCampusModal() {
  closeNavDrawer();
  const modal = $('aboutCampusModal');
  if (modal) {
    pushCampusUiLayer('aboutCampusModal');
    modal.classList.remove('hide');
    document.body.classList.add('fullscreen-page-open');
  }
}

function closeAboutCampusModal(fromPopstate = false) {
  const modal = $('aboutCampusModal');
  if (modal && !modal.classList.contains('hide')) {
    modal.classList.add('hide');
    document.body.classList.remove('fullscreen-page-open');
    finishCampusUiLayer('aboutCampusModal', fromPopstate);
  }
}

function openMyReportsView() {
  closeNavDrawer();
  myReportsOnly = true;
  chosenType = '';
  statFilter = '';
  load();
  window.scrollTo({ top: 0, behavior: 'smooth' });
  toast('Showing reports submitted by you 📋');
}

function firstNameOfUser(user=currentUser){
 const full=String(user?.displayName||user?.username||'User').trim();
 const first=(full.split(/\s+/)[0]||'User');
 return first.charAt(0).toLocaleUpperCase()+first.slice(1);
}

function formatCollegeFullName(raw) {
  if (!raw) return 'Chandigarh University';
  const str = String(raw).trim();
  const match = str.match(/\(([^)]+)\)/);
  if (match && match[1]) return match[1].trim();
  const upper = str.toUpperCase();
  if (upper === 'CU' || upper.includes('CHANDIGARH')) return 'Chandigarh University';
  if (upper === 'LPU' || upper.includes('LOVELY')) return 'Lovely Professional University';
  if (upper === 'CGC_UNIV' || upper.includes('CGC UNIV')) return 'CGC University';
  if (upper === 'CGC_LANDRAN' || upper.includes('LANDRAN')) return 'CGC Landran';
  return str;
}

function collegeDisplayName(code) {
  return formatCollegeFullName(code);
}

function renderCollegeBadge() {
  const badge = $('campusCollegeBadge');
  const badgeText = $('campusCollegeText');
  const fullName = formatCollegeFullName(currentUser?.collegeName || currentUser?.college);
  if (badge) {
    if (badgeText) {
      badgeText.textContent = fullName;
    } else {
      badge.textContent = fullName;
    }
    badge.title = `Verified Campus: ${fullName}`;
    badge.hidden = false;
  }
}

function updateGreeting(){
 const name = firstNameOfUser();
 const initial = (name.charAt(0) || 'U').toUpperCase();
 renderCollegeBadge();

 const deskName = $('deskGreetingName');
 if (deskName) deskName.textContent = `Hi, ${name}`;

 const headerAvatar = $('headerAvatarText');
 if (headerAvatar) {
   if (currentUser?.profileImageData) {
     headerAvatar.innerHTML = `<img src="${currentUser.profileImageData}" alt="" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`;
   } else {
     headerAvatar.textContent = initial;
   }
 }

 const bottomNavAvatar = $('bottomNavAvatar');
 if (bottomNavAvatar) {
   bottomNavAvatar.textContent = initial;
 }

 const campusDesc = $('drawerCampusDesc');
 if (campusDesc) {
   campusDesc.textContent = currentUser?.collegeName || 'Verified University Network';
 }

 const isMuted = $('chatMuteButton')?.getAttribute('aria-pressed') === 'true';
 const soundStatus = $('drawerSoundStatus');
 if (soundStatus) {
   soundStatus.textContent = isMuted ? 'Notifications muted' : 'Chat sounds enabled';
 }
}

function openDesktopProfile(){
  closeNavDrawer();
  openOwnPublicProfile();
}

function openOwnPublicProfile(){
 if(!currentUser||!currentUser.username){toast('Please log in to view your profile.');return;}
 closeNavDrawer();
 closeMenu();
 openChatUserProfile(currentUser.displayName||currentUser.username,currentUser.username);
}
function closeProfileDropdown(){
 profileMenuOpen=false;
 const dropdown=$('profileDropdown');if(dropdown)dropdown.hidden=true;
 updateGreeting();
}
function toggleMenu(){
 if(menuOpen){closeMenu();return;}
 menuOpen=true;
 pushCampusUiLayer('phoneMenu');
 const nav=$('mainNav');
 if(nav){
  /* Move the mobile panel directly under body so fixed centering is relative to the viewport, not the header. */
  if(!mobileNavHomeParent){mobileNavHomeParent=nav.parentNode;mobileNavHomeNextSibling=nav.nextSibling;}
  document.body.appendChild(nav);
  nav.classList.add('menu-open');
  nav.scrollTop=0;
  requestAnimationFrame(()=>{if(menuOpen&&nav)nav.scrollTop=0;});
 }
 updateGreeting();
}
function closeMenu(fromPopstate=false){
 const wasOpen=menuOpen;
 menuOpen=false;
 const nav=$('mainNav');
 if(nav){
  nav.classList.remove('menu-open');
  if(mobileNavHomeParent){
   if(mobileNavHomeNextSibling&&mobileNavHomeNextSibling.parentNode===mobileNavHomeParent)mobileNavHomeParent.insertBefore(nav,mobileNavHomeNextSibling);
   else mobileNavHomeParent.appendChild(nav);
   mobileNavHomeParent=null;mobileNavHomeNextSibling=null;
  }
 }
 if(wasOpen)finishCampusUiLayer('phoneMenu',fromPopstate);
 updateGreeting();
}
function showNavPopup(page){
 if(page==='profile'){openOwnPublicProfile();return;}
 closeMenu();closeProfileDropdown();activeNavPopup=page;pushCampusUiLayer('navPopup');
 const title=$('navPopupTitle'),body=$('navPopupBody'),eyebrow=$('navPopupEyebrow'),ok=$('navPopupOk');
 const actions=document.querySelector('#navPopup .actions');
 const cancel=actions&&actions.querySelector('.light');
 if(cancel)cancel.classList.add('hide');
 if(ok)ok.classList.add('hide');
 if(actions)actions.classList.add('single-action');
 if(page==='home'){
  eyebrow.textContent='ONE CAMPUS. ONE COMMUNITY.';title.textContent='Welcome to CampUs';
  body.innerHTML='<p>Report lost items, share things you’ve found, and help belongings get back to their owners.</p><p>You are signed in. You can browse reports or submit a lost/found item.</p>';ok.textContent='Okay';ok.classList.remove('hide');
 }else if(page==='board'){
  eyebrow.textContent='FIND THE RIGHT REPORTS';title.textContent='Browse items';
  body.innerHTML='<p>Choose any filters you want. Tap <b>Okay</b> to show matching reports on the main page.</p><div class="nav-filter-grid"><label>Search<input id="navSearch" placeholder="Item, category or location"></label><label>Category<select id="navCategory"><option value="">All categories</option><option>Electronics</option><option>ID card</option><option>Keys</option><option>Wallet / purse</option><option>Books / stationery</option><option>Clothing</option><option>Water bottle</option><option>Other</option></select></label><label>Location<input id="navLocation" placeholder="e.g. Library"></label><label>Lost or found<select id="navType"><option value="">All items</option><option value="LOST">Lost items</option><option value="FOUND">Found items</option></select></label><label>Date from<input id="navDateFrom" type="date"></label><label>Date to<input id="navDateTo" type="date"></label></div>';
  ok.textContent='Okay, show items →';ok.classList.remove('hide');
 }else if(page==='myReports'){
  eyebrow.textContent='YOUR ACTIVITY';title.textContent='My reports';body.innerHTML='<p>View reports submitted from your CampUs account. Your account is used to keep this list separate from other users.</p>';ok.textContent='Okay, show my reports →';ok.classList.remove('hide');
 }else if(page==='profile'){
  openOwnPublicProfile();return;
 }else if(page==='howItWorks'){
  eyebrow.textContent='SIMPLE, SAFE, COMMUNITY-POWERED';title.textContent='How it works';body.innerHTML='<div class="popup-steps"><p><b>01 · Report it</b><br>Share the item name, location and date. Adding a photo is optional.</p><p><b>02 · Find a match</b><br>Browse reports and check possible matches based on item details.</p><p><b>03 · Reconnect safely</b><br>Contact the person using details they chose to share and meet in a public campus place.</p></div>';ok.textContent='Got it';ok.classList.remove('hide');
 }else if(page==='help'){
  eyebrow.textContent='SAFETY & SUPPORT';title.textContent='Help & safety';body.innerHTML='<p><b>Keep your details safe.</b> Don’t post passwords, PINs, or sensitive personal information.</p><p><b>Meeting someone?</b> Choose a public place on campus and, if possible, let a friend know.</p><p><b>Need to correct a report?</b> Browse the community board and check the status of your report.</p>';ok.textContent='Got it';ok.classList.remove('hide');
 }
 $('navPopup').classList.remove('hide');
}
function closeNavPopup(fromPopstate=false){if(!$('navPopup').classList.contains('hide')){$('navPopup').classList.add('hide');activeNavPopup='';finishCampusUiLayer('navPopup',fromPopstate);}}
const avatarLabels=['Blue-Hair Hero','Silver-Hair Ranger','Sunshine Hoodie','Forest Adventurer','Violet-Hair Star','Headphone Gamer','Pink Star','Crimson Hero','Midnight Ninja','Golden Explorer','Cat-Eared Mage','Fox-Eared Friend','Pocket Robot','Tiny Dragon','Panda Hoodie','Frog Hoodie','Friendly Ghost','Moon Witch','Space Explorer','Neon Gamer','Creative Artist','Campus DJ','Pink Bun Star','Beanie Friend','Glasses Scholar','Silver Knight','Starlight Witch','Teal-Hair Hero','Wise Owl','Happy Sunflower'];
function openProfileEditorPage(){
 closeMenu();closeProfileDropdown();
 const page=$('profileEditorPage');if(!page)return;
 if(page.classList.contains('hide'))pushCampusUiLayer('profileEditor');
 selectedProfileAvatarId=validAvatarId(currentUser?.avatarId||'');
 profileImageDataDraft=String(currentUser?.profileImageData||'');bannerImageDataDraft=String(currentUser?.bannerImageData||'');
 $('profilePhotoFile').value='';$('profileBannerFile').value='';
 $('profileDisplayName').value=currentUser?.displayName||currentUser?.username||'';
 $('profileCourse').value=currentUser?.course||'';
 $('profileUsername').value=currentUser?.username||'';
 $('profilePhone').value=currentUser?.phone||'';
 $('profileEditorError').textContent='';
 const role=String(currentUser?.role||'MEMBER').toUpperCase();
 const canPhoto=roleCanUploadPhoto(role),canBanner=roleCanUploadBanner(role),canManage=roleCanManageMembers(role);
 $('privilegedProfileMedia')?.classList.toggle('hide',!(canPhoto||canBanner));
 $('profilePhotoField')?.classList.toggle('hide',!canPhoto);
 $('profileBannerField')?.classList.toggle('hide',!canBanner);
 const ownerMemberPanel=$('ownerMemberManagement');if(ownerMemberPanel)ownerMemberPanel.classList.toggle('hide',!canManage);
 if($('profileMediaPermissionText')) $('profileMediaPermissionText').textContent='Customize your profile photo, banner, and details.';
 const ownerMemberHelp=$('ownerMemberHelp');if(ownerMemberHelp)ownerMemberHelp.textContent=role==='OWNER'?'Owner can assign all member roles. The current Owner account stays protected.':'Admin can assign Leader, Moderator, or Member, but cannot grant Admin or Owner.';
 $('profileEditorRoleLabel').textContent=`${role} · Customize profile photo, banner, and username`;
 renderProfileAvatarPicker();updateProfileAvatarPreview();updateUsernameChangeHint();
 // Member management is intentionally not shown inside the personal profile editor.
 page.classList.remove('hide');document.body.classList.add('profile-editor-open');
 const editorScroll=page.querySelector('.profile-editor-scroll');if(editorScroll)editorScroll.scrollTop=0;
 requestAnimationFrame(()=>{if(editorScroll)editorScroll.scrollTop=0;});
 setTimeout(()=>{if(window.innerWidth>700)$('profileDisplayName')?.focus({preventScroll:true});},40);
}
function closeProfileEditorPage(fromPopstate=false){
 const page=$('profileEditorPage');if(!page||page.classList.contains('hide'))return;
 page.classList.add('hide');document.body.classList.remove('profile-editor-open');
 finishCampusUiLayer('profileEditor',fromPopstate);
 resetCampusScrollToTop();
}
function renderProfileAvatarPicker(){
 const picker=$('profileAvatarPicker');if(!picker)return;
 const initial=(String($('profileDisplayName')?.value||currentUser?.displayName||currentUser?.username||'U').trim().charAt(0)||'?').toUpperCase();
 const choices=[{id:'',label:'My initial'},...avatarLabels.map((label,i)=>({id:`avatar-${String(i+1).padStart(2,'0')}`,label}))];
 picker.innerHTML=choices.map(choice=>{
  const selected=choice.id===selectedProfileAvatarId;
  const graphic=choice.id?`<img src="/avatars/${choice.id}.png" alt="" loading="lazy">`:`<span class="avatar-choice-initial">${esc(initial)}</span>`;
  return `<button type="button" class="avatar-choice${selected?' selected':''}" role="option" aria-selected="${selected}" data-avatar-choice="${choice.id}" aria-label="${esc(choice.label)}" onclick="selectProfileAvatar('${choice.id}')">${graphic}<small>${esc(choice.label)}</small></button>`;
 }).join('');
}
function formatUsernameResetDate(value){
 if(!value)return 'the next annual reset';
 const date=new Date(`${value}T00:00:00+05:30`);
 return Number.isNaN(date.getTime())?value:date.toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'});
}
let usernameCheckTimer = null;
let isUsernameAvailable = true;
let usernameCheckListenerAttached = false;

function setupUsernameAvailabilityCheck() {
  const input = $('profileUsername');
  const hint = $('usernameChangeHint');
  const saveBtn = $('profileEditorSave');
  if (!input || !hint || usernameCheckListenerAttached) return;
  usernameCheckListenerAttached = true;

  input.addEventListener('input', () => {
    clearTimeout(usernameCheckTimer);
    const value = input.value.trim().toLowerCase();
    if (!value) {
      hint.textContent = 'Please enter a username.';
      hint.className = 'username-change-hint username-check-result error';
      if (saveBtn) saveBtn.disabled = true;
      isUsernameAvailable = false;
      return;
    }
    if (currentUser && value === currentUser.username.toLowerCase()) {
      hint.textContent = '✓ This is your current username.';
      hint.className = 'username-change-hint username-check-result success';
      if (saveBtn) saveBtn.disabled = false;
      isUsernameAvailable = true;
      return;
    }
    hint.textContent = 'Checking availability…';
    hint.className = 'username-change-hint username-check-result';

    usernameCheckTimer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/auth/check-username?username=${encodeURIComponent(value)}`);
        const data = await res.json().catch(() => ({}));
        if (data.available) {
          hint.textContent = '✓ Username is available.';
          hint.className = 'username-change-hint username-check-result success';
          if (saveBtn) saveBtn.disabled = false;
          isUsernameAvailable = true;
        } else {
          hint.textContent = data.message || 'This username is already taken. Please choose another.';
          hint.className = 'username-change-hint username-check-result error';
          if (saveBtn) saveBtn.disabled = true;
          isUsernameAvailable = false;
        }
      } catch {
        hint.textContent = 'Will verify availability on save.';
        hint.className = 'username-change-hint username-check-result';
        if (saveBtn) saveBtn.disabled = false;
        isUsernameAvailable = true;
      }
    }, 240);
  });
}

function updateUsernameChangeHint(){
  const hint = $('usernameChangeHint');
  if (!hint) return;
  hint.textContent = 'You can change your username at any time. It must be unique across the campus.';
  hint.className = 'username-change-hint username-check-result';
  isUsernameAvailable = true;
  const saveBtn = $('profileEditorSave');
  if (saveBtn) saveBtn.disabled = false;
  setupUsernameAvailabilityCheck();
}
function updateProfileAvatarPreview(){
 const name=String($('profileDisplayName')?.value||currentUser?.displayName||currentUser?.username||'User').trim()||'User';
 $('profileEditorPreviewName').textContent=name;
 $('profileEditorAvatar').innerHTML=avatarInner(selectedProfileAvatarId,name,profileImageDataDraft);
 const bannerPreview=$('profileEditorBannerPreview');if(bannerPreview){const banner=String(bannerImageDataDraft||'');bannerPreview.style.backgroundImage=banner?`url(\"${banner}\")`:'linear-gradient(135deg,#E89953,#ffe3ca 55%,#f5e6d9)';bannerPreview.classList.toggle('has-image',!!banner);bannerPreview.textContent=banner?'':'Banner preview';}
 const initialChoice=$('profileAvatarPicker')?.querySelector('[data-avatar-choice=""] .avatar-choice-initial');if(initialChoice)initialChoice.textContent=(name.charAt(0)||'?').toUpperCase();
}
function selectProfileAvatar(id){
 selectedProfileAvatarId=validAvatarId(id);profileImageDataDraft='';if($('profilePhotoFile'))$('profilePhotoFile').value='';
 $('profileAvatarPicker')?.querySelectorAll('.avatar-choice').forEach(button=>{const selected=(button.dataset.avatarChoice||'')===selectedProfileAvatarId;button.classList.toggle('selected',selected);button.setAttribute('aria-selected',String(selected));});
 updateProfileAvatarPreview();
}
$('profileDisplayName').addEventListener('input',updateProfileAvatarPreview);
async function compressProfileImage(file,maxWidth,maxHeight,quality){
 if(!file||!file.type.startsWith('image/'))throw new Error('Choose an image file.');
 const url=URL.createObjectURL(file);
 try{const image=await new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error('Could not open that image.'));img.src=url;});
  const scale=Math.min(1,maxWidth/image.naturalWidth,maxHeight/image.naturalHeight);const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0,canvas.width,canvas.height);return canvas.toDataURL('image/jpeg',quality);
 }finally{URL.revokeObjectURL(url)}
}
function clearCustomProfilePhoto(){profileImageDataDraft='';if($('profilePhotoFile'))$('profilePhotoFile').value='';updateProfileAvatarPreview();}
function clearProfileBanner(){bannerImageDataDraft='';if($('profileBannerFile'))$('profileBannerFile').value='';updateProfileAvatarPreview();}
$('profilePhotoFile')?.addEventListener('change',async()=>{const file=$('profilePhotoFile').files?.[0];if(!file)return;try{profileImageDataDraft=await compressProfileImage(file,512,512,.78);if(profileImageDataDraft.length>450000)throw new Error('That photo is too large. Choose another image.');selectedProfileAvatarId='';renderProfileAvatarPicker();updateProfileAvatarPreview();}catch(error){toast(error.message||'Could not use this photo.');$('profilePhotoFile').value='';}});
$('profileBannerFile')?.addEventListener('change',async()=>{const file=$('profileBannerFile').files?.[0];if(!file)return;try{bannerImageDataDraft=await compressProfileImage(file,1600,520,.75);if(bannerImageDataDraft.length>1050000)throw new Error('That banner is too large. Choose another image.');updateProfileAvatarPreview();}catch(error){toast(error.message||'Could not use this banner.');$('profileBannerFile').value='';}});
async function loadManageMembers(){
 const panel=$('ownerMemberManagement'),list=$('ownerMemberList');if(!panel||!list||!roleCanManageMembers(currentUser?.role))return;panel.classList.remove('hide');list.innerHTML='<div class="empty">Loading members…</div>';
 try{const response=await fetch('/api/users/manage',{headers:{'Accept':'application/json'}});const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.message||'Could not load members.');const members=Array.isArray(data.members)?data.members:[];
  const actorRole=String(currentUser?.role||'MEMBER').toUpperCase();
  const availableRoles=actorRole==='OWNER'?[['OWNER','Owner'],['ADMIN','Admin'],['LEADER','Leader'],['MODERATOR','Moderator'],['MEMBER','Member']]:[['LEADER','Leader'],['MODERATOR','Moderator'],['MEMBER','Member']];
  list.innerHTML=members.map(member=>{const role=String(member.role||'MEMBER').toUpperCase();const self=String(member.username||'').toLowerCase()===String(currentUser?.username||'').toLowerCase();const disabled=self||role==='OWNER'&&actorRole==='ADMIN'||role==='ADMIN'&&actorRole==='ADMIN';const options=availableRoles.map(([value,label])=>`<option value="${value}" ${role===value?'selected':''}>${label}</option>`).join('');const currentOption=availableRoles.some(([value])=>value===role)?'':`<option value="${esc(role)}" selected>${esc(role[0]+role.slice(1).toLowerCase())}</option>`;return `<div class="owner-member-row"><div class="owner-member-info"><b>${esc(member.displayName||member.username)}</b><span>@${esc(member.username)} · ${esc(member.course||'Course not provided')}</span></div><select aria-label="Role for ${esc(member.username)}" id="role-select-${esc(member.username)}" ${disabled?'disabled':''}>${options}${currentOption}</select><button type="button" class="light" data-save-member="${esc(member.username)}" ${disabled?'disabled':''}>Save role</button></div>`;}).join('')||'<div class="empty">No members registered yet.</div>';
 }catch(error){list.innerHTML=`<div class="empty"><b>Could not load members</b><p>${esc(error.message||'Please retry.')}</p></div>`}
}
$('ownerMemberList')?.addEventListener('click',event=>{const button=event.target.closest('[data-save-member]');if(button&&!button.disabled)saveMemberRole(button.dataset.saveMember||'')});
async function saveMemberRole(username){const select=$(`role-select-${username}`);if(!select)return;try{const response=await fetch(`/api/users/${encodeURIComponent(username)}/role`,{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({role:select.value})});const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.message||'Could not update role.');toast(`${username} is now ${data.role.toLowerCase()}.`);loadManageMembers();load();if(communityChatOpen)loadCommunityMessages(false);}catch(error){toast(error.message||'Could not update role.');}}
async function saveProfileEditor(event){
 if(event)event.preventDefault();
 const displayName=$('profileDisplayName').value.trim();
 const username=$('profileUsername').value.trim().toLowerCase();
 const phone=$('profilePhone').value.trim();
 const course=$('profileCourse').value.trim();
 const error=$('profileEditorError');
 if(!displayName){error.textContent='Please enter your full name.';$('profileDisplayName').focus();return;}
 if(!course){error.textContent='Please enter your course.';$('profileCourse').focus();return;}
 if(!username){error.textContent='Please enter a username.';$('profileUsername').focus();return;}
 if(!isUsernameAvailable){
   error.textContent='This username is already taken. Please choose another.';
   $('profileUsername').focus();
   return;
 }
 const button=$('profileEditorSave');button.disabled=true;button.textContent='Saving…';error.textContent='';
 try{
  const response=await fetch('/api/auth/profile',{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({displayName,username,phone,course,avatarId:selectedProfileAvatarId,profileImageData:profileImageDataDraft,bannerImageData:bannerImageDataDraft})});
  const data=await response.json().catch(()=>({}));
  if(!response.ok){error.textContent=data.message||'Could not save your profile. Please try again.';return;}
  currentUser={...currentUser,username:data.username,displayName:data.displayName||data.username,phone:data.phone||'',course:data.course||'',avatarId:validAvatarId(data.avatarId),profileImageData:data.profileImageData||'',bannerImageData:data.bannerImageData||'',role:data.role||currentUser?.role||'MEMBER',usernameUnlimited:!!data.usernameUnlimited,usernameChangesRemaining:Number(data.usernameChangesRemaining??currentUser?.usernameChangesRemaining??1),usernameChangeWindowResetsAt:data.usernameChangeWindowResetsAt||currentUser?.usernameChangeWindowResetsAt||''};
  updateGreeting();$('name').value=currentUser.displayName;$('phone').value=currentUser.phone;
  closeProfileEditorPage();load();
  if(!$('communityProfilePage').classList.contains('hide'))await openChatUserProfile(currentUser.displayName,currentUser.username);
  if(communityChatOpen)loadCommunityMessages(false);toast('Profile updated successfully.');
 }catch{error.textContent='Could not connect to CampUs. Please try again.';}
 finally{button.disabled=false;button.textContent='Save changes';}
}
function confirmNavPopup(){
 const page=activeNavPopup;
 if(page==='profile'){openOwnPublicProfile();return;}
 if(page==='board'){
  document.body.classList.add('browse-mode');
  $('board')?.classList.remove('default-list-mode');
  $('board')?.classList.add('browse-results-mode');
  if($('boardSearch') && $('navSearch')) $('boardSearch').value=$('navSearch').value;
  if($('q') && $('navSearch')) $('q').value=$('navSearch').value;
  if($('filterCategory') && $('navCategory')) $('filterCategory').value=$('navCategory').value;
  if($('filterLocation') && $('navLocation')) $('filterLocation').value=$('navLocation').value;
  if($('dateFrom') && $('navDateFrom')) $('dateFrom').value=$('navDateFrom').value;
  if($('dateTo') && $('navDateTo')) $('dateTo').value=$('navDateTo').value;
  if($('navType')) chosenType=$('navType').value;
  myReportsOnly=false;
  document.querySelectorAll('.type-tabs .tab').forEach(b=>b.classList.toggle('active', (chosenType===''&&b.textContent.trim()==='All items')||b.textContent.trim()===(chosenType==='LOST'?'Lost':chosenType==='FOUND'?'Found':'__none__')));
  closeNavPopup();load();
 }else if(page==='myReports'){
  myReportsOnly=true;closeNavPopup();load();
 }else{closeNavPopup();}
}

$('navPopup').addEventListener('click',e=>{if(e.target===$('navPopup'))closeNavPopup()});
document.addEventListener('keydown',e=>{if(e.key!=='Escape')return;if($('adminDashboardModal')&&!$('adminDashboardModal').classList.contains('hide')){closeAdminDashboard();return;}if($('postDetailViewer')&&!$('postDetailViewer').classList.contains('hide')){closePostDetailViewer();return;}if($('explorePage')&&!$('explorePage').classList.contains('hide')){closeExplorePage();return;}if(navDrawerOpen){closeNavDrawer();return;}if($('privacySettingsModal')&&!$('privacySettingsModal').classList.contains('hide')){closePrivacySettingsModal();return;}if($('termsModal')&&!$('termsModal').classList.contains('hide')){closeTermsModal();return;}if($('helpSupportModal')&&!$('helpSupportModal').classList.contains('hide')){closeHelpSupportModal();return;}if($('aboutCampusModal')&&!$('aboutCampusModal').classList.contains('hide')){closeAboutCampusModal();return;}if($('commentsModal')&&!$('commentsModal').classList.contains('hide')){closeCommentsModal();return;}if($('activityCenterModal')&&!$('activityCenterModal').classList.contains('hide')){closeActivityCenter();return;}if($('profileEditorPage')&&!$('profileEditorPage').classList.contains('hide')){closeProfileEditorPage();return;}if(!$('communityProfilePage').classList.contains('hide')){closeChatUserProfile();return;}if(communityChatOpen){closeCommunityChat();return;}if(!$('navPopup').classList.contains('hide')){closeNavPopup();return;}if(!$('modal').classList.contains('hide')){closeForm();return;}closeMenu();closeProfileDropdown();});
window.addEventListener('click',e=>{if(profileMenuOpen&&!e.target.closest('#profileDropdown')&&!e.target.closest('#profileButton'))closeProfileDropdown()});
window.addEventListener('resize',()=>{if(window.innerWidth>850)closeMenu();else closeProfileDropdown()});


function setAuthGateVisibility(visible) {
  const gate = $('authGate');
  if (!gate) return;
  gate.hidden = !visible;
  gate.classList.toggle('hide', !visible);
  gate.style.setProperty('display', visible ? 'grid' : 'none', 'important');
}

function showAuthGate() {
  stopNotificationPolling();
  currentUser = null;
  document.body.classList.add('auth-locked');
  setAuthGateVisibility(true);

  closeNavDrawer();
  closeMenu();
  closeProfileDropdown();
  closeNavPopup();
  closeProfileEditorPage();

  const badge = $('campusCollegeBadge');
  if (badge) badge.hidden = true;

  chooseAuthMode('login');
}

function showAuthError(message, focusEl = null) {
  const errorEl = $('authError');
  if (errorEl) {
    errorEl.textContent = message;
  }
  if (focusEl && typeof focusEl.focus === 'function') {
    try { focusEl.focus(); } catch {}
  }
}

function chooseAuthMode(mode) {
  authMode = mode;
  const creating = mode === 'register';

  const loginTab = $('showLoginButton');
  const regTab = $('showRegisterButton');
  if (loginTab) {
    loginTab.classList.toggle('active', !creating);
    loginTab.setAttribute('aria-selected', !creating ? 'true' : 'false');
  }
  if (regTab) {
    regTab.classList.toggle('active', creating);
    regTab.setAttribute('aria-selected', creating ? 'true' : 'false');
  }

  const choices = $('authChoices');
  if (choices) choices.classList.remove('hide');
  const panel = $('authFormPanel');
  if (panel) panel.classList.remove('hide');

  const errorEl = $('authError');
  if (errorEl) errorEl.textContent = '';

  const statusEl = $('authUsernameStatus');
  if (statusEl) {
    statusEl.hidden = true;
    statusEl.className = 'auth-field-status';
    statusEl.textContent = '';
  }

  // Clear password inputs and reset toggles
  const pwdInput = $('authPassword');
  if (pwdInput) pwdInput.value = '';
  const confirmPwdInput = $('authConfirmPassword');
  if (confirmPwdInput) confirmPwdInput.value = '';
  resetPasswordVisibility('toggleAuthPassword', 'authPassword');
  resetPasswordVisibility('toggleConfirmPassword', 'authConfirmPassword');

  // Register-only fields
  const fields = $('authRegisterFields');
  if (fields) {
    fields.hidden = !creating;
    ['authFullName', 'authCollege', 'authCourse', 'authEmail'].forEach(id => {
      const field = $(id);
      if (field) {
        field.disabled = !creating;
        field.required = creating;
        if (!creating) field.value = '';
      }
    });
  }

  // Confirm password field (register only)
  const confirmWrap = $('authConfirmPasswordWrap');
  if (confirmWrap) {
    confirmWrap.hidden = !creating;
    if (confirmPwdInput) {
      confirmPwdInput.disabled = !creating;
      confirmPwdInput.required = creating;
    }
  }

  // Username field label and placeholder adapt between login and create account
  const uLabel = $('authUsernameLabel');
  const uInput = $('authUsername');
  if (uLabel) {
    uLabel.textContent = creating ? 'Choose Username *' : 'Username or Email *';
  }
  if (uInput) {
    uInput.placeholder = creating ? 'e.g. rahul_01 (3-30 letters/numbers)' : 'Enter username or email';
    uInput.maxLength = creating ? 30 : 254;
  }

  // Password field placeholder and autocomplete
  if (pwdInput) {
    pwdInput.autocomplete = creating ? 'new-password' : 'current-password';
    pwdInput.placeholder = creating ? 'Create password (min 6 characters)' : 'Enter password';
    pwdInput.minLength = creating ? 6 : 1;
  }
  const pwdLabel = $('authPasswordLabel');
  if (pwdLabel) {
    pwdLabel.textContent = creating ? 'Password (min 6 characters) *' : 'Password *';
  }

  // Forgot password wrap and panel: ONLY available in login mode, completely hidden in register mode
  const forgotWrap = $('forgotPasswordWrap');
  if (forgotWrap) {
    forgotWrap.hidden = creating;
    forgotWrap.style.display = creating ? 'none' : 'block';
  }
  const forgotBtn = $('forgotPasswordButton');
  if (forgotBtn) {
    forgotBtn.hidden = creating;
    forgotBtn.style.display = creating ? 'none' : 'inline-block';
  }
  const forgotPanel = $('forgotPasswordPanel');
  if (forgotPanel) forgotPanel.hidden = true;

  const titleEl = $('authFormTitle');
  if (titleEl) titleEl.textContent = creating ? 'Create new account' : 'Log In';

  const submitBtn = $('authSubmitButton');
  if (submitBtn) submitBtn.textContent = creating ? 'Create Account' : 'Log In';

  const welcomeTitle = $('authWelcomeTitle');
  if (welcomeTitle) welcomeTitle.textContent = creating ? 'Join CampUs' : 'Welcome to CampUs';

  const focusTarget = $(creating ? 'authFullName' : 'authUsername');
  if (focusTarget) focusTarget.focus();
}

function backToAuthChoices(fromPopstate = false) {
  chooseAuthMode('login');
  if (fromPopstate) {
    finishCampusUiLayer('authForm', true);
  }
}

function enterApp(user) {
  if (!$('authFormPanel').classList.contains('hide')) {
    finishCampusUiLayer('authForm');
  }

  if (user.token) {
    try { localStorage.setItem('campus_auth_token', user.token); } catch {}
  }
  try { localStorage.setItem('campus_user', JSON.stringify(user)); } catch {}

  currentUser = {
    username: user.username,
    displayName: user.displayName || user.username,
    phone: user.phone || '',
    course: user.course || '',
    college: user.college || 'CU',
    collegeName: user.collegeName || 'CU (Chandigarh University)',
    avatarId: validAvatarId(user.avatarId),
    profileImageData: user.profileImageData || '',
    bannerImageData: user.bannerImageData || '',
    role: user.role || 'MEMBER',
    usernameUnlimited: !!user.usernameUnlimited,
    usernameChangesRemaining:
      Number(user.usernameChangesRemaining ?? 1),
    usernameChangeWindowResetsAt:
      user.usernameChangeWindowResetsAt || ''
  };

  renderCollegeBadge();
  const chatSubtitle = $('chatCampusSubtitle');
  if (chatSubtitle) {
    chatSubtitle.textContent = 'CampUs · ' + formatCollegeFullName(currentUser.collegeName);
  }

  document.body.classList.remove('auth-locked');
  setAuthGateVisibility(false);

  updateGreeting();
  $('name').value = currentUser.displayName;
  $('phone').value = currentUser.phone;

  const drawerAdminBtn = $('drawerAdminBtn');
  if (drawerAdminBtn) drawerAdminBtn.classList.add('hide');
  loadCampusActiveAnnouncement();

  resetCampusScrollToTop();
  load();
  startNotificationPolling();
}

async function initAuth() {
  try {
    const response = await fetch('/api/auth/me', {
      headers: { Accept: 'application/json' }
    });

    const data = await response.json().catch(() => ({}));

    if (response.ok && data.authenticated) {
      enterApp(data);
    } else {
      try {
        localStorage.removeItem('campus_auth_token');
        localStorage.removeItem('campus_user');
      } catch {}
      showAuthGate();
    }
  } catch {
    showAuthGate();
  }
}

// Live debounced username check in Create Account mode
let authUsernameCheckTimer = null;
$('authUsername')?.addEventListener('input', (e) => {
  if (authMode !== 'register') return;
  const statusEl = $('authUsernameStatus');
  if (!statusEl) return;
  clearTimeout(authUsernameCheckTimer);
  const val = e.target.value.trim().toLowerCase();
  if (!val) {
    statusEl.hidden = true;
    statusEl.className = 'auth-field-status';
    statusEl.textContent = '';
    return;
  }
  if (val.length < 3) {
    statusEl.hidden = false;
    statusEl.className = 'auth-field-status hint';
    statusEl.textContent = '⚠️ Username must be at least 3 characters.';
    return;
  }
  if (val.length > 30) {
    statusEl.hidden = false;
    statusEl.className = 'auth-field-status error';
    statusEl.textContent = '⚠️ Username must be 30 characters or fewer.';
    return;
  }
  if (!/^[a-z0-9_.]+$/.test(val)) {
    statusEl.hidden = false;
    statusEl.className = 'auth-field-status error';
    statusEl.textContent = '⚠️ Only lowercase letters, numbers, dots & underscores allowed.';
    return;
  }
  statusEl.hidden = false;
  statusEl.className = 'auth-field-status hint';
  statusEl.textContent = 'Checking availability…';
  authUsernameCheckTimer = setTimeout(async () => {
    try {
      const res = await fetch(`/api/auth/check-username?username=${encodeURIComponent(val)}`);
      const data = await res.json().catch(() => ({}));
      if (val !== $('authUsername')?.value.trim().toLowerCase()) return;
      if (data.available) {
        statusEl.className = 'auth-field-status available';
        statusEl.textContent = '✓ ' + (data.message || 'Username is available.');
      } else {
        statusEl.className = 'auth-field-status taken';
        statusEl.textContent = '✗ ' + (data.message || 'This username is already taken.');
      }
    } catch {
      statusEl.hidden = true;
    }
  }, 300);
});

let resetOtpRequested=false;
$('forgotPasswordButton')?.addEventListener('click',()=>{
  const panel=$('forgotPasswordPanel');
  const choices=$('authChoices');
  const formPanel=$('authFormPanel');

  if(choices) choices.classList.add('hide');
  if(formPanel) formPanel.classList.add('hide');
  if(panel) panel.hidden=false;

  $('resetPasswordMessage').textContent='';
  $('resetEmail').value=$('authEmail')?.value||$('authUsername')?.value||'';
  $('resetOtpFields').hidden=true;
  resetOtpRequested=false;
  setTimeout(()=>$('resetEmail')?.focus(), 60);
});
$('cancelResetPasswordButton')?.addEventListener('click',()=>{
  const panel=$('forgotPasswordPanel');
  const choices=$('authChoices');
  const formPanel=$('authFormPanel');

  if(panel) panel.hidden=true;
  if(choices) choices.classList.remove('hide');
  if(formPanel) formPanel.classList.remove('hide');

  chooseAuthMode('login');
});
$('sendResetOtpButton')?.addEventListener('click',async()=>{
  const identifier=$('resetEmail').value.trim();
  const msg=$('resetPasswordMessage'),btn=$('sendResetOtpButton');
  msg.textContent='';
  if(!identifier){msg.textContent='Please enter your registered email or username.';return;}
  btn.disabled=true;btn.textContent='Sending…';
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timeoutId = controller ? setTimeout(()=>controller.abort(), 10000) : null;
  try{
    const r=await fetch('/api/auth/forgot-password',{
      method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},
      body:JSON.stringify({email:identifier}),
      signal: controller ? controller.signal : undefined
    });
    if(timeoutId) clearTimeout(timeoutId);
    const d=await r.json().catch(()=>({}));
    if(!r.ok){msg.textContent=d.message||'Could not send OTP. Please check your spelling and try again.';return;}
    resetOtpRequested=true;$('resetOtpFields').hidden=false;
    if($('resetOtp'))$('resetOtp').value='';
    msg.textContent=d.message||'An OTP has been sent. Please check your inbox and enter it below.';
    if(d.otpCode){
      msg.innerHTML=`${esc(d.message)}<br><div style="margin-top:8px;padding:6px 14px;background:#FFF0E3;border:1px dashed #E8944B;border-radius:10px;display:inline-block;font-size:17px;font-weight:900;color:#D0813B;letter-spacing:4px;font-family:monospace;">${esc(d.otpCode)}</div>`;
    }
    $('resetOtp')?.focus();
  }catch(err){
    if(err && err.name === 'AbortError') {
      msg.textContent='Request timed out. Please click Resend OTP.';
    } else {
      msg.textContent='Could not connect. Please try again.';
    }
  }finally{
    if(timeoutId) clearTimeout(timeoutId);
    btn.disabled=false;btn.textContent='Resend OTP';
  }
});
$('verifyResetOtpButton')?.addEventListener('click',async()=>{
  const identifier=$('resetEmail').value.trim(),otp=$('resetOtp').value.trim(),password=$('resetNewPassword').value;
  const msg=$('resetPasswordMessage'),btn=$('verifyResetOtpButton');
  msg.textContent='';
  if(!/^\d{6}$/.test(otp)){msg.textContent='Enter the 6-digit OTP code.';return;}
  if(password.length<6){msg.textContent='New password must be at least 6 characters.';return;}
  btn.disabled=true;btn.textContent='Resetting…';
  try{
    const r=await fetch('/api/auth/reset-password',{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({email:identifier,otp,newPassword:password})});
    const d=await r.json().catch(()=>({}));
    if(!r.ok){msg.textContent=d.message||'OTP invalid or expired. Request a new OTP.';return;}
    msg.textContent='✓ Password reset successfully! Redirecting to login…';
    setTimeout(()=>{
      const panel=$('forgotPasswordPanel');
      const choices=$('authChoices');
      const formPanel=$('authFormPanel');

      if(panel) panel.hidden=true;
      if(choices) choices.classList.remove('hide');
      if(formPanel) formPanel.classList.remove('hide');

      chooseAuthMode('login');
      $('authUsername').value=identifier;
      $('authPassword').value='';
      $('authPassword').focus();
    }, 1500);
  }catch{msg.textContent='Could not connect. Please try again.';}
  finally{btn.disabled=false;btn.textContent='Verify OTP & reset password';}
});

function resetPasswordVisibility(buttonId, inputId) {
  const btn = $(buttonId);
  const input = $(inputId);
  if (!btn || !input) return;
  input.type = 'password';
  btn.classList.remove('is-showing');
  btn.setAttribute('aria-label', 'Show password');
  btn.setAttribute('title', 'Show password');
  const eyeShow = btn.querySelector('.eye-show');
  const eyeHide = btn.querySelector('.eye-hide');
  if (eyeShow) eyeShow.style.display = 'block';
  if (eyeHide) eyeHide.style.display = 'none';
}

function setupPasswordToggle(buttonId, inputId) {
  const btn = $(buttonId);
  const input = $(inputId);
  if (!btn || !input) return;
  btn.addEventListener('click', () => {
    const isShowing = input.type === 'text';
    const nextShowing = !isShowing;
    input.type = nextShowing ? 'text' : 'password';
    btn.classList.toggle('is-showing', nextShowing);
    btn.setAttribute('aria-label', nextShowing ? 'Hide password' : 'Show password');
    btn.setAttribute('title', nextShowing ? 'Hide password' : 'Show password');
    const eyeShow = btn.querySelector('.eye-show');
    const eyeHide = btn.querySelector('.eye-hide');
    if (eyeShow) eyeShow.style.display = nextShowing ? 'none' : 'block';
    if (eyeHide) eyeHide.style.display = nextShowing ? 'block' : 'none';
  });
}
setupPasswordToggle('toggleAuthPassword', 'authPassword');
setupPasswordToggle('toggleConfirmPassword', 'authConfirmPassword');
setupPasswordToggle('toggleResetPassword', 'resetNewPassword');

$('showLoginButton')?.addEventListener('click',()=>chooseAuthMode('login'));
$('showRegisterButton')?.addEventListener('click',()=>chooseAuthMode('register'));

$('authForm')?.addEventListener('submit',async event=>{
  event.preventDefault();
  const errorEl = $('authError');
  if (errorEl) errorEl.textContent = '';

  const isRegister = authMode === 'register';
  const username = ($('authUsername')?.value || '').trim().toLowerCase();
  const password = $('authPassword')?.value || '';
  const displayName = ($('authFullName')?.value || '').trim();
  const college = $('authCollege')?.value || '';
  const course = ($('authCourse')?.value || '').trim();
  const email = ($('authEmail')?.value || '').trim().toLowerCase();
  const confirmPassword = ($('authConfirmPassword')?.value || '');

  if (isRegister) {
    if (!displayName) {
      showAuthError('Please enter your full name.', $('authFullName'));
      return;
    }
    if (displayName.length > 100) {
      showAuthError('Full name must be 100 characters or fewer.', $('authFullName'));
      return;
    }
    if (!college) {
      showAuthError('Please select your College / University.', $('authCollege'));
      return;
    }
    if (!course) {
      showAuthError('Please enter your course / branch.', $('authCourse'));
      return;
    }
    if (course.length > 100) {
      showAuthError('Course must be 100 characters or fewer.', $('authCourse'));
      return;
    }
    if (!email) {
      showAuthError('Please enter your email address.', $('authEmail'));
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      showAuthError('Please enter a valid email address (e.g. name@gmail.com).', $('authEmail'));
      return;
    }
    if (!username) {
      showAuthError('Please choose a username.', $('authUsername'));
      return;
    }
    if (username.length < 3) {
      showAuthError('Username must be at least 3 characters.', $('authUsername'));
      return;
    }
    if (username.length > 30) {
      showAuthError('Username must be 30 characters or fewer.', $('authUsername'));
      return;
    }
    if (!/^[a-z0-9_.]+$/.test(username)) {
      showAuthError('Username can only contain lowercase letters, numbers, dots, and underscores.', $('authUsername'));
      return;
    }
    if (!password) {
      showAuthError('Please create a password.', $('authPassword'));
      return;
    }
    if (password.length < 6) {
      showAuthError('Password must be at least 6 characters long.', $('authPassword'));
      return;
    }
    if (confirmPassword !== password) {
      showAuthError('Passwords do not match. Please re-enter your password.', $('authConfirmPassword'));
      return;
    }
  } else {
    if (!username) {
      showAuthError('Please enter your username or email address.', $('authUsername'));
      return;
    }
    if (!password) {
      showAuthError('Please enter your password.', $('authPassword'));
      return;
    }
  }

  const button = $('authSubmitButton');
  if (button) {
    button.disabled = true;
    button.textContent = isRegister ? 'Creating account…' : 'Logging in…';
  }

  try {
    const payload = isRegister
      ? { username, password, displayName, course, email, college }
      : { username, password };
    const response = await fetch(isRegister ? '/api/auth/register' : '/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      showAuthError(data.message || (isRegister ? 'Could not create account. Please try again.' : 'Incorrect username or password. Please try again.'));
      return;
    }
    if ($('authPassword')) $('authPassword').value = '';
    if ($('authConfirmPassword')) $('authConfirmPassword').value = '';
    enterApp(data);
    toast(isRegister ? 'Account created successfully! Welcome to CampUs 🎓' : 'Welcome back, ' + (data.displayName || data.username) + '! 👋');
  } catch {
    showAuthError('Could not connect to CampUs. Make sure the Java server is running, then try again.');
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = isRegister ? 'Create Account' : 'Log In';
    }
  }
});

async function logout(){
  stopNotificationPolling();
  closeNavDrawer();
  $('drawerAdminBtn')?.classList.add('hide');
  if ($('adminDashboardModal') && !$('adminDashboardModal').classList.contains('hide')) closeAdminDashboard();
  closeMenu();closeProfileDropdown();closeNavPopup();closeProfileEditorPage();closeForm();
  const badge=$('campusCollegeBadge');if(badge)badge.hidden=true;
  try{await fetch('/api/auth/logout',{method:'POST'});}catch{}
  try{
    localStorage.removeItem('campus_auth_token');
    localStorage.removeItem('campus_user');
  }catch{}
  showAuthGate();
  backToAuthChoices();
  toast('You have been logged out.');
}

// Usernames are canonical lowercase while typing, including the dynamically-created Profile field.
document.addEventListener('input',function(e){
 const field=e.target;
 if(!field || !field.matches || !field.matches('#authUsername, #profileUsername')) return;
 const start=field.selectionStart;
 const end=field.selectionEnd;
 const normalized=field.value.toLowerCase();
 if(field.value!==normalized){field.value=normalized;try{field.setSelectionRange(start,end);}catch{}}
});

// Robust delegated navigation handling for touch and desktop pointer events.
document.addEventListener('click',function(e){
 const a=e.target.closest && e.target.closest('#mainNav a[data-page]');
 if(a){e.preventDefault();e.stopPropagation();showNavPopup(a.dataset.page);}
},true);


// Community chat: messages are stored on the server and refreshed for everyone.
let communityChatOpen=false, chatReplyTarget=null, chatPollTimer=null, lastChatSignature='';
function syncChatViewport(){
  if(!communityChatOpen)return;
  const overlay=$('communityChatOverlay'),vv=window.visualViewport;
  if(vv){overlay.style.setProperty('--chat-vv-height',`${Math.max(180,vv.height)}px`);overlay.style.setProperty('--chat-vv-top',`${Math.max(0,vv.offsetTop)}px`);}
  else{overlay.style.setProperty('--chat-vv-height',`${window.innerHeight}px`);overlay.style.setProperty('--chat-vv-top','0px');}
}
function openCommunityChat(){
  // Always open the chat screen on tap; the API response will explain if a session/backend is unavailable.
  if(!communityChatOpen)pushCampusUiLayer('communityChat');
  communityChatOpen=true;chatReplyTarget=null;document.body.classList.add('chat-fullscreen-open');$('communityChatOverlay').classList.remove('hide');syncChatViewport();syncCommunityMuteControls();refreshNotifications();clearChatReply();loadCommunityMessages(true);clearInterval(chatPollTimer);chatPollTimer=setInterval(()=>{if(communityChatOpen)loadCommunityMessages(false)},4000);setTimeout(()=>{$('communityChatInput').focus();syncChatViewport()},80);
}
function closeCommunityChat(fromPopstate=false){if(!communityChatOpen)return;communityChatOpen=false;clearInterval(chatPollTimer);chatPollTimer=null;$('communityChatOverlay').classList.add('hide');document.body.classList.remove('chat-fullscreen-open');$('communityChatOverlay').style.removeProperty('--chat-vv-height');$('communityChatOverlay').style.removeProperty('--chat-vv-top');$('communityChatInput').blur();finishCampusUiLayer('communityChat',fromPopstate);}
$('communityChatOverlay').addEventListener('click',e=>{if(e.target===$('communityChatOverlay'))closeCommunityChat()});
function clearChatReply(){chatReplyTarget=null;$('chatReplyPreview').classList.add('hide');$('chatReplyText').textContent='';}
function setChatReply(msg){chatReplyTarget=msg;$('chatReplyText').textContent=`${msg.displayName}: ${msg.message}`;$('chatReplyPreview').classList.remove('hide');$('communityChatInput').focus();}
let cachedCommunityMessages=[];
function chatTime(value){
  try{
    if(!value)return '';
    let d=new Date(value);
    if(isNaN(d.getTime())&&typeof value==='string')d=new Date(value.replace(' ','T'));
    if(isNaN(d.getTime()))return '';
    return new Intl.DateTimeFormat(undefined,{hour:'numeric',minute:'2-digit'}).format(d);
  }catch{return ''}
}
function renderCommunityMessages(items,forceBottom){
 const box=$('chatMessages'),nearBottom=box.scrollHeight-box.scrollTop-box.clientHeight<90;
 if(!items.length){box.innerHTML='<div class="empty">No messages yet. Say hello to your campus community! 👋</div>';lastChatSignature='';return}
 const signature=items.map(m=>`${m.id}:${m.username}:${m.displayName}:${m.role}:${m.message}:${m.replyText||''}`).join('|');
 if(signature===lastChatSignature)return;
 lastChatSignature=signature;
 box.innerHTML=items.map(m=>{
   const mine=!!m.mine;
   const fullName=String(m.displayName||m.username||'CampUs user').trim();
   const username=String(m.username||'');
   const avatar=`<button type="button" class="chat-avatar chat-avatar-button" aria-label="View ${esc(fullName)}'s profile" data-chat-profile-name="${esc(fullName)}" data-chat-profile-username="${esc(username)}">${avatarInner(m.avatarId,fullName,m.profileImageUrl)}</button>`;
   const authorLine=!mine?`<button type="button" class="chat-author-role" data-chat-profile-name="${esc(fullName)}" data-chat-profile-username="${esc(username)}">${esc(fullName)}</button>`:'';
   return `<div class="chat-row ${mine?'mine':'theirs'}" data-message-id="${m.id}">${mine?'':avatar}<div class="chat-message-stack">${authorLine}<div class="chat-bubble" role="group" aria-label="Chat message">${m.replyText?`<div class="chat-quoted"><b>${esc(m.replyName||'Reply')}</b><br>${esc(m.replyText)}</div>`:''}<div class="chat-text">${esc(m.message)}</div><div class="chat-time">${chatTime(m.createdAt)}</div><div class="chat-actions"><button type="button" onclick="replyToChatMessage(${m.id})">↩ Reply</button>${m.canDelete?`<button type="button" onclick="deleteChatMessage(${m.id})">Delete</button>`:''}</div></div></div></div>`
 }).join('');
 box.querySelectorAll('.chat-row').forEach(row=>{
   const bubble=row.querySelector('.chat-bubble');
   bubble.addEventListener('click',e=>{
     if(e.target.closest('button'))return;
     row.classList.toggle('actions-open');
   });
   bubble.addEventListener('contextmenu',e=>{
     e.preventDefault();
     row.classList.toggle('actions-open');
   });
   let sx=0,sy=0;
   row.addEventListener('touchstart',e=>{sx=e.changedTouches[0].clientX;sy=e.changedTouches[0].clientY},{passive:true});
   row.addEventListener('touchend',e=>{
     const dx=e.changedTouches[0].clientX-sx,dy=e.changedTouches[0].clientY-sy;
     if(Math.abs(dx)>50&&Math.abs(dx)>Math.abs(dy)*1.3){
       const id=Number(row.dataset.messageId),msg=items.find(x=>x.id===id);
       if(msg){row.classList.remove('actions-open');setChatReply(msg)}
     }
   },{passive:true});
 });
 if(forceBottom||nearBottom)box.scrollTop=box.scrollHeight;
}
async function loadCommunityMessages(forceBottom){
  try{
    const r=await fetch('/api/community-chat',{headers:{'Accept':'application/json'}});
    if(r.status===401){
      $('chatMessages').innerHTML='<div class="chat-unavailable"><div class="chat-unavailable-icon" aria-hidden="true">💬</div><h3>Community chat is ready</h3><p>Connect the Java backend and sign in to load campus messages and send replies.</p><button type="button" class="light" onclick="loadCommunityMessages(true)">Try again</button></div>';
      return;
    }
    if(!r.ok)throw new Error('Chat service is unavailable');
    const items=await r.json();
    cachedCommunityMessages=Array.isArray(items)?items:[];
    renderCommunityMessages(cachedCommunityMessages,forceBottom);
  }catch{
    $('chatMessages').innerHTML='<div class="chat-unavailable"><div class="chat-unavailable-icon" aria-hidden="true">💬</div><h3>Chat page is ready</h3><p>Messages and sending will be available when the Java backend is connected.</p><button type="button" class="light" onclick="loadCommunityMessages(true)">Retry connection</button></div>';
  }
}
function replyToChatMessage(id){
  const msg=cachedCommunityMessages.find(x=>x.id===id);
  if(msg){setChatReply(msg);return;}
  fetch('/api/community-chat').then(r=>r.json()).then(items=>{
    cachedCommunityMessages=Array.isArray(items)?items:[];
    const found=cachedCommunityMessages.find(x=>x.id===id);
    if(found)setChatReply(found);
  }).catch(()=>toast('Could not open reply. Try again.'));
}
async function deleteChatMessage(id){
  if(!confirm('Delete this message? You can only delete your own messages within 10 minutes.'))return;
  try{
    const r=await fetch(`/api/community-chat/${id}`,{method:'DELETE'});
    const data=await r.json().catch(()=>({}));
    if(!r.ok)throw Error(data.message||'Could not delete message.');
    lastChatSignature='';
    await loadCommunityMessages(false);
    toast('Message deleted');
  }catch(e){toast(e.message||'Could not delete message');}
}
$('communityChatForm').addEventListener('submit',async e=>{
  e.preventDefault();
  const input=$('communityChatInput'),message=input.value.trim();
  if(!message)return;
  const sendButton=$('communityChatForm').querySelector('button[type="submit"]');
  sendButton.disabled=true;
  try{
    const r=await fetch('/api/community-chat',{
      method:'POST',
      headers:{'Content-Type':'application/json','Accept':'application/json'},
      body:JSON.stringify({message,replyText:chatReplyTarget?.message||null,replyName:chatReplyTarget?.displayName||null})
    });
    const data=await r.json().catch(()=>({}));
    if(!r.ok)throw Error(data.message||'Could not send message.');
    input.value='';
    input.style.height='auto';
    clearChatReply();
    lastChatSignature='';
    await loadCommunityMessages(true);
  }catch(err){toast(err.message||'Could not send message');}
  finally{sendButton.disabled=false;input.focus();}
});

// Full-screen public profile, opened from a chat avatar or a report author.
let profileLoadToken=0, profileLastName='', profileLastUsername='';
async function openChatUserProfile(fullName, username){
 const profile=$('communityProfilePage'),content=$('communityProfileContent');
 if(!profile||!content)return;
 const wasHidden=profile.classList.contains('hide');
 if(wasHidden)pushCampusUiLayer('publicProfile');
 const token=++profileLoadToken;
 const safeFallbackName=String(fullName||'CampUs user').trim()||'CampUs user';
 if(document.activeElement&&typeof document.activeElement.blur==='function')document.activeElement.blur();
 profileLastName=safeFallbackName;profileLastUsername=String(username||'');
 profile.classList.remove('hide');
 content.scrollTop=0;
 document.body.classList.add('public-profile-open');
 $('publicProfileOwnerActions')?.classList.add('hide');
 closePublicProfileRoleMenu();
 content.innerHTML='<div class="empty">Loading profile…</div>';
 if(!username){
   content.innerHTML=`<section class="public-profile-hero"><div class="public-profile-avatar">${esc(safeFallbackName.charAt(0).toUpperCase())}</div><h2>${esc(safeFallbackName)}</h2><p>Profile details are unavailable for this older report.</p></section>`;
   return;
 }
 try{
  const response=await fetch(`/api/users/${encodeURIComponent(username)}/profile`,{headers:{'Accept':'application/json'}});
  const data=await response.json().catch(()=>({}));
  if(token!==profileLoadToken)return;
  if(!response.ok)throw Error(data.message||'Could not load this profile.');
  renderPublicProfile(data);
 }catch(error){if(token===profileLoadToken)content.innerHTML=`<div class="empty"><b>Profile unavailable</b><p>${esc(error.message||'Please try again.')}</p><button type="button" onclick="retryCommunityProfile()">Retry</button></div>`;}
}
function renderPublicProfile(data){
 const content=$('communityProfileContent');
 const name=String(data.displayName||data.username||'CampUs user');
 const initial=String(data.avatarInitial||name.trim().charAt(0)||'?').charAt(0).toUpperCase();
 const roleText=roleLabel(data.role);
 // Public appearance belongs to the profile being viewed, not the viewer.
 // The API only returns bannerImageUrl when the target account is entitled to a banner.
 const hasBanner=!!data.bannerImageUrl;
 const viewerUsername=String(data.viewerUsername||currentUser?.username||'').toLowerCase();
 const targetUsername=String(data.username||'').toLowerCase();
 const isOwnProfile=!!targetUsername&&targetUsername===viewerUsername;
 const posts=Array.isArray(data.posts)?data.posts:[];
 const postCards=posts.length?posts.map(post=>{
  const type=String(post.type||'').toUpperCase();
  const status=String(post.status||'OPEN').toUpperCase();
  return `<article class="public-profile-post" id="profile-post-${post.id}">
    <div class="public-profile-post-top">
      <span class="pill ${type==='FOUND'?'found':''}">${type==='FOUND'?'● FOUND ITEM':'● LOST ITEM'}</span>
      <span class="status ${status==='RETURNED'?'returned':status==='MATCHED'?'matched':'open'}">${esc(status)}</span>
    </div>
    <h3>${esc(post.title||'Untitled item')}</h3>
    <div class="meta">${esc(post.category||'Other')} · 📍 ${esc(post.location||'Location not specified')}</div>
    ${post.imageData?`<img class="public-profile-post-image" src="${esc(post.imageData)}" alt="${esc(post.title||'Reported item')}" loading="lazy">`:''}
    ${post.description?`<p>${esc(post.description)}</p>`:''}
    <small class="public-profile-post-date">${esc(post.itemDate||'Date not specified')}</small>
    <div class="profile-post-owner-bar">
      <button type="button" class="prof-act-btn" onclick="openPostComments(${post.id})">💬 Comments</button>
      <button type="button" class="prof-act-btn" onclick="sharePost(${post.id}, '${esc(post.title)}')">🔗 Share</button>
      ${isOwnProfile ? `
        <button type="button" class="prof-act-btn" onclick="archiveReport(${post.id})" title="Archive post (hides from feed)">📁 Archive</button>
        <button type="button" class="prof-act-btn del" onclick="deleteReport(${post.id})" title="Move to Recently Deleted (restorable for 30 days)">🗑 Delete</button>
      ` : ''}
    </div>
  </article>`;
 }).join(''):'<div class="empty public-profile-empty"><b>No posts yet</b><p>This member has not posted any lost or found items.</p></div>';
 const viewerRole=String(data.viewerRole||currentUser?.role||'MEMBER').toUpperCase();
 const targetRole=String(data.role||'MEMBER').toUpperCase();
 const bannerMarkup=hasBanner?`<div class="public-profile-banner"><img src="${esc(data.bannerImageUrl)}" alt="${esc(name)} profile banner" loading="lazy"></div>`:'';
 const editButton=isOwnProfile?'<div class="public-profile-own-actions"><button type="button" class="public-profile-edit-button" onclick="openProfileEditorPage()">Edit profile</button></div>':'';
 content.innerHTML=`<section class="public-profile-hero${hasBanner?' has-profile-banner':' no-profile-banner'}">${bannerMarkup}<div class="public-profile-avatar" aria-label="${esc(name)} avatar">${avatarInner(data.avatarId,name,data.profileImageUrl)}</div><h2>${esc(name)} ${roleBadgeMarkup(data.role)}</h2><p class="public-profile-handle">@${esc(data.username||'')}</p><div class="public-profile-course">${esc(data.course||'Course not provided')}</div><div class="public-profile-stats"><div><b>${Number(data.totalPosts)||0}</b><span>Posts</span></div><div><b>${Number(data.itemsReceivedBack)||0}</b><span>Received</span></div><div><b>${Number(data.itemsReturnedToOthers)||0}</b><span>Returned</span></div><div style="cursor:pointer;" onclick="openLeaderboardModal()" title="View Karma Leaderboard"><b style="color:var(--insta-primary);">⭐ ${Number(data.karmaPoints)||0}</b><span>${esc(data.karmaBadge||'Campus Friend')}</span></div></div>${editButton}</section><section class="public-profile-posts"><div class="public-profile-posts-heading"><h2>Posts</h2><span>${posts.length}</span></div><div class="public-profile-post-grid">${postCards}</div></section>`;
 $('communityProfilePageTitle').textContent=isOwnProfile?'Your profile':'Profile';
 const controls=$('publicProfileOwnerActions');
 if(controls)controls.classList.add('hide');
 const menu=$('publicProfileRoleMenu'),menuButton=$('publicProfileRoleMenuButton');
 if(menu){menu.hidden=true;menu.querySelectorAll('[data-role-choice]').forEach(button=>{const same=button.dataset.roleChoice===targetRole;button.disabled=same;button.setAttribute('aria-current',same?'true':'false');button.textContent=same?`Current role: ${button.dataset.roleLabel}`:button.dataset.roleAction;});}
 if(menuButton)menuButton.setAttribute('aria-expanded','false');
}
function closePublicProfileRoleMenu(){
 const menu=$('publicProfileRoleMenu'),button=$('publicProfileRoleMenuButton');
 if(menu)menu.hidden=true;
 if(button)button.setAttribute('aria-expanded','false');
}
function togglePublicProfileRoleMenu(){
 if(String(currentUser?.role||'').toUpperCase()!=='OWNER')return;
 const menu=$('publicProfileRoleMenu'),button=$('publicProfileRoleMenuButton');if(!menu||!button)return;
 menu.hidden=!menu.hidden;button.setAttribute('aria-expanded',String(!menu.hidden));
}
async function assignPublicProfileRole(role){
 if(String(currentUser?.role||'').toUpperCase()!=='OWNER'){toast('Only the Owner can change roles here.');return;}
 const username=String(profileLastUsername||'').trim().toLowerCase();
 if(!username||username===String(currentUser?.username||'').toLowerCase()){toast('You cannot change your own Owner role.');return;}
 const allowed=['ADMIN','LEADER','MODERATOR','MEMBER'];if(!allowed.includes(role)){toast('Choose a valid member role.');return;}
 closePublicProfileRoleMenu();
 try{
  const response=await fetch(`/api/users/${encodeURIComponent(username)}/role`,{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({role})});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(data.message||'Could not update this member role.');
  toast(`@${username} is now ${String(data.role||role).toLowerCase()}.`);
  await openChatUserProfile(profileLastName,username);
  load();
  if(communityChatOpen)loadCommunityMessages(false);
 }catch(error){toast(error.message||'Could not update this member role.');}
}

function retryCommunityProfile(){openChatUserProfile(profileLastName,profileLastUsername)}
function closeChatUserProfile(fromPopstate=false){
 const page=$('communityProfilePage');if(!page||page.classList.contains('hide'))return;
 const returnToHome=!communityChatOpen;
 profileLoadToken++;page.classList.add('hide');
 document.body.classList.remove('public-profile-open');
 finishCampusUiLayer('publicProfile',fromPopstate);
 if(returnToHome)resetCampusScrollToTop();
}
// Profile navigation from chat avatars and report author rows.
document.addEventListener('click',event=>{
 const target=event.target.closest&&event.target.closest('[data-profile-username], [data-chat-profile-username], [data-user-search-username]');
 if(!target)return;
 event.preventDefault();
 if(target.hasAttribute('data-user-search-username'))hideUserSearchResults();
 openChatUserProfile(target.dataset.profileName||target.dataset.chatProfileName||'',target.dataset.profileUsername||target.dataset.chatProfileUsername||target.dataset.userSearchUsername||'');
});

// Return/Enter sends the message; Shift+Enter inserts a line break.
$('communityChatInput')?.addEventListener('keydown',e=>{
  if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){
    e.preventDefault();
    const form=$('communityChatForm');
    if(typeof form.requestSubmit==='function'){
      form.requestSubmit();
    }else{
      form.dispatchEvent(new Event('submit',{cancelable:true,bubbles:true}));
    }
  }
});
$('communityChatInput')?.addEventListener('input',function(){
  this.style.height='auto';
  this.style.height=Math.min(this.scrollHeight,120)+'px';
});
// Keep the full-screen chat fitted to the visible viewport when the phone keyboard opens.
window.addEventListener('resize',syncChatViewport,{passive:true});
if(window.visualViewport){window.visualViewport.addEventListener('resize',syncChatViewport,{passive:true});window.visualViewport.addEventListener('scroll',syncChatViewport,{passive:true});}

// Use the same circular ‹ back control on phone, tablet, and desktop.
// Back actions remain in-app; only their visual treatment is unified.
function syncResponsiveBackControls(){
 document.body.classList.add('back-controls-arrow');
 document.body.classList.remove('back-controls-close');
 document.querySelectorAll('.x, .chat-back, .community-profile-back, .profile-editor-back, .nav-popup-back').forEach(button=>{
   button.textContent='‹';
   button.setAttribute('aria-label',
     button.classList.contains('chat-back')?'Back to CampUs':
     button.classList.contains('community-profile-back')?'Back to previous screen':
     button.classList.contains('profile-editor-back')?'Back to previous screen':
     button.classList.contains('nav-popup-back')?'Back to previous screen':'Back'
   );
 });
}
window.addEventListener('resize',syncResponsiveBackControls,{passive:true});
window.addEventListener('orientationchange',syncResponsiveBackControls,{passive:true});
syncResponsiveBackControls();

// Full-screen CampUs welcome flow: reveal content in either scroll direction.
(function setupFirstVisitIntro(){
  const intro=document.getElementById('firstVisitIntro');
  const continueButton=document.getElementById('introContinue');
  if(!intro||!continueButton)return;
  try{
    if(localStorage.getItem('campus_intro_seen')==='true'){
      intro.hidden=true;
      intro.style.display='none';
      document.body.classList.remove('intro-open');
      return;
    }
  }catch{}
  intro.hidden=false;
  intro.style.display='block';
  document.body.classList.add('intro-open');
  // Safari can restore the nested intro scroller at its previous offset. Always
  // open the welcome experience at the top so the full hero is visible first.
  const resetIntroPosition=()=>{
    // Safari may restore either the nested overlay's scroll or the document's scroll.
    window.scrollTo(0,0);
    document.documentElement.scrollTop=0;
    document.body.scrollTop=0;
    intro.scrollTop=0;
  };
  resetIntroPosition();
  requestAnimationFrame(resetIntroPosition);
  setTimeout(resetIntroPosition,80);
  setTimeout(resetIntroPosition,260);
  window.addEventListener('pageshow',()=>{
    if(!intro.hidden && getComputedStyle(intro).display!=='none'){
      resetIntroPosition();
      requestAnimationFrame(resetIntroPosition);
      setTimeout(resetIntroPosition,100);
    }
  });
  const progress=document.getElementById('introProgressBar');
  const updateProgress=()=>{if(!progress)return;const max=intro.scrollHeight-intro.clientHeight;progress.style.width=(max>0?Math.min(100,intro.scrollTop/max*100):0)+'%';};
  intro.addEventListener('scroll',updateProgress,{passive:true});updateProgress();
  const revealItems=intro.querySelectorAll('.reveal-on-scroll');
  if('IntersectionObserver' in window){
    const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{
      // Remove the class when leaving the viewport so it animates again when scrolling back.
      entry.target.classList.toggle('is-visible',entry.isIntersecting);
    }),{root:intro,threshold:0.14,rootMargin:'0px 0px -4% 0px'});
    revealItems.forEach(item=>observer.observe(item));
  }else{revealItems.forEach(item=>item.classList.add('is-visible'));}
  
function dismissIntro() {
  try{localStorage.setItem('campus_intro_seen','true');}catch{}
  intro.hidden = true;
  intro.style.display = 'none';
  document.body.classList.remove('intro-open');

  if (currentUser) {
    document.body.classList.remove('auth-locked');
    setAuthGateVisibility(false);
  } else {
    document.body.classList.add('auth-locked');
    setAuthGateVisibility(true);
  }

  // Preserve the in-app Back behavior without leaving the current page.
  const state = history.state && typeof history.state === 'object' ? history.state : {};
  if (!state.campusFindMainView) {
    history.pushState({
      ...state,
      campusFindMainView: true,
      campusFindMainToken: ++campusUiToken
    }, '', location.href);
  }

  window.scrollTo(0, 0);
  if (currentUser) load();
}

  continueButton.addEventListener('click',dismissIntro);
  const topStart=document.getElementById('introTopStart');
  if(topStart)topStart.addEventListener('click',dismissIntro);
  const stepContent=[
    {icon:'＋',eyebrow:'STEP 1 · REPORT IT',title:'Give the community a useful starting point.',description:'Add the item type, where it was lost or found, and the date if you know it. Clear details make a report easier to recognise.'},
    {icon:'⌕',eyebrow:'STEP 2 · LOOK FOR A MATCH',title:'Look through the details, not just the title.',description:'Browse reports and compare useful clues such as colour, item type, location and date. Treat examples as clues, and keep private details private.'},
    {icon:'✓',eyebrow:'STEP 3 · RECONNECT',title:'Help the item return to its owner safely.',description:'When a report looks familiar, follow the available contact process and confirm ownership before arranging a handover.'}
  ];
  const stepTabs=intro.querySelectorAll('[data-intro-step]');
  stepTabs.forEach(tab=>tab.addEventListener('click',()=>{
    const index=Number(tab.dataset.introStep);const step=stepContent[index];if(!step)return;
    stepTabs.forEach((item,i)=>{const active=i===index;item.classList.toggle('is-active',active);item.setAttribute('aria-selected',active?'true':'false');});
    const icon=document.getElementById('introStepIcon'),eyebrow=document.getElementById('introStepEyebrow'),title=document.getElementById('introStepTitle'),description=document.getElementById('introStepDescription');
    if(icon)icon.textContent=step.icon;if(eyebrow)eyebrow.textContent=step.eyebrow;if(title)title.textContent=step.title;if(description)description.textContent=step.description;
  }));
})();


// Keep the main navigation visible and dock search only after its original row scrolls away.
(function campusFindStickyHeaderSearch(){
  const searchBar = document.querySelector('body > .board-search');
  const siteHeader = document.querySelector('body > header:not(.community-profile-topbar)');
  if (!searchBar || !siteHeader) return;
  let dockThreshold = 180;
  const measureDockThreshold = () => {
    const headerHeight = siteHeader.getBoundingClientRect().height || 70;
    // Mobile headers are taller and have no free horizontal search slot; place the dock row just below them.
    document.documentElement.style.setProperty('--campus-header-height', `${Math.round(headerHeight)}px`);
    const searchTop = searchBar.getBoundingClientRect().top + window.scrollY;
    const searchHeight = searchBar.getBoundingClientRect().height || 56;
    // Dock when the search field is about to disappear behind the sticky header,
    // not while it still overlaps the hero content.
    dockThreshold = Math.max(120, searchTop + searchHeight - headerHeight - 8);
  };
  const updateDockedSearch = () => {
    // Phones keep search in its original position below the header; only animate it subtly as it scrolls away.
    if (window.matchMedia('(max-width: 700px)').matches) {
      document.body.classList.remove('search-docked');
      const rect = searchBar.getBoundingClientRect();
      const headerBottom = siteHeader.getBoundingClientRect().bottom;
      const travel = Math.max(1, rect.height + 24);
      const progress = Math.min(1, Math.max(0, (headerBottom - rect.bottom) / travel));
      document.documentElement.style.setProperty('--campus-mobile-search-scroll', progress.toFixed(3));
      return;
    }
    document.documentElement.style.setProperty('--campus-mobile-search-scroll', '0');
    document.body.classList.toggle('search-docked', window.scrollY >= dockThreshold);
  };
  measureDockThreshold();
  window.addEventListener('scroll', updateDockedSearch, { passive: true });
  window.addEventListener('resize', () => { measureDockThreshold(); updateDockedSearch(); }, { passive: true });
  window.addEventListener('pageshow', () => { measureDockThreshold(); updateDockedSearch(); });
  updateDockedSearch();
})();

// Automatically extend the copyright range as the calendar year advances.
(function updateCampUsCopyright() {
  const notice = document.getElementById('copyrightNotice');
  if (!notice) return;
  const firstYear = 2026;
  const currentYear = new Date().getFullYear();
  const yearLabel = currentYear > firstYear ? `${firstYear}-${currentYear}` : `${firstYear}`;
  notice.textContent = `Copyright © ${yearLabel} CampUs Lost & Found. All rights Reserved.`;
})();



// Keep the actual back controls for both report types and Community chat consistent at every viewport size.
(function enforceUniversalBackArrow(){
 const apply=()=>document.querySelectorAll('#modal .universal-back-arrow, #communityChatOverlay .universal-back-arrow').forEach(button=>{
   button.textContent='‹';
   button.setAttribute('aria-label','Back to CampUs');
 });
 if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',apply,{once:true}); else apply();
 window.addEventListener('pageshow',apply);
})();


/* --------------------------------------------------------------------------
   CAMPUS SITE-WIDE BROADCAST ALERT BANNER
   -------------------------------------------------------------------------- */
let activeCampusAlert = null;
let dismissedCampusAlertId = null;

async function loadCampusActiveAnnouncement() {
  try {
    const res = await fetch('/api/announcements/active', { isBackground: true });
    if (!res.ok) return;
    const list = await res.json();
    const banner = $('campusAlertBanner');
    if (!banner) return;

    if (!Array.isArray(list) || !list.length) {
      banner.classList.add('hide');
      activeCampusAlert = null;
      return;
    }

    const alert = list[0];
    activeCampusAlert = alert;

    if (dismissedCampusAlertId && dismissedCampusAlertId === alert.id) {
      banner.classList.add('hide');
      return;
    }

    const sev = (alert.severity || 'INFO').toUpperCase();
    banner.className = `campus-alert-banner banner-${sev === 'EMERGENCY' ? 'emergency' : sev === 'WARNING' ? 'warning' : 'info'}`;

    const iconEl = $('alertBannerIcon');
    const titleEl = $('alertBannerTitle');
    const msgEl = $('alertBannerMessage');

    if (iconEl) iconEl.textContent = sev === 'EMERGENCY' ? '🚨' : sev === 'WARNING' ? '⚠️' : '📢';
    if (titleEl) titleEl.textContent = alert.title || 'Campus Alert';
    if (msgEl) msgEl.textContent = alert.message || '';

    banner.classList.remove('hide');
  } catch {}
}

function dismissCampusAlert() {
  const banner = $('campusAlertBanner');
  if (banner) banner.classList.add('hide');
  if (activeCampusAlert) {
    dismissedCampusAlertId = activeCampusAlert.id;
  }
}

/* --------------------------------------------------------------------------
   MASTER ADMIN CONTROL CENTER CONTROLLER
   -------------------------------------------------------------------------- */
let currentAdminTab = 'overview';
let cachedAdminOverview = null;
let cachedAdminUsers = [];
let cachedAdminReports = [];
let cachedAdminComments = [];
let cachedAdminChat = [];
let cachedAdminAnnouncements = [];
let cachedAdminLogs = [];

function openAdminDashboard(defaultTab = 'overview') {
  const modal = $('adminDashboardModal');
  if (!modal) return;

  const isPrivileged = currentUser && ['OWNER', 'ADMIN'].includes(currentUser.role);
  if (!isPrivileged) {
    promptAdminBootstrap();
    return;
  }

  pushCampusUiLayer('adminDashboardModal');
  modal.classList.remove('hide');
  document.body.classList.add('fullscreen-page-open');

  const roleBadge = $('adminRoleBadge');
  const unameEl = $('adminUsernameDisplay');
  if (roleBadge) {
    roleBadge.textContent = currentUser.role;
    roleBadge.className = `admin-role-tag ${currentUser.role.toLowerCase()}`;
  }
  if (unameEl) unameEl.textContent = '@' + currentUser.username;

  switchAdminTab(defaultTab);
}

function closeAdminDashboard(fromPopstate = false) {
  const modal = $('adminDashboardModal');
  if (!modal || modal.classList.contains('hide')) return;
  modal.classList.add('hide');
  if ((!$('activityCenterModal') || $('activityCenterModal').classList.contains('hide')) &&
      (!$('privacySettingsModal') || $('privacySettingsModal').classList.contains('hide')) &&
      (!$('termsModal') || $('termsModal').classList.contains('hide')) &&
      (!$('helpSupportModal') || $('helpSupportModal').classList.contains('hide')) &&
      (!$('aboutCampusModal') || $('aboutCampusModal').classList.contains('hide')) &&
      (!$('postDetailViewer') || $('postDetailViewer').classList.contains('hide'))) {
    document.body.classList.remove('fullscreen-page-open');
  }
  finishCampusUiLayer('adminDashboardModal', fromPopstate);
}

function refreshAdminData() {
  toast('Refreshing dashboard data… 🔄');
  switchAdminTab(currentAdminTab, true);
}

function switchAdminTab(tabName, forceRefresh = false) {
  currentAdminTab = tabName;
  document.querySelectorAll('.admin-tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.adminTab === tabName);
  });

  const container = $('adminTabContent');
  if (!container) return;
  container.innerHTML = '<div class="empty">Loading ' + esc(tabName) + ' data…</div>';

  if (tabName === 'overview') renderAdminOverview(forceRefresh);
  else if (tabName === 'users') renderAdminUsers(forceRefresh);
  else if (tabName === 'reports') renderAdminReports(forceRefresh);
  else if (tabName === 'comments') renderAdminComments(forceRefresh);
  else if (tabName === 'chat') renderAdminChat(forceRefresh);
  else if (tabName === 'broadcast') renderAdminBroadcast(forceRefresh);
  else if (tabName === 'settings') renderAdminSettings();
  else if (tabName === 'logs') renderAdminLogs(forceRefresh);
}

/* 1. OVERVIEW */
async function renderAdminOverview(force = false) {
  const container = $('adminTabContent');
  if (!container) return;

  try {
    const res = await fetch('/api/admin/overview');
    if (!res.ok) {
      if (res.status === 403 || res.status === 401) {
        container.innerHTML = '<div class="empty"><b>Access Denied</b><p>Admin or Owner privileges are required to view this panel.</p><button type="button" class="admin-btn-primary" onclick="promptAdminBootstrap()" style="margin-top:12px;">Activate Admin Key</button></div>';
        return;
      }
      throw Error('Could not load overview.');
    }
    const data = await res.json();
    cachedAdminOverview = data;

    // Update count badges in tab headers
    if ($('adminTabUsersCount')) $('adminTabUsersCount').textContent = data.totalUsers || 0;
    if ($('adminTabReportsCount')) $('adminTabReportsCount').textContent = data.totalReports || 0;
    if ($('adminTabCommentsCount')) $('adminTabCommentsCount').textContent = data.totalComments || 0;

    container.innerHTML = `
      <!-- KPI Overview Grid -->
      <div class="admin-kpi-grid">
        <div class="admin-kpi-card" onclick="switchAdminTab('users')">
          <div class="admin-kpi-header">
            <span class="admin-kpi-label">Total Users</span>
            <span class="admin-kpi-icon">👥</span>
          </div>
          <div class="admin-kpi-num">${data.totalUsers || 0}</div>
          <div class="admin-kpi-sub">${data.mutedUsers || 0} muted / restricted</div>
        </div>

        <div class="admin-kpi-card" onclick="switchAdminTab('reports')">
          <div class="admin-kpi-header">
            <span class="admin-kpi-label">Active Feed Posts</span>
            <span class="admin-kpi-icon">📋</span>
          </div>
          <div class="admin-kpi-num">${data.activeFeedReports || 0}</div>
          <div class="admin-kpi-sub">${data.totalReports || 0} total all-time reports</div>
        </div>

        <div class="admin-kpi-card">
          <div class="admin-kpi-header">
            <span class="admin-kpi-label">Lost Items</span>
            <span class="admin-kpi-icon">🔴</span>
          </div>
          <div class="admin-kpi-num">${data.lostReports || 0}</div>
          <div class="admin-kpi-sub">Reported lost by students</div>
        </div>

        <div class="admin-kpi-card">
          <div class="admin-kpi-header">
            <span class="admin-kpi-label">Found Items</span>
            <span class="admin-kpi-icon">🟢</span>
          </div>
          <div class="admin-kpi-num">${data.foundReports || 0}</div>
          <div class="admin-kpi-sub">Awaiting owner claim</div>
        </div>

        <div class="admin-kpi-card">
          <div class="admin-kpi-header">
            <span class="admin-kpi-label">Returned Items</span>
            <span class="admin-kpi-icon">✨</span>
          </div>
          <div class="admin-kpi-num">${data.returnedReports || 0}</div>
          <div class="admin-kpi-sub">Successfully resolved 🎉</div>
        </div>

        <div class="admin-kpi-card" onclick="switchAdminTab('comments')">
          <div class="admin-kpi-header">
            <span class="admin-kpi-label">Comments</span>
            <span class="admin-kpi-icon">💬</span>
          </div>
          <div class="admin-kpi-num">${data.totalComments || 0}</div>
          <div class="admin-kpi-sub">Post comments &amp; replies</div>
        </div>

        <div class="admin-kpi-card" onclick="switchAdminTab('chat')">
          <div class="admin-kpi-header">
            <span class="admin-kpi-label">Chat Messages</span>
            <span class="admin-kpi-icon">📱</span>
          </div>
          <div class="admin-kpi-num">${data.totalChatMessages || 0}</div>
          <div class="admin-kpi-sub">Community campus chat</div>
        </div>

        <div class="admin-kpi-card">
          <div class="admin-kpi-header">
            <span class="admin-kpi-label">In Trash / Deleted</span>
            <span class="admin-kpi-icon">🗑️</span>
          </div>
          <div class="admin-kpi-num">${data.deletedReports || 0}</div>
          <div class="admin-kpi-sub">Restorable for 30 days</div>
        </div>
      </div>

      <!-- Quick Action Controls -->
      <div class="admin-section-card">
        <div class="admin-section-header">
          <h3 class="admin-section-title">⚡ Quick Executive Controls</h3>
        </div>
        <div class="admin-actions-bar">
          <button type="button" class="admin-action-btn-lg primary" onclick="switchAdminTab('broadcast')">
            <span>📢</span>
            <span>Broadcast Campus Alert</span>
          </button>
          <button type="button" class="admin-action-btn-lg" onclick="switchAdminTab('users')">
            <span>👥</span>
            <span>Manage All Users</span>
          </button>
          <button type="button" class="admin-action-btn-lg" onclick="switchAdminTab('reports')">
            <span>📦</span>
            <span>Moderate Reports</span>
          </button>
          <button type="button" class="admin-action-btn-lg" onclick="adminPurgeTrash()">
            <span>🧹</span>
            <span>Empty Expired Trash</span>
          </button>
        </div>
      </div>

      <!-- Live Recent Audit Log -->
      <div class="admin-section-card">
        <div class="admin-section-header">
          <h3 class="admin-section-title">📜 Recent Administrative Operations</h3>
          <button type="button" class="admin-btn" onclick="switchAdminTab('logs')">View All Logs →</button>
        </div>
        ${Array.isArray(data.recentLogs) && data.recentLogs.length ? `
          <div class="admin-table-container">
            <table class="admin-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Admin</th>
                  <th>Action</th>
                  <th>Target</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                ${data.recentLogs.slice(0, 8).map(log => `
                  <tr>
                    <td><small>${formatDateNice(log.createdAt)}</small></td>
                    <td><b>@${esc(log.adminUsername)}</b></td>
                    <td><span class="role-badge member">${esc(log.action)}</span></td>
                    <td><small>${esc(log.targetType || '')} ${esc(log.targetId || '')}</small></td>
                    <td>${esc(log.details || '')}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        ` : '<div class="empty">No recent admin operations logged yet.</div>'}
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<div class="empty"><b>Error loading overview</b><p>${esc(err.message)}</p></div>`;
  }
}

/* 2. USERS CONTROL */
let userSearchTimeout = null;
async function renderAdminUsers(force = false) {
  const container = $('adminTabContent');
  if (!container) return;

  container.innerHTML = `
    <div class="admin-section-card">
      <div class="admin-section-header">
        <h3 class="admin-section-title">👥 User Accounts Management</h3>
        <span id="adminUsersCountText" class="admin-kpi-sub">Loading users…</span>
      </div>

      <!-- Search & Filters -->
      <div class="admin-filter-bar">
        <input type="search" id="adminUserSearchInput" class="admin-search-input" placeholder="Search by username, name, email, college..." oninput="handleAdminUserSearch()">
        <select id="adminUserRoleFilter" class="admin-select" onchange="fetchAdminUsersList()">
          <option value="ALL">All Roles</option>
          <option value="OWNER">Owner</option>
          <option value="ADMIN">Admin</option>
          <option value="LEADER">Leader</option>
          <option value="MODERATOR">Moderator</option>
          <option value="MEMBER">Member</option>
        </select>
        <select id="adminUserStatusFilter" class="admin-select" onchange="fetchAdminUsersList()">
          <option value="ALL">All Status</option>
          <option value="ACTIVE">Active Users</option>
          <option value="MUTED">Muted Users</option>
        </select>
      </div>

      <!-- Users Table/Grid Container -->
      <div id="adminUsersTableWrap">
        <div class="empty">Loading accounts…</div>
      </div>
    </div>
  `;

  await fetchAdminUsersList();
}

function handleAdminUserSearch() {
  clearTimeout(userSearchTimeout);
  userSearchTimeout = setTimeout(() => {
    fetchAdminUsersList();
  }, 250);
}

async function fetchAdminUsersList() {
  const wrap = $('adminUsersTableWrap');
  if (!wrap) return;

  const q = ($('adminUserSearchInput')?.value || '').trim();
  const role = $('adminUserRoleFilter')?.value || 'ALL';
  const status = $('adminUserStatusFilter')?.value || 'ALL';

  const params = new URLSearchParams();
  if (q) params.set('search', q);
  if (role && role !== 'ALL') params.set('role', role);
  if (status && status !== 'ALL') params.set('status', status);

  try {
    const res = await fetch(`/api/admin/users?${params.toString()}`);
    if (!res.ok) throw 0;
    const users = await res.json();
    cachedAdminUsers = users;

    const countText = $('adminUsersCountText');
    if (countText) countText.textContent = `${users.length} user${users.length === 1 ? '' : 's'} registered`;
    if ($('adminTabUsersCount')) $('adminTabUsersCount').textContent = users.length;

    if (!users.length) {
      wrap.innerHTML = '<div class="empty">No users matching search filters.</div>';
      return;
    }

    wrap.innerHTML = `
      <div class="admin-table-container">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Member</th>
              <th>College &amp; Course</th>
              <th>Contact</th>
              <th>Role</th>
              <th>Status</th>
              <th>Reports</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${users.map(u => {
              const roleClass = (u.role || 'member').toLowerCase();
              const isMuted = Boolean(u.communityMuted);
              return `
                <tr>
                  <td>
                    <div style="display:flex;align-items:center;gap:8px;">
                      <span class="chat-avatar avatar-sm avatar-char-${esc(u.username.charAt(0).toLowerCase())}" style="width:32px;height:32px;font-size:14px;flex-shrink:0;">
                        ${esc(u.username.charAt(0).toUpperCase())}
                      </span>
                      <div>
                        <b>${esc(u.displayName || u.username)}</b><br>
                        <small style="color:#64748B;">@${esc(u.username)}</small>
                      </div>
                    </div>
                  </td>
                  <td>
                    <b>${esc(u.college || 'CU')}</b><br>
                    <small style="color:#64748B;">${esc(u.course || 'Not specified')}</small>
                  </td>
                  <td>
                    <small>${esc(u.email || 'No email')}</small><br>
                    <small style="color:#64748B;">${esc(u.phone || 'No phone')}</small>
                  </td>
                  <td>
                    <span class="role-badge ${roleClass}">${esc(u.role || 'MEMBER')}</span>
                  </td>
                  <td>
                    <span class="status-indicator ${isMuted ? 'muted' : 'active'}">
                      ● ${isMuted ? 'Muted' : 'Active'}
                    </span>
                  </td>
                  <td>
                    <b>${u.reportsCount || 0}</b>
                  </td>
                  <td>
                    <div class="admin-btn-group">
                      <select class="admin-select" style="padding:4px 8px;font-size:11.5px;" onchange="adminUpdateUserRole(${u.id}, this.value)" title="Change Role">
                        <option value="" disabled selected>Role: ${esc(u.role)}</option>
                        <option value="MEMBER">Member</option>
                        <option value="MODERATOR">Moderator</option>
                        <option value="LEADER">Leader</option>
                        <option value="ADMIN">Admin</option>
                        ${currentUser?.role === 'OWNER' ? '<option value="OWNER">Owner</option>' : ''}
                      </select>
                      <button type="button" class="admin-btn ${isMuted ? 'admin-btn-success' : 'admin-btn-warning'}" onclick="adminToggleUserMute(${u.id}, ${!isMuted})" title="${isMuted ? 'Unmute from chat & comments' : 'Mute from chat & comments'}">
                        ${isMuted ? '🔊 Unmute' : '🔇 Mute'}
                      </button>
                      <button type="button" class="admin-btn" onclick="adminResetUserPassword(${u.id}, '${esc(u.username)}')" title="Reset Password">
                        🔑 Pass
                      </button>
                      ${u.role !== 'OWNER' ? `
                        <button type="button" class="admin-btn admin-btn-danger" onclick="adminDeleteUser(${u.id}, '${esc(u.username)}')" title="Delete Account">
                          🗑️
                        </button>
                      ` : ''}
                    </div>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  } catch {
    wrap.innerHTML = '<div class="empty">Could not load users list.</div>';
  }
}

async function adminUpdateUserRole(userId, newRole) {
  if (!newRole) return;
  if (!confirm(`Are you sure you want to change this member's role to ${newRole}?`)) {
    fetchAdminUsersList();
    return;
  }
  try {
    const res = await fetch(`/api/admin/users/${userId}/role`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: newRole })
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) throw Error(d.message || 'Could not update role.');
    toast(`User role changed to ${newRole} 👑`);
    fetchAdminUsersList();
  } catch (err) {
    toast(err.message || 'Error updating role.');
    fetchAdminUsersList();
  }
}

async function adminToggleUserMute(userId, muteState) {
  try {
    const res = await fetch(`/api/admin/users/${userId}/mute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ muted: muteState })
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) throw Error(d.message || 'Could not toggle mute.');
    toast(muteState ? 'User has been muted from chat & comments 🔇' : 'User unmuted successfully 🔊');
    fetchAdminUsersList();
  } catch (err) {
    toast(err.message || 'Error updating mute status.');
  }
}

async function adminResetUserPassword(userId, username) {
  const newPass = prompt(`Enter new password for @${username} (minimum 6 characters):`);
  if (!newPass) return;
  if (newPass.trim().length < 6) {
    toast('Password must be at least 6 characters.');
    return;
  }
  try {
    const res = await fetch(`/api/admin/users/${userId}/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newPassword: newPass.trim() })
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) throw Error(d.message || 'Could not reset password.');
    toast(`Password for @${username} reset successfully 🔑`);
  } catch (err) {
    toast(err.message || 'Error resetting password.');
  }
}

async function adminDeleteUser(userId, username) {
  if (!confirm(`WARNING: Are you sure you want to permanently delete account @${username}? This cannot be undone.`)) return;
  try {
    const res = await fetch(`/api/admin/users/${userId}`, { method: 'DELETE' });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) throw Error(d.message || 'Could not delete user.');
    toast(`Account @${username} deleted.`);
    fetchAdminUsersList();
  } catch (err) {
    toast(err.message || 'Error deleting user.');
  }
}

/* 3. REPORTS MODERATION */
let reportSearchTimeout = null;
async function renderAdminReports(force = false) {
  const container = $('adminTabContent');
  if (!container) return;

  container.innerHTML = `
    <div class="admin-section-card">
      <div class="admin-section-header">
        <h3 class="admin-section-title">📦 Reports &amp; Posts Moderation</h3>
        <div style="display:flex;gap:8px;">
          <button type="button" class="admin-btn admin-btn-danger" onclick="adminPurgeTrash()">🧹 Empty Trash</button>
        </div>
      </div>

      <!-- Search & Filters -->
      <div class="admin-filter-bar">
        <input type="search" id="adminReportSearchInput" class="admin-search-input" placeholder="Search title, category, location, reporter..." oninput="handleAdminReportSearch()">
        <select id="adminReportTypeFilter" class="admin-select" onchange="fetchAdminReportsList()">
          <option value="ALL">All Types (Lost &amp; Found)</option>
          <option value="LOST">🔴 Lost Only</option>
          <option value="FOUND">🟢 Found Only</option>
        </select>
        <select id="adminReportStatusFilter" class="admin-select" onchange="fetchAdminReportsList()">
          <option value="ALL">All Status</option>
          <option value="ACTIVE">Active Feed Only</option>
          <option value="OPEN">Open</option>
          <option value="MATCHED">Matched</option>
          <option value="RETURNED">✨ Returned</option>
          <option value="ARCHIVED">📁 Archived</option>
          <option value="DELETED">🗑️ Recently Deleted / Trash</option>
        </select>
      </div>

      <div id="adminReportsWrap">
        <div class="empty">Loading reports…</div>
      </div>
    </div>
  `;

  await fetchAdminReportsList();
}

function handleAdminReportSearch() {
  clearTimeout(reportSearchTimeout);
  reportSearchTimeout = setTimeout(() => {
    fetchAdminReportsList();
  }, 250);
}

async function fetchAdminReportsList() {
  const wrap = $('adminReportsWrap');
  if (!wrap) return;

  const q = ($('adminReportSearchInput')?.value || '').trim();
  const type = $('adminReportTypeFilter')?.value || 'ALL';
  const status = $('adminReportStatusFilter')?.value || 'ALL';

  const params = new URLSearchParams();
  if (q) params.set('search', q);
  if (type && type !== 'ALL') params.set('type', type);
  if (status && status !== 'ALL') params.set('status', status);

  try {
    const res = await fetch(`/api/admin/reports?${params.toString()}`);
    if (!res.ok) throw 0;
    const reportsList = await res.json();
    cachedAdminReports = reportsList;

    if ($('adminTabReportsCount')) $('adminTabReportsCount').textContent = reportsList.length;

    if (!reportsList.length) {
      wrap.innerHTML = '<div class="empty">No reports matching selected filters.</div>';
      return;
    }

    wrap.innerHTML = `
      <div class="admin-cards-grid">
        ${reportsList.map(r => {
          const isDeleted = Boolean(r.deleted);
          const isArchived = Boolean(r.archived && !r.deleted);
          const typeColor = r.type === 'FOUND' ? '#16A34A' : '#DC2626';
          const statusBadge = isDeleted
            ? '<span class="role-badge member" style="background:#FEE2E2;color:#DC2626;">🗑️ IN TRASH</span>'
            : (isArchived
                ? '<span class="role-badge member" style="background:#FEF3C7;color:#D97706;">📁 ARCHIVED</span>'
                : `<span class="role-badge ${r.status === 'RETURNED' ? 'moderator' : 'leader'}">${esc(r.status || 'OPEN')}</span>`);

          return `
            <div class="admin-item-card" style="${isDeleted ? 'opacity:0.85;border-color:#FECACA;' : ''}">
              <div class="admin-item-top">
                <div style="display:flex;gap:10px;align-items:center;">
                  ${r.imageData ? `
                    <img src="${esc(r.imageData)}" alt="" style="width:48px;height:48px;border-radius:10px;object-fit:cover;flex-shrink:0;">
                  ` : `
                    <div style="width:48px;height:48px;border-radius:10px;background:#F1F5F9;display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0;">
                      ${categoryEmoji(r.category)}
                    </div>
                  `}
                  <div>
                    <h4 class="admin-item-title">${esc(r.title || 'Untitled')}</h4>
                    <span style="font-size:11px;font-weight:800;color:${typeColor};">● ${esc(r.type)} ITEM</span>
                  </div>
                </div>
                ${statusBadge}
              </div>

              <div class="admin-item-meta">
                <span>📍 ${esc(r.location || 'Location not specified')} · 🏷️ ${esc(r.category || 'Other')}</span>
                <span>👤 By @${esc(r.accountUsername || 'unknown')} · 📅 ${esc(r.itemDate || '')}</span>
                <span>❤️ ${r.likeCount || 0} likes · 💬 ${r.commentCount || 0} comments</span>
              </div>

              <div class="admin-btn-group" style="margin-top:auto;padding-top:8px;border-top:1px solid #F1F5F9;">
                <select class="admin-select" style="padding:4px 8px;font-size:11.5px;" onchange="adminUpdateReportStatus(${r.id}, this.value)" title="Change Status">
                  <option value="" disabled selected>Status: ${esc(r.status)}</option>
                  <option value="OPEN">Open</option>
                  <option value="MATCHED">Matched</option>
                  <option value="RETURNED">✨ Returned</option>
                </select>

                ${isDeleted || isArchived ? `
                  <button type="button" class="admin-btn admin-btn-success" onclick="adminRestoreReport(${r.id})" title="Restore to feed">
                    ↺ Restore
                  </button>
                ` : `
                  <button type="button" class="admin-btn" onclick="adminArchiveReport(${r.id})" title="Archive post">
                    📁 Archive
                  </button>
                `}

                <button type="button" class="admin-btn admin-btn-danger" onclick="adminPermanentDeleteReport(${r.id})" title="Permanently delete from database">
                  🗑️ Purge
                </button>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  } catch {
    wrap.innerHTML = '<div class="empty">Could not load reports list.</div>';
  }
}

async function adminUpdateReportStatus(reportId, status) {
  if (!status) return;
  try {
    const res = await fetch(`/api/admin/reports/${reportId}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    if (!res.ok) throw 0;
    toast(`Report status set to ${status} ✨`);
    fetchAdminReportsList();
    load();
  } catch {
    toast('Could not update report status.');
  }
}

async function adminRestoreReport(reportId) {
  try {
    const res = await fetch(`/api/admin/reports/${reportId}/restore`, { method: 'POST' });
    if (!res.ok) throw 0;
    toast('Report restored to active feed! 🏠');
    fetchAdminReportsList();
    load();
  } catch {
    toast('Could not restore report.');
  }
}

async function adminArchiveReport(reportId) {
  try {
    const res = await fetch(`/api/admin/reports/${reportId}/archive`, { method: 'POST' });
    if (!res.ok) throw 0;
    toast('Report archived 📁');
    fetchAdminReportsList();
    load();
  } catch {
    toast('Could not archive report.');
  }
}

async function adminPermanentDeleteReport(reportId) {
  if (!confirm('Are you sure you want to permanently delete this report? Comments and likes will also be deleted. This CANNOT be undone.')) return;
  try {
    const res = await fetch(`/api/admin/reports/${reportId}/permanent`, { method: 'DELETE' });
    if (!res.ok) throw 0;
    toast('Report permanently purged.');
    fetchAdminReportsList();
    load();
  } catch {
    toast('Could not delete report.');
  }
}

async function adminPurgeTrash() {
  if (!confirm('Are you sure you want to permanently empty all trash reports? This action cannot be reversed.')) return;
  try {
    const res = await fetch('/api/admin/reports/purge-trash', { method: 'POST' });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) throw 0;
    toast(d.message || 'Trash emptied successfully! 🧹');
    if (currentAdminTab === 'reports') fetchAdminReportsList();
    else switchAdminTab(currentAdminTab);
    load();
  } catch {
    toast('Could not purge trash.');
  }
}

/* 4. COMMENTS MODERATION */
async function renderAdminComments(force = false) {
  const container = $('adminTabContent');
  if (!container) return;

  container.innerHTML = `
    <div class="admin-section-card">
      <div class="admin-section-header">
        <h3 class="admin-section-title">💬 Post Comments &amp; Replies Moderation</h3>
      </div>
      <div class="admin-filter-bar">
        <input type="search" id="adminCommentSearchInput" class="admin-search-input" placeholder="Search comments by keyword or username..." oninput="handleAdminCommentSearch()">
      </div>
      <div id="adminCommentsWrap">
        <div class="empty">Loading comments…</div>
      </div>
    </div>
  `;

  await fetchAdminCommentsList();
}

let commentSearchTimeout = null;
function handleAdminCommentSearch() {
  clearTimeout(commentSearchTimeout);
  commentSearchTimeout = setTimeout(() => {
    fetchAdminCommentsList();
  }, 250);
}

async function fetchAdminCommentsList() {
  const wrap = $('adminCommentsWrap');
  if (!wrap) return;

  const q = ($('adminCommentSearchInput')?.value || '').trim();
  const params = new URLSearchParams();
  if (q) params.set('search', q);

  try {
    const res = await fetch(`/api/admin/comments?${params.toString()}`);
    if (!res.ok) throw 0;
    const commentsList = await res.json();
    cachedAdminComments = commentsList;

    if ($('adminTabCommentsCount')) $('adminTabCommentsCount').textContent = commentsList.length;

    if (!commentsList.length) {
      wrap.innerHTML = '<div class="empty">No comments found.</div>';
      return;
    }

    wrap.innerHTML = `
      <div class="admin-table-container">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Author</th>
              <th>Comment Content</th>
              <th>Target Report</th>
              <th>Date</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            ${commentsList.map(c => `
              <tr>
                <td><b>@${esc(c.username)}</b></td>
                <td>
                  ${c.parentCommentId ? '<small class="role-badge member" style="margin-bottom:4px;">Reply</small><br>' : ''}
                  ${esc(c.content)}
                </td>
                <td><small>${esc(c.reportTitle || '#' + c.reportId)}</small></td>
                <td><small>${formatDateNice(c.createdAt)}</small></td>
                <td>
                  <button type="button" class="admin-btn admin-btn-danger" onclick="adminDeleteComment(${c.id})" title="Delete comment">
                    🗑️ Delete
                  </button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  } catch {
    wrap.innerHTML = '<div class="empty">Could not load comments list.</div>';
  }
}

async function adminDeleteComment(commentId) {
  if (!confirm('Delete this comment?')) return;
  try {
    const res = await fetch(`/api/admin/comments/${commentId}`, { method: 'DELETE' });
    if (!res.ok) throw 0;
    toast('Comment deleted.');
    fetchAdminCommentsList();
  } catch {
    toast('Could not delete comment.');
  }
}

/* 5. COMMUNITY CHAT CONTROL */
async function renderAdminChat(force = false) {
  const container = $('adminTabContent');
  if (!container) return;

  container.innerHTML = `
    <div class="admin-section-card">
      <div class="admin-section-header">
        <h3 class="admin-section-title">📱 Community Campus Chat Moderation</h3>
        <button type="button" class="admin-btn admin-btn-danger" onclick="adminClearChatChannel()">🧹 Clear Channel</button>
      </div>

      <div class="admin-filter-bar">
        <select id="adminChatCollegeFilter" class="admin-select" onchange="fetchAdminChatList()">
          <option value="ALL">All Colleges</option>
          <option value="CU">Chandigarh University (CU)</option>
          <option value="CGC_LANDRAN">CGC Landran</option>
          <option value="CGC_UNIV">CGC University</option>
          <option value="LPU">Lovely Professional University (LPU)</option>
        </select>
      </div>

      <div id="adminChatWrap">
        <div class="empty">Loading chat messages…</div>
      </div>
    </div>
  `;

  await fetchAdminChatList();
}

async function fetchAdminChatList() {
  const wrap = $('adminChatWrap');
  if (!wrap) return;

  const college = $('adminChatCollegeFilter')?.value || 'ALL';
  const params = new URLSearchParams();
  if (college && college !== 'ALL') params.set('college', college);

  try {
    const res = await fetch(`/api/admin/chat?${params.toString()}`);
    if (!res.ok) throw 0;
    const msgs = await res.json();
    cachedAdminChat = msgs;

    if (!msgs.length) {
      wrap.innerHTML = '<div class="empty">No chat messages found in this channel.</div>';
      return;
    }

    wrap.innerHTML = `
      <div class="admin-table-container">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Author</th>
              <th>College</th>
              <th>Message</th>
              <th>Time</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${msgs.map(m => `
              <tr>
                <td>
                  <b>${esc(m.displayName || m.username)}</b><br>
                  <small style="color:#64748B;">@${esc(m.username)}</small>
                </td>
                <td><span class="role-badge member">${esc(m.college || 'CU')}</span></td>
                <td>
                  ${m.replyText ? `<small style="color:#64748B;display:block;margin-bottom:2px;">↳ Replying to: ${esc(m.replyText.slice(0, 40))}…</small>` : ''}
                  ${esc(m.message)}
                </td>
                <td><small>${formatDateNice(m.createdAt)}</small></td>
                <td>
                  <div class="admin-btn-group">
                    <button type="button" class="admin-btn admin-btn-danger" onclick="adminDeleteChatMessage(${m.id})" title="Delete message">
                      🗑️
                    </button>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  } catch {
    wrap.innerHTML = '<div class="empty">Could not load chat messages.</div>';
  }
}

async function adminDeleteChatMessage(messageId) {
  if (!confirm('Delete this chat message?')) return;
  try {
    const res = await fetch(`/api/admin/chat/${messageId}`, { method: 'DELETE' });
    if (!res.ok) throw 0;
    toast('Chat message deleted.');
    fetchAdminChatList();
  } catch {
    toast('Could not delete chat message.');
  }
}

async function adminClearChatChannel() {
  const college = $('adminChatCollegeFilter')?.value || 'ALL';
  const label = college === 'ALL' ? 'ALL colleges' : college;
  if (!confirm(`Are you sure you want to delete ALL messages in the chat for ${label}?`)) return;
  try {
    const res = await fetch('/api/admin/chat/clear', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ college })
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) throw 0;
    toast(d.message || 'Chat channel cleared.');
    fetchAdminChatList();
  } catch {
    toast('Could not clear chat.');
  }
}

/* 6. BROADCAST ALERTS */
async function renderAdminBroadcast(force = false) {
  const container = $('adminTabContent');
  if (!container) return;

  container.innerHTML = `
    <div class="admin-section-card">
      <div class="admin-section-header">
        <h3 class="admin-section-title">📢 Broadcast Campus Alert Banner</h3>
      </div>
      <p style="font-size:13px;color:#64748B;margin:0 0 16px;">
        Publish real-time announcements or emergency alerts that display immediately at the very top of the feed for all students.
      </p>

      <form class="admin-broadcast-form" onsubmit="adminCreateAnnouncement(event)">
        <div class="admin-form-row">
          <label for="adminAnnounceTitle">Alert Headline / Title *</label>
          <input id="adminAnnounceTitle" type="text" placeholder="e.g. 🚨 High Alert: Lost Gold Chain in Library Block 3" maxlength="150" required>
        </div>

        <div class="admin-form-row">
          <label for="adminAnnounceMsg">Alert Details / Instructions *</label>
          <textarea id="adminAnnounceMsg" rows="3" placeholder="Explain the lost item details, reward amount, or campus instructions for students..." maxlength="1500" required></textarea>
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(180px, 1fr));gap:12px;">
          <div class="admin-form-row">
            <label for="adminAnnounceSeverity">Alert Severity Level</label>
            <select id="adminAnnounceSeverity" class="admin-select">
              <option value="INFO">🟢 Info / Notice (Blue)</option>
              <option value="WARNING">🟡 High Attention (Amber)</option>
              <option value="EMERGENCY">🔴 Urgent Campus Alert (Red)</option>
            </select>
          </div>

          <div class="admin-form-row">
            <label for="adminAnnounceCollege">Target Campus</label>
            <select id="adminAnnounceCollege" class="admin-select">
              <option value="ALL">All Campuses</option>
              <option value="CU">Chandigarh University (CU)</option>
              <option value="CGC_LANDRAN">CGC Landran</option>
              <option value="CGC_UNIV">CGC University</option>
              <option value="LPU">Lovely Professional University (LPU)</option>
            </select>
          </div>
        </div>

        <button type="submit" id="adminAnnounceSubmitBtn" class="admin-action-btn-lg primary" style="align-self:flex-start;margin-top:6px;">
          <span>📢 Publish Alert Banner</span>
        </button>
      </form>
    </div>

    <!-- Live Announcements List -->
    <div class="admin-section-card">
      <div class="admin-section-header">
        <h3 class="admin-section-title">Active &amp; Past Broadcasts</h3>
      </div>
      <div id="adminAnnounceListWrap">
        <div class="empty">Loading announcements…</div>
      </div>
    </div>
  `;

  await fetchAdminAnnouncementsList();
}

async function fetchAdminAnnouncementsList() {
  const wrap = $('adminAnnounceListWrap');
  if (!wrap) return;

  try {
    const res = await fetch('/api/admin/announcements');
    if (!res.ok) throw 0;
    const list = await res.json();
    cachedAdminAnnouncements = list;

    if (!list.length) {
      wrap.innerHTML = '<div class="empty">No broadcasts published yet. Use the form above to send an announcement.</div>';
      return;
    }

    wrap.innerHTML = `
      <div class="admin-cards-grid">
        ${list.map(a => {
          const isActive = Boolean(a.active);
          const sev = (a.severity || 'INFO').toUpperCase();
          const sevClass = sev === 'EMERGENCY' ? 'banner-emergency' : sev === 'WARNING' ? 'banner-warning' : 'banner-info';
          return `
            <div class="admin-item-card campus-alert-banner ${sevClass}" style="margin:0;">
              <div class="admin-item-top">
                <div style="display:flex;align-items:center;gap:8px;">
                  <span style="font-size:20px;">${sev === 'EMERGENCY' ? '🚨' : sev === 'WARNING' ? '⚠️' : '📢'}</span>
                  <b style="font-size:14px;">${esc(a.title)}</b>
                </div>
                <span class="role-badge ${isActive ? 'moderator' : 'member'}">${isActive ? 'ACTIVE' : 'INACTIVE'}</span>
              </div>
              <p style="font-size:12.5px;margin:4px 0 8px;line-height:1.45;">${esc(a.message)}</p>
              <div class="admin-item-meta">
                <span>🏛️ Target: ${esc(a.college || 'ALL')} · 👤 By: @${esc(a.createdBy || 'admin')}</span>
                <span>📅 Published: ${formatDateNice(a.createdAt)}</span>
              </div>
              <div class="admin-btn-group" style="margin-top:8px;">
                <button type="button" class="admin-btn ${isActive ? 'admin-btn-warning' : 'admin-btn-success'}" onclick="adminToggleAnnouncement(${a.id})">
                  ${isActive ? 'Deactivate' : 'Activate'}
                </button>
                <button type="button" class="admin-btn admin-btn-danger" onclick="adminDeleteAnnouncement(${a.id})">
                  🗑️ Delete
                </button>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  } catch {
    wrap.innerHTML = '<div class="empty">Could not load announcements.</div>';
  }
}

async function adminCreateAnnouncement(event) {
  event.preventDefault();
  const title = $('adminAnnounceTitle')?.value.trim();
  const message = $('adminAnnounceMsg')?.value.trim();
  const severity = $('adminAnnounceSeverity')?.value || 'INFO';
  const college = $('adminAnnounceCollege')?.value || 'ALL';
  const btn = $('adminAnnounceSubmitBtn');

  if (!title || !message) return;
  if (btn) btn.disabled = true;

  try {
    const res = await fetch('/api/admin/announcements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, message, severity, college, active: true })
    });
    if (!res.ok) throw 0;
    toast('Broadcast alert published successfully! 📢');
    $('adminAnnounceTitle').value = '';
    $('adminAnnounceMsg').value = '';
    fetchAdminAnnouncementsList();
    loadCampusActiveAnnouncement();
  } catch {
    toast('Could not publish alert.');
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function adminToggleAnnouncement(id) {
  try {
    const res = await fetch(`/api/admin/announcements/${id}/toggle`, { method: 'PUT' });
    if (!res.ok) throw 0;
    toast('Announcement status updated.');
    fetchAdminAnnouncementsList();
    loadCampusActiveAnnouncement();
  } catch {
    toast('Could not toggle announcement.');
  }
}

async function adminDeleteAnnouncement(id) {
  if (!confirm('Delete this announcement?')) return;
  try {
    const res = await fetch(`/api/admin/announcements/${id}`, { method: 'DELETE' });
    if (!res.ok) throw 0;
    toast('Announcement deleted.');
    fetchAdminAnnouncementsList();
    loadCampusActiveAnnouncement();
  } catch {
    toast('Could not delete announcement.');
  }
}

/* 7. SYSTEM & SECURITY */
function renderAdminSettings() {
  const container = $('adminTabContent');
  if (!container) return;

  container.innerHTML = `
    <div class="admin-section-card">
      <div class="admin-section-header">
        <h3 class="admin-section-title">⚙️ Platform &amp; System Configuration</h3>
      </div>
      <div class="admin-kpi-grid">
        <div class="admin-kpi-card">
          <div class="admin-kpi-label">Platform Version</div>
          <div class="admin-kpi-num" style="font-size:22px;">v2.6 Enterprise</div>
          <div class="admin-kpi-sub">Spring Boot 3.4.3 &amp; Web Engine</div>
        </div>
        <div class="admin-kpi-card">
          <div class="admin-kpi-label">Retention Guarantee</div>
          <div class="admin-kpi-num" style="font-size:22px;">30 Days</div>
          <div class="admin-kpi-sub">Soft-deleted items recovery window</div>
        </div>
        <div class="admin-kpi-card">
          <div class="admin-kpi-label">Server State</div>
          <div class="admin-kpi-num" style="font-size:22px;color:#16A34A;">● ACTIVE</div>
          <div class="admin-kpi-sub">Connected to Database</div>
        </div>
      </div>
    </div>

    <!-- Admin Master Key Self-Elevation Tool -->
    <div class="admin-section-card">
      <div class="admin-section-header">
        <h3 class="admin-section-title">🔑 Master Admin Elevation &amp; Access</h3>
      </div>
      <p style="font-size:13px;color:#64748B;margin:0 0 14px;">
        Use this tool to activate Owner or Admin permissions for your account using the master security key.
      </p>
      <form onsubmit="adminBootstrapElevation(event)" style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;">
        <input type="password" id="adminSecretKeyInput" class="admin-search-input" placeholder="Enter master admin key (default: campusadmin2026)" style="max-width:320px;" required>
        <button type="submit" class="admin-action-btn-lg primary">⚡ Activate Admin Access</button>
      </form>
    </div>
  `;
}

async function adminBootstrapElevation(event) {
  if (event) event.preventDefault();
  const keyInput = $('adminSecretKeyInput');
  const key = keyInput ? keyInput.value.trim() : 'campusadmin2026';

  try {
    const res = await fetch('/api/admin/bootstrap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminKey: key })
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) throw Error(d.message || 'Key incorrect or elevation denied.');
    if (currentUser) {
      currentUser.role = d.role || 'ADMIN';
    }
    toast(`Access granted: You are now ${d.role || 'ADMIN'}! ⚡`);
    openAdminDashboard('overview');
  } catch (err) {
    toast(err.message || 'Elevation failed.');
  }
}

function promptAdminBootstrap() {
  const key = prompt('Admin Access Required:\nEnter master activation key to open the Control Center (default: campusadmin2026):', 'campusadmin2026');
  if (!key) return;
  fetch('/api/admin/bootstrap', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ adminKey: key.trim() })
  })
  .then(r => r.json().then(d => ({ ok: r.ok, d })))
  .then(({ ok, d }) => {
    if (!ok) throw Error(d.message || 'Incorrect key.');
    if (currentUser) currentUser.role = d.role || 'ADMIN';
    toast(`Welcome to Control Center! Activated role: ${d.role || 'ADMIN'} ⚡`);
    const btn = $('drawerAdminBtn');
    if (btn) btn.classList.remove('hide');
    openAdminDashboard('overview');
  })
  .catch(err => toast(err.message || 'Elevation failed.'));
}

/* 8. AUDIT LOGS */
async function renderAdminLogs(force = false) {
  const container = $('adminTabContent');
  if (!container) return;

  container.innerHTML = `
    <div class="admin-section-card">
      <div class="admin-section-header">
        <h3 class="admin-section-title">📜 System Audit &amp; Activity Logs</h3>
        <button type="button" class="admin-btn" onclick="renderAdminLogs(true)">🔄 Refresh</button>
      </div>
      <div id="adminLogsWrap">
        <div class="empty">Loading audit logs…</div>
      </div>
    </div>
  `;

  try {
    const res = await fetch('/api/admin/logs');
    if (!res.ok) throw 0;
    const logs = await res.json();
    cachedAdminLogs = logs;
    const wrap = $('adminLogsWrap');
    if (!wrap) return;

    if (!logs.length) {
      wrap.innerHTML = '<div class="empty">No audit logs recorded yet.</div>';
      return;
    }

    wrap.innerHTML = `
      <div class="admin-table-container">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Admin User</th>
              <th>Operation</th>
              <th>Target</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            ${logs.map(l => `
              <tr>
                <td><small>${formatDateNice(l.createdAt)}</small></td>
                <td><b>@${esc(l.adminUsername)}</b></td>
                <td><span class="role-badge leader">${esc(l.action)}</span></td>
                <td><small>${esc(l.targetType || '')} ${esc(l.targetId || '')}</small></td>
                <td>${esc(l.details || '')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  } catch {
    const wrap = $('adminLogsWrap');
    if (wrap) wrap.innerHTML = '<div class="empty">Could not load audit logs.</div>';
  }
}


/* --------------------------------------------------------------------------
   TRACKPAD & TOUCH GESTURE: SWIPE LEFT-TO-RIGHT TO GO BACK
   Supports two-finger trackpad horizontal swipe on macOS / Windows laptops
   as well as touchscreen swipe gestures across the whole website.
   -------------------------------------------------------------------------- */
(function setupTrackpadSwipeBack() {
  let trackpadAccumX = 0;
  let trackpadAccumY = 0;
  let trackpadResetTimer = null;
  let isSwipeCooldown = false;

  // Check if target is inside an element that can still scroll left horizontally
  function canContainerScrollLeft(target) {
    let el = target;
    while (el && el !== document.body && el !== document.documentElement) {
      if (el.scrollWidth > el.clientWidth + 8) {
        const style = window.getComputedStyle(el);
        const ox = style.overflowX;
        if (ox === 'auto' || ox === 'scroll') {
          // If the element has scrolled rightward, user is scrolling its contents
          if (el.scrollLeft > 12) {
            return true;
          }
        }
      }
      el = el.parentElement;
    }
    return false;
  }

  function handleSwipeBackAction() {
    if (isSwipeCooldown) return;
    isSwipeCooldown = true;
    setTimeout(() => { isSwipeCooldown = false; }, 600);

    // 1. Try closing any open overlay, modal or page first
    const closed = closeTopUntrackedUiLayer();
    if (closed) {
      return;
    }

    // 2. If no modal is open, use browser history back
    if (window.history.length > 1) {
      window.history.back();
    }
  }

  // Two-finger trackpad wheel listener for laptops
  window.addEventListener('wheel', (e) => {
    if (isSwipeCooldown) return;

    // Trackpad horizontal displacement
    const dx = e.deltaX;
    const dy = e.deltaY;

    // If target is inside a horizontally scrollable element that hasn't reached its start, ignore
    if (canContainerScrollLeft(e.target)) {
      trackpadAccumX = 0;
      trackpadAccumY = 0;
      return;
    }

    // Accumulate horizontal and vertical motion
    trackpadAccumX += dx;
    trackpadAccumY += Math.abs(dy);

    clearTimeout(trackpadResetTimer);
    trackpadResetTimer = setTimeout(() => {
      trackpadAccumX = 0;
      trackpadAccumY = 0;
    }, 180);

    // Swiping left-to-right (fingers sliding towards right):
    // In natural scrolling on macOS/Windows, deltaX is negative (deltaX <= -55)
    // Must be predominantly horizontal (|accumX| > accumY * 1.3)
    if (trackpadAccumX <= -55 && Math.abs(trackpadAccumX) > trackpadAccumY * 1.3) {
      trackpadAccumX = 0;
      trackpadAccumY = 0;
      handleSwipeBackAction();
    }
  }, { passive: true });

  // Touchscreen / Touchpad touch event listeners
  let touchStartX = 0;
  let touchStartY = 0;
  let touchStartTime = 0;

  window.addEventListener('touchstart', (e) => {
    if (!e.touches || e.touches.length !== 1) return;
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    touchStartTime = Date.now();
  }, { passive: true });

  window.addEventListener('touchend', (e) => {
    if (!e.changedTouches || e.changedTouches.length !== 1 || isSwipeCooldown) return;
    const endX = e.changedTouches[0].clientX;
    const endY = e.changedTouches[0].clientY;
    const dx = endX - touchStartX;
    const dy = endY - touchStartY;
    const dt = Date.now() - touchStartTime;

    // Left-to-right swipe: endX > startX + 60, under 500ms, mostly horizontal
    if (dx > 60 && Math.abs(dx) > Math.abs(dy) * 1.4 && dt < 500) {
      if (!canContainerScrollLeft(e.target)) {
        handleSwipeBackAction();
      }
    }
  }, { passive: true });
})();


/* ==========================================================================
   FEATURE 7: AMOLED BLACK DARK THEME SYSTEM
   ========================================================================== */
function initTheme() {
  const saved = localStorage.getItem('campus_theme');
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const theme = saved ? saved : (prefersDark ? 'dark' : 'light');
  applyTheme(theme);
}

function applyTheme(theme) {
  if (theme === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
    document.body.setAttribute('data-theme', 'dark');
    const hIcon = $('headerThemeIcon');
    if (hIcon) hIcon.textContent = '☀️';
    const dIcon = $('drawerThemeIcon');
    if (dIcon) dIcon.textContent = '☀️';
    const dText = $('drawerThemeText');
    if (dText) dText.textContent = 'Switch to Light theme';
    const dPill = $('drawerThemePill');
    if (dPill) dPill.textContent = 'LIGHT';
  } else {
    document.documentElement.removeAttribute('data-theme');
    document.body.removeAttribute('data-theme');
    const hIcon = $('headerThemeIcon');
    if (hIcon) hIcon.textContent = '🌙';
    const dIcon = $('drawerThemeIcon');
    if (dIcon) dIcon.textContent = '🌙';
    const dText = $('drawerThemeText');
    if (dText) dText.textContent = 'Switch to Amoled Black';
    const dPill = $('drawerThemePill');
    if (dPill) dPill.textContent = 'DARK';
  }
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  const next = current === 'dark' ? 'light' : 'dark';
  localStorage.setItem('campus_theme', next);
  applyTheme(next);
  toast(next === 'dark' ? 'Amoled Dark Mode enabled 🌙' : 'Light Mode enabled ☀️');
}

// Auto init theme on script load
try { initTheme(); } catch (e) {}

/* ==========================================================================
   CAMPUS FEED & STUDENT MARKETPLACE SWITCHER
   ========================================================================== */
let activeCampusFeedView = 'lostfound'; // 'lostfound' | 'market'
let activeMarketCategory = '';
let cachedMarketListings = [];

function switchFeedView(mode) {
  activeCampusFeedView = mode;
  const lostTab = $('secSwitchLostFound');
  const marketTab = $('secSwitchMarket');
  const statusTabs = document.querySelector('.insta-status-tabs');
  const storiesWrap = document.querySelector('.insta-stories-container');
  const boardSec = $('board');
  const marketSec = $('marketSection');
  const deskNavBtns = document.querySelectorAll('.desk-nav-btn');

  if (mode === 'market') {
    if (lostTab) lostTab.classList.remove('active');
    if (marketTab) marketTab.classList.add('active');
    if (statusTabs) statusTabs.classList.add('hide');
    if (storiesWrap) storiesWrap.classList.add('hide');
    if (boardSec) boardSec.classList.add('hide');
    if (marketSec) marketSec.classList.remove('hide');

    deskNavBtns.forEach(b => {
      b.classList.toggle('active', b.dataset.deskNav === 'market');
    });

    fetchMarketListings();
  } else {
    if (lostTab) lostTab.classList.add('active');
    if (marketTab) marketTab.classList.remove('active');
    if (statusTabs) statusTabs.classList.remove('hide');
    if (storiesWrap) storiesWrap.classList.remove('hide');
    if (boardSec) boardSec.classList.remove('hide');
    if (marketSec) marketSec.classList.add('hide');

    deskNavBtns.forEach(b => {
      b.classList.toggle('active', b.dataset.deskNav === 'feed');
    });
  }
}

/* ==========================================================================
   FEATURE 6: CAMPUS STUDENT MARKETPLACE (BUY & SELL)
   ========================================================================== */
async function fetchMarketListings(category) {
  if (category !== undefined) activeMarketCategory = category;
  const grid = $('marketGrid');
  const countEl = $('marketResultCount');
  if (!grid) return;

  grid.innerHTML = '<div class="empty">Loading marketplace listings…</div>';

  try {
    const url = activeMarketCategory
      ? `/api/market?category=${encodeURIComponent(activeMarketCategory)}`
      : '/api/market';
    const res = await fetch(url);
    if (!res.ok) throw 0;
    const items = await res.json();
    cachedMarketListings = items;

    if (countEl) {
      countEl.textContent = `${items.length} ${items.length === 1 ? 'item' : 'items'} available in campus market`;
    }

    if (!items || items.length === 0) {
      grid.innerHTML = `
        <div class="empty" style="grid-column: 1/-1; padding: 40px 20px;">
          <div style="font-size: 38px; margin-bottom: 8px;">🛍️</div>
          <b>No items listed in this category yet</b>
          <p style="font-size: 13px; color: var(--insta-text-muted); margin-top: 4px;">Be the first campus student to sell books, drafters, or essentials!</p>
          <button type="button" class="market-sell-cta-btn" onclick="openMarketModal()" style="margin: 12px auto 0;">＋ List an Item</button>
        </div>`;
      return;
    }

    grid.innerHTML = items.map(m => renderMarketCard(m)).join('');
  } catch (err) {
    grid.innerHTML = '<div class="empty">Could not load marketplace listings. Connect backend and retry.</div>';
  }
}

function filterMarketCategory(cat) {
  document.querySelectorAll('.market-cat-chip').forEach(btn => {
    btn.classList.toggle('active', (btn.dataset.mcat || '') === cat);
  });
  fetchMarketListings(cat);
}

function renderMarketCard(m) {
  const isFree = m.price <= 0;
  const priceDisplay = isFree ? 'FREE 🎁' : `₹${Math.round(m.price)}`;
  const canManage = currentUser && (
    (m.accountUsername && m.accountUsername.toLowerCase() === currentUser.username.toLowerCase()) ||
    currentUser.role === 'OWNER' || currentUser.role === 'ADMIN'
  );

  const cleanPhone = String(m.phone || '').replace(/[^0-9]/g, '');
  const waPhone = cleanPhone.length === 10 ? '91' + cleanPhone : cleanPhone;
  const waText = encodeURIComponent(`Hi! I'm interested in buying your "${m.title}" listed for ${priceDisplay} on CampUs Market.`);
  const waUrl = cleanPhone ? `https://wa.me/${waPhone}?text=${waText}` : '';

  const photoHtml = m.photoDataUrl
    ? `<img src="${esc(m.photoDataUrl)}" alt="${esc(m.title)}" class="market-card-img" loading="lazy" onclick="viewFullImage('${esc(m.photoDataUrl)}')">`
    : `<div class="market-card-placeholder">${marketCategoryEmoji(m.category)}</div>`;

  return `
    <article class="market-card" id="market-card-${m.id}">
      ${m.sold ? `<div class="market-sold-overlay"><span>✓ SOLD OUT</span></div>` : ''}
      <div class="market-card-img-wrap">
        ${photoHtml}
        <span class="market-price-badge ${isFree ? 'free' : ''}">${priceDisplay}</span>
        <span class="market-condition-pill">${esc(m.condition || 'Used')}</span>
      </div>
      <div class="market-card-body">
        <span class="market-card-cat">${marketCategoryEmoji(m.category)} ${esc(m.category)}</span>
        <h3 class="market-card-title">${esc(m.title)}</h3>
        ${m.description ? `<p class="market-card-desc">${esc(m.description)}</p>` : ''}
        <div class="market-card-loc">📍 ${esc(m.location || 'Campus')}</div>
        
        <div class="market-card-footer">
          <div class="market-seller-info">
            <div class="market-seller-avatar">${firstInitial(m.sellerName || 'S')}</div>
            <span class="market-seller-name">${esc(m.sellerName || 'Student')}</span>
          </div>

          ${canManage ? `
            <div style="display:flex; gap:6px;">
              ${!m.sold ? `<button type="button" class="auth-primary" style="padding:6px 10px; font-size:11px; border-radius:8px;" onclick="markMarketSold(${m.id})">Mark Sold</button>` : ''}
              <button type="button" class="action-btn-del" style="padding:6px 10px; font-size:11px;" onclick="deleteMarketListing(${m.id})">🗑</button>
            </div>
          ` : `
            ${!m.sold && waUrl ? `
              <a href="${waUrl}" target="_blank" rel="noopener noreferrer" class="market-buy-btn">
                <span>💬 Buy / Chat</span>
              </a>
            ` : ''}
          `}
        </div>
      </div>
    </article>`;
}

function marketCategoryEmoji(cat) {
  if (!cat) return '🛍️';
  if (cat.includes('Book') || cat.includes('Note')) return '📚';
  if (cat.includes('Draft') || cat.includes('Lab')) return '📐';
  if (cat.includes('Cycle') || cat.includes('Mobility')) return '🚲';
  if (cat.includes('Hostel')) return '🛏️';
  if (cat.includes('Elect')) return '🎧';
  if (cat.includes('Fash') || cat.includes('Cloth')) return '👕';
  if (cat.includes('Free')) return '🎁';
  return '📦';
}

function openMarketModal() {
  if (!currentUser) {
    toast('Please log in to list an item in the Campus Market.');
    openAuthChoices();
    return;
  }
  const modal = $('marketModal');
  if (!modal) return;
  pushCampusUiLayer('marketModal');
  modal.classList.remove('hide');
  if ($('marketPhone') && currentUser.phone) {
    $('marketPhone').value = currentUser.phone;
  }
}

function closeMarketModal(fromPopstate = false) {
  const modal = $('marketModal');
  if (!modal || modal.classList.contains('hide')) return;
  modal.classList.add('hide');
  finishCampusUiLayer('marketModal', fromPopstate);
}

function toggleMarketFree(checkbox) {
  const priceInput = $('marketPrice');
  if (priceInput) {
    if (checkbox.checked) {
      priceInput.value = '0';
      priceInput.disabled = true;
    } else {
      priceInput.disabled = false;
      priceInput.value = '';
    }
  }
}

let marketPhotoBase64 = null;
async function previewMarketPhoto(input) {
  const file = input.files[0];
  const preview = $('marketPhotoPreview');
  if (!file) {
    marketPhotoBase64 = null;
    if (preview) { preview.src = ''; preview.classList.add('hide'); }
    return;
  }
  try {
    marketPhotoBase64 = await compressProfileImage(file, 1200, 1200, 0.8);
    if (preview) {
      preview.src = marketPhotoBase64;
      preview.classList.remove('hide');
    }
  } catch (e) {
    toast('Could not process photo. Please choose another.');
  }
}

async function handleMarketSubmit(e) {
  e.preventDefault();
  const errorEl = $('marketError');
  if (errorEl) errorEl.textContent = '';

  const title = $('marketTitle').value.trim();
  const category = $('marketCategory').value;
  const condition = $('marketCondition').value;
  const isFree = $('marketIsFree').checked;
  const price = isFree ? 0 : parseFloat($('marketPrice').value || 0);
  const location = $('marketLocation').value.trim();
  const phone = $('marketPhone').value.trim();
  const description = $('marketDescription').value.trim();

  if (!title || !category || !condition || !location || !phone) {
    if (errorEl) errorEl.textContent = 'Please fill out all required fields.';
    return;
  }

  const payload = {
    title,
    category,
    condition,
    isFree,
    price,
    location,
    phone,
    description,
    photoDataUrl: marketPhotoBase64
  };

  try {
    const res = await fetch('/api/market', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      throw Error(d.message || 'Failed to list item in market.');
    }
    toast('Item listed in Campus Market! 🛍️');
    $('marketForm').reset();
    marketPhotoBase64 = null;
    if ($('marketPhotoPreview')) $('marketPhotoPreview').classList.add('hide');
    closeMarketModal();
    fetchMarketListings();
  } catch (err) {
    if (errorEl) errorEl.textContent = err.message || 'Could not post to market.';
  }
}

async function markMarketSold(id) {
  if (!confirm('Mark this item as Sold?')) return;
  try {
    const res = await fetch(`/api/market/${id}/sold`, { method: 'POST' });
    if (!res.ok) throw 0;
    toast('Item marked as Sold! 🎉');
    fetchMarketListings();
  } catch {
    toast('Could not update market status.');
  }
}

async function deleteMarketListing(id) {
  if (!confirm('Delete this market listing?')) return;
  try {
    const res = await fetch(`/api/market/${id}`, { method: 'DELETE' });
    if (!res.ok) throw 0;
    toast('Market listing removed.');
    fetchMarketListings();
  } catch {
    toast('Could not delete market listing.');
  }
}

/* ==========================================================================
   FEATURE 3: SECRET PROOF OF OWNERSHIP & ITEM CLAIM VERIFICATION
   ========================================================================== */
function openClaimModal(reportId, title, secretQuestion) {
  if (!currentUser) {
    toast('Please log in to submit an ownership claim.');
    openAuthChoices();
    return;
  }

  const modal = $('claimItemModal');
  if (!modal) return;

  $('claimReportId').value = reportId;
  const targetTitleEl = $('claimItemTargetTitle');
  if (targetTitleEl) targetTitleEl.textContent = `Submitting proof for: "${title}"`;

  const questionBox = $('claimSecretQuestionBox');
  const questionText = $('claimSecretQuestionText');
  if (secretQuestion && secretQuestion.trim()) {
    if (questionText) questionText.textContent = secretQuestion.trim();
    if (questionBox) questionBox.classList.remove('hide');
  } else {
    if (questionBox) questionBox.classList.add('hide');
  }

  if ($('claimPhone') && currentUser.phone) {
    $('claimPhone').value = currentUser.phone;
  }

  pushCampusUiLayer('claimItemModal');
  modal.classList.remove('hide');
}

function closeClaimModal(fromPopstate = false) {
  const modal = $('claimItemModal');
  if (!modal || modal.classList.contains('hide')) return;
  modal.classList.add('hide');
  finishCampusUiLayer('claimItemModal', fromPopstate);
}

let claimProofBase64 = null;
async function previewClaimProof(input) {
  const file = input.files[0];
  const preview = $('claimPhotoPreview');
  if (!file) {
    claimProofBase64 = null;
    if (preview) { preview.src = ''; preview.classList.add('hide'); }
    return;
  }
  try {
    claimProofBase64 = await compressProfileImage(file, 1200, 1200, 0.8);
    if (preview) {
      preview.src = claimProofBase64;
      preview.classList.remove('hide');
    }
  } catch (e) {
    toast('Could not read image. Please select another.');
  }
}

async function handleClaimSubmit(e) {
  e.preventDefault();
  const errorEl = $('claimError');
  if (errorEl) errorEl.textContent = '';

  const reportId = $('claimReportId').value;
  const answer = $('claimAnswer').value.trim();
  const additionalProof = $('claimAdditionalProof').value.trim();
  const phone = $('claimPhone').value.trim();

  if (!answer) {
    if (errorEl) errorEl.textContent = 'Please provide details or answer the verification question.';
    return;
  }

  const payload = {
    answer,
    additionalProof,
    phone,
    proofImage: claimProofBase64
  };

  try {
    const res = await fetch(`/api/reports/${reportId}/claim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      throw Error(d.message || 'Could not submit claim.');
    }
    toast('Claim submitted to founder! They will review your proof. 🛡️');
    $('claimForm').reset();
    claimProofBase64 = null;
    if ($('claimPhotoPreview')) $('claimPhotoPreview').classList.add('hide');
    closeClaimModal();
    load();
  } catch (err) {
    if (errorEl) errorEl.textContent = err.message || 'Could not submit claim.';
  }
}

async function openClaimsViewer(reportId) {
  const modal = $('claimsViewerModal');
  const container = $('claimsListContainer');
  if (!modal || !container) return;

  pushCampusUiLayer('claimsViewerModal');
  modal.classList.remove('hide');
  document.body.classList.add('fullscreen-page-open');
  container.innerHTML = '<div class="empty">Loading submitted claims…</div>';

  try {
    const res = await fetch(`/api/reports/${reportId}/claims`);
    if (!res.ok) throw 0;
    const claims = await res.json();

    if (!claims || claims.length === 0) {
      container.innerHTML = `
        <div class="empty">
          <b>No claims submitted yet</b>
          <p>When someone claims this item, their proof details and contact info will appear here.</p>
        </div>`;
      return;
    }

    container.innerHTML = claims.map(c => {
      const cleanPhone = String(c.claimantPhone || '').replace(/[^0-9]/g, '');
      const waPhone = cleanPhone.length === 10 ? '91' + cleanPhone : cleanPhone;
      const waText = encodeURIComponent(`Hi ${c.claimantDisplayName}! I saw your claim for the item I found on CampUs.`);
      const waUrl = cleanPhone ? `https://wa.me/${waPhone}?text=${waText}` : '';

      return `
        <article class="claim-card-item" id="claim-card-${c.id}">
          <div class="claim-card-header">
            <div class="claim-claimant-info">
              <div class="claim-avatar">${firstInitial(c.claimantDisplayName || 'C')}</div>
              <div>
                <b>${esc(c.claimantDisplayName)}</b>
                <small style="display:block; color:var(--insta-text-muted);">@${esc(c.claimantUsername)} · ${timeAgo(c.createdAt)}</small>
              </div>
            </div>
            <span class="status ${c.status === 'APPROVED' ? 'returned' : c.status === 'REJECTED' ? 'lost' : 'open'}">
              ${c.status === 'APPROVED' ? '✓ APPROVED' : c.status === 'REJECTED' ? '✕ REJECTED' : '● PENDING REVIEW'}
            </span>
          </div>

          <div class="claim-details-box">
            <div class="claim-answer-label">Claimant's Proof / Answer:</div>
            <p class="claim-answer-text">${esc(c.answer)}</p>
            ${c.additionalProof ? `<p style="margin:6px 0 0; font-size:12px; color:var(--insta-text-muted);">${esc(c.additionalProof)}</p>` : ''}
          </div>

          ${c.proofImageData ? `
            <div style="margin-top:4px;">
              <span style="font-size:11px; font-weight:800; color:var(--insta-text-muted);">ATTACHED PROOF PHOTO:</span>
              <img src="${esc(c.proofImageData)}" style="max-height:160px; border-radius:10px; display:block; margin-top:4px; cursor:pointer;" onclick="viewFullImage('${esc(c.proofImageData)}')" alt="Proof photo">
            </div>
          ` : ''}

          <div class="claim-actions-row">
            ${cleanPhone ? `
              <a href="tel:${cleanPhone}" class="prof-act-btn" style="text-decoration:none;">📞 Call</a>
              ${waUrl ? `<a href="${waUrl}" target="_blank" rel="noopener noreferrer" class="prof-act-btn" style="text-decoration:none;">💬 WhatsApp</a>` : ''}
            ` : ''}

            ${c.status === 'PENDING' ? `
              <button type="button" class="claim-reject-btn" onclick="rejectClaim(${c.id}, ${reportId})">Reject</button>
              <button type="button" class="claim-approve-btn" onclick="approveClaim(${c.id}, ${reportId})">✓ Approve &amp; Return (+50 Karma!)</button>
            ` : ''}
          </div>
        </article>`;
    }).join('');
  } catch (err) {
    container.innerHTML = '<div class="empty">Could not load claims. Please try again.</div>';
  }
}

function closeClaimsViewer(fromPopstate = false) {
  const modal = $('claimsViewerModal');
  if (!modal || modal.classList.contains('hide')) return;
  modal.classList.add('hide');
  document.body.classList.remove('fullscreen-page-open');
  finishCampusUiLayer('claimsViewerModal', fromPopstate);
}

async function approveClaim(claimId, reportId) {
  if (!confirm('Approve this claim? The item will be marked as RETURNED and you will be awarded +50 Karma Points!')) return;
  try {
    const res = await fetch(`/api/claims/${claimId}/approve`, { method: 'POST' });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      throw Error(d.message || 'Could not approve claim.');
    }
    toast('Claim approved! Item returned & +50 Karma Points awarded! ⭐');
    closeClaimsViewer();
    load();
  } catch (err) {
    toast(err.message || 'Could not approve claim.');
  }
}

async function rejectClaim(claimId, reportId) {
  if (!confirm('Reject this ownership claim?')) return;
  try {
    const res = await fetch(`/api/claims/${claimId}/reject`, { method: 'POST' });
    if (!res.ok) throw 0;
    toast('Claim rejected.');
    openClaimsViewer(reportId);
  } catch {
    toast('Could not reject claim.');
  }
}

/* ==========================================================================
   FEATURE 1: AI SMART MATCHING SYSTEM
   ========================================================================== */
async function loadSmartMatchesForDetail(report, containerEl) {
  if (!report || !containerEl) return;
  try {
    const res = await fetch(`/api/reports/${report.id}/matches`);
    if (!res.ok) return;
    const matches = await res.json();
    if (!matches || matches.length === 0) return;

    const top = matches[0];
    const box = document.createElement('div');
    box.className = 'smart-match-alert-box';
    box.innerHTML = `
      <div>
        <div class="smart-match-title">🤖 AI Smart Match Alert</div>
        <p class="smart-match-desc">Found similar ${top.type.toLowerCase()} item: <b>${esc(top.title)}</b> at ${esc(top.location)}</p>
      </div>
      <div style="display:flex; align-items:center; gap:8px;">
        <span class="smart-match-score-pill">${top.matchScore}% Match</span>
        <button type="button" class="auth-primary" style="padding:6px 10px; font-size:12px; border-radius:8px;" onclick="openPostDetail(${top.id})">View →</button>
      </div>`;
    containerEl.prepend(box);
  } catch (e) {}
}

/* ==========================================================================
   FEATURE 8: CAMPUS GOOD SAMARITANS KARMA LEADERBOARD
   ========================================================================== */
function openLeaderboardModal() {
  const modal = $('leaderboardModal');
  if (!modal) return;
  pushCampusUiLayer('leaderboardModal');
  modal.classList.remove('hide');
  document.body.classList.add('fullscreen-page-open');
  fetchLeaderboard();
}

function closeLeaderboardModal(fromPopstate = false) {
  const modal = $('leaderboardModal');
  if (!modal || modal.classList.contains('hide')) return;
  modal.classList.add('hide');
  document.body.classList.remove('fullscreen-page-open');
  finishCampusUiLayer('leaderboardModal', fromPopstate);
}

async function fetchLeaderboard() {
  const listEl = $('leaderboardList');
  if (!listEl) return;
  listEl.innerHTML = '<div class="empty">Loading leaderboard…</div>';

  try {
    const res = await fetch('/api/leaderboard');
    if (!res.ok) throw 0;
    const users = await res.json();

    if (!users || users.length === 0) {
      listEl.innerHTML = '<div class="empty">No points recorded yet. Be the first to return an item!</div>';
      return;
    }

    listEl.innerHTML = users.map((u, i) => {
      const rankEmoji = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`;
      return `
        <div class="leaderboard-row">
          <div class="leaderboard-rank">${rankEmoji}</div>
          <div class="leaderboard-avatar">${avatarInner(u.avatarId, u.displayName, u.profileImageUrl)}</div>
          <div class="leaderboard-user-details">
            <div class="leaderboard-user-name">${esc(u.displayName)}</div>
            <div class="leaderboard-user-sub">@${esc(u.username)} · ${esc(u.college || 'Campus')}</div>
          </div>
          <div class="leaderboard-points-wrap">
            <span class="leaderboard-points">⭐ ${u.karmaPoints || 0}</span>
            <span class="leaderboard-badge-tag">${esc(u.karmaBadge || 'Campus Friend')}</span>
          </div>
        </div>`;
    }).join('');
  } catch (err) {
    listEl.innerHTML = '<div class="empty">Could not load leaderboard.</div>';
  }
}
