// ==========================================
// 0. 安全性檢查
// ==========================================
if (localStorage.getItem('isLoggedIn') !== 'true') {
    window.location.href = 'login.html';
}

// ==========================================
// 1. 全域變數
// ==========================================
const track = document.getElementById('track');
const topBar = document.getElementById('topBar');
const bottomBar = document.getElementById('bottomBar');
const card = document.querySelector('.card');

let isVIP = localStorage.getItem('isVIP') === 'true';
let db;
const DB_NAME = 'GourmetApp_Final_v18';
const STORE_PHOTOS = 'photos';
const STORE_POSTS = 'posts';
const DB_VERSION = 1;

// 頁面索引：0=Memory, 1=Home, 2=Community
let currentPage = 1; 
let startX = 0, startTranslate = -33.333, isDragging = false;
let displayDate = new Date();

// 編輯器暫存
let currentEditFiles = [];
let currentEditLocation = null;
let currentEditTagged = false;
let isMultiSelectMode = false;
let finalFiles = [];

// ==========================================
// 2. 資料庫初始化 & 載入最新照片
// ==========================================
function initDB() {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
        db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_PHOTOS)) db.createObjectStore(STORE_PHOTOS, { keyPath: 'id', autoIncrement: true });
        if (!db.objectStoreNames.contains(STORE_POSTS)) db.createObjectStore(STORE_POSTS, { keyPath: 'id', autoIncrement: true });
    };
    request.onsuccess = (e) => {
        db = e.target.result;
        updateVipUI();
        
        // 🔥 關鍵修復：資料庫連線成功後，立刻載入資料
        loadLatestPhoto(); // 1. 幫主畫面卡片換圖
        renderCalendar();  // 2. 畫回憶頁面的日曆
        renderCommunity(); // 3. 畫社群頁面的貼文
    };
}
initDB();

// 🔥 新增函式：載入最新照片到主畫面
function loadLatestPhoto() {
    const tx = db.transaction([STORE_PHOTOS], 'readonly');
    const req = tx.objectStore(STORE_PHOTOS).getAll();
    req.onsuccess = (e) => {
        const photos = e.target.result;
        if (photos && photos.length > 0) {
            // 找出最新的一張 (timestamp 最大)
            photos.sort((a, b) => b.timestamp - a.timestamp);
            const latest = photos[0];
            if (card && latest.imageBlob) {
                card.style.backgroundImage = `url('${URL.createObjectURL(latest.imageBlob)}')`;
            }
        }
    };
}

function updateVipUI() {
    const bell = document.getElementById('vipBellIcon');
    const statusText = document.getElementById('vipStatusText');
    if (isVIP) {
        if(bell) bell.classList.add('active');
        if(statusText) statusText.textContent = "Premium";
    } else {
        if(bell) bell.classList.remove('active');
        if(statusText) statusText.textContent = "Free";
    }
}

// ==========================================
// 3. 載入外部頁面 (Memory/Community)
// ==========================================
async function loadExternalPages() {
    try {
        // 載入回憶頁面 HTML
        const memoryRes = await fetch('memory.html');
        if (memoryRes.ok) {
            const memoryContainer = document.getElementById('page-memory');
            // 我們把內容包在一個固定容器裡，防止跑版
            memoryContainer.innerHTML = `
                <div class="calendar-wrapper">
                    ${await memoryRes.text()}
                </div>
            `;
            if(db) renderCalendar();
        }
        
        // 社群頁面已經直接寫在 home.html 裡了，所以不需要 fetch community.html
        // 只要確保資料庫連線後執行 renderCommunity() 即可

    } catch(e) {
        console.error("載入頁面錯誤:", e);
    }
}
loadExternalPages();

// ==========================================
// 4. 滑動邏輯 (修正版)
// ==========================================
let isHorizontalMove = false;
let startY = 0;

track.addEventListener('mousedown', startDrag);
track.addEventListener('touchstart', startDrag);

