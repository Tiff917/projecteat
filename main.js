// ==========================================
// 1. 全域變數與設定
// ==========================================
const track = document.getElementById('track');
const topBar = document.getElementById('topBar');
const bottomBar = document.getElementById('bottomBar');
const card = document.querySelector('.card');

// 🔥 VIP 模擬開關 (改為 false 測試非會員)
const isVIP = true; 

// 資料庫設定 (V9: 新增 posts 倉庫)
let db;
const DB_NAME = 'GourmetApp_v9'; 
const STORE_PHOTOS = 'photos';
const STORE_POSTS = 'posts';
const DB_VERSION = 1;

let currentPage = 1; 
let startX = 0, currentTranslate = -33.333, isDragging = false, startTranslate = 0;
let displayDate = new Date();

// 編輯器暫存資料
let currentEditFiles = [];
let currentEditLocation = null;
let currentEditTagged = false;

// ==========================================
// 2. 初始化資料庫
// ==========================================
function initDB() {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
        db = e.target.result;
        // 倉庫 1: 個人回憶
        if (db.objectStoreNames.contains(STORE_PHOTOS)) db.deleteObjectStore(STORE_PHOTOS);
        db.createObjectStore(STORE_PHOTOS, { keyPath: 'id', autoIncrement: true });
        
        // 倉庫 2: 社群貼文 (VIP 專屬)
        if (db.objectStoreNames.contains(STORE_POSTS)) db.deleteObjectStore(STORE_POSTS);
        db.createObjectStore(STORE_POSTS, { keyPath: 'id', autoIncrement: true });
    };
    request.onsuccess = (e) => {
        db = e.target.result;
        console.log("資料庫就緒");
        renderCalendar();
        renderCommunity(); // 載入社群貼文
    };
}
initDB();

// ==========================================
// 3. 載入頁面與初始化
// ==========================================
async function loadExternalPages() {
    try {
        // Memory
        const memoryRes = await fetch('memory.html');
        if (memoryRes.ok) {
            document.getElementById('page-memory').innerHTML = await memoryRes.text();
            renderCalendar();
        }
        // Community (直接把 index.html 裡的模板塞進去)
        const feedTemplate = document.getElementById('communityTemplate');
        if (feedTemplate) {
            document.getElementById('page-community').innerHTML = feedTemplate.innerHTML;
            renderCommunity();
        }
    } catch(e) {}
}
loadExternalPages();

// ==========================================
// 4. 發文編輯器邏輯 (Editor)
// ==========================================
const editBtn = document.getElementById('editBtn');
const editorPage = document.getElementById('editorPage');
const multiPhotoInput = document.getElementById('multiPhotoInput'); // 借用原本的多選 input
const editorPreview = document.getElementById('editorPreview');
const editorGrid = document.getElementById('editorGrid');
const tagPeopleBtn = document.getElementById('tagPeopleBtn');
const tagLocationBtn = document.getElementById('tagLocationBtn');
const publishBtn = document.getElementById('publishBtn');
const cancelEditBtn = document.getElementById('cancelEditBtn');

// A. 開啟編輯器
if(editBtn) {
    editBtn.addEventListener('click', () => {
        // 先重置狀態
        currentEditFiles = [];
        currentEditLocation = null;
        currentEditTagged = false;
        tagLocationBtn.querySelector('#locationText').textContent = "";
        tagPeopleBtn.classList.remove('active');
        tagLocationBtn.classList.remove('active');
        
        // 開啟選圖
        setTimeout(() => {
            if(confirm("請選擇照片以開始編輯")) {
                multiPhotoInput.click();
            }
        }, 100);
    });
}

// B. 選圖後顯示
if(multiPhotoInput) {
    multiPhotoInput.addEventListener('change', (e) => {
        if(e.target.files.length > 0) {
            currentEditFiles = Array.from(e.target.files);
            editorPage.classList.add('active');
            renderEditorPreview();
        }
    });
}

function renderEditorPreview() {
    if(currentEditFiles.length === 0) return;
    
    // 大圖
    const firstUrl = URL.createObjectURL(currentEditFiles[0]);
    editorPreview.style.backgroundImage = `url('${firstUrl}')`;
    
    // 下方小圖網格
    editorGrid.innerHTML = '';
    currentEditFiles.forEach(file => {
        const div = document.createElement('div');
        div.className = 'gallery-item';
        const url = URL.createObjectURL(file);
        div.style.backgroundImage = `url('${url}')`;
        div.onclick = () => editorPreview.style.backgroundImage = `url('${url}')`;
        editorGrid.appendChild(div);
    });
}

