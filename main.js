// ==========================================
// 1. 全域變數
// ==========================================
const track = document.getElementById('track');
const topBar = document.getElementById('topBar');
const bottomBar = document.getElementById('bottomBar');
const card = document.querySelector('.card');

// 資料庫設定 (V8 強制重置)
let db;
const DB_NAME = 'GourmetDB_AutoData_v8'; 
const STORE_NAME = 'photos';
const DB_VERSION = 1;

let currentPage = 1; // 1 = Home
let startX = 0, currentTranslate = -33.333, isDragging = false, startTranslate = 0;

// ==========================================
// 2. 初始化資料庫 & 自動匯入假照片
// ==========================================
function initDB() {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
        db = e.target.result;
        if (db.objectStoreNames.contains(STORE_NAME)) db.deleteObjectStore(STORE_NAME);
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
    };
    request.onsuccess = (e) => {
        db = e.target.result;
        console.log("資料庫就緒");
        // 初始化後，檢查並匯入假資料
        initDummyData(); 
    };
}
initDB();

// 🔥 自動匯入假照片 (讓你有東西可以點)
async function initDummyData() {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const countReq = store.count();

    countReq.onsuccess = async () => {
        if (countReq.result === 0) {
            console.log("資料庫是空的，正在匯入假照片...");
            const dummyImages = [
                'https://images.unsplash.com/photo-1546069901-ba9599a7e63c', // 沙拉
                'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38', // 披薩
                'https://images.unsplash.com/photo-1482049016688-2d3e1b311543'  // 三明治
            ];
            
            for (let i = 0; i < dummyImages.length; i++) {
                try {
                    // 去網路抓圖片轉成 Blob
                    const response = await fetch(dummyImages[i]);
                    const blob = await response.blob();
                    
                    // 偽造時間 (今天的不同時間點)
                    const now = new Date();
                    const timeOffset = now.getTime() + (i * 10000); // 錯開時間
                    const todayStr = now.toISOString().split('T')[0];
                    const timeStr = new Date(timeOffset).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});

                    // 存入 DB
                    const tx = db.transaction([STORE_NAME], 'readwrite');
                    tx.objectStore(STORE_NAME).add({
                        date: todayStr,
                        time: timeStr,
                        imageBlob: blob,
                        timestamp: timeOffset
                    });
                } catch (err) {
                    console.error("假照片下載失敗", err);
                }
            }
            // 存完後畫日曆
            setTimeout(() => {
                alert("已自動匯入 3 張範例照片，請查看日曆！");
                renderCalendar();
            }, 2000);
        } else {
            renderCalendar();
        }
    };
}

// ==========================================
// 3. 載入外部頁面
// ==========================================
async function loadExternalPages() {
    try {
        const memoryRes = await fetch('memory.html');
        if (memoryRes.ok) {
            document.getElementById('page-memory').innerHTML = await memoryRes.text();
            renderCalendar();
        }
        const communityRes = await fetch('community.html');
        if (communityRes.ok) {
            document.getElementById('page-community').innerHTML = await communityRes.text();
        }
    } catch(e) {}
}
loadExternalPages();