function startDrag(e) {
    // 如果在社群或留言板內滑動，不要觸發換頁
    if (e.target.closest('.feed-carousel') || e.target.closest('.comment-sheet')) {
        isDragging = false; return;
    }
    isDragging = true; isHorizontalMove = false;
    startX = e.pageX || e.touches[0].clientX;
    startY = e.pageY || e.touches[0].clientY;
    
    // 重新計算當前偏移量 (基於 300vw 的比例)
    // Page 0: 0%, Page 1: -33.33%, Page 2: -66.66%
    startTranslate = -currentPage * 33.3333;
    track.style.transition = 'none';
}

window.addEventListener('mousemove', moveDrag);
window.addEventListener('touchmove', moveDrag, {passive: false});

function moveDrag(e) {
    if(!isDragging) return;
    const x = e.pageX || e.touches[0].clientX;
    const y = e.pageY || e.touches[0].clientY;
    const deltaX = x - startX;
    const deltaY = y - startY;

    // 判斷是垂直捲動還是水平翻頁
    if (!isHorizontalMove) {
        if (Math.abs(deltaY) > Math.abs(deltaX)) {
            isDragging = false; // 判定為垂直捲動，取消翻頁
            return; 
        } else {
            isHorizontalMove = true; // 判定為水平翻頁
        }
    }

    if (isHorizontalMove) {
        if(e.cancelable) e.preventDefault();
        // 轉換像素為百分比 (基於視窗寬度)
        const percentageDelta = (deltaX / window.innerWidth) * 33.3333;
        track.style.transform = `translateX(${startTranslate + percentageDelta}%)`;
    }
}

window.addEventListener('mouseup', endDrag);
window.addEventListener('touchend', endDrag);

function endDrag(e) {
    if(!isDragging) return;
    isDragging = false;

    if (isHorizontalMove) {
        const endX = e.pageX || e.changedTouches[0].clientX;
        const diff = startX - endX;

        // 向左滑 (下一頁)
        if (diff > 50 && currentPage < 2) {
            // VIP 擋截
            if (currentPage === 1 && !isVIP) {
                alert("社群功能僅限 Premium 會員使用！\n請至個人頁面訂閱。");
            } else {
                currentPage++;
            }
        } 
        // 向右滑 (上一頁)
        else if (diff < -50 && currentPage > 0) {
            currentPage--;
        }
    }
    updateCarousel();
}

function updateCarousel() {
    track.style.transition = 'transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)';
    track.style.transform = `translateX(-${currentPage * 33.3333}%)`;
    
    // UI 顯示控制
    const pages = document.querySelectorAll('.page-container');
    pages.forEach((p, i) => {
        // 優化效能：只有當前頁面可以點擊
        p.style.pointerEvents = (i === currentPage) ? 'auto' : 'none';
    });

    const isHome = currentPage === 1;
    if(topBar) topBar.style.opacity = isHome ? 1 : 0;
    if(bottomBar) bottomBar.style.opacity = isHome ? 1 : 0;
    // 只有主頁才顯示日期
    const dateDisplay = document.getElementById('dateDisplay');
    if(dateDisplay) dateDisplay.style.opacity = isHome ? 1 : 0;
}

// ==========================================
// 5. 拍照與發布邏輯 (簡化整合)
// ==========================================
const publishBtn = document.getElementById('publishBtn');
if(publishBtn) {
    publishBtn.addEventListener('click', () => {
        if(finalFiles.length === 0) { alert("請先選擇照片！"); return; }

        const now = new Date();
        const todayStr = now.toISOString().split('T')[0];
        const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        const tx = db.transaction([STORE_PHOTOS, STORE_POSTS], 'readwrite');
        const memoryStore = tx.objectStore(STORE_PHOTOS);
        const postStore = tx.objectStore(STORE_POSTS);

        // 1. 存入回憶
        finalFiles.forEach((file, index) => {
            memoryStore.add({
                date: todayStr, time: timeStr, imageBlob: file, timestamp: now.getTime() + index
            });
        });

        // 2. 存入社群 (僅限 VIP)
        if(isVIP) {
            postStore.add({
                user: "My Account",
                avatar: "",
                location: currentEditLocation || "Unknown",
                images: finalFiles, 
                likes: 0,
                caption: currentEditTagged ? "With friends! ❤️" : "New post ✨",
                timestamp: now.getTime(),
                isVIP: true
            });
        }

        tx.oncomplete = () => {
            alert(isVIP ? "發佈成功！" : "已存入回憶！");
            document.getElementById('editorPage').classList.remove('active');
            
            // 更新所有畫面
            loadLatestPhoto();
            renderCalendar();
            if(isVIP) renderCommunity();
        };
    });
}

