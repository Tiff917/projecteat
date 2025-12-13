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
const takePhotoBtn = document.getElementById('takePhotoBtn');
const chooseAlbumBtn = document.getElementById('chooseAlbumBtn');
const cameraInput = document.getElementById('cameraInput');
const albumInput = document.getElementById('albumInput');
const card = document.querySelector('.card');
const editBtn = document.getElementById('editBtn');
const editorPage = document.getElementById('editorPage');
const closeEditorBtn = document.getElementById('closeEditorBtn');
const galleryGrid = document.getElementById('galleryGrid');
const editorPreview = document.getElementById('editorPreview');
const multiPhotoInput = document.getElementById('multiPhotoInput');
const realGalleryBtn = document.getElementById('realGalleryBtn');
const tagPeopleBtn = document.getElementById('tagPeopleBtn');
const tagLocationBtn = document.getElementById('tagLocationBtn');

// 狀態變數
let currentPage = 1;
let startX = 0; let startY = 0;
let currentTranslate = -33.333;
let isDraggingPage = false;
let startTranslate = 0;
let isHorizontalMove = false;
let isDraggingSheet = false;

// 資料庫設定
let db;
// ⚠️ 強制換新資料庫 v7，確保資料乾淨，排序才會對
const DB_NAME = 'GourmetDB_Final_v7'; 
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
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
    };
    request.onsuccess = (e) => {
        db = e.target.result;
        console.log("資料庫連線成功 (v7)");
        // 資料庫準備好後，嘗試掛載監聽器
        setupCalendarListener();
        renderCalendar();
    };
}
initDB();

// ==========================================
// 3. 動態載入頁面
// ==========================================
async function loadExternalPages() {
    try {
        // 載入 Memory
        const memoryRes = await fetch('memory.html');
        if (memoryRes.ok) {
            const text = await memoryRes.text();
            const doc = new DOMParser().parseFromString(text, 'text/html');
            const content = doc.querySelector('.page-content-wrapper');
            const container = document.getElementById('page-memory');
            if(content && container) {
                container.innerHTML = ''; 
                container.appendChild(content);
                // 頁面載入後，嘗試掛載監聽器並繪製
                setupCalendarListener();
                renderCalendar(); 
            }
        }
        // 載入 Community
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
// 4. 繪製日曆 (核心修復)
// ==========================================
// 全域變數儲存照片資料，供點擊時使用
let currentPhotosGroup = {};

// 獨立的事件監聽設定函式 (避免重複綁定)
function setupCalendarListener() {
    const container = document.getElementById('calendarDays');
    if (!container || container.dataset.listenerAttached === "true") return;

    // 使用事件委派監聽整個容器
    container.addEventListener('click', (e) => {
        const cell = e.target.closest('.day-cell');
        // 確保點到的是有照片的格子
        if (cell && cell.dataset.hasPhoto === "true") {
            const targetDate = cell.dataset.date;
            console.log("點擊日期:", targetDate); // Debug用

            if (currentPhotosGroup[targetDate]) {
                // 呼叫 Story 模式 (不會跳回首頁)
                openStoryMode(targetDate, currentPhotosGroup[targetDate]);
            }
        }
    });
    // 標記已綁定
    container.dataset.listenerAttached = "true";
    console.log("日曆點擊監聽器已啟動");
}

async function renderCalendar() {
    const calendarContainer = document.getElementById('calendarDays');
    if (!calendarContainer) return; 

    // 1. 清空容器內容
    calendarContainer.innerHTML = ''; 
    
    const date = new Date();
    const year = date.getFullYear();
    const month = date.getMonth(); 
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const title = document.getElementById('calendarMonth');
    if(title) title.textContent = `${monthNames[month]} ${year}`;

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // 2. 取得並更新全域照片資料
    currentPhotosGroup = await getAllPhotosGrouped();

    // 3. 產生空白格
    for (let i = 0; i < firstDay; i++) {
        calendarContainer.appendChild(document.createElement('div'));
    }

    // 4. 產生日期格
    for (let day = 1; day <= daysInMonth; day++) {
        const dayCell = document.createElement('div');
        dayCell.classList.add('day-cell');
        dayCell.textContent = day;

        const currentMonthStr = (month + 1).toString().padStart(2, '0');
        const currentDayStr = day.toString().padStart(2, '0');
        const dateString = `${year}-${currentMonthStr}-${currentDayStr}`;

        // 如果這天有照片
        if (currentPhotosGroup[dateString] && currentPhotosGroup[dateString].length > 0) {
            dayCell.classList.add('has-photo');
            
            // 🔥 關鍵排序：由新到舊 (b - a)
            // 使用稍微穩健一點的寫法，防止 timestamp 缺失
            const sortedPhotos = [...currentPhotosGroup[dateString]].sort((a, b) => {
                const timeA = a.timestamp || 0;
                const timeB = b.timestamp || 0;
                return timeB - timeA;
            });
            
            // 🔥 取第一張（最新）當作封面
            const latestPhoto = sortedPhotos[0];
            const imgUrl = URL.createObjectURL(latestPhoto.imageBlob);
            
            dayCell.style.backgroundImage = `url('${imgUrl}')`;
            dayCell.textContent = ''; 
            
            // 埋入資料供點擊使用
            dayCell.dataset.date = dateString; 
            dayCell.dataset.hasPhoto = "true";
        }
        calendarContainer.appendChild(dayCell);
    }
    // 再次確保監聽器存在 (以防萬一)
    setupCalendarListener();
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
// 5. 批次上傳與 Story 模式
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
            date: todayStr, time: timeStr, imageBlob: file, timestamp: timeOffset
        });
    });
    transaction.oncomplete = () => {
        const firstImgURL = URL.createObjectURL(files[0]);
        if(card) card.style.backgroundImage = `url('${firstImgURL}')`;
        renderCalendar();
        alert(`成功儲存 ${files.length} 張照片！`);
    };
}

