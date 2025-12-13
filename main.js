// ==========================================
// 1. 全域變數與 DOM 元素
// ==========================================
const track = document.getElementById('track');
const topBar = document.getElementById('topBar');
const bottomBar = document.getElementById('bottomBar');

const profilePage = document.getElementById('profilePage');
const openProfileBtn = document.getElementById('openProfileBtn');
const closeProfileBtn = document.getElementById('closeProfileBtn');
const logoutBtn = document.querySelector('.logout-btn');

const actionSheet = document.getElementById('actionSheet');
const backdrop = document.getElementById('backdrop');
const shutterBtn = document.getElementById('shutterBtn');

// 相機與編輯
const takePhotoBtn = document.getElementById('takePhotoBtn');
const chooseAlbumBtn = document.getElementById('chooseAlbumBtn');
const cameraInput = document.getElementById('cameraInput');
const albumInput = document.getElementById('albumInput');
const card = document.querySelector('.card');

// 編輯頁面
const editBtn = document.getElementById('editBtn');
const editorPage = document.getElementById('editorPage');
const closeEditorBtn = document.getElementById('closeEditorBtn');
const galleryGrid = document.getElementById('galleryGrid');
const editorPreview = document.getElementById('editorPreview');
const multiPhotoInput = document.getElementById('multiPhotoInput');
const realGalleryBtn = document.getElementById('realGalleryBtn');
const tagPeopleBtn = document.getElementById('tagPeopleBtn');
const tagLocationBtn = document.getElementById('tagLocationBtn');

// 時間軸頁面
const timelinePage = document.getElementById('timelinePage');
const closeTimelineBtn = document.getElementById('closeTimelineBtn');
const timelineContent = document.getElementById('timelineContent');
const timelineTitle = document.getElementById('timelineTitle');

// 狀態
let currentPage = 1;
let startX = 0; let startY = 0;
let currentTranslate = -33.333;
let isDraggingPage = false;
let startTranslate = 0;
let isHorizontalMove = false;
let isDraggingSheet = false;

// 資料庫
let db;
const DB_NAME = 'GourmetDB_Final_v6'; 
const STORE_NAME = 'photos';
const DB_VERSION = 1;

// ==========================================
// 2. 初始化資料庫
// ==========================================
function initDB() {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = (e) => console.error("DB Error", e);
    request.onupgradeneeded = (e) => {
        db = e.target.result;
        if (db.objectStoreNames.contains(STORE_NAME)) db.deleteObjectStore(STORE_NAME);
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
        store.createIndex('date', 'date', { unique: false });
    };
    request.onsuccess = (e) => {
        db = e.target.result;
        console.log("資料庫連線成功");
        renderCalendar();
    };
}
initDB();

// ==========================================
// 3. 動態載入頁面
// ==========================================
async function loadExternalPages() {
    try {
        const memoryRes = await fetch('memory.html');
        if (memoryRes.ok) {
            const text = await memoryRes.text();
            const doc = new DOMParser().parseFromString(text, 'text/html');
            const content = doc.querySelector('.page-content-wrapper');
            const container = document.getElementById('page-memory');
            if(content && container) {
                container.innerHTML = ''; 
                container.appendChild(content);
                renderCalendar(); 
            }
        }
        const communityRes = await fetch('community.html');
        if (communityRes.ok) {
            const text = await communityRes.text();
            const doc = new DOMParser().parseFromString(text, 'text/html');
            const content = doc.querySelector('.page-content-wrapper');
            const container = document.getElementById('page-community');
            if(content && container) {
                container.innerHTML = ''; 
                container.appendChild(content);
            }
        }
    } catch (error) {
        console.error('頁面載入失敗:', error);
    }
}
loadExternalPages();

