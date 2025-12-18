// ==========================================
// 0. 安全性檢查 (必須放在最前面)
// ==========================================
if (localStorage.getItem('isLoggedIn') !== 'true') {
    window.location.href = 'login.html'; // 沒登入就踢回登入頁
}

// ==========================================
// 1. 全域變數與設定
// ==========================================
const track = document.getElementById('track');
const topBar = document.getElementById('topBar');
const bottomBar = document.getElementById('bottomBar');
const card = document.querySelector('.card');

// 讀取 VIP 狀態
let isVIP = localStorage.getItem('isVIP') === 'true';

// 資料庫設定
let db;
const DB_NAME = 'GourmetApp_Final_v18'; 
const STORE_PHOTOS = 'photos';
const STORE_POSTS = 'posts';
const DB_VERSION = 1;

let currentPage = 1; // 0: Memory, 1: Home, 2: Community
let startX = 0, currentTranslate = -33.333, isDragging = false, startTranslate = 0;
let displayDate = new Date();

let currentEditFiles = [];
let currentEditLocation = null;
let currentEditTagged = false;
let isMultiSelectMode = false; 

// ==========================================
// 2. 初始化資料庫與 UI
// ==========================================
function initDB() {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
        db = e.target.result;
        if (db.objectStoreNames.contains(STORE_PHOTOS)) db.deleteObjectStore(STORE_PHOTOS);
        db.createObjectStore(STORE_PHOTOS, { keyPath: 'id', autoIncrement: true });
        
        if (db.objectStoreNames.contains(STORE_POSTS)) db.deleteObjectStore(STORE_POSTS);
        db.createObjectStore(STORE_POSTS, { keyPath: 'id', autoIncrement: true });
    };
    request.onsuccess = (e) => {
        db = e.target.result;
        renderCalendar();
        renderCommunity();
        updateVipUI();
    };
}
initDB();

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
// 3. 載入頁面
// ==========================================
async function loadExternalPages() {
    try {
        // 1. 載入回憶頁面 (Memory)
        const memoryRes = await fetch('memory.html');
        if (memoryRes.ok) {
            document.getElementById('page-memory').innerHTML = await memoryRes.text();
            renderCalendar(); // 載入後畫日曆
        }

        // 2. 載入社群頁面 (Community) - 🔥 關鍵修復
        const communityRes = await fetch('community.html');
        if (communityRes.ok) {
            // 把 community.html 的內容塞進 page-community
            document.getElementById('page-community').innerHTML = await communityRes.text();
            
            console.log("Community Page Loaded!"); // 在 Console 顯示成功訊息
            
            // 🔥 HTML 塞進去後，立刻執行渲染 (畫出假貼文)
            renderCommunity(); 
        } else {
            console.error("找不到 community.html 檔案，請確認檔名是否正確");
        }

    } catch(e) {
        console.error("載入頁面發生錯誤:", e);
    }
}
// 執行載入
loadExternalPages();

// ==========================================
// 4. 付款與訂閱
// ==========================================
const subscriptionBtn = document.getElementById('subscriptionBtn');
const paymentModal = document.getElementById('paymentModal');
const closePaymentBtn = document.getElementById('closePaymentBtn');
const confirmPayBtn = document.getElementById('confirmPayBtn');

if(subscriptionBtn) {
    subscriptionBtn.addEventListener('click', () => {
        if(isVIP) {
            alert("您已經是尊榮 Premium 會員！");
        } else {
            document.getElementById('profilePage').classList.remove('active');
            paymentModal.classList.add('active');
        }
    });
}

if(closePaymentBtn) {
    closePaymentBtn.addEventListener('click', () => {
        paymentModal.classList.remove('active');
    });
}

if(confirmPayBtn) {
    confirmPayBtn.addEventListener('click', () => {
        const originalText = confirmPayBtn.textContent;
        confirmPayBtn.textContent = "Processing...";
        confirmPayBtn.style.backgroundColor = "#aaa";
        confirmPayBtn.style.pointerEvents = "none";

        setTimeout(() => {
            isVIP = true;
            localStorage.setItem('isVIP', 'true');
            updateVipUI();
            alert("付款成功！歡迎成為 Premium 會員 🎉");
            paymentModal.classList.remove('active');
            confirmPayBtn.textContent = originalText;
            confirmPayBtn.style.backgroundColor = "";
            confirmPayBtn.style.pointerEvents = "auto";
            renderCommunity();
        }, 1500);
    });
}

// ==========================================
// 5. 編輯器邏輯
// ==========================================
const editBtn = document.getElementById('editBtn');
const editorPage = document.getElementById('editorPage');
const multiPhotoInput = document.getElementById('multiPhotoInput'); 
const editorPreview = document.getElementById('editorPreview');
const editorGrid = document.getElementById('editorGrid');
const tagPeopleBtn = document.getElementById('tagPeopleBtn');
const tagLocationBtn = document.getElementById('tagLocationBtn');
const multiSelectBtn = document.getElementById('multiSelectBtn');
const publishBtn = document.getElementById('publishBtn');
const cancelEditBtn = document.getElementById('cancelEditBtn');

