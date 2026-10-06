
function setTheme(themeName) {
    
    document.documentElement.setAttribute('data-theme', themeName);
    localStorage.setItem('foodhub_theme', themeName);

    
    const iconSpan = document.getElementById('themeIcon');
    const labelSpan = document.getElementById('themeLabel');

    if (themeName === 'pandan'){
        if (iconSpan) iconSpan.innerText = '🍵';
        if (labelSpan) labelSpan.innerText = 'ใบเตย';
    } else {
        if (iconSpan) iconSpan.innerText = '🌶️';
        if (labelSpan) labelSpan.innerText = 'สว่าง';
    }

    document.querySelectorAll('.theme-dropdown-menu .dropdown-item').forEach(item => {
        item.classList.remove('active');
    });

    if (event && event.target) {
        event.target.classList.add('active');
    }
}


document.addEventListener('DOMContentLoaded', () => {
    const savedTheme = localStorage.getItem('foodhub_theme') || 'light';
    setTheme(savedTheme);
});

function filterMenu(category, clickedCard) {
    // 1. เปลี่ยนไฮไลต์การ์ดหมวดหมู่
    const allCards = document.querySelectorAll('.category-card');
    allCards.forEach(card => card.classList.remove('active'));
    clickedCard.classList.add('active');

    // 2. ซ่อน/แสดง เมนูอาหารตาม category
    const items = document.querySelectorAll('.menu-item-box');
    items.forEach(item => {
        const itemCat = item.getAttribute('data-category');
        if (category === 'all' || itemCat === category) {
            item.classList.remove('is-hidden');
        } else {
            item.classList.add('is-hidden');
        }
    });
}

let cart = [];

function addToCart(name, price) {
    
    const existingItem = cart.find(item => item.name === name);
    if (existingItem) {
        existingItem.quantity += 1;
    } else {
        cart.push({ name: name, price: price, quantity: 1 });
    }

    updateCartUI();

    const cartOffcanvas = new bootstrap.Offcanvas(document.getElementById('cartSidebar'));
    cartOffcanvas.show();
}

function updateCartUI() {
    const container = document.getElementById('cartItemsContainer');
    const badge = document.getElementById('cartCountBadge');
    const totalPriceEl = document.getElementById('cartTotalPrice');

    if (cart.length === 0) {
        container.innerHTML = `
            <div class="text-center text-muted py-5">
                <div class="fs-1 mb-2">🧺</div>
                <p>ยังไม่มีรายการอาหารในตะกร้า</p>
            </div>`;
        badge.innerText = '0';
        totalPriceEl.innerText = '฿0';
        return;
    }

    let total = 0;
    let totalItems = 0;
    let html = '<div class="d-flex flex-column gap-3">';

    cart.forEach((item, index) => {
        const itemTotal = item.price * item.quantity;
        total += itemTotal;
        totalItems += item.quantity;

        html += `
            <div class="d-flex align-items-center justify-content-between p-2 rounded border bg-body shadow-sm">
                <div>
                    <h6 class="fw-bold mb-1">${item.name}</h6>
                    <small class="text-muted">฿${item.price} x ${item.quantity}</small>
                </div>
                <div class="d-flex align-items-center gap-2">
                    <span class="fw-bold text-danger">฿${itemTotal}</span>
                    <button class="btn btn-sm btn-outline-danger" onclick="removeItem(${index})">✕</button>
                </div>
            </div>`;
    });

    html += '</div>';
    container.innerHTML = html;
    badge.innerText = totalItems;
    totalPriceEl.innerText = `฿${total}`;
}

function removeItem(index) {
    cart.splice(index, 1);
    updateCartUI();
}

function checkout() {
    if (cart.length === 0) {
        alert('กรุณาเลือกอาหารก่อนทำการสั่งซื้อครับ');
        return;
    }
    alert('บันทึกคำสั่งซื้อเรียบร้อยแล้ว!');
}

function showNutrition(name, calories, protein, carbs, fat) {
    document.getElementById('modalMenuName').innerText = name;
    document.getElementById('modalCalories').innerText = calories + ' kcal';
    document.getElementById('modalProtein').innerText = protein;
    document.getElementById('modalCarbs').innerText = carbs;
    document.getElementById('modalFat').innerText = fat;

    const modal = new bootstrap.Modal(document.getElementById('nutritionModal'));
    modal.show();
}

// ===== ค้นหาเมนูอาหาร =====
function searchMenu() {
    const input = document.getElementById('menuSearchInput');
    const clearBtn = document.getElementById('clearSearchBtn');
    const resultText = document.getElementById('searchResultText');
    const keyword = input.value.trim().toLowerCase();

    // แสดง/ซ่อนปุ่มกากบาท
    clearBtn.style.display = keyword ? 'block' : 'none';

    const items = document.querySelectorAll('.menu-item-box');
    let matchCount = 0;

    items.forEach(item => {
        const title = item.querySelector('.card-title').innerText.toLowerCase();
        if (keyword === '' || title.includes(keyword)) {
            item.classList.remove('is-hidden');
            matchCount++;
        } else {
            item.classList.add('is-hidden');
        }
    });

    // แสดงจำนวนผลลัพธ์
    if (keyword) {
        resultText.classList.remove('d-none');
        resultText.innerText = `พบ ${matchCount} เมนูที่ตรงกับ "${input.value.trim()}"`;
    } else {
        resultText.classList.add('d-none');
    }
}

function clearSearch() {
    const input = document.getElementById('menuSearchInput');
    input.value = '';
    searchMenu();
    input.focus();
}