// ==========================================
// ==========================================
// 4. 繪製日曆 (整合版：最新封面 + 限時動態)
// ==========================================
async function renderCalendar() {
    const calendarContainer = document.getElementById('calendarDays');
    if (!calendarContainer) return; 

    // 1. 清空容器並移除舊監聽器 (防止重複綁定)
    calendarContainer.innerHTML = ''; 
    const newContainer = calendarContainer.cloneNode(true);
    calendarContainer.parentNode.replaceChild(newContainer, calendarContainer);
    const activeContainer = document.getElementById('calendarDays');

    // 2. 設定日期標題
    const date = new Date();
    const year = date.getFullYear();
    const month = date.getMonth(); 
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const title = document.getElementById('calendarMonth');
    if(title) title.textContent = `${monthNames[month]} ${year}`;

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // 3. 取得照片資料
    const photosGroup = await getAllPhotosGrouped();

    // 4. 產生空白格
    for (let i = 0; i < firstDay; i++) {
        activeContainer.appendChild(document.createElement('div'));
    }

    // 5. 產生日期格
    for (let day = 1; day <= daysInMonth; day++) {
        const dayCell = document.createElement('div');
        dayCell.classList.add('day-cell');
        dayCell.textContent = day;

        const currentMonthStr = (month + 1).toString().padStart(2, '0');
        const currentDayStr = day.toString().padStart(2, '0');
        const dateString = `${year}-${currentMonthStr}-${currentDayStr}`;

        // 如果這天有照片
        if (photosGroup[dateString] && photosGroup[dateString].length > 0) {
            dayCell.classList.add('has-photo');
            
            // 🔥 重點 1：依照時間「由新到舊」排序
            const sortedPhotos = [...photosGroup[dateString]].sort((a, b) => b.timestamp - a.timestamp);
            
            // 🔥 重點 2：取第一張（最新）當作日曆封面
            const latestPhoto = sortedPhotos[0];
            const imgUrl = URL.createObjectURL(latestPhoto.imageBlob);
            
            dayCell.style.backgroundImage = `url('${imgUrl}')`;
            dayCell.textContent = ''; // 隱藏數字
            
            // 埋入資料供點擊使用
            dayCell.dataset.date = dateString; 
            dayCell.dataset.hasPhoto = "true";
        }
        activeContainer.appendChild(dayCell);
    }

    // 6. 監聽點擊 (Event Delegation)
    activeContainer.addEventListener('click', (e) => {
        const cell = e.target.closest('.day-cell');
        // 確保點到的是有照片的格子
        if (cell && cell.dataset.hasPhoto === "true") {
            const targetDate = cell.dataset.date;
            
            if (photosGroup[targetDate]) {
                console.log("開啟 Story 模式:", targetDate);
                // 🔥 重點 3：這裡呼叫 Story 模式，而不是 updateCarousel (所以不會跳回首頁)
                openStoryMode(targetDate, photosGroup[targetDate]);
            }
        }
    });
}

// 輔助函式：抓取資料庫照片
function getAllPhotosGrouped() {
    return new Promise((resolve) => {
        if (!db) { resolve({}); return; }
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();
        request.onsuccess = (e) => {
            const results = e.target.result;
            const grouped = {};
            if(results) {
                results.forEach(item => {
                    if (!grouped[item.date]) grouped[item.date] = [];
                    grouped[item.date].push(item);
                });
            }
            resolve(grouped);
        };
    });
}

// ==========================================
// 5. 限時動態播放器 (Story Mode Logic)
// ==========================================
function openStoryMode(dateStr, photosArray) {
    // 1. 自動建立頁面 (防呆機制：如果 HTML 裡沒有，JS 自己蓋一個)
    let targetPage = document.getElementById('timelinePage');
    if (!targetPage) {
        targetPage = document.createElement('div');
        targetPage.id = 'timelinePage';
        targetPage.className = 'editor-page';
        // 強制寫入黑色背景樣式
        Object.assign(targetPage.style, {
            position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
            backgroundColor: '#000', zIndex: '9999',
            transform: 'translateY(100%)', transition: 'transform 0.3s ease',
            display: 'flex', flexDirection: 'column'
        });
        
        // 建立簡單的播放器結構
        targetPage.innerHTML = `
            <div style="position:absolute; top:40px; right:20px; z-index:20;">
                <span id="closeStoryBtn" style="color:white; font-size:30px; cursor:pointer; font-weight:bold;">&times;</span>
            </div>
            <div id="storyPlayer" style="width:100%; height:100%; display:flex; justify-content:center; align-items:center;"></div>
        `;
        document.body.appendChild(targetPage);
        
        // 綁定關閉按鈕
        document.getElementById('closeStoryBtn').onclick = () => {
            targetPage.style.transform = 'translateY(100%)';
            targetPage.classList.remove('active');
        };
    }

    const player = document.getElementById('storyPlayer');
    
    // 2. 播放順序：由舊到新 (看故事的感覺)
    photosArray.sort((a, b) => a.timestamp - b.timestamp);

    let currentIndex = 0;

    // 3. 渲染單張照片的函式
    function renderStory() {
        // 如果播完了，自動關閉
        if (currentIndex >= photosArray.length) {
            targetPage.style.transform = 'translateY(100%)';
            targetPage.classList.remove('active');
            return;
        }
        // 防止索引負數
        if (currentIndex < 0) currentIndex = 0;

        const photo = photosArray[currentIndex];
        const imgUrl = URL.createObjectURL(photo.imageBlob);

        // 更新畫面
        player.innerHTML = `
            <div style="width:100%; height:100%; position:relative; display:flex; flex-direction:column; justify-content:center; align-items:center;">
                <div style="width:100%; height:80%; background-image:url('${imgUrl}'); background-size:contain; background-repeat:no-repeat; background-position:center;"></div>
                
                <div style="color:white; margin-top:15px; font-size:14px; letter-spacing:1px;">
                    ${dateStr} ${photo.time} (${currentIndex + 1}/${photosArray.length})
                </div>

                <div id="storyPrev" style="position:absolute; top:0; left:0; width:50%; height:100%; z-index:10;"></div>
                <div id="storyNext" style="position:absolute; top:0; right:0; width:50%; height:100%; z-index:10;"></div>
            </div>
        `;

        // 綁定觸控事件
        document.getElementById('storyPrev').onclick = (e) => {
            e.stopPropagation();
            currentIndex--;
            renderStory();
        };
        document.getElementById('storyNext').onclick = (e) => {
            e.stopPropagation();
            currentIndex++;
            renderStory();
        };
    }

    // 4. 啟動播放
    targetPage.classList.add('active');
    setTimeout(() => {
        targetPage.style.transform = 'translateY(0)';
    }, 10);
    
    renderStory(); // 播放第一張
}
// ==========================================
// 5. 批次上傳
// ==========================================
function handleBatchUpload(files) {
    if (!files || files.length === 0) return;
    if (!db) return;

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    Array.from(files).forEach((file, index) => {
        const timeOffset = now.getTime() + index;
        const timeStr = new Date(timeOffset).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        store.add({
            date: todayStr,
            time: timeStr,
            imageBlob: file,
            timestamp: timeOffset
        });
    });

    transaction.oncomplete = () => {
        const firstImgURL = URL.createObjectURL(files[0]);
        if(card) card.style.backgroundImage = `url('${firstImgURL}')`;
        renderCalendar();
        alert(`成功儲存 ${files.length} 張照片！`);
    };
}

