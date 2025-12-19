// ==========================================
// 0. 安全性與全域變數
// ==========================================
if (localStorage.getItem('isLoggedIn') !== 'true') {
    // window.location.href = 'login.html'; 
}

const track = document.getElementById('track');
const topBar = document.getElementById('topBar');
const bottomBar = document.getElementById('bottomBar');
const card = document.querySelector('.card');

let isVIP = localStorage.getItem('isVIP') === 'true';
let db;
const DB_NAME = 'GourmetApp_Final';
const STORE_PHOTOS = 'photos';
const STORE_POSTS = 'posts';

// 頁面變數
let currentPage = 1; 
let startX = 0, startTranslate = 0, isDragging = false, isHorizontalMove = false;
let displayDate = new Date(); // 控制日曆顯示的月份
let finalFiles = [];

// ==========================================
// 1. 資料庫與初始化
// ==========================================
function initDB() {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = (e) => {
        db = e.target.result;
        if(!db.objectStoreNames.contains(STORE_PHOTOS)) db.createObjectStore(STORE_PHOTOS, {keyPath:'id', autoIncrement:true});
        if(!db.objectStoreNames.contains(STORE_POSTS)) db.createObjectStore(STORE_POSTS, {keyPath:'id', autoIncrement:true});
    };
    request.onsuccess = (e) => {
        db = e.target.result;
        updateVipUI();
        loadLatestPhoto();
        renderCalendar(); // 🔥 啟動日曆
        renderCommunity();
    };
}
initDB();

function updateVipUI() {
    const statusText = document.getElementById('vipStatusText');
    const bell = document.getElementById('vipBellIcon');
    if(statusText) statusText.textContent = isVIP ? "Premium" : "Free";
    if(bell && isVIP) bell.classList.add('active');
}

function loadLatestPhoto() {
    const tx = db.transaction([STORE_PHOTOS], 'readonly');
    const req = tx.objectStore(STORE_PHOTOS).getAll();
    req.onsuccess = (e) => {
        const photos = e.target.result;
        if(photos.length > 0) {
            photos.sort((a,b)=>b.timestamp-a.timestamp);
            if(card) card.style.backgroundImage = `url('${URL.createObjectURL(photos[0].imageBlob)}')`;
        }
    };
}

async function loadExternalPages() {
    try {
        const res = await fetch('memory.html');
        if(res.ok) {
            // 將 memory.html 塞入容器
            document.getElementById('page-memory').innerHTML = res.ok ? await res.text() : '';
            if(db) renderCalendar();
        }
    } catch(e) {}
}
loadExternalPages();

// ==========================================
// 2. 🔥 日曆與 Story 模式邏輯 (核心功能)
// ==========================================

async function renderCalendar() {
    const container = document.getElementById('calendarDays');
    const title = document.getElementById('calendarMonth');
    if (!container || !title || !db) return;

    // 1. 撈出所有照片
    const tx = db.transaction([STORE_PHOTOS], 'readonly');
    const req = tx.objectStore(STORE_PHOTOS).getAll();

    req.onsuccess = (e) => {
        const allPhotos = e.target.result;
        
        // 2. 把照片按日期分組 {"2023-10-27": [photo1, photo2]}
        const grouped = {};
        allPhotos.forEach(p => {
            if(!grouped[p.date]) grouped[p.date] = [];
            grouped[p.date].push(p);
        });

        // 3. 計算日曆數據
        const year = displayDate.getFullYear();
        const month = displayDate.getMonth();
        const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        
        // 更新標題 (含切換按鈕)
        title.innerHTML = `
            <div class="calendar-controls">
                <button class="month-nav-btn" onclick="changeMonth(-1)">&lt;</button>
                <span>${monthNames[month]} ${year}</span>
                <button class="month-nav-btn" onclick="changeMonth(1)">&gt;</button>
            </div>
        `;

        container.innerHTML = ''; // 清空格子

        // 計算空白格與天數
        const firstDay = new Date(year, month, 1).getDay(); // 當月1號是星期幾
        const daysInMonth = new Date(year, month + 1, 0).getDate(); // 當月有幾天

        // 填補空白格
        for(let i=0; i<firstDay; i++) {
            container.appendChild(document.createElement('div'));
        }

        // 填入日期
        for(let d=1; d<=daysInMonth; d++) {
            const cell = document.createElement('div');
            cell.className = 'day-cell';
            cell.textContent = d;
            
            // 格式化日期字串 YYYY-MM-DD
            const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
            
            // 如果這天有照片
            if(grouped[dateStr] && grouped[dateStr].length > 0) {
                cell.classList.add('has-photo');
                // 拿當天第一張照片當封面
                const coverPhoto = grouped[dateStr][0]; 
                cell.style.backgroundImage = `url('${URL.createObjectURL(coverPhoto.imageBlob)}')`;
                
                // 點擊進入 Story 模式
                cell.onclick = () => openStoryMode(grouped[dateStr]);
            }
            container.appendChild(cell);
        }
    };
}

