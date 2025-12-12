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

// 相機與編輯相關
const takePhotoBtn = document.getElementById('takePhotoBtn');
const chooseAlbumBtn = document.getElementById('chooseAlbumBtn');
const cameraInput = document.getElementById('cameraInput');
const albumInput = document.getElementById('albumInput');
const card = document.querySelector('.card');

// 編輯頁面相關
const editBtn = document.getElementById('editBtn');
const editorPage = document.getElementById('editorPage');
const closeEditorBtn = document.getElementById('closeEditorBtn');
const galleryGrid = document.getElementById('galleryGrid');
const editorPreview = document.getElementById('editorPreview');
const multiPhotoInput = document.getElementById('multiPhotoInput');
const realGalleryBtn = document.getElementById('realGalleryBtn');
const tagPeopleBtn = document.getElementById('tagPeopleBtn');
const tagLocationBtn = document.getElementById('tagLocationBtn');

// 時間軸頁面相關
const timelinePage = document.getElementById('timelinePage');
const closeTimelineBtn = document.getElementById('closeTimelineBtn');
const timelineContent = document.getElementById('timelineContent');
const timelineTitle = document.getElementById('timelineTitle');

// 狀態變數
let currentPage = 1;
let startX = 0; let startY = 0;
let currentTranslate = -33.333;
let isDraggingPage = false;
let startTranslate = 0;
let isHorizontalMove = false;
let isDraggingSheet = false;
let sheetStartY = 0;

// 資料庫變數
let db;
const DB_NAME = 'GourmetDB';
const STORE_NAME = 'photos';
const DB_VERSION = 3; // ⚠️ 版本號 3：強制升級資料庫結構以支援多圖

// ==========================================
// 2. 初始化資料庫 (升級版)
// ==========================================
function initDB() {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = (e) => console.error("DB Error", e);
    
    // 當版本號增加時，執行結構升級
    request.onupgradeneeded = (e) => {
        db = e.target.result;
        
        // 如果舊倉庫存在，先刪除 (因為結構不同)
        if (db.objectStoreNames.contains(STORE_NAME)) {
            db.deleteObjectStore(STORE_NAME);
        }

        // 建立新倉庫：使用 'id' 作為鍵值 (流水號)，這樣同一天就能存無限多張
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
        
        // 建立索引方便我們用日期查詢
        store.createIndex('date', 'date', { unique: false });
    };

    request.onsuccess = (e) => {
        db = e.target.result;
        console.log("資料庫連線成功 (v3)");
        renderCalendar();
    };
}
initDB();