if(editBtn) {
    editBtn.addEventListener('click', () => {
        finalFiles = []; 
        currentEditLocation = null;
        currentEditTagged = false;
        isMultiSelectMode = false;
        
        if(multiSelectBtn) multiSelectBtn.classList.remove('active');
        if(tagLocationBtn) tagLocationBtn.querySelector('#locationText').textContent = "";
        if(tagPeopleBtn) tagPeopleBtn.classList.remove('active');
        if(tagLocationBtn) tagLocationBtn.classList.remove('active');
        
        editorPreview.innerHTML = `<div class="preview-placeholder">Select photos from gallery below</div>`;
        editorPreview.style.backgroundImage = 'none';

        renderEditorGrid();
        editorPage.classList.add('active');
    });
}

if(multiSelectBtn) {
    multiSelectBtn.addEventListener('click', () => {
        isMultiSelectMode = !isMultiSelectMode;
        if(isMultiSelectMode) multiSelectBtn.classList.add('active');
        else multiSelectBtn.classList.remove('active');
    });
}

// 暫存選取的檔案
let finalFiles = [];

function renderEditorGrid() {
    editorGrid.innerHTML = '';
    
    if(finalFiles.length > 0) {
        const lastFile = finalFiles[finalFiles.length - 1];
        editorPreview.innerHTML = '';
        editorPreview.style.backgroundImage = `url('${URL.createObjectURL(lastFile)}')`;
    } else {
        editorPreview.innerHTML = `<div class="preview-placeholder">Select photos from gallery below</div>`;
        editorPreview.style.backgroundImage = 'none';
    }

    const addBtn = document.createElement('div');
    addBtn.className = 'gallery-add-btn';
    addBtn.innerHTML = `
        <label for="multiPhotoInput" style="width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;">
            <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>Add
        </label>
    `;
    editorGrid.appendChild(addBtn);

    finalFiles.forEach(file => {
        const div = document.createElement('div');
        div.className = 'gallery-item';
        const url = URL.createObjectURL(file);
        div.style.backgroundImage = `url('${url}')`;
        div.onclick = () => editorPreview.style.backgroundImage = `url('${url}')`;
        editorGrid.appendChild(div);
    });

    for(let i=0; i< (7 - finalFiles.length); i++) {
        const dummy = document.createElement('div');
        dummy.className = 'gallery-item';
        dummy.style.backgroundColor = '#f5f5f5';
        editorGrid.appendChild(dummy);
    }
}

if(multiPhotoInput) {
    multiPhotoInput.addEventListener('change', (e) => {
        if(e.target.files.length > 0) {
            const newFiles = Array.from(e.target.files);
            if(isMultiSelectMode) finalFiles = [...finalFiles, ...newFiles];
            else finalFiles = newFiles;
            renderEditorGrid();
        }
        e.target.value = '';
    });
}

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

if(tagLocationBtn) {
    tagLocationBtn.addEventListener('click', () => {
        tagLocationBtn.classList.add('active');
        const txt = document.getElementById('locationText');
        if(txt) txt.textContent = "Locating...";
        setTimeout(() => {
            const locationName = "Kaohsiung"; 
            currentEditLocation = locationName;
            if(txt) txt.textContent = locationName;
        }, 500);
    });
}

if(cancelEditBtn) cancelEditBtn.addEventListener('click', () => editorPage.classList.remove('active'));

if(publishBtn) {
    publishBtn.addEventListener('click', () => {
        if(finalFiles.length === 0) {
            alert("請先選擇照片！");
            return;
        }

        const now = new Date();
        const todayStr = now.toISOString().split('T')[0];
        const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        const tx = db.transaction([STORE_PHOTOS, STORE_POSTS], 'readwrite');
        const memoryStore = tx.objectStore(STORE_PHOTOS);
        const postStore = tx.objectStore(STORE_POSTS);

        finalFiles.forEach((file, index) => {
            memoryStore.add({
                date: todayStr, time: timeStr, imageBlob: file, timestamp: now.getTime() + index
            });
        });

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
            alert(isVIP ? "發佈成功！" : "已存入回憶！(升級 VIP 可分享至社群)");
            editorPage.classList.remove('active');
            renderCalendar();
            if(isVIP) renderCommunity();
            if(card && finalFiles.length > 0) {
                card.style.backgroundImage = `url('${URL.createObjectURL(finalFiles[0])}')`;
            }
        };
    });
}

// ==========================================
// 6. 社群頁面
// ==========================================