// 切換月份函式
window.changeMonth = function(offset) {
    displayDate.setMonth(displayDate.getMonth() + offset);
    renderCalendar();
};

// --- Story Mode (限時動態播放器) ---
function openStoryMode(photos) {
    // 依時間排序
    photos.sort((a,b) => a.timestamp - b.timestamp);
    
    // 建立 Story 容器 (如果還沒有)
    let page = document.getElementById('storyPage');
    if(!page) {
        page = document.createElement('div');
        page.id = 'storyPage';
        document.body.appendChild(page);
    }

    let currentIndex = 0;

    // 渲染播放器 UI
    function renderViewer() {
        // 進度條 HTML
        let progressHtml = '';
        for(let i=0; i<photos.length; i++) {
            progressHtml += `<div class="progress-segment ${i <= currentIndex ? 'active' : ''}"></div>`;
        }

        const url = URL.createObjectURL(photos[currentIndex].imageBlob);

        page.innerHTML = `
            <div class="story-progress-bar">${progressHtml}</div>
            <div class="story-img-box" style="background-image: url('${url}')"></div>
            
            <div class="story-touch-left" id="storyPrev"></div>
            <div class="story-touch-right" id="storyNext"></div>
            
            <div style="position: absolute; top: 60px; right: 20px; color: white; font-size: 24px; z-index: 10001;" onclick="closeStory()">✕</div>
        `;

        // 綁定事件
        document.getElementById('storyPrev').onclick = (e) => { e.stopPropagation(); prevStory(); };
        document.getElementById('storyNext').onclick = (e) => { e.stopPropagation(); nextStory(); };
    }

    function nextStory() {
        if (currentIndex < photos.length - 1) {
            currentIndex++;
            renderViewer();
        } else {
            closeStory(); // 看完最後一張關閉
        }
    }

    function prevStory() {
        if (currentIndex > 0) {
            currentIndex--;
            renderViewer();
        }
    }

    window.closeStory = function() {
        page.style.transform = 'translateY(100%)';
    };

    // 啟動
    renderViewer();
    setTimeout(() => { page.style.transform = 'translateY(0)'; }, 10);
}


// ==========================================
// 3. 滑動邏輯 (Carousel)
// ==========================================
track.addEventListener('mousedown', startDrag);
track.addEventListener('touchstart', startDrag);

function startDrag(e) {
    if (e.target.closest('.comment-sheet') || e.target.closest('#storyPage')) return;
    isDragging = true;
    isHorizontalMove = false;
    startX = e.pageX || e.touches[0].clientX;
    const startY = e.pageY || e.touches[0].clientY;
    startTranslate = -currentPage * window.innerWidth;
    track.style.transition = 'none';
}

window.addEventListener('mousemove', moveDrag);
window.addEventListener('touchmove', moveDrag, {passive: false});

function moveDrag(e) {
    if(!isDragging) return;
    const x = e.pageX || e.touches[0].clientX;
    const y = e.pageY || e.touches[0].clientY;
    const deltaX = x - startX;
    const deltaY = y - (e.pageY || e.touches[0].clientY);

    if (!isHorizontalMove) {
        if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 10) {
            isHorizontalMove = true;
        } else if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 10) {
            isDragging = false; return;
        }
    }

    if (isHorizontalMove) {
        if(e.cancelable) e.preventDefault();
        track.style.transform = `translateX(${startTranslate + deltaX}px)`;
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
        if (diff > 50 && currentPage < 2) {
            if (currentPage === 1 && !isVIP) { alert("社群為 VIP 功能！"); } else { currentPage++; }
        } else if (diff < -50 && currentPage > 0) {
            currentPage--;
        }
    }
    updateCarousel();
}

function updateCarousel() {
    track.style.transition = 'transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)';
    track.style.transform = `translateX(-${currentPage * 100}vw)`;
    const isHome = currentPage === 1;
    if(topBar) topBar.style.opacity = isHome ? 1 : 0;
    if(bottomBar) bottomBar.style.opacity = isHome ? 1 : 0;
    document.querySelectorAll('.page-container').forEach((p,i) => {
        p.style.pointerEvents = (i === currentPage) ? 'auto' : 'none';
    });
}
setTimeout(updateCarousel, 50);