// ... (編輯器 UI 邏輯保持不變: multiPhotoInput, tagPeopleBtn, etc.) ...
// 為了節省篇幅，這裡省略編輯器 UI 綁定代碼，請保留您原本有的部分，
// 或是確認上一版提供的代碼中這部分是完整的。
// 重點是上面的 publishBtn 和 loadLatestPhoto 邏輯。

// ==========================================
// 6. 渲染社群 (假資料 + 真資料)
// ==========================================
function renderCommunity() {
    const container = document.getElementById('feedContainer');
    if(!container || !db) return;

    const tx = db.transaction([STORE_POSTS], 'readonly');
    const req = tx.objectStore(STORE_POSTS).getAll();

    req.onsuccess = (e) => {
        let posts = e.target.result;
        container.innerHTML = ''; 

        if(posts.length === 0) {
            posts = [
                { user: "Foodie_Alex", location: "Tokyo", likes: 120, caption: "Ramen! 🍜", fakeImage: "https://images.unsplash.com/photo-1569937724357-19506772436f?w=600&q=80" },
                { user: "Jessica", location: "Paris", likes: 85, caption: "Croissant 🥐", fakeImage: "https://images.unsplash.com/photo-1555507036-ab1f40388085?w=600&q=80" },
                { user: "CoffeeLover", location: "Taipei", likes: 200, caption: "Coffee ☕️", fakeImage: "https://images.unsplash.com/photo-1497935586351-b67a49e012bf?w=600&q=80" }
            ];
        } else {
            posts.sort((a,b) => b.timestamp - a.timestamp);
        }

        posts.forEach(post => {
            // 圖片處理邏輯
            const images = post.images || [post.imageBlob];
            let slidesHtml = '';
            if (post.fakeImage) {
                slidesHtml = `<div class="feed-image" style="background-image: url('${post.fakeImage}')"></div>`;
            } else if (images && images.length > 0) {
                images.forEach(blob => {
                    if(blob) slidesHtml += `<div class="feed-image" style="background-image: url('${URL.createObjectURL(blob)}')"></div>`;
                });
            }
            const counterHtml = (images.length > 1 && !post.fakeImage) ? `<div class="feed-counter">1/${images.length}</div>` : '';

            const card = document.createElement('div');
            card.className = 'feed-card';
            card.innerHTML = `
                <div class="feed-header">
                    <div class="feed-user-info">
                        <div class="feed-avatar"></div>
                        <div>
                            <div class="feed-username">${post.user} ${post.isVIP ? "<i class='bx bxs-bell-ring' style='color:#ED4956;font-size:14px;'></i>" : ""}</div>
                            <div class="feed-location">${post.location || 'Unknown'}</div>
                        </div>
                    </div>
                    <i class='bx bx-dots-horizontal-rounded' style="font-size:24px;"></i>
                </div>
                <div style="position: relative;">
                    <div class="feed-carousel" onscroll="updateCounter(this)">${slidesHtml}</div>
                    ${counterHtml}
                </div>
                <div class="feed-actions">
                    <svg class="action-icon like-btn" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
                    <svg class="action-icon comment-btn" viewBox="0 0 24 24"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
                    <i class='bx bx-send' style="font-size:26px; margin-left:auto;"></i>
                </div>
                <div class="feed-likes">Liked by <b>foodie</b> and <b>${(post.likes||0)+120} others</b></div>
                <div class="feed-caption"><span class="caption-username">${post.user}</span> ${post.caption||''}</div>
                <div class="view-comments">View all comments</div>
            `;
            
            card.querySelector('.like-btn').onclick = function() { this.classList.toggle('liked'); };
            container.appendChild(card);
        });
    };
}

