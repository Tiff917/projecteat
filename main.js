// ==========================================
// 0. 安全性與全域變數
// ==========================================
// 若沒登入可以導回 login.html (測試時可先註解)
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

// 頁面定義：0=Memory, 1=Home, 2=Community
let currentPage = 1; 
let startX = 0, startTranslate = 0, isDragging = false, isHorizontalMove = false;
let displayDate = new Date(); // 控制日曆顯示的月份
let finalFiles = []; // 暫存要發布的照片

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
        renderCalendar();
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
            document.getElementById('page-memory').innerHTML = `<div class="calendar-wrapper">${await res.text()}</div>`;
            if(db) renderCalendar();
        }
    } catch(e) {}
}
loadExternalPages();

// ==========================================
// 2. 日曆與 Story 模式邏輯
// ==========================================
async function renderCalendar() {
    const container = document.getElementById('calendarDays');
    const title = document.getElementById('calendarMonth');
    if (!container || !title || !db) return;

    const tx = db.transaction([STORE_PHOTOS], 'readonly');
    const req = tx.objectStore(STORE_PHOTOS).getAll();

    req.onsuccess = (e) => {
        const allPhotos = e.target.result;
        const grouped = {};
        allPhotos.forEach(p => {
            if(!grouped[p.date]) grouped[p.date] = [];
            grouped[p.date].push(p);
        });

        const year = displayDate.getFullYear();
        const month = displayDate.getMonth();
        const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        
        title.innerHTML = `
            <div class="calendar-controls">
                <button class="month-nav-btn" onclick="changeMonth(-1)">&lt;</button>
                <span>${monthNames[month]} ${year}</span>
                <button class="month-nav-btn" onclick="changeMonth(1)">&gt;</button>
            </div>
        `;

        container.innerHTML = ''; 
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        for(let i=0; i<firstDay; i++) container.appendChild(document.createElement('div'));

        for(let d=1; d<=daysInMonth; d++) {
            const cell = document.createElement('div');
            cell.className = 'day-cell';
            cell.textContent = d;
            const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
            
            if(grouped[dateStr] && grouped[dateStr].length > 0) {
                cell.classList.add('has-photo');
                const coverPhoto = grouped[dateStr][0]; 
                cell.style.backgroundImage = `url('${URL.createObjectURL(coverPhoto.imageBlob)}')`;
                cell.onclick = () => openStoryMode(grouped[dateStr]);
            }
            container.appendChild(cell);
        }
    };
}

window.changeMonth = function(offset) {
    displayDate.setMonth(displayDate.getMonth() + offset);
    renderCalendar();
};

function openStoryMode(photos) {
    photos.sort((a,b) => a.timestamp - b.timestamp);
    let page = document.getElementById('storyPage');
    if(!page) {
        page = document.createElement('div');
        page.id = 'storyPage';
        document.body.appendChild(page);
    }

    let currentIndex = 0;
    function renderViewer() {
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
        document.getElementById('storyPrev').onclick = (e) => { e.stopPropagation(); prevStory(); };
        document.getElementById('storyNext').onclick = (e) => { e.stopPropagation(); nextStory(); };
    }

    function nextStory() {
        if (currentIndex < photos.length - 1) { currentIndex++; renderViewer(); } else { closeStory(); }
    }
    function prevStory() {
        if (currentIndex > 0) { currentIndex--; renderViewer(); }
    }
    window.closeStory = function() { page.style.transform = 'translateY(100%)'; };
    
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
    
    // 使用像素計算，配合 CSS 的 300vw
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

    // 判斷水平滑動
    if (!isHorizontalMove) {
        if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 10) {
            isHorizontalMove = true;
        } else if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 10) {
            isDragging = false; 
            return;
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
        const threshold = 50;

        // 往左滑 (下一頁)
        if (diff > threshold && currentPage < 2) {
            if (currentPage === 1 && !isVIP) {
                alert("社群為 VIP 功能！");
            } else {
                currentPage++;
            }
        } 
        // 往右滑 (上一頁)
        else if (diff < -threshold && currentPage > 0) {
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
// 4. 按鈕與導覽 (Search, Message, Profile)
// ==========================================

// Search (左下)
const searchBtn = document.getElementById('searchBtn');
if(searchBtn) searchBtn.onclick = () => window.location.href = 'search.html';

// Message (右上)
const msgBtn = document.getElementById('openMessageBtn');
const msgPage = document.getElementById('messagePage');
if(msgBtn && msgPage) {
    msgBtn.onclick = () => msgPage.classList.add('active');
    document.getElementById('closeMessageBtn').onclick = () => msgPage.classList.remove('active');
}

// Profile (左上)
const profileBtn = document.getElementById('openProfileBtn');
const profilePage = document.getElementById('profilePage');
if(profileBtn && profilePage) {
    profileBtn.onclick = () => profilePage.classList.add('active');
    document.getElementById('closeProfileBtn').onclick = () => profilePage.classList.remove('active');
}

// Editor (右下)
const editBtn = document.getElementById('editBtn');
const editorPage = document.getElementById('editorPage');
if(editBtn && editorPage) {
    editBtn.onclick = () => editorPage.classList.add('active');
    document.getElementById('closeEditorBtn').onclick = () => editorPage.classList.remove('active');
}

// Logout (登出)
const logoutBtn = document.querySelector('.logout-btn');
if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('isLoggedIn');
        localStorage.removeItem('userEmail');
        window.location.href = 'login.html';
    });
}

