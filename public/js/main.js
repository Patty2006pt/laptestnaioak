function setTheme(themeName, clickedEl) {
    document.documentElement.setAttribute('data-theme', themeName);
    localStorage.setItem('foodhub_theme', themeName);

    const iconSpan = document.getElementById('themeIcon');
    const labelSpan = document.getElementById('themeLabel');

    if (themeName === 'pandan') {
        if (iconSpan) iconSpan.innerText = '🍵';
        if (labelSpan) labelSpan.innerText = 'ใบเตย';
    } else {
        if (iconSpan) iconSpan.innerText = '🌶️';
        if (labelSpan) labelSpan.innerText = 'สว่าง';
    }

    document.querySelectorAll('.theme-dropdown-menu .dropdown-item').forEach((item) => {
        item.classList.remove('active');
        if (item.dataset.themeOption === themeName) {
            item.classList.add('active');
        }
    });

    if (clickedEl) {
        clickedEl.classList.add('active');
    }
}

let cartState = window.__FOODHUB_CART__ || { items: [], totalCount: 0, totalPrice: 0 };

document.addEventListener('DOMContentLoaded', () => {
    const savedTheme = localStorage.getItem('foodhub_theme') || 'light';
    setTheme(savedTheme);

    if (document.getElementById('cartItemsContainer')) {
        updateCartUI(cartState);
    }
});

function filterMenu(category, clickedCard) {
    const allCards = document.querySelectorAll('.category-card');
    allCards.forEach((card) => card.classList.remove('active'));
    if (clickedCard) {
        clickedCard.classList.add('active');
    }

    const items = document.querySelectorAll('.menu-item-box');
    items.forEach((item) => {
        const itemCat = item.getAttribute('data-category');
        if (category === 'all' || itemCat === category) {
            item.classList.remove('is-hidden');
        } else {
            item.classList.add('is-hidden');
        }
    });
}

function showLoginRequiredModal(foodName) {
    const msgEl = document.getElementById('loginRequiredMessage');
    if (msgEl) {
        msgEl.textContent = foodName
            ? `กรุณาเข้าสู่ระบบก่อนเลือก "${foodName}" ลงตะกร้า`
            : 'คุณต้องเข้าสู่ระบบก่อนจึงจะสามารถเลือกอาหารลงตะกร้าได้';
    }

    const modalEl = document.getElementById('loginRequiredModal');
    if (modalEl && typeof bootstrap !== 'undefined' && bootstrap.Modal) {
        const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
        modal.show();
    } else {
        window.location.href = '/login';
    }
}

function requireAuthForFood(foodName) {
    const user = typeof getCurrentUser === 'function' ? getCurrentUser() : window.__FOODHUB_USER__;
    if (user) {
        return true;
    }
    showLoginRequiredModal(foodName);
    return false;
}

function openCartSidebar() {
    const sidebarEl = document.getElementById('cartSidebar');
    if (!sidebarEl || typeof bootstrap === 'undefined' || !bootstrap.Offcanvas) return;
    const cartOffcanvas = bootstrap.Offcanvas.getOrCreateInstance(sidebarEl);
    cartOffcanvas.show();
}

async function addToCart(productId, btnEl) {
    const card = btnEl ? btnEl.closest('.menu-item-box') : null;
    const foodName = card ? card.querySelector('.card-title')?.textContent?.trim() : '';

    if (!requireAuthForFood(foodName)) {
        return;
    }

    try {
        const res = await fetch('/api/cart/add', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ productId, quantity: 1 })
        });

        if (res.status === 401) {
            showLoginRequiredModal(foodName);
            return;
        }

        const data = await res.json();
        if (!res.ok) {
            alert(data.error || 'ไม่สามารถเพิ่มรายการลงตะกร้าได้');
            return;
        }

        updateCartUI(data);
        openCartSidebar();
    } catch {
        alert('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้');
    }
}

