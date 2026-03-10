const CIRCUMFERENCE = 2 * Math.PI * 85;

const ACTIVITY_FACTORS = {
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.55,
    active: 1.725,
    veryActive: 1.9
};

const PROTEIN_PER_KG = {
    sedentary: 1.2,
    light: 1.4,
    moderate: 1.6,
    active: 1.8,
    veryActive: 2.2
};

const GOAL_ADJUSTMENT = { lose: -500, maintain: 0, gain: 400 };

const MEAL_LABELS = {
    breakfast: 'ארוחת בוקר',
    lunch: 'ארוחת צהריים',
    dinner: 'ארוחת ערב',
    snack: 'חטיף'
};

const MEAL_ORDER = ['breakfast', 'lunch', 'dinner', 'snack'];

const CATEGORIES = [
    'הכל', 'מוצרים שלי', 'חלבונים', 'מוצרי חלב', 'פחמימות', 'ירקות', 'פירות',
    'מאכלים מוכנים', 'קטניות ודגנים', 'שומנים ושמנים', 'חטיפים ומתוקים', 'משקאות'
];

const USER_COLORS = [
    '#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6',
    '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16'
];

const state = {
    users: [],
    currentUserId: null,
    profile: null,
    currentDate: new Date(),
    dailyLog: [],
    goals: { calories: 0, protein: 0, carbs: 0, fat: 0 },
    customFoods: [],
    selectedFood: null,
    selectedMeal: 'breakfast',
    activeCategory: null,
    searchQuery: ''
};

// ==================== HELPERS ====================

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

function uKey(key) {
    return `${state.currentUserId}_${key}`;
}

function getCurrentUser() {
    return state.users.find(u => u.id === state.currentUserId);
}

// ==================== INIT ====================

document.addEventListener('DOMContentLoaded', init);

function init() {
    migrateOldData();
    loadUsers();
    setupEventListeners();
    setupCategoryPills();
    setMealByTime();

    if (!state.users.length) {
        showModal('user-modal', true);
        return;
    }

    const savedUserId = localStorage.getItem('nutrition_current_user');
    const userExists = state.users.some(u => u.id === savedUserId);

    if (savedUserId && userExists) {
        state.currentUserId = savedUserId;
        enterApp();
    } else {
        showModal('user-modal', true);
    }
}

function enterApp() {
    renderUserHeader();
    loadCustomFoods();
    loadProfile();
    if (!state.profile) {
        showModal('profile-modal', true);
    } else {
        calculateGoals();
        loadDailyLog();
        renderAll();
    }
}

function setMealByTime() {
    const hour = new Date().getHours();
    if (hour < 11) state.selectedMeal = 'breakfast';
    else if (hour < 15) state.selectedMeal = 'lunch';
    else if (hour < 21) state.selectedMeal = 'dinner';
    else state.selectedMeal = 'snack';
}

// ==================== USER MANAGEMENT ====================

function loadUsers() {
    const data = localStorage.getItem('nutrition_users');
    state.users = data ? JSON.parse(data) : [];
}

function saveUsers() {
    localStorage.setItem('nutrition_users', JSON.stringify(state.users));
}

function createUser(name) {
    const color = USER_COLORS[state.users.length % USER_COLORS.length];
    const user = { id: generateId(), name, color, createdAt: new Date().toISOString() };
    state.users.push(user);
    saveUsers();
    return user;
}

function switchUser(userId) {
    state.currentUserId = userId;
    localStorage.setItem('nutrition_current_user', userId);
    state.profile = null;
    state.dailyLog = [];
    state.customFoods = [];
    state.currentDate = new Date();
    state.goals = { calories: 0, protein: 0, carbs: 0, fat: 0 };
    hideModal('user-modal');
    enterApp();
}

function deleteUser(userId) {
    if (state.users.length <= 1) return;

    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(userId + '_')) {
            keysToRemove.push(key);
        }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));

    state.users = state.users.filter(u => u.id !== userId);
    saveUsers();

    if (state.currentUserId === userId) {
        switchUser(state.users[0].id);
    }
    renderUserGrid();
}