// 輔助函式：更新計數器
window.updateCounter = function(carousel) {
    const width = carousel.offsetWidth;
    const idx = Math.round(carousel.scrollLeft / width) + 1;
    const counter = carousel.parentElement.querySelector('.feed-counter');
    if (counter) counter.textContent = `${idx}/${carousel.children.length}`;
};

function openCommentSheet(post) {
    let sheet = document.getElementById('commentSheet');
    if(!sheet) {
        sheet = document.createElement('div'); sheet.id = 'commentSheet'; sheet.className = 'comment-sheet';
        const bd = document.createElement('div'); bd.id = 'commentBackdrop';
        bd.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:500;opacity:0;pointer-events:none;transition:opacity 0.3s;';
        document.body.appendChild(bd);
        
        sheet.innerHTML = `
            <div class="comment-header">Comments <div class="close-comment-btn">&times;</div></div>
            <div class="comment-list" id="commentList"></div>
            <div class="comment-input-area">
                <div class="feed-avatar" style="width:32px;height:32px;margin-right:10px;"></div>
                <input type="text" class="comment-input" placeholder="Add a comment..." id="newCommentInput">
                <div class="comment-send-btn" onclick="window.sendComment()">Post</div>
            </div>
        `;
        document.body.appendChild(sheet);
        
        const close = () => { sheet.classList.remove('active'); bd.style.opacity='0'; bd.style.pointerEvents='none'; };
        sheet.querySelector('.close-comment-btn').onclick = close; bd.onclick = close;
    }

    const list = document.getElementById('commentList'); list.innerHTML = '';
    
    if(post.caption) {
        const item = document.createElement('div'); item.className='comment-item';
        item.innerHTML = `<div class="comment-avatar"></div><div class="comment-content"><span class="comment-user">${post.user}</span> ${post.caption}<div class="comment-time">1h</div></div>`;
        list.appendChild(item);
    }

    const bd = document.getElementById('commentBackdrop');
    setTimeout(() => { bd.style.opacity='1'; bd.style.pointerEvents='auto'; sheet.classList.add('active'); }, 10);
}

window.sendComment = function() {
    const inp = document.getElementById('newCommentInput');
    const list = document.getElementById('commentList');
    if(inp && inp.value.trim() !== '') {
        const item = document.createElement('div'); item.className='comment-item';
        item.innerHTML = `<div class="comment-avatar"></div><div class="comment-content"><span class="comment-user">Me</span> ${inp.value}<div class="comment-time">Just now</div></div>`;
        list.appendChild(item); inp.value=''; list.scrollTop = list.scrollHeight;
    }
};

// ==========================================
// 7. 回憶與日曆邏輯 (Memory & Calendar)
// ==========================================
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