// 🔥 限時動態播放器 (Story Mode) 🔥
function openStoryMode(dateStr, photosArray) {
    // 1. 自動建立黑色頁面
    let targetPage = document.getElementById('storyPage');
    if (!targetPage) {
        targetPage = document.createElement('div');
        targetPage.id = 'storyPage';
        // 強制寫入樣式，確保它是黑底、全螢幕、在最上層
        Object.assign(targetPage.style, {
            position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
            backgroundColor: '#000', zIndex: '99999', // 最高層級
            transform: 'translateY(100%)', transition: 'transform 0.3s ease',
            display: 'flex', flexDirection: 'column'
        });
        
        // 建立結構
        targetPage.innerHTML = `
            <div style="position:absolute; top:40px; right:20px; z-index:20;">
                <span id="closeStoryBtn" style="color:white; font-size:30px; cursor:pointer; font-weight:bold; padding: 10px;">&times;</span>
            </div>
            <div id="storyPlayer" style="width:100%; height:100%; display:flex; justify-content:center; align-items:center;"></div>
        `;
        document.body.appendChild(targetPage);
        
        // 綁定關閉按鈕
        document.getElementById('closeStoryBtn').onclick = () => {
            targetPage.style.transform = 'translateY(100%)';
        };
    }

    const player = document.getElementById('storyPlayer');
    
    // 2. 播放順序：依照時間由舊到新 (看故事的感覺)
    photosArray.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

    let currentIndex = 0;

    // 3. 渲染單張照片
    function renderStory() {
        // 播完自動關閉
        if (currentIndex >= photosArray.length) {
            targetPage.style.transform = 'translateY(100%)';
            return;
        }
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

                <div id="storyPrev" style="position:absolute; top:0; left:0; width:50%; height:100%; z-index:10; cursor:w-resize;"></div>
                <div id="storyNext" style="position:absolute; top:0; right:0; width:50%; height:100%; z-index:10; cursor:e-resize;"></div>
            </div>
        `;

        // 綁定觸控
        document.getElementById('storyPrev').onclick = (e) => { e.stopPropagation(); currentIndex--; renderStory(); };
        document.getElementById('storyNext').onclick = (e) => { e.stopPropagation(); currentIndex++; renderStory(); };
    }

    // 4. 啟動
    setTimeout(() => {
        targetPage.style.transform = 'translateY(0)';
    }, 10);
    renderStory(); // 播放第一張
}


// ==========================================
// 6. 互動與監聽器 (保持原樣)
// ==========================================
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
if(takePhotoBtn && cameraInput) takePhotoBtn.addEventListener('click', () => { closeSheet(); setTimeout(() => cameraInput.click(), 100); });
if(cameraInput) cameraInput.addEventListener('change', (e) => handleBatchUpload([e.target.files[0]]));
if(chooseAlbumBtn && albumInput) chooseAlbumBtn.addEventListener('click', () => { closeSheet(); setTimeout(() => albumInput.click(), 100); });
if(albumInput) albumInput.addEventListener('change', (e) => { if(e.target.files.length) handleBatchUpload(e.target.files); });
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