function migrateOldData() {
    if (localStorage.getItem('nutrition_users')) return;

    const oldProfile = localStorage.getItem('nutrition_profile');
    if (!oldProfile) return;

    const userId = generateId();
    const users = [{ id: userId, name: 'משתמש', color: USER_COLORS[0], createdAt: new Date().toISOString() }];

    const keysToMigrate = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key === 'nutrition_profile' || (key && key.startsWith('nutrition_log_'))) {
            keysToMigrate.push(key);
        }
    }

    keysToMigrate.forEach(key => {
        const data = localStorage.getItem(key);
        if (key === 'nutrition_profile') {
            localStorage.setItem(`${userId}_profile`, data);
        } else {
            const dateKey = key.replace('nutrition_log_', '');
            localStorage.setItem(`${userId}_log_${dateKey}`, data);
        }
        localStorage.removeItem(key);
    });

    localStorage.setItem('nutrition_users', JSON.stringify(users));
    localStorage.setItem('nutrition_current_user', userId);
}

// ==================== CUSTOM FOODS ====================

function loadCustomFoods() {
    const data = localStorage.getItem(uKey('custom_foods'));
    state.customFoods = data ? JSON.parse(data) : [];
}

function saveCustomFoods() {
    localStorage.setItem(uKey('custom_foods'), JSON.stringify(state.customFoods));
}

function getAllFoods() {
    return [...state.customFoods, ...FOOD_DATABASE];
}

function addCustomFood(food) {
    state.customFoods.push(food);
    saveCustomFoods();
}

function deleteCustomFood(foodId) {
    state.customFoods = state.customFoods.filter(f => f.id !== foodId);
    saveCustomFoods();
}

// ==================== EVENT LISTENERS ====================

function setupEventListeners() {
    document.getElementById('profile-btn').addEventListener('click', () => showModal('profile-modal'));
    document.getElementById('close-profile').addEventListener('click', () => {
        if (state.profile) hideModal('profile-modal');
    });
    document.getElementById('close-portion').addEventListener('click', () => hideModal('portion-modal'));

    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            const modal = e.target.closest('.modal');
            if (modal.id === 'profile-modal' && !state.profile) return;
            if (modal.id === 'user-modal' && !state.currentUserId) return;
            hideModal(modal.id);
        });
    });

    document.getElementById('profile-form').addEventListener('submit', handleProfileSubmit);
    document.getElementById('profile-form').addEventListener('input', previewGoals);
    document.getElementById('profile-form').addEventListener('change', previewGoals);

    document.getElementById('prev-day').addEventListener('click', () => changeDate(-1));
    document.getElementById('next-day').addEventListener('click', () => changeDate(1));
    document.getElementById('today-btn').addEventListener('click', goToToday);

    const searchInput = document.getElementById('food-search');
    searchInput.addEventListener('input', (e) => {
        state.searchQuery = e.target.value;
        document.getElementById('clear-search').style.display = state.searchQuery ? 'flex' : 'none';
        searchFood();
    });
    searchInput.addEventListener('focus', () => {
        if (state.searchQuery || state.activeCategory) searchFood();
    });

    document.getElementById('clear-search').addEventListener('click', () => {
        searchInput.value = '';
        state.searchQuery = '';
        document.getElementById('clear-search').style.display = 'none';
        document.getElementById('search-results').classList.remove('visible');
    });

    document.addEventListener('click', (e) => {
        const results = document.getElementById('search-results');
        const searchWrapper = document.querySelector('.search-wrapper');
        if (!results.contains(e.target) && !searchWrapper.contains(e.target) &&
            !e.target.closest('.category-pills')) {
            results.classList.remove('visible');
        }
    });

    document.getElementById('portion-grams').addEventListener('input', updatePortionPreview);
    document.getElementById('add-food-btn').addEventListener('click', handleAddFood);

    document.getElementById('custom-goals-toggle').addEventListener('change', handleCustomGoalsToggle);
    document.getElementById('custom-calories').addEventListener('input', previewGoals);
    document.getElementById('custom-protein').addEventListener('input', previewGoals);

    document.getElementById('edit-calorie-goal').addEventListener('click', () => {
        showModal('profile-modal');
        enableCustomGoals();
    });
    document.getElementById('edit-protein-goal').addEventListener('click', () => {
        showModal('profile-modal');
        enableCustomGoals();
    });

    // User modal
    document.getElementById('user-btn').addEventListener('click', () => showModal('user-modal'));
    document.getElementById('close-user').addEventListener('click', () => {
        if (state.currentUserId) hideModal('user-modal');
    });

    document.getElementById('show-add-user').addEventListener('click', () => {
        document.getElementById('show-add-user').classList.add('hidden');
        const form = document.getElementById('add-user-form');
        form.classList.add('visible');
        document.getElementById('new-user-name').value = '';
        document.getElementById('new-user-name').focus();
    });

    document.getElementById('create-user-btn').addEventListener('click', handleCreateUser);
    document.getElementById('new-user-name').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleCreateUser();
    });

    // Custom food modal
    document.getElementById('open-custom-food').addEventListener('click', () => showModal('custom-food-modal'));
    document.getElementById('close-custom-food').addEventListener('click', () => hideModal('custom-food-modal'));
    document.getElementById('custom-food-form').addEventListener('submit', handleCustomFoodSubmit);
}