function openStoryMode(dateStr, photos) {
    let page = document.getElementById('storyPage');
    if(!page) {
        page = document.createElement('div'); page.id = 'storyPage';
        Object.assign(page.style, { position:'fixed', top:'0', left:'0', width:'100%', height:'100%', backgroundColor:'#000', zIndex:'9999', transform:'translateY(100%)', transition:'transform 0.3s cubic-bezier(0.4,0,0.2,1)', display:'flex', flexDirection:'column' });
        page.innerHTML = `<div id="storyContent" style="width:100%; height:100%; position:relative;"></div><div id="storyProgressBar" class="story-progress-bar"></div>`;
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

function closeSheet() {
    if(actionSheet && backdrop) {
        actionSheet.style.transform = 'translateY(100%)';
        backdrop.classList.remove('active');
    }
}
const backdrop = document.getElementById('backdrop');
const actionSheet = document.getElementById('actionSheet');

if(shutterBtn) shutterBtn.addEventListener('click', () => {
    actionSheet.style.transform = 'translateY(0)';
    backdrop.classList.add('active');
});
if(backdrop) backdrop.addEventListener('click', closeSheet);

const camInput = document.getElementById('cameraInput');
const albInput = document.getElementById('albumInput');
if(document.getElementById('takePhotoBtn')) document.getElementById('takePhotoBtn').onclick = () => { closeSheet(); setTimeout(() => camInput.click(), 100); };
if(document.getElementById('chooseAlbumBtn')) document.getElementById('chooseAlbumBtn').onclick = () => { closeSheet(); setTimeout(() => albInput.click(), 100); };

if(camInput) camInput.onchange = (e) => simpleSave(e.target.files);
if(albInput) albInput.onchange = (e) => simpleSave(e.target.files);

function simpleSave(files) {
    if(!files.length) return;
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const tx = db.transaction([STORE_PHOTOS], 'readwrite');
    Array.from(files).forEach((f, i) => {
        tx.objectStore(STORE_PHOTOS).add({
            date: today, time: new Date().toLocaleTimeString(), imageBlob: f, timestamp: now.getTime() + i
        });
    });
    tx.oncomplete = () => {
        if(card) card.style.backgroundImage = `url('${URL.createObjectURL(files[0])}')`;
        renderCalendar();
        alert("照片已存入回憶！");
    };
}

// ==========================================
// 8. 滑動邏輯與頁面切換
// ==========================================
let startY = 0; 
let isHorizontalMove = false;

track.addEventListener('mousedown', startDrag);
track.addEventListener('touchstart', startDrag);

function startDrag(e) { 
    if (e.target.closest('.feed-carousel') || e.target.closest('.comment-sheet')) {
        isDragging = false; return;
    }
    isDragging = true; isHorizontalMove = false; 
    startX = e.pageX || e.touches[0].clientX; 
    startY = e.pageY || e.touches[0].clientY;
    startTranslate = -currentPage * 33.333; 
    track.style.transition = 'none';
}

window.addEventListener('mousemove', moveDrag);
window.addEventListener('touchmove', moveDrag, {passive: false});

function moveDrag(e) {
    if(!isDragging) return;
    const x = e.pageX || e.touches[0].clientX;
    const y = e.pageY || e.touches[0].clientY;
    const deltaX = x - startX;
    const deltaY = y - startY;

    if (!isHorizontalMove) {
        if (Math.abs(deltaY) > Math.abs(deltaX)) { isDragging = false; return; } 
        else { isHorizontalMove = true; }
    }

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
    
    if (isHorizontalMove) {
        const endX = e.pageX || e.changedTouches[0].clientX; 
        
        // 向左滑 (下一頁)
        if (startX - endX > 50 && currentPage < 2) {
            // 🔥 關鍵 VIP 擋下邏輯 🔥
            // 如果要進入社群頁 (Page 2) 且 不是 VIP
            if (currentPage === 1 && !isVIP) {
                alert("社群功能僅限 Premium 會員使用！\n請至個人頁面訂閱。");
                updateCarousel(); // 彈回原位
                return;
            }
            currentPage++;
        } 
        // 向右滑 (上一頁)
        else if (endX - startX > 50 && currentPage > 0) {
            currentPage--;
        }
        
        updateCarousel(); 
    } else {
        updateCarousel();
    }
}

function updateCarousel() {
    track.style.transition = 'transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)';
    track.style.transform = `translateX(-${currentPage * 33.333}%)`;
    const pages = document.querySelectorAll('.page-container');
    pages.forEach((p, i) => {
        p.style.visibility = (i===currentPage)?'visible':'hidden';
        p.style.pointerEvents = (i===currentPage)?'auto':'none';
    });
    const isHome = currentPage === 1;
    if(topBar) topBar.style.opacity = isHome ? 1 : 0;
    if(bottomBar) bottomBar.style.opacity = isHome ? 1 : 0;
}

// ==========================================
// 9. 全域按鈕事件 (Profile, Logout)
// ==========================================
if(document.getElementById('openProfileBtn')) document.getElementById('openProfileBtn').addEventListener('click', () => document.getElementById('profilePage').classList.add('active'));
if(document.getElementById('closeProfileBtn')) document.getElementById('closeProfileBtn').addEventListener('click', () => document.getElementById('profilePage').classList.remove('active'));

if(document.querySelector('.logout-btn')) document.querySelector('.logout-btn').addEventListener('click', () => {
    localStorage.removeItem('isLoggedIn');
    // localStorage.removeItem('isVIP'); // 可選：保留 VIP 狀態
    window.location.href = 'login.html';
});
