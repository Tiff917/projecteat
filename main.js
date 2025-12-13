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
const multiPhotoInput = document.getElementById('multiPhotoInput'); 
const editorPreview = document.getElementById('editorPreview');
const editorGrid = document.getElementById('editorGrid');
const tagPeopleBtn = document.getElementById('tagPeopleBtn');
const tagLocationBtn = document.getElementById('tagLocationBtn');
const publishBtn = document.getElementById('publishBtn');
const cancelEditBtn = document.getElementById('cancelEditBtn');

// A. 開啟編輯器 (直接進入，不跳彈窗)
if(editBtn) {
    editBtn.addEventListener('click', () => {
        // 1. 重置變數
        currentEditFiles = [];
        currentEditLocation = null;
        currentEditTagged = false;
        
        // 2. 重置 UI 狀態
        if(tagLocationBtn) tagLocationBtn.querySelector('#locationText').textContent = "";
        if(tagPeopleBtn) tagPeopleBtn.classList.remove('active');
        if(tagLocationBtn) tagLocationBtn.classList.remove('active');
        
        // 3. 重置預覽區 (顯示空白或提示)
        editorPreview.innerHTML = `<div class="preview-placeholder">Select photos from gallery below</div>`;
        editorPreview.style.backgroundImage = 'none';

        // 4. 重置下方圖庫 (顯示 "開啟相簿" 按鈕)
        renderInitialGrid();

        // 5. 直接滑出頁面
        editorPage.classList.add('active');
    });
}

// 輔助：渲染初始狀態 (只有一顆加號按鈕)
function renderInitialGrid() {
    editorGrid.innerHTML = '';
    
    // 建立 "開啟相簿" 按鈕
    const addBtn = document.createElement('div');
    addBtn.className = 'gallery-add-btn';
    addBtn.innerHTML = `
        <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
        Open
    `;
    // 點擊這個按鈕，才觸發手機相簿
    addBtn.onclick = () => multiPhotoInput.click();
    
    editorGrid.appendChild(addBtn);

    // 補幾個灰色空格子裝飾 (讓它看起來像還沒載入)
    for(let i=0; i<7; i++) {
        const dummy = document.createElement('div');
        dummy.className = 'gallery-item';
        dummy.style.backgroundColor = '#f5f5f5';
        dummy.style.cursor = 'default';
        editorGrid.appendChild(dummy);
    }
}

// B. 選圖後顯示 (當使用者真的選了照片)
if(multiPhotoInput) {
    multiPhotoInput.addEventListener('change', (e) => {
        if(e.target.files.length > 0) {
            currentEditFiles = Array.from(e.target.files);
            renderEditorPreview();
        }
    });
}