function handleCreateUser() {
    const nameInput = document.getElementById('new-user-name');
    const name = nameInput.value.trim();
    if (!name) return;

    const user = createUser(name);
    nameInput.value = '';
    document.getElementById('add-user-form').classList.remove('visible');
    document.getElementById('show-add-user').classList.remove('hidden');

    switchUser(user.id);
}

// ==================== CUSTOM FOOD ====================

function handleCustomFoodSubmit(e) {
    e.preventDefault();
    const food = {
        id: 'c_' + Date.now(),
        name: document.getElementById('cf-name').value.trim(),
        category: document.getElementById('cf-category').value,
        calories: parseFloat(document.getElementById('cf-calories').value) || 0,
        protein: parseFloat(document.getElementById('cf-protein').value) || 0,
        carbs: parseFloat(document.getElementById('cf-carbs').value) || 0,
        fat: parseFloat(document.getElementById('cf-fat').value) || 0,
        fiber: 0,
        servingSize: parseInt(document.getElementById('cf-serving').value) || 100,
        servingDescription: document.getElementById('cf-serving-desc').value.trim() || 'מנה',
        isCustom: true
    };

    if (!food.name) return;
    addCustomFood(food);
    hideModal('custom-food-modal');
    document.getElementById('custom-food-form').reset();
    document.getElementById('cf-serving').value = 100;
    document.getElementById('cf-serving-desc').value = 'מנה';
    openPortionModal(food);
}

// ==================== PROFILE ====================

function loadProfile() {
    const data = localStorage.getItem(uKey('profile'));
    state.profile = data ? JSON.parse(data) : null;
}

function handleProfileSubmit(e) {
    e.preventDefault();
    const useCustom = document.getElementById('custom-goals-toggle').checked;
    const profile = {
        gender: document.getElementById('profile-gender').value,
        age: parseInt(document.getElementById('profile-age').value),
        weight: parseFloat(document.getElementById('profile-weight').value),
        height: parseFloat(document.getElementById('profile-height').value),
        activity: document.getElementById('profile-activity').value,
        goal: document.getElementById('profile-goal').value,
        customGoals: useCustom,
        customCalories: useCustom ? parseInt(document.getElementById('custom-calories').value) || null : null,
        customProtein: useCustom ? parseInt(document.getElementById('custom-protein').value) || null : null
    };

    state.profile = profile;
    localStorage.setItem(uKey('profile'), JSON.stringify(profile));
    calculateGoals();
    loadDailyLog();
    renderAll();
    hideModal('profile-modal');
}