// ==========================================
// 6. 社群頁面渲染 (仿 Instagram 風格)
// ==========================================
function renderCommunity() {
    const container = document.getElementById('feedContainer');
    if(!container || !db) return;

    const tx = db.transaction([STORE_POSTS], 'readonly');
    const req = tx.objectStore(STORE_POSTS).getAll();

    req.onsuccess = (e) => {
        const posts = e.target.result;
        container.innerHTML = ''; // 清空容器

        if(posts.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; margin-top: 100px; color: #8D6E63;">
                    <i class='bx bx-camera' style="font-size: 48px; margin-bottom: 10px;"></i><br>
                    No posts yet.<br>Become a VIP to share your moments!
                </div>`;
            return;
        }

        // 依照時間倒序排列 (最新的在最上面)
        posts.sort((a,b) => b.timestamp - a.timestamp);

        posts.forEach(post => {
            // 處理圖片 (單張或多張)
            const images = post.images || [post.imageBlob];
            let slidesHtml = '';
            
            if (images && images.length > 0) {
                images.forEach(blob => {
                    if(blob) {
                        const url = URL.createObjectURL(blob);
                        slidesHtml += `<div class="feed-image" style="background-image: url('${url}')"></div>`;
                    }
                });
            }

            // 多圖顯示計數器 (例如 1/3)
            const counterHtml = images.length > 1 
                ? `<div class="feed-counter">1/${images.length}</div>` 
                : '';

            // 建立卡片元素
            const card = document.createElement('div');
            card.className = 'feed-card';
            
            // 🔥 HTML 結構：仿 Instagram
            card.innerHTML = `
                <div class="feed-header">
                    <div class="feed-user-info">
                        <div class="feed-avatar"></div>
                        <div>
                            <div class="feed-username">
                                ${post.user} 
                                <i class='bx bxs-bell-ring' style="color: #ED4956; font-size: 14px;"></i>
                            </div>
                            <div class="feed-location">${post.location || 'Unknown Location'}</div>
                        </div>
                    </div>
                    <i class='bx bx-dots-horizontal-rounded' style="font-size: 24px; color: #333;"></i>
                </div>
                
                <div style="position: relative;">
                    <div class="feed-carousel" onscroll="updateCounter(this)">
                        ${slidesHtml}
                    </div>
                    ${counterHtml}
                </div>

                <div class="feed-actions">
                    <svg class="action-icon like-btn" viewBox="0 0 24 24">
                        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                    </svg>
                    
                    <svg class="action-icon comment-btn" viewBox="0 0 24 24">
                        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
                    </svg>
                    
                    <i class='bx bx-send' style="font-size: 26px; margin-left: auto;"></i>
                </div>

                <div class="feed-likes">
                    Liked by <b>craig_love</b> and <b>${(post.likes || 0) + 44686} others</b>
                </div>

                <div class="feed-caption">
                    <span class="caption-username">${post.user}</span> 
                    ${post.caption || ''}
                </div>
                
                <div class="view-comments">View all 12 comments</div>
            `;

            // 🔥 綁定愛心點擊事件
            const likeBtn = card.querySelector('.like-btn');
            likeBtn.addEventListener('click', function() {
                // 切換 liked class (CSS 會處理變紅與動畫)
                this.classList.toggle('liked');
            });

            // 綁定留言按鈕 (打開留言板)
            const commentBtns = card.querySelectorAll('.comment-btn, .view-comments');
            commentBtns.forEach(btn => btn.onclick = () => openCommentSheet(post));

            container.appendChild(card);
        });
    };
}

// 輔助函式：更新多圖計數器 (例如滑到第2張時變 2/3)
window.updateCounter = function(carousel) {
    const width = carousel.offsetWidth;
    const idx = Math.round(carousel.scrollLeft / width) + 1;
    const counter = carousel.parentElement.querySelector('.feed-counter');
    if (counter) {
        counter.textContent = `${idx}/${carousel.children.length}`;
    }
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

window.updateCounter = function(carousel) {
    const width = carousel.offsetWidth;
    const idx = Math.round(carousel.scrollLeft / width) + 1;
    const counter = carousel.parentElement.querySelector('.feed-counter');
    if (counter) counter.textContent = `${idx}/${carousel.children.length}`;
};

// ... (renderCalendar, openStoryMode 保持不變，篇幅原因省略，請確認檔案後段有保留) ...
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

// 🔥🔥 滑動邏輯與登出邏輯 🔥🔥

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

if(document.getElementById('openProfileBtn')) document.getElementById('openProfileBtn').addEventListener('click', () => document.getElementById('profilePage').classList.add('active'));
if(document.getElementById('closeProfileBtn')) document.getElementById('closeProfileBtn').addEventListener('click', () => document.getElementById('profilePage').classList.remove('active'));

// 🔥 登出按鈕：清除狀態並導向 login.html
if(document.querySelector('.logout-btn')) document.querySelector('.logout-btn').addEventListener('click', () => {
    localStorage.removeItem('isLoggedIn');
    // 如果想要登出後連 VIP 也重置，可以加下面這行：
    // localStorage.removeItem('isVIP'); 
    window.location.href = 'login.html';
});
