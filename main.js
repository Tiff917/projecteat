// ==========================================
// 0. 安全性與全域變數
// ==========================================
if (localStorage.getItem('isLoggedIn') !== 'true') {
    // 若沒登入可以導回 login.html，這邊先註解方便測試
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

let currentPage = 1; // 0: Memory, 1: Home, 2: Community
let startX = 0, startTranslate = -33.3333, isDragging = false, isHorizontalMove = false;
let displayDate = new Date();
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

// 載入外部頁面 (Memory)
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
// 2. 滑動邏輯 (Carousel)
// ==========================================
track.addEventListener('mousedown', startDrag);
track.addEventListener('touchstart', startDrag);

function startDrag(e) {
    if (e.target.closest('.comment-sheet')) return; // 留言板內不滑動
    isDragging = true;
    isHorizontalMove = false;
    startX = e.pageX || e.touches[0].clientX;
    const startY = e.pageY || e.touches[0].clientY;
    
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
    const deltaY = y - (e.pageY || e.touches[0].clientY);

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
        const percentMove = (deltaX / window.innerWidth) * 33.3333;
        track.style.transform = `translateX(${startTranslate + percentMove}%)`;
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
            if (currentPage === 1 && !isVIP) {
                alert("社群為 VIP 功能！");
            } else {
                currentPage++;
            }
        } 
        else if (diff < -50 && currentPage > 0) {
            currentPage--;
        }
    }
    updateCarousel();
}

function updateCarousel() {
    track.style.transition = 'transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)';
    track.style.transform = `translateX(-${currentPage * 33.3333}%)`;
    
    const isHome = currentPage === 1;
    if(topBar) topBar.style.opacity = isHome ? 1 : 0;
    if(bottomBar) bottomBar.style.opacity = isHome ? 1 : 0;
    
    document.querySelectorAll('.page-container').forEach((p,i) => {
        p.style.pointerEvents = (i === currentPage) ? 'auto' : 'none';
    });
}

// 強制初始化對齊
setTimeout(updateCarousel, 100);

// ==========================================
// 3. 按鍵功能 (Search, Message, Profile, Edit)
// ==========================================

// Search (左下)
const searchBtn = document.getElementById('searchBtn');
if(searchBtn) {
    searchBtn.addEventListener('click', () => {
        window.location.href = 'search.html';
    });
}

// Message (右上)
const msgBtn = document.getElementById('openMessageBtn');
const msgPage = document.getElementById('messagePage');
const closeMsgBtn = document.getElementById('closeMessageBtn');
if(msgBtn && msgPage) {
    msgBtn.addEventListener('click', () => {
        msgPage.classList.add('active');
    });
    closeMsgBtn.addEventListener('click', () => {
        msgPage.classList.remove('active');
    });
}

// Profile (左上)
const profileBtn = document.getElementById('openProfileBtn');
const profilePage = document.getElementById('profilePage');
const closeProfileBtn = document.getElementById('closeProfileBtn');
if(profileBtn && profilePage) {
    profileBtn.addEventListener('click', () => {
        profilePage.classList.add('active');
    });
    closeProfileBtn.addEventListener('click', () => {
        profilePage.classList.remove('active');
    });
}

// Editor (右下)
const editBtn = document.getElementById('editBtn');
if(editBtn) editBtn.onclick = () => document.getElementById('editorPage').classList.add('active');
document.getElementById('closeEditorBtn').onclick = () => document.getElementById('editorPage').classList.remove('active');

// Shutter (中間) - 開啟 Action Sheet
const shutterBtn = document.getElementById('shutterBtn');
const actionSheet = document.getElementById('actionSheet');
const backdrop = document.getElementById('backdrop');
if(shutterBtn) {
    shutterBtn.onclick = () => {
        actionSheet.classList.add('active');
        backdrop.classList.add('active');
    };
    backdrop.onclick = () => {
        actionSheet.classList.remove('active');
        backdrop.classList.remove('active');
    };
}

// ==========================================
// 4. 發布與社群邏輯
// ==========================================
const publishBtn = document.getElementById('publishBtn');
if(publishBtn) publishBtn.addEventListener('click', () => {
    if(finalFiles.length===0) { alert("無照片"); return; }
    
    const tx = db.transaction([STORE_PHOTOS, STORE_POSTS], 'readwrite');
    finalFiles.forEach((f,i) => {
        tx.objectStore(STORE_PHOTOS).add({
            date: new Date().toISOString().split('T')[0],
            imageBlob: f, timestamp: Date.now()+i
        });
    });
    
    if(isVIP) {
        tx.objectStore(STORE_POSTS).add({
            user: "Me", location: "Taiwan", images: finalFiles, likes: 0, caption: "New post!", isVIP: true, timestamp: Date.now()
        });
    }
    
    tx.oncomplete = () => {
        alert("Published!");
        document.getElementById('editorPage').classList.remove('active');
        loadLatestPhoto(); renderCalendar(); if(isVIP) renderCommunity();
    };
});

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

// 相簿選擇
const multiInput = document.getElementById('multiPhotoInput');
if(multiInput) multiInput.onchange = (e) => {
    finalFiles = Array.from(e.target.files);
    const preview = document.getElementById('editorPreview');
    if(finalFiles.length>0) {
        const url = URL.createObjectURL(finalFiles[0]);
        preview.style.backgroundImage = `url('${url}')`;
        preview.innerHTML = '';
    }
};
document.querySelector('.logout-btn').onclick = () => {
    localStorage.removeItem('isLoggedIn'); window.location.href = 'login.html';
};