function handleCustomGoalsToggle() {
    const checked = document.getElementById('custom-goals-toggle').checked;
    document.getElementById('custom-goals-fields').classList.toggle('visible', checked);
    if (checked) {
        const calInput = document.getElementById('custom-calories');
        const protInput = document.getElementById('custom-protein');
        if (!calInput.value) calInput.value = getAutoCalories();
        if (!protInput.value) protInput.value = getAutoProtein();
    }
}

function enableCustomGoals() {
    const toggle = document.getElementById('custom-goals-toggle');
    if (!toggle.checked) {
        toggle.checked = true;
        handleCustomGoalsToggle();
    }
    setTimeout(() => document.getElementById('custom-calories').focus(), 150);
}

function getAutoCalories() {
    if (!state.profile) return '';
    const { weight, height, age, gender, activity, goal } = state.profile;
    let bmr = gender === 'male'
        ? 10 * weight + 6.25 * height - 5 * age + 5
        : 10 * weight + 6.25 * height - 5 * age - 161;
    return Math.round(bmr * ACTIVITY_FACTORS[activity] + GOAL_ADJUSTMENT[goal]);
}

function getAutoProtein() {
    if (!state.profile) return '';
    return Math.round(state.profile.weight * PROTEIN_PER_KG[state.profile.activity]);
}

function previewGoals() {
    const gender = document.getElementById('profile-gender').value;
    const age = parseInt(document.getElementById('profile-age').value);
    const weight = parseFloat(document.getElementById('profile-weight').value);
    const height = parseFloat(document.getElementById('profile-height').value);
    const activity = document.getElementById('profile-activity').value;
    const goal = document.getElementById('profile-goal').value;
    const useCustom = document.getElementById('custom-goals-toggle').checked;

    if (!age || !weight || !height) {
        document.getElementById('goals-preview').classList.remove('visible');
        return;
    }

    let bmr = gender === 'male'
        ? 10 * weight + 6.25 * height - 5 * age + 5
        : 10 * weight + 6.25 * height - 5 * age - 161;

    const tdee = bmr * ACTIVITY_FACTORS[activity];
    let calories = Math.round(tdee + GOAL_ADJUSTMENT[goal]);
    let protein = Math.round(weight * PROTEIN_PER_KG[activity]);

    if (useCustom) {
        const cc = parseInt(document.getElementById('custom-calories').value);
        const cp = parseInt(document.getElementById('custom-protein').value);
        if (cc) calories = cc;
        if (cp) protein = cp;
    }

    const proteinCal = protein * 4;
    const remaining = calories - proteinCal;
    const carbs = Math.round(remaining * 0.55 / 4);
    const fat = Math.round(remaining * 0.45 / 9);

    const preview = document.getElementById('goals-preview');
    preview.classList.add('visible');
    const customNote = useCustom ? '<span class="custom-badge">מותאם אישית</span>' : '';
    preview.innerHTML = `
        <h3>היעדים היומיים שלך ${customNote}</h3>
        <div class="goals-preview-grid">
            <div class="goals-preview-item"><strong>${calories}</strong> קלוריות</div>
            <div class="goals-preview-item"><strong>${protein}g</strong> חלבון</div>
            <div class="goals-preview-item"><strong>${carbs}g</strong> פחמימות</div>
            <div class="goals-preview-item"><strong>${fat}g</strong> שומן</div>
        </div>
    `;
}