// ==========================================
// 4. 按鈕與發布功能
// ==========================================
// Search, Message, Profile
const searchBtn = document.getElementById('searchBtn');
if(searchBtn) searchBtn.onclick = () => window.location.href = 'search.html';

const msgBtn = document.getElementById('openMessageBtn');
const msgPage = document.getElementById('messagePage');
if(msgBtn && msgPage) {
    msgBtn.onclick = () => msgPage.classList.add('active');
    document.getElementById('closeMessageBtn').onclick = () => msgPage.classList.remove('active');
}

const profileBtn = document.getElementById('openProfileBtn');
const profilePage = document.getElementById('profilePage');
if(profileBtn && profilePage) {
    profileBtn.onclick = () => profilePage.classList.add('active');
    document.getElementById('closeProfileBtn').onclick = () => profilePage.classList.remove('active');
}

// Editor
const editBtn = document.getElementById('editBtn');
if(editBtn) editBtn.onclick = () => document.getElementById('editorPage').classList.add('active');
document.getElementById('closeEditorBtn').onclick = () => document.getElementById('editorPage').classList.remove('active');

const shutterBtn = document.getElementById('shutterBtn');
const actionSheet = document.getElementById('actionSheet');
const backdrop = document.getElementById('backdrop');
if(shutterBtn) {
    shutterBtn.onclick = () => { actionSheet.classList.add('active'); backdrop.classList.add('active'); };
    backdrop.onclick = () => { actionSheet.classList.remove('active'); backdrop.classList.remove('active'); };
}

// 發布 (同時寫入 Memory 和 社群)
const publishBtn = document.getElementById('publishBtn');
if(publishBtn) publishBtn.onclick = () => {
    if(finalFiles.length===0) { alert("無照片"); return; }
    
    const tx = db.transaction([STORE_PHOTOS, STORE_POSTS], 'readwrite');
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    
    finalFiles.forEach((f,i) => {
        // 存入回憶
        tx.objectStore(STORE_PHOTOS).add({
            date: today,
            imageBlob: f, 
            timestamp: now.getTime() + i
        });
    });
    
    if(isVIP) {
        // 存入社群
        tx.objectStore(STORE_POSTS).add({
            user: "Me", location: "Taiwan", 
            images: finalFiles, likes: 0, caption: "New post!", 
            isVIP: true, timestamp: now.getTime()
        });
    }
    
    tx.oncomplete = () => {
        alert("Published!");
        document.getElementById('editorPage').classList.remove('active');
        loadLatestPhoto(); 
        renderCalendar(); // 🔥 發布後立刻更新日曆
        if(isVIP) renderCommunity();
    };
};

function renderCommunity() {
    const container = document.getElementById('feedContainer');
    if(!container || !db) return;
    const req = db.transaction([STORE_POSTS], 'readonly').objectStore(STORE_POSTS).getAll();
    req.onsuccess = (e) => {
        let posts = e.target.result;
        container.innerHTML = '';
        if(posts.length === 0) posts = [{ user:"Foodie", location:"Tokyo", likes:99, caption:"Ramen!", fakeImage:"https://images.unsplash.com/photo-1569937724357-19506772436f?w=600&q=80" }];
        posts.sort((a,b)=>b.timestamp-a.timestamp);
        posts.forEach(post => {
            const card = document.createElement('div'); card.className = 'feed-card';
            let imgUrl = post.fakeImage || (post.images && post.images.length>0 ? URL.createObjectURL(post.images[0]) : '');
            card.innerHTML = `
                <div class="feed-header"><div class="feed-user-info"><div class="feed-avatar"></div><div class="feed-username">${post.user}</div></div></div>
                <div class="feed-image" style="background-image: url('${imgUrl}'); height:350px;"></div>
                <div class="feed-actions"><svg class="action-icon like-btn" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg></div>
                <div class="feed-caption"><b>${post.user}</b> ${post.caption}</div>`;
            card.querySelector('.like-btn').onclick = function(){ this.classList.toggle('liked'); };
            container.appendChild(card);
        });
    };
}

const multiInput = document.getElementById('multiPhotoInput');
if(multiInput) multiInput.onchange = (e) => {
    finalFiles = Array.from(e.target.files);
    const preview = document.getElementById('editorPreview');
    if(finalFiles.length>0) { const url = URL.createObjectURL(finalFiles[0]); preview.style.backgroundImage = `url('${url}')`; preview.innerHTML = ''; }
};
document.querySelector('.logout-btn').onclick = () => { localStorage.removeItem('isLoggedIn'); window.location.href = 'login.html'; };
