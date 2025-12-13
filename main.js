// ==========================================
// 1. 全域變數與設定
// ==========================================
const track = document.getElementById('track');
const topBar = document.getElementById('topBar');
const bottomBar = document.getElementById('bottomBar');
const card = document.querySelector('.card');

const isVIP = true; 

// 🔥 資料庫強制升級 v17 (確保可以存多圖)
let db;
const DB_NAME = 'GourmetApp_Final_v17'; 
const STORE_PHOTOS = 'photos';
const STORE_POSTS = 'posts';
const DB_VERSION = 1;

let currentPage = 1; 
let startX = 0, currentTranslate = -33.333, isDragging = false, startTranslate = 0;
let displayDate = new Date();

// 編輯器狀態
let finalFiles = []; // ⚠️ 累積選取的照片陣列
let currentEditLocation = null;
let currentEditTagged = false;
let isMultiSelectMode = false; // 多選開關

// ==========================================
// 2. 初始化資料庫
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
        console.log("資料庫連線成功 (v17)");
        renderCalendar();
        renderCommunity(); 
    };
}
initDB();

// ==========================================
// 3. 載入頁面
// ==========================================
async function loadExternalPages() {
    try {
        const memoryRes = await fetch('memory.html');
        if (memoryRes.ok) {
            document.getElementById('page-memory').innerHTML = await memoryRes.text();
            renderCalendar();
        }
        const feedTemplate = document.getElementById('communityTemplate');
        if (feedTemplate) {
            document.getElementById('page-community').innerHTML = feedTemplate.innerHTML;
            renderCommunity();
        }
    } catch(e) {}
}
loadExternalPages();

// ==========================================
// 4. 編輯器邏輯 (支援多選累加)
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