// ==========================================
// 5. 快門與發布功能 (Shutter & Action Sheet)
// ==========================================

const shutterBtn = document.getElementById('shutterBtn');
const actionSheet = document.getElementById('actionSheet');
const backdrop = document.getElementById('backdrop');

// 顯示/隱藏 Action Sheet
if (shutterBtn && actionSheet && backdrop) {
    shutterBtn.onclick = () => { 
        actionSheet.classList.add('active'); 
        backdrop.classList.add('active'); 
    };
    
    backdrop.onclick = () => { 
        actionSheet.classList.remove('active'); 
        backdrop.classList.remove('active'); 
    };
}

// Action Sheet 選項綁定
const takePhotoBtn = document.getElementById('takePhotoBtn');
const chooseAlbumBtn = document.getElementById('chooseAlbumBtn');
const cameraInput = document.getElementById('cameraInput');
const multiInput = document.getElementById('multiPhotoInput');

// 點擊選項觸發隱藏的 input
if (takePhotoBtn && cameraInput) {
    takePhotoBtn.onclick = () => cameraInput.click();
}
if (chooseAlbumBtn && multiInput) {
    chooseAlbumBtn.onclick = () => multiInput.click();
}

// 統一處理檔案選擇 (拍照或相簿)
function handleFileSelect(e) {
    finalFiles = Array.from(e.target.files);
    if(finalFiles.length > 0) {
        // 關閉 Action Sheet
        if(actionSheet) actionSheet.classList.remove('active');
        if(backdrop) backdrop.classList.remove('active');
        
        // 打開編輯器並顯示預覽
        if(editorPage) editorPage.classList.add('active');
        const preview = document.getElementById('editorPreview');
        if(preview) {
            const url = URL.createObjectURL(finalFiles[0]);
            preview.style.backgroundImage = `url('${url}')`;
            preview.innerHTML = '';
        }
    }
}

// 綁定 input 變更事件
if(cameraInput) cameraInput.onchange = handleFileSelect;
if(multiInput) multiInput.onchange = handleFileSelect;


// 發布按鈕 (Publish)
const publishBtn = document.getElementById('publishBtn');
if(publishBtn) publishBtn.onclick = () => {
    if(finalFiles.length === 0) { alert("無照片"); return; }
    
    const tx = db.transaction([STORE_PHOTOS, STORE_POSTS], 'readwrite');
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    
    // 存入回憶
    finalFiles.forEach((f,i) => {
        tx.objectStore(STORE_PHOTOS).add({
            date: today,
            imageBlob: f, 
            timestamp: now.getTime() + i
        });
    });
    
    // 存入社群 (VIP Only)
    if(isVIP) {
        tx.objectStore(STORE_POSTS).add({
            user: "Me", location: "Taiwan", 
            images: finalFiles, likes: 0, caption: "New post!", 
            isVIP: true, timestamp: now.getTime()
        });
    }
    
    tx.oncomplete = () => {
        alert("Published!");
        if(editorPage) editorPage.classList.remove('active');
        loadLatestPhoto(); 
        renderCalendar(); 
        if(isVIP) renderCommunity();
    };
};

// ==========================================
// 6. 社群渲染
// ==========================================
function renderCommunity() {
    const container = document.getElementById('feedContainer');
    if(!container || !db) return;
    const req = db.transaction([STORE_POSTS], 'readonly').objectStore(STORE_POSTS).getAll();
    req.onsuccess = (e) => {
        let posts = e.target.result;
        container.innerHTML = '';
        if(posts.length === 0) {
            posts = [{ user:"Foodie", location:"Tokyo", likes:99, caption:"Ramen!", fakeImage:"https://images.unsplash.com/photo-1569937724357-19506772436f?w=600&q=80" }];
        }
        posts.sort((a,b)=>b.timestamp-a.timestamp);
        
        posts.forEach(post => {
            const card = document.createElement('div'); card.className = 'feed-card';
            let imgUrl = post.fakeImage || (post.images && post.images.length>0 ? URL.createObjectURL(post.images[0]) : '');
            
            card.innerHTML = `
                <div class="feed-header">
                    <div class="feed-user-info">
                        <div class="feed-avatar"></div>
                        <div class="feed-username">${post.user}</div>
                    </div>
                </div>
                <div class="feed-image" style="background-image: url('${imgUrl}'); height:350px;"></div>
                <div class="feed-actions">
                    <svg class="action-icon like-btn" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
                </div>
                <div class="feed-caption"><b>${post.user}</b> ${post.caption}</div>
            `;
            card.querySelector('.like-btn').onclick = function(){ this.classList.toggle('liked'); };
            container.appendChild(card);
        });
    };
}