// ==========================================
// 6. 限時動態模式 (Story Mode)
// ==========================================
function openStoryMode(dateStr, photosArray) {
    // 1. 自動建立頁面 (如果沒有的話)
    let targetPage = document.getElementById('timelinePage');
    if (!targetPage) {
        targetPage = document.createElement('div');
        targetPage.id = 'timelinePage';
        targetPage.className = 'editor-page';
        Object.assign(targetPage.style, {
            position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
            backgroundColor: '#000', zIndex: '9999', // 黑色背景
            transform: 'translateY(100%)', transition: 'transform 0.3s ease',
            display: 'flex', flexDirection: 'column'
        });
        // 簡單的頂部列 (只有關閉按鈕)
        targetPage.innerHTML = `
            <div style="position:absolute; top:40px; right:20px; z-index:20;">
                <span id="closeStoryBtn" style="color:white; font-size:24px; cursor:pointer;">&times;</span>
            </div>
            <div id="storyPlayer" style="width:100%; height:100%;"></div>
        `;
        document.body.appendChild(targetPage);
        
        document.getElementById('closeStoryBtn').onclick = () => {
            targetPage.style.transform = 'translateY(100%)';
            targetPage.classList.remove('active');
        };
    }

    const player = document.getElementById('storyPlayer');
    
    // 2. 排序照片 (由舊到新，看故事的感覺)
    photosArray.sort((a, b) => a.timestamp - b.timestamp);

    // 3. 播放邏輯
    let currentIndex = 0;

    function renderStory() {
        if (currentIndex >= photosArray.length) {
            // 播完了，自動關閉
            targetPage.style.transform = 'translateY(100%)';
            targetPage.classList.remove('active');
            return;
        }
        if (currentIndex < 0) currentIndex = 0;

        const photo = photosArray[currentIndex];
        const imgUrl = URL.createObjectURL(photo.imageBlob);

        player.innerHTML = `
            <div class="story-container">
                <div class="story-img-box" style="background-image: url('${imgUrl}')"></div>
                <div class="story-info">
                    ${dateStr} - ${photo.time} (${currentIndex + 1}/${photosArray.length})
                </div>
                <div class="story-nav-left" id="storyPrev"></div>
                <div class="story-nav-right" id="storyNext"></div>
            </div>
        `;

        // 綁定觸控
        document.getElementById('storyPrev').onclick = (e) => {
            e.stopPropagation();
            currentIndex--;
            renderStory();
        };
        document.getElementById('storyNext').onclick = (e) => {
            e.stopPropagation();
            currentIndex++;
            renderStory();
        };
    }

    // 4. 啟動
    targetPage.classList.add('active');
    targetPage.style.transform = 'translateY(0)';
    renderStory();
}

// 7. 互動監聽
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

if(takePhotoBtn && cameraInput) {
    takePhotoBtn.addEventListener('click', () => { closeSheet(); setTimeout(() => cameraInput.click(), 100); });
}
if(cameraInput) cameraInput.addEventListener('change', (e) => handleBatchUpload([e.target.files[0]]));