function fillProfileForm() {
    if (!state.profile) return;
    document.getElementById('profile-gender').value = state.profile.gender;
    document.getElementById('profile-age').value = state.profile.age;
    document.getElementById('profile-weight').value = state.profile.weight;
    document.getElementById('profile-height').value = state.profile.height;
    document.getElementById('profile-activity').value = state.profile.activity;
    document.getElementById('profile-goal').value = state.profile.goal;

    const toggle = document.getElementById('custom-goals-toggle');
    toggle.checked = !!state.profile.customGoals;
    document.getElementById('custom-goals-fields').classList.toggle('visible', toggle.checked);
    if (state.profile.customCalories) document.getElementById('custom-calories').value = state.profile.customCalories;
    if (state.profile.customProtein) document.getElementById('custom-protein').value = state.profile.customProtein;

    previewGoals();
}

// ==================== CALCULATIONS ====================

function calculateBMR() {
    const { weight, height, age, gender } = state.profile;
    if (gender === 'male') return 10 * weight + 6.25 * height - 5 * age + 5;
    return 10 * weight + 6.25 * height - 5 * age - 161;
}

function calculateGoals() {
    const tdee = calculateBMR() * ACTIVITY_FACTORS[state.profile.activity];
    let calories = Math.round(tdee + GOAL_ADJUSTMENT[state.profile.goal]);
    let protein = Math.round(state.profile.weight * PROTEIN_PER_KG[state.profile.activity]);

    if (state.profile.customGoals) {
        if (state.profile.customCalories) calories = state.profile.customCalories;
        if (state.profile.customProtein) protein = state.profile.customProtein;
    }

    const proteinCal = protein * 4;
    const remaining = calories - proteinCal;
    state.goals = {
        calories,
        protein,
        carbs: Math.round(remaining * 0.55 / 4),
        fat: Math.round(remaining * 0.45 / 9)
    };
}

// ==================== DATE ====================

