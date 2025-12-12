// ==========================================
// 1. 全域變數與 DOM 元素取得
// ==========================================
const track = document.getElementById('track');
const topBar = document.getElementById('topBar');
const bottomBar = document.getElementById('bottomBar');

// 個人頁面相關
const profilePage = document.getElementById('profilePage');
const openProfileBtn = document.getElementById('openProfileBtn');
const closeProfileBtn = document.getElementById('closeProfileBtn');
const logoutBtn = document.querySelector('.logout-btn');

// Action Sheet 相關
const actionSheet = document.getElementById('actionSheet');
const backdrop = document.getElementById('backdrop');
const shutterBtn = document.getElementById('shutterBtn');

// 相機與相簿相關
const takePhotoBtn = document.getElementById('takePhotoBtn');
const chooseAlbumBtn = document.getElementById('chooseAlbumBtn');
const cameraInput = document.getElementById('cameraInput');
const albumInput = document.getElementById('albumInput');
const card = document.querySelector('.card'); // 要更換背景的卡片

// 狀態變數
let currentPage = 1; // 0: Memory, 1: Home, 2: Community
let startX = 0; 
let startY = 0;
let currentTranslate = -33.333; // 初始在中間
let isDraggingPage = false;
let startTranslate = 0;
let isHorizontalMove = false;

// Action Sheet 拖曳變數
let isDraggingSheet = false;
let sheetStartY = 0;

// ==========================================
// 2. 動態載入頁面內容 (Fetch API)
// ==========================================
async function loadExternalPages() {
    try {
        // 載入 Memory (左頁)
        const memoryRes = await fetch('memory.html');
        if (memoryRes.ok) {
            const text = await memoryRes.text();
            const doc = new DOMParser().parseFromString(text, 'text/html');
            const content = doc.querySelector('.page-content-wrapper');
            if(content) {
                const container = document.getElementById('page-memory');
                container.innerHTML = ''; 
                container.appendChild(content);
            }
        }

        // 載入 Community (右頁)
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
        console.error('頁面載入失敗 (請確認是否使用 Local Server):', error);
    }
}

// 執行載入
loadExternalPages();

// ==========================================
// 3. 左右滑動邏輯 (Carousel Swipe)
// ==========================================
track.addEventListener('mousedown', pageDragStart);
track.addEventListener('touchstart', pageDragStart);

function pageDragStart(e) {
    // 如果正在拖曳 Action Sheet，就不觸發頁面滑動
    if (isDraggingSheet) return; 

    isDraggingPage = true; 
    isHorizontalMove = false;
    startX = getX(e); 
    startY = getY(e);
    startTranslate = -currentPage * 33.333;
    
    track.style.transition = 'none';

    window.addEventListener('mousemove', pageDragMove);
    window.addEventListener('touchmove', pageDragMove, {passive: false});
    window.addEventListener('mouseup', pageDragEnd);
    window.addEventListener('touchend', pageDragEnd);
}

function pageDragMove(e) {
    if (!isDraggingPage) return;
    
    const currentX = getX(e);
    const currentY = getY(e);
    const deltaX = currentX - startX;
    const deltaY = currentY - startY;

    // 判斷是否為橫向滑動 (X軸移動 > 10 且 > Y軸移動)
    if (!isHorizontalMove && (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10)) {
        if (Math.abs(deltaX) > Math.abs(deltaY)) {
            isHorizontalMove = true;
        } else {
            isDraggingPage = false; 
            pageDragEnd(e);
            return; 
        }
    }

    if (isHorizontalMove) {
        if(e.cancelable) e.preventDefault(); 
        
        const screenWidth = window.innerWidth;
        const movePercent = (deltaX / screenWidth) * 33.333;
        let nextTranslate = startTranslate + movePercent;

        // 邊界阻力 (第一頁往右或最後一頁往左時增加阻力)
        if (nextTranslate > 0 || nextTranslate < -66.666) {
            nextTranslate = startTranslate + (movePercent * 0.3);
        }

        currentTranslate = nextTranslate;
        track.style.transform = `translateX(${currentTranslate}%)`;
    }
}

function pageDragEnd(e) {
    if (!isDraggingPage && !isHorizontalMove) {
        cleanupPageDrag();
        return;
    }

    isDraggingPage = false;
    const movedBy = currentTranslate - startTranslate;
    const threshold = 5; 

    if (movedBy < -threshold && currentPage < 2) {
        currentPage++; 
    } else if (movedBy > threshold && currentPage > 0) {
        currentPage--; 
    }

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
    
    // 如果在非首頁，隱藏 Top/Bottom Bar
    const isHome = (currentPage === 1);
    topBar.style.opacity = isHome ? '1' : '0';
    bottomBar.style.opacity = isHome ? '1' : '0';
    topBar.style.pointerEvents = isHome ? 'auto' : 'none';
    bottomBar.style.pointerEvents = isHome ? 'auto' : 'none';
}

// ==========================================
// 4. 個人頁面 (Profile) 邏輯
// ==========================================
openProfileBtn.addEventListener('click', () => profilePage.classList.add('active'));
closeProfileBtn.addEventListener('click', () => profilePage.classList.remove('active'));
logoutBtn.addEventListener('click', () => alert('Log out clicked'));


// ==========================================
// 5. Action Sheet 邏輯
// ==========================================
shutterBtn.addEventListener('click', () => {
    actionSheet.style.transition = 'transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)';
    actionSheet.style.transform = 'translateY(0)';
    backdrop.classList.add('active');
});

backdrop.addEventListener('click', closeSheet);

function closeSheet() {
    actionSheet.style.transition = 'transform 0.3s ease-out';
    actionSheet.style.transform = 'translateY(100%)';
    backdrop.classList.remove('active');
}

// ==========================================
// 6. 相機與相簿功能 (Camera Logic)
// ==========================================

// --- A. 立即拍照 ---
takePhotoBtn.addEventListener('click', () => {
    closeSheet(); // 1. 關閉選單
    cameraInput.click(); // 2. 觸發隱藏的相機 input
});

// 當相機拍完照回來時
cameraInput.addEventListener('change', (e) => {
    handleImageUpload(e.target.files[0]);
});

// --- B. 從相簿選擇 ---
chooseAlbumBtn.addEventListener('click', () => {
    closeSheet(); // 1. 關閉選單
    albumInput.click(); // 2. 觸發隱藏的相簿 input
});

// 當選完照片回來時
albumInput.addEventListener('change', (e) => {
    handleImageUpload(e.target.files[0]);
});

// --- C. 處理圖片並顯示在 Card 上 ---
function handleImageUpload(file) {
    if (file) {
        // 建立一個臨時的圖片網址 (Blob URL)
        const imageURL = URL.createObjectURL(file);
        
        // 將卡片的背景圖換成剛剛拍/選的照片
        card.style.backgroundImage = `url('${imageURL}')`;
        
        console.log("照片已載入:", file.name);
    }
}

// ==========================================
// 7. 輔助函式
// ==========================================
function getX(e) { return e.type.includes('mouse') ? e.pageX : e.touches[0].clientX; }
function getY(e) { return e.type.includes('mouse') ? e.pageY : e.touches[0].clientY; }