// ==========================================
// 4. 繪製日曆 (包含點擊修復)
// ==========================================
async function renderCalendar() {
    const container = document.getElementById('calendarDays');
    if (!container) return;
    
    // 重新抓取資料
    const tx = db.transaction([STORE_NAME], 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    
    req.onsuccess = (e) => {
        const allPhotos = e.target.result;
        // 分組
        const grouped = {};
        allPhotos.forEach(p => {
            if(!grouped[p.date]) grouped[p.date] = [];
            grouped[p.date].push(p);
        });

        // 清空重畫
        container.innerHTML = '';
        const newContainer = container.cloneNode(true);
        container.parentNode.replaceChild(newContainer, container);
        const activeContainer = document.getElementById('calendarDays');

        // 日期計算
        const date = new Date();
        const year = date.getFullYear(), month = date.getMonth();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const firstDay = new Date(year, month, 1).getDay();

        // 標題
        const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        const title = document.getElementById('calendarMonth');
        if(title) title.textContent = `${monthNames[month]} ${year}`;

        // 空白格
        for(let i=0; i<firstDay; i++) activeContainer.appendChild(document.createElement('div'));

        // 日期格
        for(let d=1; d<=daysInMonth; d++) {
            const cell = document.createElement('div');
            cell.className = 'day-cell';
            cell.textContent = d;
            
            const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
            
            if(grouped[dateStr] && grouped[dateStr].length > 0) {
                cell.classList.add('has-photo');
                // 排序最新
                const sorted = grouped[dateStr].sort((a,b) => b.timestamp - a.timestamp);
                cell.style.backgroundImage = `url('${URL.createObjectURL(sorted[0].imageBlob)}')`;
                cell.textContent = '';
                
                // 綁定資料
                cell.dataset.date = dateStr;
            }
            activeContainer.appendChild(cell);
        }

        // 監聽點擊
        activeContainer.addEventListener('click', (e) => {
            const cell = e.target.closest('.day-cell');
            if(cell && cell.classList.contains('has-photo')) {
                const dateStr = cell.dataset.date;
                if(grouped[dateStr]) openStoryMode(dateStr, grouped[dateStr]);
            }
        });
    };
}

// ==========================================
// 5. 限時動態 (Story Mode)
// ==========================================
function openStoryMode(dateStr, photos) {
    let page = document.getElementById('storyPage');
    if(!page) {
        page = document.createElement('div');
        page.id = 'storyPage';
        Object.assign(page.style, {
            position:'fixed', top:'0', left:'0', width:'100%', height:'100%',
            backgroundColor:'#000', zIndex:'9999', transform:'translateY(100%)',
            transition:'transform 0.3s', display:'flex', flexDirection:'column'
        });
        page.innerHTML = `<div id="storyContent" style="width:100%;height:100%;"></div>`;
        document.body.appendChild(page);
    }

    // 播放邏輯
    photos.sort((a,b) => a.timestamp - b.timestamp); // 舊到新
    let idx = 0;
    
    function show() {
        if(idx >= photos.length) {
            page.style.transform = 'translateY(100%)';
            return;
        }
        if(idx < 0) idx = 0;
        
        const url = URL.createObjectURL(photos[idx].imageBlob);
        const player = document.getElementById('storyContent');
        player.innerHTML = `
            <div class="story-container">
                <div class="story-img-box" style="background-image:url('${url}')"></div>
                <div class="story-info">${dateStr} ${photos[idx].time} (${idx+1}/${photos.length})</div>
                <div style="position:absolute;top:0;left:0;width:50%;height:100%;z-index:20;" onclick="event.stopPropagation(); window.storyPrev()"></div>
                <div style="position:absolute;top:0;right:0;width:50%;height:100%;z-index:20;" onclick="event.stopPropagation(); window.storyNext()"></div>
                <div style="position:absolute;top:40px;right:20px;color:white;font-size:30px;z-index:30;" onclick="document.getElementById('storyPage').style.transform='translateY(100%)'">&times;</div>
            </div>
        `;
    }
    
    window.storyPrev = () => { idx--; show(); };
    window.storyNext = () => { idx++; show(); };

    setTimeout(() => {
        page.style.transform = 'translateY(0)';
        show();
    }, 10);
}

// ==========================================
// 6. 滑動邏輯 (修復遮擋)
// ==========================================
function updateCarousel() {
    track.style.transition = 'transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)';
    track.style.transform = `translateX(-${currentPage * 33.333}%)`;
    
    // 隱藏非當前頁面，防止點擊穿透或遮擋
    const pages = document.querySelectorAll('.page-container');
    pages.forEach((p, i) => {
        if(i === currentPage) {
            p.style.visibility = 'visible';
            p.style.pointerEvents = 'auto';
        } else {
            p.style.visibility = 'hidden'; // 關鍵：隱藏隔壁頁面
            p.style.pointerEvents = 'none';
        }
    });

    const isHome = currentPage === 1;
    if(topBar) topBar.style.opacity = isHome ? 1 : 0;
    if(bottomBar) bottomBar.style.opacity = isHome ? 1 : 0;
}

track.addEventListener('mousedown', startDrag);
track.addEventListener('touchstart', startDrag);
function startDrag(e) { 
    isDragging = true; startX = e.pageX || e.touches[0].clientX; startTranslate = -currentPage * 33.333; 
    track.style.transition = 'none';
}
window.addEventListener('mousemove', moveDrag);
window.addEventListener('touchmove', moveDrag, {passive:false});
function moveDrag(e) {
    if(!isDragging) return;
    const x = e.pageX || e.touches[0].clientX;
    const delta = x - startX;
    // 簡單判斷
    track.style.transform = `translateX(${startTranslate + (delta/window.innerWidth)*33.333}%)`;
}
window.addEventListener('mouseup', endDrag);
window.addEventListener('touchend', endDrag);
function endDrag(e) {
    if(!isDragging) return;
    isDragging = false;
    // 這裡做簡化判斷，實際可根據 delta 決定翻頁
    const endX = e.pageX || e.changedTouches[0].clientX;
    if (endX - startX > 50 && currentPage > 0) currentPage--;
    else if (startX - endX > 50 && currentPage < 2) currentPage++;
    updateCarousel();
}

// 綁定其他按鈕 (Action Sheet 等) - 這裡保留您原本的邏輯
// 請確保 HTML ID 存在
const backdrop = document.getElementById('backdrop');
const actionSheet = document.getElementById('actionSheet');
if(document.getElementById('shutterBtn')) {
    document.getElementById('shutterBtn').onclick = () => {
        actionSheet.style.transform = 'translateY(0)';
        backdrop.classList.add('active');
    };
}
if(backdrop) backdrop.onclick = () => {
    actionSheet.style.transform = 'translateY(100%)';
    backdrop.classList.remove('active');
};
// 拍照與相簿
const camInput = document.getElementById('cameraInput');
const albInput = document.getElementById('albumInput');
if(document.getElementById('takePhotoBtn')) document.getElementById('takePhotoBtn').onclick = () => { backdrop.click(); camInput.click(); };
if(document.getElementById('chooseAlbumBtn')) document.getElementById('chooseAlbumBtn').onclick = () => { backdrop.click(); albInput.click(); };

if(camInput) camInput.onchange = (e) => handleUpload(e.target.files);
if(albInput) albInput.onchange = (e) => handleUpload(e.target.files);

function handleUpload(files) {
    if(!files.length) return;
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const tx = db.transaction([STORE_NAME], 'readwrite');
    Array.from(files).forEach((f, i) => {
        tx.objectStore(STORE_NAME).add({
            date: today,
            time: new Date().toLocaleTimeString(),
            imageBlob: f,
            timestamp: now.getTime() + i
        });
    });
    tx.oncomplete = () => {
        if(card) card.style.backgroundImage = `url('${URL.createObjectURL(files[0])}')`;
        renderCalendar();
        alert("已儲存！");
    };
}
