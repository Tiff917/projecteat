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

// 資料庫變數
let db;
// ⚠️ 強制換新資料庫 v6，清除舊的錯誤資料
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
        if (db.objectStoreNames.contains(STORE_NAME)) {
            db.deleteObjectStore(STORE_NAME);
        }
        // 使用 autoIncrement: true 確保多圖存入
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
        store.createIndex('date', 'date', { unique: false });
    };

    request.onsuccess = (e) => {
        db = e.target.result;
        console.log("資料庫連線成功 (v6)");
        renderCalendar();
    };
}
initDB();

// ==========================================
// 3. 動態載入頁面 (防止重複載入)
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
                container.innerHTML = ''; // ⚠️ 這裡很重要：先清空再塞入
                container.appendChild(content);
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
                container.innerHTML = ''; // ⚠️ 先清空
                container.appendChild(content);
            }
        }
    } catch (error) {
        console.error('頁面載入失敗:', error);
    }
}
loadExternalPages();

// ==========================================
// 4. 繪製日曆 (解決重複問題)
// ==========================================
async function renderCalendar() {
    const calendarContainer = document.getElementById('calendarDays');
    if (!calendarContainer) return; 

    // ⚠️ 終極防禦：繪製前徹底清空容器，防止日曆疊加
    calendarContainer.innerHTML = ''; 

    const date = new Date();
    const year = date.getFullYear();
    const month = date.getMonth(); 
    
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const title = document.getElementById('calendarMonth');
    if(title) title.textContent = `${monthNames[month]} ${year}`;

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

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

            // 點擊事件
            dayCell.onclick = () => {
                openTimeline(dateString, photosGroup[dateString]);
            };
        }
        calendarContainer.appendChild(dayCell);
    }
}

// 輔助：抓取所有照片並分組
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
// 5. 批次上傳邏輯 (解決多圖只存一張的問題)
// ==========================================
function handleBatchUpload(files) {
    if (!files || files.length === 0) return;
    if (!db) return;

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    // 迴圈寫入資料庫
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

    // ⚠️ 全部寫完後，才執行這一次 (避免重複畫日曆)
    transaction.oncomplete = () => {
        console.log(`成功存入 ${files.length} 張照片`);
        
        // 更新首頁卡片 (顯示第一張當代表)
        const firstImgURL = URL.createObjectURL(files[0]);
        if(card) card.style.backgroundImage = `url('${firstImgURL}')`;

        renderCalendar();
        alert(`成功儲存 ${files.length} 張照片！`);
    };

    transaction.onerror = (e) => {
        console.error("上傳失敗", e);
    };
}

// ==========================================
// 6. 互動與監聽器
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

// 1. 拍照 (單張)
if(takePhotoBtn && cameraInput) {
    takePhotoBtn.addEventListener('click', () => {
        closeSheet();
        setTimeout(() => cameraInput.click(), 100);
    });
}
if(cameraInput) {
    cameraInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if(file) handleBatchUpload([file]); // 統一呼叫批次處理
    });
}

// 2. 相簿 (多張)
if(chooseAlbumBtn && albumInput) {
    chooseAlbumBtn.addEventListener('click', () => {
        closeSheet();
        setTimeout(() => albumInput.click(), 100);
    });
}
if(albumInput) {
    albumInput.addEventListener('change', (e) => {
        const files = e.target.files;
        if (files && files.length > 0) {
            handleBatchUpload(files);
        }
    });
}

// ==========================================
// 7. 時間軸與編輯頁面
// ==========================================
function openTimeline(dateStr, photosArray) {
    if(!timelinePage) return;
    timelinePage.classList.add('active');
    timelineTitle.textContent = dateStr;
    timelineContent.innerHTML = '';

    photosArray.sort((a, b) => a.timestamp - b.timestamp);

    photosArray.forEach(photo => {
        const imgUrl = URL.createObjectURL(photo.imageBlob);
        const item = document.createElement('div');
        item.classList.add('timeline-item');
        item.innerHTML = `
            <div class="timeline-card">
                <div class="timeline-img" style="background-image: url('${imgUrl}')"></div>
                <div class="timeline-caption">Time: ${photo.time}</div>
            </div>`;
        timelineContent.appendChild(item);
    });
}
if(closeTimelineBtn) closeTimelineBtn.addEventListener('click', () => timelinePage.classList.remove('active'));

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

// ==========================================
// 8. 頁面滑動邏輯 (保持原樣)
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
if(tagPeopleBtn) tagPeopleBtn.addEventListener('click', () => alert("VIP 功能"));
if(tagLocationBtn) tagLocationBtn.addEventListener('click', () => prompt("輸入地點:", "Taipei"));
function getX(e) { return e.type.includes('mouse') ? e.pageX : e.touches[0].clientX; }
function getY(e) { return e.type.includes('mouse') ? e.pageY : e.touches[0].clientY; }