function formatDateKey(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function formatDateDisplay(date) {
    const todayKey = formatDateKey(new Date());
    const dateKey = formatDateKey(date);
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    if (dateKey === todayKey) return 'היום';
    if (dateKey === formatDateKey(yesterday)) return 'אתמול';
    return date.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' });
}

function changeDate(offset) {
    state.currentDate.setDate(state.currentDate.getDate() + offset);
    loadDailyLog();
    renderAll();
}

function goToToday() {
    state.currentDate = new Date();
    loadDailyLog();
    renderAll();
}

function isToday() {
    return formatDateKey(state.currentDate) === formatDateKey(new Date());
}

// ==================== FOOD LOG ====================

function loadDailyLog() {
    const data = localStorage.getItem(uKey(`log_${formatDateKey(state.currentDate)}`));
    state.dailyLog = data ? JSON.parse(data) : [];
}

function saveDailyLog() {
    localStorage.setItem(uKey(`log_${formatDateKey(state.currentDate)}`), JSON.stringify(state.dailyLog));
}

function getDailyTotals() {
    return state.dailyLog.reduce((t, item) => {
        t.calories += item.calories;
        t.protein += item.protein;
        t.carbs += item.carbs;
        t.fat += item.fat;
        return t;
    }, { calories: 0, protein: 0, carbs: 0, fat: 0 });
}

// ==================== FOOD SEARCH ====================

function setupCategoryPills() {
    const container = document.getElementById('category-pills');
    container.innerHTML = CATEGORIES.map(cat => {
        const isAll = cat === 'הכל';
        return `<button class="cat-pill${isAll ? ' active' : ''}" data-category="${isAll ? '' : cat}">${cat}</button>`;
    }).join('');

    container.addEventListener('click', (e) => {
        const pill = e.target.closest('.cat-pill');
        if (!pill) return;
        container.querySelectorAll('.cat-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        state.activeCategory = pill.dataset.category || null;
        searchFood();
    });
}

function searchFood() {
    const query = state.searchQuery.trim().toLowerCase();
    let results;

    if (state.activeCategory === 'מוצרים שלי') {
        results = state.customFoods;
    } else {
        results = getAllFoods();
        if (state.activeCategory) results = results.filter(f => f.category === state.activeCategory);
    }

    if (query) results = results.filter(f => f.name.includes(query));
    renderSearchResults(results);
}

// ==================== PORTION MODAL ====================

function openPortionModal(food) {
    state.selectedFood = food;
    document.getElementById('portion-food-name').textContent = food.name;

    document.getElementById('portion-info').innerHTML = `
        <div class="pn-item"><span class="pn-value">${food.calories}</span><span class="pn-label">קלוריות</span></div>
        <div class="pn-item"><span class="pn-value">${food.protein}g</span><span class="pn-label">חלבון</span></div>
        <div class="pn-item"><span class="pn-value">${food.carbs}g</span><span class="pn-label">פחמימות</span></div>
        <div class="pn-item"><span class="pn-value">${food.fat}g</span><span class="pn-label">שומן</span></div>
    `;

    const quickContainer = document.getElementById('quick-portions');
    const portions = [
        { label: `${food.servingDescription} (${food.servingSize}g)`, grams: food.servingSize },
        { label: '50g', grams: 50 }, { label: '100g', grams: 100 },
        { label: '150g', grams: 150 }, { label: '200g', grams: 200 }
    ];
    quickContainer.innerHTML = portions.map(p =>
        `<button class="quick-btn" data-grams="${p.grams}">${p.label}</button>`
    ).join('');

    quickContainer.onclick = (e) => {
        const btn = e.target.closest('.quick-btn');
        if (!btn) return;
        document.getElementById('portion-grams').value = btn.dataset.grams;
        quickContainer.querySelectorAll('.quick-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        updatePortionPreview();
    };

    document.getElementById('portion-grams').value = food.servingSize;

    const mealPills = document.getElementById('meal-pills');
    mealPills.querySelectorAll('.meal-pill').forEach(pill => {
        pill.classList.toggle('active', pill.dataset.meal === state.selectedMeal);
    });
    mealPills.onclick = (e) => {
        const pill = e.target.closest('.meal-pill');
        if (!pill) return;
        mealPills.querySelectorAll('.meal-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        state.selectedMeal = pill.dataset.meal;
    };

    updatePortionPreview();
    showModal('portion-modal');
}

function updatePortionPreview() {
    const grams = parseFloat(document.getElementById('portion-grams').value) || 0;
    const food = state.selectedFood;
    if (!food) return;
    const ratio = grams / 100;
    document.getElementById('portion-preview').innerHTML = `
        <div class="pp-item"><strong>${Math.round(food.calories * ratio)}</strong><span>קלוריות</span></div>
        <div class="pp-item"><strong>${(food.protein * ratio).toFixed(1)}g</strong><span>חלבון</span></div>
        <div class="pp-item"><strong>${(food.carbs * ratio).toFixed(1)}g</strong><span>פחמימות</span></div>
        <div class="pp-item"><strong>${(food.fat * ratio).toFixed(1)}g</strong><span>שומן</span></div>
    `;
}

function handleAddFood() {
    const grams = parseFloat(document.getElementById('portion-grams').value);
    const food = state.selectedFood;
    if (!food || !grams || grams <= 0) return;

    const ratio = grams / 100;
    state.dailyLog.push({
        id: Date.now(),
        foodId: food.id,
        name: food.name,
        grams: Math.round(grams),
        calories: Math.round(food.calories * ratio),
        protein: +(food.protein * ratio).toFixed(1),
        carbs: +(food.carbs * ratio).toFixed(1),
        fat: +(food.fat * ratio).toFixed(1),
        meal: state.selectedMeal,
        time: new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })
    });

    saveDailyLog();
    renderAll();
    hideModal('portion-modal');
    document.getElementById('food-search').value = '';
    state.searchQuery = '';
    document.getElementById('clear-search').style.display = 'none';
    document.getElementById('search-results').classList.remove('visible');
}

// ==================== RENDERING ====================

function renderAll() {
    renderDate();
    renderDashboard();
    renderFoodLog();
    renderUserHeader();
}

function renderUserHeader() {
    const user = getCurrentUser();
    if (!user) return;
    const avatar = document.getElementById('user-avatar-sm');
    avatar.textContent = user.name.charAt(0);
    avatar.style.background = user.color;
    document.getElementById('user-name-sm').textContent = user.name;
}

function renderUserGrid() {
    const grid = document.getElementById('user-grid');
    grid.innerHTML = state.users.map(user => `
        <div class="user-card${user.id === state.currentUserId ? ' active' : ''}" data-user-id="${user.id}">
            <div class="user-card-avatar" style="background:${user.color}">${user.name.charAt(0)}</div>
            <span class="user-card-name">${user.name}</span>
            ${state.users.length > 1 ? `<button class="user-card-delete" data-delete-id="${user.id}" title="מחק משתמש">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
            </button>` : ''}
        </div>
    `).join('');

    grid.querySelectorAll('.user-card').forEach(card => {
        card.addEventListener('click', (e) => {
            if (e.target.closest('.user-card-delete')) return;
            switchUser(card.dataset.userId);
        });
    });

    grid.querySelectorAll('.user-card-delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = btn.dataset.deleteId;
            const user = state.users.find(u => u.id === id);
            if (confirm(`למחוק את המשתמש "${user.name}" וכל הנתונים שלו?`)) {
                deleteUser(id);
            }
        });
    });
}