// C. 標註朋友 (VIP 檢查)
tagPeopleBtn.addEventListener('click', () => {
    if(isVIP) {
        currentEditTagged = !currentEditTagged;
        tagPeopleBtn.classList.toggle('active', currentEditTagged);
        alert(currentEditTagged ? "已標註朋友！" : "取消標註");
    } else {
        alert("🔒 這是付費會員專屬功能！\n請升級以解鎖標註朋友與發佈到社群的功能。");
    }
});

// D. 標註地點 (PWA GPS)
tagLocationBtn.addEventListener('click', () => {
    if ("geolocation" in navigator) {
        tagLocationBtn.classList.add('active');
        document.getElementById('locationText').textContent = "Locating...";
        
        navigator.geolocation.getCurrentPosition((position) => {
            // 這裡抓到的是經緯度，實務上會接 Google Maps API 轉成地名
            // 這裡我們先模擬顯示一個地名
            const lat = position.coords.latitude.toFixed(2);
            const lng = position.coords.longitude.toFixed(2);
            currentEditLocation = `Taipei City (${lat}, ${lng})`;
            
            document.getElementById('locationText').textContent = "Taipei City"; // 簡化顯示
            alert(`已定位成功：${currentEditLocation}`);
        }, (error) => {
            alert("無法抓取位置，請確認已允許權限。");
            tagLocationBtn.classList.remove('active');
            document.getElementById('locationText').textContent = "";
        });
    } else {
        alert("您的瀏覽器不支援地理定位");
    }
});

// E. 關閉
cancelEditBtn.addEventListener('click', () => {
    editorPage.classList.remove('active');
});

// F. 發佈貼文 (核心邏輯)
publishBtn.addEventListener('click', () => {
    if(currentEditFiles.length === 0) return;

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // 1. 一律存入 Memory (個人回憶)
    const tx = db.transaction([STORE_PHOTOS, STORE_POSTS], 'readwrite');
    const memoryStore = tx.objectStore(STORE_PHOTOS);
    const postStore = tx.objectStore(STORE_POSTS);

    // 儲存照片到 Memory
    currentEditFiles.forEach((file, index) => {
        memoryStore.add({
            date: todayStr,
            time: timeStr,
            imageBlob: file,
            timestamp: now.getTime() + index
        });
    });

    // 2. 如果是 VIP，則發佈到社群
    if(isVIP) {
        // 建立一篇貼文物件
        const newPost = {
            user: "My Account",
            avatar: "", // 預設
            location: currentEditLocation || "Unknown Location",
            imageBlob: currentEditFiles[0], // 社群只顯示第一張當封面
            likes: 0,
            caption: currentEditTagged ? "With friends! ❤️" : "Just posted a photo.",
            timestamp: now.getTime(),
            isVIP: true
        };
        postStore.add(newPost);
    }

    tx.oncomplete = () => {
        alert(isVIP ? "發佈成功！已存入回憶並分享至社群。" : "已存入個人回憶！(升級會員可分享至社群)");
        editorPage.classList.remove('active');
        
        // 更新 UI
        renderCalendar();
        if(isVIP) renderCommunity();
        
        // 更新首頁卡片
        const firstUrl = URL.createObjectURL(currentEditFiles[0]);
        if(card) card.style.backgroundImage = `url('${firstUrl}')`;
    };
});

// ==========================================
// 5. 社群頁面渲染 (Community Feed)
// ==========================================
function renderCommunity() {
    const container = document.getElementById('feedContainer');
    if(!container || !db) return;

    const tx = db.transaction([STORE_POSTS], 'readonly');
    const store = tx.objectStore(STORE_POSTS);
    const req = store.getAll();

    req.onsuccess = (e) => {
        const posts = e.target.result;
        container.innerHTML = ''; // 清空

        if(posts.length === 0) {
            container.innerHTML = '<div class="loading-text" style="text-align:center; margin-top:50px;">No posts yet.<br>Become a VIP to share!</div>';
            return;
        }

        // 倒序排列 (最新的在上面)
        posts.sort((a,b) => b.timestamp - a.timestamp);

        posts.forEach(post => {
            const imgUrl = URL.createObjectURL(post.imageBlob);
            const card = document.createElement('div');
            card.className = 'feed-card';
            card.innerHTML = `
                <div class="feed-header">
                    <div class="feed-user-info">
                        <div class="feed-avatar"></div>
                        <div>
                            <div class="feed-username">${post.user} <span class="vip-badge">VIP</span></div>
                            <div class="feed-location">${post.location}</div>
                        </div>
                    </div>
                    <div style="font-weight:bold;">...</div>
                </div>
                <div class="feed-image" style="background-image: url('${imgUrl}')"></div>
                <div class="feed-actions">
                    <svg width="24" height="24" viewBox="0 0 24 24" stroke="black" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                    <svg width="24" height="24" viewBox="0 0 24 24" stroke="black" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
                </div>
                <div class="feed-likes">Liked by others</div>
                <div class="feed-caption">
                    <span style="font-weight:bold;">${post.user}</span> ${post.caption}
                </div>
            `;
            container.appendChild(card);
        });
    };
}