function updateCartUI(cart) {
    cartState = cart || { items: [], totalCount: 0, totalPrice: 0 };
    const container = document.getElementById('cartItemsContainer');
    const badge = document.getElementById('cartCountBadge');
    const menuCartCount = document.getElementById('menuCartCount');
    const totalPriceEl = document.getElementById('cartTotalPrice');

    if (!container || !badge || !totalPriceEl) return;

    badge.textContent = String(cartState.totalCount || 0);
    if (menuCartCount) {
        menuCartCount.textContent = String(cartState.totalCount || 0);
    }
    totalPriceEl.textContent = `฿${cartState.totalPrice || 0}`;

    container.innerHTML = '';

    if (!cartState.items || cartState.items.length === 0) {
        const emptyDiv = document.createElement('div');
        emptyDiv.className = 'text-center text-muted py-5';
        emptyDiv.id = 'emptyCartMsg';
        emptyDiv.innerHTML = '<div class="fs-1 mb-2">🧺</div><p>ยังไม่มีรายการอาหารในตะกร้า</p>';
        container.appendChild(emptyDiv);
        return;
    }

    const list = document.createElement('div');
    list.className = 'd-flex flex-column gap-3';

    cartState.items.forEach((item) => {
        const row = document.createElement('div');
        row.className = 'd-flex align-items-center justify-content-between p-2 rounded border bg-body shadow-sm';

        const info = document.createElement('div');
        const title = document.createElement('h6');
        title.className = 'fw-bold mb-1';
        title.textContent = item.name;
        const unit = document.createElement('small');
        unit.className = 'text-muted';
        unit.textContent = `฿${item.price} x ${item.quantity}`;
        info.appendChild(title);
        info.appendChild(unit);

        const actions = document.createElement('div');
        actions.className = 'd-flex align-items-center gap-2';
        const priceSpan = document.createElement('span');
        priceSpan.className = 'fw-bold text-danger';
        priceSpan.textContent = `฿${item.price * item.quantity}`;

        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'btn btn-sm btn-outline-danger';
        removeBtn.textContent = '✕';
        removeBtn.addEventListener('click', () => removeItem(item.productId));

        actions.appendChild(priceSpan);
        actions.appendChild(removeBtn);
        row.appendChild(info);
        row.appendChild(actions);
        list.appendChild(row);
    });

    container.appendChild(list);
}

async function removeItem(productId) {
    try {
        const res = await fetch(`/api/cart/${productId}`, { method: 'DELETE' });
        if (res.status === 401) {
            showLoginRequiredModal();
            return;
        }
        const data = await res.json();
        if (res.ok) {
            updateCartUI(data);
        }
    } catch {
        alert('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้');
    }
}

async function checkout() {
    if (!requireAuthForFood()) {
        return;
    }
    if (!cartState.items || cartState.items.length === 0) {
        alert('กรุณาเลือกอาหารก่อนทำการสั่งซื้อครับ');
        return;
    }

    try {
        const res = await fetch('/api/cart/checkout', { method: 'POST' });
        if (res.status === 401) {
            showLoginRequiredModal();
            return;
        }
        const data = await res.json();
        if (!res.ok) {
            alert(data.error || 'ไม่สามารถยืนยันคำสั่งซื้อได้');
            return;
        }
        updateCartUI(data.cart);
        alert(`บันทึกคำสั่งซื้อ #${data.orderId} เรียบร้อยแล้ว! (ยอดรวม ฿${data.totalPrice})`);
    } catch {
        alert('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้');
    }
}

function showNutritionFromBtn(btn) {
    const { name, calories, protein, carbs, fat } = btn.dataset;
    showNutrition(name, calories, protein, carbs, fat);
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

function searchMenu() {
    const input = document.getElementById('menuSearchInput');
    const clearBtn = document.getElementById('clearSearchBtn');
    const resultText = document.getElementById('searchResultText');
    const keyword = input.value.trim().toLowerCase();

    clearBtn.style.display = keyword ? 'block' : 'none';

    const items = document.querySelectorAll('.menu-item-box');
    let matchCount = 0;

    items.forEach((item) => {
        const title = item.querySelector('.card-title').innerText.toLowerCase();
        if (keyword === '' || title.includes(keyword)) {
            item.classList.remove('is-hidden');
            matchCount++;
        } else {
            item.classList.add('is-hidden');
        }
    });

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