function renderDate() {
    document.getElementById('date-text').textContent = formatDateDisplay(state.currentDate);
    document.getElementById('today-btn').style.display = isToday() ? 'none' : 'inline';
}

function renderDashboard() {
    const totals = getDailyTotals();
    const goals = state.goals;

    document.getElementById('calories-consumed').textContent = Math.round(totals.calories);
    document.getElementById('calories-goal').textContent = goals.calories;

    const calProgress = goals.calories > 0 ? Math.min(totals.calories / goals.calories, 1.15) : 0;
    const offset = CIRCUMFERENCE * (1 - Math.min(calProgress, 1));
    const ring = document.getElementById('calorie-ring');
    ring.style.strokeDashoffset = offset;
    ring.classList.toggle('over-goal', totals.calories > goals.calories);

    renderMacroBar('protein', totals.protein, goals.protein);
    renderMacroBar('carbs', totals.carbs, goals.carbs);
    renderMacroBar('fat', totals.fat, goals.fat);
}

function renderMacroBar(name, consumed, goal) {
    document.getElementById(`${name}-consumed`).textContent = Math.round(consumed);
    document.getElementById(`${name}-goal`).textContent = goal;
    const pct = goal > 0 ? Math.min((consumed / goal) * 100, 100) : 0;
    document.getElementById(`${name}-bar`).style.width = pct + '%';
}

function renderSearchResults(results) {
    const container = document.getElementById('search-results');
    if (!state.searchQuery && !state.activeCategory) {
        container.classList.remove('visible');
        return;
    }
    container.classList.add('visible');
    if (results.length === 0) {
        container.innerHTML = `
            <div class="no-results">
                לא נמצאו תוצאות
                <div class="no-results-action"><button id="no-results-add">+ צור מוצר חדש</button></div>
            </div>`;
        document.getElementById('no-results-add').addEventListener('click', () => {
            const nameInput = document.getElementById('cf-name');
            showModal('custom-food-modal');
            if (state.searchQuery) nameInput.value = state.searchQuery;
        });
        return;
    }
    container.innerHTML = results.map(food => {
        const isCustom = food.isCustom;
        const badge = isCustom ? '<span class="result-custom-badge">שלי</span>' : '';
        const deleteBtn = isCustom ? `<button class="result-delete-custom" data-delete-cf="${food.id}" title="מחק מוצר">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
        </button>` : '';
        return `
        <div class="search-result-item" data-food-id="${food.id}">
            ${deleteBtn}
            <div class="result-main">
                <div class="result-name">${badge}${food.name}</div>
                <div class="result-category">${food.category} · ${food.servingDescription} (${food.servingSize}g)</div>
            </div>
            <div class="result-cal">${food.calories} קק"ל/100g</div>
        </div>`;
    }).join('');

    container.querySelectorAll('.search-result-item').forEach(item => {
        item.addEventListener('click', (e) => {
            if (e.target.closest('.result-delete-custom')) return;
            const foodId = item.dataset.foodId;
            const food = findFoodById(foodId);
            if (food) openPortionModal(food);
        });
    });

    container.querySelectorAll('.result-delete-custom').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = btn.dataset.deleteCf;
            deleteCustomFood(id);
            searchFood();
        });
    });
}