// A. 進入編輯器
if(editBtn) {
    editBtn.addEventListener('click', () => {
        // 重置狀態
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

// B. 多選開關
if(multiSelectBtn) {
    multiSelectBtn.addEventListener('click', () => {
        isMultiSelectMode = !isMultiSelectMode;
        if(isMultiSelectMode) multiSelectBtn.classList.add('active');
        else multiSelectBtn.classList.remove('active');
    });
}

// C. 渲染編輯器格子 (含 + 按鈕)
function renderEditorGrid() {
    editorGrid.innerHTML = '';
    
    // 如果有選圖，大圖顯示最後一張
    if(finalFiles.length > 0) {
        const lastFile = finalFiles[finalFiles.length - 1];
        editorPreview.innerHTML = '';
        editorPreview.style.backgroundImage = `url('${URL.createObjectURL(lastFile)}')`;
    }

    // 建立 "+" 按鈕 (使用 Label 觸發 Input)
    const addBtn = document.createElement('div');
    addBtn.className = 'gallery-add-btn';
    addBtn.innerHTML = `
        <label for="multiPhotoInput" style="width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;">
            <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>Add
        </label>
    `;
    editorGrid.appendChild(addBtn);

    // 顯示已選縮圖
    finalFiles.forEach(file => {
        const div = document.createElement('div');
        div.className = 'gallery-item';
        const url = URL.createObjectURL(file);
        div.style.backgroundImage = `url('${url}')`;
        div.onclick = () => editorPreview.style.backgroundImage = `url('${url}')`;
        editorGrid.appendChild(div);
    });

    // 補空白格
    for(let i=0; i< (7 - finalFiles.length); i++) {
        const dummy = document.createElement('div');
        dummy.className = 'gallery-item';
        dummy.style.backgroundColor = '#f5f5f5';
        editorGrid.appendChild(dummy);
    }
}

// D. 選圖監聽
if(multiPhotoInput) {
    multiPhotoInput.addEventListener('change', (e) => {
        if(e.target.files.length > 0) {
            const newFiles = Array.from(e.target.files);
            // 如果多選開啟 -> 累加；否則 -> 覆蓋
            if(isMultiSelectMode) finalFiles = [...finalFiles, ...newFiles];
            else finalFiles = newFiles;
            
            renderEditorGrid();
        }
        e.target.value = ''; // 清空以允許重複選
    });
}

// 其他按鈕
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

// F. ⚠️ 發佈貼文 (將 finalFiles 存入資料庫)
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

        // 1. 存入 Memory (單張單張存)
        finalFiles.forEach((file, index) => {
            memoryStore.add({
                date: todayStr, time: timeStr, imageBlob: file, timestamp: now.getTime() + index
            });
        });

        // 2. 存入社群 (存整個陣列)
        if(isVIP) {
            postStore.add({
                user: "My Account",
                avatar: "",
                location: currentEditLocation || "Unknown",
                images: finalFiles, // ⚠️ 這裡存入所有選取的照片
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
            // 更新首頁
            if(card && finalFiles.length > 0) {
                card.style.backgroundImage = `url('${URL.createObjectURL(finalFiles[0])}')`;
            }
        };
    });
}

// ==========================================
// 5. 社群頁面渲染 (輪播)
// ==========================================
function renderCommunity() {
    const container = document.getElementById('feedContainer');
    if(!container || !db) return;

    const tx = db.transaction([STORE_POSTS], 'readonly');
    const req = tx.objectStore(STORE_POSTS).getAll();

    req.onsuccess = (e) => {
        const posts = e.target.result;
        container.innerHTML = '';

        if(posts.length === 0) {
            container.innerHTML = '<div class="loading-text" style="text-align:center; margin-top:50px;">No posts yet.<br>Become a VIP to share!</div>';
            return;
        }

        posts.sort((a,b) => b.timestamp - a.timestamp);

        posts.forEach(post => {
            // 讀取圖片陣列
            const images = post.images || [post.imageBlob];
            let slidesHtml = '';
            
            // 產生每張圖片的 HTML
            if (images && images.length > 0) {
                images.forEach(blob => {
                    if(blob) {
                        const url = URL.createObjectURL(blob);
                        slidesHtml += `<div class="feed-image" style="background-image: url('${url}')"></div>`;
                    }
                });
            }

            const counterHtml = images.length > 1 ? `<div class="feed-counter">1/${images.length}</div>` : '';

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
                
                <div style="position: relative;">
                    <div class="feed-carousel" onscroll="updateCounter(this)">${slidesHtml}</div>
                    ${counterHtml}
                </div>

                <div class="feed-actions">
                    <svg class="like-btn" width="28" height="28" viewBox="0 0 24 24" stroke="black" stroke-width="2" style="cursor:pointer; margin-right:10px;"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                    <svg class="comment-btn" width="28" height="28" viewBox="0 0 24 24" stroke="black" stroke-width="2" style="cursor:pointer;"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
                </div>
                <div class="feed-likes" style="margin-bottom:10px;">${post.likes || 0} likes</div>
                <div style="padding:0 15px 15px 15px; color:#999; font-size:13px; cursor:pointer;" class="comment-btn">View all comments...</div>
            `;

            // 綁定事件
            card.querySelector('.like-btn').onclick = function() { this.classList.toggle('liked'); };
            const commentBtns = card.querySelectorAll('.comment-btn');
            commentBtns.forEach(btn => btn.onclick = () => openCommentSheet(post));

            container.appendChild(card);
        });
    };
}

// 留言板與 Story 相關函式 (全域)
function openCommentSheet(post) {
    let sheet = document.getElementById('commentSheet');
    if(!sheet) {
        sheet = document.createElement('div'); sheet.id = 'commentSheet'; sheet.className = 'comment-sheet';
        const bd = document.createElement('div'); bd.id = 'commentBackdrop';
        bd.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:500;opacity:0;pointer-events:none;transition:opacity 0.3s;';
        document.body.appendChild(bd);
        
        // 綁定 window.sendComment
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

// ==========================================
// 6. 其他 (保持不變)
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

let startY = 0; 
let isHorizontalMove = false;

track.addEventListener('mousedown', startDrag);
track.addEventListener('touchstart', startDrag);

function startDrag(e) { 
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
        if (endX - startX > 50 && currentPage > 0) currentPage--; 
        else if (startX - endX > 50 && currentPage < 2) currentPage++; 
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

if(openProfileBtn) openProfileBtn.addEventListener('click', () => profilePage.classList.add('active'));
if(closeProfileBtn) closeProfileBtn.addEventListener('click', () => profilePage.classList.remove('active'));
if(logoutBtn) logoutBtn.addEventListener('click', () => alert('Log out'));