// ==========================================
// 6. 其他既有功能 (日曆、滑動、ActionSheet) - 保持不變
// ==========================================
// 日曆繪製 (Story Mode 整合版)
async function renderCalendar() {
    const container = document.getElementById('calendarDays');
    if (!container) return;
    const tx = db.transaction([STORE_PHOTOS], 'readonly');
    const req = tx.objectStore(STORE_PHOTOS).getAll();
    req.onsuccess = (e) => {
        const allPhotos = e.target.result;
        const grouped = {};
        allPhotos.forEach(p => { if(!grouped[p.date]) grouped[p.date]=[]; grouped[p.date].push(p); });

        container.innerHTML = '';
        const newContainer = container.cloneNode(true);
        container.parentNode.replaceChild(newContainer, container);
        const activeContainer = document.getElementById('calendarDays');

        const year = displayDate.getFullYear(), month = displayDate.getMonth();
        const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        
        if (!document.getElementById('calControls')) {
            const header = document.getElementById('calendarMonth').parentNode;
            const controls = document.createElement('div');
            controls.id = 'calControls'; controls.className = 'calendar-controls';
            controls.innerHTML = `<button class="month-nav-btn" id="prevMonthBtn">&lt;</button><span id="currentMonthLabel" style="font-size:18px;font-weight:600;">${monthNames[month]} ${year}</span><button class="month-nav-btn" id="nextMonthBtn">&gt;</button>`;
            document.getElementById('calendarMonth').style.display = 'none';
            header.appendChild(controls);
            document.getElementById('prevMonthBtn').onclick = () => changeMonth(-1);
            document.getElementById('nextMonthBtn').onclick = () => changeMonth(1);
        } else {
            document.getElementById('currentMonthLabel').textContent = `${monthNames[month]} ${year}`;
        }

        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        for(let i=0; i<firstDay; i++) activeContainer.appendChild(document.createElement('div'));
        for(let d=1; d<=daysInMonth; d++) {
            const cell = document.createElement('div'); cell.className = 'day-cell'; cell.textContent = d;
            const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
            if(grouped[dateStr] && grouped[dateStr].length > 0) {
                cell.classList.add('has-photo');
                const sorted = grouped[dateStr].sort((a,b) => b.timestamp - a.timestamp);
                cell.style.backgroundImage = `url('${URL.createObjectURL(sorted[0].imageBlob)}')`;
                cell.textContent = '';
                cell.dataset.date = dateStr;
            }
            activeContainer.appendChild(cell);
        }
        activeContainer.addEventListener('click', (e) => {
            const cell = e.target.closest('.day-cell');
            if(cell && cell.classList.contains('has-photo')) openStoryMode(cell.dataset.date, grouped[cell.dataset.date]);
        });
    };
}
function changeMonth(offset) { displayDate.setMonth(displayDate.getMonth() + offset); renderCalendar(); }

