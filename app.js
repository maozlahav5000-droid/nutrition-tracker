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
    hiddenFoods: [],
    renamedFoods: {},
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
    loadHiddenFoods();
    loadRenamedFoods();
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
    state.hiddenFoods = [];
    state.renamedFoods = {};
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
    const hidden = new Set(state.hiddenFoods);
    const renamed = state.renamedFoods;
    const dbFiltered = FOOD_DATABASE
        .filter(f => !hidden.has(f.id))
        .map(f => renamed[f.id] ? { ...f, name: renamed[f.id] } : f);
    return [...state.customFoods, ...dbFiltered];
}

function addCustomFood(food) {
    state.customFoods.push(food);
    saveCustomFoods();
}

function deleteCustomFood(foodId) {
    state.customFoods = state.customFoods.filter(f => f.id !== foodId);
    saveCustomFoods();
}

function loadHiddenFoods() {
    const data = localStorage.getItem(uKey('hidden_foods'));
    state.hiddenFoods = data ? JSON.parse(data) : [];
}

function saveHiddenFoods() {
    localStorage.setItem(uKey('hidden_foods'), JSON.stringify(state.hiddenFoods));
}

function hideFood(foodId) {
    if (!state.hiddenFoods.includes(foodId)) {
        state.hiddenFoods.push(foodId);
        saveHiddenFoods();
    }
}

function loadRenamedFoods() {
    const data = localStorage.getItem(uKey('renamed_foods'));
    state.renamedFoods = data ? JSON.parse(data) : {};
}

function saveRenamedFoods() {
    localStorage.setItem(uKey('renamed_foods'), JSON.stringify(state.renamedFoods));
}

function renameFood(foodId, newName) {
    const custom = state.customFoods.find(f => String(f.id) === String(foodId));
    if (custom) {
        custom.name = newName;
        saveCustomFoods();
    } else {
        state.renamedFoods[foodId] = newName;
        saveRenamedFoods();
    }
}