if(chooseAlbumBtn && albumInput) {
    chooseAlbumBtn.addEventListener('click', () => { closeSheet(); setTimeout(() => albumInput.click(), 100); });
}
if(albumInput) albumInput.addEventListener('change', (e) => { if(e.target.files.length) handleBatchUpload(e.target.files); });

// 頁面滑動
track.addEventListener('mousedown', pageDragStart);
track.addEventListener('touchstart', pageDragStart);
function pageDragStart(e) {
    if (isDraggingSheet) return;
    isDraggingPage = true; isHorizontalMove = false;
    startX = getX(e); startY = getY(e);
    startTranslate = -currentPage * 33.333;
    track.style.transition = 'none';
    window.addEventListener('mousemove', pageDragMove);
    window.addEventListener('touchmove', pageDragMove, {passive: false});
    window.addEventListener('mouseup', pageDragEnd);
    window.addEventListener('touchend', pageDragEnd);
}
function pageDragMove(e) {
    if (!isDraggingPage) return;
    const currentX = getX(e); const currentY = getY(e);
    const deltaX = currentX - startX; const deltaY = currentY - startY;
    if (!isHorizontalMove && (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10)) {
        if (Math.abs(deltaX) > Math.abs(deltaY)) isHorizontalMove = true;
        else { isDraggingPage = false; pageDragEnd(e); return; }
    }
    if (isHorizontalMove) {
        if(e.cancelable) e.preventDefault(); 
        const w = window.innerWidth;
        const p = (deltaX / w) * 33.333;
        let next = startTranslate + p;
        if (next > 0 || next < -66.666) next = startTranslate + (p * 0.3);
        currentTranslate = next;
        track.style.transform = `translateX(${currentTranslate}%)`;
    }
}
function pageDragEnd(e) {
    if (!isDraggingPage && !isHorizontalMove) { cleanupPageDrag(); return; }
    isDraggingPage = false;
    const moved = currentTranslate - startTranslate;
    if (moved < -5 && currentPage < 2) currentPage++;
    else if (moved > 5 && currentPage > 0) currentPage--;
    updateCarousel();
    cleanupPageDrag();
}
function cleanupPageDrag() {
    window.removeEventListener('mousemove', pageDragMove);
    window.removeEventListener('touchmove', pageDragMove);
    window.removeEventListener('mouseup', pageDragEnd);
    window.removeEventListener('touchend', pageDragEnd);
}
function updateCarousel() {
    track.style.transition = 'transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)';
    track.style.transform = `translateX(-${currentPage * 33.333}%)`;
    const isHome = (currentPage === 1);
    topBar.style.opacity = isHome ? '1' : '0';
    bottomBar.style.opacity = isHome ? '1' : '0';
    topBar.style.pointerEvents = isHome ? 'auto' : 'none';
    bottomBar.style.pointerEvents = isHome ? 'auto' : 'none';
}
if(openProfileBtn) openProfileBtn.addEventListener('click', () => profilePage.classList.add('active'));
if(closeProfileBtn) closeProfileBtn.addEventListener('click', () => profilePage.classList.remove('active'));
if(logoutBtn) logoutBtn.addEventListener('click', () => alert('Log out'));
if(editBtn) editBtn.addEventListener('click', () => {
    editorPage.classList.add('active');
    if(galleryGrid.children.length <= 1) setTimeout(() => { if(confirm("匯入相簿？")) multiPhotoInput.click(); }, 300);
});
if(closeEditorBtn) closeEditorBtn.addEventListener('click', () => editorPage.classList.remove('active'));
if(realGalleryBtn) realGalleryBtn.addEventListener('click', () => multiPhotoInput.click());
if(multiPhotoInput) multiPhotoInput.addEventListener('change', (e) => {
    if(e.target.files.length) {
        editorPreview.style.backgroundImage = `url('${URL.createObjectURL(e.target.files[0])}')`;
        Array.from(e.target.files).forEach(f => {
            const div = document.createElement('div'); div.className = 'gallery-item';
            div.style.backgroundImage = `url('${URL.createObjectURL(f)}')`;
            div.onclick = () => editorPreview.style.backgroundImage = `url('${URL.createObjectURL(f)}')`;
            galleryGrid.appendChild(div);
        });
    }
});
if(tagPeopleBtn) tagPeopleBtn.addEventListener('click', () => alert("VIP Only"));
if(tagLocationBtn) tagLocationBtn.addEventListener('click', () => prompt("Location:", "Taipei"));
function getX(e) { return e.type.includes('mouse') ? e.pageX : e.touches[0].clientX; }
function getY(e) { return e.type.includes('mouse') ? e.pageY : e.touches[0].clientY; }
