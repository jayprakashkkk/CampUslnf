let chosenType='', myReportsOnly=false, statFilter='', currentUser=null, authMode='login';
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
 if(layer==='profileEditor')closeProfileEditorPage(true);
 else if(layer==='publicProfile')closeChatUserProfile(true);
 else if(layer==='communityChat')closeCommunityChat(true);
 else if(layer==='reportForm')closeForm(true);
 else if(layer==='navPopup')closeNavPopup(true);
 else if(layer==='authForm')backToAuthChoices(true);
 else if(layer==='phoneMenu')closeMenu(true);
 else if(layer==='profileDropdown')closeProfileDropdown(true);
}
function closeTopUntrackedUiLayer(){
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
function openForm(type){$('form').reset();$('name').value=currentUser?.displayName||currentUser?.username||'';$('phone').value=currentUser?.phone||'';$('photoPreview').src='';$('photoPreview').classList.add('hide');$('type').value=type;$('formTitle').textContent=type==='LOST'?'Report a lost item':'Report a found item';pushCampusUiLayer('reportForm');$('modal').classList.remove('hide');$('error').textContent=''}
function closeForm(fromPopstate=false){const wasOpen=!$('modal').classList.contains('hide');$('modal').classList.add('hide');if(wasOpen)finishCampusUiLayer('reportForm',fromPopstate)}
function filterType(type,btn){chosenType=type;document.querySelectorAll('.type-tabs .tab').forEach(x=>x.classList.remove('active'));btn.classList.add('active');load()}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function validAvatarId(id){const v=String(id||'');return /^avatar-(0[1-9]|[12][0-9]|30)$/.test(v)?v:''}
function avatarInner(id,name,photoData=''){const photo=String(photoData||'');if(photo&&(photo.startsWith('data:image/')||photo.startsWith('/api/users/')))return `<img class="avatar-image" src="${esc(photo)}" alt="" loading="lazy">`; const safeId=validAvatarId(id);if(safeId)return `<img class="avatar-image" src="/avatars/${safeId}.png" alt="" loading="lazy">`;const clean=String(name||'User').trim();return esc((clean.charAt(0)||'?').toUpperCase())}
function avatarMarkup(id,name,extraClass='avatar-image',photoData=''){const photo=String(photoData||'');if(photo&&(photo.startsWith('data:image/')||photo.startsWith('/api/users/')))return `<img class="${extraClass}" src="${esc(photo)}" alt="" loading="lazy">`; const safeId=validAvatarId(id);return safeId?`<img class="${extraClass}" src="/avatars/${safeId}.png" alt="" loading="lazy">`:esc((String(name||'User').trim().charAt(0)||'?').toUpperCase())}
function roleLabel(role){const r=String(role||'MEMBER').toUpperCase();return ({OWNER:'Owner',ADMIN:'Admin',LEADER:'Leader',MODERATOR:'Moderator'})[r]||''}
function roleCanChangeUsername(role){return ['OWNER','ADMIN'].includes(String(role||'MEMBER').toUpperCase())}
function roleCanUploadPhoto(role){return ['OWNER','ADMIN','LEADER'].includes(String(role||'MEMBER').toUpperCase())}
function roleCanUploadBanner(role){return ['OWNER','ADMIN','LEADER','MODERATOR'].includes(String(role||'MEMBER').toUpperCase())}
function roleCanManageMembers(role){return ['OWNER','ADMIN'].includes(String(role||'MEMBER').toUpperCase())}
function roleBadgeMarkup(role){const label=roleLabel(role);return label?`<span class="role-badge role-${label.toLowerCase()}">~ ${label}</span>`:''}

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
function normWords(s){return String(s||'').toLowerCase().replace(/[^a-z0-9\s]/g,' ').split(/\s+/).filter(w=>w.length>2&&!['the','and','for','with','item','lost','found'].includes(w))}
function matchScore(a,b){const aw=new Set(normWords((a.title||'')+' '+(a.description||''))),bw=new Set(normWords((b.title||'')+' '+(b.description||'')));const common=[...aw].filter(w=>bw.has(w)).length;const sameTitle=String(a.title||'').trim().toLowerCase()===String(b.title||'').trim().toLowerCase();const sameCat=String(a.category||'').toLowerCase()===String(b.category||'').toLowerCase();if(sameTitle)return 10+(sameCat?2:0);if(common===0)return 0;return common+(sameCat?1:0)}
function bestMatch(r,all){return all.filter(x=>x.type!==r.type&&x.status!=='RETURNED').map(x=>({item:x,score:matchScore(r,x)})).filter(x=>x.score>=2).sort((a,b)=>b.score-a.score)[0]?.item||null}
function updatePoster(all){const returned=all.filter(x=>String(x.status||'').toUpperCase()==='RETURNED').sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||'')));if(!returned.length){$('matchIcon').textContent='⌕';$('matchName').textContent='No items returned yet';$('matchMeta').textContent='Successfully returned items will appear here';$('matchBadge').textContent='WAITING FOR RETURN';$('matchBadge').classList.remove('match-yes');return}const item=returned[0];$('matchIcon').textContent=String(item.category||'').toLowerCase().includes('id')?'🪪':String(item.category||'').toLowerCase().includes('electronic')?'🎧':'✓';$('matchName').textContent=item.title||'Returned item';$('matchMeta').textContent=`Returned · ${item.location||'Location not specified'}${item.itemDate?' · '+item.itemDate:''}`;$('matchBadge').textContent='SUCCESSFULLY RETURNED';$('matchBadge').classList.add('match-yes')}
function clearFilters(){['q','filterCategory','filterLocation','dateFrom','dateTo'].forEach(id=>{const field=$(id);if(field)field.value=''});if($('boardSearch'))$('boardSearch').value='';chosenType='';statFilter='';myReportsOnly=false;document.querySelectorAll('.stats button').forEach(x=>x.classList.remove('selected'));document.querySelectorAll('.type-tabs .tab').forEach(x=>x.classList.toggle('active',x.textContent.trim()==='All items'));if($('myReports'))$('myReports').textContent='My reports';load()}
function filterStats(which){statFilter=which;chosenType='';myReportsOnly=false;document.querySelectorAll('.stats > div').forEach(x=>x.classList.toggle('selected',x.dataset.stat===which));document.querySelectorAll('.type-tabs .tab').forEach(x=>x.classList.toggle('active',x.textContent.trim()==='All items'));load();document.getElementById('board').scrollIntoView({behavior:'smooth',block:'start'});}
function toggleMyReports(){statFilter='';document.querySelectorAll('.stats > div').forEach(x=>x.classList.remove('selected'));myReportsOnly=!myReportsOnly;if($('myReports'))$('myReports').textContent=myReportsOnly?'Show all reports':'My reports';load()}
function showMyReports(e){if(e)e.preventDefault();showNavPopup('myReports')}
function passesFilters(r){const q=$('q').value.trim().toLowerCase(),cat=$('filterCategory').value,loc=$('filterLocation').value.trim().toLowerCase(),from=$('dateFrom').value,to=$('dateTo').value;const text=[r.title,r.category,r.location,r.description].join(' ').toLowerCase();if(q&&!text.includes(q))return false;if(cat&&r.category!==cat)return false;if(loc&&!String(r.location||'').toLowerCase().includes(loc))return false;if(from&&r.itemDate&&r.itemDate<from)return false;if(to&&r.itemDate&&r.itemDate>to)return false;return true}
async function load(){try{const allRes=await fetch(myReportsOnly?'/api/reports?mine=true':'/api/reports');if(!allRes.ok){if(allRes.status===401){$('total').textContent='0';$('lost').textContent='0';$('found').textContent='0';$('returned').textContent='0';$('resultCount').textContent='Backend connection required';$('grid').innerHTML='<div class="empty"><b>Welcome to CampUs</b><p>The website is open. Connect the CampUs backend to load reports and enable submissions.</p></div>';return}throw 0}const all=await allRes.json();updatePoster(all);$('total').textContent=all.length;$('lost').textContent=all.filter(x=>x.type==='LOST').length;$('found').textContent=all.filter(x=>x.type==='FOUND').length;$('returned').textContent=all.filter(x=>x.status==='RETURNED').length;let rows=all.filter(r=>(!chosenType||r.type===chosenType)&&(!statFilter||statFilter==='ALL'||(statFilter==='LOST'&&r.type==='LOST')||(statFilter==='FOUND'&&r.type==='FOUND')||(statFilter==='RETURNED'&&r.status==='RETURNED'))&&passesFilters(r));$('resultCount').textContent=`${rows.length} report${rows.length===1?'':'s'} shown`;if(!rows.length){const hasSearch=$('q').value.trim()||$('filterCategory').value||$('filterLocation').value.trim()||$('dateFrom').value||$('dateTo').value||chosenType;const heading=myReportsOnly?'You have not submitted any reports yet':(hasSearch?'No matching reports found':'No lost or found items reported yet');const message=myReportsOnly?'Reports submitted from your account will appear here.':(hasSearch?'Try changing your search or filters, or clear them to see all reports.':'When someone reports a lost or found item, it will appear here. You can report the first item using the buttons above.');$('grid').innerHTML=`<div class="empty"><b>${heading}</b><p>${message}</p>${hasSearch?'<button onclick="clearFilters()">Clear filters</button>':''}</div>`;return}
$('grid').innerHTML=rows.map(r=>{
 const m=bestMatch(r,all);
 const authorName=String(r.ownerDisplayName||r.reporterName||'CampUs user').trim()||'CampUs user';
 const ownerUsername=String(r.accountUsername||'');
 const avatarContent=avatarInner(r.ownerAvatarId,authorName,r.ownerProfileImageUrl);
 const roleBadge=roleBadgeMarkup(r.ownerRole);
 const author=ownerUsername
  ? `<button type="button" class="post-author post-author-link" data-profile-username="${esc(ownerUsername)}" aria-label="View ${esc(authorName)}'s profile"><span class="post-author-avatar">${avatarContent}</span><span class="post-author-name">${esc(authorName)}${roleBadge}</span></button>`
  : `<div class="post-author"><span class="post-author-avatar">${avatarContent}</span><span class="post-author-name">${esc(authorName)}${roleBadge}</span></div>`;
 const canEdit=!!(currentUser&&ownerUsername&&ownerUsername.toLowerCase()===currentUser.username.toLowerCase());
 const statusControl=canEdit
  ? `<select onchange="updateStatus(${r.id},this.value)" aria-label="Update status"><option value="OPEN" ${r.status==='OPEN'?'selected':''}>Open</option><option value="MATCHED" ${r.status==='MATCHED'?'selected':''}>Matched</option><option value="RETURNED" ${r.status==='RETURNED'?'selected':''}>Returned</option></select>`
  : `<span class="status ${String(r.status||'').toUpperCase()==='RETURNED'?'returned':String(r.status||'').toUpperCase()==='MATCHED'?'matched':'open'}">${esc(r.status)}</span>`;
 return `<article class="card" data-report-id="${r.id}">${author}<div class="cardtop"><span class="pill ${r.type==='FOUND'?'found':''}">${r.type==='LOST'?'● LOST ITEM':'● FOUND ITEM'}</span><span class="status ${String(r.status||'').toUpperCase()==='RETURNED'?'returned':String(r.status||'').toUpperCase()==='MATCHED'?'matched':'open'}">${esc(r.status)}</span></div><small class="eyebrow">${esc(r.category)}</small><h3>${esc(r.title)}</h3><div class="meta">📍 ${esc(r.location)}</div><div class="meta">📅 ${esc(r.itemDate||'Date not specified')}</div>${r.imageData?`<img class="item-photo" src="${esc(r.imageData)}" alt="Photo of ${esc(r.title)}" loading="lazy">`:''}${r.description?`<div class="desc">${esc(r.description)}</div>`:''}<div class="match-note ${m?'has-match':'no-match'}">${m?`<b>Possible match:</b> ${esc(m.title)} <span>(${esc(m.type)} · ${esc(m.location)})</span>`:'No match found'}</div>${r.reporterPhone?`<div class="contact-line">📱 Contact: <a href="tel:${esc(r.reporterPhone.replace(/[^+0-9]/g,''))}">${esc(r.reporterPhone)}</a></div>`:''}<div class="cardbottom">${canEdit?`<span>Update status</span>${statusControl}`:`<span>Reported ${esc(r.itemDate||'date not specified')}</span>`}</div></article>`
}).join('')}
catch{$('grid').innerHTML='<div class="empty"><b>Backend not connected</b><p>Start the Java app, then refresh this page.</p></div>'}}
$('photo').addEventListener('change',()=>{const file=$('photo').files[0];if(!file){$('photoPreview').src='';$('photoPreview').classList.add('hide');return}if(!file.type.startsWith('image/')){toast('Please choose an image file.');$('photo').value='';return}const reader=new FileReader();reader.onload=()=>{$('photoPreview').src=reader.result;$('photoPreview').classList.remove('hide')};reader.onerror=()=>{toast('Could not read the photo. Please try another image.');$('photo').value='';$('photoPreview').src='';$('photoPreview').classList.add('hide')};reader.readAsDataURL(file)});
$('modal').addEventListener('click',e=>{if(e.target===$('modal'))closeForm()});document.addEventListener('keydown',e=>{if(e.key==='Escape')closeForm()});
$('form').addEventListener('submit',async e=>{e.preventDefault();const file=$('photo').files[0];let imageData=null;if(file){try{imageData=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file)})}catch{$('error').textContent='Could not read the photo. Please try another image.';return}}
let payload={imageData,type:$('type').value,title:$('title').value.trim(),category:$('category').value,location:$('location').value.trim(),itemDate:$('itemDate').value||null,reporterName:$('name').value.trim(),reporterPhone:$('phone').value.trim(),description:$('description').value.trim()};
try{let res=await fetch('/api/reports',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});if(!res.ok){let d=await res.json().catch(()=>({}));throw Error(d.message||'Please check the form and try again.')}const created=await res.json().catch(()=>null);$('form').reset();$('photoPreview').src='';$('photoPreview').classList.add('hide');closeForm();toast('Report submitted. Thanks for helping your campus! 💜');load()}catch(err){$('error').textContent=err.message||'Could not submit report.'}});
async function updateStatus(id,status){try{let r=await fetch(`/api/reports/${id}/status`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status})});if(!r.ok)throw 0;toast('Status updated');load()}catch{toast('Could not update status')}}
const boardSearch=$('boardSearch');
let memberSearchTimer=null, memberSearchSequence=0;
if(boardSearch){
 boardSearch.value=$('q').value||'';
 let searchTimer;
 boardSearch.addEventListener('input',()=>{
  $('q').value=boardSearch.value;
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
let timer;['q','filterCategory','filterLocation','dateFrom','dateTo'].forEach(id=>{const el=$(id);if(el)el.addEventListener(id==='q'||id==='filterLocation'?'input':'change',()=>{clearTimeout(timer);timer=setTimeout(load,220)})});initAuth();
/* Profile button opens the phone navigation or the profile editor on desktop. */
let menuOpen=false, profileMenuOpen=false, activeNavPopup='', selectedProfileAvatarId='';
let mobileNavHomeParent=null, mobileNavHomeNextSibling=null;
function firstNameOfUser(user=currentUser){
 const full=String(user?.displayName||user?.username||'User').trim();
 const first=(full.split(/\s+/)[0]||'User');
 return first.charAt(0).toLocaleUpperCase()+first.slice(1);
}
function updateGreeting(){
 const button=$('profileButton');
 if(!button)return;
 button.textContent=`Hi, ${firstNameOfUser()}`;
 const mobile=window.innerWidth<=850;
 button.setAttribute('aria-label',mobile?(menuOpen?'Close navigation menu':'Open navigation menu'):(profileMenuOpen?'Close account options':'Open account options'));
 button.setAttribute('aria-expanded',String(mobile?menuOpen:profileMenuOpen));
}
function handleProfileButtonClick(){
 if(window.innerWidth<=850){closeProfileDropdown();toggleMenu();return;}
 closeMenu();
 if(profileMenuOpen){closeProfileDropdown();return;}
 profileMenuOpen=true;
 const dropdown=$('profileDropdown');
 if(dropdown)dropdown.hidden=false;
 updateGreeting();
}
function openDesktopProfile(){closeProfileDropdown();openOwnPublicProfile();}
function openOwnPublicProfile(){
 if(!currentUser||!currentUser.username){toast('Please log in to view your profile.');return;}
 closeMenu();closeProfileDropdown();
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
 $('privilegedProfileMedia').classList.toggle('hide',!(canPhoto||canBanner));
 $('profilePhotoField').classList.toggle('hide',!canPhoto);
 $('profileBannerField').classList.toggle('hide',!canBanner);
 const ownerMemberPanel=$('ownerMemberManagement');if(ownerMemberPanel)ownerMemberPanel.classList.toggle('hide',!canManage);
 $('profileMediaPermissionText').textContent=canPhoto?'Your role allows a custom profile photo and banner.':canBanner?'Your role allows a banner. Choose one of the limited avatars for your profile photo.':'Regular Members can choose from the limited avatar gallery only.';
 const ownerMemberHelp=$('ownerMemberHelp');if(ownerMemberHelp)ownerMemberHelp.textContent=role==='OWNER'?'Owner can assign all member roles. The current Owner account stays protected.':'Admin can assign Leader, Moderator, or Member, but cannot grant Admin or Owner.';
 $('profileEditorRoleLabel').textContent=role==='OWNER'?'Owner · unlimited username changes · custom photo and banner':role==='ADMIN'?'Admin · unlimited username changes · custom photo and banner':role==='LEADER'?'Leader · limited username changes · custom photo and banner':role==='MODERATOR'?'Moderator · limited username changes · optional banner':'Member · limited avatar choices';
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
function updateUsernameChangeHint(){
 const hint=$('usernameChangeHint');if(!hint)return;
 if(roleCanChangeUsername(currentUser?.role)||currentUser?.usernameUnlimited){hint.textContent=`${String(currentUser?.role||'OWNER').toLowerCase()} account: you can change your username any time.`;hint.style.color='#c67c3b';return;}
 const remaining=Math.max(0,Number(currentUser?.usernameChangesRemaining??1));
 const resetDate=formatUsernameResetDate(currentUser?.usernameChangeWindowResetsAt);
 if(remaining===0){hint.textContent=`Username changes are locked until ${resetDate}. You can still update other profile details.`;hint.style.color='#a45b14';}
 else{hint.textContent=`You can change your username ${remaining} more ${remaining===1?'time':'times'} before ${resetDate}. Your initial username counts as the first use in this 12-month period.`;hint.style.color='';}
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
  document.body.classList.add('browse-mode');$('board').classList.remove('default-list-mode');$('board').classList.add('browse-results-mode');if($('boardSearch'))$('boardSearch').value=$('navSearch').value;
  $('q').value=$('navSearch').value;$('filterCategory').value=$('navCategory').value;$('filterLocation').value=$('navLocation').value;$('dateFrom').value=$('navDateFrom').value;$('dateTo').value=$('navDateTo').value;
  chosenType=$('navType').value;myReportsOnly=false;
  document.querySelectorAll('.type-tabs .tab').forEach(b=>b.classList.toggle('active', (chosenType===''&&b.textContent.trim()==='All items')||b.textContent.trim()===(chosenType==='LOST'?'Lost':chosenType==='FOUND'?'Found':'__none__')));
  closeNavPopup();load();
 }else if(page==='myReports'){
  myReportsOnly=true;closeNavPopup();load();
 }else{closeNavPopup();}
}

$('navPopup').addEventListener('click',e=>{if(e.target===$('navPopup'))closeNavPopup()});
document.addEventListener('keydown',e=>{if(e.key!=='Escape')return;if($('profileEditorPage')&&!$('profileEditorPage').classList.contains('hide')){closeProfileEditorPage();return;}if(!$('communityProfilePage').classList.contains('hide')){closeChatUserProfile();return;}if(communityChatOpen){closeCommunityChat();return;}if(!$('navPopup').classList.contains('hide')){closeNavPopup();return;}if(!$('modal').classList.contains('hide')){closeForm();return;}closeMenu();closeProfileDropdown();});
window.addEventListener('click',e=>{if(profileMenuOpen&&!e.target.closest('#profileDropdown')&&!e.target.closest('#profileButton'))closeProfileDropdown()});
window.addEventListener('resize',()=>{if(window.innerWidth>850)closeMenu();else closeProfileDropdown()});


function setAuthGateVisibility(visible) {
  const gate = $('authGate');
  if (!gate) return;
  gate.hidden = !visible;
  gate.classList.toggle('hide', !visible);
  gate.style.setProperty('display', visible ? 'grid' : 'none', 'important');
}


function chooseAuthMode(mode) {
  if ($('authFormPanel').classList.contains('hide')) {
    pushCampusUiLayer('authForm');
  }

  // Leaving password reset always returns to the normal auth form state.
  $('authGate')?.classList.remove('auth-reset-mode');

  const resetPanel = $('forgotPasswordPanel');
  if (resetPanel) resetPanel.hidden = true;

  authMode = mode;

  $('authChoices').classList.add('hide');
  $('authFormPanel').classList.remove('hide');
  $('authError').textContent = '';
  $('authForm').reset();

  const creating = mode === 'register';
  const fields = $('authRegisterFields');
  const forgotButton = $('forgotPasswordButton');

  // Show Forgot Password only on Login.
  if (forgotButton) {
    forgotButton.hidden = creating;

    if (creating) {
      forgotButton.style.setProperty('display', 'none', 'important');
    } else {
      forgotButton.style.removeProperty('display');
    }
  }

  // Registration-only fields.
  if (fields) {
    fields.hidden = !creating;

    ['authFullName', 'authCourse', 'authEmail'].forEach(id => {
      const field = $(id);

      field.disabled = !creating;
      field.required = creating;

      if (!creating) {
        field.value = '';
      }
    });
  }

  $('authFormTitle').textContent =
    creating ? 'Create new account' : 'Login';

  $('authSubmitButton').textContent =
    creating ? 'Create account' : 'Login';

  $('authWelcomeTitle').textContent =
    creating ? 'Join CampUs' : 'Welcome back';

  $('authPassword').autocomplete =
    creating ? 'new-password' : 'current-password';

  $('authPassword').placeholder =
    creating ? 'Create a password' : 'Enter password';

  $(creating ? 'authFullName' : 'authUsername').focus();
}


function backToAuthChoices(fromPopstate = false) {
  const wasOpen = !$('authFormPanel').classList.contains('hide');

  $('authFormPanel').classList.add('hide');

  if (wasOpen) {
    finishCampusUiLayer('authForm', fromPopstate);
  }

  $('authChoices').classList.remove('hide');
  $('authError').textContent = '';
  $('authPassword').value = '';
  $('authForm').reset();

  const fields = $('authRegisterFields');
  if (fields) {
    fields.hidden = true;

    ['authFullName', 'authCourse', 'authEmail'].forEach(id => {
      const field = $(id);
      field.disabled = true;
      field.required = false;
    });
  }

  $('authWelcomeTitle').textContent = 'Welcome to CampUs';
}

function enterApp(user) {
  if (!$('authFormPanel').classList.contains('hide')) {
    finishCampusUiLayer('authForm');
  }

  currentUser = {
    username: user.username,
    displayName: user.displayName || user.username,
    phone: user.phone || '',
    course: user.course || '',
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

  document.body.classList.remove('auth-locked');
  setAuthGateVisibility(false);

  updateGreeting();
  $('name').value = currentUser.displayName;
  $('phone').value = currentUser.phone;

  resetCampusScrollToTop();
  load();
  startNotificationPolling();
}

async function initAuth() {
  try {
    const response = await fetch('/api/auth/me', {
      headers: { Accept: 'application/json' }
    });

    const data = await response.json();

    if (response.ok && data.authenticated) {
      enterApp(data);
    } else {
      showAuthGate();
    }
  } catch {
    showAuthGate();
  }
}


let resetOtpRequested=false;

$('forgotPasswordButton')?.addEventListener('click', () => {
  const panel = $('forgotPasswordPanel');
  const gate = $('authGate');
  if (!panel || !gate) return;

  // Reset starts from Login and displays only the dedicated recovery panel.
  authMode = 'login';
  panel.hidden = false;
  gate.classList.add('auth-reset-mode');

  $('resetPasswordMessage').textContent = '';
  $('resetEmail').value = $('authEmail')?.value || '';
  $('resetOtpFields').hidden = true;
  resetOtpRequested = false;
  $('forgotPasswordTitle').textContent = 'Reset your password';
  $('resetEmail').focus();
});

$('cancelResetPasswordButton')?.addEventListener('click', () => {
  const panel = $('forgotPasswordPanel');
  if (panel) panel.hidden = true;
  $('authGate')?.classList.remove('auth-reset-mode');
  $('resetPasswordMessage').textContent = '';
  chooseAuthMode('login');
});

$('sendResetOtpButton')?.addEventListener('click',async()=>{
  const email=$('resetEmail').value.trim();
  const msg=$('resetPasswordMessage'),btn=$('sendResetOtpButton');
  msg.textContent='';
  if(!email||!$('resetEmail').checkValidity()){msg.textContent='Please enter a valid registered email.';return;}
  btn.disabled=true;btn.textContent='Sending…';
  try{
    const r=await fetch('/api/auth/forgot-password',{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({email})});
    const d=await r.json().catch(()=>({}));
    if(!r.ok){msg.textContent=d.message||'Could not send OTP. Please try again.';return;}
    resetOtpRequested=true;$('resetOtpFields').hidden=false;
    msg.textContent=d.message||'If the email belongs to an account, an OTP has been sent.';
  }catch{msg.textContent='Could not connect. Please try again.';}
  finally{btn.disabled=false;btn.textContent='Resend OTP';}
});
$('verifyResetOtpButton')?.addEventListener('click',async()=>{
  const email=$('resetEmail').value.trim(),otp=$('resetOtp').value.trim(),password=$('resetNewPassword').value;
  const msg=$('resetPasswordMessage'),btn=$('verifyResetOtpButton');
  msg.textContent='';
  if(!/^\d{6}$/.test(otp)){msg.textContent='Enter the 6-digit OTP.';return;}
  if(password.length<8){msg.textContent='New password must be at least 8 characters.';return;}
  btn.disabled=true;btn.textContent='Resetting…';
  try{
    const r=await fetch('/api/auth/reset-password',{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({email,otp,newPassword:password})});
    const d=await r.json().catch(()=>({}));
    if(!r.ok){msg.textContent=d.message||'OTP invalid or expired. Request a new OTP.';return;}
    msg.textContent='Password reset successfully. You can now log in.';
    $('authUsername').value=email;$('authPassword').value='';$('resetOtpFields').hidden=true;
  }catch{msg.textContent='Could not connect. Please try again.';}
  finally{btn.disabled=false;btn.textContent='Verify OTP & reset password';}
});

$('showLoginButton')?.addEventListener('click',()=>chooseAuthMode('login'));
$('showRegisterButton')?.addEventListener('click',()=>chooseAuthMode('register'));
$('authForm')?.addEventListener('submit',async event=>{
  event.preventDefault();
  const username=$('authUsername').value.trim().toLowerCase();
  const password=$('authPassword').value;
  const displayName=$('authFullName').value.trim();
  const course=$('authCourse').value.trim();
  const email=$('authEmail').value.trim();
  $('authError').textContent='';
  const isRegister=authMode==='register';
  if(isRegister&&!displayName){$('authError').textContent='Please enter your full name.';$('authFullName').focus();return;}
  if(isRegister&&!course){$('authError').textContent='Please enter your course.';$('authCourse').focus();return;}
  if(isRegister&&!email){$('authError').textContent='Please enter your university email.';$('authEmail').focus();return;}
  if(isRegister&&!$('authEmail').checkValidity()){$('authError').textContent='Please enter a valid university email address.';$('authEmail').focus();return;}
  if(!username){$('authError').textContent='Please enter a username.';$('authUsername').focus();return;}
  if(password.length===0){$('authError').textContent='Please enter a password.';$('authPassword').focus();return;}
  const button=$('authSubmitButton');
  button.disabled=true;button.textContent=isRegister?'Creating account…':'Logging in…';
  try{
    const response=await fetch(isRegister?'/api/auth/register':'/api/auth/login',{
      method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},
      body:JSON.stringify(isRegister?{username,password,displayName,course,email}:{username,password})
    });
    const data=await response.json().catch(()=>({}));
    if(!response.ok){$('authError').textContent=data.message||(isRegister?'Could not create account. Please try again.':'Incorrect username or password. Please try again.');return;}
    $('authPassword').value='';
    enterApp(data);
    toast(isRegister?'Account created successfully. Welcome to CampUs!':'Welcome back, '+data.username+'!');
  }catch{
    $('authError').textContent='Could not connect to CampUs. Make sure the Java server is running, then try again.';
  }finally{
    button.disabled=false;button.textContent=isRegister?'Create account':'Login';
  }
});
async function logout(){
  stopNotificationPolling();
  closeMenu();closeProfileDropdown();closeNavPopup();closeProfileEditorPage();closeForm();
  try{await fetch('/api/auth/logout',{method:'POST'});}catch{/* The local gate still closes access if the server is unavailable. */}
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
function chatTime(value){try{return new Intl.DateTimeFormat(undefined,{hour:'numeric',minute:'2-digit'}).format(new Date(value))}catch{return ''}}
function renderCommunityMessages(items,forceBottom){
 const box=$('chatMessages'),nearBottom=box.scrollHeight-box.scrollTop-box.clientHeight<90;
 if(!items.length){box.innerHTML='<div class="empty">No messages yet. Say hello to your campus community! 👋</div>';lastChatSignature='';return}
 const signature=items.map(m=>`${m.id}:${m.message}:${m.replyText||''}`).join('|');if(signature===lastChatSignature)return;lastChatSignature=signature;
 box.innerHTML=items.map(m=>{const mine=!!m.mine;const fullName=String(m.displayName||m.username||'CampUs user').trim();const username=String(m.username||'');const initial=fullName.charAt(0).toUpperCase()||'?';const avatar=`<button type="button" class="chat-avatar chat-avatar-button" aria-label="View ${esc(fullName)}'s profile" data-chat-profile-name="${esc(fullName)}" data-chat-profile-username="${esc(username)}">${avatarInner(m.avatarId,fullName,m.profileImageUrl)}</button>`;const authorRole=roleLabel(m.role);const authorLine=authorRole?`<button type="button" class="chat-author-role" data-chat-profile-name="${esc(fullName)}" data-chat-profile-username="${esc(username)}">${esc(fullName)} ${roleBadgeMarkup(m.role)}</button>`:'';return `<div class="chat-row ${mine?'mine':'theirs'}" data-message-id="${m.id}">${mine?'':avatar}<div class="chat-message-stack">${authorLine}<div class="chat-bubble" role="group" aria-label="Chat message">${m.replyText?`<div class="chat-quoted"><b>${esc(m.replyName||'Reply')}</b><br>${esc(m.replyText)}</div>`:''}<div class="chat-text">${esc(m.message)}</div><div class="chat-time">${chatTime(m.createdAt)}</div><div class="chat-actions"><button type="button" onclick="replyToChatMessage(${m.id})">↩ Reply</button>${m.canDelete?`<button type="button" onclick="deleteChatMessage(${m.id})">Delete</button>`:''}</div></div></div></div>`}).join('');
 box.querySelectorAll('.chat-row').forEach(row=>{const bubble=row.querySelector('.chat-bubble');bubble.addEventListener('click',e=>{if(e.target.closest('button'))return;/* Phones use swipe-to-reply; never expose Reply/Delete controls on a simple tap. */if(window.matchMedia('(max-width: 700px)').matches)return;row.classList.toggle('actions-open')});bubble.addEventListener('contextmenu',e=>{e.preventDefault();/* Context menu action buttons are for tablet/laptop only. */if(window.matchMedia('(max-width: 700px)').matches)return;row.classList.toggle('actions-open')});let sx=0,sy=0;row.addEventListener('touchstart',e=>{sx=e.changedTouches[0].clientX;sy=e.changedTouches[0].clientY},{passive:true});row.addEventListener('touchend',e=>{const dx=e.changedTouches[0].clientX-sx,dy=e.changedTouches[0].clientY-sy;if(Math.abs(dx)>55&&Math.abs(dx)>Math.abs(dy)*1.4){const id=Number(row.dataset.messageId),msg=items.find(x=>x.id===id);if(msg){row.classList.remove('actions-open');setChatReply(msg)}}},{passive:true});});
 if(forceBottom||nearBottom)box.scrollTop=box.scrollHeight;
}
async function loadCommunityMessages(forceBottom){try{const r=await fetch('/api/community-chat',{headers:{'Accept':'application/json'}});if(r.status===401){$('chatMessages').innerHTML='<div class="chat-unavailable"><div class="chat-unavailable-icon" aria-hidden="true">💬</div><h3>Community chat is ready</h3><p>Connect the Java backend and sign in to load campus messages and send replies.</p><button type="button" class="light" onclick="loadCommunityMessages(true)">Try again</button></div>';return}if(!r.ok)throw new Error('Chat service is unavailable');const items=await r.json();renderCommunityMessages(items,forceBottom)}catch{$('chatMessages').innerHTML='<div class="chat-unavailable"><div class="chat-unavailable-icon" aria-hidden="true">💬</div><h3>Chat page is ready</h3><p>Messages and sending will be available when the Java backend is connected.</p><button type="button" class="light" onclick="loadCommunityMessages(true)">Retry connection</button></div>';}}
async function replyToChatMessage(id){try{const r=await fetch('/api/community-chat');const items=await r.json();const msg=items.find(x=>x.id===id);if(msg)setChatReply(msg)}catch{toast('Could not open reply. Try again.')}}
async function deleteChatMessage(id){if(!confirm('Delete this message? You can only delete your own messages within 10 minutes.'))return;try{const r=await fetch(`/api/community-chat/${id}`,{method:'DELETE'});const data=await r.json().catch(()=>({}));if(!r.ok)throw Error(data.message||'Could not delete message.');lastChatSignature='';await loadCommunityMessages(false);toast('Message deleted')}catch(e){toast(e.message||'Could not delete message')}}
$('communityChatForm').addEventListener('submit',async e=>{e.preventDefault();const input=$('communityChatInput'),message=input.value.trim();if(!message)return;const sendButton=$('communityChatForm').querySelector('button[type="submit"]');sendButton.disabled=true;try{const r=await fetch('/api/community-chat',{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({message,replyText:chatReplyTarget?.message||null,replyName:chatReplyTarget?.displayName||null})});const data=await r.json().catch(()=>({}));if(!r.ok)throw Error(data.message||'Could not send message.');input.value='';clearChatReply();lastChatSignature='';await loadCommunityMessages(true)}catch(err){toast(err.message||'Could not send message')}finally{sendButton.disabled=false;input.focus()}});

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
 const posts=Array.isArray(data.posts)?data.posts:[];
 const postCards=posts.length?posts.map(post=>{
  const type=String(post.type||'').toUpperCase();
  const status=String(post.status||'OPEN').toUpperCase();
  return `<article class="public-profile-post"><div class="public-profile-post-top"><span class="pill ${type==='FOUND'?'found':''}">${type==='FOUND'?'● FOUND ITEM':'● LOST ITEM'}</span><span class="status ${status==='RETURNED'?'returned':status==='MATCHED'?'matched':'open'}">${esc(status)}</span></div><h3>${esc(post.title||'Untitled item')}</h3><div class="meta">${esc(post.category||'Other')} · 📍 ${esc(post.location||'Location not specified')}</div>${post.imageData?`<img class="public-profile-post-image" src="${esc(post.imageData)}" alt="${esc(post.title||'Reported item')}" loading="lazy">`:''}${post.description?`<p>${esc(post.description)}</p>`:''}<small class="public-profile-post-date">${esc(post.itemDate||'Date not specified')}</small></article>`;
 }).join(''):'<div class="empty public-profile-empty"><b>No posts yet</b><p>This member has not posted any lost or found items.</p></div>';
 const viewerRole=String(data.viewerRole||currentUser?.role||'MEMBER').toUpperCase();
 const targetRole=String(data.role||'MEMBER').toUpperCase();
 const viewerUsername=String(data.viewerUsername||currentUser?.username||'').toLowerCase();
 const targetUsername=String(data.username||'').toLowerCase();
 const isOwnProfile=!!targetUsername&&targetUsername===viewerUsername;
 const bannerMarkup=hasBanner?`<div class="public-profile-banner"><img src="${esc(data.bannerImageUrl)}" alt="${esc(name)} profile banner" loading="lazy"></div>`:'';
 const editButton=isOwnProfile?'<div class="public-profile-own-actions"><button type="button" class="public-profile-edit-button" onclick="openProfileEditorPage()">Edit profile</button></div>':'';
 content.innerHTML=`<section class="public-profile-hero${hasBanner?' has-profile-banner':' no-profile-banner'}">${bannerMarkup}<div class="public-profile-avatar" aria-label="${esc(name)} avatar">${avatarInner(data.avatarId,name,data.profileImageUrl)}</div><h2>${esc(name)} ${roleBadgeMarkup(data.role)}</h2><p class="public-profile-handle">@${esc(data.username||'')}</p><div class="public-profile-course">${esc(data.course||'Course not provided')}</div><div class="public-profile-stats"><div><b>${Number(data.totalPosts)||0}</b><span>Posts</span></div><div><b>${Number(data.itemsReceivedBack)||0}</b><span>Received back</span></div><div><b>${Number(data.itemsReturnedToOthers)||0}</b><span>Returned to others</span></div></div>${editButton}</section><section class="public-profile-posts"><div class="public-profile-posts-heading"><h2>Posts</h2><span>${posts.length}</span></div><div class="public-profile-post-grid">${postCards}</div></section>`;
 $('communityProfilePageTitle').textContent=isOwnProfile?'Your profile':'Profile';
 const canOwnerManage=viewerRole==='OWNER'&&targetUsername!==''&&targetUsername!==viewerUsername&&targetRole!=='OWNER';
 const controls=$('publicProfileOwnerActions');
 if(controls)controls.classList.toggle('hide',!canOwnerManage);
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
$('communityChatInput').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();$('communityChatForm').requestSubmit();}});
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