function deleteAnyFood(foodId) {
    const isCustom = state.customFoods.some(f => String(f.id) === String(foodId));
    if (isCustom) {
        deleteCustomFood(foodId);
    } else {
        hideFood(Number(foodId) || foodId);
    }
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
            if (modal.id === 'barcode-modal') stopBarcodeCamera();
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

    // Quick protein modal
    document.getElementById('open-quick-protein').addEventListener('click', () => showModal('quick-protein-modal'));
    document.getElementById('close-quick-protein').addEventListener('click', () => hideModal('quick-protein-modal'));
    document.getElementById('qp-add-btn').addEventListener('click', handleQuickProtein);

    document.getElementById('qp-quick-btns').addEventListener('click', (e) => {
        const btn = e.target.closest('.quick-btn');
        if (!btn) return;
        document.getElementById('qp-protein').value = btn.dataset.protein;
        document.getElementById('qp-quick-btns').querySelectorAll('.quick-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    });

    document.getElementById('qp-meal-pills').addEventListener('click', (e) => {
        const pill = e.target.closest('.meal-pill');
        if (!pill) return;
        document.getElementById('qp-meal-pills').querySelectorAll('.meal-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
    });

    // Paste values modal
    document.getElementById('open-paste-values').addEventListener('click', () => showModal('paste-modal'));
    document.getElementById('close-paste').addEventListener('click', () => hideModal('paste-modal'));
    document.getElementById('paste-textarea').addEventListener('input', parsePastedValues);
    document.getElementById('paste-add-btn').addEventListener('click', handlePasteAdd);

    // Barcode scanner
    document.getElementById('open-barcode-scanner').addEventListener('click', openBarcodeScanner);
    document.getElementById('close-barcode').addEventListener('click', () => {
        stopBarcodeCamera();
        hideModal('barcode-modal');
    });
    document.getElementById('barcode-search-btn').addEventListener('click', () => {
        const code = document.getElementById('barcode-input').value.trim();
        if (code) lookupBarcode(code);
    });
    document.getElementById('barcode-input').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const code = e.target.value.trim();
            if (code) lookupBarcode(code);
        }
    });
    document.getElementById('barcode-add-btn').addEventListener('click', handleBarcodeAdd);
    document.getElementById('barcode-edit-name').addEventListener('click', handleBarcodeEditName);

    // AI Chat
    setupAiChat();
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

// ==================== PASTE VALUES ====================

function parsePastedValues() {
    const text = document.getElementById('paste-textarea').value;
    const preview = document.getElementById('paste-preview');
    const addBtn = document.getElementById('paste-add-btn');

    if (!text.trim()) {
        preview.innerHTML = '';
        preview.classList.remove('visible');
        addBtn.disabled = true;
        return;
    }

    const parsed = extractNutrition(text);

    if (parsed.calories === 0 && parsed.protein === 0 && parsed.carbs === 0 && parsed.fat === 0) {
        preview.innerHTML = '<div class="paste-error">לא זוהו ערכים תזונתיים. נסה פורמט אחר.</div>';
        preview.classList.add('visible');
        addBtn.disabled = true;
        return;
    }

    preview.innerHTML = `
        <div class="paste-parsed-grid">
            <div class="paste-parsed-item"><strong>${parsed.calories}</strong><span>קלוריות</span></div>
            <div class="paste-parsed-item"><strong>${parsed.protein}g</strong><span>חלבון</span></div>
            <div class="paste-parsed-item"><strong>${parsed.carbs}g</strong><span>פחמימות</span></div>
            <div class="paste-parsed-item"><strong>${parsed.fat}g</strong><span>שומן</span></div>
        </div>
    `;
    preview.classList.add('visible');
    addBtn.disabled = false;
}

function extractNutrition(text) {
    const result = { calories: 0, protein: 0, carbs: 0, fat: 0 };
    const lines = text.split(/\n/);

    for (const line of lines) {
        const num = parseFirstNumber(line);
        if (num === null) continue;

        if (/קלוריות|אנרגי|calories|energy|קק"ל|kcal/i.test(line) && !/מ(שומן|פחמימות|חלבון)/i.test(line)) {
            result.calories = num;
        } else if (/חלבון|protein/i.test(line)) {
            result.protein = num;
        } else if (/פחמימ|carb/i.test(line)) {
            result.carbs = num;
        } else if (/שומן|fat/i.test(line)) {
            result.fat = num;
        }
    }

    if (result.calories === 0 && (result.protein || result.carbs || result.fat)) {
        result.calories = Math.round(result.protein * 4 + result.carbs * 4 + result.fat * 9);
    }

    return result;
}

function parseFirstNumber(line) {
    const match = line.match(/[\d]+(?:[.,]\d+)?/);
    if (!match) return null;
    return +match[0].replace(',', '.');
}

function handlePasteAdd() {
    const text = document.getElementById('paste-textarea').value;
    const name = document.getElementById('paste-name').value.trim();
    if (!text.trim()) return;

    const parsed = extractNutrition(text);
    if (parsed.calories === 0 && parsed.protein === 0 && parsed.carbs === 0 && parsed.fat === 0) return;

    const food = {
        id: 'c_' + Date.now(),
        name: name || 'מוצר מודבק',
        category: 'מאכלים מוכנים',
        calories: parsed.calories,
        protein: parsed.protein,
        carbs: parsed.carbs,
        fat: parsed.fat,
        fiber: 0,
        servingSize: 100,
        servingDescription: 'מנה',
        isCustom: true
    };

    addCustomFood(food);
    hideModal('paste-modal');
    openPortionModal(food);
}

// ==================== QUICK PROTEIN ====================

function handleQuickProtein() {
    const protein = parseFloat(document.getElementById('qp-protein').value);
    if (!protein || protein <= 0) return;

    const label = document.getElementById('qp-label').value.trim() || 'חלבון ידני';
    const customCal = parseInt(document.getElementById('qp-calories').value);
    const calories = customCal > 0 ? customCal : Math.round(protein * 4);

    const activeMeal = document.querySelector('#qp-meal-pills .meal-pill.active');
    const meal = activeMeal ? activeMeal.dataset.meal : state.selectedMeal;

    state.dailyLog.push({
        id: Date.now(),
        foodId: 'qp_' + Date.now(),
        name: label,
        grams: 0,
        calories,
        protein: +protein.toFixed(1),
        carbs: 0,
        fat: 0,
        meal,
        time: new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })
    });

    saveDailyLog();
    renderAll();
    hideModal('quick-protein-modal');

    document.getElementById('qp-protein').value = '';
    document.getElementById('qp-calories').value = '';
    document.getElementById('qp-label').value = '';
    document.getElementById('qp-quick-btns').querySelectorAll('.quick-btn').forEach(b => b.classList.remove('active'));
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

    const proteinRemaining = Math.round(goals.protein - totals.protein);
    const el = document.getElementById('protein-remaining');
    if (goals.protein > 0) {
        if (proteinRemaining > 0) {
            el.textContent = `נשאר ${proteinRemaining}g`;
            el.className = 'protein-remaining';
        } else if (proteinRemaining === 0) {
            el.textContent = 'הגעת ליעד!';
            el.className = 'protein-remaining hit-goal';
        } else {
            el.textContent = `עברת את היעד ב-${Math.abs(proteinRemaining)}g`;
            el.className = 'protein-remaining over-goal';
        }
    } else {
        el.textContent = '';
    }
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
        const badge = food.isCustom ? '<span class="result-custom-badge">שלי</span>' : '';
        return `
        <div class="search-result-item" data-food-id="${food.id}">
            <div class="result-actions">
                <button class="result-delete-btn" data-delete-id="${food.id}" title="הסר מוצר">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                </button>
                <button class="result-edit-btn" data-edit-id="${food.id}" title="ערוך שם">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </button>
            </div>
            <div class="result-main">
                <div class="result-name">${badge}${food.name}</div>
                <div class="result-category">${food.category} · ${food.servingDescription} (${food.servingSize}g)</div>
            </div>
            <div class="result-cal">${food.calories} קק"ל/100g</div>
        </div>`;
    }).join('');

    container.querySelectorAll('.search-result-item').forEach(item => {
        item.addEventListener('click', (e) => {
            if (e.target.closest('.result-delete-btn') || e.target.closest('.result-edit-btn') || e.target.closest('.result-edit-input')) return;
            const foodId = item.dataset.foodId;
            const food = findFoodById(foodId);
            if (food) openPortionModal(food);
        });
    });

    container.querySelectorAll('.result-edit-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = btn.dataset.editId;
            const item = btn.closest('.search-result-item');
            const nameEl = item.querySelector('.result-name');
            const badge = nameEl.querySelector('.result-custom-badge');
            const currentName = nameEl.textContent.trim();

            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'result-edit-input';
            input.value = currentName;
            input.maxLength = 40;

            nameEl.textContent = '';
            if (badge) nameEl.appendChild(badge.cloneNode(true));
            nameEl.appendChild(input);
            input.focus();
            input.select();

            function save() {
                const newName = input.value.trim();
                if (newName && newName !== currentName) {
                    renameFood(id, newName);
                }
                searchFood();
            }

            function cancel() {
                searchFood();
            }

            input.addEventListener('keydown', (ev) => {
                if (ev.key === 'Enter') { ev.preventDefault(); save(); }
                if (ev.key === 'Escape') { ev.preventDefault(); cancel(); }
            });
            input.addEventListener('blur', save);
        });
    });

    container.querySelectorAll('.result-delete-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = btn.dataset.deleteId;
            const item = btn.closest('.search-result-item');
            const foodName = item.querySelector('.result-name').textContent;

            item.classList.add('confirm-delete');
            item.innerHTML = `
                <span class="result-confirm-text">להסיר את "${foodName}"?</span>
                <div class="result-confirm-actions">
                    <button class="result-confirm-yes">הסר</button>
                    <button class="result-confirm-no">ביטול</button>
                </div>
            `;

            item.querySelector('.result-confirm-yes').addEventListener('click', (ev) => {
                ev.stopPropagation();
                deleteAnyFood(id);
                searchFood();
            });

            item.querySelector('.result-confirm-no').addEventListener('click', (ev) => {
                ev.stopPropagation();
                searchFood();
            });
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
                        <div class="log-item-details">${item.grams ? item.grams + 'g · ' : ''}${item.time}</div>
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
            const logItem = btn.closest('.log-item');
            if (logItem.classList.contains('confirm-active')) return;

            logItem.classList.add('confirm-active');
            const entryId = parseInt(btn.dataset.entryId);
            const entry = state.dailyLog.find(e => e.id === entryId);
            const name = entry ? entry.name : '';

            const overlay = document.createElement('div');
            overlay.className = 'delete-confirm-overlay';
            overlay.innerHTML = `
                <span class="delete-confirm-text">למחוק את "${name}"?</span>
                <div class="delete-confirm-actions">
                    <button class="delete-confirm-yes">מחק</button>
                    <button class="delete-confirm-no">ביטול</button>
                </div>
            `;
            logItem.appendChild(overlay);

            const autoCancel = setTimeout(() => cancel(), 4000);

            function cancel() {
                clearTimeout(autoCancel);
                logItem.classList.remove('confirm-active');
                overlay.remove();
            }

            overlay.querySelector('.delete-confirm-yes').addEventListener('click', () => {
                clearTimeout(autoCancel);
                state.dailyLog = state.dailyLog.filter(e => e.id !== entryId);
                saveDailyLog();
                renderAll();
            });

            overlay.querySelector('.delete-confirm-no').addEventListener('click', cancel);
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

// ==================== AI CHAT ====================

const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const AI_SYSTEM_PROMPT = `אתה יועץ תזונה אישי מומחה — חכם, חם, מעניין ומפורט. אתה מנהל שיחה טבעית ועשירה עם המשתמש.

## הסגנון שלך:
- דבר בעברית טבעית, כאילו אתה חבר שהוא גם דיאטן.
- תן תשובות מפורטות ומעניינות — לא יבשות ולא קצרות מדי.
- הוסף טיפים, הקשר, נקודות למחשבה, והשוואות מעניינות.
- שאל שאלות המשך כדי להבין טוב יותר מה המשתמש אכל (תוספות? שתייה? רטבים?).
- תן הערכות ריאליסטיות (טווחים כשיש אי-ודאות).
- התייחס ליעדים של המשתמש — אם הוא רוצה לרדת במשקל, ציין את זה. אם הוא מחפש חלבון, שים דגש על זה.

## מה אתה יודע לעשות:
- ניתוח ארוחות: המשתמש מספר מה אכל ואתה נותן פירוט תזונתי מלא עם הקשר.
- חישובי מאקרו: חישוב מדויק של ערכים תזונתיים לכמות מסוימת בגרמים.
- ייעוץ ותכנון ארוחות: המלצות מותאמות אישית, תחליפים בריאים, רעיונות לארוחות.
- שאלות תזונה כלליות: דיאטות, תוספים, תזמון ארוחות, בריאות.

## פורמט תשובה:

כתוב בטקסט חופשי ועשיר. ענה בצורה מפורטת וטבעית.

בנוסף, כשיש מאכלים קונקרטיים שהמשתמש אכל או שביקש חישוב עבורם — הוסף בסוף התשובה שלך (ורק בסוף) בלוק מיוחד בפורמט הזה:

:::FOODS:::
[{"name": "שם", "grams": מספר, "calories": מספר, "protein": מספר, "carbs": מספר, "fat": מספר}]
:::END:::

- הערכים הם לפי הכמות שהמשתמש תיאר (לא ל-100 גרם).
- אם לא ציין כמות, העריך מנה סטנדרטית וציין זאת בטקסט.
- השתמש בנתונים תזונתיים אמינים ומדויקים ככל האפשר.
- אם אין מאכלים ספציפיים בתשובה (שאלה כללית, ייעוץ) — אל תוסיף את הבלוק הזה.
- אל תשתמש ב-markdown (כוכביות וכו'). כתוב טקסט פשוט.`;

let aiChatMessages = [];

function loadGeminiKey() {
    return localStorage.getItem('nutrition_gemini_key') || '';
}

function saveGeminiKey(key) {
    localStorage.setItem('nutrition_gemini_key', key);
}

function setupAiChat() {
    const section = document.getElementById('ai-chat-section');
    const toggle = document.getElementById('ai-chat-toggle');
    const keySaveBtn = document.getElementById('ai-key-save');
    const keyInput = document.getElementById('ai-key-input');
    const sendBtn = document.getElementById('ai-chat-send');
    const chatInput = document.getElementById('ai-chat-input');
    const changeKeyBtn = document.getElementById('ai-change-key');

    toggle.addEventListener('click', () => {
        section.classList.toggle('expanded');
        if (section.classList.contains('expanded')) {
            updateAiChatView();
        }
    });

    keySaveBtn.addEventListener('click', () => {
        const key = keyInput.value.trim();
        if (!key) return;
        saveGeminiKey(key);
        keyInput.value = '';
        updateAiChatView();
    });

    keyInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') keySaveBtn.click();
    });

    changeKeyBtn.addEventListener('click', () => {
        localStorage.removeItem('nutrition_gemini_key');
        updateAiChatView();
    });

    sendBtn.addEventListener('click', () => sendAiMessage());
    chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendAiMessage();
        }
    });
}