// ==========================================
// 3. 動態載入頁面
// ==========================================
async function loadExternalPages() {
    try {
        // Memory
        const memoryRes = await fetch('memory.html');
        if (memoryRes.ok) {
            const text = await memoryRes.text();
            const doc = new DOMParser().parseFromString(text, 'text/html');
            const content = doc.querySelector('.page-content-wrapper');
            if(content) {
                const container = document.getElementById('page-memory');
                container.innerHTML = ''; 
                container.appendChild(content);
                renderCalendar();
            }
        }
        // Community
        const communityRes = await fetch('community.html');
        if (communityRes.ok) {
            const text = await communityRes.text();
            const doc = new DOMParser().parseFromString(text, 'text/html');
            const content = doc.querySelector('.page-content-wrapper');
            if(content) {
                const container = document.getElementById('page-community');
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
// 4. 繪製日曆核心邏輯 (支援多圖)
// ==========================================
async function renderCalendar() {
    const calendarContainer = document.getElementById('calendarDays');
    if (!calendarContainer) return; 

    calendarContainer.innerHTML = ''; 

    const date = new Date();
    const year = date.getFullYear();
    const month = date.getMonth(); 
    
    // 更新標題
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const title = document.getElementById('calendarMonth');
    if(title) title.textContent = `${monthNames[month]} ${year}`;

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // 取得分組後的照片資料
    const photosGroup = await getAllPhotosGrouped();

    // 空白格
    for (let i = 0; i < firstDay; i++) {
        calendarContainer.appendChild(document.createElement('div'));
    }

    // 日期格
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
            
            // 拿「最後一張」當封面
            const lastPhoto = photosGroup[dateString][photosGroup[dateString].length - 1];
            const imgUrl = URL.createObjectURL(lastPhoto.imageBlob);
            
            dayCell.style.backgroundImage = `url('${imgUrl}')`;
            dayCell.textContent = ''; 

            // 點擊打開詳細列表
            dayCell.onclick = () => {
                openTimeline(dateString, photosGroup[dateString]);
            };
        }
        calendarContainer.appendChild(dayCell);
    }
}

// 輔助：抓取所有照片並按日期分組
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
// 5. 存入照片邏輯 (支援多圖)
// ==========================================
function handleImageUpload(file) {
    if (!file) return;

    // 預覽
    const imageURL = URL.createObjectURL(file);
    card.style.backgroundImage = `url('${imageURL}')`;

    if (!db) return;
    
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    // 使用 add 新增一筆 (不會覆蓋舊的)
    store.add({
        date: todayStr,
        time: timeStr,
        imageBlob: file,
        timestamp: now.getTime()
    });

    transaction.oncomplete = () => {
        console.log("照片已存入:", todayStr);
        renderCalendar();
        alert("照片已儲存！");
    };
}

// ==========================================
// 6. 照片列表頁面 (Photo Stream)
// ==========================================
function openTimeline(dateStr, photosArray) {
    if(!timelinePage) return;
    
    timelinePage.classList.add('active');
    timelineTitle.textContent = dateStr;
    timelineContent.innerHTML = '';

    // 排序：由早到晚
    photosArray.sort((a, b) => a.timestamp - b.timestamp);

    photosArray.forEach(photo => {
        const imgUrl = URL.createObjectURL(photo.imageBlob);
        const item = document.createElement('div');
        item.classList.add('timeline-item');
        // 乾淨的卡片樣式
        item.innerHTML = `
            <div class="timeline-card">
                <div class="timeline-img" style="background-image: url('${imgUrl}')"></div>
                <div class="timeline-caption">Time: ${photo.time}</div>
            </div>
        `;
        timelineContent.appendChild(item);
    });
}

// 關閉列表
if(closeTimelineBtn) {
    closeTimelineBtn.addEventListener('click', () => timelinePage.classList.remove('active'));
}

// ==========================================
// 7. 編輯頁面與多選圖庫邏輯
// ==========================================
if(editBtn) {
    editBtn.addEventListener('click', () => {
        editorPage.classList.add('active');
        if(galleryGrid.children.length <= 1) {
            setTimeout(() => {
                if(confirm("匯入相簿照片？")) multiPhotoInput.click();
            }, 300);
        }
    });
}
if(closeEditorBtn) closeEditorBtn.addEventListener('click', () => editorPage.classList.remove('active'));

if(realGalleryBtn) realGalleryBtn.addEventListener('click', () => multiPhotoInput.click());

if(multiPhotoInput) {
    multiPhotoInput.addEventListener('change', (e) => {
        const files = e.target.files;
        if (files && files.length > 0) {
            editorPreview.style.backgroundImage = `url('${URL.createObjectURL(files[0])}')`;
            Array.from(files).forEach(renderPhotoToGrid);
        }
    });
}

function renderPhotoToGrid(file) {
    const div = document.createElement('div');
    div.classList.add('gallery-item');
    const imgUrl = URL.createObjectURL(file);
    div.style.backgroundImage = `url('${imgUrl}')`;
    div.addEventListener('click', () => {
        document.querySelectorAll('.gallery-item').forEach(el => el.classList.remove('selected'));
        div.classList.add('selected');
        editorPreview.style.backgroundImage = `url('${imgUrl}')`;
    });
    galleryGrid.appendChild(div);
}

// VIP 功能
if(tagPeopleBtn) tagPeopleBtn.addEventListener('click', () => alert("VIP 功能：標註朋友"));
if(tagLocationBtn) tagLocationBtn.addEventListener('click', () => prompt("輸入地點:", "Taipei"));


// ==========================================
// 8. 基礎互動 (滑動/相機/Sheet)
// ==========================================
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

if(shutterBtn) shutterBtn.addEventListener('click', () => {
    actionSheet.style.transition = 'transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)';
    actionSheet.style.transform = 'translateY(0)';
    backdrop.classList.add('active');
});
if(backdrop) backdrop.addEventListener('click', () => {
    actionSheet.style.transition = 'transform 0.3s ease-out';
    actionSheet.style.transform = 'translateY(100%)';
    backdrop.classList.remove('active');
});

// 相機功能
if(takePhotoBtn) takePhotoBtn.addEventListener('click', () => { backdrop.click(); cameraInput.click(); });
if(cameraInput) cameraInput.addEventListener('change', (e) => handleImageUpload(e.target.files[0]));
if(chooseAlbumBtn) chooseAlbumBtn.addEventListener('click', () => { backdrop.click(); albumInput.click(); });
if(albumInput) albumInput.addEventListener('change', (e) => handleImageUpload(e.target.files[0]));

function getX(e) { return e.type.includes('mouse') ? e.pageX : e.touches[0].clientX; }
function getY(e) { return e.type.includes('mouse') ? e.pageY : e.touches[0].clientY; }