// Story Mode
function openStoryMode(dateStr, photos) {
    let page = document.getElementById('storyPage');
    if(!page) {
        page = document.createElement('div'); page.id = 'storyPage';
        Object.assign(page.style, { position:'fixed', top:'0', left:'0', width:'100%', height:'100%', backgroundColor:'#000', zIndex:'9999', transform:'translateY(100%)', transition:'transform 0.3s cubic-bezier(0.4,0,0.2,1)', display:'flex', flexDirection:'column' });
        page.innerHTML = `<div id="storyProgressBar" class="story-progress-bar"></div><div id="storyContent" style="width:100%; height:100%; position:relative;"></div>`;
        document.body.appendChild(page);
        
        let startY = 0;
        page.addEventListener('touchstart', (e)=>startY=e.touches[0].clientY, {passive:true});
        page.addEventListener('touchend', (e)=>{ if(e.changedTouches[0].clientY - startY > 80) page.style.transform='translateY(100%)'; });
    }
    
    photos.sort((a,b) => a.timestamp - b.timestamp);
    let idx = 0;
    const bar = document.getElementById('storyProgressBar');
    const player = document.getElementById('storyContent');
    
    bar.innerHTML = '';
    for(let i=0; i<photos.length; i++) {
        const seg = document.createElement('div'); seg.className='progress-segment'; bar.appendChild(seg);
    }
    const segs = bar.getElementsByClassName('progress-segment');
    function updateBar(c) {
        for(let i=0; i<segs.length; i++) segs[i].style.backgroundColor = i<=c ? (i==c?'rgba(255,255,255,1)':'rgba(255,255,255,1)') : 'rgba(255,255,255,0.3)';
    }

    function show() {
        if(idx>=photos.length) { page.style.transform='translateY(100%)'; return; }
        if(idx<0) idx=0;
        const url = URL.createObjectURL(photos[idx].imageBlob);
        player.innerHTML = `<div class="story-img-box" style="background-image:url('${url}'); width:100%; height:100%;"></div><div style="position:absolute;top:0;left:0;width:50%;height:100%;z-index:20;" onclick="event.stopPropagation(); window.storyPrev()"></div><div style="position:absolute;top:0;right:0;width:50%;height:100%;z-index:20;" onclick="event.stopPropagation(); window.storyNext()"></div>`;
        updateBar(idx);
    }
    window.storyPrev = () => { idx--; show(); };
    window.storyNext = () => { idx++; show(); };
    
    setTimeout(() => { page.style.transform='translateY(0)'; show(); }, 10);
}

// 互動與滑動
function closeSheet() {
    if(actionSheet && backdrop) {
        actionSheet.style.transition = 'transform 0.3s ease-out';
        actionSheet.style.transform = 'translateY(100%)';
        backdrop.classList.remove('active');
    }
}
if(shutterBtn) shutterBtn.addEventListener('click', () => {
    actionSheet.style.transition = 'transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)';
    actionSheet.style.transform = 'translateY(0)';
    backdrop.classList.add('active');
});
if(backdrop) backdrop.addEventListener('click', closeSheet);

// 拍照與相簿 (單純存 Memory)
if(takePhotoBtn && cameraInput) takePhotoBtn.addEventListener('click', () => { closeSheet(); setTimeout(() => cameraInput.click(), 100); });
if(cameraInput) cameraInput.addEventListener('change', (e) => simpleSave(e.target.files));
if(chooseAlbumBtn && albumInput) chooseAlbumBtn.addEventListener('click', () => { closeSheet(); setTimeout(() => albumInput.click(), 100); });
if(albumInput) albumInput.addEventListener('change', (e) => simpleSave(e.target.files));

function simpleSave(files) {
    if(!files.length) return;
    const now = new Date();
    const tx = db.transaction([STORE_PHOTOS], 'readwrite');
    Array.from(files).forEach((f, i) => {
        tx.objectStore(STORE_PHOTOS).add({
            date: now.toISOString().split('T')[0],
            time: now.toLocaleTimeString(),
            imageBlob: f,
            timestamp: now.getTime() + i
        });
    });
    tx.oncomplete = () => {
        if(card) card.style.backgroundImage = `url('${URL.createObjectURL(files[0])}')`;
        renderCalendar();
        alert("照片已存入回憶！");
    };
}

// 滑動
track.addEventListener('mousedown', startDrag);
track.addEventListener('touchstart', startDrag);
function startDrag(e) { isDragging=true; startX=e.pageX||e.touches[0].clientX; startTranslate=-currentPage*33.333; track.style.transition='none'; }
window.addEventListener('mousemove', moveDrag);
window.addEventListener('touchmove', moveDrag, {passive:false});
function moveDrag(e) { if(!isDragging)return; const delta=(e.pageX||e.touches[0].clientX)-startX; track.style.transform=`translateX(${startTranslate+(delta/window.innerWidth)*33.333}%)`; }
window.addEventListener('mouseup', endDrag);
window.addEventListener('touchend', endDrag);
function endDrag(e) { 
    if(!isDragging)return; isDragging=false; 
    const endX=e.pageX||e.changedTouches[0].clientX; 
    if(endX-startX>50 && currentPage>0) currentPage--; 
    else if(startX-endX>50 && currentPage<2) currentPage++; 
    updateCarousel(); 
}
function updateCarousel() {
    track.style.transition = 'transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)';
    track.style.transform = `translateX(-${currentPage * 33.333}%)`;
    const pages = document.querySelectorAll('.page-container');
    pages.forEach((p, i) => {
        p.style.visibility = (i===currentPage)?'visible':'hidden';
        p.style.pointerEvents = (i===currentPage)?'auto':'none';
    });
    const isHome = currentPage===1;
    if(topBar) topBar.style.opacity = isHome?1:0;
    if(bottomBar) bottomBar.style.opacity = isHome?1:0;
}