function updateAiChatView() {
    const key = loadGeminiKey();
    const setup = document.getElementById('ai-key-setup');
    const area = document.getElementById('ai-chat-area');
    if (key) {
        setup.style.display = 'none';
        area.style.display = 'flex';
    } else {
        setup.style.display = 'block';
        area.style.display = 'none';
    }
}

function sendAiMessage() {
    const input = document.getElementById('ai-chat-input');
    const text = input.value.trim();
    if (!text) return;

    input.value = '';
    appendChatMsg('user', text);
    appendChatLoading();
    callGemini(text);
}

function appendChatMsg(role, content) {
    if (!content || !content.trim()) return;
    const container = document.getElementById('ai-chat-messages');
    const div = document.createElement('div');
    div.className = `ai-msg ai-msg-${role}`;
    const formatted = escapeHtml(content)
        .replace(/\n{2,}/g, '<br><br>')
        .replace(/\n/g, '<br>');
    div.innerHTML = `<div class="ai-msg-text">${formatted}</div>`;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

function appendChatLoading() {
    const container = document.getElementById('ai-chat-messages');
    const div = document.createElement('div');
    div.className = 'ai-msg ai-msg-bot';
    div.id = 'ai-loading';
    div.innerHTML = '<div class="ai-loading-dots"><span></span><span></span><span></span></div>';
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

function removeChatLoading() {
    const el = document.getElementById('ai-loading');
    if (el) el.remove();
}

function appendFoodCards(foods) {
    const container = document.getElementById('ai-chat-messages');
    const div = document.createElement('div');
    div.className = 'ai-msg ai-msg-bot';

    let html = '<div class="ai-food-cards">';
    foods.forEach((food, i) => {
        html += `
            <div class="ai-food-card" data-ai-food-idx="${i}">
                <div class="ai-food-card-header">
                    <span class="ai-food-card-name">${escapeHtml(food.name)}</span>
                    <span class="ai-food-card-grams">${food.grams}g</span>
                </div>
                <div class="ai-food-card-macros">
                    <div><strong>${food.calories}</strong>קלוריות</div>
                    <div><strong>${food.protein}g</strong>חלבון</div>
                    <div><strong>${food.carbs}g</strong>פחמימות</div>
                    <div><strong>${food.fat}g</strong>שומן</div>
                </div>
                <button class="ai-food-card-add" data-ai-idx="${i}">+ הוסף למעקב</button>
            </div>`;
    });
    html += '</div>';
    div.innerHTML = html;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;

    div.querySelectorAll('.ai-food-card-add').forEach(btn => {
        btn.addEventListener('click', () => {
            const idx = parseInt(btn.dataset.aiIdx);
            const food = foods[idx];
            if (!food) return;
            addAiFoodToLog(food);
            btn.textContent = 'נוסף!';
            btn.disabled = true;
        });
    });
}

function appendAiError(msg) {
    const container = document.getElementById('ai-chat-messages');
    const div = document.createElement('div');
    div.className = 'ai-msg ai-msg-error';
    div.innerHTML = `<div class="ai-msg-text">${escapeHtml(msg)}</div>`;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

function addAiFoodToLog(food) {
    state.dailyLog.push({
        id: Date.now() + Math.random(),
        foodId: 'ai_' + Date.now(),
        name: food.name,
        grams: Math.round(food.grams || 0),
        calories: Math.round(food.calories || 0),
        protein: +(food.protein || 0).toFixed(1),
        carbs: +(food.carbs || 0).toFixed(1),
        fat: +(food.fat || 0).toFixed(1),
        meal: state.selectedMeal,
        time: new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })
    });
    saveDailyLog();
    renderAll();
}

function buildUserContext() {
    const parts = [];
    if (state.profile) {
        const p = state.profile;
        parts.push(`פרופיל: ${p.gender === 'male' ? 'גבר' : 'אישה'}, גיל ${p.age}, ${p.weight} ק"ג, ${p.height} ס"מ, מטרה: ${p.goal === 'lose' ? 'ירידה במשקל' : p.goal === 'gain' ? 'עלייה במשקל' : 'שמירה'}.`);
    }
    if (state.goals.calories > 0) {
        parts.push(`יעדים יומיים: ${state.goals.calories} קלוריות, ${state.goals.protein}g חלבון, ${state.goals.carbs}g פחמימות, ${state.goals.fat}g שומן.`);
    }
    const totals = getDailyTotals();
    if (state.dailyLog.length > 0) {
        parts.push(`נאכל היום: ${Math.round(totals.calories)} קלוריות, ${Math.round(totals.protein)}g חלבון, ${Math.round(totals.carbs)}g פחמימות, ${Math.round(totals.fat)}g שומן (${state.dailyLog.length} פריטים).`);
        const remaining = state.goals.protein - totals.protein;
        if (state.goals.protein > 0 && remaining > 0) {
            parts.push(`נשאר ${Math.round(remaining)}g חלבון עד ליעד.`);
        }
    }
    return parts.length ? '\n\nמידע על המשתמש:\n' + parts.join('\n') : '';
}

async function callGemini(userText) {
    const key = loadGeminiKey();
    if (!key) {
        removeChatLoading();
        appendAiError('לא הוגדר מפתח API. לחץ על "החלף מפתח API" להגדרה.');
        return;
    }

    aiChatMessages.push({ role: 'user', parts: [{ text: userText }] });

    const systemPrompt = AI_SYSTEM_PROMPT + buildUserContext();

    const body = {
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: aiChatMessages,
        generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 8192
        }
    };

    try {
        const resp = await fetch(`${GEMINI_URL}?key=${key}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        removeChatLoading();

        if (!resp.ok) {
            const errData = await resp.json().catch(() => null);
            const errMsg = errData?.error?.message || `שגיאה ${resp.status}`;
            if (resp.status === 400 || resp.status === 403) {
                appendAiError(`מפתח API לא תקין. ${errMsg}`);
            } else if (resp.status === 429) {
                appendAiError('חרגת ממגבלת הבקשות. נסה שוב בעוד דקה.');
            } else {
                appendAiError(`שגיאה: ${errMsg}`);
            }
            aiChatMessages.pop();
            return;
        }

        const data = await resp.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

        aiChatMessages.push({ role: 'model', parts: [{ text }] });

        const parsed = parseGeminiResponse(text);

        if (parsed.text) {
            appendChatMsg('bot', parsed.text);
        }
        if (parsed.foods && parsed.foods.length > 0) {
            appendFoodCards(parsed.foods);
        }
        if (!parsed.text && !parsed.foods?.length) {
            appendChatMsg('bot', text);
        }

    } catch {
        removeChatLoading();
        appendAiError('שגיאת חיבור. בדוק את האינטרנט ונסה שוב.');
        aiChatMessages.pop();
    }
}

function parseGeminiResponse(rawText) {
    let text = rawText;
    let foods = null;

    const foodsMatch = text.match(/:::FOODS:::\s*([\s\S]*?)\s*:::END:::/);
    if (foodsMatch) {
        text = text.replace(foodsMatch[0], '').trim();
        try {
            const arr = JSON.parse(foodsMatch[1].replace(/```json\s*/gi, '').replace(/```/g, '').trim());
            if (Array.isArray(arr)) {
                foods = arr.filter(f => f.name && typeof f.calories === 'number');
            }
        } catch { /* ignore parse error */ }
    }

    if (!foods) {
        const cleaned = rawText.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
        try {
            const json = JSON.parse(cleaned);
            if (json.foods && Array.isArray(json.foods)) {
                foods = json.foods.filter(f => f.name && typeof f.calories === 'number');
                text = json.message || '';
            } else if (Array.isArray(json)) {
                foods = json.filter(f => f.name && typeof f.calories === 'number');
                text = '';
            } else if (json.message) {
                text = json.message;
            }
        } catch { /* not JSON — keep as text */ }
    }

    if (!foods) {
        const arrMatch = text.match(/\[[\s\S]*?\]/);
        if (arrMatch) {
            try {
                const arr = JSON.parse(arrMatch[0]);
                const parsed = arr.filter(f => f.name && typeof f.calories === 'number');
                if (parsed.length) {
                    foods = parsed;
                    text = text.replace(arrMatch[0], '').trim();
                }
            } catch { /* ignore */ }
        }
    }

    text = text.replace(/\*\*/g, '').replace(/^#+\s*/gm, '').trim();

    return { text: text || '', foods: foods && foods.length ? foods : null };
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// ==================== BARCODE SCANNER ====================

let barcodeScanner = null;
let barcodeScannerActive = false;
let scannedProductData = null;

function openBarcodeScanner() {
    showModal('barcode-modal');
    document.getElementById('barcode-result').style.display = 'none';
    document.getElementById('barcode-input').value = '';
    setBarcodeStatus('כוון את המצלמה לברקוד על המוצר', '');

    setTimeout(() => startBarcodeCamera(), 300);
}

function startBarcodeCamera() {
    if (barcodeScannerActive) return;

    const readerEl = document.getElementById('barcode-reader');
    readerEl.innerHTML = '';

    if (typeof Html5Qrcode === 'undefined') {
        setBarcodeStatus('ספריית סריקה לא נטענה. השתמש בהזנה ידנית.', 'error');
        return;
    }

    barcodeScanner = new Html5Qrcode('barcode-reader');
    barcodeScannerActive = true;

    const config = {
        fps: 10,
        qrbox: { width: 250, height: 120 },
        formatsToSupport: [
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39
        ]
    };

    barcodeScanner.start(
        { facingMode: 'environment' },
        config,
        onBarcodeScanned,
        () => {}
    ).catch(err => {
        barcodeScannerActive = false;
        if (String(err).includes('Permission') || String(err).includes('NotAllowed')) {
            setBarcodeStatus('לא ניתנה הרשאת מצלמה. אפשר להזין ברקוד ידנית למטה.', 'error');
        } else {
            setBarcodeStatus('לא ניתן להפעיל מצלמה. הזן ברקוד ידנית למטה.', 'error');
        }
    });
}

function stopBarcodeCamera() {
    if (barcodeScanner && barcodeScannerActive) {
        barcodeScanner.stop().then(() => {
            barcodeScannerActive = false;
            barcodeScanner.clear();
        }).catch(() => {
            barcodeScannerActive = false;
        });
    }
}

function onBarcodeScanned(decodedText) {
    stopBarcodeCamera();
    document.getElementById('barcode-input').value = decodedText;
    lookupBarcode(decodedText);
}

function setBarcodeStatus(msg, type) {
    const el = document.getElementById('barcode-status');
    el.innerHTML = `<p>${msg}</p>`;
    el.className = 'barcode-status' + (type ? ` ${type}` : '');
}

function getBarcodeCache() {
    try {
        return JSON.parse(localStorage.getItem('barcode_cache') || '{}');
    } catch { return {}; }
}

function saveBarcodeCache(barcode, productData, brand, imgUrl) {
    try {
        const cache = getBarcodeCache();
        cache[barcode] = { productData, brand, imgUrl, ts: Date.now() };
        localStorage.setItem('barcode_cache', JSON.stringify(cache));
    } catch { /* quota exceeded - ignore */ }
}

function showBarcodeProduct(productData, brand, imgUrl) {
    const existing = state.customFoods.find(f => f.barcode === productData.barcode);
    if (!existing) {
        addCustomFood(productData);
    }
    scannedProductData = existing || productData;

    document.getElementById('barcode-product-name').textContent = scannedProductData.name;
    document.getElementById('barcode-product-brand').textContent = brand;
    document.getElementById('barcode-cal').textContent = productData.calories;
    document.getElementById('barcode-prot').textContent = productData.protein + 'g';
    document.getElementById('barcode-carb').textContent = productData.carbs + 'g';
    document.getElementById('barcode-fat').textContent = productData.fat + 'g';

    const imgEl = document.getElementById('barcode-product-img');
    if (imgUrl) {
        imgEl.src = imgUrl;
        imgEl.style.display = 'block';
    } else {
        imgEl.style.display = 'none';
    }

    document.getElementById('barcode-result').style.display = 'block';
}

async function lookupBarcode(barcode) {
    barcode = barcode.trim();
    if (!barcode) return;

    setBarcodeStatus('מחפש מוצר...', 'loading');
    document.getElementById('barcode-result').style.display = 'none';

    const cached = getBarcodeCache()[barcode];
    if (cached) {
        setBarcodeStatus('מוצר נמצא!', 'success');
        showBarcodeProduct(cached.productData, cached.brand, cached.imgUrl);
        return;
    }

    try {
        const apiFields = 'product_name,product_name_he,generic_name,brands,nutriments,serving_quantity,serving_size,product_quantity,image_small_url,image_front_small_url,categories_tags';
        const resp = await fetch(`https://world.openfoodfacts.org/api/v2/product/${barcode}.json?fields=${apiFields}`);
        const data = await resp.json();

        if (data.status !== 1 || !data.product) {
            setBarcodeStatus(`מוצר לא נמצא (${barcode}). נסה ברקוד אחר או הוסף ידנית.`, 'error');
            return;
        }

        const p = data.product;
        const nutrients = p.nutriments || {};
        const name = p.product_name_he || p.product_name || p.generic_name || 'מוצר ללא שם';
        const brand = p.brands || '';
        const imgUrl = p.image_small_url || p.image_front_small_url || '';

        const cal = Math.round(nutrients['energy-kcal_100g'] || nutrients['energy-kcal'] || 0);
        const prot = +(nutrients.proteins_100g || 0).toFixed(1);
        const carb = +(nutrients.carbohydrates_100g || 0).toFixed(1);
        const fat = +(nutrients.fat_100g || 0).toFixed(1);

        let servingSize = 100;
        let servingDesc = 'מנה';
        if (p.serving_quantity) {
            servingSize = Math.round(parseFloat(p.serving_quantity));
        } else if (p.product_quantity && p.product_quantity < 500) {
            servingSize = Math.round(parseFloat(p.product_quantity));
        }
        if (p.serving_size) {
            servingDesc = p.serving_size;
        }

        const productData = {
            id: 'bc_' + barcode,
            name,
            category: guessCategoryFromProduct(p),
            calories: cal,
            protein: prot,
            carbs: carb,
            fat,
            fiber: +(nutrients.fiber_100g || 0).toFixed(1),
            servingSize: servingSize || 100,
            servingDescription: servingDesc,
            barcode,
            isCustom: true
        };

        saveBarcodeCache(barcode, productData, brand, imgUrl);
        setBarcodeStatus('מוצר נמצא!', 'success');
        showBarcodeProduct(productData, brand, imgUrl);

    } catch {
        setBarcodeStatus('שגיאת חיבור. בדוק את האינטרנט ונסה שוב.', 'error');
    }
}

function guessCategoryFromProduct(product) {
    const cats = (product.categories_tags || []).join(' ').toLowerCase();
    const name = ((product.product_name || '') + ' ' + (product.generic_name || '')).toLowerCase();
    const all = cats + ' ' + name;

    if (all.match(/milk|חלב|yogurt|יוגורט|cheese|גבינה|cottage|קוטג|dairy/)) return 'מוצרי חלב';
    if (all.match(/meat|בשר|chicken|עוף|beef|בקר|fish|דג|salmon|סלמון|tuna|טונה|egg|ביצ|protein/)) return 'חלבונים';
    if (all.match(/bread|לחם|pasta|פסטה|rice|אורז|cereal|דגנים/)) return 'פחמימות';
    if (all.match(/vegetable|ירק/)) return 'ירקות';
    if (all.match(/fruit|פרי|פירות|juice|מיץ/)) return 'פירות';
    if (all.match(/snack|חטיף|chocolate|שוקולד|candy|ממתק|cookie|עוגי|cake|עוגה/)) return 'חטיפים ומתוקים';
    if (all.match(/oil|שמן|butter|חמאה|nut|אגוז/)) return 'שומנים ושמנים';
    if (all.match(/beverage|drink|משקה|soda|water|מים/)) return 'משקאות';
    if (all.match(/legume|קטניות|lentil|עדש|bean|שעועית/)) return 'קטניות ודגנים';
    return 'מאכלים מוכנים';
}

function handleBarcodeEditName() {
    if (!scannedProductData) return;
    const nameEl = document.getElementById('barcode-product-name');
    const editBtn = document.getElementById('barcode-edit-name');
    const currentName = nameEl.textContent;

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'barcode-name-input';
    input.value = currentName;
    input.maxLength = 40;

    nameEl.textContent = '';
    nameEl.appendChild(input);
    editBtn.style.display = 'none';
    input.focus();
    input.select();

    function save() {
        const newName = input.value.trim();
        if (newName && newName !== currentName) {
            scannedProductData.name = newName;
            renameFood(scannedProductData.id, newName);
        }
        nameEl.textContent = scannedProductData.name;
        editBtn.style.display = '';
    }

    input.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter') { ev.preventDefault(); save(); }
        if (ev.key === 'Escape') { ev.preventDefault(); nameEl.textContent = currentName; editBtn.style.display = ''; }
    });
    input.addEventListener('blur', save);
}

function handleBarcodeAdd() {
    if (!scannedProductData) return;
    hideModal('barcode-modal');
    stopBarcodeCamera();
    openPortionModal(scannedProductData);
}

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
    if (id === 'quick-protein-modal') {
        document.getElementById('qp-protein').value = '';
        document.getElementById('qp-calories').value = '';
        document.getElementById('qp-label').value = '';
        document.getElementById('qp-quick-btns').querySelectorAll('.quick-btn').forEach(b => b.classList.remove('active'));
        const pills = document.getElementById('qp-meal-pills').querySelectorAll('.meal-pill');
        pills.forEach(p => p.classList.toggle('active', p.dataset.meal === state.selectedMeal));
    }
    if (id === 'paste-modal') {
        document.getElementById('paste-textarea').value = '';
        document.getElementById('paste-name').value = '';
        document.getElementById('paste-preview').innerHTML = '';
        document.getElementById('paste-preview').classList.remove('visible');
        document.getElementById('paste-add-btn').disabled = true;
    }
}

function hideModal(id) {
    document.getElementById(id).classList.remove('active');
    document.body.style.overflow = '';
}