function findFoodById(id) {
    if (typeof id === 'string' && id.startsWith('c_')) {
        return state.customFoods.find(f => f.id === id);
    }
    return getAllFoods().find(f => String(f.id) === String(id));
}

function renderFoodLog() {
    const container = document.getElementById('food-log-list');
    const countEl = document.getElementById('log-count');

    if (state.dailyLog.length === 0) {
        container.innerHTML = '';
        container.appendChild(createEmptyState());
        countEl.textContent = '';
        return;
    }

    countEl.textContent = `${state.dailyLog.length} פריטים`;

    const grouped = {};
    MEAL_ORDER.forEach(m => { grouped[m] = []; });
    state.dailyLog.forEach(item => {
        if (!grouped[item.meal]) grouped[item.meal] = [];
        grouped[item.meal].push(item);
    });

    let html = '';
    MEAL_ORDER.forEach(meal => {
        const items = grouped[meal];
        if (!items.length) return;
        html += `<div class="meal-group"><div class="meal-group-header">${MEAL_LABELS[meal]}</div>`;
        items.forEach(item => {
            html += `
                <div class="log-item">
                    <div class="log-item-info">
                        <div class="log-item-name">${item.name}</div>
                        <div class="log-item-details">${item.grams}g · ${item.time}</div>
                    </div>
                    <div class="log-item-macros">
                        <div class="log-macro cal"><span class="log-macro-value">${item.calories}</span><span class="log-macro-label">קק"ל</span></div>
                        <div class="log-macro prot"><span class="log-macro-value">${item.protein}g</span><span class="log-macro-label">חלבון</span></div>
                    </div>
                    <button class="delete-btn" data-entry-id="${item.id}" title="הסר">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                    </button>
                </div>`;
        });
        html += '</div>';
    });

    container.innerHTML = html;
    container.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            state.dailyLog = state.dailyLog.filter(e => e.id !== parseInt(btn.dataset.entryId));
            saveDailyLog();
            renderAll();
        });
    });
}

function createEmptyState() {
    const div = document.createElement('div');
    div.className = 'empty-state';
    div.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="48" height="48">
            <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M12 8v8M8 12h8"/>
        </svg>
        <p>עוד לא הוספת מאכלים להיום</p>
        <p class="sub">חפש מאכל למעלה כדי להתחיל</p>
    `;
    return div;
}

// ==================== MODAL HELPERS ====================

function showModal(id, forceOpen) {
    const modal = document.getElementById(id);
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';

    if (id === 'profile-modal') {
        fillProfileForm();
        document.getElementById('close-profile').style.display = forceOpen ? 'none' : '';
    }
    if (id === 'user-modal') {
        renderUserGrid();
        document.getElementById('close-user').style.display =
            (forceOpen || !state.currentUserId) ? 'none' : '';
        document.getElementById('add-user-form').classList.remove('visible');
        document.getElementById('show-add-user').classList.remove('hidden');
    }
    if (id === 'custom-food-modal') {
        document.getElementById('custom-food-form').reset();
        document.getElementById('cf-serving').value = 100;
        document.getElementById('cf-serving-desc').value = 'מנה';
    }
}

function hideModal(id) {
    document.getElementById(id).classList.remove('active');
    document.body.style.overflow = '';
}