// 渲染選中的照片
function renderEditorPreview() {
    if(currentEditFiles.length === 0) return;
    
    // 1. 設定大圖
    const firstUrl = URL.createObjectURL(currentEditFiles[0]);
    editorPreview.innerHTML = ''; // 清掉提示文字
    editorPreview.style.backgroundImage = `url('${firstUrl}')`;
    
    // 2. 更新下方格子
    editorGrid.innerHTML = '';
    
    // 第一格還是保留 "加號" (如果要讓使用者加選，或是重新選)
    const addBtn = document.createElement('div');
    addBtn.className = 'gallery-add-btn';
    addBtn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>`;
    addBtn.onclick = () => multiPhotoInput.click();
    editorGrid.appendChild(addBtn);

    // 列出所有選中的照片
    currentEditFiles.forEach(file => {
        const div = document.createElement('div');
        div.className = 'gallery-item';
        const url = URL.createObjectURL(file);
        div.style.backgroundImage = `url('${url}')`;
        // 點擊切換大圖
        div.onclick = () => editorPreview.style.backgroundImage = `url('${url}')`;
        editorGrid.appendChild(div);
    });
}

// C. 標註朋友 (VIP 檢查)
if(tagPeopleBtn) {
    tagPeopleBtn.addEventListener('click', () => {
        if(isVIP) {
            currentEditTagged = !currentEditTagged;
            tagPeopleBtn.classList.toggle('active', currentEditTagged);
            alert(currentEditTagged ? "已標註朋友！" : "取消標註");
        } else {
            alert("🔒 這是付費會員專屬功能！");
        }
    });
}

// main.js (修改定位邏輯)

// D. 標註地點 (強制顯示 Kaohsiung)
if(tagLocationBtn) {
    tagLocationBtn.addEventListener('click', () => {
        // 1. 變更按鈕狀態為「啟用」
        tagLocationBtn.classList.add('active');
        const txt = document.getElementById('locationText');
        
        // 2. 顯示載入中...
        if(txt) txt.textContent = "Locating...";
        
        // 3. 模擬定位過程 (0.5秒後顯示高雄)
        setTimeout(() => {
            // 強制設定地點名稱
            const locationName = "Kaohsiung"; 
            
            // 寫入變數 (讓之後發文可以存到資料庫)
            currentEditLocation = locationName;
            
            // 更新畫面上看到的文字
            if(txt) txt.textContent = locationName;
            
            // 也可以選擇不要跳 alert，直接顯示就好，這樣比較順
            // alert(`定位成功：${locationName}`); 
        }, 500);
    });
}
// E. 關閉編輯器
if(cancelEditBtn) {
    cancelEditBtn.addEventListener('click', () => {
        editorPage.classList.remove('active');
    });
}

// F. 發佈貼文
if(publishBtn) {
    publishBtn.addEventListener('click', () => {
        if(currentEditFiles.length === 0) {
            alert("請先選擇照片！");
            return;
        }

        const now = new Date();
        const todayStr = now.toISOString().split('T')[0];
        const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        const tx = db.transaction([STORE_PHOTOS, STORE_POSTS], 'readwrite');
        const memoryStore = tx.objectStore(STORE_PHOTOS);
        const postStore = tx.objectStore(STORE_POSTS);

        // 存入 Memory
        currentEditFiles.forEach((file, index) => {
            memoryStore.add({
                date: todayStr,
                time: timeStr,
                imageBlob: file,
                timestamp: now.getTime() + index
            });
        });

        // 存入社群 (VIP)
        if(isVIP) {
            postStore.add({
                user: "My Account",
                avatar: "",
                location: currentEditLocation || "Unknown",
                imageBlob: currentEditFiles[0],
                likes: 0,
                caption: currentEditTagged ? "With friends! ❤️" : "New post ✨",
                timestamp: now.getTime(),
                isVIP: true
            });
        }

        tx.oncomplete = () => {
            alert("發佈成功！");
            editorPage.classList.remove('active');
            renderCalendar();
            if(isVIP) renderCommunity();
            // 更新首頁封面
            if(card && currentEditFiles.length > 0) {
                card.style.backgroundImage = `url('${URL.createObjectURL(currentEditFiles[0])}')`;
            }
        };
    });
}
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
// ==========================================
// 6. 滑動邏輯 (改良版：防誤觸、防亂滑)
// ==========================================
let startY = 0; // 新增 Y 軸紀錄
let isHorizontalMove = false; // 判斷是否為橫向滑動

track.addEventListener('mousedown', startDrag);
track.addEventListener('touchstart', startDrag);

function startDrag(e) { 
    isDragging = true; 
    isHorizontalMove = false; // 每次開始時重置判斷
    
    // 紀錄 X 和 Y 座標
    startX = e.pageX || e.touches[0].clientX; 
    startY = e.pageY || e.touches[0].clientY;
    
    startTranslate = -currentPage * 33.333; 
    track.style.transition = 'none';
}

window.addEventListener('mousemove', moveDrag);
window.addEventListener('touchmove', moveDrag, {passive: false}); // passive: false 才能擋住預設捲動

function moveDrag(e) {
    if(!isDragging) return;
    
    const x = e.pageX || e.touches[0].clientX;
    const y = e.pageY || e.touches[0].clientY;
    
    const deltaX = x - startX;
    const deltaY = y - startY;

    // ⚠️ 關鍵邏輯：判斷使用者的意圖
    // 如果還沒決定方向，且手指已經移動了一點距離
    if (!isHorizontalMove) {
        // 如果「上下移動」大於「左右移動」，代表使用者想捲動貼文
        if (Math.abs(deltaY) > Math.abs(deltaX)) {
            isDragging = false; // 放棄輪播拖曳
            return; // 讓瀏覽器執行原本的上下捲動
        } else {
            // 否則，認定為左右滑動 (切換頁面)
            isHorizontalMove = true;
        }
    }

    // 如果確定是左右滑，才執行 transform，並阻止瀏覽器捲動
    if (isHorizontalMove) {
        if(e.cancelable) e.preventDefault(); 
        track.style.transform = `translateX(${startTranslate + (deltaX/window.innerWidth)*33.333}%)`;
    }
}

window.addEventListener('mouseup', endDrag);
window.addEventListener('touchend', endDrag);

function endDrag(e) { 
    if(!isDragging) return; 
    isDragging = false; 
    
    // 只有在確認是橫向移動時，才判斷是否翻頁
    if (isHorizontalMove) {
        const endX = e.pageX || e.changedTouches[0].clientX; 
        // 滑動距離超過 50px 才翻頁
        if (endX - startX > 50 && currentPage > 0) currentPage--; 
        else if (startX - endX > 50 && currentPage < 2) currentPage++; 
        
        updateCarousel(); 
    } else {
        // 如果只是輕輕點一下，或是滑動判定失敗，也要歸位
        updateCarousel();
    }
}

function updateCarousel() {
    track.style.transition = 'transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)';
    track.style.transform = `translateX(-${currentPage * 33.333}%)`;
    
    // 頁面隱藏邏輯 (防遮擋)
    const pages = document.querySelectorAll('.page-container');
    pages.forEach((p, i) => {
        if(i === currentPage) {
            p.style.visibility = 'visible';
            p.style.pointerEvents = 'auto';
        } else {
            p.style.visibility = 'hidden'; // 關鍵：隱藏隔壁頁面
            p.style.pointerEvents = 'none';
        }
    });

    const isHome = currentPage === 1;
    if(topBar) topBar.style.opacity = isHome ? 1 : 0;
    if(bottomBar) bottomBar.style.opacity = isHome ? 1 : 0;
}
