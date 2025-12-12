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

// ==========================================
// 2. 初始化資料庫 (IndexedDB)
// ==========================================
function initDB() {
    const request = indexedDB.open(DB_NAME, 1);
    
    request.onerror = (e) => console.error("DB Error", e);
    
    request.onupgradeneeded = (e) => {
        db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME, { keyPath: 'date' });
        }
    };

    request.onsuccess = (e) => {
        db = e.target.result;
        console.log("資料庫連線成功");
        // 如果資料庫準備好了，嘗試畫一次日曆 (確保切換頁面時有資料)
        renderCalendar();
    };
}
initDB();

// ==========================================
// 3. 動態載入頁面 & 確保日曆繪製
// ==========================================
async function loadExternalPages() {
    try {
        // 載入 Memory
        const memoryRes = await fetch('memory.html');
        if (memoryRes.ok) {
            const text = await memoryRes.text();
            const doc = new DOMParser().parseFromString(text, 'text/html');
            const content = doc.querySelector('.page-content-wrapper');
            if(content) {
                const container = document.getElementById('page-memory');
                container.innerHTML = ''; 
                container.appendChild(content);
                
                // ⚠️ 關鍵修正：HTML 塞進去後，立刻畫日曆
                console.log("Memory 頁面載入完成，開始繪製日曆...");
                renderCalendar();
            }
        }

        // 載入 Community
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
// 4. 繪製日曆核心邏輯 (Render Calendar)
// ==========================================
async function renderCalendar() {
    const calendarContainer = document.getElementById('calendarDays');
    // 如果找不到容器 (HTML還沒載入)，就先離開，等 loadExternalPages 呼叫
    if (!calendarContainer) return; 

    calendarContainer.innerHTML = ''; // 清空

    const date = new Date();
    const year = date.getFullYear();
    const month = date.getMonth(); 

    // 設定月份標題
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const title = document.getElementById('calendarMonth');
    if(title) title.textContent = `${monthNames[month]} ${year}`;

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // 取得資料庫所有照片
    const photosMap = await getAllPhotosMap();

    // 空白格
    for (let i = 0; i < firstDay; i++) {
        calendarContainer.appendChild(document.createElement('div'));
    }

    // 日期格
    for (let day = 1; day <= daysInMonth; day++) {
        const dayCell = document.createElement('div');
        dayCell.classList.add('day-cell');
        dayCell.textContent = day;

        // 組成 YYYY-MM-DD
        const currentMonthStr = (month + 1).toString().padStart(2, '0');
        const currentDayStr = day.toString().padStart(2, '0');
        const dateString = `${year}-${currentMonthStr}-${currentDayStr}`;

        // 如果這天有照片
        if (photosMap[dateString]) {
            dayCell.classList.add('has-photo');
            const imgUrl = URL.createObjectURL(photosMap[dateString]);
            dayCell.style.backgroundImage = `url('${imgUrl}')`;
            dayCell.textContent = ''; // 有照片就不顯示數字 (或保留看你喜好)
            
            // 點擊事件：換首頁圖
            dayCell.onclick = () => {
                card.style.backgroundImage = `url('${imgUrl}')`;
                // 自動滑回首頁
                currentTranslate = -33.333;
                currentPage = 1;
                updateCarousel();
            };
        }
        calendarContainer.appendChild(dayCell);
    }
}

function getAllPhotosMap() {
    return new Promise((resolve) => {
        if (!db) { resolve({}); return; }
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();
        request.onsuccess = (e) => {
            const results = e.target.result;
            const map = {};
            if(results){
                results.forEach(item => { map[item.date] = item.imageBlob; });
            }
            resolve(map);
        };
    });
}

// ==========================================
// 5. 圖片處理 (存入 DB + 預覽)
// ==========================================
function handleImageUpload(file) {
    if (!file) return;

    // 1. 預覽
    const imageURL = URL.createObjectURL(file);
    card.style.backgroundImage = `url('${imageURL}')`;

    // 2. 存入 DB
    if (!db) return;
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put({
        date: today,
        imageBlob: file
    });

    request.onsuccess = () => {
        console.log("照片已存檔:", today);
        renderCalendar(); // 存完後立刻重畫日曆
        alert("照片已記錄到今天的回憶中！");
    };
}


// ==========================================
// 6. 滑動與 UI 互動邏輯 (保持原本)
// ==========================================
track.addEventListener('mousedown', pageDragStart);
track.addEventListener('touchstart', pageDragStart);

function pageDragStart(e) {
    if (isDraggingSheet) return;
    isDraggingPage = true; 
    isHorizontalMove = false;
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
        const screenWidth = window.innerWidth;
        const movePercent = (deltaX / screenWidth) * 33.333;
        let nextTranslate = startTranslate + movePercent;
        if (nextTranslate > 0 || nextTranslate < -66.666) nextTranslate = startTranslate + (movePercent * 0.3);
        currentTranslate = nextTranslate;
        track.style.transform = `translateX(${currentTranslate}%)`;
    }
}

function pageDragEnd(e) {
    if (!isDraggingPage && !isHorizontalMove) { cleanupPageDrag(); return; }
    isDraggingPage = false;
    const movedBy = currentTranslate - startTranslate;
    const threshold = 5; 
    if (movedBy < -threshold && currentPage < 2) currentPage++; 
    else if (movedBy > threshold && currentPage > 0) currentPage--; 
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

// Action Sheet & Profile
openProfileBtn.addEventListener('click', () => profilePage.classList.add('active'));
closeProfileBtn.addEventListener('click', () => profilePage.classList.remove('active'));
logoutBtn.addEventListener('click', () => alert('Log out clicked'));

shutterBtn.addEventListener('click', () => {
    actionSheet.style.transition = 'transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)';
    actionSheet.style.transform = 'translateY(0)';
    backdrop.classList.add('active');
});
backdrop.addEventListener('click', () => {
    actionSheet.style.transition = 'transform 0.3s ease-out';
    actionSheet.style.transform = 'translateY(100%)';
    backdrop.classList.remove('active');
});

// Camera Inputs
takePhotoBtn.addEventListener('click', () => { backdrop.click(); cameraInput.click(); });
cameraInput.addEventListener('change', (e) => handleImageUpload(e.target.files[0]));
chooseAlbumBtn.addEventListener('click', () => { backdrop.click(); albumInput.click(); });
albumInput.addEventListener('change', (e) => handleImageUpload(e.target.files[0]));

function getX(e) { return e.type.includes('mouse') ? e.pageX : e.touches[0].clientX; }
function getY(e) { return e.type.includes('mouse') ? e.pageY : e.touches[0].clientY; }
