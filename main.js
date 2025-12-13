// ==========================================
// 1. 全域變數與設定
// ==========================================
const track = document.getElementById('track');
const topBar = document.getElementById('topBar');
const bottomBar = document.getElementById('bottomBar');
const card = document.querySelector('.card');

// 資料庫設定 (V8 保持不變，但我們不再自動塞資料)
let db;
const DB_NAME = 'GourmetDB_Final_v8'; 
const STORE_NAME = 'photos';
const DB_VERSION = 1;

// 頁面狀態
let currentPage = 1; 
let startX = 0, currentTranslate = -33.333, isDragging = false, startTranslate = 0;

// 日曆顯示狀態 (預設為今天)
let displayDate = new Date();

// ==========================================
// 2. 初始化資料庫 (純淨版：不自動匯入)
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
        renderCalendar(); // 資料庫連線後畫日曆
    };
}
initDB();

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
// 4. 繪製日曆 (含月份切換功能)
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
        const grouped = {};
        allPhotos.forEach(p => {
            if(!grouped[p.date]) grouped[p.date] = [];
            grouped[p.date].push(p);
        });

        // 重置容器
        container.innerHTML = '';
        const newContainer = container.cloneNode(true);
        container.parentNode.replaceChild(newContainer, container);
        const activeContainer = document.getElementById('calendarDays');

        // 使用 displayDate 來決定顯示哪個月
        const year = displayDate.getFullYear();
        const month = displayDate.getMonth();
        
        // 更新標題與切換按鈕
        const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        const headerContainer = document.getElementById('calendarMonth').parentNode;
        
        // 清空舊標題，改用動態生成的控制列
        // 檢查是否已經插入過控制列，避免重複
        if (!document.getElementById('calControls')) {
            const controls = document.createElement('div');
            controls.id = 'calControls';
            controls.className = 'calendar-controls';
            controls.innerHTML = `
                <button class="month-nav-btn" id="prevMonthBtn">&lt;</button>
                <span id="currentMonthLabel" style="font-size:18px; font-weight:600;">${monthNames[month]} ${year}</span>
                <button class="month-nav-btn" id="nextMonthBtn">&gt;</button>
            `;
            // 隱藏原本的純文字標題，插入新的控制列
            document.getElementById('calendarMonth').style.display = 'none';
            headerContainer.appendChild(controls);

            // 綁定按鈕事件
            document.getElementById('prevMonthBtn').onclick = () => changeMonth(-1);
            document.getElementById('nextMonthBtn').onclick = () => changeMonth(1);
        } else {
            // 已經有控制列，只需更新文字
            document.getElementById('currentMonthLabel').textContent = `${monthNames[month]} ${year}`;
        }

        // 計算日期
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const firstDay = new Date(year, month, 1).getDay();

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
                const sorted = grouped[dateStr].sort((a,b) => b.timestamp - a.timestamp);
                cell.style.backgroundImage = `url('${URL.createObjectURL(sorted[0].imageBlob)}')`;
                cell.textContent = '';
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

// 切換月份函式
function changeMonth(offset) {
    displayDate.setMonth(displayDate.getMonth() + offset);
    renderCalendar();
}

// ==========================================
// 5. 批次上傳 (真實選取照片)
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
        
        // 上傳完後，強制把日曆切換回「今天」，確保看得到剛傳的照片
        displayDate = new Date(); 
        renderCalendar();
        
        alert(`成功儲存 ${files.length} 張照片！`);
    };
}

// ==========================================
// 6. 限時動態 (Story Mode)
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

    photos.sort((a,b) => a.timestamp - b.timestamp);
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
// 7. 互動監聽 (確保按鈕功能正常)
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

// 相機 & 相簿 (連接 handleBatchUpload)
const camInput = document.getElementById('cameraInput');
const albInput = document.getElementById('albumInput');

if(takePhotoBtn && camInput) {
    takePhotoBtn.addEventListener('click', () => { closeSheet(); setTimeout(() => camInput.click(), 100); });
}
if(camInput) camInput.onchange = (e) => handleBatchUpload(e.target.files);

if(chooseAlbumBtn && albInput) {
    chooseAlbumBtn.addEventListener('click', () => { closeSheet(); setTimeout(() => albInput.click(), 100); });
}
if(albInput) albInput.onchange = (e) => handleBatchUpload(e.target.files);

// 滑動邏輯
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
    track.style.transform = `translateX(${startTranslate + (delta/window.innerWidth)*33.333}%)`;
}
window.addEventListener('mouseup', endDrag);
window.addEventListener('touchend', endDrag);
function endDrag(e) {
    if(!isDragging) return;
    isDragging = false;
    const endX = e.pageX || e.changedTouches[0].clientX;
    if (endX - startX > 50 && currentPage > 0) currentPage--;
    else if (startX - endX > 50 && currentPage < 2) currentPage++;
    updateCarousel();
}
function updateCarousel() {
    track.style.transition = 'transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)';
    track.style.transform = `translateX(-${currentPage * 33.333}%)`;
    
    // 頁面隱藏邏輯 (防遮擋)
    const pages = document.querySelectorAll('.page-container');
    pages.forEach((p, i) => {
        if(i === currentPage) {
            p.style.visibility = 'visible';
            p.style.pointerEvents = 'auto';
        } else {
            p.style.visibility = 'hidden';
            p.style.pointerEvents = 'none';
        }
    });

    const isHome = currentPage === 1;
    if(topBar) topBar.style.opacity = isHome ? 1 : 0;
    if(bottomBar) bottomBar.style.opacity = isHome ? 1 : 0;
}

// 其他按鈕
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
